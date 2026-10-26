# 当前内容运营

## 执行与来源

本机Codex负责总编排、筛选、数据写入及发布；工作日北京时间08:00/15:00/20:30、周六日08:00一次。原有本机任务为`intelbrief-08-00`、`intelbrief-15-00`、`intelbrief-20-30`。本机需要开机、联网、应用和执行环境可用；Grok登录、额度及Git发布权限也必须可用。

Grok网页版为X检索第一路径；唯一备用为额度可用的Grok Bot「X+github」。当前Bot主例行任务、Webhook与GitHub探针暂停，不重试耗尽额度、不自动恢复。不得绕过[AGENTS采集边界](../AGENTS.md#讯息采集硬规则用户于2026-10-11明确指定)。财报、宏观、CNN情绪、论文及反直觉小知识走各自明确授权的非X来源，不扩大X采集权限。

用户已确认使用Grok网页版Expert专家模式，不指定模型版本号。每个新会话发送前按AGENTS确认Expert选中，保存实际标签与确认时间；界面不显示版本号不构成阻塞，未知版本不得补写。会员续费为用户自述，不替代每轮实际可用性核对，也不证明Bot独立额度已恢复；续费不自动恢复Bot任务或变更执行归属。

最近15:00运行中，Arc既有Grok页、新建首页及一次刷新均为空白，无法确认登录或Expert，未发送查询；四个独立X批次30对象均failed，成功截止保留2026-10-26北京时间08:00，下一轮从08:00接续。213个持久事件、早报卡片、旧周榜、33条当前热点及119条历史热点均保留；失败不等于无新增。CNN、VIX及财报独立刷新，学习三项按false跳过，宏观无到期/过时触发。当前证据见[本轮分批审计](../data/collection-runs/2026-10-26-1500.json)与[运行日志](../data/ops-runs/2026-10-26-1500.json)，推送和线上状态以审计publication为准。

既有手动样本的CNN、VIX和财报独立刷新凭证见[153400审计](../data/collection-runs/manual-20261024-153400.json)；其中未发送X查询的历史事实不追认成成功。后续只从各对象最新成功截止接续，发布失败只补发布，不重搜已完成窗口。

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

- 最近15:00样本：[2026-10-26运行日志](../data/ops-runs/2026-10-26-1500.json)及[分批审计](../data/collection-runs/2026-10-26-1500.json)。Grok既有页、新首页与一次刷新均空白，AX及截图无输入框/Expert标签；粘贴冲突后先核对精确网址再导航，没有发出查询。30对象均failed，成功截止及pending保留08:00；新闻两轮及六包未执行，无新候选跳过追源/反证，Bot暂停。完整结果先落盘后逐批record，213个池事件、人物20+5保留、个股2事实/33当前热点/119历史热点、AI5卡及全部每日记录原样保留，新闻精选顺序不变。学习components全false，宏观复用早报无触发。Nasdaq2874原始/112精选，pending0，无新公司；恢复刷新器机械改写的既有自主判断及过去已核披露时段，不重查旧评分。CNN21.0（10月23日23:59:44Z）、VIX19.45（10月23日美东收盘）已获取。发布状态见publication；未运行本地test/check/build/预览。
- 最近08:00样本：[2026-10-26运行日志](../data/ops-runs/2026-10-26-0800.json)及[分批审计](../data/collection-runs/2026-10-26-0800.json)。Expert网页可用，人物/个股新页各一次刷新恢复；Bot保持暂停。30对象逐批先完整落盘后record，接续至08:00。新闻两轮22候选合并1条Musk融资陈述，未将400亿美元当NVIDIA确单或已支用；人物2价值4热度，排除TrumpDailyPosts归因不足的帖子；个股无合格新事实，35原始热点审校为33，修正金额换算与摘要补写；AI新增Kimi额度调整公告，未声称已履约。Nature3、Science1均往期，原23篇保留，Science独立缺2；社交媒体论文两次正式更正尚未核清而待核。基础知识、小知识按components=false跳过，趣事停用。宏观无触发；Nasdaq2874原始/112精选、pending0，无新增公司，保留旧评分与自主判断理由。CNN21.0和VIX19.45均为10月23日数据，实际抓取与查询进度分开；VIX首次会话退出输出未捕获，后一次取得官方成功输出。论文发现/核验有交叠，AI原帖在发现中读取后复用，不能伪拆纯阶段耗时。发布状态见publication；未运行本地test/check/build/预览。
- 最近20:30样本：[2026-10-23运行日志](../data/ops-runs/2026-10-23-2030.json)及[分批审计](../data/collection-runs/2026-10-23-2030.json)。Grok首页有限两次刷新后恢复登录，当前Expert与模型菜单/截图均未显示4.7，按当前规则未发送查询。30对象全failed，成功截止保留；新闻两轮/六包未执行，无新候选跳过追源及反证，Bot仍暂停。全部旧卡、周榜、热点与历史阅读记录保留。学习新增1课订单积压与收入回款、5个独立小知识（3条复用早报论文证据及原核对时间，2条限定官方统计教育资料），论文按false跳过。Nasdaq1282原始/83精选，新增下周SAN并补官方主营简介，pending0；旧评价不重查。宏观无到期/过时触发；CNN23.7（10月23日12:13:40Z）、VIX19.03（10月22日美东收盘）。初始15:00未完成的未提交审计与work文件保留，不冒称已完成该期。提交与部署以本期审计publication为准；未运行本地test/check/build/预览。
- 手动完整样本：[19:43截止运行日志](../data/ops-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)及[采集审计](../data/collection-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)。手动成功不能替代定时触发验收。
- 严格增量手动样本：[23:38:52截止运行日志](../data/ops-runs/manual-20261018-233852.json)及[采集审计](../data/collection-runs/manual-20261018-233852.json)。23对象从20:30严格接续；内容推送及线上六项资源核对完成，用时23分02秒，人物1条新热度，其余无合格新增，旧重点保留。该时间不含首个计时点之前准备及后续审计收尾。
- [耗时复盘](CONTENT_RUN_PERFORMANCE.md)：两个前置样本均值25分35秒；首个严格增量样本23分02秒。包含统计边界与实际阶段跨度，尚不能证明连续提速。

待推进动作只在[TASKS](../TASKS.md)维护。规则修改沿革从Git按需查询，不在本入口追加版本史或已完成清单。
