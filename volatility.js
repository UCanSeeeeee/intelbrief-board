import {VIX_URL,validVix,vixBand} from './market-volatility.mjs';
const root=document.getElementById('market-vix');let displayed;
const number=value=>value.toFixed(2);
function render(data){
  if(!validVix(data))throw new Error('VIX数据无效');
  const band=vixBand(data.value),delta=data.previousClose===null?null:data.value-data.previousClose;
  const old=(Date.now()-Date.parse(data.asOfDate+'T00:00:00Z'))/86400000>4;
  const warning=old?'数据较旧':data.retrieval?.status==='failed'?'获取失败 · 保留旧值':'';
  root.innerHTML=`<div class="sentiment-heading"><h2 id="vix-title">VIX</h2>${warning?`<span class="badge sentiment-warning">${warning}</span>`:''}</div>
    <div class="sentiment-reading"><div><strong class="sentiment-number">${number(data.value)}</strong><strong class="sentiment-rating vix-${band.id}">${band.label}</strong></div>${delta===null?'':`<p>较上次收盘 ${delta>0?'+':''}${number(delta)}</p>`}</div>
    <div class="vix-bands">${[['low','< 20','波动较低'],['elevated','20–<30','波动升高'],['fear','30–40','市场恐惧'],['extreme','> 40','极度恐慌']].map(([id,range,label])=>`<div class="vix-band${id===band.id?' is-active':''}"><span>${range.replace('<','&lt;')}</span><span>${label}</span></div>`).join('')}</div>
    <p class="sentiment-meta">${data.asOfDate} 美东收盘 · <a href="${VIX_URL}" target="_blank" rel="noopener noreferrer">Cboe ↗</a></p>`;
  displayed=data;
}
if(root){
  const snapshot=fetch('data/market-volatility.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(!displayed)render(data);}).catch(()=>{});
  fetch('/api/vix',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(displayed&&data.asOfDate<displayed.asOfDate)return;render(data);}).catch(async()=>{await snapshot;if(displayed)render({...displayed,retrieval:{status:'failed'}});else root.innerHTML=`<div class="sentiment-heading"><h2 id="vix-title">VIX</h2><span class="badge sentiment-warning">暂不可用</span></div><a href="${VIX_URL}" target="_blank" rel="noopener noreferrer">Cboe ↗</a>`;});
}
