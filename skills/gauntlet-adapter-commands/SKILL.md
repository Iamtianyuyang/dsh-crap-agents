---
name: gauntlet-adapter-commands
description: Gauntlet 工具链片段——在目标仓库 gauntlet.config.json 的 adapter 是 "commands" 或没写时使用（通用方式，任何项目）：任何语言、编译器、构建系统和运行环境的项目里每个阶段具体怎么做（报告契约、工具链原则、编译器告警、覆盖率、验收测试按场景名命名、变异测试、常见问题）。
---

# commands 适配器（任何语言）

阶段技能讲"做什么"，本技能讲在非 CMake 项目里"用什么做"。只读你所在阶段的那一节。

闸门不认识语言，只认识**标准报告**；项目在 `gauntlet.config.json` 的 `commands` 里说明怎么产生它们：

| 闸门 | 来源 |
|---|---|
| `build` | `commands.build`（可选，解释型语言不需要），退出码非 0 = 失败 |
| `tests` | `commands.test.run` 跑全部测试（单元 + 验收），写出 `junit` 列出的 JUnit XML |
| `acceptance` | 每个 Gherkin 场景都要有一个**名字包含场景名**的通过的测试 |
| `coverage` / `crap` | `commands.test` 写出的 `lcov` 或 `cobertura` 覆盖率；测试从没加载过的产品文件按 0% 算 |
| `static`（复杂度/长度/嵌套/参数） | 装了 lizard 就用 lizard（约 30 种语言），否则内置分析器（C 系语言 + Python） |
| `warnings` / `tidy` | `commands.lint` 里的检查器输出的 SARIF（`gate: "warnings"` 进告警闸门，默认进 `tidy` 闸门） |
| `arch` | `commands.arch` 的退出码（0 = 无违规），可选 SARIF |
| `mutate` | 内置引擎（C 系语言 + Python），或 `commands.mutation` 指定的外部工具报告（mutation-testing-report-schema） |

命令里的 `{out}` 会替换成输出目录。没配置 lint / arch 时闸门不失败，但证据包会把它列为"需要人确认"——
项目里本来就有这类工具时，一定要配上。

## 工具链原则（适用于任何编译器、运行环境）

Gauntlet 不认识也不需要认识具体的编译器或框架，它只要求上表里的**报告**。所以：

1. **工具链原样使用**：项目用什么编译器、编译器包装器（MPI、交叉编译、厂商编译器……）、构建系统、运行方式
   （多进程启动器、GPU、作业调度……），`commands` 里就照原样写。不要为了迁就 Gauntlet 换编译器或改构建方式。
2. **编译器告警**：不用找 SARIF。几乎所有编译器都输出 `文件:行:列: warning: …` 或 `文件(行): warning …`，
   给 lint 加一条完整编译的命令并写 `"parse": "diagnostics"`，就会进入告警闸门：
   `{ "name": "compiler", "run": "<完整编译命令，打开项目平时用的告警选项>", "parse": "diagnostics" }`
3. **覆盖率**：优先用项目编译器自己的插桩，再用任意转换工具导出 LCOV 或 Cobertura。编译器做不到时，
   可以加一个**只用于度量**的覆盖率构建（另一个编译器、单独的构建目录），但这是规则改动：写进档案和结果（`rules: changed`），由人确认；
   测试结论仍以项目原本的编译器为准。
4. **测试需要特殊环境**（多进程、指定机器、GPU、许可证……）：照原样写进 `commands.test`；当前环境跑不了就 NEED-HUMAN，
   写清缺什么，不要跳过这些测试。
5. **运行时检查（C、C++、Fortran、CUDA 等不做内存检查的语言）**：用项目的编译器加上它支持的 sanitizer 选项
   （以及 GPU 代码的运行时检查工具）编一份**单独的**构建并跑测试，写成 `commands.sanitize`：
   `{ "name": "asan", "run": "<带 sanitizer 选项的完整构建 + 跑全部测试>" }`。Gauntlet 从输出里读 sanitizer 报告；
   编译器不支持 sanitizer 时在档案里写明，不配这一项。
6. **找不到能输出标准报告的办法**：先找项目生态里现成的转换工具；还是没有就 NEED-HUMAN，说明缺哪一种报告。

## 0 摸底（Surveyor）

```
node .gauntlet/gauntlet.mjs init --adapter commands   # 需求要求中间文件放在 tmp 时再加 --workdir tmp
```

1. 照 survey.md 的草稿和生成的 `gauntlet.config.json` 里 `$examples` 的样子填写：
   - `sources`：**全部**产品代码（例如 `["src/**/*.py"]`、`["cmd/**/*.go", "internal/**/*.go"]`），不是只有本次要改的；
   - `commands.test`：项目现有的测试命令 + 输出 JUnit 和覆盖率的参数，并在 `junit` / `lcov`（或 `cobertura`）里写出报告路径；
   - `commands.lint`：项目已经在用的检查器（survey.md 列出了 CI 里跑的命令和已有的配置文件），让它输出 SARIF；
     编译型语言再加一条编译器告警（见「工具链原则」第 2 条）；
   - `commands.arch`：项目生态里的模块依赖检查工具，连同它的规则文件一起起草：核心领域不依赖 IO，依赖只能指向更稳定的模块。
     生态里没有这类工具就不配，在档案里写明。
