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
    return window.DailyRecords.merge({},section.data)
      .filter(row=>row.item.selection!=='engagement')
      .map(row=>section.id==='news'?{...row,group:row.group==='focus'?'市场焦点':'多学科洞察'}:row);
  }
  loaded.forEach(s=>{s.entries=entries(s);});
  const cutoffDays=loaded.filter(s=>!s.error).map(s=>V.day(s.data.hotspotCutoff||s.data.cutoff||s.data.asOf)).filter(Boolean);
  const current=cutoffDays.sort().at(-1)||V.day(new Date().toISOString());
  const days=window.DailyRecords.recentDays([current,...loaded.flatMap(s=>s.entries.map(e=>e.at))]);
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
        const groupTitle=section.id==='news'?V.escape(group.label):`<a class="daily-heading-link" href="${section.path}?tab=${encodeURIComponent(group.id)}">${V.escape(group.label)} <span aria-hidden="true">↗</span></a>`;
        return `<section class="daily-subsection"><header><h3>${groupTitle}</h3></header><div class="signal-list">${html}</div></section>`;
      }).join('');
      const notice=section.error?'':V.collectionNotice(section.data);
      const content=section.error?'<p class="empty-state">本栏目读取失败，其他栏目仍可阅读。</p>':sections?`${notice?`<p class="collection-notice" role="status">${V.escape(notice)}</p>`:''}${sections}`:notice?`<p class="collection-notice" role="status">${V.escape(notice)}；所选日期暂无已收录内容。</p>`:'<p class="daily-empty">本日暂无新增或实质进展</p>';
      return `<section class="daily-category" id="daily-${section.id}"><header class="daily-category-head"><h2><a class="daily-heading-link" href="${section.path}">${section.name} <span aria-hidden="true">↗</span></a></h2></header>${content}</section>`;
    }).join('');
    const url=new URL(location.href);url.searchParams.set('date',selected);history.replaceState(null,'',url.pathname+url.search);
  }
  dateSelect.addEventListener('change',render);render();
})();
