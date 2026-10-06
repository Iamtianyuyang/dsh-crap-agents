---
name: gauntlet-tdd
description: Gauntlet 第 2 阶段（Coder）：用 TDD 实现功能——验收测试、单元测试和最少的产品代码，让全部 Gherkin 场景和单元测试通过。具体的测试框架和写法见当前适配器的技能（gauntlet-adapter-cmake / gauntlet-adapter-commands）。
---

# 编码阶段（Coder）

目标只有一个：**让所有验收场景和单元测试变绿**。代码干不干净是下一阶段的事，
但不要故意写乱——小函数、好名字是免费的。

**先看 `gauntlet.config.json` 的 `adapter`**，再读对应适配器技能的「2 编码」一节：
`commands`（或没写）→ gauntlet-adapter-commands；`cmake-clang` → gauntlet-adapter-cmake。
那里写着验收测试怎么写、用什么单元测试框架、新项目的工程骨架。

## TDD 三定律（Bob 大叔）

1. 没有失败的测试，不写产品代码。
2. 测试只写到"失败"为止（编译失败也算失败）。
3. 产品代码只写到"让当前失败的测试通过"为止。

循环：红 → 绿 → 小重构 → 再红。每个循环几分钟。

## 步骤

1. 按 gauntlet-core 读任务、切分支（分支已由规格阶段创建）。
2. `node .gauntlet/gauntlet.mjs next --profile coder --reset` 看全貌：哪些场景还没有验收测试、哪些测试失败。
3. 一个场景一个场景地推进：
   - 写这个场景的验收测试（驱动应用边界，写法见适配器技能）——红
   - 需要新的类/函数时，先写单元测试（红）
   - 写最少的产品代码（绿）
   - `node .gauntlet/gauntlet.mjs test` 看整体情况
4. 用 `next --profile coder` 循环（gauntlet-core 第 7 节），直到 DONE。
5. 提交、推送、收尾（gauntlet-core 第 6 节）。

## 设计要点

- **验收测试驱动应用边界**（命令行入口、HTTP handler、公开 API），不测内部细节；内部细节交给单元测试。
- **谦卑对象（Humble Object）**：程序入口、真实 IO、GUI 事件循环只做转发；
  行为都放在可测试的函数里（输出流、时钟、文件系统通过参数注入）。
  入口文件能否从 `sources` 里排除只能由**人类**决定，你不能自己改 `sources` / `exclude`。
- 不要为了让测试通过而在产品代码里判断"是否在测试中"。
- 场景措辞是需求：步骤 / 测试名与场景逐字对应，不要改场景去迁就代码。
