# 当前内容运营

## 执行与来源

本机Codex负责总编排、筛选、数据写入及发布；工作日北京时间08:00/15:00/20:30、周六日08:00一次。原有本机任务为`intelbrief-08-00`、`intelbrief-15-00`、`intelbrief-20-30`。本机需要开机、联网、应用和执行环境可用；Grok登录、额度及Git发布权限也必须可用。

Grok网页版为X检索第一路径；唯一备用为额度可用的Grok Bot「X+github」。当前Bot主例行任务、Webhook与GitHub探针暂停，不重试耗尽额度、不自动恢复。不得绕过[AGENTS采集边界](../AGENTS.md#讯息采集硬规则用户于2026-10-11明确指定)。财报、宏观、CNN情绪、论文及反直觉小知识走各自明确授权的非X来源，不扩大X采集权限。

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

- 最近08:00样本：[2026-10-20运行日志](../data/ops-runs/2026-10-20-0800.json)及[分批审计](../data/collection-runs/2026-10-20-0800.json)。23个X对象从10月19日20:30接至10月20日08:00，先结果后记进度。新闻独立两轮六包3焦点/0洞察，人物1新规则放累计区、4新热度，个股/AI无合格新增；无候选的个股跳过追源/反证。Grok若干工具扩窗/超查询预算偏差已保存，仅采用窗内准确原帖，不称全量覆盖。两刊各3篇（1近期、5往期；Nature正文节选、Science摘要），睡眠两更正、减法部分复现与心理学复现正式争议写入边界，保留原2篇。宏观无到期/过时触发；Nasdaq1268原始/80入选、待评价0，10月29日GILD/SNDK/BUD截断留证。持久池201→204，无旧事件键或有效周榜丢失。内容提交ec293a7，Cloudflare成功，13项公共JSON逐字节一致；默认未运行test/check/build/预览。审计留真实耗时边界及缺口，不把单次完整发布当连续可靠验收。
- 最近20:30样本：[2026-10-19 20:30运行日志](../data/ops-runs/2026-10-19-2030.json)及[分批审计](../data/collection-runs/2026-10-19-2030.json)。23个X对象从08:00成功截止严格接至20:30，补上15:00入口故障窗口；新闻独立两轮六包，新增1焦点/0洞察、人物1规则+3热度、个股1采购计划、AI1发布。各批结果先保存再记进度；有效旧周榜保留，累计池200→201且未丢旧事件键。学习新增4条，睡眠候选因2004勘误正文未取得排除，论文按components跳过、基础知识当日已有内容不重复。Nasdaq80家重点、待评价0，宏观无到期/过时触发。内容提交、Cloudflare成功及13项公共JSON逐字节一致证据见审计；默认未运行本地test/check/build/预览。只读CNN接口上游418时保留本批快照，VIX官方收盘正常。单次成功不证明连续可靠或已达5—10分钟目标。
- 入口故障样本：[2026-10-19 15:00运行日志](../data/ops-runs/2026-10-19-1500.json)及[分批审计](../data/collection-runs/2026-10-19-1500.json)。Grok新开及刷新后空白，未提交X查询，Bot暂停；23对象未推进，旧内容和断点保留。与最近成功样本对照，用于区分入口故障、证据不足和发布状态，不改写成“暂无新增”。
- 手动完整样本：[19:43截止运行日志](../data/ops-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)及[采集审计](../data/collection-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)。手动成功不能替代定时触发验收。
- 严格增量手动样本：[23:38:52截止运行日志](../data/ops-runs/manual-20261018-233852.json)及[采集审计](../data/collection-runs/manual-20261018-233852.json)。23对象从20:30严格接续；内容推送及线上六项资源核对完成，用时23分02秒，人物1条新热度，其余无合格新增，旧重点保留。该时间不含首个计时点之前准备及后续审计收尾。
- [耗时复盘](CONTENT_RUN_PERFORMANCE.md)：两个前置样本均值25分35秒；首个严格增量样本23分02秒。包含统计边界与实际阶段跨度，尚不能证明连续提速。

待推进动作只在[TASKS](../TASKS.md)维护。规则修改沿革从Git按需查询，不在本入口追加版本史或已完成清单。
