import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,openSync,closeSync,unlinkSync,writeFileSync,renameSync,readFileSync,lstatSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {REVISION,SCHEMA,hash,canonical,copy,identifier,text,validateJob,validFiles,metrics,usage,abortable} from './contracts.mjs';

export {REVISION,SCHEMA} from './contracts.mjs';
export {hash as artifactHash} from './contracts.mjs';
export const workerPath=()=>fileURLToPath(new URL('../bridges/worker.py',import.meta.url));
const allowedEnvironment=['SystemRoot','WINDIR','PATH','Path','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','HOME','LANG','LC_ALL'];
function privateWrite(path,value){const temporary=path+'.'+randomUUID()+'.tmp';writeFileSync(temporary,canonical(value),{flag:'wx',mode:0o600});renameSync(temporary,path);}
function read(path,max=2000000){const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.size>max)throw Error('Invalid bounded journal');return JSON.parse(readFileSync(path,'utf8'));}
function plainResult(trial){return {trialId:trial.trialId,caseId:trial.caseId,outcome:trial.outcome,metrics:metrics(trial.metrics)};}
function phase(stage){return stage.startsWith('select.')?'select':stage.startsWith('experience.')?'reflect':stage.includes('compose')?'compose':'propose';}
function countUsage(calls){
  const returned=calls.filter(c=>c.kind==='model'&&c.phase==='returned');
  return {...Object.fromEntries(['inputTokens','outputTokens','cachedTokens'].map(k=>[k,returned.length&&returned.every(c=>c.usage[k]!==null)?returned.reduce((n,c)=>n+c.usage[k],0):null])),
    returnedCalls:returned.length,usageSamples:returned.filter(c=>c.usage.inputTokens!==null&&c.usage.outputTokens!==null).length};
}

