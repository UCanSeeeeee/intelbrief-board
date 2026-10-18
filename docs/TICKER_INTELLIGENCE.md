# 具体个股情报

记录日期：2026-10-12（修订：加密已拆至侧栏「加密」）。

## 信息来源

先走已登录Grok网页版；网页不可用或覆盖不足且额度可用时才尝试Grok Bot。禁止 X API / 普通网页搜讯；本页必须作为独立侧边栏批次采集。

## 当前顶部 Tab（仅美股股权）

NVDA、MU、INTC、GOOG、AVGO、VRT、TSM。

**不含** BTC、Brew 或任何加密资产；加密见 [`CRYPTO_INTELLIGENCE.md`](./CRYPTO_INTELLIGENCE.md)。

## 窗口与条数

对齐人物个人 Tab：近 24 小时最多 5 条；近 7 天重点榜最多 5 条；可为 0。

## 配置与数据

- `config/ticker-intelligence.json` / `data/ticker-intelligence.json`
- 前台：`tickers.html` / `tickers.js`
- 更新任务 page：`tickers`

## 滚动周榜保留（2026-10-15）

采集返回的 `items` 应是完整滚动快照。执行器合并规则：

1. 某标的本窗确无新事实、`items` 不含该 Tab → 保留仍在 `weeklyWindowDays` 内且带 `weeklyRanks`（或仍在 latest 窗）的旧条目。
2. 某标的本窗有新帖 → 仍保留未重复的旧重点榜条目；若旧排名与新帖冲突，顺延到空位（不超过 `weeklyLimit`）。
3. 禁止用空数组整体覆盖，禁止编造帖子凑数。

同一逻辑也用于人物页与 AI 板块。
