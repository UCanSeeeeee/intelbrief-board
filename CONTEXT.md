# CONTEXT.md — 接手说明

最后更新：2026-10-12（Asia/Shanghai）

## 产品与边界

**重要产品规则必须写入仓库文档，不得只留在对话记忆。** 采集路径以 [AGENTS.md的讯息采集硬规则](AGENTS.md) 为唯一维护位置：先本机Grok Bot App，失败才用Grok网页版；除此之外的获取路径全部禁止。所有接手模型、执行器与定时任务均须遵守。** 每次改动完成并通过测试、校验、构建后立即提交并推送 master（用户于2026-10-12决定，无本地验收阶段）。

`intelbrief-board` 是 X-only 情报看板。唯一内容来源是可回到原帖的 X/Twitter 帖子；系统保存证据并做可解释的可信度自动初评。

**数量上限不是交付目标。** 美股 5+10、人物个人的近窗与周榜、合集的近30天区、个股近窗与周榜、加密板块/标的近窗与周榜 都只收达到价值与证据门槛的内容；不足时保留实际数量并说明缺额，可以为 0 条，禁止用低价值、重复或旧信息补齐。

线上地址：https://intelbrief-board.pages.dev

GitHub：`UCanSeeeeee/intelbrief-board`（private）

默认分支：`master`

禁止事项：

- 不用占位新闻或 AI 补写缺失正文
- 不把蓝标、粉丝量、点赞量和转发量当可信度
- 不把可信度分数解释成真伪概率或涨跌概率
- 不发帖、点赞、转发、关注、私信或交易
- 不在仓库、前端或文档中保存 Token

## 架构

```text
本机Grok Bot App「X+github」 ─> 结构化结果 ─> 校验/去重/归档 ─> 页面
    失败时才使用 Grok 网页版          ↑
                            sources/x-sources.json
```

前端无框架，Cloudflare Pages负责展示；新增受保护的更新接口与D1任务队列，本机Node执行器负责调用只读研究、校验、提交与线上发布核验。接入说明与当前未完成的上线条件见 [手动更新](docs/MANUAL_UPDATES.md)。

Grok Bot App 内固定由「X+github」承担主执行；旧的「推特信息获取」只保留历史对话，不再作为本项目入口。电脑端执行器仅在主执行链路失败后接管，同一任务不得并行执行。

## 关键文件

- `docs/PEOPLE_INTELLIGENCE_ROADMAP.md`：具体人物顶部 Tab、万亿美元公司高层、机构研报合集、AI 三层研究方向及降噪规则的待办与产品规划。
- `docs/MANUAL_UPDATES.md`：全部更新、单页更新、云端配置、执行端及验收状态的主要维护位置。
- `updates.js` / `server/updates.mjs` / `scripts/update-runner.js`：页面进度、任务队列与本机执行器。

- `docs/STOCK_BRIEF.md`：美股每天北京时间 09:00 / 16:00 / 21:00 的 5+10 简报规则与定时执行约定，第二组使用「多学科认知与夜雨知识库」。接手简报任务先读此文件。
- `config/research-guidance.json`：项目知识与采集SOP的机器入口；更新提示词会读取它指向的文件并强制注入每次美股和人物采集。
- `knowledge/US_EQUITY_RESEARCH_KB.md`：用户关注点的项目内当前版本，固定半导体、电力、AI落地及宏观、地缘、市场结构、推理与反证框架。
- `knowledge/GROK_X_COLLECTION_SOP.md`：把知识库转换成两轮检索、追源、反证、准入、去重、选择和审计记录的执行流程。
- `us-equity-x-brief-quality`：共享卡片质量技能，统一作者、中文信息摘要、事件时间、反向条件与原帖链接；采集过程只进入证据层。当前 0.1.0 在共享技能库孵化并已链接到本机 Codex。
- `config/stock-brief.json`：时区、时段、条数与技能标识。
- `data/stock-briefs/index.json`：最近三期目录；同目录保留的期次文件不可覆盖，写入第四期时移除最旧一期。首期实际定时采集尚待验证。
- `scripts/lib/stock-brief.js`：条数、证据截止、跨组去重、知识卡与冻结归档校验。
- `index.html` / `people.html` / `tickers.html` / `crypto.html` / `earnings.html`：侧栏顺序为美股讯息→具体人物→具体个股→加密→财报日历。`tickers.js` 仅美股股权七标的；`crypto.js` 为加密板块讯息 + BTC + Brew。
- `config/earnings-calendar.json` / `data/earnings-calendar.json` / `docs/EARNINGS_CALENDAR.md`：侧栏「财报日历」；主源 Nasdaq；详见 docs/EARNINGS_CALENDAR.md。
- `config/people-intelligence.json` / `data/people-intelligence.json`：人物与合集配置及精选事件库；个人最新区最多 5 条（滚动约24小时），合集最新区最多 10 条（滚动约30天），重点榜最多 5 件。特朗普 X 同步源为 @TrumpDailyPosts（另可取 @POTUS/@WhiteHouse）；黄仁勋允许可回查媒体来源。
- `config/ticker-intelligence.json` / `data/ticker-intelligence.json` / `docs/TICKER_INTELLIGENCE.md`：具体个股仅 NVDA/MU/INTC/GOOG/AVGO/VRT/TSM（无加密）。
- `config/crypto-intelligence.json` / `data/crypto-intelligence.json` / `docs/CRYPTO_INTELLIGENCE.md`：侧栏「加密」：板块讯息 → BTC → Brew（合约可检索，不编造链上数据）。
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
npm run dev:updates
```

仅导入由允许的Grok路径取得的结果。旧X API脚本保留作历史实现，不得调用；本地完整模式说明见 `docs/MANUAL_UPDATES.md`。

## 部署

Cloudflare Pages 从 `master` 自动部署。构建命令必须为 `npm run build`、输出目录 `dist`。构建仅打包允许公开的资源，不采集X、不重新生成内容时间；采集与评分在本机任务内完成，凭证与运行日志保存在仓库外。

旧X API手动工作流已停用，不能作为备用采集路径。美股简报的三次频率已获用户授权，通过应用原生对话定时任务执行，以应用内状态为准；不要另建重复调度。采集只允许上述两条Grok路径，真实采集成功仍需单独验证。

## 接手检查清单

1. 完整阅读本文与 `docs/X_DATA_CONTRACT.md`。
2. 运行 `npm test && npm run build && npm run check`。
3. 核对来源表中的账号仍是本人或机构的一手账号。
4. 采集后抽查原帖 URL、时间和正文一致性。
5. 不因评分高而直接产生交易结论；先看评分明细和证据缺口。
