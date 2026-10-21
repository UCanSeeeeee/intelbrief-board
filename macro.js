/* Low-frequency US equity macro calendar — four quarters, official dates only. */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$('macro-board') || !$('macro-quarter-tabs')) return;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const categoryLabel = (id, catalog) => (catalog.find((c) => c.id === id) || {}).label || id;
  const importanceLabel = { high: '高关注', standard: '常规', low: '结构日' };
  const dayHead = (isoDate) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(isoDate + 'T12:00:00Z'));

  let payload = null;
  let activeId = 'q1';
  let earnings = null;

  function quarterEvents(quarter) {
    const sourceEvents=quarter.events||[];
    const references=sourceEvents.filter(e=>e.category==='mega-earnings');
    const symbols=new Map(references.map(e=>[e.symbol,e]));
    const days=(earnings?.weeks||[]).flatMap(w=>w.days||[]);
    const covered=new Set(days.map(d=>d.date));
    const linked=days.flatMap(d=>(d.items||[]).filter(i=>symbols.has(i.symbol)&&d.date>=quarter.start&&d.date<=quarter.end).map(item=>{
      const ref=symbols.get(item.symbol);
      return {...ref,id:`mega-earnings-${d.date}-${item.symbol}`,date:d.date,title:`超关注财报 · ${item.symbol}（${item.name.trim()}）`,timeEt:item.timeLabel,referencePeriod:item.fiscalQuarterEnding,
        notes:item.epsForecast?`EPS 预期 ${item.epsForecast}`:'',
        sources:[{name:'财报日历',url:'earnings.html'},{name:'Nasdaq',url:'https://www.nasdaq.com/market-activity/earnings'}]};
    }));
    // Old evidence stays in JSON; current-window earnings are read from one source only.
    return [...sourceEvents.filter(e=>e.category!=='mega-earnings'),...references.filter(e=>!covered.has(e.date)).map(e=>({...e,notes:'',sources:[{name:'Nasdaq',url:'https://www.nasdaq.com/market-activity/earnings'}]})),...linked];
  }

  function card(event, catalog) {
    const sources = (event.sources || []).map((s) =>
      s.url ? `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a>` : escape(s.name)
    ).join(' · ');
    return `<article class="macro-card earnings-card"><div class="macro-event-main"><div>
      <div class="earnings-card-top">
        <strong>${escape(categoryLabel(event.category, catalog))}</strong>
        <span class="calendar-importance">${escape(importanceLabel[event.importance] || event.importance || '常规')}</span>
      </div>
      <p class="earnings-name">${escape(event.title)}</p>
      ${event.notes?`<p class="earnings-blurb">${escape(event.notes)}</p>`:''}
      </div><div class="macro-timing">
      <p class="earnings-meta calendar-time">${escape(IntelCalendar.macroTime(event))}</p>
      ${event.referencePeriod ? `<p class="earnings-meta">对应 ${escape(event.referencePeriod)}</p>` : ''}
      <p class="earnings-result"><strong>来源</strong> ${sources || '—'}</p>
      </div></div>
    </article>`;
  }

  function renderQuarter(quarter) {
    if (!quarter) {
      $('macro-board').innerHTML = `<div class="empty-state"><strong>暂无该季度数据</strong><p>请检查 data/macro-events.json。</p></div>`;
      return;
    }
    const updated = payload.updatedAt
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(payload.updatedAt))
      : '未知';
    $('macro-state').textContent = `更新于 ${updated}（北京时间）`;
    $('macro-summary').innerHTML = `<p class="calendar-range">${escape(quarter.start)} 至 ${escape(quarter.end)}（美东日期）</p>`;

    const byDay = new Map();
    for (const event of quarterEvents(quarter)) {
      if (!byDay.has(event.date)) byDay.set(event.date, []);
      byDay.get(event.date).push(event);
    }
    const days = [...byDay.keys()].sort();
    if (!days.length) {
      $('macro-board').innerHTML = `<div class="empty-state"><strong>本季暂无事件</strong><p>官方日历尚未收录或未编入本库。</p></div>`;
      return;
    }
    $('macro-board').innerHTML = days.map((date) => {
      const items = byDay.get(date);
      return `<section class="earnings-day macro-day" data-macro-date="${escape(date)}" id="macro-day-${escape(date)}">
        <header class="earnings-day-head"><h2>${escape(dayHead(date))}</h2><span>${escape(date)}</span></header>
        <div class="earnings-grid">${items.map((e) => card(e, payload.categories || [])).join('')}</div>
      </section>`;
    }).join('');
    scrollToToday(days);
  }

  function shanghaiDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function scrollToToday(days) {
    const today = shanghaiDate();
    let target = days.includes(today) ? today : null;
    if (!target) {
      // Nearest date on or after today; else latest prior date in this quarter.
      target = days.find((d) => d >= today) || [...days].reverse().find((d) => d < today) || null;
    }
    if (!target) return;
    const el = document.getElementById(`macro-day-${target}`);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }

  function activate(id) {
    activeId = id;
    $('macro-quarter-tabs').querySelectorAll('[role="tab"]').forEach((button) => {
      const on = button.dataset.quarter === id;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    renderQuarter((payload.quarters || []).find((q) => q.id === id));
  }

  function pickDefaultQuarter() {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (y === payload.year) return `q${Math.floor((m - 1) / 3) + 1}`;
    return payload.activeQuarterId || 'q1';
  }

  function mountTabs() {
    const quarters = payload.quarters || [];
    $('macro-quarter-tabs').innerHTML = quarters.map((q) =>
      `<button type="button" role="tab" data-quarter="${escape(q.id)}" aria-selected="false" tabindex="-1"><strong>${escape(q.label)}</strong></button>`
    ).join('');
    $('macro-quarter-tabs').querySelectorAll('[role="tab"]').forEach((button) => {
      button.addEventListener('click', () => activate(button.dataset.quarter));
    });
    activate(pickDefaultQuarter());
  }

  Promise.all([
    fetch('data/macro-events.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('读取失败');return r.json();}),
    fetch('data/earnings-calendar.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('读取失败');return r.json();}).catch(()=>null)
  ])
    .then(([data,calendar]) => { payload = data; earnings=calendar; mountTabs(); if(!calendar)$('macro-state').textContent+=' · 财报数据读取失败'; })
    .catch(() => {
      $('macro-state').textContent = '宏观日程读取失败';
      $('macro-board').innerHTML = `<div class="empty-state"><strong>读取失败</strong><p>请稍后重试，或检查 data/macro-events.json。</p></div>`;
    });
})();
