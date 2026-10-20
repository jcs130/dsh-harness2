import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Context} from '@deepseek-ai/cordis';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import {ToolRuntime} from '@deepseek-ai/dsh-tools';
import {HostConnectionService} from '@deepseek-ai/dsh-client-connection';
import {readPluginMeta} from '@deepseek-ai/dsh-app-boot';
import {DeepSeekAdapter,resolveAdapterOptions} from '@deepseek-ai/dsh-llm-deepseek';
import * as plugin from '../src/plugin.mjs';
import {createDshModel} from '../src/model.mjs';
import {createLab,experimentTools} from '../src/lab.mjs';
import {ledgerJob} from '../src/ledger.mjs';
import {FILES} from '../src/contracts.mjs';

const require=createRequire(import.meta.url);
const makeRequest=(sessionId='owned',extra={})=>new Request('http://localhost/api/harness2/experiments',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'fixture-rpc',method:'harness2/experiments',payload:{sessionId,...extra}})});

test('real DSH plugin lifecycle registers tools and an owner-authenticated Desktop/Web API; disposal removes it',async()=>{
  const root=new Context();let calls=0;
  const base=await root.plugin({name:'fixture-base',apply(ctx){new SystemPrompt(ctx,SystemPrompt.Config({}));new ToolRuntime(ctx);ctx.provide('llm',{async *stream(){calls++;throw Error('No inference in this test');}});}}).await();
  const connection=await root.plugin({name:'fixture-connection',apply(ctx){new HostConnectionService(ctx,[],{isAuthenticated:()=>true});}}).await();
  const lab=await root.plugin(plugin,{}).await();
  try{
    assert.equal(typeof root.get('harness2').registerAdapter,'function');assert.equal(typeof root.get('tools').get('harness2_run').execute,'function');
    const handler=root.get('connection').createSharedFetchHandler('/api'),owner={principal:{kind:'owner'}};
    const response=await handler.fetch(makeRequest(),owner);assert.equal(response.status,200);
    const result=(await response.json()).result;assert.equal(result.ok,true);assert.equal(result.value.sessionId,'owned');assert.deepEqual(result.value.snapshot.jobs,[]);
    assert.equal((await handler.fetch(makeRequest(),{principal:{kind:'delegate'}})).status,403);
    assert.equal((await handler.fetch(makeRequest('owned',{unexpected:'PRIVATE'}),owner)).status,400);
    assert.equal(calls,0);await lab.dispose();assert.equal((await handler.fetch(makeRequest(),owner)).status,404);
  }finally{await lab.dispose();await connection.dispose();await base.dispose();}
});

test('official DSH metadata resolves the manifest, translations, icon and schema',()=>{
  const meta=readPluginMeta('@jcs130/dsh-harness2',new URL('../package.json',import.meta.url).href);
  assert.equal(meta.error,undefined);assert.equal(meta.title.zh,'Harness² 实验室');assert.equal(meta.title.en,'Harness² Lab');assert.ok(meta.icon.startsWith('data:image/svg+xml;base64,'));
  assert.equal(plugin.Config({}).configFile,'');
});

test('DSH actual DeepSeek provider preserves selected effort, independent session and final usage over local SSE',async()=>{
  const requests=[],reply={files:{[FILES.params]:'{"include":"signed"}'}};
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;requests.push({body:JSON.parse(raw),session:req.headers['x-deepseek-harness-session-id']});
    res.writeHead(200,{'content-type':'text/event-stream'});
    for(const e of [
      {type:'message_start',message:{id:'fixture',type:'message',role:'assistant',model:'deepseek-flash',content:[],usage:{input_tokens:20,cache_read_input_tokens:80,cache_creation_input_tokens:0,output_tokens:0}}},
      {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
      {type:'content_block_delta',index:0,delta:{type:'text_delta',text:JSON.stringify(reply)}},
      {type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:25}},{type:'message_stop'},
    ])res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const adapter=new DeepSeekAdapter({options:()=>resolveAdapterOptions({baseURL:`http://127.0.0.1:${server.address().port}/anthropic`,thinking:'disabled',reasoningEffort:'off',maxTokens:6000}),resolveAuth:async()=>({headers:{'x-api-key':'local-fixture'}}),resolveUserId:()=> 'fixture',prepareExtensions:async()=>({fields:{},accept:async()=>{}})});
    const model=createDshModel({stream:opts=>adapter.stream(opts)},{provider:'deepseek',model:'deepseek-flash',reasoningEffort:'off',maxTokens:4096});
    const result=await model.generate({id:'request',sessionId:'harness2:independent-fixture',stage:'inv1.a1',mission:'fixture only',files:{},editable:[FILES.params]},new AbortController().signal);
    assert.deepEqual(result.files,reply.files);assert.deepEqual(result.usage,{inputTokens:100,outputTokens:25,cachedTokens:80});assert.equal(requests.length,1);
    assert.equal(requests[0].session,'harness2:independent-fixture');assert.equal(requests[0].body.thinking.type,'disabled');assert.equal(requests[0].body.max_tokens,4096);
  }finally{await new Promise(r=>server.close(r));}
});

