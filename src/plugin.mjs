import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {clientRequestSchema} from '@deepseek-ai/dsh-client-connection';
import z from '@deepseek-ai/schemastery';
import {createDshModel} from './model.mjs';
import {createLab,experimentTools} from './lab.mjs';

export const name='harness2-lab';
export const inject=['llm','tools'];
export const Config=z.object({configFile:z.string().default('')});

export function apply(ctx,options={}){
  const config=options.configFile?JSON.parse(readFileSync(resolve(options.configFile),'utf8')):{enabled:false,jobs:[]};
  if(typeof config.enabled!=='boolean'||(config.jobs?.length&&!config.dataDir))throw Error('Explicit enabled state and private dataDir required');
  const directory=config.dataDir?resolve(config.dataDir):join(process.cwd(),'.runtime','harness2');
  if(config.jobs?.length)mkdirSync(directory,{recursive:true,mode:0o700});
  // No route is opened, worker started or default cloud model chosen by installation.
  const model=config.model?createDshModel(ctx.llm,config.model):{id:'unconfigured',generate:async()=>{throw Error('Configure a DSH model route before running');}};
  if(config.enabled===true&&(!config.model||!config.worker))throw Error('Enabled experiments require an explicit model and worker');
  const lab=createLab({config,model,directory});ctx.provide('harness2',lab);
  for(const tool of experimentTools(lab))ctx.tools.register(tool);
  ctx.inject(['connection'],scoped=>{
    scoped.connection.fetch.register({path:'/api/harness2/experiments',methods:['POST'],requestBody:'buffered',fetch:request=>snapshotResponse(request,lab)});
  });
  ctx.effect(()=>()=>lab.close(),'harness2 experiment lifetime');
}

/** Route is registered under DSH's authenticated Fetch carrier, including Desktop. */
export async function snapshotResponse(request,lab){
  let body;try{body=await request.json();}catch{return new Response('Invalid request',{status:400});}
  const parsed=clientRequestSchema.safeParse(body);
  const payload=parsed.success?parsed.data.payload:null;
  if(!parsed.success||parsed.data.method!=='harness2/experiments'||!payload||Object.keys(payload).join(',')!=='sessionId'||typeof payload.sessionId!=='string'||!payload.sessionId||payload.sessionId.length>256)return new Response('Invalid experiment envelope',{status:400});
  return Response.json({type:'server-response',rpcId:parsed.data.rpcId,result:{ok:true,value:{sessionId:payload.sessionId,snapshot:await lab.snapshot(payload.sessionId)}}},
    {headers:{'cache-control':'no-store'}});
}
