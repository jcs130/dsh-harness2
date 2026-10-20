import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
await mkdir('lib',{recursive:true});
await build({entryPoints:['src/client.tsx'],bundle:true,format:'cjs',platform:'browser',target:'es2020',jsx:'automatic',outfile:'lib/client.js',
  external:['react','react/jsx-runtime'],define:{'process.env.NODE_ENV':JSON.stringify('production')},
  banner:{js:'window.__ModuleLoader__.load({id:"@jcs130/dsh-harness2",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},
  footer:{js:'return module.exports;}});'}});
const digest=value=>createHash('sha256').update(value).digest('hex');
const sources={};
for(const file of ['src/client.tsx','scripts/build.mjs'])sources[file]=digest((await readFile(file,'utf8')).replace(/\r\n/g,'\n'));
await writeFile('lib/client.build.json',JSON.stringify({schema:1,sources,sha256:digest(await readFile('lib/client.js'))},null,2)+'\n');
console.log('Built native Harness² experiment view. No model or worker started.');
