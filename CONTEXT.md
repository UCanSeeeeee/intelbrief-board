# CONTEXT.md — AI / 人类接手说明（Handoff）

> **另一个 AI（如 ChatGPT）或人类接手时：先读完本文，再动手。**  
> 本仓库完全自包含，不依赖 Grok Bot、本机 agent 环境或任何私有运行时。克隆即可跑通。

最后更新：2026-10-11（Asia/Shanghai）

---

## 1. 产品是什么 / What this is

**简报 Brief（intelbrief-board）** — Linear 冷静密度（深色侧栏）风格的个人情报看板。

| 项 | 值 |
|----|-----|
| 线上地址 | https://intelbrief-board.pages.dev |
| GitHub 仓库 | https://github.com/UCanSeeeeee/intelbrief-board （**PRIVATE**） |
| 仓库所有者 | `UCanSeeeeee` |
| Cloudflare 登录邮箱 | `982304048@qq.com` |
| Cloudflare Pages 项目名 | `intelbrief-board` |
| Cloudflare Account ID | `654fc092fc71c4dc81184933d5b808b9` |
| 默认分支 | `master` |
| 自定义域名 | **无**（刻意不做；仅用 `*.pages.dev`） |

两个核心模块：

1. **名人板块**：按时间排序的动态流 → 点击进入 `celebrity/<slug>.html` 完整档案页。
2. **美股板块**：**不是**个股报价 ticker。三个检查点的情报摘要：
   - ① 夜盘结束（`night-close`）
   - ② 盘前（`pre-market`）
   - ③ 开盘前（`pre-open`）  
   自选股（watchlist，默认 NVDA/TSLA/AAPL/MSFT/META）写入各时段摘要。

演示内容全部是**占位数据（placeholder）**，不构成投资建议。

---

## 2. 架构 / Architecture

纯静态站 + Node 数据脚本，**无框架、无打包器**：

```
静态前端：HTML / CSS / JS（仓库根目录即站点根）
数据层：  data/*.json（由 scripts/ 生成或刷新）
脚本：    Node ≥ 18，零 npm 依赖（只用内置 fs/path）
部署：    Cloudflare Pages（Git 集成私有仓库；根目录输出）
UI：      Linear dark（styles.css）
```

### 文件树（关键路径）

```
intelbrief-board/
├── CONTEXT.md              ← 本文（AI 接手首选）
├── AGENTS.md               ← 短指针：先读 CONTEXT.md
├── README.md               ← 人类可读安装/部署说明
├── index.html              # 首页（名人流 + 美股三时段摘要）
├── stocks.html             # 美股完整三时段页
├── styles.css              # Linear 深色主题
├── app.js                  # 导航高亮 / 相对时间 / fetch JSON 注入
├── celebrity/
│   ├── index.html          # 名人列表
│   ├── elon-musk.html
│   ├── jensen-huang.html
│   ├── sam-altman.html
│   ├── lei-jun.html
│   ├── warren-buffett.html
│   └── jack-ma.html
├── data/
│   ├── celebrities.json    # feed[] + profiles{}
│   └── stock-sessions.json # checkpoints[] + watchlist[]
├── scripts/
│   ├── load-env.js         # 无依赖读 .env
│   ├── fetch-celebrities.js
│   └── fetch-stock-sessions.js
├── package.json            # npm scripts；engines.node >= 18
├── wrangler.toml           # pages_build_output_dir = "."
├── .env.example            # 复制为 .env；勿提交 .env
└── .gitignore              # 含 .env / node_modules / .wrangler
```

前端用同域 `fetch('data/....json')` 注入内容。**不要用 `file://` 打开**（部分浏览器会拦 CORS）；用 `npm run dev`。

---

## 3. 模块规格 / Module specs

### 3.1 名人时间流 → 档案页

- **数据**：`data/celebrities.json`
  - `feed[]`：`{ slug, name, avatar, update, ts }`，按时间新→旧展示
  - `profiles{slug}`：档案页用的 bio / tags / timeline / links 等
