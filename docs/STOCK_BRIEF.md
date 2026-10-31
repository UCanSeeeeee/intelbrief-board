# 美股定时简报：执行与数据约定

采用日期：2026-10-11。用户确认的筛选框架为「多学科认知和夜雨知识库」。本文是简报流程的主要维护位置；频率和条数以 `config/stock-brief.json` 为机器配置。

当前由本机Codex内容运营执行，X信息优先用Grok Bot、网页备用；网页“更新”入口仍保持删除。一次定时触发先按侧边栏Tab分批，美股讯息只是其中一个独立批次，不与人物、个股、AI或日历候选混采。手动与定时共用逐对象采集进度，仍不得覆盖冻结归档；当前时间执行入口见docs/INCREMENTAL_COLLECTION.md。

## 产品规则

- 北京时间周一至周五08:00/20:00、周六08:00、周日20:00启动。启动、实际采集截止和发布分开，不持续扫描。
- **按北京时间批次整理**：周一08:00即可收录周六00:00以来的周末消息，20:00继续复核保留；不等美国开盘，不由美股节假日推迟，详见 [北京时间批次](TRADING_DAY_READING.md)。财报日历仍顺带复核，不新增刷新频率。
- **采集、展示与保留分离**：先运行 `npm run brief:context`，展示回溯平时覆盖过去24小时，周一覆盖周六00:00至当期截止；检索逐对象严格接上次成功截止，手动与定时共享；断档连续分片最多14天，不跳过旧缺口。待阅卡片按北京时间阅读日跨期保留，不受三期轮换影响。
- 第一组 5 件事：本期检索范围内最受市场关注、最影响美股整体方向的独立事件。以影响广度、重要性、时效、相对预期变化排序，说明关注依据；没有横向数据就不声称客观全网前五。
- 第二组另外 10 件事：以多学科认知与夜雨知识库筛选，说明「事件 → 中间变量 → 企业利润/折现率/资金结构 → 美股影响」以及反向条件。至少连接两个学科；不能只贴知识卡标签。
- 两组按事件去重，同一发布/同源转述不拆成多个名额。个股议题沿用 AI 相关大中型公司的既有范围；宏观与整体市场事件不受个股池限制。不产出交易指令。
- 只从 X 获取证据。外链、Grok 的概述或知识库里的旧观点不是当期已证实事实。区别已直读原帖与采集器转述；未能查清的时间、原文、身份不得猜测。没有准确发帖时间与 URL 的候选不收录。
- 满额才标为完整；证据不足保留实际条目并说明缺额，全部失败发布失败记录。周末标明休市背景，不把前一收盘价当实时行情。延续事件必须说明为何仍重要，不用旧闻冒充新增。
- 期次选择器将定时和手动合并后只显示最近三期，默认提供“当前重点（累计保留）”；发布程序先持久化完整卡片再轮换目录，冻结归档与待阅池不删除。
- 可信度与市场影响排序分开。自动分数不是概率；当前来源规则尚未经结果校准。事件分数取所附来源初评分最低值，属于保守的证据摘要，不是贝叶斯聚合。仅采集器返回的来源最高 49 分，界面明确标注未独立直读。
- 每条卡片开头显示 X 作者；`fact` 是忠实翻译或概括后的中文信息摘要，不写“Grok 返回／原帖称”等采集过程；影响判断默认展开，其后显示事件时间与主原帖链接。按用户2026-10-12最新UI要求，前台不展示反向条件，所有阅读内容默认展开；优先于共享质量技能的旧布局约定。采集路径、独立直读缺口和内部反证保留在归档JSON，不删除历史字段。

- 人名（2026-10-13）：人名保留原文写法（如 Satya Nadella、Donald Trump），不写中文音译（纳德拉、特朗普等）；每张卡片的 `people` 列出提到的人物及 ≤15 字简介，来自 `config/person-registry.json`。登记表外的新人物：先在登记表新增原文名、经核实的简介、中文音译别名和匹配词，再发布。由 `prepareBrief` 校验并生成，采集 JSON 无需手写 `people`。

## 每次定时执行

