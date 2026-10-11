# CONTEXT.md — 接手说明

最后更新：2026-10-11（Asia/Shanghai）

## 产品与边界

`intelbrief-board` 是 X-only 情报看板。唯一内容来源是可回到原帖的 X/Twitter 帖子；系统保存证据并做可解释的可信度自动初评。

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
X API v2 ─┐
          ├─> data/raw/x-posts.json ─> build-intelligence ─> data/x-intelligence.json ─> 静态页面
Grok JSON ┘                ↑
                    sources/x-sources.json
```

纯静态前端，无框架、无数据库。Node 脚本负责采集、去重、评分与校验；Cloudflare Pages 负责展示。

## 关键文件

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
cp .env.example .env
# 配置 X_BEARER_TOKEN
npm test
npm run fetch
npm run check
npm run dev
```

若使用 Grok Bot：按 `docs/X_DATA_CONTRACT.md` 导出 JSON，执行 `npm run import:x -- FILE && npm run score && npm run check`。

## 部署

Cloudflare Pages 从 `master` 自动部署。静态构建不采集 X，以免在构建日志或浏览器端暴露 Token。采集在本地或受保护环境运行，生成数据经校验后再提交。

`.github/workflows/refresh-x.yml` 提供手动触发的完整刷新，但没有 cron。先在 GitHub Secrets 配置 `X_BEARER_TOKEN`；未核实 API 额度与用户期望频率前，不要擅自加入定时计划。

## 接手检查清单

1. 完整阅读本文与 `docs/X_DATA_CONTRACT.md`。
2. 运行 `npm test && npm run build && npm run check`。
3. 核对来源表中的账号仍是本人或机构的一手账号。
4. 采集后抽查原帖 URL、时间和正文一致性。
5. 不因评分高而直接产生交易结论；先看评分明细和证据缺口。
