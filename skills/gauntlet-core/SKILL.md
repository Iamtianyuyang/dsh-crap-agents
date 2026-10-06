---
name: gauntlet-core
description: Gauntlet 流水线的共同规则（Gauntlet 小队每个成员必读）：工具安装、闸门命令、分支协议、结果汇报格式、禁止事项。处理任何 Gauntlet 工作前先读它。
---

# Gauntlet 共同规则（DeepSeek Harness 版）

这条流水线来自 Bob 大叔（Robert C. Martin）的方法：
**人不读 AI 写的代码，人读证据。** 代码的可信度来自层层闸门：验收测试 → 单元测试 →
CRAP（复杂度 × 未测试）→ 变异测试 → 架构边界 → QA。

你是 Gauntlet 小队的一个**阶段子 agent**。Leader（编排者）把需求按阶段派给 7 个子 agent，你只干委派给你的那一个阶段：
按任务提示 + 你的阶段技能做事，跑到闸门通过，再把结果交回 Leader。你看不到 Leader 和用户的对话，也不直接问用户——
需要人决定的事以 NEED-HUMAN 交回 Leader（第 6 节）。
每个阶段"做什么"见对应的阶段技能；"用什么工具、怎么写"见适配器技能。
只读和当前工作有关的文件——上下文越长越容易犯错（"lost in the middle"）。

## 1. 需求从哪里来

需求就是**用户给出的原始需求**，Leader 把它原文贴在委派给你的任务提示里（还有分支、你的阶段和返工说明）。开工前先确认你理解了：
目标、输入输出、边界、是否要求与某个原程序行为一致（重构 / 移植 / 合并类任务）。不确定就以 NEED-HUMAN 收尾说明，别猜。

切到仓库后，先读仓库根目录的项目档案 `GAUNTLET.md`（第 0 阶段摸底写的：怎么构建 / 测试 / 运行、代码地图、约定、坑）。
档案和你看到的事实不符时，以 FAIL 收尾并说明，由 Leader 安排回到第 0 阶段重新摸底，不要凭记忆往下做。

## 2. 代码仓库与分支协议

1. 你在目标仓库里工作，Leader 已经建好并切到了分支 `gauntlet/<短名>`（任务提示里写着）。先 `git status` 确认。
   默认分支以 `GAUNTLET.md` 的 `base:`、或远端默认分支为准；闸门的"改动行"是相对它计算的。
2. 提交信息带上阶段标签，例如：`[code] add roman parser`、`[clean] extract scorer`。
3. **每次测试变绿就提交一次。** 你随时可能被中断（取消、token 上限、dsh 重启），没提交的改动就丢了；
   被重新派来时，先 `git status` / `git log --oneline` 看清已有进度，从那里继续。
4. **不要** `git push`、不要开 PR——Leader 在用户审阅通过后才推送。**不要**在默认分支上提交，**不要** force push。

## 3. 工具（.gauntlet/）与 shell

### 安装 / 更新

本插件自带工具本体，环境变量 `DSH_GAUNTLET_KIT_DIR` 指向它（你的 persona 里写了你这个 shell 的写法）。
把工具装进目标仓库（一次即可，离线）：

- PowerShell：`node "$env:DSH_GAUNTLET_KIT_DIR/install-kit.mjs" .`
- bash：`node "$DSH_GAUNTLET_KIT_DIR/install-kit.mjs" .`

仓库里已经有 `.gauntlet/gauntlet.mjs`（上次装过并提交了）就直接用，不必重装；第 0 阶段摸底会把它提交进仓库。
变量是空的（插件没正常加载）时，才去仓库里已有的 `.gauntlet/` 找，仍然找不到就以 NEED-HUMAN 收尾。

然后检查工具链：`node .gauntlet/gauntlet.mjs doctor`

（需要哪些工具由适配器决定，见对应适配器技能。）缺工具时**不要**自己改闸门绕过，也不要自己去装（会被拒绝）：
以 NEED-HUMAN 收尾，写出确切的安装命令（第 6 节）。

### 三个 shell（Windows 上尤其要分清）

| 谁执行命令 | Windows | Linux / macOS |
|---|---|---|
| 你自己（shell 工具） | PowerShell | bash |
| `gauntlet.config.json` 的 `commands`（kit 交给系统 shell） | **cmd.exe** | /bin/sh |
| `demo/*.json` 的 `run` | Git Bash（找不到时 cmd.exe） | /bin/sh |

