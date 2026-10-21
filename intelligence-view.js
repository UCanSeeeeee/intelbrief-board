/* Read-only presentation shared by the daily stream and independent ticker hotspots. */
(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = value => typeof value === 'number' ? (Number.isFinite(value) ? value : 0) : value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const day = value => parse(value) ? new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)) : '';
  const time = value => parse(value) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '未查明';
  const safeUrl = value => /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(value || '') ? value : '';
  const key = item => item.eventKey || safeUrl(item.url) || item.id;
  const materialAt = item => item.lastMaterialAt || item.firstIncludedAt || item.publishedAt;
  function heatCompare(a,b) {
    for (const metric of ['likes','reposts','replies']) {
      const av=Number.isFinite(a.engagement?.[metric])?a.engagement[metric]:-1;
      const bv=Number.isFinite(b.engagement?.[metric])?b.engagement[metric]:-1;
      if(av!==bv)return bv-av;
    }
    return parse(b.publishedAt)-parse(a.publishedAt);
  }
  function hotspotItems(data, tab, policy) {
    const report=data.hotspotCoverage?.tabs?.find(r=>r.id===tab.id);
    const cutoff=parse(report?.cutoff || data.hotspotCutoff);
    return (data.hotspots||[]).filter(i=>i.tabId===tab.id && (!cutoff || parse(i.publishedAt)>=cutoff-(policy?.windowDays||1)*86400000))
      .sort(heatCompare).slice(0,policy?.limit||3);
  }
  function card(item, {hotspot=false, label='', heading='h4'}={}) {
    const primary=item.sources?.[0] || {};
    const url=safeUrl(item.url || primary.url);
    const author=item.author || (primary.username ? '@'+primary.username : '来源待注明');
    const published=item.publishedAt || primary.publishedAt;
    const people=(item.people||[]).map(p=>`<span class="person-chip"><span class="person-chip-name">${escape(p.name)}</span><span class="person-chip-intro">${escape(p.intro)}</span></span>`).join('');
    const impact=item.whyItMatters || item.impact;
    const metrics=Object.entries({likes:'赞',reposts:'转发',replies:'回复',views:'浏览'}).filter(([field])=>Number.isInteger(item.engagement?.[field])).map(([field,name])=>`${name} ${Number(item.engagement[field]).toLocaleString('zh-CN')}`).join(' · ');
    return `<article class="signal-card${hotspot?' ticker-hotspot':''}">
      <div class="signal-card-head signal-meta"><span class="signal-author">作者 <strong>${escape(author)}</strong></span><time datetime="${escape(published)}">${escape(time(published))}（北京时间）</time><span class="signal-verification">${hotspot?'非官方 · 讨论热点':item.selection==='engagement'?'热度动态':'待独立核验'}</span>${label?`<span>${escape(label)}</span>`:''}</div>
      <${heading}>${escape(item.title)}</${heading}>
      ${people?`<p class="card-people"><strong>相关人物</strong>${people}</p>`:''}
      <div class="signal-copy"><p class="signal-fact"><strong>信息摘要</strong>${escape(item.fact)}</p>${impact?`<p class="signal-impact"><strong>影响判断</strong>${escape(impact)}</p>`:''}</div>
      ${item.knowledgeApplication?`<div class="brief-knowledge"><strong>${escape((item.disciplines||[]).join(' × '))}</strong><p>${escape(item.knowledgeApplication)}</p></div>`:''}
      ${item.affected?.length?`<p class="signal-scope"><strong>影响范围</strong>${item.affected.map(escape).join('、')}</p>`:''}
      ${item.direction?`<p class="signal-scope"><strong>方向与窗口</strong>${escape(item.direction)} · ${escape(item.horizon)}</p>`:''}
      ${(hotspot||item.selection==='engagement')&&metrics?`<p class="signal-scope hotspot-metrics">${escape(metrics)} · ${escape(time(item.engagement.capturedAt))}采样</p>`:''}
      ${hotspot&&item.caveat?`<p class="hotspot-caveat">${escape(item.caveat)}</p>`:''}
      <footer><span>事件时间 ${item.eventTime?escape(time(item.eventTime))+'（北京时间）':escape(item.eventTimeNote||'未知')}</span>${url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>`:''}</footer>
    </article>`;
  }
  function hotspotSection(data,tab,policy) {
    const report=data.hotspotCoverage?.tabs?.find(r=>r.id===tab.id);
    const visible=hotspotItems(data,tab,policy);
    const notice=!report?'尚未完成首次采集':report.status==='failed'?'本次热点采集失败，保留此前内容':report.status==='partial'?'本次热点覆盖不完整':visible.length?'':'本次检索未取得可收录热点';
    return `<section class="signal-section" aria-labelledby="${escape(tab.id)}-hotspots"><header class="signal-section-head"><h3 id="${escape(tab.id)}-hotspots">X 热点 · 非官方</h3>${report?.cutoff?`<time class="hotspot-cutoff">截至 ${escape(time(report.cutoff))}（北京时间）</time>`:''}</header>${notice?`<p class="hotspot-status">${escape(notice)}${report?.note&&report.status!=='complete'?'：'+escape(report.note):''}</p>`:''}<div class="signal-list">${visible.map(i=>card(i,{hotspot:true})).join('')}</div></section>`;
  }
  window.IntelligenceView={escape,parse,day,time,safeUrl,key,materialAt,card,heatCompare,hotspotItems,hotspotSection};
})();
