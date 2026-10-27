// Only these short, per-symbol messages go to Grok. Publication fields stay local.
function hotspotPrompts(config, cutoff) {
  return config.tabs.map(tab => {
    const keywords = tab.hotspotKeywords || [tab.symbol];
    return {
      id: tab.id,
      keywords,
      prompt: `给我过去24小时内包含“${keywords.join('”或“')}”的浏览量最高五个X帖子。除关键词和24小时外不加其他筛选。附作者、发帖时间、浏览量、原文摘录、中文摘要和原帖链接。截止时间：${cutoff}。`
    };
  });
}
module.exports = {hotspotPrompts};
