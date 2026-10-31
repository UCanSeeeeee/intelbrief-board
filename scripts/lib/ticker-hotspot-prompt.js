// Only these short, per-symbol messages go to Grok. Publication fields stay local.
function hotspotPrompts(config, cutoff, units) {
  return config.tabs.map(tab => {
    const keywords = tab.hotspotKeywords || [tab.symbol];
    const unit = units.find(u => u.object === tab.id + ':hotspots');
    if (!unit) throw new Error('缺少个股热点采集窗口：' + tab.id);
    return {
      id: tab.id,
      keywords,
      start: unit.start,
      end: unit.end,
      needsQuery: unit.needsQuery,
      prompt: unit.needsQuery ? `给我发布时间从 ${unit.start}（含）至 ${unit.end}（不含）的、包含“${keywords.join('”或“')}”的浏览量最高五个X帖子。除关键词和时间外不加其他筛选。附作者、发帖时间、浏览量、原文摘录、中文摘要和原帖链接。` : null
    };
  });
}
module.exports = {hotspotPrompts};
