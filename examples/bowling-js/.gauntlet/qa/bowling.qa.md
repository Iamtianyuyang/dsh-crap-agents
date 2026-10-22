# QA：保龄球计分

前置：Node.js ≥ 22，无需安装依赖。程序入口 `bin/bowling.js`。

| # | 检查项 | 操作 | 期望结果 |
|---|---|---|---|
| 1 | 完美比赛 | `node bin/bowling.js 10 10 10 10 10 10 10 10 10 10 10 10` | 输出 `300`，退出码 0 |
| 2 | 全部补中 | `node bin/bowling.js 9 1 9 1 9 1 9 1 9 1 9 1 9 1 9 1 9 1 9 1 9` | 输出 `190`，退出码 0 |
| 3 | 比赛没打完 | `node bin/bowling.js 3 4` | stderr 含 `比赛还没有打完`，退出码 2 |
| 4 | 非数字 | `node bin/bowling.js 7 x` | stderr 含 `不是数字`，退出码 2 |
| 5 | 越界瓶数 | `node bin/bowling.js 10 11` | stderr 含 `非法的击倒数`，退出码 2 |
