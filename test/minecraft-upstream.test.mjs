/** Opt-in packed-core integration. Real Google optimizer; explicitly fake model stream/stock world. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createMinecraftPracticeModel,MINECRAFT_PARAMS} from '../src/minecraft-model.mjs';
const core=process.env.MC_PRACTICE_CORE_PACKAGE,workerFile=process.env.H2_CORE_WORKER_CONFIG;
test('existing DSH stream -> core Harness² -> measured failure -> params -> independent holdouts; no replay',
  {skip:!core||!workerFile,timeout:120000},async()=>{
    const load=path=>import(pathToFileURL(join(resolve(core),path)).href);
    const {createCraftingExperiment}=await load('examples/harness2-crafting.mjs');
    const {createPracticeModelAudit,summarizeModelAudit}=await load('scripts/practice-model-audit.mjs');
    const directory=mkdtempSync(join(tmpdir(),'dsh-core-model-port-'));
    let calls=0;
    try{
      const llm={async *stream(options){
        calls++;const input=JSON.stringify(options.messages);
        assert.ok(!input.includes('holdout-birch'));assert.ok(!input.includes('holdout-spruce-existing'));
        if(calls===1){assert.ok(input.includes('insufficient-recipe-inputs'));assert.ok(input.includes('wooden_pickaxe'));assert.ok(input.includes('trialId'));}
        // Test double only: no supplier LLM is called and no autonomous discovery is claimed.
        const reply=input.includes('"experience.')?{}:{files:{[MINECRAFT_PARAMS]:'{"wood":"observed","logs":2}'}};
        yield {type:'text-delta',text:JSON.stringify(reply)};
        yield {type:'usage',usage:{inputTokens:100,cacheReadTokens:40,cacheWriteTokens:0,outputTokens:20}};
        yield {type:'finish',reason:{kind:'stop'}};
      }};
      const model=createMinecraftPracticeModel(llm,{sessionId:'isolated-fixture',provider:'fixture',model:'fake-stream',maxTokens:4096});
      const audit=createPracticeModelAudit({model,file:join(directory,'model-calls.jsonl'),provenance:{kind:'scripted-test-double'},
        trainingJournal:join(directory,'jobs/host-port-fixture/journal.json'),requireFailureFeedback:true});
      const experiment=createCraftingExperiment({directory,worker:JSON.parse(readFileSync(workerFile,'utf8')),model:audit.model,id:'host-port-fixture'});
      const result=await experiment.runner.run(experiment.job);
      assert.equal(result.gate.eligible,true);assert.equal(result.adopted,false);assert.equal(result.trials,8);assert.equal(calls,4);
      assert.ok(result.holdout.every(row=>row.candidate.achieved===true));
      const costs=summarizeModelAudit(audit.snapshot(),audit.provenance);
      assert.equal(costs.inputTokens,560);assert.equal(costs.outputTokens,80);assert.equal(costs.costUsd,null);assert.equal(costs.scripted,true);
      assert.ok(costs.callsWithFailedTrainingFeedback>=3);
      const before=experiment.practice.stats();assert.deepEqual(await experiment.runner.run(experiment.job),result);
      assert.deepEqual(experiment.practice.stats(),before);assert.equal(calls,4);
      assert.ok(experiment.practice.library.list().methods.every(row=>row.selected===null));
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
