# 检索清单计划 · 2026-10-14-0900

写于检索开始前（2026-10-14 09:1x 北京时间）。

时间窗（Asia/Shanghai）：2026-10-13 09:00 → 2026-10-14 09:00
UTC 等价：2026-10-13T01:00:00Z → 2026-10-14T01:00:00Z
政策：beijing-batches-v1；cutoff 2026-10-14T09:00:00+08:00；非周一，无周末补扫
未覆盖区间：2026-10-13 09:00 → 2026-10-14 09:00（brief:context uncovered）
路径：Grok Bot X+github 自身 X 工具（search_posts_all / get_users_posts / get_users_by_usernames / get_posts_by_ids）；失败才切 grok.com
财报：仅处理 pendingReview（已发未评），不重扫日历；宏观：轻量，不新增常规采集

## news（美股讯息 ≤5 焦点 + ≤10 洞察）
- R1 宽扫（市场焦点）
  - 宏观：9月CPI（10/14美东公布？是否已出）、Fed 讲话、美债收益率、美元
  - 地缘能源物流：胡塞/沙特阿美威胁是否兑现、油价、俄乌能源停火、伊朗
  - AI/大型公司：财报（银行第二批 BAC/MS/WFC? 10/14）、ASML/TSMC 预告、AI 资本开支、OpenAI/Anthropic 大单
  - 市场结构：指数/宽度、资金流、波动
  问题：窗口内首次出现或实质进展？影响美股整体方向的广度？
- R2 知识驱动（独立重查）
  - A 半导体：HBM/DRAM/NAND 价格与产能、CoWoS/先进封装、ASML 订单、出口管制、TSMC 预期（I01/I02/I03/I04）
  - B 电力：数据中心 MW/GW、PPA、燃机/变压器、PJM、核电（I03、M07）
  - C AI 落地：付费/ARR、Agent 采用、推理成本、企业部署（I02、I10）
  - D 资本成本：期限溢价、实际利率、信用利差、AI 融资/债券发行（M02、M05、I01）
  - E 地缘能源物流：油、航运、关税/出口管制实施（M06、M07、M08）
  - F 市场结构：宽度、仓位、ETF/杠杆资金流（I05、I07、I08）
- 持久池复核：胡塞-阿美、JPM/GS 季报延续、Hassett、亚洲芯片回撤、DOE-PJM、Maia、Nanya、Anthropic 蒸馏、BTC ETF 流
- 追源 + 反证：对每条拟入选各一次

## people（每 Tab 新增区目标5：规则优先，热度补位；0规则→热度3）
- elon-musk：from:elonmusk 24h（xAI/算力、Tesla AI/机器人、SpaceX、资本配置）
- jensen-huang：from:JensenHuang 24h + 可回查媒体采访
- donald-trump：@TrumpDailyPosts / @POTUS / @WhiteHouse 24h 可执行政策（关税、出口管制、能源、税收、监管）
- trillion-leaders：30d 合集（Nadella/Pichai/Zuckerberg/Jassy/Cook/Tim Cook/Hock Tan/C.C. Wei 等本人或可归因）
- research-reports：30d 机构研报变化（MS/GS/BofA/JPM/Nomura/Citi 等对半导体/电力/AI 的假设变化）

## tickers（近1日≤5 + 7日周榜≤5）
NVDA MU INTC GOOG AVGO VRT TSM：$cashtag + 公司名 + 官方账号；问题：产品/产能/客户/价格/订单的可核验新增

## ai（近1日≤5，其他≤10；7日周榜≤5）
OPENAI（官方/高管）、ANTHROPIC、GOOG-AI（Gemini/DeepMind/TPU）、其他（中国AI、政策、开源）

## crypto（7日窗）
crypto-board（监管/ETF/矿工电力）、BTC、Brew（$BREW / 0xfa6d9b504848606eb9aec04ccc161d169b3f2159）

## 计划查询
每项执行后在 2026-10-14-0900-checklist.md 标 covered / no-result / insufficient。
