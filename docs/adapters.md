# 适配器与宿主接口

框架层负责实际 Harness² 流程、模型端口、任务身份、预算、防重放与只读视图。领域层负责真实执行、观察、目标判断与清理确认。保持模型判断与独立验收的区别：没有正确答案仍可使用源数据一致性、约束和实际回执；这些检查覆盖不到的部分必须保持未知。

## 独立 SDK

```js
import {ExperimentRunner,createMonitor} from '@jcs130/dsh-harness2/runtime';
import {createDshModel} from '@jcs130/dsh-harness2/model';

const runner = new ExperimentRunner({
  directory: privateEvidenceDirectory,
  worker: privateWorkerConfig,
  model: createDshModel(ctx.llm, explicitModelRoute),
  adapter: isolatedTaskAdapter,
  memory: hostExperimentMemoryPort,
});
const result = await runner.run(configuredJob, signal);
const monitor = createMonitor({runner,jobs:[configuredJob],enabled:true});
const metadata = monitor.snapshot(configuredJob.sessionId);
```

`job`：`id/sessionId/adapter/domain/task/baseline/editable/train/holdout/mode/k/budget`。完整示例由公开的 `ledgerJob` 工厂提供。候选是明确文件集合，省略字段继承；禁止路径逃逸，`guardrails.md`、规范记忆、子代理与插件不属于可编辑面。模型不允许添加/移除文件。

## 注册任务适配器

```js
export const inject = ['harness2'];
export function apply(ctx) {
  const dispose = ctx.harness2.registerAdapter({
    id: 'my-task', version: 'my-task-environment/v1', isolated: true,
    validate(candidateFiles) { /* throw if outside the declared data contract */ },
    async execute({trialId,candidate,fixture}, signal) {
      // Isolated execution: persist original effect identities before dispatch.
      // Honor cancellation and independently establish cleanup.
      return {
        trialId, candidateHash, caseId:fixture.id,
        environmentId:fixture.environmentId,
        cleanup:'settled', outcome:'success',
        metrics:{objectiveDistance: observedDistanceOrNull},
        observation: explicitlyAllowedBoundedTaskEvidence,
      };
    },
    compare({train,holdout}) {
      return {eligible: independentlyChecked, reason:'bounded-reason-code'};
    },
    memory: hostExperimentMemoryPort, // Optional, not a copied personal-memory DB.
  });
  ctx.effect(() => dispose);
}
```

SDK 的 `candidateHash` 使用运行层导出的稳定 `artifactHash(candidate)`。`fixture`、候选、回执使用副本；回执必须精确绑定 `trialId/candidateHash/caseId/environmentId`。指标只能是有限数字或 `null`；不能用自然语言“成功”替代世界观测。`cleanup` 未确认或身份失配会阻断整次实验，没有后续试跑或自动重投。适配器是可信的安装代码，`isolated:true` 是它的契约，不是通用进程安全沙箱的证明。

任务端口不可在一次调用里隐藏多个未记账的模型请求。确需模型执行任务时，另行设计明确的执行预算/元数据端口；本版本的内置账本适配器没有这类额外调用。

## 规范记忆端口

```js
const memory = {
  async recall({sessionId,task},signal) {
    return [{lesson:'bounded evidence-supported lesson',evidenceRefs:['original-trial-id']}];
  },
  async remember({sessionId,result,experience},signal) {
    // Idempotent canonical write keyed by result.runHash.
    // Preserve result.gate, holdout limitations and exact evidence references.
  },
};
```

每任务只召回一次并持久化快照。完整任务的重复读取不会重复写记忆。中断后的记忆写入可能存在未知效果，需要宿主按 runHash 去重；插件不会重放不完整任务。

## 复用现有 Minecraft 核心

Minecraft 的 `Harness2Runner/PracticeExecutionPort/MethodLibrary/游戏记忆` 继续由 `agent-mc-world` 提供。DSH Minecraft 薄适配器可把其现有监测投影注册到此页，不复制物理执行或游戏验收：

```js
const off = ctx.harness2.registerSource({
  id: 'minecraft-experiments',
  snapshot(requestedSessionId) {
    if (requestedSessionId !== ownedSessionId) return [];
    return coreMonitor.snapshot().jobs.map(job => ({
      id: job.id,
      status: job.status,
      phase: job.phase,
      updatedAt: job.updatedAt,
      result: job.result && {
        eligible: job.result.eligible,
        evidenceCount: job.result.evidenceCount,
      },
    }));
  },
});
ctx.effect(() => off);
```

只读 source 不会启动模型、创建游戏连接或转移在线身体。它只展示已有配置的任务；Minecraft 实验仍由既有 `mc_practice` 工具和核心预算发起。不能把过期的 source 回执当成当前运行状态。

## 采用边界

`eligible` 只表示通过已配置隔离场景的门槛，`adopted` 永远为 false。宿主应单独审核候选差异、原版/留出证据、适用环境与回滚版本，再通过其既有采用接口处理。实验插件没有“自动覆盖线上配置”路径。
