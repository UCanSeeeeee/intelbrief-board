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

  function card(event, catalog) {
    const sources = (event.sources || []).map((s) =>
      s.url ? `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a>` : escape(s.name)
    ).join(' · ');
    return `<article class="macro-card earnings-card">
      <div class="earnings-card-top">
        <strong>${escape(categoryLabel(event.category, catalog))}</strong>
        <span class="badge">${escape(importanceLabel[event.importance] || event.importance || '常规')}</span>
      </div>
      <p class="earnings-name">${escape(event.title)}</p>
      <p class="earnings-blurb">${escape(event.notes || '')}</p>
      <p class="earnings-meta calendar-time">${escape(IntelCalendar.macroTime(event))}</p>
      ${event.referencePeriod ? `<p class="earnings-meta">对应 ${escape(event.referencePeriod)}</p>` : ''}
      <p class="earnings-result"><strong>来源</strong> ${sources || '—'}</p>
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
    $('macro-state').textContent = `更新于 ${updated}（北京时间） · ${payload.year} 年共 ${payload.counts?.total ?? 0} 件 · 本季 ${quarter.counts?.total ?? 0} 件 · 低频手动刷新`;
    const byCat = Object.entries(quarter.counts?.byCategory || {}).map(([k, v]) => `${categoryLabel(k, payload.categories)} ${v}`).join(' · ');
    $('macro-summary').innerHTML = `<p class="calendar-range">${escape(quarter.label)} · ${escape(quarter.start)} 至 ${escape(quarter.end)}</p><details class="reading-rules"><summary>本季度范围与来源</summary><div class="earnings-summary-card">
      <p><strong>${escape(quarter.label)}</strong> ${escape(quarter.start)} → ${escape(quarter.end)}</p>
      <p><strong>焦点</strong> ${escape(payload.focus || '美股宏观')}</p>
      <p><strong>本季构成</strong> ${escape(byCat || '无')}</p>
      <p>按美东日期分组；具体发布时间换算为北京时间，自动处理夏令时。</p>
    </div></details>`;

    const byDay = new Map();
    for (const event of quarter.events || []) {
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
      return `<section class="earnings-day macro-day">
        <header class="earnings-day-head"><h2>${escape(dayHead(date))}</h2><span>${escape(String(items.length))} 件 · ${escape(date)}</span></header>
        <div class="earnings-grid">${items.map((e) => card(e, payload.categories || [])).join('')}</div>
      </section>`;
    }).join('');
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

  fetch('data/macro-events.json', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error('读取失败'); return r.json(); })
    .then((data) => { payload = data; mountTabs(); })
    .catch(() => {
      $('macro-state').textContent = '宏观日程读取失败';
      $('macro-board').innerHTML = `<div class="empty-state"><strong>读取失败</strong><p>请稍后重试，或检查 data/macro-events.json。</p></div>`;
    });
})();
