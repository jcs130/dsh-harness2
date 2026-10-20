import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(readFileSync(new URL('../lib/client.build.json',import.meta.url),'utf8'));
if(manifest.schema!==1||digest(readFileSync(new URL('../lib/client.js',import.meta.url)))!==manifest.sha256)throw Error('Client build missing or changed; run npm run build');
// Git source installs include sources; packed consumers do not need build tools.
for(const file of ['src/client.tsx','scripts/build.mjs']){
  let source;try{source=readFileSync(new URL('../'+file,import.meta.url),'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(digest(source.replace(/\r\n/g,'\n'))!==manifest.sources[file])throw Error('Client source differs; run npm run build');
}
