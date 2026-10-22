---
name: gauntlet-report
description: Gauntlet 第 6 阶段（Reporter）：最终全量闸门复验、录制演示、编写使用教程、生成可视化证据包（单文件 HTML 报告 + 仪表盘小结），在本地分支提交，交给 Leader 转用户审阅（推送和开 PR 由 Leader 在用户通过后做）。让人类用 5 分钟审阅，而不是读代码。
---

# 证据包阶段（Reporter）

AI 写代码的速度远超人类读代码的速度。所以人类不读代码，读你做的**证据包**：
一页能看懂的结论、真实运行的演示、照着就能用的教程、以及机器给出的质量证明。

## 步骤

1. 确认在工作分支上（gauntlet-core）。
2. **复验**（不相信前面阶段的口头结论）：
   ```
   node .gauntlet/gauntlet.mjs gate --profile full --title "<需求标题>"
   ```
   不 PASS → 按 FAIL 收尾，summary 贴出失败的闸门，由 Leader 决定回退到哪个阶段。
   PASS 且开了棘轮模式：运行 `node .gauntlet/gauntlet.mjs baseline --tighten`，把本次的改善固定进基线
   （只会收紧），和教程等一起提交。
3. 录演示：对 `.gauntlet/demo/*.json` 每个脚本执行 `node .gauntlet/gauntlet.mjs demo .gauntlet/demo/<x>.json`
   （生成可回放的终端"录像"到 `.gauntlet/out/evidence/demos/`）。
4. QA 报告：确认分支上有 `.gauntlet/qa/qa-report.json`（QA 阶段已提交）且 verdict 为 pass；没有就按 FAIL 收尾。
5. 写使用教程 `.gauntlet/docs/<主题>.md`（提交到仓库，长期有用），结构：
   - 它能做什么（3 条以内）
   - 三步上手（构建、最常用的命令、看到什么结果）
   - 输入/输出规则表（正常 + 错误情况 + 退出码）
   - 在脚本或代码里如何调用
   - 可以引用截图：`![说明](../qa/media/x.png)`
   写给"明天要用这个功能的同事"，不是写给程序员看实现。
6. **画架构图**：用 [Archify](https://github.com/tt-a1i/archify) 画出交付后代码的真实结构。
   - 第一次运行 `node .gauntlet/gauntlet.mjs diagram` 时工具会被克隆到输出目录的 `tools/archify/`；
     动笔前读它的 `archify/SKILL.md` 和 `archify/references/repository-authoring.md`（若绑定了 archify 技能，直接按技能做）。
   - 写候选文件 `.gauntlet/docs/architecture/<主题>.architecture.json`（提交到仓库，下次修改时复用）：
     - `meta.repository`：`git remote get-url origin`（去掉用户名/令牌）+ 当前分支 HEAD 的完整 40 位 commit（Leader 在用户审阅通过后推送它，链接届时生效）；
     - 每个组件都有 `sources`（仓库相对路径 + 行号范围），只画你在源码里**亲眼确认**过的组件和调用关系；
     - 用 `boundaries` 画出架构规则里的模块（`.gauntlet/architecture.json` 或 `commands.arch` 工具的规则）；后端、共享模块、入口要分清。
   - 校验并渲染：
     ```
     node .gauntlet/gauntlet.mjs diagram .gauntlet/docs/architecture/<主题>.architecture.json
     ```
     失败时按输出里的 `diagnostics`（附带具体修复建议，如间距不足、源码行号不存在）修改候选文件，重跑直到 PASS。
     诊断不再减少（同样的错误反复出现）时按 FAIL 收尾并贴出诊断。
   - **拿不到 Archify**（`diagram` 报"拿不到 Archify"，例如离线服务器）：不算失败。在结果里写明原因，跳过这一步；
     证据包会用自动生成的模块依赖草图代替，并把"没有 Archify 架构图"列给人类确认。
7. 生成证据包：
   ```
   node .gauntlet/gauntlet.mjs evidence --title "<需求标题>" --tutorial .gauntlet/docs/<主题>.md
   ```
   产物：`.gauntlet/out/evidence/index.html`（单文件完整报告，离线可看）和 `.gauntlet/out/evidence/comment.md`（仪表盘小结）。
8. 交付：把 `.gauntlet/out/evidence/comment.md` 的仪表盘小结和 `.gauntlet/out/evidence/index.html` 的位置写进结果
   （连同每个 demo 录像和 `diagrams/*.html` 架构图的位置）。Leader 会把它交给用户按「5 分钟审阅路线」审阅。
9. 提交（教程、demo 脚本、架构图候选文件、收紧后的基线）。**不要推送、不要开 PR**：用户审阅通过后由 Leader 推送并开 PR，
   PR 正文用 `.gauntlet/out/evidence/comment.md`。
10. 按 gauntlet-core 第 6 节以 PASS 返回结果，附上证据包位置（index.html、comment.md、demo、架构图）和最后的 commit。

## 证据包里会自动出现的内容

| 部分 | 来源 | 人类用它判断什么 |
|---|---|---|
| 闸门卡片 | gate.json 等 | 一眼看全绿还是有红 |
| 5 分钟审阅路线 | 自动生成 | 按什么顺序看 |
| 验收场景（自然语言 + 每步 ✅/❌） | features + 运行结果 | 需求对不对 |
| 演示录像 / 截图 | demo、media | 东西真的能用 |
| 使用教程 | .gauntlet/docs/*.md | 以后怎么用 |
| CRAP 散点图 / 柱状图 | crap.json | 哪里复杂又没测 |
| 变异测试 + 人工接受的等价变异体 | mutation.json | 测试是否真的守住代码；agent 有没有"耍赖" |
| 架构图（Archify，引用真实源码） | .gauntlet/docs/architecture/*.json | 代码现在长什么样 |
| 测量范围 / 代码质量 / 重复代码 | static.json、tidy.json、duplication.json | 是否量到了全部代码、质量是否过关 |
| 需求约束 / 与原程序等价性 | .gauntlet/qa/constraints.json、.gauntlet/qa/equivalence.json | 每条要求是否被证实、输出是否与原程序一致 |
| 模块依赖图 | arch.json | 有没有越界依赖 |
| 改动范围 / 治理文件改动 | git diff | 有没有人动了阈值、架构、接受清单 |

你不需要手写这些图表，只需要保证输入齐全（.gauntlet/qa/qa-report.json、demo 脚本、教程）。

## 规则

- 不修改产品代码和测试。发现问题就 FAIL，不要自己修。
- 证据必须来自本轮真实运行，不能复用旧的 .gauntlet/out。
