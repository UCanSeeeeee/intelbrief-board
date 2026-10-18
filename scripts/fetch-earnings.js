#!/usr/bin/env node
/**
 * Pull last / current / next US earnings weeks from Nasdaq.
 * Selection: theme pools first, then autonomous large-cap judgment.
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/earnings-calendar.json'), 'utf8'));
const OUT = path.join(ROOT, 'data/earnings-calendar.json');

function parseCap(text) {
  if (!text || typeof text !== 'string') return null;
  const n = Number(String(text).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function beijingParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday };
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekdaysFrom(startIso, count) {
  const out = [];
  let cur = startIso;
  while (out.length < count) {
    const wd = new Date(cur + 'T12:00:00Z').getUTCDay();
    if (wd >= 1 && wd <= 5) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function currentWeekStart(now = new Date()) {
  const { date, weekday } = beijingParts(now);
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[weekday] ?? 0;
  if (offset >= 5) return addDays(date, 7 - offset);
  return addDays(date, -offset);
}

// Nasdaq uses BRK.B style; normalize BRK-B / brk.b variants so they always match.
function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/-/g, '.');
}

function themeIndex() {
  const map = new Map();
  for (const [id, theme] of Object.entries(config.themes || {})) {
    for (const ticker of theme.tickers || []) {
      const symbol = normalizeSymbol(ticker);
      if (!map.has(symbol)) map.set(symbol, []);
      if (!map.get(symbol).some((t) => t.id === id)) map.get(symbol).push({ id, label: theme.label });
    }
  }
  return map;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry with exponential backoff; the caller falls back to stale prior data on final failure.
async function fetchDayWithRetry(date, { retries = config.source.retries ?? 3, baseMs = 1000, fetcher = fetchDay } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetcher(date);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}

async function fetchDay(date) {
  const url = `${config.source.endpoint}?date=${date}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://www.nasdaq.com',
      Referer: 'https://www.nasdaq.com/'
    }
  });
  if (!response.ok) throw new Error(`Nasdaq ${date} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.status?.rCode !== 200) throw new Error(`Nasdaq ${date} status ${JSON.stringify(payload?.status)}`);
  return payload?.data?.rows || [];
}

function normalizeTime(value) {
  if (value === 'time-pre-market') return { code: 'bmo', label: '盘前' };
  if (value === 'time-after-hours') return { code: 'amc', label: '盘后' };
  return { code: 'unspecified', label: '时段未公布' };
}

function pickImportant(rows, themes, maxPerDay = config.important.maxPerDay || 15) {
  const autoCap = config.important.autonomousMinMarketCapUsd || 0;
  const scored = rows.map((row) => {
    const symbol = normalizeSymbol(row.symbol);
    const marketCapUsd = parseCap(row.marketCap);
    const hitThemes = themes.get(symbol) || [];
    const themeHit = hitThemes.length > 0;
    const autonomous = !themeHit && marketCapUsd != null && marketCapUsd >= autoCap;
    let reason = '';
    if (themeHit) reason = `主题：${hitThemes.map((t) => t.label).join('、')}`;
    else if (autonomous) reason = '自主判断：超大市值，可能影响指数/板块定价';
    return { row, symbol, marketCapUsd, hitThemes, themeHit, autonomous, keep: themeHit || autonomous, reason };
  });
  const kept = scored
    .filter((item) => item.keep)
    .sort((a, b) => {
      if (a.themeHit !== b.themeHit) return a.themeHit ? -1 : 1;
      return (b.marketCapUsd || 0) - (a.marketCapUsd || 0);
    });
  const picked = kept.slice(0, maxPerDay);
  picked.truncated = kept.slice(maxPerDay).map((item) => item.symbol);
  return picked;
}

function previousDays() {
  const map = new Map();
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    for (const week of prev.weeks || []) for (const day of week.days || []) map.set(day.date, day);
  } catch {}
  return map;
}

function previousResults() {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const map = new Map();
    for (const week of prev.weeks || []) {
      for (const day of week.days || []) {
        for (const item of day.items || []) {
          if (item.result && item.result.status && item.result.status !== 'unreviewed') {
            map.set(`${day.date}:${item.symbol}`, item.result);
          }
        }
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function buildWeek(id, label, weekStart, themes, resultMap, priorDays = new Map(), fetcher) {
  const days = weekdaysFrom(weekStart, config.displayDays || 5);
  const dayBlocks = [];
  let raw = 0;
  let important = 0;
  for (const date of days) {
    let rows;
    try {
      rows = await fetchDayWithRetry(date, fetcher ? { fetcher, baseMs: 0 } : {});
    } catch (error) {
      const prior = priorDays.get(date);
      console.error(`Nasdaq ${date} 多次重试仍失败：${error.message}；${prior ? '沿用上次数据并标 stale' : '无旧数据，当日留空并标 stale'}`);
      const stale = prior ? { ...prior, stale: true, staleReason: error.message } : { date, weekday: '', rawCount: 0, items: [], truncated: [], stale: true, staleReason: error.message };
      raw += stale.rawCount || 0;
      important += (stale.items || []).length;
      dayBlocks.push(stale);
      continue;
    }
    raw += rows.length;
    const picked = pickImportant(rows, themes);
    important += picked.length;
    dayBlocks.push({
      truncated: picked.truncated,
      stale: false,
      date,
      weekday: new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', weekday: 'short' }).format(
        new Date(date + 'T12:00:00Z')
      ),
      rawCount: rows.length,
      items: picked.map(({ row, symbol, marketCapUsd, hitThemes, themeHit, autonomous, reason }) => {
        const timing = normalizeTime(row.time);
        const key = `${date}:${symbol}`;
        const prior = resultMap.get(key);
        return {
          symbol,
          name: row.name || symbol,
          timeCode: timing.code,
          timeLabel: timing.label,
          marketCap: row.marketCap || null,
          marketCapUsd,
          epsForecast: row.epsForecast || null,
          fiscalQuarterEnding: row.fiscalQuarterEnding || null,
          themes: hitThemes.map((t) => t.label),
          selection: themeHit ? 'theme' : autonomous ? 'autonomous' : 'other',
          selectionReason: reason,
          source: 'nasdaq',
          result: prior || { status: 'unreviewed', score: null, band: null, summary: null, checkedAt: null }
        };
      })
    });
    if (!fetcher) await sleep(200);
  }
  return {
    id,
    label,
    weekStart,
    weekEnd: days[days.length - 1],
    counts: { days: days.length, raw, important },
    days: dayBlocks
  };
}

async function main() {
  const themes = themeIndex();
  const resultMap = previousResults();
  const priorDays = previousDays();
  const currentStart = currentWeekStart();
  const lastStart = addDays(currentStart, -7);
  const nextStart = addDays(currentStart, 7);
  const weeks = [
    await buildWeek('last', '上周', lastStart, themes, resultMap, priorDays),
    await buildWeek('current', '本周', currentStart, themes, resultMap, priorDays),
    await buildWeek('next', '下周', nextStart, themes, resultMap, priorDays)
  ];
  const output = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    timezone: config.timezone,
    activeWeekId: 'current',
    source: {
      id: config.source.id,
      name: config.source.name,
      endpoint: config.source.endpoint
    },
    selectionCore: config.selectionCore,
    policy: {
      themes: Object.fromEntries(
        Object.entries(config.themes || {}).map(([id, theme]) => [id, { label: theme.label, size: (theme.tickers || []).length }])
      ),
      autonomousMinMarketCapUsd: config.important.autonomousMinMarketCapUsd,
      maxPerDay: config.important.maxPerDay
    },
    counts: {
      weeks: weeks.length,
      raw: weeks.reduce((s, w) => s + w.counts.raw, 0),
      important: weeks.reduce((s, w) => s + w.counts.important, 0)
    },
    weeks
  };
  const todayBj = beijingParts().date;
  const pendingReview = [];
  for (const week of weeks) {
    for (const day of week.days) {
      for (const item of day.items) {
        if (day.date < todayBj && (!item.result || item.result.status === 'unreviewed')) {
          pendingReview.push({ week: week.id, date: day.date, symbol: item.symbol, name: item.name, timeLabel: item.timeLabel });
        }
      }
    }
  }
  output.pendingReview = pendingReview;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
  if (pendingReview.length) {
    console.log(`待评价 ${pendingReview.length} 家（已过披露日、尚未评分），须立即查询结果并评分：`);
    for (const p of pendingReview) console.log(`  - ${p.date} ${p.symbol} ${p.name}`);
  } else {
    console.log('待评价 0 家');
  }
  for (const week of weeks) {
    console.log(
      `${week.label} ${week.weekStart}→${week.weekEnd}: ${week.counts.important} important / ${week.counts.raw} raw`
    );
  }
  const truncated = weeks.flatMap((w) => w.days.filter((d) => d.truncated?.length).map((d) => `${d.date} 截断 ${d.truncated.length} 家：${d.truncated.join(', ')}`));
  if (truncated.length) console.log(`超过每日上限被截断：\n  ${truncated.join('\n  ')}`);
  const stale = weeks.flatMap((w) => w.days.filter((d) => d.stale).map((d) => d.date));
  if (stale.length) console.log(`以下日期拉取失败，沿用旧数据（stale）：${stale.join(', ')}`);
  console.log(`Wrote ${OUT}`);
  // Nonzero exit lets automation stop until every past-disclosure company is scored or marked unknown.
  if (pendingReview.length) process.exitCode = 2;
}

module.exports = { normalizeSymbol, themeIndex, pickImportant, fetchDayWithRetry, buildWeek, currentWeekStart };

if (require.main === module) main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
