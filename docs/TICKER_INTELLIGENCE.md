# 具体个股情报

配置真源：`config/ticker-intelligence.json`；数据：`data/ticker-intelligence.json`；前台：`tickers.html` / `tickers.js`。

## 信息来源

先走已登录Grok网页版；网页不可用或覆盖不足且额度可用时才尝试Grok Bot。禁止 X API / 普通网页搜讯；本页必须作为独立侧边栏批次采集。

## 当前顶部 Tab（仅美股股权）

NVDA、MU、INTC、GOOG、AVGO、VRT、TSM。

**不含** BTC、Brew 或任何加密资产；加密见 [`CRYPTO_INTELLIGENCE.md`](./CRYPTO_INTELLIGENCE.md)。

## 窗口与条数

对齐人物个人 Tab：近 24 小时最多 5 条；近 7 天重点榜最多 5 条；可为 0。

## 独立X热点（所有股票）

每只配置股票额外提供「X热点 · 非官方」，与价值区是否有信息无关；24h样本最多3个不同事件，不挤占价值名额、不进入周榜。以后新增股票自动适用。允许有具体内容的观点/传闻，保留归因与未证实处；排除空洞喊单、晒持仓、引流广告和无实质内容的传闻，不能凑数。原价值区里的媒体信息不都等于公司公告，不统一改标“官方”。

按实际样本可见likes降序，并列比较reposts、replies，再按发帖时间；缺项为null、零为0，不估算、不混成分数，不宣称全X前三。保存原文/明确标注截断的摘录、作者、URL、准确发帖时间、事件时间/未知、互动和真实观察时刻。`capturedAt`是本机读取Grok结果的时刻，不是假称X工具提供的抓取时间。热度不证明事实或涨跌。

赞、转发、回复均无正数时，卡片标“非官方 · 讨论线索”，不标热门；真实零值与原始证据保留，不补造热度阈值。跨板块原帖重复按AGENTS保留，不作为缺陷。

仍是一个tickers侧边栏批次。宽搜公司/cashtag，样本低质可在同一窗口补一次产业主题Top查询，不无限重试。事实对象`tickers:<id>`与热点对象`tickers:<id>:hotspots`共用进度文件但独立接续；新热点不沿用旧事实成功游标。首次24h，后续严格增量并合并24h存量；查询完成、入选数、发布成功分别记录。审计`output.hotspots`保存后才推进热点游标。

- 标准返回`tabs/items`及独立`hotspotTabs/hotspots`，`prepareTickerIntelligence`合并两流。缺少热点载荷记失败缺口并保留旧热点，不写成无新增。
- 仅补采热点可运行`node scripts/publish-ticker-hotspots.js <已保存的结果JSON>`；不触碰事实区或其截止，随后按增量SOP记录热点进度并统一提交。
- 数据`hotspots`存当前精选，`hotspotRetained`保留7天内被换出的已展示卡供每日流；原始审计不删。`hotspotCoverage.tabs`区分complete/partial/failed；失败保留上次成功截止和内容。
- 进入[每日更新](DAILY_UPDATES.md)的新卡保存`firstIncludedAt`，摘要/影响等实质变化保存`lastMaterialAt`；互动增长、重排、检查时间不算新内容。旧数据不补造收录时间。

## 空白原因的已核实样本

2026-10-21早间INTC、GOOG、AVGO、VRT的已发布items确为0，并非前端隐藏。当天08:00审计中发现检索分别返回5、5、4、4条，但旧流程仅收新增可追源事实；INTC客户传闻未确认，其余无达标新增。这只解释已保存样本，不证明公司或X全平台没有消息。证据：`data/collection-runs/2026-10-21-0800.json`。

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
