# AGENTS.md

**Read [`CONTEXT.md`](./CONTEXT.md) first.**

That file is the full handoff for any AI or human taking over this repo: product goal, live URL, Cloudflare/GitHub facts, architecture, data contracts, local run, deploy, and a takeover checklist.

## 讯息采集硬规则（用户于2026-10-11明确指定）

本规则适用于本项目所有LLM、Agent、执行器、手动更新与定时任务；包括「美股讯息」「具体人物」及以后新增的信息页面。

1. **第一路径：本机 Grok Bot App。** 必须先通过应用正常界面获取讯息，固定使用已有的「X+github」Bot；它是本项目的主执行 Bot。不得改用同一 App 内的其他 Bot 规避本项目规则。
2. **唯一备用路径：Grok 网页版（https://grok.com）。** 仅在本机App不可用、操作失败或不能完成本次采集时使用；记录切换原因。
3. **仅允许以上两条路径。** 不得改用直接浏览X、X API、xreach、普通网页搜索、其他采集器、其他AI信息服务或模型记忆补采。不得读取应用内部数据库、凭证或调用未公开接口绕过正常界面。仓库中的旧X API脚本和旧文档不构成使用许可。
4. 两条路径均失败时，保留旧内容、明确报告失败原因；不得自行寻找第三条路径，也不得把失败写成“暂无新增”。
5. 保留Grok返回的原帖链接、作者、准确时间、正文和覆盖缺口。Grok回答是采集器转述，不能标为本模型已独立直读X原帖；缺失或截断内容不得补写。
6. 向Grok仅发送本次需要的公开检索问题，不发送个人资料、账户数据或私有知识库全文。不发社交帖、不私信、不点赞、不关注、不交易。
7. **检索必须加载项目知识。** 每次采集先读取 `config/research-guidance.json` 指向的项目知识库与 Grok 采集 SOP；以半导体、电力、AI 落地为固定优先级，并用知识库生成公开问题、追源问题和反证问题。不得只凭临场印象宽搜，也不得把知识库正文整段发送给 Grok。

用户明确修改之前，不得以提速、自动化、技能建议或工具不可用为由例外。共享技能若描述其他采集方式，本项目仍按上述用户规则执行。


## 重要内容必须入库（用户于2026-10-12明确指定）

凡涉及本项目的重要产品规则、真源决策、筛选标准、页面行为或长期约定，必须写入仓库（优先 `AGENTS.md` / `CONTEXT.md` / `docs/` / `config/`），不得只留在对话或执行器记忆里。仓库文档优先于历史对话。财报日历的筛选核心见 [`docs/EARNINGS_CALENDAR.md`](./docs/EARNINGS_CALENDAR.md)。

## 周末休市与周一补扫（用户于2026-10-12明确指定）

美股周六、周日不开盘。周一更新必须覆盖**上周六、周日**的讯息，不得因休市漏掉周末窗口。详情见 [`docs/STOCK_BRIEF.md`](./docs/STOCK_BRIEF.md)。

## 财报日历刷新与结果评分

详见 [`docs/EARNINGS_CALENDAR.md`](./docs/EARNINGS_CALENDAR.md)。摘要：北京时间 09:00/16:00/21:00 刷新当周日历，周日晚预览下周；每次美股讯息更新须回看日历股披露结果，按 0～100 分评价（符合预期 60～70，超预期 70～90，远超预期 90+，不及预期 &lt;60）。

## 当前交付顺序

用户于2026-10-11要求：先在本地跑通功能并启动网页，验收后再推送让Cloudflare更新。当前阶段不自动推送或部署；后续用户同意进入上线阶段时再沿用下面的提交发布规则。

After completing and verifying any requested change to this GitHub project, create a focused git commit and push it to `master`. Do not leave finished project changes uncommitted. Preserve unrelated user changes and never force-push.
