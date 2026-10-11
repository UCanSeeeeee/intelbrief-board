/* Person profiles are sourced from the maintained registry; timelines use archived X posts only. */
(function () {
  const selector = document.getElementById('people-selector');
  const detail = document.getElementById('person-detail');
  const state = document.getElementById('people-state');
  if (!selector || !detail || !state) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '时间未查明';
  const tier = {primary:'机构一手',direct:'本人直接发言',established:'成熟来源',specialist:'垂直研究者',monitored:'观察中',unknown:'未登记'};
  const sourceClass = {'named-insider':'具名当事人','official-organization':'官方机构','official-institution':'公共机构'};
  const safeUrl = value => /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(value || '') ? value : '#';
  async function json(url) {
    const response = await fetch(url,{cache:'no-store'});
    if (!response.ok) throw new Error('读取失败');
    return response.json();
  }
  function timelinePost(post) {
    const score = post.credibility || {};
    return `<article class="person-post">
      <div class="person-post-head"><time>${escape(time(post.createdAt))}（北京时间）</time><span>可信度初评 ${escape(score.overall ?? '—')}/100 · 未校准</span></div>
      <p>${escape(post.text)}</p>
      <div class="topic-row">${(post.topics || []).map(topic=>`<span>${escape(topic)}</span>`).join('')}</div>
      <a href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>
    </article>`;
  }
  function render(person, posts) {
    const personPosts = posts.filter(post => String(post.author?.username).toLowerCase() === person.username.toLowerCase()).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    selector.querySelectorAll('button').forEach(button => {
      const active = button.dataset.person === person.username.toLowerCase();
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    detail.innerHTML = `<header class="person-profile">
      <div class="person-avatar" aria-hidden="true">${escape((person.displayName || person.username).slice(0,1).toUpperCase())}</div>
      <div><h2>${escape(person.displayName || person.username)}</h2><a href="https://x.com/${escape(person.username)}" target="_blank" rel="noopener noreferrer">@${escape(person.username)} ↗</a><p>${escape(tier[person.trustTier] || '来源等级未登记')} · ${escape(sourceClass[person.sourceClass] || '身份类别待核对')}</p></div>
      <div class="person-count"><strong>${personPosts.length}</strong><span>已采集原帖</span></div>
    </header>
    <div class="topic-row person-topics">${(person.topics || []).map(topic=>`<span>${escape(topic)}</span>`).join('')}</div>
    <div class="person-timeline">${personPosts.length ? personPosts.map(timelinePost).join('') : '<div class="empty-state"><strong>尚未采集到该人物原帖</strong><p>人物入口已建立；后续只在取得可核验的本人 X 原帖后加入时间线。</p></div>'}</div>`;
    const url = new URL(location.href);
    url.searchParams.set('person',person.username);
    history.replaceState(null,'',url.pathname + '?' + url.searchParams.toString());
  }
  Promise.all([json('sources/x-sources.json'),json('data/x-intelligence.json')]).then(([registry,intelligence])=> {
    const people=(registry.accounts || []).filter(account=>account.enabled && account.category==='people');
    const posts=Array.isArray(intelligence.posts) ? intelligence.posts : [];
    state.textContent=`${people.length} 位已登记人物 · ${posts.filter(post=>post.category==='people').length} 条人物原帖`;
    if (!people.length) {
      selector.innerHTML='';
      detail.innerHTML='<div class="empty-state"><strong>尚未登记具体人物</strong><p>在人工来源表核对身份后，人物才会出现在这里。</p></div>';
      return;
    }
    selector.innerHTML=people.map(person=>`<button type="button" data-person="${escape(person.username.toLowerCase())}" aria-pressed="false"><strong>${escape(person.displayName || person.username)}</strong><span>@${escape(person.username)}</span></button>`).join('');
    const requested=new URLSearchParams(location.search).get('person')?.toLowerCase();
    let active=people.find(person=>person.username.toLowerCase()===requested) || people[0];
    selector.addEventListener('click',event=> {
      const button=event.target.closest('button[data-person]');
      if (!button) return;
      active=people.find(person=>person.username.toLowerCase()===button.dataset.person) || active;
      render(active,posts);
    });
    render(active,posts);
  }).catch(()=> {
    state.textContent='人物资料读取失败';
    detail.innerHTML='<div class="empty-state"><strong>无法读取人物资料</strong><p>请稍后重试；未使用旧内容或占位发言。</p></div>';
  });
})();
