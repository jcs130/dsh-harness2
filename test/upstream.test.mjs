import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ExperimentRunner,createMonitor,REVISION} from '../src/runtime.mjs';
import {ledgerJob,createLedgerAdapter,deterministicLedgerModel} from '../src/ledger.mjs';

const workerFile=process.env.H2_WORKER_CONFIG;
test('real pinned Google workflow, both recursion modes, physical adapter, independent holdout and cached resume',
  {skip:!workerFile,timeout:240000},async t=>{
    const directory=mkdtempSync(join(tmpdir(),'dsh-h2-google-'));
    t.after(()=>{assert.equal(dirname(directory),resolve(tmpdir()));rmSync(directory,{recursive:true});});
    const worker=JSON.parse(readFileSync(workerFile,'utf8')),base=deterministicLedgerModel();let calls=0;
    const model={id:base.id,async generate(...args){calls++;return base.generate(...args);}};
    for(const mode of ['parallel','sequential']){
      const job={...ledgerJob(`actual-${mode}-${randomUUID().slice(0,8)}`),mode,k:mode==='sequential'?2:1};
      job.budget={...job.budget,modelCalls:24,trials:24,wallMs:120000};
      const runner=new ExperimentRunner({directory,worker,adapter:createLedgerAdapter(),model}),result=await runner.run(job);
      assert.equal(result.upstreamRevision,REVISION);assert.equal(result.gate.eligible,true);assert.equal(result.adopted,false);
      assert.equal(result.holdout.length,1);assert.equal(result.holdout[0].candidate.metrics.absoluteError,0);assert.equal(result.train.baseline.metrics.absoluteError,2010);
      const previous=calls;assert.deepEqual(await runner.run(job),result);assert.equal(calls,previous);
      const snapshot=createMonitor({runner,jobs:[job]}).snapshot('demo');assert.equal(snapshot.jobs[0].status,'completed');
      assert.equal(snapshot.jobs[0].usage.inputTokens,null);assert.equal(snapshot.jobs[0].usage.usageSamples,0);
    }
  });
