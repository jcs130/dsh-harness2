# Harness² 实验室 · DSH 插件

把 Google Research 的 [Harness²](https://github.com/google-research/harness2) 接到 DeepSeek Harness。模型权重不变，比较的是任务周围的配置、提示、技能或受限参数。插件与 Minecraft 解耦，Minecraft 继续使用 `agent-mc-world` 的独立练习、证据与游戏记忆。

本版本提供实际 Harness² 的候选生成、试跑、组合、筛选、反思，DSH 原生“实验室”会话子页，原版与留出场景对比，调用/试跑/时间预算，独立持久会话标识、取消、进程恢复防重放，以及宿主记忆端口。使用 DSH 已注册的模型服务和凭据，不再配置另一份 API Key。

目前内置适配器是**声明式账本演示**，用于验证通用链路；不是任意办公/代码任务的完整执行器。其他任务要注册自己的隔离执行适配器。演示通过不代表线上 Agent 更聪明，也不代表 DeepSeek 实测提升。实验结果不会自动改写在线配置或采用技能。

## 安装与 Desktop

DSH 兼容基线：`0.2.1-rc.2`，Node.js 24+。Desktop 使用同一套 `web` 客户端，注册原生 `conversation.view`，无需 iframe、额外端口或跨域豁免。安装本身不启动实验、模型、游戏或 Python。

开发目录：

```sh
npm ci --ignore-scripts
npm run build
npm test
npm pack
```

用 DSH 的插件管理界面安装生成的 `.tgz`；或在一个独立测试 profile 使用：

```sh
dsh plugin --profile harness2-test add /absolute/path/jcs130-dsh-harness2-0.1.0-rc.1.tgz
```

Desktop 的受保护 profile 由 Desktop 管理；不要用普通 CLI 初始化或绕过它。未完成原生窗口实测前，发布记录只能写“协议/组件测试通过”。

## Python 执行器

Linux / WSL、Python 3.12+。上游固定为 `1cfe254e8d25b15f37048c3730134686abe60335`：

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r bridges/requirements.txt
.venv/bin/python bridges/worker.py --check
```

不会调用上游无限制的 OpenCode/Codex 执行器。Python 只运行优化流程，模型和任务执行通过有界回调交给宿主。Linux 路径与 Node 数据目录分别配置；WSL 推荐把优化器临时工作区放到 Linux 文件系统。

私有 `worker.json` 示例（路径需要换成实际路径）：

```json
{
  "command": "python3",
  "args": [],
  "script": "/absolute/path/dsh-harness2/bridges/worker.py",
  "workspace": "/absolute/private/harness2-workspace"
}
```

Windows 可用 `command: "C:/Windows/System32/wsl.exe"`，`args` 为 `-d`、发行版、`--exec`、Linux Python 的绝对路径；`script` 和 `workspace` 填 Linux 路径。这里是进程参数数组，不使用 shell。

## 无付费调用演示

```sh
node scripts/demo.mjs /absolute/private/worker.json unique-ledger-job /absolute/private/evidence
```

这里真实运行 Google 的 Harness²，模型端是明确标记的脚本化夹具。试跑使用固定解释器计算整数账本，候选只能修改声明式参数和技能说明，不执行生成的程序。原始示例漏掉负数项，候选包含正负数，并在另一份账本上复测。用量未知显示 `null`。

## 接上 DSH 模型

```sh
node examples/create-ledger-config.mjs <真实DSH会话ID> /absolute/private/lab.json /absolute/private/worker.json
```

生成的配置默认 `enabled:false`。检查其中任务、预算、模型路由和路径，明确启用后，把插件的 `configFile` 指向此文件。模型路由示例沿用 DSH 内置 DeepSeek；实际模型 ID 以本机已注册路由为准，不额外读取或复制凭据。

Agent 的工具：

- `harness2_status {}`：只读本会话实验，不触发推理。
- `harness2_run {"jobId":"ledger-demo"}`：只执行本会话已经配置的任务。

一个宿主实验室同时只运行一个实验，任务内部的执行回调串行处理。打开多个页面共用约 2 秒的读取缓存，不重复试跑或生成。关闭/取消操作会关闭上游流和子进程；任务的执行端还必须支持取消与明确的清理回执。

## 扩展与记忆

见 [适配器契约](docs/adapters.md)。领域插件注册 `ctx.harness2.registerAdapter(adapter)`；已有独立优化器可以注册只读 `registerSource`，保留自己的事实来源。候选文件不是宿主权限，不能改变模型凭据、DSH 启动配置、插件列表或在线身体。

宿主可提供 `memory.recall/remember`，由宿主维护规范记忆。反思带有对应试跑证据与适用限制，下一任务只召回这类有界经验。没有记忆端口时，结果仍保存在任务证据目录，但页面明确标记“未配置宿主记忆”，不宣称已经实现跨任务能力提升。

## 证据与恢复

`dataDir/<session-hash>/<job-id>/journal.json` 只保存时间、计数、身份哈希、数值指标、用量与证据引用。`context.json` 保存独立模型会话与显式召回的有界实验经验；`candidate.json` 保存用户要求生成的候选文件与反思产物。这两类私有实验产物不通过页面/工具的统计 API 暴露。上游临时工作区只包含显式任务与实验产物，不含宿主对话、角色、人身记忆或凭据。

完整输入/输出/缓存任一统计缺失时保留未知；不使用流耗时替代引擎执行时间。SDK 的输入量需要同时知道普通输入和缓存读/写才能统计完整输入。

同配置的完整任务可只读返回既有结果。中断、失败或无法确认的原任务不重放；改变配置必须用新 jobId，原证据不覆盖。保留中的 `run.lock` 需要核实原进程与副作用后人工处理，插件不会自动删锁或重置历史。停用新实验不会隐藏已经配置的历史记录。

## 发布状态

本地源码、测试、打包、独立安装与市场提交分别记录。以 [验证记录](docs/verification.md) 为准，不能把本地安装成功当作 npm 已发布或市场已上架。

代码 MIT；上游 Harness² 独立安装，遵守其 Apache-2.0 许可，见 [NOTICE](NOTICE)。
