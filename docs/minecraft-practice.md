# Minecraft 最小实验接入

Minecraft 任务继续由 `agent-mc-world` 拥有。本插件提供 `createMinecraftExperimentSource`（`@jcs130/dsh-harness2/sources/minecraft`），将**已配置的**核心 monitor 投影注册到 Lab；没有额外的游戏连接、优化执行、方法库或游戏记忆副本。安装或查看页面不启动实验。

本轮核心新增采木→木板→木棍→木镐的确定性库存/配方 fixture，复用 `PracticeExecutionPort`、`MethodPracticeExecutor`、`MethodLibrary`、`Harness2Runner`、`assessPracticeTrial` 和原始执行证据。源码及完整复现/真实验收方法见 [核心实验文档](https://github.com/jcs130/minecraft-ai-friend/blob/codex/harness2-crafting-practice/packages/agent-mc-world/docs/crafting-practice.md)。这是待审查源码，未发布新版核心或修改在线 Agent。

```js
import {createHarness2Monitor} from 'agent-mc-world/decisions';
import {createMinecraftExperimentSource} from '@jcs130/dsh-harness2/sources/minecraft';

// Explicit allowlist: use the existing core's directory and configured jobs.
const monitor = createHarness2Monitor({directory:coreEvidenceDirectory,jobs:coreJobs,enabled:false});
const dispose = ctx.harness2.registerSource(createMinecraftExperimentSource({
  sessionId:ownedDshSessionId, monitor,
}));
ctx.effect(() => dispose);
```

source 在读取 monitor 前核对 DSH 会话，要求 `agent-mc.experiments/v1` / `isolated-practice-only`，只投影任务 ID、状态、阶段、更新时间、资格和证据条数。缺失或过期的运行状态显示未知；非完成任务不展示资格。方法源码、提示、完整记录和凭据不进入 source。页面沿用2秒缓存。不自动设置新任务、不替换 `mc_practice` 入口、不调用 stage/adopt。

核心执行回执使用 `procedureHash(PracticeCandidate)`，通用 Lab 执行回执使用 `artifactHash(candidateFiles)`，其形态不同。本路径使用 `registerSource`，避免误把核心回执塞进通用 `registerAdapter` 或再跑一次优化。

离线实验采用新建的有限参考基线和脚本化候选，仅验证库存转移、配方、训练/留出和原回执链路。候选仅改变 wood/logs 参数，固定源码、配方、安全规则、预算及验收不可改。原 Google Harness² 流程可真实运行，但模型不是 LLM、环境不是 Minecraft 服务端。不能据此声称 Agent 生存能力提高。

后续真实实验应在专用练习服实现现有 `MethodPracticeExecutor` 的重置/观察/清理端口，保留原 UUID、独立背包净增和生命损失观测，再注入 DSH 已注册的模型端口。Lab 仍然只读取核心事实来源；完整任务结果和成本在核心记录中审查。真实模型还需独立模型使用量与账单回执；未知 token/金额保留 null。离线 fixture 通过不授权在线采用。

2026-10-31 源码验证：插件23项测试全部通过（含2项新增 source 测试和真实 Google 上游两种递归模式测试），build/pack通过。隔离安装包通过公开 source 导入及真实核心 monitor 投影检查，读取前后原 journal 未变。核心全量2688通过、8项资源相关跳过；实际合成实验8次执行、4次脚本化模型回调，原版与两份留出均保留负例。未发布新 npm 版本、未修改社区市场 PR #19，也未修改线上 Agent。
