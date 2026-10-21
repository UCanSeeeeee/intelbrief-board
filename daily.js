/* One continuous reading stream. No collector, scheduler or write endpoint. */
(async function () {
  const board=document.getElementById('daily-board'), dateSelect=document.getElementById('daily-date');
  if(!board || !dateSelect)return;
  const V=window.IntelligenceView;
  async function read(url) {const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('读取失败');return r.json();}
  const definitions=[
    {id:'news',name:'美股讯息',path:'index.html',data:'data/reading-board.json'},
    {id:'people',name:'具体人物',path:'people.html',data:'data/people-intelligence.json',config:'config/people-intelligence.json'},
    {id:'tickers',name:'具体个股',path:'tickers.html',data:'data/ticker-intelligence.json',config:'config/ticker-intelligence.json'},
    {id:'ai',name:'AI板块',path:'ai.html',data:'data/ai-intelligence.json',config:'config/ai-intelligence.json'}
  ];
  const loaded=await Promise.all(definitions.map(async definition=>{
    try {const [data,config]=await Promise.all([read(definition.data),definition.config?read(definition.config):null]);return {...definition,data,config};}
    catch{return {...definition,error:true};}
  }));
  function entries(section) {
    if(section.error)return [];
    if(section.id==='news')return (section.data.events||[]).filter(e=>e.state==='active'||(e.review&&e.state!=='served')).map(e=>({
      item:e.event,at:e.review&&e.state!=='active'?e.review.checkedAt:e.lastMaterialAt||e.firstSeenAt,
      group:e.group==='focus'?'市场焦点':'多学科洞察',review:e.review&&e.state!=='active'?e.review:null,
      history:(e.history||[]).filter(h=>h.event)
    }));
    const values=[...new Map([...(section.data.items||[]),...(section.data.retainedItems||[])].map(i=>[V.key(i),i])).values()];
    const out=values.map(item=>({item,at:V.materialAt(item),tabIds:item.tabIds||[],legacy:!item.lastMaterialAt&&!item.firstIncludedAt}));
    if(section.id==='tickers')for(const item of [...new Map([...(section.data.hotspots||[]),...(section.data.hotspotRetained||[])].map(i=>[i.tabId+':'+V.key(i),i])).values()])out.push({item,at:V.materialAt(item),tabIds:[item.tabId],hotspot:true});
    return out;
  }
  loaded.forEach(s=>{s.entries=entries(s);});
  const cutoffDays=loaded.filter(s=>!s.error).map(s=>V.day(s.data.hotspotCutoff||s.data.cutoff||s.data.asOf)).filter(Boolean);
  const current=cutoffDays.sort().at(-1)||V.day(new Date().toISOString());
  const days=[...new Set([current,...loaded.flatMap(s=>s.entries.map(e=>V.day(e.at))).filter(Boolean)])].sort().reverse();
  dateSelect.innerHTML=days.map(d=>`<option value="${V.escape(d)}">${V.escape(d)}</option>`).join('');
  const requested=new URLSearchParams(location.search).get('date');
  dateSelect.value=days.includes(requested)?requested:current;
  function render() {
    const selected=dateSelect.value;
    // De-duplicate within each source category, retain cross-category context and link it.
    const seen=new Map();
    board.innerHTML=loaded.map(section=>{
      const rows=section.entries.filter(e=>V.day(e.at)===selected).sort((a,b)=>V.parse(b.at)-V.parse(a.at));
      const groups=section.id==='news'?['市场焦点','多学科洞察'].map(name=>({id:name,label:name})):(section.config?.tabs||[]);
      const sections=groups.map(group=>{
        const groupRows=rows.filter(r=>section.id==='news'?r.group===group.id:r.tabIds.includes(group.id));
        if(!groupRows.length)return '';
        const html=groupRows.map((entry,index)=>{
          const item=entry.item, dedupKey=section.id+':'+(entry.hotspot?'hot:':'value:')+V.key(item);
          if(seen.has(dedupKey))return `<p class="daily-duplicate">${V.escape(item.title)} · <a href="#${seen.get(dedupKey)}">已在上文收录</a></p>`;
          const anchor=`daily-${section.id}-${V.escape(group.id)}-${index}`;seen.set(dedupKey,anchor);
          const review=entry.review?`<p class="hotspot-caveat">更正：${V.escape(entry.review.reason)}${V.safeUrl(entry.review.sourceUrl)?` · <a href="${V.escape(entry.review.sourceUrl)}" target="_blank" rel="noopener noreferrer">更正依据 ↗</a>`:''}</p>`:'';
          const history=entry.history?.length?`<section class="daily-history"><h5>事件进展时间线</h5>${entry.history.map(h=>`<p>${V.escape(V.time(h.changedAt))} · ${V.escape(h.event.fact)}</p>`).join('')}</section>`:'';
          return `<div id="${anchor}" class="daily-entry">${review}${V.card(item,{hotspot:entry.hotspot,label:entry.legacy?'发布于所选日':V.day(item.firstIncludedAt)===selected?'当日收录':'当日进展'})}${history}</div>`;
        }).join('');
        return `<section class="daily-subsection"><header><h3>${V.escape(group.label)}</h3>${section.id!=='news'?`<a href="${section.path}?tab=${encodeURIComponent(group.id)}">查看栏目 ↗</a>`:''}</header><div class="signal-list">${html}</div></section>`;
      }).join('');
      return `<section class="daily-category" id="daily-${section.id}"><header class="daily-category-head"><h2>${section.name}</h2><a href="${section.path}">进入栏目 ↗</a></header>${section.error?'<p class="empty-state">本栏目读取失败，其他栏目仍可阅读。</p>':sections||'<p class="daily-empty">本日暂无新增或实质进展</p>'}</section>`;
    }).join('');
    const url=new URL(location.href);url.searchParams.set('date',selected);history.replaceState(null,'',url.pathname+url.search);
  }
  dateSelect.addEventListener('change',render);render();
})();
