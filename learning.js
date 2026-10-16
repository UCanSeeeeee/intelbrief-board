/* Daily curiosities and paired professional/story explanations. */
(function () {
  const tabsNode = document.getElementById('learning-tabs');
  const panel = document.getElementById('learning-panel');
  const state = document.getElementById('learning-state');
  if (!tabsNode || !panel || !state) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const safeUrl = value => /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(value || '') ? value : '';
  const formatTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value)) : '时间未查明';
  const list = values => Array.isArray(values) && values.length ? `<ul>${values.map(value => `<li>${escape(value)}</li>`).join('')}</ul>` : '';

  async function json(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取 ${url} 失败`);
    return response.json();
  }

  function empty(title, text) {
    return `<div class="empty-state"><strong>${escape(title)}</strong><p>${escape(text)}</p></div>`;
  }

  function curiosityCard(item) {
    const url = safeUrl(item.source?.url);
    return `<article class="learning-card curiosity-card">
      <div class="learning-card-head"><span class="badge">${escape(item.category)}</span><time>${escape(item.date)}</time></div>
      <h2>${escape(item.title)}</h2>
      <p><strong>今天发现了什么</strong>${escape(item.summary)}</p>
      <p><strong>为什么有意思</strong>${escape(item.whyInteresting)}</p>
      ${item.knowledgePointId ? `<p class="learning-link-note">它对应一个基础知识点，切到“基础知识讲解”可以继续读。</p>` : ''}
      <footer><span>${escape(item.source?.author || '来源待注明')} · ${escape(formatTime(item.source?.publishedAt))}（北京时间）</span>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>` : '<span>原帖链接待核验</span>'}</footer>
    </article>`;
  }

  function mapping(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<dl class="story-mapping">${rows.map(row => `<div><dt>${escape(row.storyRole)}</dt><dd>${escape(row.professionalMeaning)}</dd></div>`).join('')}</dl>`;
  }

  function lessonCard(item) {
    const sources = Array.isArray(item.sources) ? item.sources : [];
    return `<article class="learning-card lesson-card">
      <header class="lesson-head"><div><span class="badge">${escape(item.category)}</span><h2>${escape(item.title)}</h2></div><time>更新 ${escape(formatTime(item.updatedAt))}</time></header>
      <div class="lesson-versions">
        <section class="lesson-version professional-version" aria-labelledby="${escape(item.id)}-professional">
          <p class="eyebrow">专业版</p><h3 id="${escape(item.id)}-professional">用术语把机制说准确</h3>
          <p><strong>定义</strong>${escape(item.professional.definition)}</p>
          <p><strong>运行机制</strong>${escape(item.professional.mechanism)}</p>
          <p><strong>为什么重要</strong>${escape(item.professional.whyItMatters)}</p>
          ${list(item.professional.signals)}
        </section>
        <section class="lesson-version story-version" aria-labelledby="${escape(item.id)}-story">
          <p class="eyebrow">故事版 · 18岁以上可读</p><h3 id="${escape(item.id)}-story">${escape(item.story.title)}</h3>
          <p>${escape(item.story.body)}</p>
          ${mapping(item.story.mapping)}
          <p class="analogy-boundary"><strong>这个故事不能代替什么</strong>${escape(item.story.boundary)}</p>
        </section>
      </div>
      ${Array.isArray(item.commonMistakes) && item.commonMistakes.length ? `<section class="lesson-mistakes"><h3>常见误区</h3>${list(item.commonMistakes)}</section>` : ''}
      ${sources.length ? `<footer>${sources.map(source => { const url=safeUrl(source.url); return url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>` : `<span>${escape(source.label)} · 链接待核验</span>`; }).join('')}</footer>` : ''}
    </article>`;
  }

  let config;
  let data;
  let active = 'curiosities';

  function render() {
    tabsNode.querySelectorAll('[role="tab"]').forEach(button => {
      const selected = button.dataset.tab === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const current = config.tabs.find(tab => tab.id === active);
    if (active === 'curiosities') {
      const items = data.dailyCuriosities || [];
      panel.innerHTML = `<header class="learning-section-head"><p class="eyebrow">${escape(current.eyebrow)}</p><h2>${escape(current.label)}</h2><p>${escape(current.description)}</p></header>${items.length ? `<div class="learning-list">${items.map(curiosityCard).join('')}</div>` : empty('今天暂时没有值得收录的趣事','宁可空着，也不把普通动态、段子或重复新闻塞进来。')}`;
    } else {
      const items = data.lessons || [];
      panel.innerHTML = `<header class="learning-section-head"><p class="eyebrow">${escape(current.eyebrow)}</p><h2>${escape(current.label)}</h2><p>${escape(current.description)}</p></header>${items.length ? `<div class="learning-list">${items.map(lessonCard).join('')}</div>` : empty('基础知识库正在建立','每个知识点必须同时通过专业版和故事版校验后才会发布。')}`;
    }
    const url = new URL(location.href);
    url.searchParams.set('tab', active);
    history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }

  function activate(id, focus) {
    if (!config.tabs.some(tab => tab.id === id)) return;
    active = id;
    render();
    if (focus) tabsNode.querySelector(`[data-tab="${CSS.escape(id)}"]`)?.focus();
  }

  tabsNode.addEventListener('click', event => {
    const button = event.target.closest('[role="tab"]');
    if (button) activate(button.dataset.tab);
  });
  tabsNode.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0, config.tabs.findIndex(tab => tab.id === active));
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? config.tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + config.tabs.length) % config.tabs.length;
    activate(config.tabs[index].id, true);
  });

  Promise.all([json('config/learning.json'), json('data/learning.json')]).then(([settings, content]) => {
    config = settings;
    data = content;
    tabsNode.innerHTML = config.tabs.map(tab => `<button type="button" role="tab" aria-selected="false" tabindex="-1" data-tab="${escape(tab.id)}"><strong>${escape(tab.label)}</strong></button>`).join('');
    const requested = new URLSearchParams(location.search).get('tab');
    active = config.tabs.some(tab => tab.id === requested) ? requested : config.tabs[0].id;
    state.textContent = data.updatedAt ? `更新于 ${formatTime(data.updatedAt)}（北京时间）` : '栏目已建立，等待首批合格内容';
    render();
  }).catch(error => {
    state.textContent = '学习内容读取失败';
    panel.innerHTML = empty('无法读取每日学习', error.message);
  });
})();
