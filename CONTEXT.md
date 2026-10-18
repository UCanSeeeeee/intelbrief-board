# CONTEXT.md — 接手说明

最后更新：2026-10-16（Asia/Shanghai）

## 产品与边界

首次接手读 [AGENTS.md](AGENTS.md) → 本文 → [TASKS.md](TASKS.md)，再按任务加载专题。支持的入口和平台限制见 [Agent 入口](docs/AGENT_ENTRY.md)。重要规则主动入库；每次修改前拉取，验证后自动提交推送，具体 Git 强规则只在 AGENTS.md 维护。

`intelbrief-board` 的讯息是 X-only；财报和宏观日历沿用 AGENTS.md 中已授权的官方来源例外。系统保存证据并做可解释的可信度自动初评。

**数量上限不是交付目标。** 美股 5+10、人物个人的近窗与周榜、合集的近30天区、个股近窗与周榜、AI板块近窗与周榜 都只收达到价值与证据门槛的内容（加密栏目2026-10-15起暂时停用）；不足时保留实际数量并说明缺额，可以为 0 条，禁止用低价值、重复或旧信息补齐。**例外（2026-10-13）**：具体人物页全部 Tab 改为规则优先 + 本 Tab 热度动态补位（目标 5，无规则条目时 3），见 PEOPLE_INTELLIGENCE_ROADMAP「收录与热度补位」。

线上地址：https://intelbrief-board.pages.dev

GitHub：`UCanSeeeeee/intelbrief-board`（public；公开只读与 Fork，不等于拥有写入权限）

默认分支：`master`

禁止事项：

- 不用占位新闻或 AI 补写缺失正文
- 不把蓝标、粉丝量、点赞量和转发量当可信度
- 不把可信度分数解释成真伪概率或涨跌概率
- 不发帖、点赞、转发、关注、私信或交易
- 不在仓库、前端或文档中保存 Token

## 架构

```text
Grok Bot「X+github」自身云端调度/检索 → 校验/去重/归档 → GitHub → Cloudflare
    失败时由同一Bot使用Grok网页版；GPT只维护代码，不参与内容运营
```

前端无框架，Cloudflare Pages负责只读展示。上述是目标执行归属，不代表调度已跑通；当前验收事实见 [Grok运营记录](docs/GROK_BOT_OPERATIONS.md)。网页“更新”按钮、登录、D1 队列、Webhook 与旧执行器已于 2026-10-16 删除；这不影响 Grok Bot 的既有云端内容任务。

固定由「X+github」执行；旧「推特信息获取」仅保留历史。旧Codex调度已暂停，电脑端Codex执行器已停用，无GPT故障接管。

## 关键文件

- `docs/TRADING_DAY_READING.md`：北京时间批次/周末保留的唯一专题入口（历史文件名沿用）；周一08:00起收录周六00:00以来消息，不按美国开收盘或节假日推迟展示。`scripts/lib/reading-period.js`计算周期，`data/reading-board.json`独立于三期简报保留有效事件。采集前运行`npm run brief:context`。旧交易所日历仍留存供历史追溯，不再驱动讯息展示。

- `docs/DESIGN_SYSTEM.md` / `styles.css`：前台页面共用的阅读优先布局，所有阅读内容默认展开，卡片不展示反向条件；数量为上限而非任务完成率。历史证据与内部核验不因UI改变。
- `calendar-time.js`：宏观美东时刻换算北京时间（含夏令时）与财报披露状态展示；测试见 `test/calendar-time.test.js`。
- `assets/fluent/README.md`：页标题装饰素材的来源版本与许可。