- **页面**：
  - 首页 `index.html`、列表 `celebrity/index.html` 读 `feed`
  - 档案 `celebrity/<slug>.html` 静态写好结构；「其他名人」等可再读 JSON
- **现有 6 人 slug**：`elon-musk`, `jensen-huang`, `sam-altman`, `lei-jun`, `warren-buffett`, `jack-ma`
- **加新人**：在 JSON 的 `feed` + `profiles` 加条目，并新增对应 HTML（可复制现有档案页改 slug/文案）

### 3.2 美股三时段情报（非 ticker）

- **数据**：`data/stock-sessions.json`
  - `checkpoints[]`：id 必须是 `night-close` | `pre-market` | `pre-open`
  - 每项含 `label` / `items[]`（`tag`, `tagClass`, `text`）/ `watchlistNote`
  - `watchlist[]`：字符串 ticker 列表
- **页面**：首页摘要 + `stocks.html` 完整三栏
- **自选股**：环境变量 `WATCHLIST`（逗号分隔）；`npm run fetch` 会写回 JSON 的 `watchlist`

### 3.3 刻意未做 / Intentionally NOT done

- 无自定义域名（不注册、不绑）
- `MODE=live` 的外部 API **仍是 stub**（缺 Key 或未接线时回退 placeholder）
- 无实时股价、无登录、无后端数据库、无 Agent 私有 SDK

---

## 4. 数据流水线 / Data pipeline

```
.env (MODE, keys, WATCHLIST, TZ)
        │
        ▼
scripts/fetch-celebrities.js  ──► data/celebrities.json
scripts/fetch-stock-sessions.js ──► data/stock-sessions.json
        │
        ▼
浏览器 fetch JSON → 渲染（app.js + 各 HTML）
```

| MODE | 行为 |
|------|------|
| `placeholder`（默认） | **不清空**已有 JSON；只刷新 `updatedAt` / `mode` / `timezone`；stocks 脚本还会同步 `watchlist` |
| `live` | 尝试调外部 API；当前为 stub，未接线或无 Key → 警告并保持 placeholder 数据 |

接真数据时：**保持 JSON 形状不变**，只替换 `scripts/fetch-*.js` 里 stub 段的实现。

---

## 5. 本地运行 / Local run

需要 **Node ≥ 18**。

```bash
git clone https://github.com/UCanSeeeeee/intelbrief-board.git
cd intelbrief-board
# 私有仓：需已登录 gh / SSH / HTTPS 凭据（所有者 UCanSeeeeee）

cp .env.example .env          # 默认 MODE=placeholder，可不改任何 Key
npm run fetch                 # 刷新 data/*.json 时间戳
npm run dev                   # http://localhost:8787
```

### npm scripts

| 命令 | 作用 |
|------|------|
| `npm run fetch` | 名人 + 美股两个脚本 |
| `npm run fetch:celebrities` | 只更新 celebrities.json |
| `npm run fetch:stocks` | 只更新 stock-sessions.json |
| `npm run build` | 等同 `fetch`（Pages 构建命令可用；会刷新演示时间戳） |
| `npm run dev` | `serve` 静态站，端口 8787 |
| `npm run pages:dev` | Wrangler Pages 本地预览 |
| `npm run deploy` | `wrangler pages deploy . --project-name=intelbrief-board`（需 Token） |

---

## 6. 环境变量 / Env（见 `.env.example`）

| 变量 | 默认 | 说明 |
|------|------|------|
| `MODE` | `placeholder` | `placeholder` \| `live` |
| `X_BEARER_TOKEN` | 空 | live 时名人 X API |
| `STOCK_NEWS_API_KEY` | 空 | live 时新闻 API |
| `STOCK_NEWS_API_BASE` | 示例 URL | 新闻 API Base |
| `WATCHLIST` | `NVDA,TSLA,AAPL,MSFT,META` | 写入每个时段 |
| `TZ` | `Asia/Shanghai` | 脚本记录用时区 |
| `CLOUDFLARE_API_TOKEN` | 空 | 仅 CLI `npm run deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | 空 | 建议填 `654fc092fc71c4dc81184933d5b808b9` |
| `SITE_URL` | 空 | 文档用；线上为 `https://intelbrief-board.pages.dev` |

