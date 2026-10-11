# intelbrief-board · X 情报简报

一个只收录 X/Twitter 原帖、保留证据链并提供可解释可信度初评的个人情报看板。

线上地址：https://intelbrief-board.pages.dev
仓库：`UCanSeeeeee/intelbrief-board`（private）

## 当前能力

- 美股板块采用每天北京时间 09:00 / 16:00 / 21:00 的 **5 条市场焦点 + 10 条多学科认知与夜雨知识库洞察**，支持期次归档、缺额和失败提示；[执行约定](docs/STOCK_BRIEF.md)。首次真实定时采集待验证。

- 官方 X API v2 按来源表采集账号时间线
- 导入 Grok Bot 或人工整理的结构化 X 原帖
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
cp .env.example .env
# 在 .env 写入 X_BEARER_TOKEN，不要提交
npm test
npm run fetch
npm run check
npm run dev
```

打开 http://localhost:8787。

### 没有 X API Token

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
| `npm run fetch` | 从官方 X API 采集并重新评分 |
| `npm run fetch:x` | 只采集，不重建展示数据 |
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
scripts/fetch-x.js           官方 X API 采集
scripts/import-x.js          Grok Bot / 人工导入
scripts/build-intelligence.js 可信度计算
scripts/validate-data.js     数据完整性检查
```

评分边界、导入格式和人工交叉印证方法见 [`docs/X_DATA_CONTRACT.md`](docs/X_DATA_CONTRACT.md)。

## 部署

Cloudflare Pages 连接 `master`，站点根目录就是仓库根目录。构建命令可以留空或使用 `npm run build`；构建阶段只重建已提交数据，不需要把 X Token 暴露给浏览器。

真实采集应在本地或受保护的定时任务中运行，再提交生成的数据。`.env`、Token 和本地日志均不得提交。

仓库包含一个**仅手动触发**的 GitHub Actions 工作流 `Refresh X intelligence`。在仓库 Secrets 配置 `X_BEARER_TOKEN` 且确认额度后，可从 Actions 页面手动执行。美股三次简报通过应用原生对话定时任务调度，使用已授权可用的采集方式；不是 GitHub 定时任务，不会自动购买 API 服务。任务启用状态以应用为准，本地电脑/应用及登录需可用。
