# 宏观大事（美股宏观日程）

侧栏「宏观大事」页：美股相关宏观日历，**不是加密主线**，**不跟**每日 09:00 / 16:00 / 21:00 简报任务。

## 导航位置

`美股讯息` → **`宏观大事`** → `具体人物` → `具体个股` → `AI板块` → `加密` → `财报日历`

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

可选的「巨头财报扎堆周」本次跳过（易与财报日历重复且噪声大）。

## 展示

- 全年 **四个季度** Tab（1–4 季度），按日分组卡片。
- 字段：类别、标题、说明、美东时间、对应参考期、北京时间对照日、可点击来源链接。
- 遵守 `docs/DESIGN_SYSTEM.md` 与禁止截断规则。

## 刷新方式（低频）

1. 对照官方日历核对或增补 `data/macro-events.json`（可同步 `config/macro-events.json` 的类别/遗漏说明）。
2. `npm run macro:refresh` — 仅校验结构与统计，**不会抓网或编造日期**。
3. `npm test && npm run check && npm run build`
4. commit + push master。

**不要**把本页加入 `updates.js` / `server/updates.mjs` 的简报任务 `PAGES` 列表。

## 数据文件

- `config/macro-events.json` — 类别、刷新策略、遗漏说明、来源目录
- `data/macro-events.json` — 按季度展开的事件列表
