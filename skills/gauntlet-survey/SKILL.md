---
name: gauntlet-survey
description: Gauntlet 第 0 阶段（Surveyor）：在规格之前摸清目标仓库——语言、构建和测试命令、CI、现有质量工具、目录与模块、约定和坑；安装 .gauntlet、选适配器、填好并验证 .gauntlet/gauntlet.config.json、决定是否开棘轮模式，并把结论写成项目档案 GAUNTLET.md，供本需求和以后所有需求复用。
---

# 摸底阶段（Surveyor）

后面每个阶段的 agent 都是全新启动的，对这个仓库一无所知。你的工作是**只做一次**的项目调研：
把"这个仓库怎么构建、怎么测试、代码在哪、有什么规矩、有什么坑"查清楚、**实际跑通**，
写进项目档案 `.gauntlet/GAUNTLET.md`。以后的需求直接复用它，只在仓库变了时刷新。

你**不改产品代码和测试**，也不写验收场景（那是第 1 阶段的事）。

## 步骤

1. 按 gauntlet-core 第 1、2 节读任务、确认在工作分支上（Leader 已建好）。
2. **安装 / 更新工具**：按 gauntlet-core 第 3 节从 kit 来源安装 `.gauntlet/`——仓库里已经有也重新安装一次，工具才会跟上 kit 的更新
   （`.gauntlet/VERSION` 里是版本号）。有变化就和本阶段的其他改动一起提交，结果里写 `kit: <旧版本> -> <新版本>`。
   kit 来源访问不了（离线）但仓库里已有 `.gauntlet/`：继续用它，在结果里写明没能更新；仓库里也没有：按 gauntlet-core 第 3 节 NEED-HUMAN。
   然后：
   ```
   node .gauntlet/gauntlet.mjs survey        # 结果在输出目录的 survey.md / survey.json
   ```
   最后一行是结论：
   - `UP-TO-DATE`：档案存在、配置存在，之后没有构建 / CI / 质量配置变化 → 走「快速复核」。
   - `REFRESH`：档案过期（survey.md 列出了变化的文件）或缺配置 → 只更新受影响的部分，再走「快速复核」。
   - `FULL`：没有档案 → 走「完整摸底」。
3. 仓库根目录有 `gauntlet.config.json`（老布局，文件散在根目录）：先按下面「迁进 .gauntlet/」做完，再重新 `survey`。

### 迁进 .gauntlet/（只对老布局的仓库做一次）

目标：Gauntlet 的文件全部收进 `.gauntlet/`（gauntlet-core 第 3 节「文件放哪里」），根目录不再留任何 Gauntlet 文件。

1. 用 `git mv` 把存在的这些移过去：`gauntlet.config.json`、`GAUNTLET.md`、`architecture.json`、`quality-accepted.json`、
   `mutation-accepted.json`、`qa/`、`features/`、`demo/`、`acceptance/steps/` → `.gauntlet/` 下同名位置；
   `gauntlet-baseline.json` → `.gauntlet/baseline.json`；证据包阶段写的教程 `docs/<主题>.md` 和 `docs/architecture/` → `.gauntlet/docs/`
   （项目自己的文档不动）。`gauntlet.local.json`（不提交）直接移到 `.gauntlet/gauntlet.local.json`。
2. 改 `.gauntlet/gauntlet.config.json`：删掉还指向老位置的 `outDir`、`buildDir`、`features`、`stepsDir`、`generatedDir`、`paths`、
   `ratchet.baseline`（删掉后默认就是 `.gauntlet/` 里的位置）；`commands` 里写死的 `gauntlet-out/…` 换成 `{out}/…`。
   **只改位置，`sources`、`exclude`、`thresholds` 一个字都不动。**
3. 演示脚本的 `"cwd": ".."` 改成 `"../.."`；cmake-clang 按 `init` 打印的那行更新 CMakeLists.txt 里的 `gauntlet_add_acceptance(...)`。
4. 删掉 `.gitignore` 里 `# gauntlet` 下的老条目，运行 `node .gauntlet/gauntlet.mjs init`（已有配置会保留，只补上新的忽略规则），
   再删掉根目录残留的 `gauntlet-out/`、`build-gauntlet*/`（都是生成的）。
5. `node .gauntlet/gauntlet.mjs test` 跑通后和档案一起提交（`[survey] move gauntlet files into .gauntlet/`），结果写 `rules: changed`。

### 快速复核（档案仍然有效）

1. 读 `.gauntlet/GAUNTLET.md`，运行 `node .gauntlet/gauntlet.mjs doctor`（必须全绿）和 `node .gauntlet/gauntlet.mjs test`（必须能跑完并产出报告）。
2. 都正常：只把档案里的 `commit:` 更新为当前 commit（以及确实变了的事实），提交；结果写 `rules: unchanged`。
3. 跑不通：说明档案已经不对，改走「完整摸底」。

### 完整摸底

1. **读**：survey.md；README / CONTRIBUTING / AGENTS.md / CLAUDE.md 等文档；CI 配置里实际跑的命令；
   survey.md 列出的构建文件。只读和构建、测试、结构有关的部分。