**永远不要提交 `.env` 或任何密钥。** `.gitignore` 已忽略 `.env`。

---

## 7. Cloudflare Pages 部署现状

- **方式**：Dashboard **Connect to Git** → 私有仓 `UCanSeeeeee/intelbrief-board`
- **项目名**：`intelbrief-board` → 产出 `https://intelbrief-board.pages.dev`
- **构建**：
  - Framework preset: None
  - Build command: **推荐留空**（纯静态）；若设 `npm run build` 也可以（会跑 fetch，刷新占位时间戳）
  - Build output directory: `/`（仓库根；与 `wrangler.toml` 的 `pages_build_output_dir = "."` 一致）
- **自动部署**：向 `master` 的 push 会触发 Pages 重建
- **私有仓**：Pages 通过 GitHub 集成授权即可部署私有仓库；改 visibility 不影响已授权连接
- **CLI 备选**：填 Token 后 `npm run deploy`

国内网络有时打不开 `pages.dev`；换网络 / 代理即可。本项目**不绑自定义域名**。

---

## 8. 改动约定 / Conventions for next changes

1. **改 UI / 文案结构**：编辑 `*.html`、`styles.css`、`app.js`
2. **改演示内容**：直接改 `data/*.json`，或改脚本后再 `npm run fetch`
3. **接真 API**：`MODE=live` + 在 `scripts/fetch-*.js` stub 处接线，**保持输出 JSON schema**
4. **提交**：在 `master` 上 commit；push 后 Cloudflare Pages 自动发版
5. **不要**引入必须依赖 Grok/某 Agent 的运行时；新依赖写进 README，优先零依赖或写明 `npm install`
6. **安全**：私有仓；密钥只放 `.env` 或 Cloudflare / GitHub Secrets；勿把 Token 写进前端 JS

---

## 9. 接手检查清单 / Takeover checklist

给下一个 AI 或人类：

- [ ] 确认有 `UCanSeeeeee` 的 GitHub 访问权限（仓为 **private**）
- [ ] `git clone https://github.com/UCanSeeeeee/intelbrief-board.git && cd intelbrief-board`
- [ ] `cp .env.example .env`
- [ ] `npm run fetch`（应成功写出两个 JSON）
- [ ] `npm run dev` → 打开 http://localhost:8787 ，检查首页名人流与美股三时段
- [ ] 点开至少一个 `celebrity/<slug>.html` 与 `stocks.html`
- [ ] 核对线上 https://intelbrief-board.pages.dev 仍可访问
- [ ] 小改后：`git add -A && git commit && git push origin master` → 等 Pages 部署
- [ ] Cloudflare 控制台（邮箱 `982304048@qq.com`）可看到项目 `intelbrief-board`

完成以上即可无障碍继续开发。

---

## 10. 常见问题 / FAQ

| 问题 | 处理 |
|------|------|
| `file://` 打不开 JSON | 用 `npm run dev` |
| 国内打不开 pages.dev | 换网络/代理；或以后自备可解析域名（需用户明确要求再做） |
| `MODE=live` 无变化 | live API 仍是 stub；先实现脚本再配 Key |
| fetch 报 missing JSON | 从 git 恢复 `data/*.json`，勿删后空跑 |
| push 失败 | 检查 GitHub 登录；可用浏览器会话或 `gh auth login` |

---

## 11. 联系与所有权

- 站点与仓库归属用户 **chieh**（GitHub: `UCanSeeeeee`，邮箱常与 Cloudflare 一致：`982304048@qq.com`）
- 本文件与 README 以仓库为准；若线上与文档冲突，以 `master` 最新提交为准
