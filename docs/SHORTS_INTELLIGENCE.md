# 板块空头

侧栏「板块空头」：关注 **半导体 / 电力 / AI落地** 相关标的的做空兴趣、借券与可核验空头报告。采集规则对齐人物/个股（X only，Grok App → Grok 网页；无 X API）。不足可以为 0，禁止凑数。遵守 `docs/DESIGN_SYSTEM.md` 与禁止截断规则。

## 导航位置

`美股讯息` → `宏观大事` → **`板块空头`** → `具体人物` → `具体个股` → `AI板块` → `加密` → `财报日历`

## Tabs

| id | 标签 | 窗口 |
|---|---|---|
| `semiconductor-shorts` | 半导体 | 近窗/周榜均滚动 7 天，各 ≤5 |
| `power-shorts` | 电力 | 同上 |
| `ai-adoption-shorts` | AI落地 | 同上 |

## 数据

- `config/shorts-intelligence.json`
- `data/shorts-intelligence.json`（`items[]` 字段同个股：eventKey/tabIds/title/fact/whyItMatters/counterCase/url…）

## 更新

2026-10-12已按用户要求停用。不再提供页面、手动更新队列或Agent采集入口；下述历史配置和数据仅保留在仓库，不部署公开资产。旧 `/shorts`、`/shorts.html` 跳转美股讯息，不构成恢复采集授权。