2. **跑**：用项目自己的方式构建并跑一次全部测试（优先照搬 CI 的命令），记下命令、耗时、需要的环境变量。
   - 默认分支上原有测试就失败、或环境缺东西跑不起来 → 不要修，记进档案的「坑」，以 NEED-HUMAN 收尾，写清楚缺什么。
3. **工具链原样使用**：项目用什么编译器、包装器、构建系统、运行环境，就照原样记录和配置，不换编译器、不改构建方式
   （commands 适配器技能「工具链原则」）。默认用 commands；只有项目本来就用 CMake、且 clang 能原样编译，又需要更深的分析时才选 cmake-clang。
4. **选适配器**并配置（按对应适配器技能的「0 摸底」一节）：`init`，填 `sources`（**全部**产品代码；survey 给了草稿，
   逐个目录确认它是不是产品代码）、`commands`（survey 给了草稿，必须改成真能跑的命令；它们由 kit 交给系统 shell 执行，
   Windows 上是 cmd.exe——参数用双引号、不用 bash 专属写法，见 gauntlet-core 第 3 节「三个 shell」）、架构规则草稿
   （原则见 gauntlet-specify「架构草稿」）。直到：
   ```
   node .gauntlet/gauntlet.mjs doctor      # 全绿
   node .gauntlet/gauntlet.mjs test        # 跑完并产出测试 / 覆盖率报告（验收场景还没写，ACCEPTANCE 失败是正常的）
   ```
5. **量现状**：`node .gauntlet/gauntlet.mjs gate --profile quality`（不需要场景，只量质量闸门：scope、complexity、warnings、tidy、
   duplication、crap、arch、coverage）。旧代码本身就过不了、而本次需求不是"清理旧代码"时：
   在 `.gauntlet/gauntlet.config.json` 设 `"ratchet": { "enabled": true }`，运行 `node .gauntlet/gauntlet.mjs baseline` 记录现有欠账。
   需求本身就是重构 / 清理时不开棘轮。
6. **写档案** `.gauntlet/GAUNTLET.md`（模板见下）。`base:` 必须写：survey.md 的「分支基线」给出了它；显示"找不到"时问清楚默认分支再写，
   否则棘轮模式的"改动行"无从计算（闸门会报错），提交 `.gauntlet/GAUNTLET.md`、`.gauntlet/gauntlet.config.json`、架构规则、`.gauntlet/baseline.json`（如有）。
   结果里写 `rules: created`（第一次）或 `rules: changed`（改了配置 / 架构规则 / 基线），并写"规则文件草稿：需人工确认"。

## GAUNTLET.md 模板

档案写给**下一个全新启动的 agent**：只写它需要、且从代码里不容易看出来的事实；每条命令都是你实际跑通过的。
档案是否过期以**最后一次提交 GAUNTLET.md 的 commit** 为准（之后构建 / CI / 质量配置有变化就要刷新），所以档案要和配置改动放在同一个提交里。

```markdown
# GAUNTLET.md — 项目档案

commit: `<写档案时的 commit 短哈希>`　base: `<默认分支>`　更新：<日期>　适配器：<commands | cmake-clang>　棘轮：<开 / 关（基线 N 项）>

## 一句话
这个项目是什么、交付物是什么（库 / 命令行 / 服务 / GUI）。

## 构建、测试、运行（已实际运行）
| 做什么 | 命令 | 耗时 | 备注 |
|---|---|---|---|
| 构建 | … | … | 需要的环境变量、服务、数据 |
| 全部测试 | `node .gauntlet/gauntlet.mjs test` | … | 底层实际执行的命令 |
| 运行交付物 | … | | QA 用它验证 |

## 代码地图
- 产品代码：哪些目录、各自负责什么；入口在哪（谦卑对象）。
- 测试：单元测试在哪、用什么框架；验收测试放在哪（新写的照这个位置放）。
- 模块与依赖方向：和架构规则一致的一句话版本。

## 现有规矩
- CI 里跑什么、本地怎么复现；已有的 linter / 格式化工具及其配置文件。
- 命名、错误处理、日志、提交信息等约定（只写真实观察到的）。

## 质量现状
- 第一次量出来的结果：超标函数、覆盖率、告警……；棘轮基线摘要（如有）。

## 坑
- 本机 / 服务器问题、慢测试、偶发失败、需要但不能入库的密钥（只写名字，不写值）。
```

## 规则

- 档案里每条命令都必须是你实际跑通过的；推测的内容标明"未验证"。
- 不写密钥、令牌、密码的值；不提交本机路径相关的配置（那些写进 `.gauntlet/gauntlet.local.json`）。
- `sources` 宁多勿少：漏掉的产品代码不会被度量。不确定是不是产品代码时，写进档案并 NEED-HUMAN 问人。
- 已经存在的 `.gauntlet/gauntlet.config.json`、架构规则、基线：只能在档案过期且确有必要时改，每处改动在结果里逐条列出（`rules: changed`）；
  放松阈值、收窄 `sources`、放松基线永远不允许（gauntlet-core 第 5 节）。
- 收尾按 gauntlet-core 第 6 节；小结比普通阶段多一行 `rules: created | changed | unchanged`，Leader 据此决定要不要请用户确认。
