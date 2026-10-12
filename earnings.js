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

  let payload = null;
  let activeId = 'current';
  let blurbs = {};

  function card(item, date) {
    const themes = (item.themes || []).map((t) => `<span class="badge">${escape(t)}</span>`).join('');
    const result = item.result || {};
    const resultText = IntelCalendar.earningsState(item, date);
    return `<article class="earnings-card">
      <div class="earnings-card-top">
        <strong>${escape(item.symbol)}</strong>
        <span class="badge">${escape(item.timeLabel)}</span>
        ${item.selection === 'autonomous' ? '<span class="badge">自主判断</span>' : ''}
        ${themes}
      </div>
      <p class="earnings-name">${escape(item.name)}</p>
      <details open class="company-details"><summary>公司与收录说明</summary><p class="earnings-blurb">${escape(blurbs[item.symbol] || item.businessBlurb || '主营信息暂未收录。')}</p><p>${escape(item.selectionReason || '')}</p></details>
      <p class="earnings-meta">${escape(money(item.marketCapUsd))}${item.epsForecast ? ` · EPS 预期 ${escape(item.epsForecast)}` : ''}</p>
      <p class="earnings-result"><strong>结果</strong> ${escape(resultText)}${result.summary ? ` · ${escape(result.summary)}` : ''}</p>
      ${Array.isArray(result.sources) ? `<div class="result-sources">${result.sources.map(s => typeof s === 'string' ? { url: s } : s).filter(s => /^https:\/\//.test(s?.url || '')).map((s, i) => `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name || s.title || `评分依据 ${i + 1}`)} ↗</a>`).join(' · ')}</div>` : ''}
    </article>`;
  }

  function renderWeek(week) {
    if (!week) {
      $('earnings-board').innerHTML = `<div class="empty-state"><strong>暂无该周数据</strong><p>该周财报日历尚未生成，下一次讯息更新时会自动补上。</p></div>`;
      return;
    }
    const updated = payload.updatedAt
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(payload.updatedAt))
      : '未知';
    $('earnings-state').textContent = `更新于 ${updated}（北京时间） · ${week.label} 重要 ${week.counts?.important ?? 0} / 原始 ${week.counts?.raw ?? 0}`;
    $('earnings-summary').innerHTML = `<p class="calendar-range">${escape(week.label)} · ${escape(week.weekStart)} 至 ${escape(week.weekEnd)}（美东日期）</p><details open class="reading-rules"><summary>本周范围与筛选规则</summary><div class="earnings-summary-card">
      <p><strong>${escape(week.label)}</strong> ${escape(week.weekStart)} → ${escape(week.weekEnd)}</p>
      <p><strong>主源</strong> ${escape(payload.source?.name || 'Nasdaq')}</p>
      <p><strong>筛选</strong> 主题池（半导体 / 电力 / 软件 / 老牛股 / 新兴科技）优先，其余超大市值自主判断；每日最多 ${escape(payload.policy?.maxPerDay)} 家</p>
    </div></details>`;
    $('earnings-board').innerHTML = (week.days || []).map((day) => {
      const body = day.items?.length
        ? `<div class="earnings-grid">${day.items.map(item => card(item, day.date)).join('')}</div>`
        : `<p class="calendar-empty">当日无入选重点公司 · 原始日历 ${escape(day.rawCount)} 家</p>`;
      return `<section class="earnings-day${day.items?.length ? '' : ' calendar-empty-day'}">
        <header class="earnings-day-head"><h2><time datetime="${escape(day.date)}">${escape(dayLabel(day.date))}</time><small>美东披露日期</small></h2><span>重点 ${escape(day.items.length)} 家 · 日历 ${escape(day.rawCount)} 家</span></header>
        ${day.stale ? `<p class="brief-small">当日日历拉取失败，显示的是上次数据（可能过时）。</p>` : ''}
        ${day.truncated?.length ? `<p class="brief-small">另有 ${escape(day.truncated.length)} 家超出每日上限未展示：${escape(day.truncated.join('、'))}</p>` : ''}
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
      `<button type="button" role="tab" data-week="${escape(week.id)}" aria-selected="false" tabindex="-1"><strong>${escape(week.label)}</strong></button>`
    ).join('');
    $('earnings-week-tabs').querySelectorAll('[role="tab"]').forEach((button) => {
      button.addEventListener('click', () => activate(button.dataset.week));
    });
    activate(payload.activeWeekId || 'current');
  }

  Promise.all([
    fetch('data/earnings-calendar.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('读取失败'); return r.json(); }),
    fetch('config/company-blurbs.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { blurbs: {} })).catch(() => ({ blurbs: {} }))
  ])
    .then(([data, blurbFile]) => {
      payload = data;
      blurbs = blurbFile.blurbs || {};
      mountTabs();
    })
    .catch(() => {
      $('earnings-state').textContent = '财报日历读取失败';
      $('earnings-board').innerHTML = `<div class="empty-state"><strong>读取失败</strong><p>请稍后重试，或检查 data/earnings-calendar.json。</p></div>`;
    });
})();
