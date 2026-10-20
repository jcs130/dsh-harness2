import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ExperimentRunner,createMonitor,projectResult} from '../src/runtime.mjs';
import {createLedgerAdapter,ledgerJob} from '../src/ledger.mjs';
import {FILES,hash,validateJob,validFiles,canonical} from '../src/contracts.mjs';

const worker={command:process.execPath,args:[],script:fileURLToPath(new URL('./fixture-worker.mjs',import.meta.url)),workspace:'unused-test-only'};
function fixture(t,options={}){
  const directory=mkdtempSync(join(tmpdir(),'dsh-h2-'));
  t.after(()=>{assert.equal(dirname(directory),resolve(tmpdir()));rmSync(directory,{recursive:true});});
  const calls=[],adapter={...createLedgerAdapter(),...options.adapter};
  const model={id:'test-route/v1',async generate(request,signal){
    calls.push(request);signal.throwIfAborted();
    if(options.generate)return options.generate(request,signal);
    if(request.stage.startsWith('select.'))return {choice:'A',usage:{inputTokens:100,outputTokens:10,cachedTokens:80}};
    if(request.stage.startsWith('experience.'))return {experience:{cue:'signed amounts',lesson:'Keep both signs.',evidence:'Isolated contrast only.',confidence:'Two fixtures'},usage:{inputTokens:100,outputTokens:10,cachedTokens:80}};
    return {files:{[FILES.params]:'{"include":"signed"}'},usage:{inputTokens:100,outputTokens:10,cachedTokens:80}};
  }};
  const runner=new ExperimentRunner({directory,worker,model,adapter,...(options.memory?{memory:options.memory}:{})});
  return {directory,runner,model,adapter,calls,job:ledgerJob()};
}

test('actual interpreter trials preserve baseline and holdout; complete resume has no effects',async t=>{
  const f=fixture(t),result=await f.runner.run(f.job);
  assert.equal(result.gate.eligible,true);assert.equal(result.adopted,false);assert.equal(result.trials,6);assert.equal(result.modelCalls,5);
  assert.equal(result.train.baseline.metrics.absoluteError,2010);assert.equal(result.train.candidate.metrics.absoluteError,0);
  assert.equal(result.holdout[0].baseline.metrics.absoluteError,1525);assert.equal(result.holdout[0].candidate.metrics.absoluteError,0);
  assert.equal(new Set(f.calls.map(c=>c.sessionId)).size,1);
  assert.match(f.calls[0].sessionId,/^harness2:[a-f0-9]{16}:[a-f0-9-]{36}$/);
  const n=f.calls.length;assert.deepEqual(await f.runner.run(f.job),result);assert.equal(f.calls.length,n);
  const other={...f.job,id:'independent-branch'};await f.runner.run(other);
  assert.notEqual(f.calls[n].sessionId,f.calls[0].sessionId);
});

test('metadata journal and read view exclude prompts, responses, method files and other sessions',async t=>{
  const f=fixture(t);await f.runner.run(f.job);
  const file=join(f.runner.directory(f.job),'journal.json');
  const raw=readFileSync(file,'utf8');assert.ok(!raw.includes('PRIVATE'));assert.ok(!raw.includes('Keep both signs'));assert.ok(!raw.includes('include'));
  const monitor=createMonitor({runner:f.runner,jobs:[f.job],enabled:true});
  const snapshot=monitor.snapshot('demo');assert.equal(snapshot.jobs.length,1);assert.equal(snapshot.jobs[0].usage.inputTokens,500);
  assert.equal(snapshot.jobs[0].usage.cachedTokens,400);assert.equal(snapshot.jobs[0].usage.usageSamples,5);
  assert.deepEqual(monitor.snapshot('unrelated-session').jobs,[]);
  snapshot.jobs[0].status='wrong';assert.equal(monitor.snapshot('demo').jobs[0].status,'completed');
  const prior=JSON.parse(raw);prior.prompt='PRIVATE';prior.result.prompts='PRIVATE';prior.calls[0].observation='PRIVATE';writeFileSync(file,JSON.stringify(prior));
  const fresh=createMonitor({runner:f.runner,jobs:[f.job]}).snapshot('demo');assert.ok(!JSON.stringify(fresh).includes('PRIVATE'));
  assert.ok(!JSON.stringify(projectResult(prior.result)).includes('PRIVATE'));
});

test('changed configuration cannot reuse a completed result or overwrite evidence',async t=>{
  const f=fixture(t);await f.runner.run(f.job);const file=join(f.runner.directory(f.job),'journal.json'),before=readFileSync(file,'utf8');
  const edited={...f.job,task:'A different task'};await assert.rejects(f.runner.run(edited));
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(createMonitor({runner:f.runner,jobs:[edited]}).snapshot('demo').jobs[0].status,'unknown');
});

