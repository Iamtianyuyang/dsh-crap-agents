# QA：罗马数字转换

前置：`node ../../kit/gauntlet.mjs test` 构建，可执行文件在 `build-gauntlet/roman`

| # | 检查项 | 操作 | 期望结果 |
|---|---|---|---|
| 1 | 年份转罗马数字 | `build-gauntlet/roman 2026` | 输出 `MMXXVI`，退出码 0 |
| 2 | 罗马数字转年份 | `build-gauntlet/roman MCMXCIV` | 输出 `1994`，退出码 0 |
| 3 | 混合参数 | `build-gauntlet/roman 7 XLII` | 两行 `VII`、`42` |
| 4 | 非规范写法被拒绝 | `build-gauntlet/roman IIII` | stderr 含 `not a valid Roman numeral`，退出码 2 |
| 5 | 超范围被拒绝 | `build-gauntlet/roman 4000` | stderr 含 `out of range`，退出码 2 |
| 6 | 空参数不崩溃 | `build-gauntlet/roman ""` | 报错，退出码 2 |
