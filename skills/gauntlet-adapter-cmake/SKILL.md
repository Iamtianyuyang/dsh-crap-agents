---
name: gauntlet-adapter-cmake
description: Gauntlet 工具链片段——只在目标仓库 gauntlet.config.json 的 adapter 是 "cmake-clang" 时使用（可选的深度分析：项目本来就用 CMake 构建、clang 能原样编译）：CMake + clang 的 C/C++/CUDA 项目里每个阶段具体怎么做（init、architecture.json、GT_STEP 步骤定义、CMake 骨架、clang 静态分析与 clang-tidy、CUDA、常见本机问题）。
---

# cmake-clang 适配器（C/C++/CUDA）

阶段技能讲"做什么"，本技能讲在 CMake + clang 项目里"用什么做"。只读你所在阶段的那一节。

工具链（`node .gauntlet/gauntlet.mjs doctor` 检查）：必需 cmake ≥ 3.21、ninja、clang、llvm-profdata、llvm-cov、git、node；
建议 clang-tidy；CUDA 项目需要 nvcc。缺工具按 NEED-HUMAN 报告，写清缺什么。

| 闸门 | 这个适配器怎么量 |
|---|---|
| `test` | 生成验收测试（C++ 场景表 + CTest 注册）+ clang 覆盖率插桩构建 + ctest + `llvm-cov export` |
| `static` | clang 解析**每个**产品编译单元（含 `.cu`）：圈复杂度/长度/嵌套/参数、`-Wall -Wextra` 告警、没被解析到的文件 |
| `tidy` | clang-tidy：bugprone / performance / clang 静态分析器 |
| `cppcheck` | cppcheck（装了就运行，`cppcheck.mode`）：未初始化、越界、资源泄漏等，和 clang-tidy 互补 |
| `sanitize` | 另建 `<buildDir>-asan`，用 ASan + UBSan 编译并跑全部测试；有 CUDA 时用 compute-sanitizer（PATH 或 CUDA 安装目录里找）跑每个测试 |
| `crap` / `coverage` | llvm-cov 的分支和区域数据，只对能插桩的函数（nvcc 编译的 CUDA 不能插桩） |
| `arch` | 按 `architecture.json` 检查 `#include` 依赖方向、环、解析不了的项目 include |
| `mutate` | 内置引擎：改一个符号 → 增量构建 → ctest；CUDA 文件也会被真实变异 |

## 0 摸底（Surveyor）

```
node .gauntlet/gauntlet.mjs init                 # 需求要求中间文件放在 tmp 时：init --workdir tmp
```

- 生成 `gauntlet.config.json`、`architecture.json`（模板）、`features/`、`acceptance/steps/`。
- 把 `architecture.json` 改成符合本项目的模块划分：**每个产品代码目录都必须属于某个模块**，
  `includeRoots` 要包含所有头文件目录，否则架构检查会因"无法解析的 include"失败。结果里写"规则文件草稿：需人工确认"。
- 项目还没有 CMakeLists.txt：不用写，交给编码阶段。

```json
{
  "modules": {
    "domain": { "paths": ["src/domain/**"], "mayDependOn": [] },
    "app":    { "paths": ["src/app/**"],    "mayDependOn": ["domain"] }
  },
  "includeRoots": ["src", "include"], "forbidCycles": true, "strict": true
}
```

已经存在的 `architecture.json` 你**不能**修改；如果需求必须改架构，用 `NEED-HUMAN` 提出来。

## 1 规格（Specifier）

场景参数写法要方便复用步骤定义：数字直接写，字符串用双引号 `"..."`。
步骤定义支持的占位：`{int}` `{float}` `{word}` `{string}`（双引号字符串）`{}`。

## 2 编码（Coder）

1. `node .gauntlet/gauntlet.mjs spec` 列出未定义步骤，并给出 `GT_STEP("...")` 建议。
2. 没有 CMake 工程就先搭骨架（见下）。
3. 步骤定义写在 `acceptance/steps/<主题>_steps.cpp`。单元测试用项目**已有的**测试框架、放在项目约定的位置（`GAUNTLET.md` 里写着）。
   Gauntlet 只要求测试注册到 CTest（`add_test()` 或所用框架的发现命令）：它读 CTest 的 JUnit 报告，不依赖任何测试框架。

### 步骤定义写法

```cpp
#include "gauntlet_acceptance.hpp"
#include "app/cli.h"              // 驱动"应用边界"，不要直接测内部细节

namespace { struct Run { std::vector<std::string> args; std::string out; int code = -1; }; }

GT_STEP("我输入 {string}")   { ctx.get<Run>("run").args = {args.s(0)}; }
GT_STEP("我执行转换")        { auto& r = ctx.get<Run>("run"); /* 调用被测系统 */ }
GT_STEP("输出应为 {string}") { GT_EXPECT_EQ(ctx.get<Run>("run").out, args.s(0)); }
GT_STEP("输出应为:")         { GT_EXPECT_EQ(ctx.get<Run>("run").out, args.doc_string); }
```

- `ctx.get<T>("key")`：本场景内共享的状态（每个场景全新）。
- `args.s(i)` / `args.i(i)` / `args.d(i)`：第 i 个捕获参数；`args.doc_string`；`args.table`。
- 断言：`GT_EXPECT(cond)`、`GT_EXPECT_EQ(actual, expected)`、`GT_EXPECT_THROWS(expr)`、`GT_FAIL("msg")`。
- 一个步骤文本只能匹配一个定义（歧义会报错）。

