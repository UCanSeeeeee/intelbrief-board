# 具体个股情报

配置真源：`config/ticker-intelligence.json`；数据：`data/ticker-intelligence.json`；前台：`tickers.html` / `tickers.js`。

## 信息来源

先走Grok Bot「X+github」；Bot不可用、额度不足或覆盖不足时使用已登录Grok网页版Expert。禁止 X API / 普通网页搜讯；本页必须作为独立侧边栏批次采集。

## 当前顶部 Tab（仅美股股权）

NVDA、MU、INTC、GOOG、AVGO、VRT、TSM。

**不含** BTC、Brew 或任何加密资产；加密见 [`CRYPTO_INTELLIGENCE.md`](./CRYPTO_INTELLIGENCE.md)。

## 窗口与条数

对齐人物个人 Tab：近 24 小时最多 5 条；近 7 天重点榜最多 5 条；可为 0。

## 独立X热点（所有股票）

每只配置股票额外提供「X热点 · 非官方」，与价值区是否有信息无关；每次查询该股上次成功截止至本轮实际截止之间发布的帖子，按浏览量取前五，不挤占价值名额、不进入周榜。首次无进度才回查24小时。检索关键词只有股票代码名字（如NVDA，不额外附加公司名或产业主题；GOOG同时覆盖GOOGL）。MU、VRT、TSM使用`$MU`、`$VRT`、`$TSM`证券标记避免其他语言或机构同名，只明确股票对象，不增加内容筛选。不加账号、官方身份、观点、新增事实、广告或转发类型筛选；同一原帖URL只展示一次，同话题的不同帖子可以入榜。原价值区规则不变。

由Grok完成检索与浏览量排序；项目按真实views降序保留和合并，同浏览量仅按发帖时间、URL稳定排列，不按点赞重排。缺views的候选进入未排名审计，不补零、不估算、不用Top搜索位置冒充浏览量；无法完成排名记partial与缺口，不写成没有热点。保存原文/明确标注截断的摘录、作者、URL、准确发帖时间、事件时间/未知、浏览量和真实观察时刻。`capturedAt`是本机读取Grok结果的时刻，不是假称X工具提供的抓取时间。只称已检索样本排名，不保证全X前五；热度不证明事实或涨跌。

可见浏览量大于0的帖子标“非官方 · 讨论热点”；真实零浏览或旧缺浏览量卡保留为讨论线索，不补造热度。跨板块原帖重复按AGENTS保留，不作为缺陷。

仍是一个tickers侧边栏批次，但**热点与事实分开发送，每股一个独立会话**；优先Bot，网页备用时用Expert。唯一提示词真源为`scripts/lib/ticker-hotspot-prompt.js`，`collection:plan`直接列出`hotspotPrompts`：

> 给我发布时间从【该股上次成功截止，含】至【本轮实际截止，不含】的、包含“NVDA”的浏览量最高五个X帖子。除关键词和时间外不加其他筛选。附作者、发帖时间、浏览量、原文摘录、中文摘要和原帖链接。

不得把知识库、价值筛选、七股事实任务或JSON契约附加到该问题。Grok自行搜索比较，读取后由本机整理发布字段；不由执行器设计多轮Top/Latest、分时段或主题词搜索，不按点赞重排。发现已知漏帖、时间错误、浏览量矛盾或字段缺失时做针对性核对，不能把有明确遗漏的初答标成完整榜单；不人为设浏览量最低值，不保证全X最高五帖。

事实对象`tickers:<id>`和热点对象`tickers:<id>:hotspots`各自严格增量；榜单只比较本次全窗返回的浏览量，不混用旧帖过时浏览量。查询完成、榜单可用、发布成功分别记录；热点截止不证明全X覆盖。审计`output.hotspots`和每股实际查询保存后才更新热点记录，事实进度不动。失败保留旧榜、旧截止与真实异常。

- 标准返回`tabs/items`及独立`hotspotTabs/hotspots`，`prepareTickerIntelligence`合并两流。缺少热点载荷记失败缺口并保留旧热点，不写成无新增。
- 直接热帖保留作者、中文摘要、真实浏览量与原帖；没有额外分析不填通用“影响判断”或免责声明占位，已写的有意义分析仍可保留。保存的紧凑排名可用`node scripts/import-ticker-hotspot-ranking.js SOURCE.json AUDIT.json OUTPUT.json`转换为发布载荷；`collectionPath`须在来源或各股标明实际`grok-app`或`grok-web`，只转换已保存证据，不搜索或发布。
- 仅补采热点可运行`node scripts/publish-ticker-hotspots.js <已保存的结果JSON>`；不触碰事实区或其截止，随后按增量SOP记录热点进度并统一提交。
- 本窗成功榜单采用本次结果，不混入旧候选；`hotspotSnapshot:true`及逐股`hotspotCollectionUnits`保留审计。partial仅在整个时间窗确已查完时标`windowComplete:true`并推进，同时披露样本或排名缺口；未查完全窗与失败保留旧榜和旧截止，换出帖子继续留存。紧凑来源的各股须记录`windowStart`、`windowEnd`及实际查询；不拿缺失浏览量、作者、原文或时间的结果补造完整榜。
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
