#!/usr/bin/env node
/**
 * Pull the upcoming US earnings week from Nasdaq's public calendar API.
 * This page is calendar data, not the X-only intel pipeline.
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/earnings-calendar.json'), 'utf8'));

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

function upcomingWeekStart(now = new Date()) {
  const { date, weekday } = beijingParts(now);
  // If Sat/Sun in Beijing, start next Monday; else start this week's Monday (US calendar dates still YYYY-MM-DD).
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[weekday] ?? 0;
  if (offset >= 5) return addDays(date, 8 - offset); // next Monday
  return addDays(date, -offset);
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

function pickImportant(rows) {
  const always = new Set((config.important.alwaysInclude || []).map((s) => s.toUpperCase()));
  const minCap = config.important.minMarketCapUsd || 0;
  const scored = rows.map((row) => {
    const symbol = String(row.symbol || '').toUpperCase();
    const marketCapUsd = parseCap(row.marketCap);
    const forced = always.has(symbol);
    const important = forced || (marketCapUsd != null && marketCapUsd >= minCap);
    return { row, symbol, marketCapUsd, forced, important };
  });
  const selected = scored
    .filter((item) => item.important)
    .sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0))
    .slice(0, config.important.maxPerDay || 12);
  return selected;
}

async function main() {
  const weekStart = upcomingWeekStart();
  const days = weekdaysFrom(weekStart, config.displayDays || 5);
  const dayBlocks = [];
  let totalRaw = 0;
  let totalImportant = 0;

  for (const date of days) {
    const rows = await fetchDay(date);
    totalRaw += rows.length;
    const picked = pickImportant(rows);
    totalImportant += picked.length;
    dayBlocks.push({
      date,
      weekday: new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', weekday: 'short' }).format(new Date(date + 'T12:00:00Z')),
      rawCount: rows.length,
      items: picked.map(({ row, symbol, marketCapUsd, forced }) => {
        const timing = normalizeTime(row.time);
        return {
          symbol,
          name: row.name || symbol,
          timeCode: timing.code,
          timeLabel: timing.label,
          marketCap: row.marketCap || null,
          marketCapUsd,
          epsForecast: row.epsForecast || null,
          fiscalQuarterEnding: row.fiscalQuarterEnding || null,
          forcedInclude: forced,
          source: 'nasdaq'
        };
      })
    });
  }

  const output = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    timezone: config.timezone,
    weekStart,
    weekEnd: days[days.length - 1],
    source: {
      id: config.source.id,
      name: config.source.name,
      endpoint: config.source.endpoint,
      fetchedDates: days
    },
    policy: {
      minMarketCapUsd: config.important.minMarketCapUsd,
      maxPerDay: config.important.maxPerDay,
      alwaysInclude: config.important.alwaysInclude
    },
    counts: { days: days.length, raw: totalRaw, important: totalImportant },
    days: dayBlocks
  };

  const outPath = path.join(ROOT, 'data/earnings-calendar.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${outPath}: ${totalImportant} important / ${totalRaw} raw across ${days.length} days (${weekStart} → ${days.at(-1)})`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
