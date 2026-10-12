/* Shared server-backed updates. No credentials or job state in localStorage. */
(function () {
  const page=document.body.dataset.page;
  if (!['news','people','tickers','ai','crypto'].includes(page)) return;
  const names={news:'美股讯息',people:'具体人物',tickers:'具体个股',ai:'AI板块',crypto:'加密'};
  const pagesAll=['news','people','tickers','ai','crypto'];
  const labels={queued:'等待执行',collecting:'正在采集',validating:'整理与核验',publishing:'正在发布',complete:'更新完成',partial:'部分完成',unchanged:'已检查，暂无新增',failed:'更新失败'};
  const time=value=>value ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '尚无成功更新';
  const busy=job=>job && ['queued','running'].includes(job.status);
  const sidebar=document.createElement('div');
  sidebar.className='update-sidebar';
  sidebar.innerHTML='<button class="update-button" id="update-all" type="button" disabled>↻ 全部更新</button>';
  document.querySelector('.sidebar .nav').after(sidebar);
  const toolbar=document.createElement('div');
  toolbar.className='update-page-toolbar';
  toolbar.innerHTML=`<span id="update-last" role="status">正在连接更新服务…</span><button class="update-button" id="update-page" type="button" disabled>↻ 采集本页</button>`;
  document.querySelector('.page-header').append(toolbar);
  const panel=document.createElement('section');
  panel.id='update-panel'; panel.className='update-panel'; panel.hidden=false;
  panel.setAttribute('aria-label','内容更新');
  panel.innerHTML='<p id="update-connection" role="status"></p><div id="update-error" role="alert"></div><form id="update-login" hidden><label for="update-key">管理密钥</label><div class="update-login-row"><input id="update-key" type="password" autocomplete="current-password" required maxlength="128" placeholder="输入管理密钥"/><button class="update-button" type="submit">登录</button></div><p>登录后可手动更新；密钥不会保存在网页中。</p></form><div class="update-panel-actions"><button class="update-button" id="update-retry" type="button" hidden>重试失败项</button><button id="update-logout" type="button" hidden>退出管理</button></div>';
  document.querySelector('.page-header').after(panel);
  const $=id=>document.getElementById(id);
  let snapshot=null, submitting=false, available=false, requestIntent=null;
  const observed=new Map();
  async function api(path='',input) {
    const response=await fetch('/api/updates'+path,{method:input?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:input?{'Content-Type':'application/json'}:{},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>({error:'更新服务暂时不可用'}));
    if (!response.ok) throw Object.assign(new Error(data.error||'请求失败'),{status:response.status,data});
    return data;
  }
  function latest(page) { return snapshot?.jobs?.find(j=>j.page===page); }
  function render() {
    const logged=!!snapshot?.authenticated, active=latest(page);
    const sameBatch=pagesAll.every(p=>!latest(p) || latest(p)?.cutoff===latest('news')?.cutoff);
    const allBusy=pagesAll.every(p=>busy(latest(p))) || (sameBatch && pagesAll.some(p=>busy(latest(p))));
    $('update-all').disabled=submitting||!available||(logged&&allBusy);
    $('update-page').disabled=submitting||!available||(logged&&busy(active));
    $('update-all').textContent=allBusy?'正在更新…':'↻ 全部更新';
    $('update-page').textContent=busy(active)?labels[active.stage]+'…':'↻ 采集本页';
    $('update-login').hidden=!available||logged;
    $('update-logout').hidden=!logged;
    if (!logged) { $('update-retry').hidden=true; return; }
    $('update-connection').textContent=active?.message || (snapshot.online?'Grok 执行端在线 · 更新期间可以继续浏览':'尚未收到 Grok 执行回执，请检查云端任务');
    $('update-last').textContent=busy(active) ? `${names[page]} · ${labels[active.stage]||'等待执行'}` : snapshot.lastSuccess?.[page] ? `上次成功 ${time(snapshot.lastSuccess[page])}（北京时间）` : '尚无成功采集记录';
    const latestJobs=pagesAll.map(p=>latest(p)).filter(Boolean);
    $('update-retry').hidden=!latestJobs.some(j=>j.status==='failed');
    $('update-retry').disabled=submitting;
    for (const job of latestJobs) {
      const terminal=['complete','partial','unchanged'].includes(job.status);
      const key=job.id+':'+job.attempt;
      if (terminal && observed.has(key) && observed.get(key)!==job.status) document.dispatchEvent(new CustomEvent('intelbrief:updated',{detail:{page:job.page}}));
      observed.set(key,job.status);
    }
  }
  function error(err) {
    $('update-error').textContent=err.message;
    if (err.status===401) { snapshot=null; available=true; $('update-last').textContent='登录后可手动更新'; $('update-connection').textContent='登录后可查看更新进度'; }
    else if (err.data?.configured===false) { available=false; $('update-last').textContent='网页采集尚未接通 Grok'; $('update-connection').textContent='定时任务由 Grok 独立执行，与网页按钮分开验收。'; }
    render();
  }
  async function poll() {
    if(submitting) return;
    try { snapshot=await api(); available=true; $('update-error').textContent=''; render(); }
    catch(err) {
      if(err.status===401||err.data?.configured===false) error(err);
      else { $('update-connection').textContent='暂时无法读取进度；已有任务仍在后台执行'; if(!snapshot) $('update-last').textContent='更新服务连接失败'; }
    }
  }
  async function submit(pages) {
    if(!snapshot?.authenticated) { $('update-key').focus(); return; }
    if(submitting) return;
    submitting=true; $('update-error').textContent=''; render();
    // Preserve the request ID after network errors: retrying must not enqueue twice.
    if (!requestIntent||requestIntent.pages.join()!==pages.join()) requestIntent={pages,requestId:crypto.randomUUID()};
    try { snapshot=await api('',requestIntent); requestIntent=null; }
    catch(err) { error(err); }
    finally {submitting=false; render();}
  }
  $('update-all').onclick=()=>submit(['news','people','tickers','ai','crypto']);
  $('update-page').onclick=()=>submit([page]);
  $('update-retry').onclick=async()=> {
    if(submitting) return;
    submitting=true; render();
    try { snapshot=await api('/retry',{ids:['news','people','tickers','ai','crypto'].map(p=>latest(p)).filter(j=>j?.status==='failed').map(j=>j.id)}); $('update-error').textContent=''; }
    catch(err){error(err);} finally{submitting=false;render();}
  };
  $('update-login').onsubmit=async event=> {
    event.preventDefault(); if(submitting) return;
    submitting=true; render();
    const key=$('update-key').value; $('update-key').value='';
    try { await api('/login',{key}); snapshot=await api(); available=true; $('update-error').textContent=''; }
    catch(err){error(err);} finally{submitting=false;render();}
  };
  $('update-logout').onclick=async()=> { try{await api('/logout',{});snapshot=null;await poll();}catch(err){error(err);} };
  poll();
  setInterval(()=> {if(!document.hidden) poll();},5000);
  document.addEventListener('visibilitychange',()=> {if(!document.hidden) poll();});
})();
