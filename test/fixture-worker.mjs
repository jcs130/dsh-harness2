/** Protocol test fixture only. Production uses bridges/worker.py and real Google code. */
import {createInterface} from 'node:readline';
import {REVISION,FILES} from '../src/contracts.mjs';
const lines=createInterface({input:process.stdin}),waiters=[],queued=[];
lines.on('line',line=>{const value=JSON.parse(line);const pending=waiters.shift();pending?pending(value):queued.push(value);});
const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise(r=>waiters.push(r));
const initial=await next(),job=initial.job;let id=0;
if(process.env.H2_TEST_SECRET)throw Error('Host credentials leaked into worker');
const rpc=async(op,args)=>{const serial=++id;process.stdout.write(JSON.stringify({type:'rpc',id:serial,op,...args})+'\n');const reply=await next();if(reply.id!==serial||reply.error)throw Error('Rejected');return reply.value;};
const generate=label=>rpc('model',{label,mission:'PRIVATE-MISSION-NOT-TELEMETRY',files:{'source/task.json':JSON.stringify(job.train),'private-fixture.md':'PRIVATE-CONTEXT'}});
const base=job.baseline;await rpc('trial',{runId:'dsh/test/base',candidate:base});
let candidate=structuredClone(base);
for(const label of ['inv1.a1','dom1.a1','compose1.a1']){
  const proposal=await generate(label);candidate={...candidate,...proposal.files};
  await rpc('trial',{runId:`dsh/test/${label}`,candidate});
}
await generate('select.agg');
const reflection=await generate('experience.agg');
process.stdout.write(JSON.stringify({type:'done',result:{upstreamRevision:REVISION,selectedRunId:'dsh/test/compose1.a1',candidate,experience:reflection.experience??null}})+'\n');
lines.close();process.stdin.destroy();
