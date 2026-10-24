/* Shared by publishers and the reader: dated snapshots survive rolling source windows. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DailyRecords=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const day=value=>Number.isFinite(Date.parse(value))?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,10):'';
  const recentDays=values=>[...new Set(values.map(day).filter(Boolean))].sort().reverse().slice(0,3);
  const key=item=>item.eventKey||item.url||item.id;
  function current(data={}) {
    if(Array.isArray(data.events))return data.events.flatMap(e=>{
      const versions=(e.history||[]).filter(h=>h.event);
      const rows=versions.map((h,i)=>({item:h.event,at:i?versions[i-1].changedAt:e.firstSeenAt,group:e.group,review:e.review?.action!=='keep'?e.review:null}));
      rows.push({item:e.event,at:e.lastMaterialAt||e.firstSeenAt,group:e.group,review:e.review?.action!=='keep'?e.review:null,history:versions});
      if(e.review&&e.review.action!=='keep')rows.push({item:e.event,at:e.review.checkedAt,group:e.group,review:e.review,history:versions});
      return rows;
    });
    const facts=[...new Map([...(data.retainedItems||[]),...(data.items||[])].map(i=>[key(i),i])).values()];
    const hot=[...new Map([...(data.hotspotRetained||[]),...(data.hotspots||[])].map(i=>[i.tabId+':'+key(i),i])).values()];
    return [...facts.map(item=>({item,tabIds:item.tabIds||[]})),...hot.map(item=>({item,tabIds:[item.tabId],hotspot:true}))].map(row=>({...row,at:row.item.lastMaterialAt||row.item.firstIncludedAt||row.item.publishedAt,legacy:!row.item.lastMaterialAt&&!row.item.firstIncludedAt}));
  }
  const recordKey=r=>[day(r.at),r.hotspot?'hot':'value',r.hotspot?r.item.tabId:'',key(r.item)].join(':');
  function merge(previous={},next={}) {
    const records=new Map();
    for(const r of [...(previous.dailyRecords||[]),...current(previous),...(next.dailyRecords||[]),...current(next)])if(day(r.at)&&r.item)records.set(recordKey(r),r);
    // Corrections remain visible on earlier reading dates too.
    for(const event of next.events||[])if(event.review&&event.review.action!=='keep')for(const r of records.values())if(key(r.item)===event.eventKey)r.review=event.review;
    const keptDays=new Set(recentDays([...records.values()].map(r=>r.at)));
    return [...records.values()].filter(r=>keptDays.has(day(r.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  }
  function capture(previous,next){return {...next,dailyRecords:merge(previous,next)};}
  return {current,merge,capture,recentDays};
});
