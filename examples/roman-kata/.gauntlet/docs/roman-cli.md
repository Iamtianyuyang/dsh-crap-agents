# roman 命令行：阿拉伯数字 ⇄ 罗马数字

## 它能做什么

- 把 1 到 3999 之间的整数转成**规范**的罗马数字
- 把规范的罗马数字转回整数
- 一次可以传多个参数，数字和罗马数字可以混着写

## 三步上手

1. 构建：`cmake -S . -B build -G Ninja && cmake --build build`
2. 转换：`build/roman 2026` 输出 `MMXXVI`
3. 反向：`build/roman MCMXCIV` 输出 `1994`

## 输入规则

| 输入 | 结果 | 退出码 |
|---|---|---|
| `1994` | `MCMXCIV` | 0 |
| `MMXXVI` | `2026` | 0 |
| `0`、`4000` | `error: ... out of range (1..3999)` | 2 |
| `IIII`、`IC`、`abc` | `error: '...' is not a valid Roman numeral` | 2 |

> 只接受规范写法：`IIII` 必须写成 `IV`，`IC` 必须写成 `XCIX`。小写字母不被接受。

## 在脚本里使用

```bash
year=$(build/roman 2026) || echo "转换失败"
```

只要有任何一个参数非法，退出码就是 2，但其余合法参数仍会正常输出。
