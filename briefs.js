/* Immutable editions; browsing an archive never initiates X collection. */
(function () {
  const $ = id => document.getElementById(id);
  if (!$('edition-select')) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '未查明';
  const status = {complete:'完整',partial:'有缺额',failed:'采集失败'};
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
      <div class="topic-row"><span>${escape(event.direction)}</span><span>${escape(event.horizon)}</span>${event.affected.map(v=>`<span>${escape(v)}</span>`).join('')}</div>
      <p><strong>信息摘要</strong> ${escape(event.fact)}</p>
      <p><strong>影响判断</strong> ${escape(event.impact)}</p>
      ${knowledge}
      <p><strong>反向条件</strong> ${escape(event.counterCase)}</p>
      <div class="brief-primary-source"><p><strong>事件时间</strong> ${escape(eventTime)}${event.eventTime?'（北京时间）':''}${event.futureEventNote ? ' · '+escape(event.futureEventNote) : ''}</p>${primaryUrl?`<a href="${escape(primaryUrl)}" target="_blank" rel="noopener noreferrer">原文链接 · @${escape(primary.username)} ↗</a>`:'<span>原文链接待核验</span>'}</div>
      <details class="brief-evidence"><summary>证据与筛选依据 · 可信度初评 ${escape(event.credibility.score)}/100（未校准）</summary>
        <p>入选理由：${escape(event.selectionReason)}</p>
        ${event.attentionEvidence ? `<p>关注依据：${escape(event.attentionEvidence)}</p>`:''}
        ${event.continuationReason ? `<p>延续原因：${escape(event.continuationReason)}</p>`:''}
        ${event.contextSourceNote ? `<p>背景证据：${escape(event.contextSourceNote)}</p>`:''}
        <p>可信度依据：${escape(event.credibility.reason)}</p>
        <p class="brief-small">${escape(event.credibility.limitation)}</p>
        ${event.sources.map(source=>`<div class="brief-source"><a href="${escape(originalUrl(source) || '#')}" target="_blank" rel="noopener noreferrer">@${escape(source.username)} · 查看 X 原帖 ↗</a><blockquote>${escape(source.excerpt)}</blockquote><p class="brief-small">发布 ${escape(time(source.publishedAt))} · 核验 ${escape(time(source.checkedAt))}（北京时间）</p><p>${source.verification==='direct'?'已直接读取原帖':'采集器返回，未独立直读'}：${escape(source.verificationNote)}</p><p class="brief-small">来源初评 ${escape(source.credibility.overall)}/100；作者分 ${escape(source.credibility.sourceScore)}，主张分 ${escape(source.credibility.claimScore)}</p>${list(source.credibility.warnings)}</div>`).join('')}
      </details></article>`;
  }
  let manifest, config, generation = 0;
  async function show(entry, preserve=false) {
    const current = ++generation;
    if (!preserve) {
    $('brief-focus').innerHTML = '';
    $('brief-insights').innerHTML = '';
    $('brief-audit').innerHTML = '';
    $('focus-count').textContent = '— / 5';
    $('insights-count').textContent = '— / 10';
    }
    try {
      if (!/^(?:\d{4}-\d{2}-\d{2}-(?:0900|1600|2100)|manual-[a-f0-9-]{36})\.json$/.test(entry.file)) throw new Error('无效期次');
      const brief = await json('data/stock-briefs/'+entry.file);
      if (current!==generation) return;
      for (const group of ['focus','insights']) {
        $(group+'-count').textContent = `${brief[group].length} / ${config.targetCounts[group]}`;
        $('brief-'+group).innerHTML = brief[group].map(card).join('') || empty('本期没有可用条目');
      }
      $('brief-audit').innerHTML = `<details class="brief-evidence"><summary>本期检索范围、排序与缺口</summary><p>采集方式：${escape(brief.coverage.method)}</p><p>检索窗口：${escape(time(brief.windowStart))} 至 ${escape(time(brief.scheduledFor))}（北京时间）</p><p>${escape(brief.selectionRationale)}</p><h3>检索问题</h3>${list(brief.coverage.queries)}<h3>覆盖缺口</h3>${list(brief.coverage.gaps.length?brief.coverage.gaps:['未另行报告；不表示覆盖了整个 X'])}<h3>主要落选候选</h3>${list(brief.excludedCandidates.map(c=>`${c.eventKey}：${c.reason}`))}</details>`;
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
    const editions=(index.editions||[]).slice(0,settings.historyLimit||3);
    config=settings; manifest={...index,editions};
    if (!editions.length) {
      $('edition-select').innerHTML = '<option>等待首期</option>';
      $('brief-focus').innerHTML=empty('等待五条市场焦点');
      $('brief-insights').innerHTML=empty('等待十条多学科洞察');
      return;
    }
    $('edition-select').innerHTML=editions.map(e=>`<option value="${escape(e.id)}">${escape(time(e.scheduledFor))} · ${e.trigger==='manual'?'手动':'定时'} · ${escape(status[e.status])} · ${escape(e.counts.total)}/15</option>`).join('');
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
