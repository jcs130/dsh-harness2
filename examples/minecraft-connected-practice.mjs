/** Run explicitly from a DSH host/plugin that already owns ctx.llm and this isolated session. */
import {createMinecraftPracticeModel} from '@jcs130/dsh-harness2/models/minecraft';
import {runConnectedCraftingExperiment} from 'agent-mc-world/experiments/connected-crafting';

export async function runMinecraftCraftingPractice({ctx,sessionId,route,java,serverJar,python,directory,acceptEula,signal}){
  const model=createMinecraftPracticeModel(ctx.llm,{...route,sessionId});
  // No default provider, production configuration, automatic run, or adoption.
  return runConnectedCraftingExperiment({model,java,serverJar,python,directory,acceptEula,signal,
    provenance:{kind:'registered-host-llm',provider:route.provider,model:route.model,sessionId}});
}
