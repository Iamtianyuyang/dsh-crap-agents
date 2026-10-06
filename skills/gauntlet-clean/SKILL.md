---
name: gauntlet-clean
description: Gauntlet 第 3 阶段（Cleaner）：在不改变行为的前提下重构全部产品代码——函数复杂度/长度/嵌套/参数、告警、静态检查、复制粘贴的重复代码、CRAP 与架构违规全部降到阈值以内。
---

# 清理阶段（Cleaner）

上一阶段的代码"行为正确但不一定干净"。你的工作是**只改结构、不改行为**，让 `gate --profile cleaner` 通过。
注意：闸门量的是**仓库里全部产品代码**，包括原来就有、这次没碰过的代码——旧代码不达标也要清理。
（开了棘轮模式时例外：基线里的旧欠账只要不变差就放行，你只需保证新代码达标、碰过的旧函数没有变差；
顺手把碰过的旧函数改好更好，Reporter 会用 `baseline --tighten` 把改善固定下来。）
测试就是你的安全网：每做一步重构就跑一次 `test`。

**先看 `gauntlet.config.json` 的 `adapter`**，再读对应适配器技能的「3 清理」一节：
`commands`（或没写）→ gauntlet-adapter-commands；`cmake-clang` → gauntlet-adapter-cmake。

## 先看全貌

```
node .gauntlet/gauntlet.mjs test
node .gauntlet/gauntlet.mjs static    # 每个函数的 CC/长度/嵌套/参数 + 告警 + 没被分析到的文件
node .gauntlet/gauntlet.mjs tidy      # 静态检查
node .gauntlet/gauntlet.mjs dup       # 复制粘贴的代码块（文件:行号 = 文件:行号）
node .gauntlet/gauntlet.mjs crap      # 能插桩的函数的 CRAP
node .gauntlet/gauntlet.mjs arch      # 架构违规
```

结果在输出目录的 `static.json`、`tidy.json`、`duplication.json`、`crap.json`、`arch.json` 里。
之后用 `next --profile cleaner` 循环（gauntlet-core 第 7 节），它按闸门和超标程度给出待修清单。

## 每个闸门怎么过

| 闸门 | 默认阈值 | 典型做法 |
|---|---|---|
| 测量范围 `scope` | 100% 产品文件被分析到 | 见适配器技能；确实是死代码就删掉；做不到就 NEED-HUMAN |
| 函数质量 `complexity` | CC ≤ 10，长度 ≤ 60 行，嵌套 ≤ 4，参数 ≤ 7 | 提取函数、卫语句、表驱动；参数太多 → 参数对象 |
| 告警 `warnings` | 0 条 | 修掉，不要用注释 / pragma / 关掉规则来压 |
| 静态检查 `tidy` | 0 条 | 按提示修；真正的误报才写进 `quality-accepted.json`（见下） |
| 重复代码 `duplication` | ≤ 3% | **把重复逻辑合并成一份**，见下文 |
| CRAP `crap` | ≤ 8 | 降复杂度；覆盖不足交给加固阶段 |
| 架构 `arch` | 0 违规 | 依赖倒置；改架构规则需要人确认 |

## 重复代码：合并类任务的核心

"把 CPU 版和 GPU 版整理成一个程序"这类任务，真正的工作量在这里：配置解析、模型加载、输出写入、
参数校验、公共数学函数……在两份实现里各有一份拷贝。正确做法：

1. 抽到一个共享模块（例如 `common/`），两个后端都依赖它（更新架构规则需要人确认，用 NEED-HUMAN 提出模块划分）。
2. 后端只保留真正不同的部分（例如 CPU 循环 vs CUDA kernel），通过窄接口接入。
3. 每合并一处就跑 `test`，保证两个后端的结果不变（等价性对比在 QA 阶段复核）。

`dup` 报告的每一处克隆都要么消除，要么在结果 summary 里解释为什么必须保留（例如两份代码语言不同）。

## 重构手法（按优先级）

1. **提取函数**：长函数里每个"段落"抽成有名字的小函数。名字说清"做什么"。
2. **卫语句 / 提前返回**：消灭层层嵌套的 if。
3. **表驱动**：一长串 `switch` / `if-else` 映射 → 查找表。
4. **分解条件**：复杂布尔表达式 → `is_inside_pml(...)` 这样的命名函数。
5. **以多态取代条件**：同一个 `switch(method)` 在多处出现 → 函数指针表 / 接口 + 实现。
6. **消除重复（DRY）**：见上一节；但不要为了 DRY 把不相关的东西硬捏在一起。
7. **深模块（Ousterhout）**：接口窄、实现深。不要为了降 CC 拆出一堆只被调用一次、名字空洞的 `helper1/helper2`。

## 例外清单（quality-accepted.json）

只有**无法消除**的问题才能列为例外，每条必须有具体理由，人类会逐条审核（证据包结论会变成"待你确认"）。
格式（例子见适配器技能）：

```json
[ { "kind": "tidy", "file": "<文件>", "check": "<规则 id>", "reason": "<为什么这是误报 / 无法消除，具体到代码>" } ]
```

`kind` 可选：`function`（函数超标）、`warning`、`tidy`、`unbuilt`（未参与构建的文件）、`duplication`。
"阈值太严""代码太多来不及"都不是理由。

## 规则

- 每次只做一个重构，然后 `node .gauntlet/gauntlet.mjs test`，保持全绿。
- 不改验收场景、不删测试、不改公共行为（输出文本、退出码、数值结果都算行为）。
- 不提高阈值、不扩大 `exclude`、不改 `sources`。
- 完成后 `node .gauntlet/gauntlet.mjs gate --profile cleaner` 必须 PASS，再收尾。
- 在结果 summary 里列出：重构了哪些函数（前后 CC/长度）、合并了哪些重复代码、修了多少告警和 tidy 问题。
