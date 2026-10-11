/* Nasdaq-backed earnings board with last / current / next week tabs. */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$('earnings-board') || !$('earnings-week-tabs')) return;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (value) => {
    if (!Number.isFinite(value)) return '市值未知';
    if (value >= 1e12) return `约 $${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `约 $${(value / 1e9).toFixed(0)}B`;
    return `约 $${(value / 1e6).toFixed(0)}M`;
  };
  const dayLabel = (date) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(date + 'T12:00:00Z'));
  const bandLabel = { miss: '不及预期', inline: '符合预期', beat: '超预期', smash: '远超预期', unreviewed: '未评价', unknown: '未知' };

  let payload = null;
  let activeId = 'current';

  function card(item) {
    const themes = (item.themes || []).map((t) => `<span class="badge">${escape(t)}</span>`).join('');
    const result = item.result || {};
    const resultText = result.status && result.status !== 'unreviewed'
      ? `${bandLabel[result.band] || result.band || bandLabel[result.status] || result.status}${Number.isFinite(result.score) ? ` · ${result.score}分` : ''}`
      : '结果未评价';
    return `<article class="earnings-card">
      <div class="earnings-card-top">
        <strong>${escape(item.symbol)}</strong>
        <span class="badge">${escape(item.timeLabel)}</span>
        ${item.selection === 'autonomous' ? '<span class="badge">自主判断</span>' : ''}
        ${themes}
      </div>
      <p class="earnings-name">${escape(item.name)}</p>
      <p class="earnings-meta">${escape(money(item.marketCapUsd))}${item.epsForecast ? ` · EPS 预期 ${escape(item.epsForecast)}` : ''}</p>
      <p class="earnings-meta">${escape(item.selectionReason || '')}</p>
      <p class="earnings-result"><strong>结果</strong> ${escape(resultText)}${result.summary ? ` · ${escape(result.summary)}` : ''}</p>
    </article>`;
  }

  function renderWeek(week) {
    if (!week) {
      $('earnings-board').innerHTML = `<div class="empty-state"><strong>暂无该周数据</strong><p>请先运行 npm run fetch:earnings。</p></div>`;
      return;
    }
    const updated = payload.updatedAt
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(payload.updatedAt))
      : '未知';
    $('earnings-state').textContent = `更新于 ${updated}（北京时间） · ${week.label} 重要 ${week.counts?.important ?? 0} / 原始 ${week.counts?.raw ?? 0}`;
    $('earnings-summary').innerHTML = `<div class="earnings-summary-card">
      <p><strong>${escape(week.label)}</strong> ${escape(week.weekStart)} → ${escape(week.weekEnd)}</p>
      <p><strong>主源</strong> ${escape(payload.source?.name || 'Nasdaq')}</p>
      <p><strong>筛选</strong> 主题池（半导体 / 电力 / 软件 / 老牛股 / 新兴科技）优先，其余超大市值自主判断；每日最多 ${escape(payload.policy?.maxPerDay)} 家</p>
    </div>`;
    $('earnings-board').innerHTML = (week.days || []).map((day) => {
      const body = day.items?.length
        ? `<div class="earnings-grid">${day.items.map(card).join('')}</div>`
        : `<div class="empty-state"><strong>当日无入选重点公司</strong><p>原始日历 ${escape(day.rawCount)} 家。</p></div>`;
      return `<section class="earnings-day">
        <header class="earnings-day-head"><h2>${escape(dayLabel(day.date))}</h2><span>${escape(day.items.length)} / ${escape(day.rawCount)}</span></header>
        ${body}
      </section>`;
    }).join('');
  }

  function activate(id) {
    activeId = id;
    $('earnings-week-tabs').querySelectorAll('[role="tab"]').forEach((button) => {
      const on = button.dataset.week === id;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    renderWeek((payload.weeks || []).find((week) => week.id === id));
  }

  function mountTabs() {
    const weeks = payload.weeks || [];
    $('earnings-week-tabs').innerHTML = weeks.map((week) =>
      `<button type="button" role="tab" data-week="${escape(week.id)}" aria-selected="false" tabindex="-1"><strong>${escape(week.label)}</strong><span>${escape(week.weekStart)} → ${escape(week.weekEnd)} · ${escape(week.counts?.important || 0)} 家</span></button>`
    ).join('');
    $('earnings-week-tabs').querySelectorAll('[role="tab"]').forEach((button) => {
      button.addEventListener('click', () => activate(button.dataset.week));
    });
    activate(payload.activeWeekId || 'current');
  }

  fetch('data/earnings-calendar.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('读取失败');
      return r.json();
    })
    .then((data) => {
      payload = data;
      mountTabs();
    })
    .catch(() => {
      $('earnings-state').textContent = '财报日历读取失败';
      $('earnings-board').innerHTML = `<div class="empty-state"><strong>读取失败</strong><p>请稍后重试，或检查 data/earnings-calendar.json。</p></div>`;
    });
})();