1. 在本仓库根目录（`git rev-parse --show-toplevel`；不要写死机器路径）按 AGENTS.md 在修改前执行 `git pull --ff-only origin master`，读取 `CONTEXT.md`、`TASKS.md`、本文件及 `config/research-guidance.json` 指向的项目知识库与采集 SOP，检查 git 状态，保留其他工作。项目内版本是采集时强制采用的当前快照；共享 `us-equity-x-intelligence`、`us-equity-multidisciplinary-knowledge` 和质量技能仅在当前环境可用时用于补充与复核；云端无本机技能时直接使用仓库契约，不能跳过项目 SOP。
2. 运行 `npm run brief:slot` 确定最近已到期时段。若该期 JSON 已存在，不覆盖。若仅部署未成功，重试该文件发布即可，不重采集。错过多个时段只制作最近一期，明确延迟和漏期，不伪造过去快照。
2a. **禁止空等截止**：period id 与 `scheduledFor` 必须来自 `config/stock-brief.json` 当前 slots（`0800`/`2000` 对应 `08:00`/`20:00`）；旧时段只保留历史归档兼容。写完内容后若 `now >= scheduledFor`（或 `brief:slot` 的 previous 已到期），**立即**进入 publish→提交推送→线上核验（不运行本地测试/check/build/预览）；**禁止**为空等整点或平台挂起上限。可用程序语义：`isPublishDue(scheduledFor)` 为 true 就发。
3. 计划期次仍为08:00 / 20:00；信息截止取实际开始采集时冻结的当前时间，精确到秒、带时区。运行 `npm run brief:context -- 实际截止` 获取北京时间阅读周期period、展示/检索窗口、待补查区间和完整待阅池。按 TRADING_DAY_READING 执行，按collectionUnits从上次成功采集截止接至实际截止；手动已成功部分可推进。候选不足与请求失败分开，旧证据无变化复用，不重新研究全池。截止之后的帖子留给下一期。原帖时间与首次收录时间分开，延迟发现要标注，不补造过去期次。
4. 严格遵守 [AGENTS.md的采集硬规则](../AGENTS.md)：本机执行者先使用Grok Bot「X+github」；Bot不可用、额度不足或覆盖不足时使用已登录Grok网页版Expert。两条都失败则报告失败，不改用X API、直访X或普通搜索。不得改动登录、发帖、私信、点赞、关注等；登录失效请用户处理，不从历史对话读取密码。
5. 依项目采集 SOP 用公开问题做广泛主题检索，再找原始来源、相反证据、时间与上下文。Grok可读取已授权的项目内知识库以生成公开检索问题，不读取仓库外私有知识库、个人资料或账户信息。半导体、电力、AI 落地三个核心包以及宏观资本成本、地缘能源物流、市场结构行为三个跨学科包必须留下实际查询与覆盖记录；无合格结果可以不入选，不强行填配额。
6. 必须保留两个独立、可审计的检索阶段：第一轮宽扫并横向比较市场焦点；第二轮先把知识卡转成财政利率、AI 实物基础、地缘能源物流、市场结构与 AI 企业微观等公开问题，再重新检索、追源和寻找反证。不能把第一轮余下候选直接改名为多学科结果，也不能在没有执行第二轮时写 0 条。最后由本机执行器完成最多 5+10 的筛选及中文分析，保存两轮各自的检索问题、覆盖缺口与主要落选候选。互动量只描述可观察热度，不能证明事实或因果。记录相对上期的新增/进展/延续。
7. 用 `apply_patch` 在临时目录准备 JSON；执行 `npm run brief:publish -- FILE`，发布程序自身按数据契约检查后写入不可覆盖的 `data/stock-briefs/YYYY-MM-DD-HHMM.json` 并更新目录，不额外运行本地验证。不把测试夹具或私有材料放入线上数据。发布会同时持久化 `data/reading-board.json`，请检查复核动作和跨期精选是否符合 TRADING_DAY_READING。
8. 审查本期中文内容、条数、链接、时间、引用和因果边界，默认不运行本地测试/check/build或预览。只暂存本期归档、目录、data/reading-board.json、对象进度、实际检索记录及必要财报数据的明确路径，提交并推送`master`。发生冲突不强推、不重置，保留断点。确认线上归档与持久池JSON和本次提交一致后才称已发布。
9. 一次采集故障最多两次有限重试；仍失败则发布失败记录并报告缺口，不无限等待。任务结束；下次由定时触发。正常报期次/条数与页面链接，失败报具体原因，不承诺已经稳定运行。

本机Codex任务依赖电脑、应用与登录环境可用；运行证据及未决边界见[运营说明](GROK_BOT_OPERATIONS.md)。页面能加载或任务创建成功不等于采集链已跑通。Grok材料标为采集器转述，不得声称执行器独立直读原帖。

