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

每只配置股票额外提供「X热点 · 非官方」，与价值区是否有信息无关；24h样本最多5条帖子，不挤占价值名额、不进入周榜。直接让Grok按浏览量返回前五，不先按基本面新事实、产业主题或官方作者过滤普通观点。剔除纯广告、无内容转推；观点与传闻保留归因和未证实处。按原帖URL去重，同一话题的不同帖子可保留；原价值区事件去重不变。

由Grok完成检索与浏览量排序；项目按真实views降序保留和合并，同浏览量仅按发帖时间、URL稳定排列，不按点赞重排。缺views的候选进入未排名审计，不补零、不估算、不用Top搜索位置冒充浏览量；无法完成排名记partial与缺口，不写成没有热点。保存原文/明确标注截断的摘录、作者、URL、准确发帖时间、事件时间/未知、浏览量和真实观察时刻。`capturedAt`是本机读取Grok结果的时刻，不是假称X工具提供的抓取时间。只称已检索样本排名，不保证全X前五；热度不证明事实或涨跌。

可见浏览量大于0的帖子标“非官方 · 讨论热点”；真实零浏览或旧缺浏览量卡保留为讨论线索，不补造热度。跨板块原帖重复按AGENTS保留，不作为缺陷。

仍是一个tickers侧边栏批次。直接指令模板：“在【对象增量起止，含时区】内，用【$NVDA等股票代码】返回按浏览量降序的前五条X帖子，附作者、原文、中文摘要、发布时间、完整原帖链接、views和缺口。”Google同时覆盖`$GOOG`与`$GOOGL`。不由执行器设计多轮Top/Latest、分时段或主题词搜索，不把每股候选限制为1条；具体检索由Grok完成。字段缺失或明显错误只做针对性修正，不重启整套发现流程。

事实对象`tickers:<id>`与热点对象`tickers:<id>:hotspots`独立接续。首次24h，后续严格增量并合并24h存量；查询完成、排名可用、发布成功分别记录。需要比较存量时可让Grok重读指定已收录原帖的views，不重新宽搜旧时间窗。2026-10-23用户授权按新规则补采，单独记录24h补查范围与正常08:00后的增量，不把补查误标为增量。审计`output.hotspots`保存后才推进热点游标。

- 标准返回`tabs/items`及独立`hotspotTabs/hotspots`，`prepareTickerIntelligence`合并两流。缺少热点载荷记失败缺口并保留旧热点，不写成无新增。
- 直接热帖保留作者、中文摘要、真实浏览量与原帖；没有额外分析不填通用“影响判断”或免责声明占位，已写的有意义分析仍可保留。保存的紧凑排名可用`node scripts/import-ticker-hotspot-ranking.js SOURCE.json AUDIT.json OUTPUT.json`转换为发布载荷；只转换已保存证据，不搜索或发布。
- 仅补采热点可运行`node scripts/publish-ticker-hotspots.js <已保存的结果JSON>`；不触碰事实区或其截止，随后按增量SOP记录热点进度并统一提交。
- 明确授权完整24h补查时，`hotspotSnapshot:true`使成功股票采用本次Grok榜单，不混入旧候选；必须覆盖全部展示窗口，失败/部分完成仍保留旧候选，换出帖子继续留存。正常增量不启用此开关。
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