- 技能里的命令都写成**一行**的 `node .gauntlet/gauntlet.mjs …` 或 `git …`，在任何 shell 里照抄即可。
  不要自己加 shell 专属语法（`\` 续行、`2>/dev/null`、`$(…)`、`find`、`grep`……）；需要的平台相关逻辑都在 kit 命令里。
- 写进 `commands` 的命令要能在 cmd.exe 里跑：参数用双引号、不用 bash 才有的写法；写之前用 `test` 等命令实际跑通。

### 中间文件的位置

构建目录、输出目录、生成文件的位置由 `gauntlet.config.json` 的 `buildDir` / `outDir` /
`generatedDir` 决定。需求要求"中间文件放在 tmp"之类时，它们必须都在那个目录下（`init --workdir tmp`）。
你自己的临时文件（日志、草稿、基线构建）也一律放进同一个目录，不许写到仓库外或系统临时目录。

## 4. 闸门命令（只用这些命令判断是否完成）

质量闸门量的是**仓库里全部产品代码**（`sources` 匹配的文件，测试、生成代码、构建目录除外），不只是你改动的部分。

**先看 `gauntlet.config.json` 的 `adapter`**，它决定闸门怎么构建、测试、分析：

| adapter | 适用 | 工具链片段（具体怎么做都在这里） |
|---|---|---|
| `commands`（没写 adapter 也是它） | 任何项目：项目自己的构建 / 测试 / 检查命令 + 标准报告 | **gauntlet-adapter-commands** 技能 |
| `cmake-clang` | 可选的深度分析：项目本来就用 CMake 构建、clang 能原样编译 | **gauntlet-adapter-cmake** 技能 |

阶段技能只讲"做什么"；"用什么工具、怎么写"只读对应适配器技能里**你所在阶段**那一节，另一个适配器技能不用读。

技能里写的 `qa/`、`architecture.json`、`quality-accepted.json`、`mutation-accepted.json`、`GAUNTLET.md` 是**默认位置**；
项目可以在 `gauntlet.config.json` 的 `paths` 里改，以配置为准（例如 `"paths": { "qa": "docs/qa" }`）。
下表的命令两种适配器都一样，只是底层工具不同。

| 命令 | 作用 |
|---|---|
| `spec` | 解析 `features/*.feature`（cmake-clang 下还会列出没有实现的步骤） |
| `test` | 构建 + 跑全部测试 + 收集覆盖率；commands 适配器还会核对每个场景都有通过的验收测试 |
| `static` | **每个**产品文件的每个函数：圈复杂度/长度/嵌套/参数、告警、哪些文件没被分析到 |
| `tidy` | 静态检查 |
| `cppcheck` | 第二个静态分析器（cmake-clang 下内置，装了就运行） |
| `sanitize` | 运行时检查：AddressSanitizer / UndefinedBehaviorSanitizer 跑全部测试，CUDA 测试用 compute-sanitizer |
| `dup` | 复制粘贴检测：连续 100 个以上相同词法单元算一处 |
| `crap` | 函数的 CRAP 与覆盖率（先 test） |
| `arch` | 模块依赖方向、环（`architecture.json` 或 `commands.arch`） |
| `mutate` | 变异测试：默认**全部**产品代码、不限数量（慢是正常的） |
| `compare <期望> <实际>` | 二进制结果逐帧比较（与原程序对比），`--record qa/equivalence.json` 记录 |
| `diagram <候选.json>` | 用 Archify 校验并渲染架构图（每个方块/箭头必须引用真实源码） |
| `gate --profile <p>` | **你的验收标准**：按阶段跑一组闸门，写 `gate.json` |
| `next --profile <p>` | 跑闸门 + 给出按优先级排序的待修清单，并判断要不要继续（见第 7 节） |

所有命令的形式都是 `node .gauntlet/gauntlet.mjs <命令>`。各 profile 包含的闸门：

| profile | 闸门 |
|---|---|
| `specifier` | 场景语法 |
| `coder` | + 构建、全部测试 |
| `cleaner` | + 测量范围、函数质量、告警、静态检查（含 cppcheck）、重复代码、CRAP、架构 |
| `hardener` | + 覆盖率、运行时检查（sanitizer）、变异测试 |
| `full` | + QA、需求约束、与原程序等价性 |

输出最后一行是 `GATE <profile>: PASS` 才算通过。

## 5. 绝对禁止（违反任何一条 = 本阶段作废）

- 修改 `architecture.json`、`gauntlet.config.json`（尤其是 `sources`、`exclude`、`thresholds`——**收窄测量范围或放宽阈值就是作弊**）、
  `qa/constraints.json`、`.gauntlet/` 下的工具代码。（第 0 阶段摸底起草配置 / 架构规则、第 1 阶段起草 `qa/constraints.json` 除外，必须注明"需人工确认"。）
- 创建、重建或放松棘轮基线 `gauntlet-baseline.json`（`baseline` / `baseline --reset`、手改里面的数值）。
  基线只能由第 0 阶段摸底起草（需人工确认）；之后只能运行 `baseline --tighten`（只会收紧）。
- 用 `quality-accepted.json` / `mutation-accepted.json` 掩盖问题。这两个文件只能放**确实无法消除**的例外，
  每条都要有具体理由；证据包会把它们全部列给人类审核，结论会变成"待你确认"。
- 宣布需求里的某条要求"超出范围"、"本次不验证"。做不到就以 NEED-HUMAN 收尾，由人决定。
- 删除、跳过、注释掉已有测试或验收场景；把断言改弱让测试通过。
- 修改 `features/*.feature` 的含义（规格阶段以外只能改错别字，并说明）。
- 用 `#ifdef`、宏、特殊分支来"识别测试环境"。
- 声称通过但没有贴出闸门输出。

## 6. 阶段收尾（结果汇报格式）

阶段结束就把下面这段 `GAUNTLET-RESULT` 作为你的最终输出返回给 Leader（这是你这次被调用的结果）。收尾前先提交。

```
GAUNTLET-RESULT: PASS          # 或 FAIL / NEED-HUMAN
stage: 2-code
profile: coder
branch: gauntlet/<短名> @ <commit 短哈希>
gates: spec ✅ build ✅ tests ✅ (25/25)
loop: rounds=<next 的轮数> distance=<第一轮距离> -> <最后一轮距离>
summary: 一两句话说明做了什么
next: 给下一阶段的提示（可选）
```

- **PASS** → 全部闸门达标。Leader 过人类闸门后派下一阶段。
- **FAIL**（`next` 报 STALLED：离阈值的距离连续几轮没有缩小）→ 贴出失败的闸门和 next.md 要点；Leader 按「返工」决定回到哪个阶段。
- **NEED-HUMAN**（需求有歧义 / 缺工具 / 需要改架构 / 要放松规则）→ 把具体问题和 A/B 选项写清楚；Leader 转交用户，等回复再继续。
  - **被拒绝的操作**：你是被委派的子 agent，需要审批的操作（装工具、联网下载、写仓库外的位置……）会被自动拒绝。
    不要重试、不要换个写法绕过：在 summary 里写出**确切的命令**（一行、写明在哪个目录、用哪个 shell）和为什么需要它；
    Leader 请用户批准后会代为执行，再把这个阶段重新派给你。

### 棘轮模式（`gauntlet.config.json` 里 `"ratchet": { "enabled": true }`）

用于已有大量旧代码的仓库。`gauntlet-baseline.json` 记录了引入 Gauntlet 时就存在的质量欠账：

- 基线里的欠账（超标函数、覆盖不足的文件、旧告警、旧重复代码……）**只要不变差**就放行，清单里不会出现；
- 基线里没有的东西（新函数、新告警、新重复代码）必须达到阈值；**改动过的行**的覆盖率必须达到阈值；
- 变异测试只变异改动过的行；
- 碰到旧函数时可以只修 bug，但不能让它更长、更复杂、更缺测试——`next` 会报"比基线更差"。

## 7. 迭代循环：指标达标才停

**没有轮数上限。** 一个阶段什么时候结束，只由指标决定（CRAP、复杂度、覆盖率、变异得分……都达到阈值），
不由"已经试了几次"决定。用 `next` 驱动循环：

- 本阶段第一次（开一个新循环）：`node .gauntlet/gauntlet.mjs next --profile <你的 profile> --reset`
- 之后每改完一处：`node .gauntlet/gauntlet.mjs next --profile <你的 profile>`
- 被中断后重新派来时不要 `--reset`，接着上一轮的循环跑。

| 退出码 | 结论 | 你要做的事 |
|---|---|---|
| 0 | DONE | 全部闸门通过 → 按第 6 节以 PASS 收尾，进入下一阶段 |
| 1 | CONTINUE | 修清单（`gauntlet-out/next.md`）的第 1 项（同类问题可一起修），再运行 `next` |
| 3 | STALLED | 离阈值的距离连续几轮没缩小 → 停止，以 FAIL / NEED-HUMAN 收尾，把 next.md 的要点写进 summary |

"距离"= 待修项数 + 每个超标值超出阈值的比例，所以把一个函数的 CRAP 从 182 降到 40 也算进展，会继续循环。
不要因为"轮数太多"提前收尾；也不要为了让距离变小去改阈值、扩大 exclude 或写 accepted 文件（第 5 节）。

## 8. 小步快跑

Bob 大叔：小步、频繁运行测试、每次只改一处。每改一小块就跑一次相关命令，变绿就提交（第 2 节）。
上下文越长你越容易犯错（"lost in the middle"）——只读和本阶段有关的文件。
