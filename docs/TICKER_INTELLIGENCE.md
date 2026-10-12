# 具体个股情报

记录日期：2026-10-12。侧栏「具体个股」置于「具体人物」与「财报日历」之间；规则对齐具体人物的个人 Tab。

## 信息来源（与人物页相同）

只走 Grok Bot App「X+github」公开 X 检索；失败才用 Grok 网页版。禁止 X API、直接刷 X、普通网页搜讯。Grok 返回一律 `collector-report`，不得声称独立直读。

## 当前顶部 Tab

股权：NVDA、MU、INTC、GOOG、AVGO、VRT、TSM。

加密（非 Nasdaq 股票，UI/配置与股权 Tab 并列）：

- **BTC**：cashtag `$BTC` / Bitcoin 关键词；`assetClass: crypto`。
- **Brew**：代币名 Brew / `$BREW`，并允许按合约地址 `0xfa6d9b504848606eb9aec04ccc161d169b3f2159` 检索；`assetClass: crypto-token`。合约地址只作检索与核验线索，不得编造链上余额或成交数据。

## 窗口与条数

与人物个人 Tab 一致：

1. **新增价值区**：滚动约 24 小时，最多 5 条，可为 0。
2. **重点榜**：滚动 7 天，最多 5 条，不足保留实际数量。

同一事件一份数据；跨区去重逻辑与人物页相同。

## 入选门槛

- 真实 X status 链接、作者、准确时间、可核对正文。
- 相对已有记录的新增事实（产品、供需、客户、监管、资金流、规格等）。
- 能写清传导（半导体 / 电力 / AI 落地，或加密监管与宏观对风险资产的传导）。
- 排除纯喊单、无假设变化的目标价刷屏、促销重复帖。

## 配置与数据

- `config/ticker-intelligence.json`：Tab、cashtag、官方账号、Brew 合约地址、窗口与上限。
- `data/ticker-intelligence.json`：入选事件与各 Tab 覆盖说明。
- 前台：`tickers.html` / `tickers.js`。

## 采集

手动「更新本页」或「全部更新」会提交 `tickers` 任务；提示词见 `scripts/lib/update-prompt.js`。执行器校验复用与人物页相同的 Tab 情报 schema（`prepareTickerIntelligence`）。
