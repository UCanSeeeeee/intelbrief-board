# 加密情报

记录日期：2026-10-12。侧栏「加密」位于「具体个股」与「财报日历」之间，**与美股股权个股完全分开**。

## 信息来源

与美股讯息 / 具体人物 / 具体个股相同：只走 Grok Bot App「X+github」；失败才用 Grok 网页版。禁止 X API、直接刷 X、普通网页搜讯。Grok 返回一律 `collector-report`。

## 顶部 Tab（固定顺序）

1. **加密板块讯息**（`crypto-board`，合集）  
   板块级监管、ETF/资金流、宏观与风险偏好、基础设施等。UI 与人物/个股事件卡相同，**不是**美股 5+10 简报。**最新区与重点榜均为滚动 7 天**（最新区最多 10 条，重点榜最多 5 条）。

2. **BTC**（`btc`）  
   `$BTC` / Bitcoin；**最新区与重点榜均为滚动 7 天**（各最多 5 条）。

3. **Brew**（`brew`）  
   加密代币（非 Nasdaq）。检索 Brew / `$BREW` / 合约 `0xfa6d9b504848606eb9aec04ccc161d169b3f2159`。合约只作检索线索，不得编造链上数据。**最新区与重点榜均为滚动 7 天**（各最多 5 条），宽于 BTC 的 24h 最新区，便于观察是否有达标内容。

## 配置与数据

- `config/crypto-intelligence.json` / `data/crypto-intelligence.json`
- 前台：`crypto.html` / `crypto.js`
- 更新任务 page 标识：`crypto`（不得写入 `tickers` 任务）

## 与「具体个股」边界

`tickers` 仅 NVDA/MU/INTC/GOOG/AVGO/VRT/TSM。任何加密概念不得进入股权个股配置或采集提示。
