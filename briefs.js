/* Immutable editions; browsing an archive never initiates X collection. */
(function () {
  const $ = id => document.getElementById(id);
  if (!$('edition-select')) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '未查明';
  const status = {complete:'完整',partial:'有缺额',failed:'采集失败'};
  const list = values => `<ul>${values.map(v => `<li>${escape(v)}</li>`).join('')}</ul>`;
  const empty = text => `<div class="empty-state"><strong>${escape(text)}</strong><p>没有可靠原帖证据的内容不会显示在这里。</p></div>`;
  async function json(url) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('读取失败');
    return response.json();
  }
  function card(event, index) {
    const knowledge = event.knowledgeApplication ? `<div class="brief-knowledge"><strong>${escape(event.disciplines.join(' × '))}</strong><p>${escape(event.knowledgeApplication)}</p><small>知识卡：${escape(event.knowledgeCards.join('、'))} · 条件性参考，不是事实证明</small></div>` : '';
    return `<article class="x-card brief-card">
      <div class="brief-card-top"><span class="brief-rank">${String(index+1).padStart(2,'0')}</span><h3>${escape(event.title)}</h3><span class="badge">${escape(event.change)}</span></div>
      <div class="topic-row"><span>${escape(event.direction)}</span><span>${escape(event.horizon)}</span>${event.affected.map(v=>`<span>${escape(v)}</span>`).join('')}</div>
      <p><strong>原帖事实</strong> ${escape(event.fact)}</p>
      <p><strong>影响判断</strong> ${escape(event.impact)}</p>
      ${knowledge}
      <p><strong>反向条件</strong> ${escape(event.counterCase)}</p>
      <p class="brief-small">事件时间：${event.eventTime ? escape(time(event.eventTime)) : escape(event.eventTimeNote)}（北京时间）${event.futureEventNote ? ' · '+escape(event.futureEventNote) : ''}</p>
      <details class="brief-evidence"><summary>证据与筛选依据 · 可信度初评 ${escape(event.credibility.score)}/100（未校准）</summary>
        <p>入选理由：${escape(event.selectionReason)}</p>
        ${event.attentionEvidence ? `<p>关注依据：${escape(event.attentionEvidence)}</p>`:''}
        ${event.continuationReason ? `<p>延续原因：${escape(event.continuationReason)}</p>`:''}
        ${event.contextSourceNote ? `<p>背景证据：${escape(event.contextSourceNote)}</p>`:''}
        <p>可信度依据：${escape(event.credibility.reason)}</p>
        <p class="brief-small">${escape(event.credibility.limitation)}</p>
        ${event.sources.map(source=>`<div class="brief-source"><a href="${escape(/^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(source.url) ? source.url : '#')}" target="_blank" rel="noopener noreferrer">@${escape(source.username)} · 查看 X 原帖 ↗</a><blockquote>${escape(source.excerpt)}</blockquote><p class="brief-small">发布 ${escape(time(source.publishedAt))} · 核验 ${escape(time(source.checkedAt))}（北京时间）</p><p>${source.verification==='direct'?'已直接读取原帖':'采集器返回，未独立直读'}：${escape(source.verificationNote)}</p><p class="brief-small">来源初评 ${escape(source.credibility.overall)}/100；作者分 ${escape(source.credibility.sourceScore)}，主张分 ${escape(source.credibility.claimScore)}</p>${list(source.credibility.warnings)}</div>`).join('')}
      </details></article>`;
  }
  let manifest, config, generation = 0;
  function expectedSlot() {
    const now = Date.now();
    const day = new Date(now + 8*3600000).toISOString().slice(0,10);
    return [-1,0].flatMap(offset=> {
      const date = new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
      return config.slots.map(slot=>`${date}T${slot}:00+08:00`);
    }).filter(v=>Date.parse(v)<=now).sort().at(-1);
  }
  async function show(entry) {
    const current = ++generation;
    $('brief-state').textContent = '正在加载所选简报…';
    $('brief-summary').innerHTML = '';
    $('brief-focus').innerHTML = '';
    $('brief-insights').innerHTML = '';
    $('brief-audit').innerHTML = '';
    $('focus-count').textContent = '— / 5';
    $('insights-count').textContent = '— / 10';
    try {
      if (!/^\d{4}-\d{2}-\d{2}-(?:0900|1600|2100)\.json$/.test(entry.file)) throw new Error('无效期次');
      const brief = await json('data/stock-briefs/'+entry.file);
      if (current!==generation) return;
      const old = entry.id !== manifest.editions[0].id;
      const pending = Date.parse(entry.scheduledFor)<Date.parse(expectedSlot());
      $('brief-state').textContent = `${old ? '历史期次 · ' : ''}${status[brief.status]} · 信息截止 ${time(brief.scheduledFor)} · 发布 ${time(brief.generatedAt)}（北京时间）${!old && pending ? ' · 本时段尚无新简报，以下不是当前快照' : ''}`;
      $('brief-summary').innerHTML = `<h2>${escape(brief.summary)}</h2><p>${escape(brief.marketContext)}</p>${brief.shortfallReason?`<p class="brief-warning">缺额说明：${escape(brief.shortfallReason)}</p>`:''}`;
      for (const group of ['focus','insights']) {
        $(group+'-count').textContent = `${brief[group].length} / ${config.targetCounts[group]}`;
        $('brief-'+group).innerHTML = brief[group].map(card).join('') || empty('本期没有可用条目');
      }
      $('brief-audit').innerHTML = `<details class="brief-evidence"><summary>本期检索范围、排序与缺口</summary><p>采集方式：${escape(brief.coverage.method)}</p><p>检索窗口：${escape(time(brief.windowStart))} 至 ${escape(time(brief.scheduledFor))}（北京时间）</p><p>${escape(brief.selectionRationale)}</p><h3>检索问题</h3>${list(brief.coverage.queries)}<h3>覆盖缺口</h3>${list(brief.coverage.gaps.length?brief.coverage.gaps:['未另行报告；不表示覆盖了整个 X'])}<h3>主要落选候选</h3>${list(brief.excludedCandidates.map(c=>`${c.eventKey}：${c.reason}`))}</details>`;
    } catch {
      if (current===generation) $('brief-state').textContent = '所选期次读取失败，请稍后重试；未用旧内容冒充。';
    }
  }
  Promise.all([json('config/stock-brief.json'),json('data/stock-briefs/index.json')]).then(([settings,index])=> {
    config=settings; manifest=index;
    if (!index.editions.length) {
      $('edition-select').innerHTML = '<option>等待首期</option>';
      $('brief-state').textContent = '首期尚未发布 · 每天北京时间 09:00、16:00、21:00 启动采集，核验完成后发布。';
      $('brief-focus').innerHTML=empty('等待五条市场焦点');
      $('brief-insights').innerHTML=empty('等待十条多学科洞察');
      return;
    }
    $('edition-select').innerHTML=index.editions.map(e=>`<option value="${escape(e.id)}">${escape(time(e.scheduledFor))} · ${escape(status[e.status])} · ${escape(e.counts.total)}/15</option>`).join('');
    $('edition-select').disabled=false;
    $('edition-select').addEventListener('change',()=>show(index.editions.find(e=>e.id===$('edition-select').value)));
    show(index.editions[0]);
  }).catch(()=> { $('brief-state').textContent='简报目录读取失败，请稍后重试。'; });
})();
