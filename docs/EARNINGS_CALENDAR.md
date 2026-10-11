# 财报日历

采用日期：2026-10-12。

## 数据源

- **稳定主源**：Nasdaq 公开日历 `https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD`
- 请求需浏览器 `User-Agent`，以及 `Origin` / `Referer` 指向 `https://www.nasdaq.com`
- X 博主或券商周报只可作可选交叉核对，**不作系统真源**

## 生成本地数据

```bash
npm run fetch:earnings
```

写入 `data/earnings-calendar.json`。默认取北京时间下的本周交易日（周末则取下一周），按市值阈值与观察名单筛选“重要公司”。

## 页面

侧栏底部 Tab：`earnings.html`。构建时随 `npm run build` 进入 `dist`。
