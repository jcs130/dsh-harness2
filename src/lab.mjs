import {ExperimentRunner,createMonitor,projectResult} from './runtime.mjs';
import {createLedgerAdapter} from './ledger.mjs';
import {identifier,validateJob,copy,SCHEMA} from './contracts.mjs';

/** Host service. External sources retain their domain runner and canonical memory. */
export function createLab({config,model,directory}){
  const jobs=copy(config.jobs??[]),adapters=new Map([['ledger',createLedgerAdapter()]]),runners=new Map(),sources=new Map(),pending=new Set();
  const lifetime=new AbortController();let running=false;
  if(jobs.length>32||new Set(jobs.map(j=>`${j.sessionId}/${j.id}`)).size!==jobs.length)throw Error('Configure at most 32 distinct scoped jobs');
  jobs.forEach(validateJob);
  const forJob=job=>{
    const adapter=adapters.get(job.adapter);if(!adapter)throw Error('Task adapter is not registered');
    if(!runners.has(job.adapter)){
      const runner=new ExperimentRunner({directory,model,worker:config.worker,adapter,...(adapter.memory?{memory:adapter.memory}:{})});
      runners.set(job.adapter,{runner,monitor:createMonitor({runner,jobs:jobs.filter(j=>j.adapter===job.adapter),enabled:config.enabled===true})});
    }
    return runners.get(job.adapter);
  };
  return {
    registerAdapter(adapter){
      identifier(adapter.id);if(adapters.has(adapter.id)||adapter.isolated!==true)throw Error('Duplicate or non-isolated adapter');
      adapters.set(adapter.id,adapter);
      return ()=>{if(running)throw Error('Cannot unregister a running adapter');adapters.delete(adapter.id);runners.delete(adapter.id);};
    },
    registerSource(source){
      identifier(source.id);if(sources.has(source.id)||typeof source.snapshot!=='function')throw Error('Invalid experiment source');
      const entry={source,cache:new Map()};sources.set(source.id,entry);
      return ()=>sources.delete(source.id);
    },
    async snapshot(sessionId){
      if(typeof sessionId!=='string'||!sessionId||sessionId.length>256)throw Error('Require an owning DSH session');
      const views=[];
      for(const job of jobs.filter(j=>j.sessionId===sessionId)){
        try{views.push(...forJob(job).monitor.snapshot(sessionId).jobs.filter(j=>j.id===job.id));}
        catch{views.push({id:job.id,adapter:job.adapter,status:'unknown',phase:'settled',result:null});}
      }
      const external=[];
      for(const {source,cache} of sources.values()){
        let item=cache.get(sessionId);
        if(!item||Date.now()-item.time>=2000){
          const promise=Promise.resolve().then(()=>source.snapshot(sessionId)).then(rows=>{
            if(!Array.isArray(rows)||rows.length>100)throw Error('Bounded external rows required');
            return rows.map(row=>externalRow(source.id,row));
          }).catch(()=>[{id:source.id,source:source.id,status:'unknown',phase:'settled',updatedAt:null,adopted:false}]);
          item={time:Date.now(),promise};cache.set(sessionId,item);
          // Only active UI sessions occupy this bounded read cache.
          if(cache.size>64)cache.delete(cache.keys().next().value);
        }
        external.push(...await item.promise);
      }
      return {schema:SCHEMA,sampledAt:Date.now(),enabled:config.enabled===true,scope:'isolated-experiments-only',jobs:views,external};
    },
    async run(jobId,sessionId,signal){
      if(config.enabled!==true)throw Error('New experiments are disabled');
      lifetime.signal.throwIfAborted();signal.throwIfAborted();
      if(running)throw Error('Another experiment is running; no automatic queue or retry');
      const job=jobs.find(j=>j.id===jobId&&j.sessionId===sessionId);if(!job)throw Error('No such configured job in this session');
      const runner=forJob(job).runner;running=true;
      const operation=runner.run(job,AbortSignal.any([signal,lifetime.signal]));pending.add(operation);
      try{return projectResult(await operation);}finally{running=false;pending.delete(operation);}
    },
    async close(){lifetime.abort();await Promise.allSettled([...pending]);},
  };
}

function externalRow(source,row){
  if(typeof row.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(row.id))throw Error('Invalid external identity');
  const statuses=['not-started','running','completed','blocked','failed','cancelled','unknown'];
  const phases=['preparing','propose','probe','compose','select','reflect','holdout','remember','settled'];
  if(!statuses.includes(row.status)||!phases.includes(row.phase))throw Error('Invalid external phase');
  const result=row.result?{eligible:typeof row.result.eligible==='boolean'?row.result.eligible:null,
    evidenceCount:Number.isSafeInteger(row.result.evidenceCount)&&row.result.evidenceCount>=0?row.result.evidenceCount:null,
    adopted:false}:null;
  return {id:row.id,source,status:row.status,phase:row.phase,
    updatedAt:Number.isFinite(row.updatedAt)?row.updatedAt:null,result,adopted:false};
}

export function experimentTools(lab){
  const session=exec=>{const id=exec.agent?.session?.id;if(typeof id!=='string'||!id)throw Error('An owning Agent session is required');return id;};
  const output={schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
  return [{name:'harness2_status',description:'只读查看本会话已配置的 Harness² 实验、试跑证据和指标，不启动模型或任务。',
    parameters:{type:'object',properties:{},additionalProperties:false},output,isConcurrencySafe:()=>true,
    execute:(_args,exec)=>lab.snapshot(session(exec))},
  {name:'harness2_run',description:'执行本会话明确配置的隔离实验，生成候选、试跑、组合与反思。受预算约束，不自动采用或重放中断任务。只能传入已配置 jobId。',
    parameters:{type:'object',additionalProperties:false,properties:{jobId:{type:'string'}},required:['jobId']},output,isConcurrencySafe:()=>false,
    execute:(args,exec)=>lab.run(args.jobId,session(exec),exec.signal)}];
}