- `docs/PEOPLE_INTELLIGENCE_ROADMAP.md`：具体人物顶部 Tab、万亿美元公司高层、机构研报合集、AI 三层研究方向及降噪规则的待办与产品规划。
- `docs/STOCK_BRIEF.md`：美股每天北京时间 08:00 / 15:00 / 20:30 的 5+10 简报规则与定时执行约定，第二组使用「多学科认知与夜雨知识库」。接手简报任务先读此文件。
- `config/research-guidance.json`：项目知识与采集SOP的机器入口；更新提示词会读取它指向的文件并强制注入每次美股和人物采集。
- `knowledge/US_EQUITY_RESEARCH_KB.md`：用户关注点的项目内当前版本，固定半导体、电力、AI落地及宏观、地缘、市场结构、推理与反证框架。
- `knowledge/GROK_X_COLLECTION_SOP.md`：把知识库转换成两轮检索、追源、反证、准入、去重、选择和审计记录的执行流程。
- `us-equity-x-brief-quality`：共享卡片质量技能，统一作者、中文信息摘要、事件时间、反向条件与原帖链接；采集过程只进入证据层。当前 0.1.0 在共享技能库孵化并已链接到本机 Codex。
- `config/stock-brief.json`：时区、时段、条数与技能标识。
- `data/ops-runs/`：内容运行里程碑日志（`npm run ops:run`）；排查定时失败时先看这里，缺文件通常表示平台未跑到仓库脚本。规则见 docs/GROK_BOT_OPERATIONS.md「运营运行日志」。
- `data/stock-briefs/index.json`：最近三期目录；同目录保留的期次文件不可覆盖，写入第四期时移除最旧一期。旧链路有实际期次，不等于新Grok独立调度已验收。
- `scripts/lib/stock-brief.js`：条数、证据截止、跨组去重、知识卡与冻结归档校验。
- `index.html` / `people.html` / `tickers.html` / `ai.html` / `learning.html` / `earnings.html`：侧栏顺序为美股讯息→具体人物→具体个股→AI板块→每日学习→宏观大事→财报日历。每日学习见 `docs/DAILY_LEARNING.md`，基础知识点强制同时提供专业版与18+故事版；宏观大事见 `docs/MACRO_EVENTS.md`（含超关注财报精选）；板块空头已于2026-10-12停用；**加密已于2026-10-15暂时停用**（`docs/CRYPTO_INTELLIGENCE.md`，重定向首页，不再采集或部署）。`ai.js`：OPENAI/ANTHROPIC/GOOG(AI)/其他；`tickers.js` 仅股权七标的。
- `config/earnings-calendar.json` / `data/earnings-calendar.json` / `docs/EARNINGS_CALENDAR.md`：侧栏「财报日历」；主源 Nasdaq；卡片主营一句话见 `config/company-blurbs.json`。
- `config/people-intelligence.json` / `data/people-intelligence.json`：人物与合集配置及精选事件库；个人与合集最新区目标均为 5 条（个人滚动约24小时、合集约30天；规则优先+热度补位，selectionPolicy），重点榜最多 5 件且只收规则条目。特朗普 X 同步源为 @TrumpDailyPosts（另可取 @POTUS/@WhiteHouse）；黄仁勋允许可回查媒体来源。
- `config/ticker-intelligence.json` / `data/ticker-intelligence.json` / `docs/TICKER_INTELLIGENCE.md`：具体个股仅 NVDA/MU/INTC/GOOG/AVGO/VRT/TSM（无加密、无 AI 实验室 Tab）。**2026-10-15**：`prepareTabbedIntelligence` 自动合并仍在滚动窗口内的旧条目——本窗零新增的 Tab 整页保留；本窗有新帖的 Tab 也保留未冲突的旧重点榜（排名冲突则顺延到空位）。人物/个股/AI 共用此逻辑，防止只交近窗新帖时清空 7 天（合集 30 天）重点榜。
- `config/ai-intelligence.json` / `data/ai-intelligence.json` / `docs/AI_INTELLIGENCE.md`：侧栏「AI板块」：OPENAI→ANTHROPIC→GOOG(AI产品)→其他。
- `config/crypto-intelligence.json` / `data/crypto-intelligence.json` / `docs/CRYPTO_INTELLIGENCE.md`：加密栏目已暂时停用；配置与数据仅留仓库追溯。
- `docs/PEOPLE_INTELLIGENCE_ROADMAP.md`：人物页规划（仍有效）。

- `sources/x-sources.json`：账号来源表。身份等级必须人工维护，账号变化后需要复核。
- `data/raw/x-posts.json`：原始归档。status ID 是去重主键。
- `data/x-intelligence.json`：显示数据，随时可由原始归档重建。
- `scripts/lib/credibility.js`：评分规则的唯一维护位置。
- `docs/X_DATA_CONTRACT.md`：数据契约与解释边界。
- `test/credibility.test.js`：关键评分不变量。

## 评分原则

总分为作者分 40% 加主张分 60%。作者身份较强，只能提高“谁说的”这一层；具体主张仍需直接性、可追溯证据和独立 X 帖印证。

所有评分状态都是 `auto-provisional`。人工复核时，把不同作者的支持帖 ID 写入 `assessment.independentSupportPostIds`，相反证据写入 `assessment.contradictionPostIds`，然后执行 `npm run score`。

## 运行与验证

```bash
npm ci
npm test
npm run check
npm run build
npm run agent:enter -- --role gpt --task code
```

内容导入仅由Grok执行；旧X API脚本不得调用。按用户要求目前不启动本地网站。代码测试使用夹具，不触发真实采集。

## 部署

Cloudflare Pages 从 `master` 自动部署。构建命令为 `npm run build`、输出目录 `dist`。构建只打包允许公开的资源，不采集X、不重新生成内容时间；内容由Grok运营任务生成，凭证和私有运行日志不进入公开构建。

旧X API工作流与Codex调度不作为备用路径。Grok原生调度已有定时成功样本（如 `410dd11`），也有平台空跑（如 2026-10-13 09:00）；设置、单次发布与「无人值守可靠」须分别核验，不凭页面可访问、提示词已写、任务已创建或单次成功宣称 OPS-01 完成。详情见运营记录与 TASKS OPS-01。

## 接手检查清单

按 AGENTS.md 的任务路由与完成条件处理。状态询问只读，代码工作不采集；Grok内容任务再核对账号身份、原帖URL、时间与正文。不因评分高直接产生交易结论。
