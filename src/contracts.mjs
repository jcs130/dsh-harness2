import {createHash} from 'node:crypto';

export const REVISION='1cfe254e8d25b15f37048c3730134686abe60335';
export const SCHEMA='dsh.harness2/v1';
export const FILES={params:'skills/experiment/scripts/params.json',skill:'skills/experiment/SKILL.md'};
export const FRONT='---\nname: experiment\ndescription: Bounded isolated task experiment\n---\n';
export const copy=value=>structuredClone(value);
export function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw Error('Expected finite JSON data');
}
export const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function identifier(value){if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value))throw Error('Invalid experiment identifier');return value;}
export function text(value,max=6000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid bounded text');return value;}
export function validFiles(files,editable){
  if(!files||Object.getPrototypeOf(files)!==Object.prototype||!Array.isArray(editable)||!editable.length||editable.length>16)throw Error('Declare bounded editable files');
  if(new Set(editable).size!==editable.length)throw Error('Duplicate editable paths');
  for(const path of Object.keys(files)){
    if(!/^(systemprompt\.md|tool_descriptions\/tool_guidance\.md|skills\/[a-z0-9_-]+\/(SKILL\.md|scripts\/[a-zA-Z0-9_.-]+))$/.test(path)||path.includes('..'))throw Error('Path outside task artifact surface');
    if(typeof files[path]!=='string'||files[path].length>16000)throw Error('Artifact exceeds file budget');
  }
  if(editable.some(p=>!Object.hasOwn(files,p))||Buffer.byteLength(canonical(files))>64000)throw Error('Invalid artifact surface');
}
export function validateJob(job){
  identifier(job.id);identifier(job.adapter);text(job.sessionId,256);text(job.task);text(job.domain,120);
  validFiles(job.baseline,job.editable);
  if(!['parallel','sequential'].includes(job.mode)||!Number.isInteger(job.k)||job.k<1||job.k>4)throw Error('Invalid recursion mode or depth');
  if(!Array.isArray(job.holdout)||job.holdout.length<1||job.holdout.length>8)throw Error('Require independent holdout cases');
  const cases=[job.train,...job.holdout];cases.forEach(c=>{identifier(c.id);text(c.environmentId,256);canonical(c);});
  if(new Set(cases.map(c=>c.id)).size!==cases.length||cases.some(c=>c.environmentId!==job.train.environmentId))throw Error('Cases must be distinct in the same environment version');
  if(new Set(cases.map(({id,...fixture})=>hash(fixture))).size!==cases.length)throw Error('Holdout cases cannot duplicate the training data');
  const b=job.budget;
  if(!b||!['modelCalls','trials','wallMs','trialMs','contextBytes'].every(k=>Number.isInteger(b[k]))||b.modelCalls<1||b.modelCalls>40||b.trials<4*job.k+2*job.holdout.length||b.trials>64||b.wallMs<1000||b.wallMs>3600000||b.trialMs<100||b.trialMs>120000||b.contextBytes<10000||b.contextBytes>1000000)throw Error('Invalid explicit experiment budget');
  if(job.lessons!==undefined&&(!Array.isArray(job.lessons)||job.lessons.length>8||job.lessons.some(l=>!l||typeof l.lesson!=='string'||l.lesson.length>1600||!Array.isArray(l.evidenceRefs)||!l.evidenceRefs.length||l.evidenceRefs.some(r=>typeof r!=='string'||r.length>256))))throw Error('Lessons need bounded evidence references');
  if(Buffer.byteLength(canonical(job))>100000)throw Error('Job exceeds input budget');
  return job;
}
export function metrics(value){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length>16)throw Error('Invalid metrics');
  return Object.fromEntries(Object.entries(value).map(([k,v])=>{
    identifier(k);if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Metrics must be finite numbers or null');return [k,v];
  }));
}
export function usage(value){
  return Object.fromEntries(['inputTokens','outputTokens','cachedTokens'].map(k=>[k,Number.isSafeInteger(value?.[k])&&value[k]>=0?value[k]:null]));
}
export function abortable(work,signal){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(Error('Experiment cancelled'));};
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(work).then(v=>{signal.removeEventListener('abort',abort);resolve(v);},e=>{signal.removeEventListener('abort',abort);reject(e);});
    if(signal.aborted)abort();
  });
}