2. `node .gauntlet/gauntlet.mjs doctor` 必须全绿（每条命令的程序都存在、报告路径都已声明）。
3. 这些都是规则文件草稿：结果里写"规则文件草稿：需人工确认"。已经存在的配置和架构规则你**不能**修改；需要改就 NEED-HUMAN。

## 1 规格（Specifier）

场景按业务语言写即可。场景名要**唯一且稳定**——编码阶段的测试名要包含它。

## 2 编码（Coder）

- 用项目自己的测试框架（`GAUNTLET.md` 里写着）。
- **验收测试命名契约**：每个场景一个测试，测试名包含场景名，例如
  ```js
  test('补中奖励下一球', () => { /* 通过命令行入口 / 公开 API 驱动 */ });
  ```
  场景大纲的每一行 Examples 写一个测试，名字包含大纲名，按 Examples 顺序对应：
  ```js
  for (const [input, error] of invalid) test(`非法输入被拒绝 [输入=${input}]`, () => { /* ... */ });
  ```
  很多 BDD 框架默认就按场景名命名测试，项目已经在用的话可以直接用。
- 验收测试驱动应用边界（命令行入口函数、HTTP handler、公开 API），不测内部函数；内部细节交给单元测试。
- `node .gauntlet/gauntlet.mjs test` 的 `ACCEPTANCE` 一栏列出"没有对应测试"和"测试失败"的场景。
- 谦卑对象：真正的入口文件只转发参数，逻辑放进可测试的函数；
  入口文件不在 `sources` 里只能由人决定，你不能自己改 `sources` / `exclude`。

## 3 清理（Cleaner）

| 闸门 | 这个适配器下怎么过 |
|---|---|
| `scope` | 文件状态 `unsupported` = 内置分析器不认识这种语言：装 lizard（`pip install lizard`）后重跑；装不了就 NEED-HUMAN |
| `warnings` / `tidy` | 按告警 / SARIF 里的规则修；真正的误报才写进 `quality-accepted.json`（`kind` 用 `warning` / `tidy`，`check` 写 `工具名/规则 id`） |
| `arch` | 按架构工具的输出做依赖倒置；改规则文件需要人确认 |

- 内置复杂度分析器是启发式的（按大括号或缩进找函数）：如果 `static.json` 里的函数边界明显不对，
  在结果里说明并建议人类安装 lizard，不要为了迁就分析器扭曲代码。

## 4 加固（Hardener）

- 默认用内置变异引擎（认识 C 系语言、Python、Fortran）：对每个变异体运行 `commands.build`（如有）和测试命令。
  其他语言的文件内置引擎没法变异，闸门会**失败**并列出这些文件：请人配置外部变异工具（`commands.mutation`），不要绕过。
  测试慢时可以请人类配置更快的 `commands.mutationTest`（不带覆盖率和报告），你不能自己改。
- 变异算子：比较/算术/逻辑运算符（要求两边有空格）、`true/false`（Python `True/False`、`and/or`）、
  `++/--`、条件取反、整数常量 +1。
- 配了 `commands.mutation`（输出 mutation-testing-report-schema 报告的外部工具）时，`mutate` 运行该工具并读取它的报告；
  工具里被 `Ignored` 的变异体会作为"人工接受"列给人类审核。
- 入口文件的行为：给真实入口加一条冒烟测试（子进程执行，断言输出和退出码）。

## 5 QA / 6 证据包

- 真实产物就是项目平时的运行方式（`GAUNTLET.md`「构建、测试、运行」一节），QA 文档和 demo 脚本里写同样的命令。
- 架构图的 `boundaries` 用架构检查工具规则里的模块。

## 常见问题

| 现象 | 处理 |
|---|---|
| `commands.test.junit 未配置` / 测试命令没有产生 JUnit 报告 | 给测试命令加输出 JUnit 的参数，路径与 `junit` 一致（用 `{out}/junit.xml`） |
| `没有覆盖率报告` | 测试命令要输出 LCOV 或 Cobertura，并在 `lcov` / `cobertura` 写出路径 |
| 覆盖率里路径对不上（产品文件全是 0%） | 报告里的路径要能相对仓库根目录或命令的 `cwd` 解析；需要时给命令加 `cwd` |
| Windows 上命令参数里的单引号原样传进了程序 | 命令通过 cmd.exe 执行，引号用双引号 |
| 某个场景显示"没有对应的测试" | 测试名必须**包含**场景名（逐字一致，含标点）；大纲按 Examples 行数对应多个测试 |
