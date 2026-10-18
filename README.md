# intelbrief-board · X 情报简报

一个只收录 X/Twitter 原帖、保留证据链并提供可解释可信度初评的个人情报看板。

**LLM入口：[AGENTS.md](AGENTS.md) → [当前上下文](CONTEXT.md) → [任务断点](TASKS.md)。** 当前由本机Codex按侧边栏Tab分批运营内容，Grok网页版优先、Grok Bot备用；改动前拉取，改动后直接提交推送，默认不做本地验证。入口能力与使用方法见 [AGENT_ENTRY](docs/AGENT_ENTRY.md)。

共同维护、定时采集、数据填充与网页发布的完整说明见 [项目工作流 SOP](docs/PROJECT_WORKFLOW_SOP.md)。

线上地址：https://intelbrief-board.pages.dev
仓库：`UCanSeeeeee/intelbrief-board`（public；网页与源码均可公开访问，写入仍受 GitHub 权限控制）

需要独立维护和部署自己的副本时，先 Fork 本仓库，并让执行任务的 LLM 完整阅读 [Fork 独立部署 Agent](FORK_AGENT.md)。Fork 必须使用自己的 GitHub、Cloudflare、Grok 与部署网址，不会影响本项目生产环境。

## 当前能力

- [交易日待阅](docs/TRADING_DAY_READING.md)：休市/盘后重要信息持续到下个实际交易时段结束，跨期池与三期快照分开；默认展示待阅精选，其他有效信息可展开，不把延续消息冒充新增。

- 网页是只读信息看板，不提供“更新”按钮、登录、任务队列或手动触发接口；内容由本机定时运营生成，网页端不承担采集。

- 美股板块采用每天北京时间 08:00 / 15:00 / 20:30 的 **5 条市场焦点 + 10 条多学科认知与夜雨知识库洞察**，支持期次归档、缺额和失败提示；[执行约定](docs/STOCK_BRIEF.md)。Grok 原生定时已有成功样本（如 `410dd11` 的 2026-10-12 21:00）；可靠性、空跑与 OPS-01 状态以 [运营记录](docs/GROK_BOT_OPERATIONS.md) 为准，不因单次成功宣称稳定闭环。
- 项目内置[美股研究知识库](knowledge/US_EQUITY_RESEARCH_KB.md)和[Grok 采集 SOP](knowledge/GROK_X_COLLECTION_SOP.md)，每次更新由程序自动注入，固定以半导体、电力、AI落地为优先级并要求独立追源与反证。
- 前台侧边栏七个 Tab：「美股讯息」、「具体人物」、「具体个股」（见 `docs/TICKER_INTELLIGENCE.md`）、「AI板块」（见 `docs/AI_INTELLIGENCE.md`）、「每日学习」（见 `docs/DAILY_LEARNING.md`）、「宏观大事」（见 `docs/MACRO_EVENTS.md`）、「财报日历」（见 `docs/EARNINGS_CALENDAR.md`）。每日学习包含「每日趣事」和「基础知识讲解」，同一基础知识点同时提供专业版与18+故事版。加密栏目已暂时停用（见 `docs/CRYPTO_INTELLIGENCE.md`）。原帖档案、来源管理和评分作为后台能力保留，不单独提供前台页面。

- 每个定时点只触发一次总编排，再按七个侧边栏Tab独立分批；X内容优先使用Grok网页版，失败或覆盖不足且额度可用时才尝试Grok Bot；调度验收见 [运营记录](docs/GROK_BOT_OPERATIONS.md)
- 导入上述Grok路径返回的结构化X原帖，并保留未独立直读标记
- 按 status ID 去重，保留首次与最近抓取时间
- 保存原帖链接、完整正文、作者、UTC 时间、引用关系、媒体和抓取时互动量
- 每条帖子分别计算作者分与主张分，并展示理由、证据缺口和评分限制
- 总览分类：美股、AI、宏观、人物
- 无真实数据时显示空状态，不回退到占位新闻

系统只读 X，不发帖、不点赞、不转发、不关注、不私信，也不执行交易。

## 快速开始

需要 Node.js 20 或更高版本。

```bash
git clone https://github.com/UCanSeeeeee/intelbrief-board.git
cd intelbrief-board
npm ci
npm test
npm run check
npm run build
npm run agent:enter -- --role gpt --task code
```

以上不启动网站。只有用户要求本地预览时才运行 `npm run dev`（http://localhost:8787）。

### 导入Grok采集结果

以下由当前内容运营执行者按单个侧边栏批次执行。输出符合 [`docs/X_DATA_CONTRACT.md`](docs/X_DATA_CONTRACT.md) 的 JSON，然后：

```bash
npm run import:x -- /absolute/path/to/x-export.json
npm run score
npm run check
```

导入器缺少原帖 URL、准确时间或完整正文时会失败，不补写缺失内容。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run agent:enter -- --role gpt --task code` | 只读任务路由和断点检查；Grok改为 `--role grok --task news`，每日学习用 `--task learning` |
| `npm run import:x -- FILE` | 导入 Grok Bot/人工结构化 JSON |
| `npm run score` | 从原始归档重建评分数据 |
| `npm run check` | 校验 ID、URL、时间、去重和评分范围 |
| `npm run brief:slot` | 查看最近已到期与下一期时间 |
| `npm run brief:validate -- FILE` | 校验 5+10 简报、证据截止与知识卡 |
| `npm run brief:publish -- FILE` | 冻结简报归档并更新历史目录 |
| `npm test` | 测试评分不变量 |
| `npm run dev` | 本地预览 |
| `npm run deploy` | 部署 Cloudflare Pages |

## 数据路径

```text
sources/x-sources.json       人工维护的来源身份、类别与信任等级
data/raw/x-posts.json        原始 X 帖归档（按 status ID 去重）
data/x-intelligence.json     面向页面的评分结果
scripts/collection-progress.js 逐对象严格增量进度与可靠落盘后的接续
scripts/fetch-x.js           历史X API实现，已停用
scripts/import-x.js          Grok Bot / 人工导入
scripts/build-intelligence.js 可信度计算
scripts/validate-data.js     数据完整性检查
config/research-guidance.json 项目知识库与采集SOP入口
knowledge/US_EQUITY_RESEARCH_KB.md 用户关注点与多学科传导快照
knowledge/GROK_X_COLLECTION_SOP.md Grok检索、追源、反证和降噪流程
```

评分边界、导入格式和人工交叉印证方法见 [`docs/X_DATA_CONTRACT.md`](docs/X_DATA_CONTRACT.md)。

## 部署

Cloudflare Pages 连接 `master`，构建命令为 `npm run build`，输出目录为 `dist`。构建只打包公开资源，保留数据时间，不采集X，也不提供手动触发接口。

真实采集由本机定时任务分批运行，再提交生成的数据。`.env`、Token和私有日志均不得提交。

旧GitHub Actions采集仍停用；Grok Bot任务因周额度耗尽暂停。当前本机定时入口按08:00/15:00/20:30运行，电脑离线会导致当期不能启动，须按运营记录如实标缺口。
