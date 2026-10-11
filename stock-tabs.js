/* Accessible in-page views. The hash is only navigation state, never data input. */
(function () {
  const tabs = Array.from(document.querySelectorAll('[data-stock-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-stock-panel]'));
  if (!tabs.length || tabs.length !== panels.length) return;
  const valid = new Set(tabs.map(tab => tab.dataset.stockTab));
  function activate(name, focus) {
    if (!valid.has(name)) name = 'news';
    for (const tab of tabs) {
      const active = tab.dataset.stockTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const panel of panels) panel.hidden = panel.dataset.stockPanel !== name;
    const hash = name === 'news' ? '' : '#people';
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => activate(tab.dataset.stockTab, false));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[next].dataset.stockTab, true);
    });
  }
  addEventListener('hashchange', () => activate(location.hash === '#people' ? 'people' : 'news', false));
  activate(location.hash === '#people' ? 'people' : 'news', false);
})();
