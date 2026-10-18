// US-equity sentiment only. Public, fixed upstreams; never a generic proxy.
export const CNN_URL = 'https://www.cnn.com/markets/fear-and-greed';
export const CNN_DATA = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
export const MIRROR_URL = 'https://github.com/whit3rabbit/fear-greed-data';
export const MIRROR_DATA = 'https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/json/cnn_output.json';
export const LABELS = { 'extreme fear': '极度恐惧', fear: '恐惧', neutral: '中性', greed: '贪婪', 'extreme greed': '极度贪婪' };
export const CACHE_SECONDS = 300;
export const STALE_MS = 72 * 60 * 60 * 1000;
const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const validTime = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= +now + 300000;

export function normalizeCNN(raw, method, now = new Date()) {
  const value = raw?.fear_and_greed;
  const rating = typeof value?.rating === 'string' ? value.rating.trim().toLowerCase() : '';
  if (!validScore(value?.score) || !LABELS[rating] || !validTime(value?.timestamp, now)) throw new Error('上游缺少有效分值、情绪标签或原始时间');
  const previous = {};
  for (const [key, field] of Object.entries({ close: 'previous_close', week: 'previous_1_week', month: 'previous_1_month', year: 'previous_1_year' })) previous[key] = validScore(value[field]) ? value[field] : null;
  return {
    schemaVersion: 1, id: 'cnn-fear-greed', market: 'us-equities',
    score: value.score, rating, timestamp: value.timestamp, fetchedAt: now.toISOString(), previous,
    source: { name: 'CNN Fear & Greed Index', url: CNN_URL, method, dataUrl: method === 'cnn' ? CNN_DATA : MIRROR_DATA, mirrorUrl: method === 'mirror' ? MIRROR_URL : null },
    retrieval: { status: 'ok', errors: [] }
  };
}

export function validSnapshot(value, now = new Date()) {
  return value?.schemaVersion === 1 && value.id === 'cnn-fear-greed' && value.market === 'us-equities' && validScore(value.score) && !!LABELS[value.rating] && validTime(value.timestamp, now) && validTime(value.fetchedAt, now) && ['cnn', 'mirror'].includes(value.source?.method) && value.source.url === CNN_URL && value.source.dataUrl === (value.source.method === 'cnn' ? CNN_DATA : MIRROR_DATA) && value.previous && ['close', 'week', 'month', 'year'].every(k => value.previous[k] === null || validScore(value.previous[k]));
}

export async function fetchSentiment({ fetcher = fetch, timeoutMs = 5000 } = {}) {
  const errors = [];
  for (const [method, url] of [['cnn', CNN_DATA], ['mirror', MIRROR_DATA]]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'intelbrief-board/1.0 (public market sentiment)' }, signal: controller.signal, redirect: 'manual' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // The CNN payload is small; reject oversized or non-JSON upstream responses.
      if (Number(response.headers.get('Content-Length') || 0) > 2000000) throw new Error('响应过大');
      const text = await response.text();
      if (text.length > 2000000) throw new Error('响应过大');
      const data = normalizeCNN(JSON.parse(text), method);
      data.retrieval.errors = errors;
      return data;
    } catch (error) {
      errors.push({ source: method, message: error.name === 'AbortError' ? '请求超时' : error.message });
    } finally { clearTimeout(timeout); }
  }
  const error = new Error('CNN及公开镜像均未取得有效数据');
  error.failures = errors;
  throw error;
}

async function readSnapshot(response) {
  if (!response?.ok) return null;
  try { const data = await response.json(); return validSnapshot(data) ? data : null; } catch { return null; }
}

export async function sentimentResponse(request, env, ctx) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('仅提供只读指标', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const key = new Request(new URL('/api/market-sentiment', request.url).toString());
  const cache = globalThis.caches?.default;
  let cached = null;
  try { if (cache) cached = await readSnapshot(await cache.match(key)); } catch { /* Cache is best effort. */ }
  const respond = (data, status = 200) => new Response(request.method === 'HEAD' ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_SECONDS * 1000) return respond(cached);
  let snapshot = null;
  try { snapshot = await readSnapshot(await env.ASSETS.fetch(new Request(new URL('/data/market-sentiment.json', request.url)))); } catch { /* Never affect news rendering. */ }
  const previous = [cached, snapshot].filter(Boolean).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  try {
    const latest = await fetchSentiment();
    // Upstream/mirror regression must not replace a newer saved observation.
    const data = previous && Date.parse(previous.timestamp) > Date.parse(latest.timestamp) ? { ...previous, fetchedAt: latest.fetchedAt, retrieval: { status: 'retained', message: '来源时间早于已存档数据，保留较新值', errors: latest.retrieval.errors } } : latest;
    if (cache) {
      const save = cache.put(key, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } })).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(save); else await save;
    }
    return respond(data);
  } catch (error) {
    if (previous) return respond({ ...previous, retrieval: { status: 'failed', message: '本次获取失败，沿用最近保存值', errors: error.failures || [] } });
    return respond({ schemaVersion: 1, unavailable: true, message: '暂未取得有效指数，请查看CNN原站' }, 503);
  }
}
