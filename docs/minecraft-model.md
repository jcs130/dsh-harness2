# 用已有 DSH 模型路由驱动 mc_practice

此候选复用 `createDshModel(ctx.llm, route)`，向核心的 `{id,generate(request,signal)}` 提供模型制品。核心继续拥有Google worker、游戏执行器、方法库、训练/留出与验收。没有新供应商客户端、凭据副本、Minecraft依赖、默认实验或在线采用。原PR #1的只读source不变。

候选包为 `0.1.0-rc.2-modelpractice.1`，未发布；需要本次核心 `0.5.7-rc.152-practice.1`。旧公共Skill1.3.7/核心rc.130不能直接使用此入口。两包先在独立profile安装，不更新在线四个Agent。

## 已有专用练习客户端

```js
import {MinecraftAgentClient} from 'agent-mc-world/client';
import {createClientMethodPractice} from 'agent-mc-world/learning';
import {createMinecraftPracticeHost} from '@jcs130/dsh-harness2/models/minecraft';
import {createMinecraftExperimentSource} from '@jcs130/dsh-harness2/sources/minecraft';

// 连接与重置端由已有核心/可信宿主提供。复用固定合成方法及严格params校验。
const connected = createClientMethodPractice({
  directory: privateTrialDirectory, client: dedicatedPracticeClient,
  control: dedicatedResetAndSettle, fixtures: fixedTrainAndHoldouts,
  agent: ownedPracticeAgentId, validate: immutableCraftingMethodValidator,
});
const host = createMinecraftPracticeHost({
  llm: ctx.llm, sessionId: ownedPracticeSessionId, route: selectedRegisteredRoute,
  worker: explicitlyPinnedWorker, practice: connected,
  capability: actualDedicatedCraftingCapabilities,
  budget: {modelCalls:6,trials:8,wallMs:600000,trialMs:30000,contextBytes:600000},
});
const source = new MinecraftAgentClient({...newIsolatedSourceProfile, practice: host.practice});
// 按已有生命周期连接source。Agent通过公开mc_practice help/start/status/result操作。
const off = ctx.harness2.registerSource(createMinecraftExperimentSource({
  sessionId: ownedPracticeSessionId, monitor: {snapshot: () => source.experiments()},
}));
ctx.effect(() => off);
```

`route={provider,model,reasoningEffort?,maxTokens}`来自宿主已选注册路由。只传游戏任务/证据，不传私人会话或人设。sessionId固定为归调用者所有的实验会话，不接受模型更换。传入相同route的思考设置和输出预算；取消信号沿原流返回，不隐式重试。

此首个实验仅允许 `skills/minecraft-method/scripts/params.json` 的 wood/logs；模型提案、组合、选择及反思都走已有模型流。正确参数不在真实模式回调中预填；代码/说明/场景/评价不可修改。核心执行入口仍独立校验，提示文字不是权限边界。

## 一次性双服务端实验

```js
import {runMinecraftCraftingPractice} from '@jcs130/dsh-harness2/experiments/minecraft';
const report = await runMinecraftCraftingPractice({
  ctx, sessionId: ownedPracticeSessionId, route: selectedRegisteredRoute,
  java: '/explicit/java21/bin/java', serverJar: '/explicit/official-server-1.21.1.jar',
  python: '/explicit/harness2-venv/bin/python', directory: '/explicit/NEW-private-evidence',
  acceptEula: true, // 仅当调用者已接受Minecraft EULA
  signal: explicitCancellationSignal,
});
```

导入不会运行；显式调用后由核心原双服务端程序完成MCP发现/启动/原版对照/独立留出/源方法未变/恢复不重投。真实模式不要求候选必须改善，失败也是结果。训练失败trial ID必须进入模型输入后才可提案。原版为实验新建的有限方法，不是四个在线Agent的能力基线。详见核心 `docs/real-model-practice.md`。

`report.json`与`model-calls.jsonl`记录模型原请求ID/哈希/已知token和实际动作；不存模型提示、回答或思考正文。DSH输入token排除缓存读写，只有各项已知时才汇总。缺失token/金额保留null，失败调用不当免费。source仍只投影白名单元数据，报告中的模型用量和动作次数分别审查。

## 验证

默认 `npm test` 验证已有DSH注册服务的流协议、固定路由/会话、失败反馈转交、未知费用、截断/非法制品拒绝与取消；调用的是测试替身，不能称真实LLM实验。

固定Google流程及核心跨包测试显式配置：

```sh
H2_WORKER_CONFIG=/absolute/dsh-worker.json \
H2_CORE_WORKER_CONFIG=/absolute/core-worker.json \
MC_PRACTICE_CORE_PACKAGE=/absolute/installed/agent-mc-world \
npm test
```

两个worker配置分别指向本插件/核心自身的固定Python bridge，包含command/script/workspace；core可以省略script使用包内默认。Python须实际安装固定revision。跨包测试使用真实Google流程和核心沙箱/方法库，模型流和库存仍是明确测试替身；共8次练习、4次模型端口回调不是供应商模型调用。恢复读取不产生新动作/模型请求。

本次没有可用模型凭据和真实服务端环境。实际LLM自主提出参数、真实合成成功率/动作/失败、供应商token和费用仍需运行实测；没有把测试结果写成真实模型改进。

本次28项测试全部通过（含固定Google原流程与核心跨包验证），build/pack通过；两个候选包全新安装后，公开导入、核心NodeNext类型、packed构建校验及8次夹具执行/4次测试模型回调/两组留出/恢复不重投通过。核心全量2755通过、8项资源相关跳过。真实模型API调用为0。
