import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {ledgerJob} from '../src/ledger.mjs';
const [sessionId,output,workerFile]=process.argv.slice(2);
if(!sessionId||!output||!workerFile)throw Error('Usage: node examples/create-ledger-config.mjs <DSH-session-id> <new-private-config.json> <private-worker.json>');
const file=resolve(output),worker=JSON.parse(readFileSync(resolve(workerFile),'utf8'));
writeFileSync(file,JSON.stringify({enabled:false,dataDir:join(dirname(file),'harness2-data'),
  model:{provider:'deepseek',model:'deepseek-flash',reasoningEffort:'off',maxTokens:4096},worker,jobs:[ledgerJob('ledger-demo',sessionId)]},null,2)+'\n',{flag:'wx',mode:0o600});
console.log('Created disabled experiment configuration. Review route, session, worker and budgets before explicitly enabling it.');
