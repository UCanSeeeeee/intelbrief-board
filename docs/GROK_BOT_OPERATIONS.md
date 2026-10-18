# 当前内容运营

## 执行与来源

本机Codex负责总编排、筛选、数据写入及发布；工作日北京时间08:00/15:00/20:30、周六日08:00一次。原有本机任务为`intelbrief-08-00`、`intelbrief-15-00`、`intelbrief-20-30`。本机需要开机、联网、应用和执行环境可用；Grok登录、额度及Git发布权限也必须可用。

Grok网页版为X检索第一路径；唯一备用为额度可用的Grok Bot「X+github」。当前Bot主例行任务、Webhook与GitHub探针暂停，不重试耗尽额度、不自动恢复。不得绕过[AGENTS采集边界](../AGENTS.md#讯息采集硬规则用户于2026-10-11明确指定)。财报、宏观走各自已授权的官方来源。

## 每轮入口与互斥

1. 按AGENTS核对原仓库、master和改动，首次写入前`git pull --ff-only origin master`，保留他人工作。
2. 冻结本轮截止，读取[增量采集](INCREMENTAL_COLLECTION.md)，运行`npm run collection:plan -- <CUTOFF>`。未安排的周末批次立即结束；不等待更晚截止、不补造过去期次。
3. 按侧栏独立批次串行执行，不混用上下文或候选；每批先可靠保存结果，再按对象更新共享进度。X批次有新候选或实质变化才追源、查反证；空候选明确跳过，旧证据无变化复用。
4. 学习只复用验收证据，工作日晚批/周末早批处理；宏观只查到期或过时，财报按专门契约处理待评价结果。
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

- 本机真实到点发布样本：[2026-10-18 20:30运行日志](../data/ops-runs/2026-10-18-2030.json)及[七批审计](../data/collection-runs/2026-10-18-2030.json)。证明一次在线到点运行及发布，不证明连续可靠、离线可运行或增量优化后的效率。
- 手动完整样本：[19:43截止运行日志](../data/ops-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)及[采集审计](../data/collection-runs/manual-cb8dad62-83c2-4836-b5b1-25716bef981d.json)。手动成功不能替代定时触发验收。
- 严格增量手动样本：[23:38:52截止运行日志](../data/ops-runs/manual-20261018-233852.json)及[采集审计](../data/collection-runs/manual-20261018-233852.json)。23对象从20:30严格接续；内容推送及线上六项资源核对完成，用时23分02秒，人物1条新热度，其余无合格新增，旧重点保留。该时间不含首个计时点之前准备及后续审计收尾。
- [耗时复盘](CONTENT_RUN_PERFORMANCE.md)：两个前置样本均值25分35秒；首个严格增量样本23分02秒。包含统计边界与实际阶段跨度，尚不能证明连续提速。

待推进动作只在[TASKS](../TASKS.md)维护。规则修改沿革从Git按需查询，不在本入口追加版本史或已完成清单。