/** Generic engine: task-specific execution and objective checks are injected ports. */
export class ExperimentRunner {
  constructor(options){
    if(!options?.directory||!options.model?.id||typeof options.model.generate!=='function'||!options.adapter?.version||options.adapter.isolated!==true
      ||typeof options.adapter.execute!=='function'||typeof options.adapter.validate!=='function'||typeof options.adapter.compare!=='function')throw Error('Require an explicit model and isolated task adapter');
    this.options=options;this.running=false;
  }
  fingerprint(job){validateJob(job);if(job.adapter!==this.options.adapter.id)throw Error('Job adapter mismatch');return hash({job,model:this.options.model.id,adapter:{id:this.options.adapter.id,version:this.options.adapter.version},upstream:REVISION});}
  directory(job){return join(resolve(this.options.directory),hash(job.sessionId).slice(0,24),job.id);}
  async run(original,signal=new AbortController().signal){
    const job=copy(original), configurationHash=this.fingerprint(job), directory=this.directory(job);
    signal.throwIfAborted();this.options.adapter.validate(copy(job.baseline));
    if(this.running)throw Error('An experiment is already running in this runner');
    mkdirSync(directory,{recursive:true,mode:0o700});
    const lockFile=join(directory,'run.lock'), lock=openSync(lockFile,'wx');this.running=true;
    const journalFile=join(directory,'journal.json'),contextFile=join(directory,'context.json');
    const controller=new AbortController(),abort=()=>controller.abort();
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    const timer=setTimeout(abort,job.budget.wallMs);
    let owned=false,child,heartbeat,journal,done,queue=Promise.resolve(),pending=0;
    const save=()=>{journal.updatedAt=Date.now();privateWrite(journalFile,journal);};
    try{
      if(existsSync(contextFile)){
        const priorContext=read(contextFile,100000);
        if(priorContext.configurationHash!==configurationHash)throw Error('Configuration changed; preserve evidence and use a new job ID');
        if(!existsSync(journalFile))throw Error('Original context has no journal; explicit reconciliation required');
        const prior=read(journalFile);
        if(prior.schema!==SCHEMA||prior.configurationHash!==configurationHash||prior.runHash!==priorContext.runHash)throw Error('Evidence identity mismatch');
        if(prior.status==='completed'&&prior.result)return copy(prior.result);
        // Never replay an interrupted model request or task execution.
        throw Error('Previous experiment is incomplete; inspect it and explicitly configure a new job ID');
      }
      if(existsSync(journalFile))throw Error('Original journal has no context; explicit reconciliation required');
      const evidenceId=randomUUID(),runHash=hash({configurationHash,evidenceId});
      let lessons=copy(job.lessons??[]);
      if(this.options.memory?.recall){
        const recalled=await abortable(this.options.memory.recall({sessionId:job.sessionId,task:job.task},controller.signal),controller.signal);
        lessons=[...lessons,...recalled].slice(0,8);validateJob({...job,lessons});
      }
      const modelSessionId=`harness2:${hash(job.sessionId).slice(0,16)}:${randomUUID()}`;
      privateWrite(contextFile,{configurationHash,runHash,modelSessionId,evidenceId,lessons});
      journal={schema:SCHEMA,id:job.id,adapter:job.adapter,configurationHash,runHash,sessionHash:hash(job.sessionId),status:'running',phase:'preparing',
        startedAt:Date.now(),updatedAt:Date.now(),endedAt:null,mode:job.mode,k:job.k,budget:copy(job.budget),modelCalls:0,trials:0,calls:[],
        memory:this.options.memory?.remember?'pending':'disabled',result:null};owned=true;save();
      heartbeat=setInterval(()=>{try{if(journal.status==='running')save();}catch{controller.abort();}},5000);heartbeat.unref();
      const byRun=new Map(),baselineRuns=[];
      const execute=async(label,candidate,fixture,group='train',role='candidate')=>{
        controller.signal.throwIfAborted();validFiles(candidate,job.editable);
        if(Object.keys(candidate).length!==Object.keys(job.baseline).length||Object.keys(job.baseline).some(p=>!Object.hasOwn(candidate,p)||(!job.editable.includes(p)&&candidate[p]!==job.baseline[p])))throw Error('Candidate changed immutable artifacts');
        this.options.adapter.validate(copy(candidate));
        if(journal.trials>=job.budget.trials)throw Error('Trial budget exhausted');
        const trialId=hash({runHash,label}),candidateHash=hash(candidate);
        if(journal.calls.some(c=>c.id===trialId))throw Error('Duplicate original trial');
        const record={id:trialId,kind:'trial',phase:'pending',startedAt:Date.now(),endedAt:null,caseId:fixture.id,group,role,candidateHash};
        journal.trials++;journal.phase=group==='holdout'?'holdout':'probe';journal.calls.push(record);save();
        const trialSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(job.budget.trialMs)]);
        try{
          const result=await abortable(this.options.adapter.execute({trialId,candidate:copy(candidate),fixture:copy(fixture)},trialSignal),trialSignal);
          if(result?.trialId!==trialId||result.candidateHash!==candidateHash||result.caseId!==fixture.id||result.environmentId!==fixture.environmentId||result.cleanup!=='settled'||!['success','failed','unknown'].includes(result.outcome))throw Error('Unknown trial identity or cleanup');
          metrics(result.metrics);
          if(Buffer.byteLength(canonical(result.observation??null))>32000)throw Error('Observation exceeds adapter evidence budget');
          record.phase='returned';record.endedAt=Date.now();record.outcome=result.outcome;record.metrics=metrics(result.metrics);save();
          return {...plainResult(result),observation:copy(result.observation??null)};
        }catch{
          journal.status='blocked';journal.reason='trial-effect-or-cleanup-unknown';save();controller.abort();throw Error('Trial effect or cleanup unknown; no replay permitted');
        }
      };
      const handle=async message=>{
        controller.signal.throwIfAborted();
        if(message.type==='done'){
          if(done||message.result?.upstreamRevision!==REVISION)throw Error('Invalid worker completion');
          done=message.result;return;
        }
        if(done||message.type!=='rpc'||!Number.isSafeInteger(message.id)||message.id<1)throw Error('Invalid worker callback');
        const requestId=`worker:${message.id}`;
        if(journal.calls.some(c=>c.requestId===requestId))throw Error('Duplicate worker callback');
        let value;
        if(message.op==='trial'){
          text(message.runId,600);
          if(byRun.has(message.runId))throw Error('Duplicate original run');
          const isBase=message.runId.split('/').at(-1).startsWith('base'),isOriginal=hash(message.candidate)===hash(job.baseline);
          if(isBase&&!baselineRuns.length&&!isOriginal)throw Error('Original baseline was modified');
          value=await execute(message.runId,message.candidate,job.train,'train',isOriginal?'baseline':'candidate');
          journal.calls.at(-1).requestId=requestId;save();byRun.set(message.runId,{value,candidate:copy(message.candidate)});
          if(isBase)baselineRuns.push(value);
        }else if(message.op==='model'){
          text(message.label,256);text(message.mission,200000);
          if(!message.files||Object.getPrototypeOf(message.files)!==Object.prototype||Object.keys(message.files).length>300||Object.values(message.files).some(v=>typeof v!=='string')||Buffer.byteLength(canonical({mission:message.mission,files:message.files}))>job.budget.contextBytes)throw Error('Bounded model context required');
          if(journal.modelCalls>=job.budget.modelCalls)throw Error('Model call budget exhausted');
          const record={id:hash({runHash,requestId}),requestId,kind:'model',stage:message.label,phase:'pending',startedAt:Date.now(),endedAt:null};
          journal.modelCalls++;journal.phase=phase(message.label);journal.calls.push(record);save();
          value=await abortable(this.options.model.generate({id:record.id,sessionId:modelSessionId,stage:message.label,mission:message.mission,files:copy(message.files),editable:copy(job.editable)},controller.signal),controller.signal);
          if(!value||Object.getPrototypeOf(value)!==Object.prototype||Buffer.byteLength(canonical(value))>100000)throw Error('Invalid bounded model artifact reply');
          record.phase='returned';record.endedAt=Date.now();record.usage=usage(value.usage);record.replyHash=hash(value);save();
        }else throw Error('Unknown callback operation');
        await new Promise((resolveWrite,reject)=>{child.stdin.write(JSON.stringify({id:message.id,value})+'\n',e=>e?reject(e):resolveWrite());});
      };
      const worker=this.options.worker;
      if(!worker?.command||!worker.script||!worker.workspace||!Array.isArray(worker.args??[]))throw Error('Configure the explicit Python bridge, workspace and command');
      const env=Object.fromEntries(allowedEnvironment.filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
      child=spawn(worker.command,[...(worker.args??[]),worker.script],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      this.stop=()=>controller.abort();
      const kill=()=>{child.stdin.destroy();child.kill();};controller.signal.addEventListener('abort',kill,{once:true});
      if(controller.signal.aborted)kill();
      let buffer='',stderrBytes=0,protocolError,diagnosticLine='';
      child.stdin.on('error',()=>{if(!done)controller.abort();});
      child.stderr.on('data',data=>{
        stderrBytes+=data.length;if(stderrBytes>1000000)controller.abort();
        diagnosticLine=(diagnosticLine+data.toString('utf8')).slice(-3000);
        const match=diagnosticLine.match(/(?:^|\n)Harness2 bridge failed: ([A-Za-z]+) at ([A-Za-z0-9_.:,]+)(?:\r?\n|$)/);
        // Exception class and source basenames/line numbers only; never raw errors.
        if(match)journal.workerFailure={type:match[1],locations:match[2]};
      });
      const exited=new Promise((resolveExit,reject)=>{child.once('error',()=>reject(Error('Cannot start the configured bridge')));child.once('close',code=>resolveExit(code));});
      child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{
        buffer+=chunk;if(Buffer.byteLength(buffer)>2000000){protocolError=Error('Worker protocol limit exceeded');controller.abort();return;}
        while(buffer.includes('\n')){
          const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!line)continue;
          if(++pending>64){protocolError=Error('Worker callback backlog exceeded');controller.abort();return;}
          queue=queue.then(()=>handle(JSON.parse(line))).catch(()=>{protocolError=Error('Worker callback failed');controller.abort();}).finally(()=>{pending--;});
        }
      });
      const workerJob={id:job.id,domain:job.domain,task:job.task,baseline:job.baseline,editable:job.editable,train:job.train,mode:job.mode,k:job.k,budget:job.budget,lessons};
      child.stdin.write(JSON.stringify({revision:REVISION,runHash,workspace:worker.workspace,job:workerJob})+'\n');
      const exitCode=await abortable(exited,controller.signal);journal.bridgeExitCode=exitCode;await queue;
      controller.signal.removeEventListener('abort',kill);controller.signal.throwIfAborted();
      if(exitCode!==0||protocolError||buffer.trim()||!done)throw Error('Worker did not complete reliably');
      const selected=byRun.get(done.selectedRunId);
      if(!selected||hash(done.candidate)!==hash(selected.candidate)||baselineRuns.length<1)throw Error('Selected result lacks exact trial evidence');
      const train={baseline:plainResult(baselineRuns[0]),candidate:plainResult(selected.value)},holdout=[];
      for(const fixture of job.holdout){
        const baseline=await execute(`holdout:${fixture.id}:baseline`,job.baseline,fixture,'holdout','baseline');
        const candidate=await execute(`holdout:${fixture.id}:candidate`,done.candidate,fixture,'holdout','candidate');
        holdout.push({caseId:fixture.id,baseline:plainResult(baseline),candidate:plainResult(candidate)});
      }
      const gate=this.options.adapter.compare(copy({train,holdout}));
      if(typeof gate?.eligible!=='boolean'||typeof gate.reason!=='string'||!/^[a-z0-9-]{1,100}$/.test(gate.reason))throw Error('Adapter returned an invalid gate');
      if(gate.eligible&&[train,...holdout].some(p=>p.baseline.outcome!=='success'||p.candidate?.outcome!=='success'))throw Error('Unknown or failed trials cannot pass an experiment gate');
      if(done.experience!==null&&done.experience!==undefined){
        if(!['cue','lesson','evidence','confidence'].every(k=>typeof done.experience[k]==='string'&&done.experience[k].length<=1600))throw Error('Invalid bounded reflection');
      }
      const result={jobId:job.id,runHash,upstreamRevision:REVISION,modelCalls:journal.modelCalls,trials:journal.trials,train,holdout,
        gate:{eligible:gate.eligible,reason:gate.reason,adopted:false},artifactHash:hash(done.candidate),
        evidenceRefs:journal.calls.filter(c=>c.kind==='trial'&&c.phase==='returned').map(c=>c.id),lessonAvailable:!!done.experience,adopted:false};
      privateWrite(join(directory,'candidate.json'),{runHash,artifacts:done.candidate,experience:done.experience??null});
      journal.result=result;journal.phase='remember';save();
      if(this.options.memory?.remember){
        // The host owns the canonical memory. No plugin-global personal notebook.
        await abortable(this.options.memory.remember({sessionId:job.sessionId,result:copy(result),experience:copy(done.experience??null)},controller.signal),controller.signal);
        journal.memory='stored';
      }
      journal.status='completed';journal.phase='settled';journal.endedAt=Date.now();save();return copy(result);
    }catch{
      if(owned){journal.status=journal.status==='blocked'?'blocked':controller.signal.aborted?'cancelled':'failed';journal.phase='settled';journal.reason??=controller.signal.aborted?'cancelled-or-budget-exhausted':'experiment-failed';journal.endedAt=Date.now();save();}
      throw Error(owned?'Experiment stopped; inspect metadata and preserve the original evidence':'Experiment identity or prior evidence requires reconciliation');
    }finally{
      clearTimeout(timer);clearInterval(heartbeat);controller.abort();signal.removeEventListener('abort',abort);child?.stdin.destroy();child?.kill();
      // Drain queued callbacks before releasing this runner. They observe cancellation.
      await queue.catch(()=>{});closeSync(lock);unlinkSync(lockFile);this.running=false;this.stop=undefined;
    }
  }
}

