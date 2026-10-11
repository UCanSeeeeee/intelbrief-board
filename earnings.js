/* Nasdaq-backed weekly earnings board. No X collection on page load. */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$('earnings-board')) return;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (value) => {
    if (!Number.isFinite(value)) return '市值未知';
    if (value >= 1e12) return `约 $${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `约 $${(value / 1e9).toFixed(0)}B`;
    return `约 $${(value / 1e6).toFixed(0)}M`;
  };
  const dayLabel = (date) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(date + 'T12:00:00Z'));

  function card(item) {
    return `<article class="earnings-card">
      <div class="earnings-card-top">
        <strong>${escape(item.symbol)}</strong>
        <span class="badge">${escape(item.timeLabel)}</span>
        ${item.forcedInclude ? '<span class="badge">观察名单</span>' : ''}
      </div>
      <p class="earnings-name">${escape(item.name)}</p>
      <p class="earnings-meta">${escape(money(item.marketCapUsd))}${item.epsForecast ? ` · EPS 预期 ${escape(item.epsForecast)}` : ''}${item.fiscalQuarterEnding ? ` · 财季至 ${escape(item.fiscalQuarterEnding)}` : ''}</p>
    </article>`;
  }

  function render(data) {
    const updated = data.updatedAt
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(data.updatedAt))
      : '未知';
    $('earnings-state').textContent = `更新于 ${updated}（北京时间） · 重要 ${data.counts?.important ?? 0} / 原始 ${data.counts?.raw ?? 0}`;
    $('earnings-summary').innerHTML = `<div class="earnings-summary-card">
      <p><strong>本周窗口</strong> ${escape(data.weekStart)} → ${escape(data.weekEnd)}</p>
      <p><strong>主源</strong> ${escape(data.source?.name || 'Nasdaq')} · 按日查询公开日历</p>
      <p><strong>筛选</strong> 市值 ≥ $${((data.policy?.minMarketCapUsd || 0) / 1e9).toFixed(0)}B，或命中观察名单；每日最多 ${escape(data.policy?.maxPerDay)} 家</p>
    </div>`;
    $('earnings-board').innerHTML = (data.days || []).map((day) => {
      const body = day.items?.length
        ? `<div class="earnings-grid">${day.items.map(card).join('')}</div>`
        : `<div class="empty-state"><strong>当日无入选重要公司</strong><p>原始日历 ${escape(day.rawCount)} 家；未达市值或观察名单门槛。</p></div>`;
      return `<section class="earnings-day">
        <header class="earnings-day-head"><h2>${escape(dayLabel(day.date))}</h2><span>${escape(day.items.length)} / ${escape(day.rawCount)}</span></header>
        ${body}
      </section>`;
    }).join('') || `<div class="empty-state"><strong>暂无财报日历</strong><p>请先运行 npm run fetch:earnings。</p></div>`;
  }

  fetch('data/earnings-calendar.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('读取失败');
      return r.json();
    })
    .then(render)
    .catch(() => {
      $('earnings-state').textContent = '财报日历读取失败';
      $('earnings-board').innerHTML = `<div class="empty-state"><strong>读取失败</strong><p>请稍后重试，或检查 data/earnings-calendar.json 是否已生成。</p></div>`;
    });
})();
