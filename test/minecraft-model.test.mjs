import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMinecraftPracticeModel,createMinecraftPracticeHost,MINECRAFT_PARAMS} from '../src/minecraft-model.mjs';

const route={provider:'existing-provider',model:'existing-model',reasoningEffort:'off',maxTokens:4096};
const request={id:'original-model-request',stage:'inv1.a1',mission:'Use the failed training evidence',files:{'trace/evidence.json':'{"trial":{"feedback":{"failures":[{"why":"Not enough planks"}]}}}'} };
function llm(reply,reason='stop'){
  const requests=[];
  return {requests,async *stream(options){requests.push(options);yield {type:'reasoning-delta',text:'PRIVATE-THOUGHT'};
    yield {type:'text-delta',text:JSON.stringify(reply)};yield {type:'usage',usage:{inputTokens:100,cacheReadTokens:40,cacheWriteTokens:0,outputTokens:20}};
    yield {type:'finish',reason:{kind:reason}};}};
}
test('core model requests use the existing registered DSH route/session, exact failure input and real stream usage shape',async()=>{
  const service=llm({files:{[MINECRAFT_PARAMS]:'{"wood":"observed","logs":2}'}});
  const model=createMinecraftPracticeModel(service,{...route,sessionId:'isolated-practice-session'});
  assert.equal(service.requests.length,0);
  const reply=await model.generate(request,new AbortController().signal);assert.equal(service.requests.length,1);
  const sent=service.requests[0];assert.equal(sent.sessionId,'isolated-practice-session');assert.equal(sent.provider,route.provider);
  assert.equal(sent.model,route.model);assert.equal(sent.reasoningEffort,'off');assert.equal(sent.maxTokens,4096);
  assert.equal(sent.tools,undefined);assert.ok(JSON.stringify(sent.messages).includes('Not enough planks'));assert.ok(!JSON.stringify(reply).includes('PRIVATE-THOUGHT'));
  assert.deepEqual(reply.usage,{inputTokens:140,cachedTokens:40,outputTokens:20});
  assert.notEqual(model.id,createMinecraftPracticeModel(service,{...route,sessionId:'another'}).id);
});
test('rejects out-of-surface patches, invented parameters and truncated answers without a second model request',async()=>{
  for(const [reply,reason] of [[{files:{'skills/minecraft-method/scripts/run.js':'return true;'}},'stop'],
    [{files:{[MINECRAFT_PARAMS]:'{"wood":"observed","logs":999}'}},'stop'],[{},'max-tokens'],[{tools:[]},'stop']]){
    const service=llm(reply,reason),model=createMinecraftPracticeModel(service,{...route,sessionId:'isolated'});
    await assert.rejects(model.generate(request,new AbortController().signal));assert.equal(service.requests.length,1);
  }
});
test('cancellation reaches the original stream and does not retry or replace it',async()=>{
  let calls=0,received;
  const service={async *stream(options){calls++;received=options.signal;await new Promise(resolve=>options.signal.addEventListener('abort',resolve,{once:true}));
    yield {type:'finish',reason:{kind:'stop'}};}};
  const controller=new AbortController(),model=createMinecraftPracticeModel(service,{...route,sessionId:'isolated'});
  const pending=model.generate(request,controller.signal);controller.abort();await assert.rejects(pending);
  assert.equal(received,controller.signal);assert.equal(calls,1);
});
test('host wiring reuses the supplied core executor and fixed worker without constructing a game body or adopting',async()=>{
  const service=llm({}),practice={executor:{binding:{isolated:true},execute(){}},fixtures:[{id:'train'},{id:'holdout'}]};
  const worker={command:'/explicit/python',workspace:'/explicit/scratch'},budget={modelCalls:6,trials:8,wallMs:600000,trialMs:30000,contextBytes:600000};
  const port=createMinecraftPracticeHost({llm:service,route:{...route,sessionId:'must-not-override-owned-session'},sessionId:'isolated',practice,worker,budget,capability:'Dedicated Java 1.21.1 only'});
  assert.equal(port.practice.practice,practice.executor);assert.equal(port.practice.worker,worker);assert.equal(port.practice.fixtures,practice.fixtures);
  assert.equal(service.requests.length,0);assert.equal(port.practice.adopt,undefined);
  await port.practice.model.generate({...request,stage:'experience.agg1'},new AbortController().signal);assert.equal(service.requests[0].sessionId,'isolated');
  assert.throws(()=>createMinecraftPracticeHost({llm:service,route,sessionId:'isolated',practice:{...practice,executor:{binding:{isolated:false}}},worker,budget,capability:'x'}),/executor/);
});
