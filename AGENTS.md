# AGENTS.md

**Read [`CONTEXT.md`](./CONTEXT.md) first.**

That file is the full handoff for any AI or human taking over this repo: product goal, live URL, Cloudflare/GitHub facts, architecture, data contracts, local run, deploy, and a takeover checklist.

## 讯息采集硬规则（用户于2026-10-11明确指定）

本规则适用于本项目所有LLM、Agent、执行器、手动更新与定时任务；包括「美股讯息」「具体人物」「具体个股」「AI板块」「加密」及以后新增的信息页面。

1. **第一路径：本机 Grok Bot App。** 必须先通过应用正常界面获取讯息，固定使用已有的「X+github」Bot；它是本项目的主执行 Bot。不得改用同一 App 内的其他 Bot 规避本项目规则。
2. **唯一备用路径：Grok 网页版（https://grok.com）。** 仅在本机App不可用、操作失败或不能完成本次采集时使用；记录切换原因。
3. **仅允许以上两条路径。** 不得改用直接浏览X、X API、xreach、普通网页搜索、其他采集器、其他AI信息服务或模型记忆补采。不得读取应用内部数据库、凭证或调用未公开接口绕过正常界面。仓库中的旧X API脚本和旧文档不构成使用许可。
4. 两条路径均失败时，保留旧内容、明确报告失败原因；不得自行寻找第三条路径，也不得把失败写成“暂无新增”。
5. 保留Grok返回的原帖链接、作者、准确时间、正文和覆盖缺口。Grok回答是采集器转述，不能标为本模型已独立直读X原帖；缺失或截断内容不得补写。
6. 向Grok仅发送本次需要的公开检索问题，不发送个人资料、账户数据或私有知识库全文。不发社交帖、不私信、不点赞、不关注、不交易。
7. **检索必须加载项目知识。** 每次采集先读取 `config/research-guidance.json` 指向的项目知识库与 Grok 采集 SOP；以半导体、电力、AI 落地为固定优先级，并用知识库生成公开问题、追源问题和反证问题。不得只凭临场印象宽搜，也不得把知识库正文整段发送给 Grok。

用户明确修改之前，不得以提速、自动化、技能建议或工具不可用为由例外。共享技能若描述其他采集方式，本项目仍按上述用户规则执行。


## 检索前先定清单（用户于2026-10-12明确指定，适用于所有采集）

任何信息检索（美股简报、人物页、个股页、AI板块、加密页、财报结果、来源核验等）开始前，执行器必须先写出本次的**检索清单**：时间窗、要覆盖的对象（每位人物 / 每个美股个股 / AI实验室或政策主题 / 加密板块或标的 / 每个主题 / 每家待评价公司）、每项要回答的问题和计划用的查询。检索完成后逐项对照清单，标明「已覆盖 / 无结果 / 证据不足」，写入审计记录。清单里有一项没处理完，就不得校验推送。不能边搜边定范围，也不能等用户发现遗漏后再补。

## 重要内容必须入库（用户于2026-10-12明确指定）

凡涉及本项目的重要产品规则、真源决策、筛选标准、页面行为或长期约定，必须写入仓库（优先 `AGENTS.md` / `CONTEXT.md` / `docs/` / `config/`），不得只留在对话或执行器记忆里。仓库文档优先于历史对话。财报日历的筛选核心见 [`docs/EARNINGS_CALENDAR.md`](./docs/EARNINGS_CALENDAR.md)。

## 周末休市与周一补扫（用户于2026-10-12明确指定）

美股周六、周日不开盘。周一更新必须覆盖**上周六、周日**的讯息，不得因休市漏掉周末窗口。详情见 [`docs/STOCK_BRIEF.md`](./docs/STOCK_BRIEF.md)。

## 展示窗口与检索窗口分离（用户于2026-10-12通话明确指定）

展示窗口与检索窗口必须分开：

1. **展示窗口**：给用户看的内容必须覆盖从本期信息截止点往前完整 **24 小时**。例如今天 09:00 启动的期次，展示窗口为昨天 09:00 至今天 09:00。
2. **检索窗口**：具体检索范围由执行器自行决定。可以从最近一个成功定时期次的截止时间开始只检索尚未覆盖的时段（例如昨晚 21:00 至今天 09:00 的 12 小时），避免重复检索。
3. **本地检索记录**：已检索过的时间段须在本地存储记录（记录每个时间段做过哪些检索），以便去重。
4. **原则**：检索可以按需分段，但展示必须是完整的 24 小时窗口。周一补扫规则仍然有效，不得因分段检索漏掉周六、周日应展示的内容。