test('model rejects incomplete and truncated streams, ignores thought content, never retries',async()=>{
  for(const reason of [null,'max-tokens','error']){
    let count=0;
    const model=createDshModel({async *stream(){count++;yield {type:'reasoning-delta',text:'PRIVATE-THOUGHT'};yield {type:'text-delta',text:'{}'};if(reason)yield {type:'finish',reason:{kind:reason}};}},{provider:'fixture',model:'fixture',maxTokens:4096});
    await assert.rejects(model.generate({sessionId:'fixture',stage:'propose',mission:'fixture',files:{},editable:[]},new AbortController().signal));assert.equal(count,1);
  }
  const model=createDshModel({async *stream(){yield {type:'text-delta',text:'{}'};yield {type:'usage',usage:{inputTokens:20,outputTokens:3}};yield {type:'finish',reason:{kind:'stop'}};}},{provider:'fixture',model:'fixture',maxTokens:4096});
  const reply=await model.generate({sessionId:'fixture',stage:'propose',mission:'fixture',files:{},editable:[]},new AbortController().signal);
  assert.deepEqual(reply.usage,{inputTokens:null,outputTokens:3,cachedTokens:null});
});

test('native Web client uses the same Desktop tab, escapes task text, shows unknowns and never provides run/adopt controls',()=>{
  let module,tab;
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load(value){module=value.factory(name=>require(name));}}},
  });
  module.apply({slots:{inject(_name,fn){fn();},register(options,component){tab={options,component};}}});
  assert.equal(tab.options.name,'conversation.view');assert.equal(tab.options.id,'harness2-lab');
  let html=renderToStaticMarkup(React.createElement(module.ExperimentView,{snapshot:{enabled:false,jobs:[],external:[]}}));
  assert.ok(html.includes('本会话还没有实验'));assert.ok(!html.includes('<iframe'));assert.ok(!html.includes('<button'));
  html=renderToStaticMarkup(React.createElement(module.ExperimentView,{snapshot:{enabled:true,jobs:[{id:'<script>PRIVATE</script>',adapter:'fixture',status:'unknown',phase:'settled',usage:{inputTokens:null}}],external:[]}}));
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('未知'));assert.ok(html.includes('—'));assert.ok(html.includes('输入 — tok'));
});

test('external game experiment sources stay in their own core, share read sampling and expose bounded metadata only',async()=>{
  const lab=createLab({config:{enabled:false,jobs:[]},directory:'unused',model:{id:'unused',generate(){throw Error('No models');}}});let calls=0;
  const off=lab.registerSource({id:'minecraft',async snapshot(sessionId){calls++;assert.equal(sessionId,'owned');return [{id:'walk',status:'completed',phase:'settled',updatedAt:1,result:{eligible:true,evidenceCount:6,prompt:'PRIVATE'},candidateCode:'PRIVATE'}];}});
  const [a,b]=await Promise.all([lab.snapshot('owned'),lab.snapshot('owned')]);assert.equal(calls,1);assert.equal(a.external[0].result.eligible,true);assert.equal(a.external[0].result.adopted,false);
  assert.ok(!JSON.stringify(a).includes('PRIVATE'));assert.deepEqual(a.external,b.external);off();assert.deepEqual((await lab.snapshot('owned')).external,[]);await lab.close();
});

test('Agent tools require an owning session and never accept another session as input',async()=>{
  const calls=[];const [status,run]=experimentTools({snapshot:async sessionId=>{calls.push(sessionId);return{};},run:async(id,sessionId)=>{calls.push([id,sessionId]);return{};}});
  assert.throws(()=>status.execute({},{}));
  await status.execute({sessionId:'other'},{agent:{session:{id:'owned'}}});
  await run.execute({jobId:'one',sessionId:'other'},{agent:{session:{id:'owned'}},signal:new AbortController().signal});
  assert.deepEqual(calls,['owned',['one','owned']]);assert.equal(run.parameters.additionalProperties,false);
});

test('disabled job history remains visible; unregistered adapters cannot freeze the lab',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'dsh-h2-lab-'));t.after(()=>{assert.equal(dirname(directory),resolve(tmpdir()));rmSync(directory,{recursive:true});});
  const job={...ledgerJob('external'),adapter:'unregistered'},model={id:'fixture',generate(){throw Error('No model');}};
  const lab=createLab({config:{enabled:true,jobs:[job]},model,directory});
  await assert.rejects(lab.run(job.id,'demo',new AbortController().signal));await assert.rejects(lab.run(job.id,'demo',new AbortController().signal));
  assert.equal((await lab.snapshot('demo')).jobs[0].status,'unknown');assert.equal((await lab.snapshot('other')).jobs.length,0);await lab.close();
});
