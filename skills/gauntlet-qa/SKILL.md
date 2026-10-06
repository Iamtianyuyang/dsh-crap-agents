---
name: gauntlet-qa
description: Gauntlet 第 5 阶段（QA）：按 qa/*.qa.md 在真实构建产物上逐条执行检查，记录确定性的 pass/fail 报告 qa/qa-report.json（提交到分支），并编写可回放的演示脚本 demo/*.json。
---

# QA 阶段

验收测试在进程内验证行为；你验证**真正交付的东西**能用——真实的可执行文件、真实的输入输出、
真实的退出码。你不修改任何产品代码或测试。

## 步骤

1. 读任务、切分支（gauntlet-core）。
2. 构建：`node .gauntlet/gauntlet.mjs test`。真实产物在哪、怎么运行见适配器技能「5 QA」一节。
3. 打开 `qa/*.qa.md`，**逐条真实执行**，把实际结果原样记下来。
4. **逐条证实 `qa/constraints.json` 里的需求约束**（见下文）。每条约束至少一条检查，检查里写 `"constraint": "C1"`。
5. 需要与原程序等价时（`gauntlet.config.json` 里 `requireEquivalence: true`，或 QA 文档写了对比计划），
   做黄金样本对比（见下文），结果记录在 `qa/equivalence.json`。
6. 写 `qa/qa-report.json`（格式见下，**提交到分支**——下一阶段在另一个工作区运行，只能拿到提交过的文件）。
   只要有一条不符合期望，`verdict` 就是 `fail`。
7. 写演示脚本 `demo/<主题>.json`（会被提交到仓库，证据包阶段用它录制演示），并试跑：
   `node .gauntlet/gauntlet.mjs demo demo/<主题>.json`
8. 收尾（gauntlet-core 第 6 节）：
   - 全部通过 → PASS
   - 有失败 → FAIL，summary 写清哪几条不符合、实际看到了什么，Leader 会安排回到编码阶段返工
   - 有约束无法验证（服务器连不上、缺工具……）→ NEED-HUMAN。**不能**写"本次不验证/超出范围"后判 PASS。

## qa.json 格式

```json
{
  "verdict": "pass",
  "summary": "一句话结论",
  "environment": { "hosts": ["node03 / 172.19.133.164"], "commit": "<完整 sha>", "workdir": "..." },
  "checks": [
    { "id": "Q1", "title": "年份转罗马数字", "action": "roman 2026",
      "expected": "MMXXVI, exit 0", "actual": "MMXXVI, exit 0", "status": "pass", "constraint": "C1" }
  ]
}
```

`actual` 必须是你真实看到的输出（可以截断），不能照抄 `expected`。一条检查证实多条约束时写数组 `"constraint": ["C1", "C3"]`。

## 证实需求约束

- **多台服务器**：在每一台上分别构建并跑全部测试，`actual` 里写主机名（`hostname`）和结果。一台一条检查。
- **只能写某个目录**：运行程序前 `node .gauntlet/gauntlet.mjs leak-check --mark`，运行后 `node .gauntlet/gauntlet.mjs leak-check`
  （默认查临时目录和家目录，仓库自身不算；需要时 `--roots` 指定位置），`LEAK-CHECK: PASS` 才算通过。
  与被测程序无关的系统噪声（浏览器缓存等）可以 `--ignore` 掉，但要在 `actual` 里逐条写明忽略了什么、为什么。
- **中间文件放 tmp**：`git status --porcelain --ignored` 里，除了 `tmp/` 之外不应出现新的忽略文件或未跟踪文件。

## 与原程序等价（黄金样本对比）

1. 在工作目录里取出基线版本并构建，例如：
   `git worktree add tmp/baseline <基线commit>`，然后按原项目的方式在 `tmp/baseline` 里构建原程序。
2. 用同一份输入，分别运行原程序和新程序，每个用例输出到 `tmp/equiv/<用例>/{old,new}/`。
   用例矩阵按 QA 文档：每个方法 × 每个后端 × 至少两种规模。
3. 对每一个输出文件比较并记录：
   ```
   node .gauntlet/gauntlet.mjs compare tmp/equiv/stencil-cpu/old/snap.bin tmp/equiv/stencil-cpu/new/snap.bin --dtype f32 --header 0 --frame 2097152 --tol 1e-6 --name "stencil · cpu · 128³ · snapshot" --record qa/equivalence.json
   ```
   能逐位一致的用 `--exact`。NaN/Inf 位置不一致一律判失败。
   **文本输出**（日志、CSV、JSON、打印的表格……）用 `--text`：逐行比较，文字必须一致（忽略空白），
   每个数字按数值比较（默认必须相等，`1.0` 和 `1.00`、`1.0D+00` 算相等；需要容差时写 `--tol <相对误差>` / `--atol <绝对误差>` 并说明理由）：
   ```
   node .gauntlet/gauntlet.mjs compare tmp/equiv/case1/old/out.csv tmp/equiv/case1/new/out.csv --text --name "case1 · 输出表" --record qa/equivalence.json
   ```
4. `qa/equivalence.json` 提交到分支；证据包会把每一项画成表格和误差柱状图。

## 演示脚本格式（demo/<主题>.json）

```json
{
  "title": "roman：阿拉伯数字 ⇄ 罗马数字",
  "cwd": "..",
  "steps": [
    { "say": "把今年转成罗马数字" },
    { "run": "roman 2026" },
    { "say": "非法输入会报错，退出码 2" },
    { "run": "roman IIII", "expectCode": 2 }
  ]
}
```

- `cwd` 相对于脚本文件所在目录（脚本放在 `demo/`，所以 `".."` 就是仓库根目录）。
- 命令在 POSIX shell 里执行（Windows 上自动用 Git Bash），路径用 `/`。
- 演示要讲一个**用户故事**：先展示最常用的用法，再展示一个错误处理。3~6 条命令足够。

## GUI / 非命令行项目

如果交付物是图形界面或服务：
- 能用命令行驱动的部分（`--help`、无头模式、HTTP 接口用 `curl`）仍写进 demo 脚本；
- 能截图就截图，把 PNG 放进 `qa/media/` 并提交（证据包会自动嵌入），在 qa.json 的 check 里写上文件名。
