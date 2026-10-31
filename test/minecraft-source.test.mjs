import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMinecraftExperimentSource} from '../src/minecraft-source.mjs';
import {createLab} from '../src/lab.mjs';
test('core source is session scoped, whitelists metadata and preserves unknown/stale evidence',async()=>{
  let reads=0;
  const monitor={snapshot(){reads++;return {schema:'agent-mc.experiments/v1',scope:'isolated-practice-only',jobs:[
    {id:'crafting',status:'completed',phase:'settled',updatedAt:10,result:{eligible:true,evidenceCount:8,adopted:true},code:'private',token:'secret'},
    {id:'stale',status:'running',phase:'probe',stale:true,updatedAt:1,result:{eligible:true,evidenceCount:1}},
    {id:'new',status:'not-started',phase:null,updatedAt:null,result:null},
  ]};}};
  const source=createMinecraftExperimentSource({sessionId:'owned-session',monitor});
  assert.deepEqual(await source.snapshot('another-session'),[]);assert.equal(reads,0);
  const lab=createLab({config:{enabled:false,jobs:[]},directory:'/unused',model:{id:'never',generate(){throw Error('must not run');}}});
  const off=lab.registerSource(source),view=await lab.snapshot('owned-session');
  assert.equal(view.external[0].result.adopted,false);assert.equal(view.external[0].result.evidenceCount,8);
  assert.equal(view.external[1].status,'unknown');assert.equal(view.external[1].result,null);
  assert.equal(view.external[2].phase,'preparing');assert.equal(reads,1);
  assert(!JSON.stringify(view).includes('private'));assert(!JSON.stringify(view).includes('secret'));
  await lab.snapshot('owned-session');assert.equal(reads,1);off();assert.deepEqual((await lab.snapshot('owned-session')).external,[]);
});
test('source requires the actual core schema; it does not read arbitrary journals',async()=>{
  const source=createMinecraftExperimentSource({sessionId:'s',monitor:{snapshot:()=>({schema:'other',jobs:[]})}});
  await assert.rejects(source.snapshot('s'),/Invalid core/);
  assert.throws(()=>createMinecraftExperimentSource({sessionId:'s',monitor:{}}),/monitor/);
});
