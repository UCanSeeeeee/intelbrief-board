# intelbrief-board · 简报 Brief

## 当前状态 / Current status

| | |
|--|--|
| **Live URL** | https://intelbrief-board.pages.dev |
| **Repo** | https://github.com/UCanSeeeeee/intelbrief-board （**PRIVATE** · owner `UCanSeeeeee`） |
| **Hosting** | Cloudflare Pages · project `intelbrief-board` · free `*.pages.dev` · **no custom domain** |
| **Cloudflare account** | `982304048@qq.com` · account id `654fc092fc71c4dc81184933d5b808b9` |
| **Data mode** | `placeholder`（演示 JSON；live API 仍为 stub） |
| **AI / 接手文档** | **先读 [`CONTEXT.md`](./CONTEXT.md)** · 短指针见 [`AGENTS.md`](./AGENTS.md) |

向 `master` push 后 Pages 会自动部署。国内网络偶发打不开 `pages.dev`，换网络或代理即可。

---

Linear 冷静密度风格的个人情报看板：**名人时间流** + **美股三时段情报**（夜盘结束 / 盘前 / 开盘前）。默认使用占位数据，无需任何 API Key 即可本地打开或部署到 **Cloudflare Pages**。

> 本仓库完全自包含：任何人克隆后都能用 Node ≥ 18 跑通「拉数 → 静态页 → 部署」流水线，不依赖 Grok Bot 或其它私有运行时。

## 功能

| 模块 | 说明 |
|------|------|
| 名人板块 | 按时间排序的动态流，点击进入 `celebrity/<slug>.html` 档案页（6 人） |
| 美股板块 | **不是**实时报价；三个检查点摘要，自选股（默认 NVDA/TSLA 等）写入各时段 |
| 数据层 | `data/*.json` 由 `scripts/` 生成；前端 `app.js` 同域 `fetch` 注入 |
| 主题 | Linear dark：侧栏 + 密信息卡片 |

## 仓库结构

```
intelbrief-board/
├── CONTEXT.md              # AI/人类接手全文（优先阅读）
├── AGENTS.md               # 短指针 → CONTEXT.md
├── README.md               # 本说明
├── index.html              # 首页
├── stocks.html             # 美股时段页
├── styles.css              # Linear 深色主题
├── app.js                  # 导航 / 相对时间 / JSON 注入
├── celebrity/              # 名人档案 + index
├── data/
│   ├── celebrities.json    # 名人 feed + profiles
│   └── stock-sessions.json # 三时段情报 + watchlist
├── scripts/
│   ├── load-env.js         # 无依赖读取 .env
│   ├── fetch-celebrities.js
│   └── fetch-stock-sessions.js
├── package.json
├── wrangler.toml           # Cloudflare Pages 静态根目录 = .
└── .env.example
```

## 快速开始（本地）

```bash
git clone https://github.com/UCanSeeeeee/intelbrief-board.git
cd intelbrief-board
cp .env.example .env          # 默认 MODE=placeholder，可不改
npm run fetch                 # 刷新 data/*.json 时间戳（占位模式）
npm run dev                   # http://localhost:8787
```

无 Node 时也可直接双击打开 `index.html`，但 `fetch` JSON 在部分浏览器的 `file://` 下会被拦；推荐用 `npm run dev` 或任意静态服务器。

### npm scripts

| 命令 | 作用 |
|------|------|
| `npm run fetch` | 跑名人 + 美股两个脚本 |
| `npm run fetch:celebrities` | 只更新 `data/celebrities.json` |
| `npm run fetch:stocks` | 只更新 `data/stock-sessions.json` |
| `npm run build` | 等同 `fetch`（Pages 可设为构建命令） |
| `npm run dev` | 本地静态服务 :8787 |
| `npm run pages:dev` | Wrangler Pages 本地预览 |
| `npm run deploy` | CLI 部署到 Cloudflare Pages（需 Token） |

## 环境变量

复制 `.env.example` → `.env`。**不要提交 `.env`。**

| 变量 | 默认 | 说明 |
|------|------|------|
| `MODE` | `placeholder` | `placeholder` 只用仓内演示数据；`live` 走外部 API（需 Key，脚本内仍为可扩展 stub） |
| `X_BEARER_TOKEN` | 空 | `MODE=live` 时名人动态用（X API） |
| `STOCK_NEWS_API_KEY` | 空 | `MODE=live` 时美股新闻 |
| `STOCK_NEWS_API_BASE` | 示例 URL | 新闻 API Base |
| `WATCHLIST` | `NVDA,TSLA,AAPL,MSFT,META` | 写入每个时段的自选 |
| `TZ` | `Asia/Shanghai` | 脚本记录用时区 |
| `CLOUDFLARE_API_TOKEN` | 空 | 仅 CLI `npm run deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | 空 | 仅 CLI 部署 |
| `SITE_URL` | 空 | 部署后的公开地址（文档用） |

## 数据契约

### `data/celebrities.json`

- **输入**：`MODE`、`X_BEARER_TOKEN`、`TZ`
- **输出字段**：`updatedAt`, `mode`, `feed[]`（`slug,name,avatar,update,ts`）, `profiles{slug→…}`
- **消费方**：首页 / 名人 index 的时间流；档案页「其他名人」网格

### `data/stock-sessions.json`

- **输入**：`MODE`、新闻 API、`WATCHLIST`、`TZ`
- **输出字段**：`checkpoints[]`（`night-close` / `pre-market` / `pre-open`）, `watchlist[]`
- **消费方**：首页美股摘要、`stocks.html` 完整三时段

占位模式下脚本**不会清空**已有 JSON，只刷新 `updatedAt` / `mode` / `watchlist`，保证演示内容稳定。

## 部署到 Cloudflare Pages（推荐）

### 方式 A：Dashboard 连接 Git（推荐）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权并选择仓库 `UCanSeeeeee/intelbrief-board`
3. 构建设置：
   - **Framework preset**: None
   - **Build command**: `npm run build`（或留空）
   - **Build output directory**: `/`（仓库根目录；与 `wrangler.toml` 中 `pages_build_output_dir = "."` 一致）
4. 保存并部署 → 获得 `*.pages.dev` 地址
5. （可选）自定义域：Pages 项目 → **Custom domains** → 按提示加 CNAME（域名购买另议，本仓库不负责付款）

### 方式 B：Wrangler CLI

```bash
cp .env.example .env
# 填入 CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID
npm run deploy
```

### DNS（自有域名时）

| 记录 | 名称 | 目标 |
|------|------|------|
| CNAME | `@` 或 `www` | `<project>.pages.dev` |

在 Cloudflare 上托管 DNS 时可一键验证；其它注册商按 Pages 控制台给出的记录添加即可。

## 本地开发提示

- 改文案：可直接改 `data/*.json`，刷新浏览器；或改脚本后再 `npm run fetch`
- 改 UI：编辑 `styles.css` / HTML；无需打包
- 接真数据：设 `MODE=live` 并在 `scripts/fetch-*.js` 的 stub 处接入 API，保持输出 JSON 形状不变

## 许可与声明

演示内容均为**占位数据**，不构成投资建议，不提供实时行情。代码可按需自用与修改。
