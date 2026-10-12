/* Immutable editions; browsing an archive never initiates X collection. */
(function () {
  const $ = id => document.getElementById(id);
  if (!$('edition-select')) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '未查明';
  const status = {complete:'已发布',partial:'有缺额',failed:'采集失败'};
  const list = values => `<ul>${values.map(v => `<li>${escape(v)}</li>`).join('')}</ul>`;
  const empty = text => `<div class="empty-state"><strong>${escape(text)}</strong><p>没有可靠原帖证据的内容不会显示在这里。</p></div>`;
  const originalUrl = source => /^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(source?.url || '') ? source.url : '';
  async function json(url) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('读取失败');
    return response.json();
  }
  function card(event, index) {
    const knowledge = event.knowledgeApplication ? `<div class="brief-knowledge"><strong>${escape(event.disciplines.join(' × '))}</strong><p>${escape(event.knowledgeApplication)}</p><small>知识卡：${escape(event.knowledgeCards.join('、'))} · 条件性参考，不是事实证明</small></div>` : '';
    const primary = event.sources[0] || {};
    const primaryUrl = originalUrl(primary);
    const eventTime = event.eventTime ? time(event.eventTime) : event.eventTimeNote;
    return `<article class="x-card brief-card">
      <div class="brief-author"><span>作者</span><strong>@${escape(primary.username || '未查明')}</strong></div>
      <div class="brief-card-top"><span class="brief-rank">${String(index+1).padStart(2,'0')}</span><h3>${escape(event.title)}</h3><span class="badge">${escape(event.change)}</span></div>
      <p class="signal-verification">${primary.verification === 'direct' ? '已直读原帖' : '待独立核验'} · 发布 ${escape(time(primary.publishedAt))}（北京时间）</p>
      <div class="topic-row"><span>${escape(event.direction)}</span><span>${escape(event.horizon)}</span>${event.affected.map(v=>`<span>${escape(v)}</span>`).join('')}</div>
      <p><strong>信息摘要</strong> ${escape(event.fact)}</p>
      <details class="analysis-details"><summary>影响分析与反向条件</summary>
      <p><strong>影响判断</strong> ${escape(event.impact)}</p>
      ${knowledge}
      <p><strong>反向条件</strong> ${escape(event.counterCase)}</p>
      </details>
      <div class="brief-primary-source"><p><strong>事件时间</strong> ${escape(eventTime)}${event.eventTime?'（北京时间）':''}${event.futureEventNote ? ' · '+escape(event.futureEventNote) : ''}</p>${primaryUrl?`<a href="${escape(primaryUrl)}" target="_blank" rel="noopener noreferrer">原文链接 · @${escape(primary.username)} ↗</a>`:'<span>原文链接待核验</span>'}</div>
    </article>`;
  }
  let manifest, config, generation = 0;
  async function show(entry, preserve=false) {
    const current = ++generation;
    if (!preserve) {
    $('brief-focus').innerHTML = '';
    $('brief-insights').innerHTML = '';
    $('brief-audit').innerHTML = '';
    $('focus-count').textContent = '正在读取';
    $('insights-count').textContent = '正在读取';
    }
    try {
      if (!/^(?:\d{4}-\d{2}-\d{2}-(?:0900|1600|2100)|manual-[a-f0-9-]{36})\.json$/.test(entry.file)) throw new Error('无效期次');
      const brief = await json('data/stock-briefs/'+entry.file);
      if (current!==generation) return;
      for (const group of ['focus','insights']) {
        $(group+'-count').textContent = `收录 ${brief[group].length} 条 · 上限 ${config.targetCounts[group]} 条`;
        const carried = (brief.carriedOver||[]).filter(c=>c.group===group);
        const carriedHtml = carried.length ? `<div class="brief-carried"><h3>展示窗口内的前序期次条目（本期未重复检索）</h3>${carried.map(c=>`<article class="x-card brief-card"><div class="brief-card-top"><h3>${escape(c.title)}</h3><span class="badge">来自 ${escape(c.fromEdition)}</span></div>${c.fact?`<p>${escape(c.fact)}</p>`:''}${originalUrl(c)?`<a href="${escape(c.url)}" target="_blank" rel="noopener noreferrer">原文链接 ↗</a>`:''}<p class="brief-small">发布 ${escape(time(c.publishedAt))}（北京时间）</p></article>`).join('')}</div>` : '';
        $('brief-'+group).innerHTML = (brief[group].map(card).join('') || empty('本期没有可用条目')) + carriedHtml;
      }
      $('brief-audit').innerHTML = `<details class="brief-evidence"><summary>本期检索范围、排序与缺口</summary><p>采集方式：${escape(brief.coverage.method)}</p>${brief.displayWindowStart?`<p>展示窗口：${escape(time(brief.displayWindowStart))} 至 ${escape(time(brief.displayWindowEnd))}（北京时间）</p>`:''}<p>检索窗口：${escape(time(brief.windowStart))} 至 ${escape(time(brief.scheduledFor))}（北京时间）</p>${Array.isArray(brief.checklist)?`<h3>检索清单</h3>${list(brief.checklist.map(c=>`${c.item}：${({covered:'已覆盖','no-result':'无结果',insufficient:'证据不足'})[c.status]||c.status}${c.note?'（'+c.note+'）':''}`))}`:''}${Array.isArray(brief.candidates)&&brief.candidates.length?`<h3>候选与入选映射</h3>${list(brief.candidates.map(c=>`第${c.round}轮 ${c.eventKey} → ${c.decision==='selected'?'入选':'落选'}：${c.reason}`))}`:''}<p>${escape(brief.selectionRationale)}</p><h3>检索问题</h3>${list(brief.coverage.queries)}<h3>覆盖缺口</h3>${list(brief.coverage.gaps.length?brief.coverage.gaps:['未另行报告；不表示覆盖了整个 X'])}<h3>主要落选候选</h3>${list(brief.excludedCandidates.map(c=>`${c.eventKey}：${c.reason}`))}</details>`;
    } catch {
      if (current===generation) {
        $('brief-focus').innerHTML=empty('所选期次读取失败，请稍后重试');
        $('brief-insights').innerHTML=empty('所选期次读取失败，请稍后重试');
        $('brief-audit').innerHTML='';
      }
    }
  }
  function load(keepSelection=false) { return Promise.all([json('config/stock-brief.json'),json('data/stock-briefs/index.json')]).then(([settings,index])=> {
    const previousLive=manifest?.editions.find(e=>e.status!=='failed')||manifest?.editions[0];
    const selected=keepSelection && manifest && $('edition-select').value!==previousLive?.id ? $('edition-select').value : null;
    const editions=index.editions||[];
    config=settings; manifest={...index,editions};
    if (!editions.length) {
      $('edition-select').innerHTML = '<option>等待首期</option>';
      $('brief-focus').innerHTML=empty('等待五条市场焦点');
      $('brief-insights').innerHTML=empty('等待十条多学科洞察');
      return;
    }
    $('edition-select').innerHTML=editions.map(e=>`<option value="${escape(e.id)}">${escape(time(e.scheduledFor))} · ${e.trigger==='manual'?'手动':'定时'} · ${escape(status[e.status]||e.status)} · 收录 ${escape(e.counts.total)} 条</option>`).join('');
    $('edition-select').disabled=false;
    const entry=editions.find(e=>e.id===selected)||editions.find(e=>e.status!=='failed')||editions[0];
    $('edition-select').value=entry.id;
    show(entry,keepSelection);
  }).catch(()=> {
    $('edition-select').innerHTML='<option>期次目录读取失败</option>';
    $('edition-select').disabled=true;
  }); }
  $('edition-select').addEventListener('change',()=>show(manifest.editions.find(e=>e.id===$('edition-select').value)));
  document.addEventListener?.('intelbrief:updated',event=> { if(event.detail.page==='news') load(true); });
  load();
})();
