/* Immutable editions; browsing an archive never initiates X collection. */
(function () {
  const $ = id => document.getElementById(id);
  if (!$('edition-select')) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '未查明';
  const status = {complete:'已发布',partial:'有缺额',failed:'采集失败'};
  const empty = text => `<div class="empty-state"><strong>${escape(text)}</strong></div>`;
  const originalUrl = source => /^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(source?.url || '') ? source.url : '';
  async function json(url) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('读取失败');
    return response.json();
  }
  function peopleNote(list) {
    // Person intros from config/person-registry.json; shown in full, never truncated.
    if (!Array.isArray(list) || !list.length) return '';
    return `<p class="card-people"><strong>相关人物</strong>${list.map(p => `<span class="person-chip"><span class="person-chip-name">${escape(p.name)}</span><span class="person-chip-intro">${escape(p.intro)}</span></span>`).join('')}</p>`;
  }
  function card(event, index, changeLabel) {
    const knowledge = event.knowledgeApplication ? `<div class="brief-knowledge"><strong>${escape(event.disciplines.join(' × '))}</strong><p>${escape(event.knowledgeApplication)}</p></div>` : '';
    const primary = event.sources[0] || {};
    const primaryUrl = originalUrl(primary);
    const eventTime = event.eventTime ? time(event.eventTime) : event.eventTimeNote;
    return `<article class="x-card brief-card">
      <div class="brief-author"><span>作者 <strong>@${escape(primary.username || '未查明')}</strong></span><span class="brief-published">发布 ${escape(time(primary.publishedAt))}（北京时间）</span><span class="signal-verification">${primary.verification === 'direct' ? '已直读原帖' : '待独立核验'}</span><span class="brief-change">${escape(changeLabel||event.change)}</span></div>
      <div class="brief-card-top"><h3>${escape(event.title)}</h3></div>
      ${peopleNote(event.people)}
      <div class="brief-copy"><p class="brief-fact"><strong>信息摘要</strong> ${escape(event.fact)}</p><p class="brief-impact"><strong>影响判断</strong> ${escape(event.impact)}</p></div>
      ${knowledge}
      <div class="brief-scope"><p><strong>影响范围</strong> ${event.affected.map(escape).join('、')}</p><p><strong>方向与窗口</strong> ${escape(event.direction)} · ${escape(event.horizon)}</p></div>
      <div class="brief-primary-source"><p><strong>事件时间</strong> ${escape(eventTime)}${event.eventTime?'（北京时间）':''}${event.futureEventNote ? ' · '+escape(event.futureEventNote) : ''}</p>${primaryUrl?`<a href="${escape(primaryUrl)}" target="_blank" rel="noopener noreferrer">原文链接 · @${escape(primary.username)} ↗</a>`:'<span>原文链接待核验</span>'}</div>
    </article>`;
  }
  let manifest, config, readingBoard, generation = 0;
  function changeLabel(item) {
    const latest=readingBoard.latestEditionId||readingBoard.applied?.at(-1)?.split(':')[0];
    if(item.review&&item.review.action!=='keep'&&item.state!=='active')return '更正／状态变化';
    if(item.lateDiscovery&&item.firstEdition===latest)return '补充发现（原始时间不变）';
    if(item.firstEdition===latest)return '本轮新增';
    if(item.lastMaterialEdition===latest||item.history?.some(h=>h.event&&h.changedAt===readingBoard.updatedAt))return '本轮有进展';
    return '累计保留';
  }
  function readingCard(item,index) {
    const history=(item.history||[]).filter(h=>h.event);
    const timeline=history.length?`<details open class="brief-evidence"><summary>事件进展时间线（保留此前版本）</summary>${history.map(h=>h.event?`<p><strong>${escape(time(h.changedAt))} 更新前版本</strong> ${escape(h.event.fact)}</p>`:`<p>${escape(time(h.decision.checkedAt))} · ${escape(h.decision.reason)}</p>`).join('')}</details>`:'';
    return `<div>${card(item.event,index,changeLabel(item))}${timeline}</div>`;
  }
  function showReading() {
    generation++;
    const board=readingBoard;
    const ctx=board.period||{};
    const stale=ctx.retainUntil&&Date.now()>=Date.parse(ctx.retainUntil);
    if($('reading-context'))$('reading-context').textContent=`截至 ${time(board.asOf)}（北京时间）${stale?' · 等待更新':''}${board.warnings?.length?' · 部分来源未更新':''}`;
    for(const group of ['focus','insights']) {
      const all=board.events.filter(e=>e.state==='active'&&e.group===group);
      const ids=new Set((board.selected?.[group]||[]).map(String));
      const selected=(board.selected?.[group]||[]).map(id=>all.find(e=>e.eventKey===id)).filter(Boolean);
      const more=all.filter(e=>!ids.has(e.eventKey));
      $('brief-'+group).innerHTML=(selected.map(readingCard).join('')||empty('暂无内容'))+(more.length?`<section class="retained-news"><h3>更多重点</h3>${more.map(readingCard).join('')}</section>`:'');
    }
    const reviewed=board.events.filter(e=>e.review&&e.state!=='active'&&e.state!=='served');
    $('brief-audit').innerHTML=reviewed.length?`<section class="brief-corrections"><h2>更正</h2>${reviewed.map((e,i)=>`<section><p><strong>${escape(({retracted:'已撤回／证伪',superseded:'已被后续信息取代',resolved:'已失效'})[e.state])}</strong> · ${escape(e.review.reason)} · ${escape(time(e.review.checkedAt))} ${/^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(e.review.sourceUrl||'')?`<a href="${escape(e.review.sourceUrl)}" target="_blank" rel="noopener noreferrer">更正依据 ↗</a>`:''}</p>${readingCard(e,i)}</section>`).join('')}</section>`:'';
  }
  async function show(entry, preserve=false) {
    if(entry?.id==='reading'){showReading();return;}
    if($('reading-context'))$('reading-context').textContent='';
    const current = ++generation;
    if (!preserve) {
    $('brief-focus').innerHTML = '';
    $('brief-insights').innerHTML = '';
    $('brief-audit').innerHTML = '';
    }
    try {
      if (!/^(?:\d{4}-\d{2}-\d{2}-(?:0800|1500|2030|0900|1600|2100)|manual-[a-f0-9-]{36})\.json$/.test(entry.file)) throw new Error('无效期次');
      const brief = await json('data/stock-briefs/'+entry.file);
      if (current!==generation) return;
      if($('reading-context'))$('reading-context').textContent=`截至 ${time(brief.scheduledFor)}（北京时间）`;
      for (const group of ['focus','insights']) {
        const carried = (brief.carriedOver||[]).filter(c=>c.group===group);
        const carriedHtml = carried.length ? `<div class="brief-carried"><h3>展示窗口内的前序期次条目（本期未重复检索）</h3>${carried.map(c=>`<article class="x-card brief-card"><div class="brief-card-top"><h3>${escape(c.title)}</h3><span class="badge">来自 ${escape(c.fromEdition)}</span></div>${c.fact?`<p>${escape(c.fact)}</p>`:''}${originalUrl(c)?`<a href="${escape(c.url)}" target="_blank" rel="noopener noreferrer">原文链接 ↗</a>`:''}<p class="brief-small">发布 ${escape(time(c.publishedAt))}（北京时间）</p></article>`).join('')}</div>` : '';
        $('brief-'+group).innerHTML = (brief[group].map((event,index)=>card(event,index)).join('') || empty('本期没有可用条目')) + carriedHtml;
      }
      $('brief-audit').innerHTML = '';
    } catch {
      if (current===generation) {
        $('brief-focus').innerHTML=empty('所选期次读取失败，请稍后重试');
        $('brief-insights').innerHTML=empty('所选期次读取失败，请稍后重试');
        $('brief-audit').innerHTML='';
      }
    }
  }
  function load(keepSelection=false) { return Promise.all([json('config/stock-brief.json'),json('data/stock-briefs/index.json'),json('data/reading-board.json').catch(()=>null)]).then(([settings,index,board])=> {
    const previousLive=manifest?.editions.find(e=>e.status!=='failed')||manifest?.editions[0];
    const selected=keepSelection && manifest && $('edition-select').value!==previousLive?.id ? $('edition-select').value : null;
    const editions=index.editions||[];
    config=settings; manifest={...index,editions};
    const validBoard=Array.isArray(board?.events)&&board.asOf;
    if(validBoard)readingBoard=board;
    else if(readingBoard)readingBoard={...readingBoard,warnings:[...(readingBoard.warnings||[]),'待阅池刷新失败，继续显示上次成功加载的内容。']};
    if (!editions.length) {
      $('edition-select').innerHTML = '<option>等待首期</option>';
      $('brief-focus').innerHTML=empty('等待五条市场焦点');
      $('brief-insights').innerHTML=empty('等待十条多学科洞察');
      return;
    }
    $('edition-select').innerHTML=(readingBoard?'<option value="reading">当前重点</option>':'')+editions.map(e=>`<option value="${escape(e.id)}">${escape(time(e.scheduledFor))}${e.status==='complete'?'':' · '+escape(status[e.status]||e.status)}</option>`).join('');
    $('edition-select').disabled=false;
    const entry=editions.find(e=>e.id===selected)||(readingBoard?{id:'reading'}:editions.find(e=>e.status!=='failed')||editions[0]);
    $('edition-select').value=entry.id;
    show(entry,keepSelection);
    if(!validBoard&&!readingBoard&&$('reading-context'))$('reading-context').textContent='待阅池未能加载，暂显示历史期次；跨期保留信息可能不全，请刷新重试。';
  }).catch(()=> {
    $('edition-select').innerHTML='<option>期次目录读取失败</option>';
    $('edition-select').disabled=true;
    if($('reading-context'))$('reading-context').textContent='本次刷新失败；仍显示上次成功读取的内容，未确认已更新。';
  }); }
  $('edition-select').addEventListener('change',()=>show($('edition-select').value==='reading'?{id:'reading'}:manifest.editions.find(e=>e.id===$('edition-select').value)));
  document.addEventListener?.('intelbrief:updated',event=> { if(event.detail.page==='news') load(true); });
  load();
})();