### CMake 骨架（还没有工程的新项目）

```cmake
cmake_minimum_required(VERSION 3.21)
project(myapp CXX)
set(CMAKE_CXX_STANDARD 17)
include(.gauntlet/cmake/Gauntlet.cmake)

add_library(myapp_domain src/domain/xxx.cpp)
target_include_directories(myapp_domain PUBLIC src)
add_library(myapp_app src/app/cli.cpp)
target_link_libraries(myapp_app PUBLIC myapp_domain)
add_executable(myapp src/app/main.cpp)          # 谦卑的 main：只转发 argv
target_link_libraries(myapp PRIVATE myapp_app)

# 单元测试：项目已有测试框架就用它；没有时最简单的是零依赖的测试程序（返回非 0 = 失败），
# 每个测试程序一条 add_test，失败时 CTest 报告里能看到是哪一个。
add_executable(unit_domain tests/unit/domain_test.cpp)
target_link_libraries(unit_domain PRIVATE myapp_domain)
add_test(NAME unit.domain COMMAND unit_domain)

gauntlet_add_acceptance(LINK myapp_app)
```

- **测试框架**：项目还没有测试时，优先用本机已经装好的框架（survey.md / `GAUNTLET.md` 里能看到），
  并用它的 CTest 发现命令按用例注册，失败信息更细。需要联网下载的依赖（`FetchContent` 等）在离线服务器上会让构建失败，
  而且是新增依赖：属于规则改动，写进结果（`rules: changed`）由人确认。
- 行为参数注入 `std::ostream&`、时钟、文件系统接口；头文件只放声明；不要把逻辑塞进宏。

## 3 清理（Cleaner）

| 闸门 | 这个适配器下怎么过 |
|---|---|
| `scope` | 解析失败：修编译参数（`static.extraArgs` / `static.cudaPath`，写进 `gauntlet.local.json`）；"未参与构建"的源文件：要么接进构建，要么确实是死代码就删掉；都做不到就 NEED-HUMAN |
| `warnings` | `-Wall -Wextra` 告警修掉，不要用 pragma 压掉 |
| `tidy` / `cppcheck` | 按提示修；误报写进 `quality-accepted.json`（`kind` 用 `tidy` / `cppcheck`） |
| `arch` | 依赖倒置；补全 `includeRoots` 需要人确认 |

- CUDA kernel 同样被量：把 kernel 里的分支拆成 `__device__` 函数。
- CPU/GPU 合并类任务：共享逻辑抽到共享模块，后端只保留真正不同的部分（CPU 循环 vs CUDA kernel）；
  新模块要写进 `architecture.json`，用 NEED-HUMAN 请人确认模块划分。
- 例外示例（`quality-accepted.json`）：
  ```json
  [
    { "kind": "tidy", "file": "gpu/src/x.cu", "check": "clang-analyzer-core.NullDereference", "reason": "d_buf 在第 40 行由 cudaMalloc 成功分配后才进入该分支，分析器不理解 CUDA API 的返回约定" },
    { "kind": "unbuilt", "file": "cpu/src/fd_mpi.c", "reason": "MPI 版本，服务器无 mpicc，人类已确认本次不构建" }
  ]
  ```

## 4 加固（Hardener）

- `mutate --files cpu/src/x.c,gpu/src/y.cu` 可以只重跑相关文件；**最后一次必须是不带 `--files` 的完整运行**。
- 无法插桩的代码（nvcc 编译的 CUDA）也会被真实变异和测试；它们的存活者往往说明 GPU 路径没有测试。
- 程序入口（main）的存活者：给真实可执行文件加 CTest 冒烟测试
  （`add_test(NAME ... COMMAND <exe> <参数>)` + `PASS_REGULAR_EXPRESSION`），不要把 main 排除掉。

- sanitizer 构建在 Windows 上用 release CRT 和 DLL 版 sanitizer 运行时（clang 的 ASan 不支持 debug CRT）；
  报告"sanitizer 运行时在这台机器上不可用"一般是 LLVM 比操作系统旧：记进结果和 `GAUNTLET.md` 的「坑」，不算失败。

## 5 QA / 6 证据包

- 真实产物在 `buildDir`（默认 `build-gauntlet/`）里，由 `node .gauntlet/gauntlet.mjs test` 构建。
- demo 脚本和 QA 文档里的命令写 `build-gauntlet/<app> ...`（`--workdir tmp` 时是 `tmp/build-gauntlet/<app>`）。
- 架构图的 `boundaries` 用 `architecture.json` 里的模块。

## 常见问题

| 现象 | 处理 |
|---|---|
| `undefined: ...` | 步骤没有定义，或措辞不完全一致（注意中英文标点、空格） |
| `ambiguous step` | 两个 `GT_STEP` 模式都能匹配，收紧其中一个 |
| clang 报 STL 版本不匹配 | 本机问题：在 `gauntlet.local.json` 加 `-D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH`，并在结果里注明；不要改 CMakeLists |
| 没有 `.profraw` | 测试没有通过 CTest 注册：检查 `add_test()`（或所用框架的发现命令）和 `gauntlet_add_acceptance` |