详情见 [`docs/STOCK_BRIEF.md`](./docs/STOCK_BRIEF.md)。

## 财报日历刷新与结果评分

详见 [`docs/EARNINGS_CALENDAR.md`](./docs/EARNINGS_CALENDAR.md)。摘要：日常讯息更新可轻量刷新日历；**结果核验只查「已知已发财报且尚未评价」的公司**，不做全表重复劳动。每次更新拉取日历后，必须先处理 `pendingReview`（已过披露日未评价的公司）：当场查结果并评分，清空后才可校验推送。评分 0～100（符合预期 60～70，超预期 70～90，远超预期 90+，不及预期 &lt;60）。

## 当前交付顺序

用户于2026-10-12明确决定：**没有“本地验收”阶段**。每次改动完成并通过 `npm test`、`npm run check`、`npm run build` 后，必须立即提交并推送 `master`，Cloudflare 随推送自动更新。

After completing and verifying any requested change to this GitHub project, create a focused git commit and push it to `master`. Do not leave finished project changes uncommitted. Preserve unrelated user changes and never force-push.

## 来源例外：财报日历与财报结果（用户于2026-10-12确认）

“只走 Grok App / Grok 网页版”的硬规则适用于 **X 讯息采集**（美股讯息、具体人物、具体个股、AI板块、加密）。AI/加密与美股个股分页采集，不得混入 `tickers` 任务。财报模块是明确例外：

1. 财报日历：`npm run fetch:earnings` 直接请求 Nasdaq 公开日历接口（`config/earnings-calendar.json` 的 `source.endpoint`）。单日失败按指数退避重试；仍失败则沿用上次数据并标 `stale`，不中断其余日期。
2. 财报结果评分：以公司官方披露为准（新闻稿、8-K/10-Q、管理层讲稿），一致预期可引用公开财经页面；X 只作补充线索。每项评分附来源链接。无法核实时标 `status: "unknown"` 并写明原因，不得编造分数。
3. `pendingReview` 非空时 `fetch:earnings` 以退出码 2 结束，`npm run check` 对“已过披露日仍 unreviewed”的条目直接失败。

## 单一写入路径与执行锁

同一时刻只允许一条写数据路径。现行路径是应用原生定时任务直接按 STOCK_BRIEF 流程写入并推送；D1 任务队列 + `npm run updates:start` 执行器是目标路径。切换完成前不得同时运行两者写同一期次；切换后原生任务只调用 `npm run updates:schedule`，不再直接写数据。D1 租约（每 20 秒续期、过期作废）只保证队列内单任务执行，不覆盖队列之外的写入，因此必须由本条规则保证互斥。主执行器与桌面备用执行器同样只能经队列领取任务。

## 检索记录与检索前清单

执行器每次采集后把「时间段 × 查询」写入 `data/search-coverage.json`（保留 14 天），下次采集提示会列出尚未检索的时段用于去重。schemaVersion 2 的简报必须带 `checklist`（清单项与 covered/no-result/insufficient 状态）和 `candidates`（两轮候选到入选/落选的映射与理由），校验不通过不得发布。

## 已知数据缺口（如实记录，不补写）

- 2026-10-12 09:00 期（schemaVersion 1）上线 3 条焦点 + 4 条洞察（partial）。当期对话里两轮检索曾交付 10 条和 12 条候选，但归档时未保存候选到入选的映射，落选理由只部分记在 `excludedCandidates`。该期归档已冻结，不回填内容；自 schemaVersion 2 起强制保存 `candidates`。
- X 讯息采集完全依赖 Grok App/网页版与 X 的可用性（限流、App 授权、浏览器可用性）。这是外部依赖，失败时按规则发布失败记录，不改走其他路径。

- UI 禁止任何文字截断（省略号、line-clamp、裁切、JS 截字）；详见 docs/DESIGN_SYSTEM.md「禁止截断」。
