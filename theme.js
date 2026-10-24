/* Apply the local reading preference before styles paint; no network or account data. */
(function () {
  const key = "intelbrief-reading-theme";
  const choices = ["system", "light", "dark"];
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const params = new URLSearchParams(location.search);
  const preview = params.get("style") === "huizong";
  const readingPages = new Set(["/", "/index.html", "/daily", "/daily.html", "/people", "/people.html", "/tickers", "/tickers.html", "/ai", "/ai.html", "/learning", "/learning.html", "/macro", "/macro.html", "/earnings", "/earnings.html"]);
  if (preview) root.dataset.readingStyle = "huizong";
  let preference = "system";
  let control;
  try {
    const saved = localStorage.getItem(key);
    if (choices.includes(saved)) preference = saved;
  } catch (_) { /* Storage restrictions must not prevent reading. */ }
  // A review link starts in silk-white without changing the reader's saved theme.
  if (preview) preference = choices.includes(params.get("preview-theme")) ? params.get("preview-theme") : "light";

  function carryPreview(anchor) {
    if (!preview || !anchor || !anchor.hasAttribute("href") || anchor.hasAttribute("download")) return;
    if (anchor.getAttribute("href").startsWith("#")) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !readingPages.has(url.pathname)) return;
    url.searchParams.set("style", "huizong");
    url.searchParams.set("preview-theme", preference);
    anchor.href = url.href;
  }

  if (preview) {
    // Delegation includes links rendered later by the intelligence pages.
    for (const type of ["pointerdown", "focusin", "click", "auxclick"]) {
      document.addEventListener(type, event => carryPreview(event.target.closest?.("a[href]")), true);
    }
  }

  function apply() {
    root.dataset.theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    if (control) control.value = preference;
  }
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", event => {
    if (preview) return;
    if (event.key !== key && event.key !== null) return;
    preference = choices.includes(event.newValue) ? event.newValue : "system";
    apply();
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("a[href]").forEach(carryPreview);
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const row = document.createElement("div");
    row.className = "reading-preferences";
    const label = document.createElement("label");
    label.htmlFor = "reading-theme";
    label.textContent = "阅读外观";
    control = document.createElement("select");
    control.id = "reading-theme";
    for (const [value, name] of [["system", "跟随系统"], ["light", "日间"], ["dark", "夜间"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      control.append(option);
    }
    control.addEventListener("change", () => {
      preference = choices.includes(control.value) ? control.value : "system";
      apply();
      if (preview) {
        const url = new URL(location.href);
        url.searchParams.set("preview-theme", preference);
        history.replaceState(null, "", url.pathname + url.search + url.hash);
        document.querySelectorAll("a[href]").forEach(carryPreview);
      } else {
        try { localStorage.setItem(key, preference); } catch (_) { /* The current tab still works. */ }
      }
    });
    row.append(label, control);
    sidebar.append(row);
    apply();
  });
})();
