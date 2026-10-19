/* Apply the local reading preference before styles paint; no network or account data. */
(function () {
  const key = "intelbrief-reading-theme";
  const choices = ["system", "light", "dark"];
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";
  let control;
  try {
    const saved = localStorage.getItem(key);
    if (choices.includes(saved)) preference = saved;
  } catch (_) { /* Storage restrictions must not prevent reading. */ }

  function apply() {
    root.dataset.theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    if (control) control.value = preference;
  }
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    preference = choices.includes(event.newValue) ? event.newValue : "system";
    apply();
  });

  document.addEventListener("DOMContentLoaded", () => {
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
      try { localStorage.setItem(key, preference); } catch (_) { /* The current tab still works. */ }
    });
    row.append(label, control);
    sidebar.append(row);
    apply();
  });
})();