## JSON 输入

顶层必填：

| 字段 | 内容 |
|---|---|
| `scheduledFor` | 北京时间期次，如 `2026-10-31T20:00:00+08:00` |
| `informationCutoff` | 本次实际开始采集时冻结的当前时间，含时区；历史归档缺该字段时回退 `scheduledFor` |
| `windowStart` | 带时区的检索起点，取brief:context的searchWindowStart；精确对象区间以collectionUnits为准 |
| `collectionMode` / `collectionUnits` | 新采集用incremental-v1并附计划给出的逐对象区间；每条新闻标collectionUnit |
| `displayWindowStart` / `displayWindowEnd` | 取brief:context的start/end，至少24小时，周一从北京时间周六00:00起；存在时为schemaVersion 2 |
| `carriedOver` | 历史v2期次引用兼容；当前跨期持久展示由reading-board负责，不用三期引用代替待阅池 |
| `checklist` | v2 必填：检索前清单 `[{item,status:covered/no-result/insufficient,note}]`，未覆盖项必须写 note |
| `candidates` | v2 必填：两轮候选到入选的映射 `[{eventKey,round:1/2,decision:selected/excluded,reason}]` |
| `status` | `complete` 完整、`partial` 缺额（实际检索后0条合格也属此类，须有查询、清单与原因）、`failed` 采集失败；不能因0条就判采集失败 |
| `summary`, `marketContext` | 市场概览与交易时段/休市背景；保留在数据中供审计，不在期次选择区展示 |
| `coverage` | `{method:文字, queries:[实际查询], gaps:[缺口]}` |
| `selectionRationale` | 两组的比较及排序理由 |
| `excludedCandidates` | `[{eventKey:候选事件,reason:落选原因}]`，无则空数组 |
| `focus`, `insights` | 两组事件数组，完整时严格 5+10 |
| `shortfallReason` | 缺额/失败必填，完整可不填 |

每条事件必填 `eventKey`（同一事件跨期沿用稳定键）、`title`、`fact`（来源具体声称什么）、`impact`（独立判断）、`direction`（利多/利空/双向/待定）、`horizon`、`affected`（数组）、`counterCase`、`selectionReason`、`credibilityReason`、`change`（新增/进展/延续）、`sources`。`eventTime` 是带时区的真实事件时间；未知填 null 并填 `eventTimeNote`，预告未来事件加 `futureEventNote`。延续加 `continuationReason`，窗口前的背景来源加 `contextSourceNote`。

焦点另需 `attentionEvidence`。多学科另需 `knowledgeCards`（项目知识库 M01–M10、I01–I10、R01–R08 中的适用卡）、`disciplines`（至少两个不同学科）、`knowledgeApplication`（本期条件性传导与知识库适用边界）。项目知识库是经过整理的执行快照，不把共享 skill 全文、人物原始消息或私密资料复制进仓库。

每个来源必填 `url`（规范 X/Twitter status 链接）、`postId`（字符串）、`username`、`publishedAt`、`checkedAt`、`excerpt`（准确短摘录）、`verification`（`direct` 原帖直读 / `collector-report` 采集器转述）、`verificationNote`。全部日期含时区；核验时间真实记录，原文摘录避免长篇搬运。程序生成可信度，不接受手工虚构高分。

`id`、`schemaVersion`、`timezone`、`generatedAt`、`counts` 和可信度由发布程序生成。每一期归档不可覆盖；有错在后一期指出更正并引用原期次。失败期次 `focus:[]`、`insights:[]`，仍记录尝试方式与原因。

跨期精选和复核字段 `readingSelection` / `readingDecisions` 见 [北京时间批次字段契约](TRADING_DAY_READING.md)。同一次发布按该契约更新持久池。

## 调度维护

期次选择目录按截止时间倒序，定时与手动合计最多3期；失败期次也计入。`config/stock-brief.json.historyLimit=3`是唯一上限。轮换只更新目录，不删除冻结归档和累计阅读池；当前重点不属于一期快照。首页失败时明确提示，不把尝试时间称为已采集截止。

当前本机Codex任务周一至周五08:00/20:00、周六08:00、周日20:00；每次先运行 `npm run collection:plan -- <实际截止> <计划期次>`，再按计划串行完成各侧边栏批次。Grok Bot原生任务保持暂停，旧X API工作流与网页队列消费者仍停用。变更时间需同步配置、页面与本机任务，避免重复任务。
