import { LABELS, CNN_URL, MIRROR_URL, validSnapshot, STALE_MS } from './market-sentiment.mjs';

const root = document.getElementById('market-sentiment');
const number = value => Number.isFinite(value) ? value.toFixed(1) : '—';
const time = value => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let displayed = null;

function render(data, pending = false) {
  if (!validSnapshot(data)) throw new Error('指数数据无效');
  const expired = Date.now() - Date.parse(data.timestamp) > STALE_MS;
  const failed = data.retrieval?.status === 'failed';
  const delta = data.previous.close == null ? null : data.score - data.previous.close;
  const deltaText = delta == null ? '与上次收盘对比待补' : `较上次收盘 ${delta > 0 ? '+' : ''}${number(delta)} 点`;
  const status = expired ? '数据较旧' : pending ? '正在核对来源' : failed ? '获取失败 · 沿用保存值' : data.source.method === 'mirror' ? '公开镜像 · 最近公布值' : 'CNN · 最近公布值';
  const notes = [expired ? '原始数据已超过72小时，请核对原站；周末和休市期间可能不更新。' : '休市期间显示最近公布值，不是实时行情。'];
  if (failed) notes.push('本次未取得新值，保留原始时间。');
  if (data.retrieval?.status === 'retained') notes.push('来源日期回退，已保留较新存档。');
  root.dataset.rating = data.rating.replaceAll(' ', '-');
  root.innerHTML = `<div class="sentiment-heading"><h2 id="sentiment-title">恐惧与贪婪指数 <span>美股 · CNN</span></h2><span class="badge ${expired || failed ? 'sentiment-warning' : ''}">${status}</span></div>
    <div class="sentiment-body"><div class="sentiment-reading"><div><strong class="sentiment-number">${number(data.score)}</strong><span class="sentiment-denominator"> / 100</span><strong class="sentiment-rating">${LABELS[data.rating]}</strong></div><p>${deltaText}</p></div>
    <dl class="sentiment-history">${[['close', '上次收盘'], ['week', '一周前'], ['month', '一月前']].map(([key, label]) => `<div><dt>${label}</dt><dd>${number(data.previous[key])}</dd></div>`).join('')}</dl></div>
    <div class="sentiment-meter" role="meter" aria-label="CNN美股恐惧与贪婪指数" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${data.score}" aria-valuetext="${number(data.score)}，${LABELS[data.rating]}"><span class="sentiment-zone zone-extreme-fear"></span><span class="sentiment-zone zone-fear"></span><span class="sentiment-zone zone-neutral"></span><span class="sentiment-zone zone-greed"></span><span class="sentiment-zone zone-extreme-greed"></span><span class="sentiment-pointer" style="left:${data.score}%" aria-hidden="true"></span></div>
    <div class="sentiment-legend" aria-hidden="true"><span>0 极度恐惧</span><span>恐惧</span><span>中性</span><span>贪婪</span><span>极度贪婪 100</span></div>
    <p class="sentiment-meta">数据时间 ${escape(time(data.timestamp))}（北京时间） · <a href="${CNN_URL}" target="_blank" rel="noopener noreferrer">CNN原站 ↗</a>${data.source.method === 'mirror' ? ` · <a href="${MIRROR_URL}" target="_blank" rel="noopener noreferrer">数据镜像 ↗</a>` : ''}</p>
    <p class="sentiment-note">${notes.join('')} 情绪指标不代表涨跌概率或买卖信号。</p>`;
  displayed = data;
}

if (root) {
  // Saved evidence renders first, independently of the news/edition loader.
  const snapshot = fetch('data/market-sentiment.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (!displayed) render(data, true); }).catch(() => {});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  fetch('/api/market-sentiment', { cache: 'no-store', signal: controller.signal }).then(async response => {
    if (!response.ok) throw new Error('指数服务暂不可用');
    const data = await response.json();
    if (displayed && Date.parse(data.timestamp) < Date.parse(displayed.timestamp)) render({ ...displayed, retrieval: { status: 'retained' } });
    else render(data);
  }).catch(async () => {
    await snapshot;
    if (displayed) render({ ...displayed, retrieval: { status: 'failed' } });
    else root.innerHTML = `<div class="sentiment-heading"><h2 id="sentiment-title">恐惧与贪婪指数 <span>美股 · CNN</span></h2><span class="badge sentiment-warning">暂不可用</span></div><p class="sentiment-note">未取得有效数据，不以0分替代。<a href="${CNN_URL}" target="_blank" rel="noopener noreferrer">查看CNN原站 ↗</a></p>`;
  }).finally(() => clearTimeout(timeout));
}