test('cancelled original calls are retained and never replayed, even after a new runner',async t=>{
  const f=fixture(t,{generate:(_request,signal)=>new Promise((resolveWork,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}))});
  const controller=new AbortController(),operation=f.runner.run(f.job,controller.signal);
  while(!f.calls.length)await new Promise(r=>setTimeout(r,10));
  assert.equal(f.runner.running,true);await assert.rejects(f.runner.run(f.job));controller.abort();await assert.rejects(operation);
  const file=join(f.runner.directory(f.job),'journal.json'),prior=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(prior.status,'cancelled');assert.equal(prior.calls.at(-1).phase,'pending');assert.equal(f.calls.length,1);
  await assert.rejects(f.runner.run(f.job));assert.equal(f.calls.length,1);
  assert.equal(existsSync(join(f.runner.directory(f.job),'run.lock')),false);
});

test('unknown cleanup aborts before any candidate model call; cannot report eligibility',async t=>{
  const adapter=createLedgerAdapter();
  const f=fixture(t,{adapter:{async execute(args,signal){return {...await adapter.execute(args,signal),cleanup:'unknown'};}}});
  await assert.rejects(f.runner.run(f.job));assert.equal(f.calls.length,0);
  const snap=createMonitor({runner:f.runner,jobs:[f.job]}).snapshot('demo').jobs[0];assert.equal(snap.status,'blocked');assert.equal(snap.trials,1);assert.equal(snap.result,null);
});

test('unknown token fields stay null and stale running state stays unknown',async t=>{
  const f=fixture(t,{generate:request=>request.stage.startsWith('select.')?{choice:'A'}:request.stage.startsWith('experience.')?{}:{files:{[FILES.params]:'{"include":"signed"}'}}});
  await f.runner.run(f.job);const file=join(f.runner.directory(f.job),'journal.json');
  const prior=JSON.parse(readFileSync(file,'utf8'));prior.status='running';prior.updatedAt=Date.now()-30000;writeFileSync(file,JSON.stringify(prior));
  const snap=createMonitor({runner:f.runner,jobs:[f.job]}).snapshot('demo').jobs[0];assert.equal(snap.status,'unknown');assert.equal(snap.stale,true);
  assert.equal(snap.usage.inputTokens,null);assert.equal(snap.usage.cachedTokens,null);assert.equal(snap.usage.usageSamples,0);
});

test('host memory is scoped, evidence-linked, snapshotted once and idempotent on resume',async t=>{
  let recalls=0,remembers=0;
  const f=fixture(t,{memory:{async recall(query){recalls++;assert.equal(query.sessionId,'demo');return [{lesson:'Prior bounded lesson',evidenceRefs:['prior-trial']}];},async remember(record){remembers++;assert.equal(record.sessionId,'demo');assert.equal(record.result.adopted,false);assert.ok(record.result.evidenceRefs.length);}}});
  await f.runner.run(f.job);await f.runner.run(f.job);assert.equal(recalls,1);assert.equal(remembers,1);
  assert.equal(createMonitor({runner:f.runner,jobs:[f.job]}).snapshot('demo').jobs[0].memory,'stored');
});

test('bounded model budget never silently retries or continues trial effects',async t=>{
  const f=fixture(t);f.job.budget.modelCalls=1;await assert.rejects(f.runner.run(f.job));assert.equal(f.calls.length,1);
  const snapshot=createMonitor({runner:f.runner,jobs:[f.job]}).snapshot('demo').jobs[0];assert.equal(snapshot.modelCalls,1);assert.equal(snapshot.result,null);
});

test('worker receives no inherited secret and never executes generated source',async t=>{
  process.env.H2_TEST_SECRET='PRIVATE';t.after(()=>delete process.env.H2_TEST_SECRET);
  const f=fixture(t);await f.runner.run(f.job);
  const malicious={...f.job,id:'bad-artifact',baseline:{...f.job.baseline,[FILES.params]:'{"include":"eval(process.env)"}'}};
  await assert.rejects(f.runner.run(malicious));
});

test('configuration validation rejects path escapes, dynamic scripts and missing holdouts',()=>{
  for(const bad of ['../secrets','skills/experiment/scripts/../../.env','plugins/execute.ts','guardrails.md'])assert.throws(()=>validFiles({[bad]:'x'},[bad]));
  assert.throws(()=>validateJob({...ledgerJob(),holdout:[]}));assert.throws(()=>validateJob({...ledgerJob(),k:0}));
  assert.throws(()=>canonical({value:Infinity}));assert.equal(hash({b:2,a:1}),hash({a:1,b:2}));
});
