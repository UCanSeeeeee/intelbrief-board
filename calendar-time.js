/* Shared civil-time and disclosure display rules; no network or data mutations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IntelCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const zone = 'America/New_York';
  function parts(value, timeZone = zone) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function fromNewYork(date, clock) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(clock)) return null;
    const target = Date.parse(`${date}T${clock}:00Z`);
    if (!Number.isFinite(target)) return null;
    let utc = target;
    for (let i = 0; i < 3; i++) {
      const p = parts(new Date(utc));
      utc += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    }
    const p = parts(new Date(utc));
    return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === clock ? new Date(utc) : null;
  }
  function macroTime(event) {
    const clocks = [...String(event.timeEt || '').matchAll(/\b(\d{2}:\d{2})\b/g)].map(m => m[1]);
    if (!clocks.length) return `美东 ${event.date} · ${event.timeEt || '时间待公布'}；北京时间待具体时刻确认`;
    const converted = clocks.map(clock => {
      const instant = fromNewYork(event.date, clock);
      if (!instant) return '时间待核验';
      const p = parts(instant, 'Asia/Shanghai');
      return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
    });
    return `北京时间${String(event.timeEt).includes('约') ? '约' : ''} ${converted.join(' / ')} · 对应美东 ${event.date} ${event.timeEt}`;
  }
  function earningsState(item, date, now = new Date()) {
    const result = item.result || {};
    const bands = { miss: '不及预期', inline: '符合预期', beat: '超预期', smash: '远超预期' };
    if (result.status === 'scored' && Number.isFinite(result.score)) {
      return `${result.bandLabel || bands[result.band] || '已评分'} · ${result.score}分`;
    }
    if (result.disclosedAt || result.disclosureConfirmed === true || ['disclosed', 'pending-score'].includes(result.status)) {
      return result.status === 'pending-score' || result.factsComplete === true ? '待评分' : '结果待补录';
    }
    if (result.status === 'unknown') return '暂无法评分 · 披露与结果待核验';
    const p = parts(now);
    const today = `${p.year}-${p.month}-${p.day}`;
    if (date > today) return '待披露';
    if (date < today) return '披露状态待核验';
    const clock = `${p.hour}:${p.minute}`;
    if (item.timeCode === 'bmo' && clock >= '09:30') return '披露状态待核验';
    if (item.timeCode === 'amc' && clock >= '16:00') return '披露状态待核验';
    return '待披露';
  }
  return { fromNewYork, macroTime, earningsState };
});
