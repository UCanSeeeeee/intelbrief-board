# 每日学习

四个顶部Tab：基础知识讲解、Nature、Science、反直觉小知识。默认基础知识。每日趣事停止采集和展示；旧dailyCuriosities及其关联保留为历史证据。

基础知识按真实`updatedAt`倒序，最新知识先读；专业解释和故事全文保留，不折叠。日期未知不补造。

## 执行时间

- 每天北京时间08:00：Nature、Science各目标3篇、上限3篇，两刊独立，不凑数。按[论文SOP](JOURNAL_PAPERS.md)执行。
- 工作日20:30、周末08:00：基础知识复用合格证据，每天最多新增1个；[反直觉小知识](COUNTERINTUITIVE_KNOWLEDGE.md)目标5条。用户单独要求补充时按指定数量执行。
- 只执行learning.components中为真的papers、basics、counterintuitive部分。15:00不处理学习，20:30不重复论文。不新增任务，不因新闻无新增跳过到期学习。
- 单项失败保留旧内容，实际状态写审计；网页不铺阅读/检索/数量说明。

## 基础知识

专业版professional保存definition、mechanism、whyItMatters和signals，写准确概念、过程与约束、意义和可观察指标。故事版story面向无行业背景的成年人，明确例子是虚构，mapping解释类比关系，boundary指出失真；两版不产生不同事实。

字段仍为id/title/category/updatedAt/professional/story/commonMistakes/relatedCuriosityIds/sources；新内容relatedCuriosityIds为空，旧关系保留。来源复用已验收X材料或公开项目研究知识库，知识解释不冒充新闻原帖事实，不扩大X采集路径。

## 页面

四个Tab支持方向键、Home、End，URL为?tab=basics、nature、science或counterintuitive。两版同时展开、手机单栏。论文结论在前、实验过程明确；不展示阅读范围、覆盖说明和单日期选择器，内部契约保留。遵守[设计系统](DESIGN_SYSTEM.md)。
