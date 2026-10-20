import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {ExperimentRunner,createMonitor} from '../src/runtime.mjs';
import {createLedgerAdapter,ledgerJob,deterministicLedgerModel} from '../src/ledger.mjs';

const args=process.argv.slice(2),file=args[0];
if(!file||args.includes('--help')){
  console.log('node scripts/demo.mjs <private-worker.json> [new-job-id] [output-directory]\nUses the real pinned Google workflow with a deterministic model fixture. No provider or game calls.');
}else{
  const worker=JSON.parse(readFileSync(resolve(file),'utf8'));
  const job=ledgerJob(args[1]??'ledger-demo');
  const runner=new ExperimentRunner({directory:resolve(args[2]??'.runtime/demo'),worker,adapter:createLedgerAdapter(),model:deterministicLedgerModel()});
  const result=await runner.run(job);
  console.log(JSON.stringify({result,snapshot:createMonitor({runner,jobs:[job]}).snapshot('demo')},null,2));
}
