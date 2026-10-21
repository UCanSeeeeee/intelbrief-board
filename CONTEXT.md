# 项目上下文

## 产品与权限

这是只读美股情报看板，研究优先级为半导体、电力、AI落地。网页：[intelbrief-board.pages.dev](https://intelbrief-board.pages.dev/)，公开源码：`UCanSeeeeee/intelbrief-board`，默认分支`master`。写入受GitHub权限控制，公开不等于有维护权。

首次接手读[AGENTS](AGENTS.md)、本文、[待办](TASKS.md)，再按需读取专题。修改前拉取，完成审查差异后提交推送，不默认执行本地测试、check、build或预览。当前文件只维护有效状态，修改历史按需查Git。

- X讯息只走Grok网页版，唯一备用是额度可用时的Grok Bot；不直访X、用X API或普通搜索补采。财报、宏观、CNN情绪、VIX、论文和反直觉小知识适用各自限定的非X来源例外，不扩展新闻路径。
- 不编原文、作者、链接、价格或时间；采集器转述不冒充本模型独立直读，评分不是真伪或涨跌概率。
- 数量通常是上限，不足可为0条。人物页按专门规则补充标明身份的热度动态，不能拿互动量证明可信度。
- 不发帖、私信、点赞、关注或交易，不保存凭证，不读取仓库外私有知识或个人资料。

## 当前运行

本机Codex总编排按侧边栏独立批次串行组织检索、筛选和统一发布；Grok Bot主例行任务、Webhook和探针保持暂停。工作日北京时间08:00/15:00/20:30、周六日08:00一次；任务依赖本机和登录环境可用。网页无更新按钮、登录或执行队列。

[增量采集入口](docs/INCREMENTAL_COLLECTION.md)维护时间接续和恢复规则：每个对象接上次成功截止，手动与定时共用进度；先保存可靠结果再推进。无结果、证据不足、请求失败分开；失败不推进，不清空存量，发布失败只补发布。读取范围不等于每次搜索范围。

首页显示累计有效重点，早报晚间仍可读，区分新增、进展、累计保留；更正保存原卡及依据。人物、个股、AI保留有效旧榜和未入精选的有效条目。三期快照独立于卡片寿命，已展示不代表已读。所有阅读内容默认展开、不截字，前台不展示反向条件。

已存在真实本机到点触发及发布样本；严格增量首个手动样本到线上核验耗时23分02秒，尚未证明稳定提速或连续可靠。当前运营证据和依赖见[运营说明](docs/GROK_BOT_OPERATIONS.md)，不把任务启用或代码上线当成运行验收。

## 文件路由

美股讯息顶部并排[CNN情绪](docs/MARKET_SENTIMENT.md)与[VIX](docs/MARKET_VOLATILITY.md)：保留数值、日期、来源，VIX按用户四档并标美东收盘；只读接口与快照兜底，不触发新闻。前台不展示规则/配额、检索/阅读过程和固定免责声明，正文与必要异常仍完整显示。

全站使用舒适阅读设计：`reading.css`统一主题、字体与阅读组件，首页先加载`news.css`的指标几何、最后加载共享阅读层。正文桌面17px、手机16px，辅助文字14px；主阅读画布最多860px，摘要→影响、专业→故事、论文结论→过程→结果→边界均单列顺读。财报对照信息保留宽屏双列，日历日期与星期吸顶。`theme.js`在首屏绘制前应用跟随系统／日间／夜间选择，只在浏览器本地保存偏好，侧边栏底部可切换。正文和来源完整显示，不改采集、筛选、窗口或新闻数据，规则见[设计系统](docs/DESIGN_SYSTEM.md)。

| 需要处理的问题 | 唯一主要入口 |
|---|---|
| 协作、权限、同步、上下文维护 | AGENTS.md；Fork另读FORK_AGENT.md |
| 已授权后续、阻塞及验收 | TASKS.md |
| 完整工作流、LLM接手 | docs/PROJECT_WORKFLOW_SOP.md、docs/AGENT_ENTRY.md |
| 当前调度、发布与运行证据 | docs/GROK_BOT_OPERATIONS.md；data/ops-runs、data/collection-runs |
| 增量、失败恢复、耗时记录 | docs/INCREMENTAL_COLLECTION.md；data/collection-progress.json；collection:plan / collection:progress |
| 累计阅读、周末归属、保留 | docs/TRADING_DAY_READING.md；data/reading-board.json |
| UI及侧栏顺序 | docs/DESIGN_SYSTEM.md；styles.css |
| 知识库和Grok检索SOP | config/research-guidance.json指向的项目资料 |
| 美股5+10及冻结归档 | docs/STOCK_BRIEF.md；config/stock-brief.json；data/stock-briefs |
| 顶部情绪/VIX、来源与降级 | docs/MARKET_SENTIMENT.md、docs/MARKET_VOLATILITY.md；market-sentiment.mjs、market-volatility.mjs |
| 人物与合集 | docs/PEOPLE_INTELLIGENCE_ROADMAP.md；config/people-intelligence.json |
| 个股NVDA/MU/INTC/GOOG/AVGO/VRT/TSM | docs/TICKER_INTELLIGENCE.md；config/ticker-intelligence.json |
| OPENAI/ANTHROPIC/GOOG(AI)/其他 | docs/AI_INTELLIGENCE.md；config/ai-intelligence.json |
| 基础知识专业版与故事版 | docs/DAILY_LEARNING.md；config/learning.json；data/learning.json |
| Nature/Science健康生活选读 | docs/JOURNAL_PAPERS.md；data/journal-learning.json；learning:publish-papers |
| 每日5条反直觉小知识 | docs/COUNTERINTUITIVE_KNOWLEDGE.md；data/counterintuitive-learning.json；learning:publish-counterintuitive |
| 宏观、财报日期及结果 | docs/MACRO_EVENTS.md、docs/EARNINGS_CALENDAR.md |
| 来源评分与数据契约 | docs/X_DATA_CONTRACT.md；sources/x-sources.json；scripts/lib/credibility.js |
| 人名原文及≤15字简介 | config/person-registry.json；scripts/lib/person-names.js |

侧栏顺序为每日更新、美股讯息、具体人物、具体个股、AI板块、每日学习、宏观大事、财报日历；人物默认马斯克Tab。每日更新为[只读连续阅读流](docs/DAILY_UPDATES.md)，聚合前四个来源栏目当日新增/实质进展，不增加采集任务。所有配置股票在价值区之外增加独立[X热点](docs/TICKER_INTELLIGENCE.md)，最多3个不同事件，标非官方；与事实检索游标分离，热度不当可信度。加密暂时停用，板块空头不展示或采集。其原始资料不构成恢复权限。

## 发布

Cloudflare Pages跟随master自动构建，命令`npm run build`、目录`dist`；这是云端构建设置，不是本地提交前置步骤。构建只打包获准公开的资源，不采集、不改时间。核对远端提交及线上相关资源后才报告上线。
