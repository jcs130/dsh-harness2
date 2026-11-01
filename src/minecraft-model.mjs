/** Core model port backed by DSH's EXISTING registered LLM service. No provider client or body. */
import {createDshModel} from './model.mjs';
import {canonical,text} from './contracts.mjs';
export const MINECRAFT_PARAMS='skills/minecraft-method/scripts/params.json';

export function createMinecraftPracticeModel(llm,{sessionId,...route}){
  text(sessionId,256);
  const model=createDshModel(llm,route);
  return {id:canonical({contract:'minecraft-crafting-params/v1',route:model.id,sessionId}),
    async generate(request,signal){
      const reply=await model.generate({...request,sessionId,editable:[MINECRAFT_PARAMS]},signal);
      if(reply.files!==undefined){
        if(!reply.files||Object.getPrototypeOf(reply.files)!==Object.prototype||Object.keys(reply.files).some(k=>k!==MINECRAFT_PARAMS))
          throw Error('This connected crafting experiment edits params.json only');
        if(reply.files[MINECRAFT_PARAMS]!==undefined){
          const params=JSON.parse(reply.files[MINECRAFT_PARAMS]);
          if(!params||Object.getPrototypeOf(params)!==Object.prototype||Object.keys(params).sort().join(',')!=='logs,wood'
            ||!['oak','birch','spruce','observed'].includes(params.wood)||!Number.isInteger(params.logs)||params.logs<1||params.logs>4)
            throw Error('Invalid declared Minecraft parameters');
        }
      }
      return reply;
    }};
}

/** Supply this practice object to a new isolated profile's MinecraftAgentClient. Importing never starts it. */
export function createMinecraftPracticeHost({llm,sessionId,route,worker,practice,capability,budget}){
  if(practice?.executor?.binding?.isolated!==true||!Array.isArray(practice.fixtures)||practice.fixtures.length<2)
    throw Error('An existing core executor and fixed training/holdout fixtures are required');
  if(!worker?.command||!worker.workspace||typeof practice.executor.execute!=='function')throw Error('Explicit worker and core execution port required');
  text(capability,6000);
  if(!budget||!['modelCalls','trials','wallMs','trialMs','contextBytes'].every(k=>Number.isInteger(budget[k])&&budget[k]>0))
    throw Error('Explicit experiment budget required');
  const model=createMinecraftPracticeModel(llm,{...route,sessionId});
  return {practice:{worker,practice:practice.executor,fixtures:practice.fixtures,capability,budget,model},
    provenance:{kind:'registered-host-llm',provider:route.provider,model:route.model,sessionId}};
}
