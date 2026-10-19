// VIX daily close from a fixed Cboe public source; never an arbitrary proxy.
export const VIX_URL = 'https://www.cboe.com/tradable-products/vix';
export const VIX_DATA = 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
const dateOK = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
const scoreOK = value => typeof value==='number' && Number.isFinite(value) && value>0;
export function vixBand(value) {
  if(!scoreOK(value))throw new Error('VIX数值无效');
  return value>40?{id:'extreme',label:'极度恐慌'}:value>=30?{id:'fear',label:'市场恐惧'}:value>=20?{id:'elevated',label:'波动升高'}:{id:'low',label:'波动较低'};
}
export function validVix(data,now=new Date()) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return data?.schemaVersion===1&&data.id==='cboe-vix'&&data.quoteKind==='close'&&scoreOK(data.value)&&dateOK(data.asOfDate)&&data.asOfDate<=today&&Number.isFinite(Date.parse(data.fetchedAt))&&Date.parse(data.fetchedAt)<=+now+300000&&data.source?.url===VIX_URL&&data.source?.dataUrl===VIX_DATA&&(data.previousClose===null||scoreOK(data.previousClose));
}
export function normalizeVix(csv,now=new Date()) {
  const lines=csv.trim().split(/\r?\n/);
  if(lines[0]?.replace(/^\uFEFF/,'').trim()!=='DATE,OPEN,HIGH,LOW,CLOSE')throw new Error('Cboe字段变化');
  const rows=lines.slice(1).map(line=>{const cells=line.split(','),m=cells[0]?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m&&cells.length===5?{date:`${m[3]}-${m[1]}-${m[2]}`,value:Number(cells[4])}:null;}).filter(row=>row&&dateOK(row.date)&&scoreOK(row.value)).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=rows.at(-1);if(!latest)throw new Error('未取得VIX收盘数据');
  const data={schemaVersion:1,id:'cboe-vix',value:latest.value,asOfDate:latest.date,quoteKind:'close',previousClose:rows.at(-2)?.value??null,fetchedAt:now.toISOString(),source:{name:'Cboe',url:VIX_URL,dataUrl:VIX_DATA},retrieval:{status:'ok'}};
  if(!validVix(data,now))throw new Error('VIX时间或来源无效');return data;
}
export async function fetchVix(fetcher=fetch) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try {const response=await fetcher(VIX_DATA,{signal:controller.signal,redirect:'manual'});if(!response.ok)throw new Error(`Cboe HTTP ${response.status}`);const csv=await response.text();if(csv.length>2000000)throw new Error('Cboe响应过大');return normalizeVix(csv);}finally{clearTimeout(timeout);}
}
async function read(response){try{if(!response?.ok)return null;const data=await response.json();return validVix(data)?data:null;}catch{return null;}}
export async function vixResponse(request,env,ctx) {
  if(!['GET','HEAD'].includes(request.method))return new Response('只读指标',{status:405,headers:{Allow:'GET, HEAD'}});
  const respond=(data,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const key=new Request(new URL('/api/vix',request.url)),cache=globalThis.caches?.default;
  let cached=null,snapshot=null;try{if(cache)cached=await read(await cache.match(key));}catch{}
  if(cached&&Date.now()-Date.parse(cached.fetchedAt)<300000)return respond(cached);
  try{snapshot=await read(await env.ASSETS.fetch(new Request(new URL('/data/market-volatility.json',request.url))));}catch{}
  const previous=[cached,snapshot].filter(Boolean).sort((a,b)=>b.asOfDate.localeCompare(a.asOfDate))[0];
  try{
    const latest=await fetchVix(),data=previous&&previous.asOfDate>latest.asOfDate?{...previous,fetchedAt:latest.fetchedAt,retrieval:{status:'retained'}}:latest;
    if(cache){const save=cache.put(key,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}})).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(save);else await save;}
    return respond(data);
  }catch{ return previous?respond({...previous,retrieval:{status:'failed'}}):respond({unavailable:true},503); }
}
