# 当前内容运营

## 执行与来源

本机Codex负责总编排、筛选、数据写入及发布；工作日北京时间08:00/15:00/20:30、周六日08:00一次。原有本机任务为`intelbrief-08-00`、`intelbrief-15-00`、`intelbrief-20-30`。本机需要开机、联网、应用和执行环境可用；Grok登录、额度及Git发布权限也必须可用。

Grok网页版为X检索第一路径；唯一备用为额度可用的Grok Bot「X+github」。当前Bot主例行任务、Webhook与GitHub探针暂停，不重试耗尽额度、不自动恢复。不得绕过[AGENTS采集边界](../AGENTS.md#讯息采集硬规则用户于2026-10-11明确指定)。财报、宏观、CNN情绪、论文及反直觉小知识走各自明确授权的非X来源，不扩大X采集权限。

用户已确认使用Grok网页版Expert专家模式，不指定模型版本号。每个新会话发送前按AGENTS确认Expert选中，保存实际标签与确认时间；界面不显示版本号不构成阻塞，未知版本不得补写。会员续费为用户自述，不替代每轮实际可用性核对，也不证明Bot独立额度已恢复；续费不自动恢复Bot任务或变更执行归属。

Grok首页和模型菜单可打开，已登录且选中Expert，可按当前模式要求继续采集。2026-10-24下午CNN、VIX和财报独立刷新及发布证据见[data/collection-runs/manual-20261024-153400.json](../data/collection-runs/manual-20261024-153400.json)；该审计保留当时未发送X查询的事实，不追认成采集成功。后续采集仍从各对象上次成功截止接续。

## 每轮入口与互斥

1. 按AGENTS核对原仓库、master和改动，首次写入前`git pull --ff-only origin master`，保留他人工作。
2. 冻结本轮截止，读取[增量采集](INCREMENTAL_COLLECTION.md)，运行`npm run collection:plan -- <CUTOFF>`。未安排的周末批次立即结束；不等待更晚截止、不补造过去期次。
3. 按侧栏独立批次串行执行，不混用上下文或候选；每批先可靠保存结果，再按对象更新共享进度。X批次有新候选或实质变化才追源、查反证；空候选明确跳过，旧证据无变化复用。
   美股讯息批次另运行`npm run fetch:sentiment`维护[CNN情绪卡](MARKET_SENTIMENT.md)发布快照，并运行npm run fetch:vix维护[VIX](MARKET_VOLATILITY.md)收盘快照；固定非X来源，不推进新闻窗口，失败保留旧值、不阻塞发布。前台另有Cloudflare只读按需获取，不依赖本机在线。
4. 按learning.components执行：每天08:00两刊各目标3篇；基础知识与每日5条小知识在工作日20:30、周末08:00。每日趣事停用，旧记录保留。单项失败不清空其他内容；宏观只查到期/过时，财报按专门契约。
5. 各批关闭后统一去重、归档和发布，单一写入路径；已有期次不可覆盖。手动与定时共用采集进度，不能同时写公共文件。失败只恢复失败步骤，不抹掉其他批次结果。
6. 审查真实内容及差异，明确暂存本次文件、提交推送。默认不运行本地测试、check、build或预览；来源真实性与程序的数据写入契约仍有效。
7. 远端及线上相关期次、目录、持久池与本次提交一致后才称发布成功。采集成功、推送成功、部署成功分别记录；只返回HTTP200不足以证明上线新内容。

网页不提供更新按钮、登录、D1队列或Webhook执行器。来源故障保留旧内容并报告缺口，不启动第三条采集路径。

## 运行日志

`data/ops-runs/<period>.json`记录里程碑与错误，`latest.json`为最近运行指针；`data/collection-runs/`保存独立批次清单、查询、候选及结果。都不进入网页构建；不得写凭证、私有聊天、账户资料或整段浏览器历史。

```sh
npm run ops:run -- start --period <RUN> --trigger scheduled
npm run ops:run -- stage --period <RUN> --name pull --status ok
npm run ops:run -- step --period <RUN> --page news --name discovery --status running
npm run ops:run -- step --period <RUN> --page news --name discovery --status ok
npm run ops:run -- page --period <RUN> --page news --status partial --detail "实际结果与缺口"
npm run ops:run -- fail --period <RUN> --stage search --message "实际失败原因"
npm run ops:run -- finish --period <RUN> --status partial --commit <hash>
```

里程碑包含pull/read/search/write/validate/push/verify；没有执行本地检查时validate记skipped，不能伪称通过。批次和发现/追源/反证在实际操作前后计时，不补造起点；没有候选的后两阶段直接记skipped及原因。记录的是墙钟跨度，不能冒称纯模型计算时间。完整字段与进度报告见增量入口。

### 如何定位失败

- 无对应运行日志：可能未进入仓库执行；核对平台状态与本机前提，不当成“暂无新增”。
- 失败里程碑及错误存在：按真实原因补失败对象或发布，不重搜全部已成功范围。
- 推送成功但线上不一致：检查对应Cloudflare部署与资源，保留已落盘结果，不重写冻结期次。
- 条目不足但查询完成：记录无结果或证据不足，和请求失败分开，不能为满额降低门槛。

## 运行证据

必要样本按需读取，不默认把所有历史过程载入上下文：

- 最近15:00样本：[2026-10-22运行日志](../data/ops-runs/2026-10-22-1500.json)及[分批审计](../data/collection-runs/2026-10-22-1500.json)。Grok首页新页、一次刷新及既有会话均空白，未出现输入框，无法核实登录或提交查询；30对象全记failed，成功截止保留当日08:00。新闻两轮及六包未执行，追源/反证因发现失败无新候选跳过，Bot仍暂停。逐批先保存完整失败结果再record；保留208持久事件、5焦点及2洞察、全部人物/个股/AI卡、6条当前热点和15条历史热点，失败发布中的机械重排经审查保留原分区与精选顺序。学习三项均false跳过，宏观无到期/过时触发；Nasdaq1280原始/82精选、待评价0，旧评分不重查。CNN31.3（10月22日00:00Z）、VIX16.68（10月21日美东收盘）已获取。提交和Cloudflare核验以本期审计publication为准；未运行本地test/check/build/预览。
- 最近08:00样本：[2026-10-24运行日志](../data/ops-runs/2026-10-24-0800.json)及[分批审计](../data/collection-runs/2026-10-24-0800.json)。Grok已登录Expert但无法确认4.7，服务故障横幅；未发X查询，30对象全failed，成功截止不推进，无候选跳过追源/反证。任务提前触发，首次record在08:00前被未来截止保护拒绝，截止后复用已保存报告完成record，没有重采或提前成功。210池事件、原精选、人物/个股/AI及热点完整保留。学习Nature3（1近期/2往期）、Science2往期且缺1，保留14篇往期；近期关节炎候选因临床争议/证据缺口未发布。小知识5条，基础知识当天已有寓言达到1篇上限而跳过。宏观无触发；Nasdaq周末前移三周窗口，2871原始/112精选，新增AXP75分、pending0，GAAP和调整后收益及预期口径分开；补32家公认主营。CNN约21.0（10月23日23:39:32Z）、VIX19.03（10月22日美东收盘）。分阶段细耗时无法区分的研究不补造；提交和Cloudflare核验见publication。未运行本地test/check/build/预览。
- 最近20:30样本：[2026-10-23运行日志](../data/ops-runs/2026-10-23-2030.json)及[分批审计](../data/collection-runs/2026-10-23-2030.json)。Grok首页有限两次刷新后恢复登录，当前Expert与模型菜单/截图均未显示4.7，按当前规则未发送查询。30对象全failed，成功截止保留；新闻两轮/六包未执行，无新候选跳过追源及反证，Bot仍暂停。全部旧卡、周榜、热点与历史阅读记录保留。学习新增1课订单积压与收入回款、5个独立小知识（3条复用早报论文证据及原核对时间，2条限定官方统计教育资料），论文按false跳过。Nasdaq1282原始/83精选，新增下周SAN并补官方主营简介，pending0；旧评价不重查。宏观无到期/过时触发；CNN23.7（10月23日12:13:40Z）、VIX19.03（10月22日美东收盘）。初始15:00未完成的未提交审计与work文件保留，不冒称已完成该期。提交与部署以本期审计publication为准；未运行本地test/check/build/预览。
- 手动完整样本：[19:43截止运行日志](../data/ops-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)及[采集审计](../data/collection-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)。手动成功不能替代定时触发验收。
- 严格增量手动样本：[23:38:52截止运行日志](../data/ops-runs/manual-20261018-233852.json)及[采集审计](../data/collection-runs/manual-20261018-233852.json)。23对象从20:30严格接续；内容推送及线上六项资源核对完成，用时23分02秒，人物1条新热度，其余无合格新增，旧重点保留。该时间不含首个计时点之前准备及后续审计收尾。
- [耗时复盘](CONTENT_RUN_PERFORMANCE.md)：两个前置样本均值25分35秒；首个严格增量样本23分02秒。包含统计边界与实际阶段跨度，尚不能证明连续提速。

待推进动作只在[TASKS](../TASKS.md)维护。规则修改沿革从Git按需查询，不在本入口追加版本史或已完成清单。
