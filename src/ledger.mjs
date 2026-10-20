/** A deterministic declarative task adapter. It executes no generated source. */
import {FILES,FRONT,hash} from './contracts.mjs';

export function ledgerJob(id='ledger-demo',sessionId='demo'){
  return {id,sessionId,adapter:'ledger',domain:'signed-ledgers',task:'Sum every signed amount in the supplied ledger. Preserve both credits and debits.',
    baseline:{[FILES.params]:JSON.stringify({include:'positive-only'}),[FILES.skill]:FRONT+'Sum ledger amounts using the declared include option.'},
    editable:Object.values(FILES),train:{id:'ledger-1',environmentId:'signed-integer-ledger/v1',amounts:[10025,-2010,500]},
    holdout:[{id:'ledger-2',environmentId:'signed-integer-ledger/v1',amounts:[3550,-1025,-500]}],
    mode:'parallel',k:1,budget:{modelCalls:12,trials:12,wallMs:60000,trialMs:1000,contextBytes:200000}};
}
function params(candidate){
  if(Object.keys(candidate).length!==2||!candidate[FILES.skill]?.startsWith(FRONT))throw Error('Preserve the adapter artifact surface');
  const value=JSON.parse(candidate[FILES.params]);
  if(Object.keys(value).join(',')!=='include'||!['signed','positive-only','negative-only','absolute'].includes(value.include))throw Error('Unknown declarative ledger option');
  return value;
}
export function createLedgerAdapter(){
  return {id:'ledger',version:'1',isolated:true,
    validate:params,
    async execute({trialId,candidate,fixture},signal){
      signal.throwIfAborted();const p=params(candidate), amounts=fixture.amounts;
      if(!Array.isArray(amounts)||amounts.length<1||amounts.length>100||amounts.some(a=>!Number.isSafeInteger(a)||Math.abs(a)>1000000))throw Error('Invalid ledger fixture');
      const selected=amounts.filter(n=>p.include==='positive-only'?n>0:p.include==='negative-only'?n<0:true);
      const sum=selected.reduce((a,n)=>a+(p.include==='absolute'?Math.abs(n):n),0), signed=amounts.reduce((a,n)=>a+n,0);
      return {trialId,candidateHash:hash(candidate),caseId:fixture.id,environmentId:fixture.environmentId,cleanup:'settled',outcome:'success',
        metrics:{absoluteError:Math.abs(sum-signed),rows:amounts.length},observation:{amounts,total:sum,unit:'integer cents'}};
    },
    compare({train,holdout}){
      const pairs=[train,...holdout],known=pairs.every(p=>p.baseline.outcome==='success'&&p.candidate?.outcome==='success');
      const noRegression=known&&pairs.every(p=>p.candidate.metrics.absoluteError<=p.baseline.metrics.absoluteError);
      const improvement=known&&pairs.some(p=>p.candidate.metrics.absoluteError<p.baseline.metrics.absoluteError);
      return {eligible:noRegression&&improvement,reason:!known?'unknown-evidence':!noRegression?'regression':!improvement?'no-observed-improvement':'isolated-cases-improved'};
    }};
}

/** Scripted model fixture, explicitly not a measurement of an LLM. */
export function deterministicLedgerModel(){
  return {id:'deterministic-ledger-fixture/v1',async generate(request,signal){
    signal.throwIfAborted();
    if(request.stage.startsWith('select.')){
      const entries=Object.entries(request.files).filter(([k])=>/^candidates\/[A-Z]+\.md$/.test(k));
      // Actual observed total, derived from the source task. No held-out case is visible.
      const good=entries.find(([,v])=>v.includes('"total": 8515')||v.includes('"total":8515'));
      return {choice:(good??entries[0])?.[0].split('/').at(-1).replace('.md',''),usage:{inputTokens:null,outputTokens:null,cachedTokens:null}};
    }
    if(request.stage.startsWith('experience.'))return {experience:{cue:'A ledger includes positive and negative amounts',lesson:'Keep credits and debits in the sum.',evidence:'The candidate included the negative entry omitted by the original; only isolated ledger fixtures were tested.',confidence:'Two deterministic fixtures; no live task evidence.'}};
    return {files:{[FILES.params]:JSON.stringify({include:'signed'})}};
  }};
}
