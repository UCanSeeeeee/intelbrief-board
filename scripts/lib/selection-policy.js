// People-page selection policy (user 2026-10-13): per tab, value-rule items first,
// top up with the tab's own highest-engagement posts; 0 rule items => at most 3 engagement items.
// Engagement numbers must come from the X tool response; never invented.
const METRICS=['likes','reposts','replies','quotes','views','bookmarks'];
function selectionOf(item){return item.selection||'rule';}
function checkEngagement(e){
  if(!e||typeof e!=='object') return '缺少 engagement';
  const present=METRICS.filter(k=>e[k]!=null);
  if(!present.length) return 'engagement 没有任何互动数';
  for(const k of present) if(!Number.isInteger(e[k])||e[k]<0) return `engagement.${k} 必须为非负整数`;
  for(const k of Object.keys(e)) if(!METRICS.includes(k)&&!['capturedAt','source'].includes(k)) return `engagement 未知字段 ${k}`;
  if(!e.capturedAt||Number.isNaN(Date.parse(e.capturedAt))) return 'engagement.capturedAt 无效';
  if(typeof e.source!=='string'||!e.source.trim()) return 'engagement.source 缺失';
  return '';
}
function engagementScore(e){return e?(e.likes||0)+2*(e.reposts||0)+(e.replies||0)+(e.quotes||0):0;}
// Returns list of error strings. tabItems = items already filtered to tab's latest window.
function checkTabSelection(tab,policy,tabItems){
  const errors=[];
  if(!policy) return errors;
  for(const item of tabItems){
    const s=selectionOf(item);
    if(!['rule','engagement'].includes(s)) errors.push(`${tab.label}：selection 无效 ${item.eventKey}`);
    if(s==='engagement'){
      const msg=checkEngagement(item.engagement); if(msg) errors.push(`${tab.label}：热度动态 ${item.eventKey} ${msg}`);
      if(item.tier!=='watch') errors.push(`${tab.label}：热度动态 ${item.eventKey} 必须为 watch 层级`);
      if(item.weeklyRanks&&Object.keys(item.weeklyRanks).length) errors.push(`${tab.label}：热度动态 ${item.eventKey} 不得进入重点榜`);
      if(item.tabIds.length!==1) errors.push(`${tab.label}：热度动态 ${item.eventKey} 只能来自本 Tab 自身来源`);
    } else if(item.engagement!=null){const msg=checkEngagement(item.engagement); if(msg) errors.push(`${tab.label}：${item.eventKey} ${msg}`);}
  }
  const rule=tabItems.filter(i=>selectionOf(i)==='rule').length;
  const fill=tabItems.length-rule;
  const target=Number(policy.target)||tab.latestLimit;
  const zero=Number(policy.zeroPassFallback)||3;
  if(rule+fill>target) errors.push(`${tab.label}：规则条目+热度动态超过 ${target}`);
  if(rule===0&&fill>zero) errors.push(`${tab.label}：无规则条目时热度动态最多 ${zero} 条`);
  return errors;
}
module.exports={METRICS,selectionOf,checkEngagement,checkTabSelection,engagementScore};
