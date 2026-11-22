/* ========= Panel tabs ========= */
const TABS = { pp: 'pose', fx: 'text' };
function applyTabs(group) {
  const bar = document.querySelector(`[data-tabs="${group}"]`); if (!bar) return;
  const root = bar.parentElement, cur = TABS[group];
  bar.querySelectorAll('.tabb').forEach(b => b.classList.toggle('on', b.dataset.t === cur));
  root.querySelectorAll('.mrow[data-tab]').forEach(r => r.classList.toggle('tabhide', r.dataset.tab !== cur));
}
document.querySelectorAll('[data-tabs]').forEach(bar => bar.querySelectorAll('.tabb').forEach(b => b.addEventListener('click', () => { TABS[bar.dataset.tabs] = b.dataset.t; applyTabs(bar.dataset.tabs); if (bar.dataset.tabs === 'fx') { lookSync(); requestRender(); } })));
applyTabs('pp'); applyTabs('fx');
function openTab(group, t) { TABS[group] = t; applyTabs(group); }

