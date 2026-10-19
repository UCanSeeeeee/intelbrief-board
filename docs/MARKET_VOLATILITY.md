# VIX

美股讯息顶部与CNN情绪并排，手机上下排；只显示数值、四档状态、日期和来源，异常时显示短提示，不附历史恐慌案例或买卖建议。

- 来源：[Cboe官方](https://www.cboe.com/tradable-products/vix)、[官方OHLC CSV](https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv)。原cdn.cboe.com地址307跳转至这个官方cdn-api地址，不绕过访问限制，不请求任意外部URL。
- 当前使用最新正式**收盘值**，不是盘中实时。CSV只有美东交易日期，按“YYYY-MM-DD 美东收盘”展示，不补造具体时刻；`fetchedAt`只记实际获取时间。
- 用户指定分档：`<20`波动较低；`20≤VIX<30`波动升高；`30≤VIX≤40`市场恐惧；`>40`极度恐慌。20、30进下一档，40仍属30–40；不冒称Cboe官方交易门槛或涨跌概率。
- 数值须为正的有限数，日期不晚于当前美东日期；缺失不填0。超过4个自然日显示数据较旧，这是产品提醒阈值。来源倒退保留较新存档，失败保留旧值。

`market-volatility.mjs`维护契约、来源与只读`/api/vix`，5分钟缓存、失败回退快照；`volatility.js`独立渲染，不阻塞CNN或新闻，不轮询、不触发任务。

正常新闻批次运行`npm run fetch:vix`维护`data/market-volatility.json`；失败记缺口，不阻塞其他批次、不推进X进度。构建只复制。VIX是用户新授权的非X数值源，不扩大新闻路径、不占5+10名额。

核对计划与结果见`data/paper-reviews/2026-10-19-reading-revision.json`。Grok页面空白、未取得结果时如实记载；默认不运行本地测试/check/build或预览。
