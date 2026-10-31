/** Read-only projection of the core's existing monitor. No Minecraft dependency or execution. */
import {identifier,text} from './contracts.mjs';
const statuses=['not-started','running','completed','blocked','failed','unknown'];
const phases=['preparing','propose','probe','compose','select','reflect','holdout','remember','settled'];
export function createMinecraftExperimentSource({id='minecraft-experiments',sessionId,monitor}){
  identifier(id);text(sessionId,256);
  if(typeof monitor?.snapshot!=='function')throw Error('An explicitly configured core monitor is required');
  return {id,async snapshot(requestedSessionId){
    if(requestedSessionId!==sessionId)return [];
    const snapshot=await monitor.snapshot();
    if(snapshot?.schema!=='agent-mc.experiments/v1'||snapshot.scope!=='isolated-practice-only'
      ||!Array.isArray(snapshot.jobs)||snapshot.jobs.length>100)throw Error('Invalid core experiment projection');
    return snapshot.jobs.map(job=>{
      if(typeof job.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(job.id))throw Error('Invalid core job identity');
      const status=job.stale===true?'unknown':statuses.includes(job.status)?job.status:'unknown';
      return {id:job.id,status,phase:phases.includes(job.phase)?job.phase:status==='not-started'?'preparing':'settled',
        updatedAt:Number.isFinite(job.updatedAt)?job.updatedAt:null,
        result:status==='completed'&&job.result?{
          eligible:typeof job.result.eligible==='boolean'?job.result.eligible:null,
          evidenceCount:Number.isSafeInteger(job.result.evidenceCount)&&job.result.evidenceCount>=0?job.result.evidenceCount:null,
          adopted:false}:null};
    });
  }};
}