/** Explicit configured jobs only. No workspace scanning and no model calls. */
export function createMonitor({runner,jobs,enabled=false,now=Date.now}){
  let cached,at=-Infinity;
  return {snapshot(sessionId){
    if(now()-at>=2000||!cached){
      at=now();cached=jobs.map(job=>{
        const base={id:job.id,adapter:job.adapter,sessionHash:hash(job.sessionId),mode:job.mode,k:job.k};
        const file=join(runner.directory(job),'journal.json');
        if(!existsSync(file))return {...base,status:'not-started',phase:'preparing',updatedAt:null,result:null};
        try{
          const j=read(file);
          if(j.schema!==SCHEMA||j.configurationHash!==runner.fingerprint(job)||j.sessionHash!==base.sessionHash)throw Error('Different configuration');
          if(!['running','completed','blocked','failed','cancelled'].includes(j.status)||!['preparing','propose','probe','compose','select','reflect','holdout','remember','settled'].includes(j.phase)
            ||!['pending','stored','disabled'].includes(j.memory)||!Number.isSafeInteger(j.modelCalls)||j.modelCalls<0||j.modelCalls>40
            ||!Number.isSafeInteger(j.trials)||j.trials<0||j.trials>64||!Number.isFinite(j.startedAt)||!Number.isFinite(j.updatedAt)
            ||!(j.endedAt===null||Number.isFinite(j.endedAt))||hash(j.budget)!==hash(job.budget)||!Array.isArray(j.calls)||j.calls.length>104)throw Error('Invalid metadata');
          for(const c of j.calls){
            if(!/^[a-f0-9]{64}$/.test(c.id)||!['model','trial'].includes(c.kind)||!['pending','returned'].includes(c.phase)||!Number.isFinite(c.startedAt)
              ||!(c.endedAt===null||Number.isFinite(c.endedAt))||(c.caseId!==undefined&&typeof c.caseId!=='string')
              ||(c.group!==undefined&&!['train','holdout'].includes(c.group))||(c.role!==undefined&&!['baseline','candidate'].includes(c.role)))throw Error('Invalid call metadata');
          }
          const stale=j.status==='running'&&now()-j.updatedAt>20000;
          // Whitelist projection: never spread an on-disk record into an API response.
          return {...base,status:stale?'unknown':j.status,phase:j.phase,stale,startedAt:j.startedAt,updatedAt:j.updatedAt,endedAt:j.endedAt,
            budget:copy(j.budget),modelCalls:j.modelCalls,trials:j.trials,memory:j.memory,usage:countUsage(j.calls),
            timeline:j.calls.map(c=>({id:c.id,kind:c.kind,phase:c.phase,startedAt:c.startedAt,endedAt:c.endedAt,caseId:c.caseId??null,group:c.group??null,role:c.role??null,metrics:c.metrics?metrics(c.metrics):null})),
            result:j.result?projectResult(j.result):null};
        }catch{return {...base,status:'unknown',phase:'settled',updatedAt:null,result:null};}
      });
    }
    return {schema:SCHEMA,sampledAt:at,enabled,scope:'isolated-experiments-only',jobs:copy(cached.filter(j=>j.sessionHash===hash(sessionId)).map(({sessionHash,...job})=>job))};
  }};
}

export function projectResult(result){
  const pair=p=>({baseline:plainResult(p.baseline),candidate:p.candidate?plainResult(p.candidate):null});
  if(typeof result.gate?.eligible!=='boolean')throw Error('Invalid experiment result');
  return {jobId:identifier(result.jobId),runHash:text(result.runHash,64),upstreamRevision:REVISION,modelCalls:result.modelCalls,trials:result.trials,
    train:pair(result.train),holdout:result.holdout.map(h=>({caseId:identifier(h.caseId),...pair(h)})),gate:{eligible:result.gate.eligible,adopted:false},
    artifactHash:text(result.artifactHash,64),evidenceRefs:result.evidenceRefs.map(r=>text(r,256)),lessonAvailable:result.lessonAvailable===true,adopted:false};
}
