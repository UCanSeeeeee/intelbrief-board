# intelbrief-board · X 情报简报

一个只收录 X/Twitter 原帖、保留证据链并提供可解释可信度初评的个人情报看板。

**所有LLM接手必读：[AGENTS.md](AGENTS.md)。讯息必须先通过本机Grok Bot App获取，失败才用Grok网页版；禁止任何第三条采集路径。**

线上地址：https://intelbrief-board.pages.dev
仓库：`UCanSeeeeee/intelbrief-board`（private）

## 当前能力

- 已实现「全部更新」「更新本页」、共享进度与失败重试；云端配置、真实采集验收及本机执行器启用仍待完成，见 [手动更新接入说明](docs/MANUAL_UPDATES.md)。

- 美股板块采用每天北京时间 09:00 / 16:00 / 21:00 的 **5 条市场焦点 + 10 条多学科认知与夜雨知识库洞察**，支持期次归档、缺额和失败提示；[执行约定](docs/STOCK_BRIEF.md)。首次真实定时采集待验证。
- 项目内置[美股研究知识库](knowledge/US_EQUITY_RESEARCH_KB.md)和[Grok 采集 SOP](knowledge/GROK_X_COLLECTION_SOP.md)，每次更新由程序自动注入，固定以半导体、电力、AI落地为优先级并要求独立追源与反证。
- 前台侧边栏四个 Tab：「美股讯息」（首页）、「具体人物」、「具体个股」（NVDA/MU/INTC/GOOG/AVGO/VRT/TSM + BTC/Brew，见 `docs/TICKER_INTELLIGENCE.md`）、「财报日历」（页内上周 / 本周 / 下周，见 `docs/EARNINGS_CALENDAR.md`）。原帖档案、来源管理和评分作为后台能力保留，不单独提供前台页面。

- 通过本机Grok Bot App采集，失败时才使用Grok网页版
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
npm run dev:updates
```

打开 http://localhost:8787。

### 导入Grok采集结果

让 Grok Bot 输出符合 [`docs/X_DATA_CONTRACT.md`](docs/X_DATA_CONTRACT.md) 的 JSON，然后：

```bash
npm run import:x -- /absolute/path/to/x-export.json
npm run score
npm run check
```

导入器缺少原帖 URL、准确时间或完整正文时会失败，不补写缺失内容。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev:updates` | 本地调试：网站、更新队列与Grok采集执行器（调试数据只写本机；保留须提交推送） |
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

Cloudflare Pages 连接 `master`，构建命令为 `npm run build`，输出目录为 `dist`。构建只打包公开资源，保留数据时间，不采集X。手动更新接口的D1绑定与密钥按 [接入说明](docs/MANUAL_UPDATES.md) 配置。

真实采集应在本地或受保护的定时任务中运行，再提交生成的数据。`.env`、Token 和本地日志均不得提交。

旧GitHub Actions的X API采集入口已停用。美股三次简报沿用应用原生对话定时任务，统一遵守AGENTS.md的两条Grok路径。任务启用状态以应用为准，本地电脑、应用及登录需可用。
