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
  function peopleNote(list) {
    // Person intros from config/person-registry.json; shown in full, never truncated.
    if (!Array.isArray(list) || !list.length) return '';
    return `<p class="card-people"><strong>相关人物</strong>${list.map(p => `<span class="person-chip"><span class="person-chip-name">${escape(p.name)}</span><span class="person-chip-intro">${escape(p.intro)}</span></span>`).join('')}</p>`;
  }
  function card(event, index) {
    const knowledge = event.knowledgeApplication ? `<div class="brief-knowledge"><strong>${escape(event.disciplines.join(' × '))}</strong><p>${escape(event.knowledgeApplication)}</p><small>知识卡：${escape(event.knowledgeCards.join('、'))} · 条件性参考，不是事实证明</small></div>` : '';
    const primary = event.sources[0] || {};
    const primaryUrl = originalUrl(primary);
    const eventTime = event.eventTime ? time(event.eventTime) : event.eventTimeNote;
    return `<article class="x-card brief-card">
      <div class="brief-author"><span>作者</span><strong>@${escape(primary.username || '未查明')}</strong></div>
      <div class="brief-card-top"><span class="brief-rank">${String(index+1).padStart(2,'0')}</span><h3>${escape(event.title)}</h3><span class="badge">${escape(event.change)}</span></div>
      ${peopleNote(event.people)}
      <p class="signal-verification">${primary.verification === 'direct' ? '已直读原帖' : '待独立核验'} · 发布 ${escape(time(primary.publishedAt))}（北京时间）</p>
      <div class="topic-row"><span>${escape(event.direction)}</span><span>${escape(event.horizon)}</span>${event.affected.map(v=>`<span>${escape(v)}</span>`).join('')}</div>
      <p><strong>信息摘要</strong> ${escape(event.fact)}</p>
      <details open class="analysis-details"><summary>影响分析</summary>
      <p><strong>影响判断</strong> ${escape(event.impact)}</p>
      ${knowledge}
      </details>
      <div class="brief-primary-source"><p><strong>事件时间</strong> ${escape(eventTime)}${event.eventTime?'（北京时间）':''}${event.futureEventNote ? ' · '+escape(event.futureEventNote) : ''}</p>${primaryUrl?`<a href="${escape(primaryUrl)}" target="_blank" rel="noopener noreferrer">原文链接 · @${escape(primary.username)} ↗</a>`:'<span>原文链接待核验</span>'}</div>
    </article>`;
  }
  let manifest, config, readingBoard, generation = 0;
  function readingCard(item,index) {
    const note=`首次收录 ${time(item.firstSeenAt)} · 最近核验 ${time(item.lastCheckedAt)} · ${item.retainUntil?'保留至 '+time(item.retainUntil)+'（北京时间）':'待复核，暂不自动移除'}${item.lateDiscovery?' · 延迟发现／早期消息，非刚刚发生':''}`;
    return `<div><p class="brief-small">${escape(note)}</p>${card(item.event,index)}</div>`;
  }
  function showReading() {
    generation++;
    const board=readingBoard;
    const ctx=board.period||{};
    const stale=ctx.retainUntil&&Date.now()>=Date.parse(ctx.retainUntil);
    if($('reading-context'))$('reading-context').textContent=`最新汇总 · 信息截止 ${time(board.asOf)}（北京时间） · 按北京时间更新批次整理${stale?' · 已到下一阅读批次，等待更新；保留上次内容':''}。${(board.warnings||[]).join(' ')}`;
    for(const group of ['focus','insights']) {
      const all=board.events.filter(e=>e.state==='active'&&e.group===group);
      const ids=new Set((board.selected?.[group]||[]).map(String));
      const selected=(board.selected?.[group]||[]).map(id=>all.find(e=>e.eventKey===id)).filter(Boolean);
      const more=all.filter(e=>!ids.has(e.eventKey));
      $(group+'-count').textContent=`精选 ${selected.length} 条 · 另保留 ${more.length} 条`;
      $('brief-'+group).innerHTML=(selected.map(readingCard).join('')||empty('本次暂无精选条目'))+(more.length?`<details open class="analysis-details"><summary>其余仍有效的待阅信息（${more.length}条，未删除）</summary>${more.map(readingCard).join('')}</details>`:'');
    }
    const reviewed=board.events.filter(e=>e.review&&e.state!=='active'&&e.state!=='served');
    $('brief-audit').innerHTML=`<details open class="brief-evidence"><summary>保留规则与事件复核记录</summary><p>周末重要消息从北京时间周一09:00批次起汇总展示，并在周一后续批次保留，不等待美国开盘。简报期次与待阅池独立保存；首次收录、原帖时间与最近核验分开。同一事件合并，不把延续消息冒充新增。</p><p>未提供跨期重排时沿用最近收录顺序，不声称这是全网重要性排名。更新失败不会清空上一批待阅内容；后续批次接替后的状态为“已展示过对应阅读日”，不代表你已阅读。</p>${reviewed.map(e=>`<p>${escape(e.event.title)}：${escape(({retracted:'已撤回／证伪',superseded:'已被后续信息取代',resolved:'已失效'})[e.state])} · ${escape(e.review.reason)} · ${escape(time(e.review.checkedAt))}</p>`).join('')}</details>`;
  }
  async function show(entry, preserve=false) {
    if(entry?.id==='reading'){showReading();return;}
    if($('reading-context'))$('reading-context').textContent='历史期次快照 · 不随当前待阅状态改写';
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
      $('brief-audit').innerHTML = `<details open class="brief-evidence"><summary>本期检索范围、排序与缺口</summary><p>采集方式：${escape(brief.coverage.method)}</p>${brief.displayWindowStart?`<p>展示窗口：${escape(time(brief.displayWindowStart))} 至 ${escape(time(brief.displayWindowEnd))}（北京时间）</p>`:''}<p>检索窗口：${escape(time(brief.windowStart))} 至 ${escape(time(brief.scheduledFor))}（北京时间）</p>${Array.isArray(brief.checklist)?`<h3>检索清单</h3>${list(brief.checklist.map(c=>`${c.item}：${({covered:'已覆盖','no-result':'无结果',insufficient:'证据不足'})[c.status]||c.status}${c.note?'（'+c.note+'）':''}`))}`:''}${Array.isArray(brief.candidates)&&brief.candidates.length?`<h3>候选与入选映射</h3>${list(brief.candidates.map(c=>`第${c.round}轮 ${c.eventKey} → ${c.decision==='selected'?'入选':'落选'}：${c.reason}`))}`:''}<p>${escape(brief.selectionRationale)}</p><h3>检索问题</h3>${list(brief.coverage.queries)}<h3>覆盖缺口</h3>${list(brief.coverage.gaps.length?brief.coverage.gaps:['未另行报告；不表示覆盖了整个 X'])}<h3>主要落选候选</h3>${list(brief.excludedCandidates.map(c=>`${c.eventKey}：${c.reason}`))}</details>`;
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
    $('edition-select').innerHTML=(readingBoard?'<option value="reading">最新汇总（跨期保留）</option>':'')+editions.map(e=>`<option value="${escape(e.id)}">${escape(time(e.scheduledFor))} · ${e.trigger==='manual'?'手动':'定时'} · ${escape(status[e.status]||e.status)} · 收录 ${escape(e.counts.total)} 条</option>`).join('');
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
