# 宏观大事（美股宏观日程）

侧栏「宏观大事」页：美股相关宏观日历，**不是加密主线**，**不跟**每日 08:00 / 15:00 / 20:30 简报任务。

## 导航位置

侧栏八页顺序以 CONTEXT.md 为准，本页紧随美股讯息。内容低频维护由Grok Bot负责，GPT只维护功能。

## 事件类别

| 类别 id | 中文标签 | 来源 |
|---|---|---|
| `fomc` | FOMC 利率决议 | Fed FOMC calendars |
| `fomc-minutes` | FOMC 会议纪要 | Fed 所列 Released 日期（未列则不编造） |
| `cpi` | CPI | BLS CPI schedule |
| `pce` | PCE（个人收入与支出） | BEA release schedule |
| `nfp` | 非农就业 / Employment Situation | BLS |
| `opex` | 期权到期 / 三重魔女 | 季月第三周五惯例；假日顺延注明 |
| `rebalance` | 季度末再平衡 | 结构日说明 |
| `13f` | 13F 披露截止 | SEC Form 13F FAQ |
| `election` | 选举 | 中期选举规则日；总统大选不在本年则不列 |
| `fiscal` | 债务上限 / 停摆 | **仅有明确公开日期时**才收录 |

「超关注财报」仅同步本站财报日历窗口内已有日期的精选标的；窗口外巨头日期不编造，亦不 dump 全市场。

## 展示

- 全年 **四个季度** Tab（1–4 季度），按日分组卡片。
- 字段：类别、标题、说明、美东时间、对应参考期、北京时间对照日、可点击来源链接。
- 遵守 `docs/DESIGN_SYSTEM.md` 与禁止截断规则。

## 刷新方式（低频）

1. 对照官方日历核对或增补 `data/macro-events.json`（可同步 `config/macro-events.json` 的类别/遗漏说明）。
2. `npm run macro:refresh` — 仅校验结构与统计，**不会抓网或编造日期**。
3. `npm test && npm run check && npm run build`
4. commit + push master。

本页维持独立低频规则，不并入美股简报的三个日常批次；网页不提供手动更新队列。

## 数据文件

- `config/macro-events.json` — 类别、刷新策略、遗漏说明、来源目录
- `data/macro-events.json` — 按季度展开的事件列表
