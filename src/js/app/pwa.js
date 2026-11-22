/* ========= Installed app (PWA): offline + updates ========= */
const APP_VERSION = '__APP_VERSION__';
let swReg = null, swUpdating = false;
(function setupPWA() {
  let top = false; try { top = window.top === window; } catch (e) {}
  if (!top || !('serviceWorker' in navigator) || location.protocol === 'file:' || APP_VERSION.startsWith('__')) return;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  navigator.serviceWorker.register('./sw.js').then(reg => {
    swReg = reg;
    const ask = w => { if (!w) return; modal({ title: '✨ Có bản cập nhật mới', html: '<p>Tải lại để dùng bản mới? Bài của bạn đã được tự lưu.</p>', buttons: [{ label: 'Để sau', value: false }, { label: 'Tải lại ngay', value: true, primary: true }] }).then(ok => { if (ok) { if (saveT) { clearTimeout(saveT); saveProject(); } swUpdating = true; w.postMessage('skipWaiting'); setTimeout(() => location.reload(), 2500); } }); };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(e => console.warn('SW', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swUpdating && !reloading) { reloading = true; location.reload(); } });
})();
async function checkUpdate() {
  if (!swReg) { toast('Bản trong claude.ai luôn là bản mới nhất'); return; }
  toast('Đang kiểm tra cập nhật…'); try { await swReg.update(); if (!swReg.waiting && !swReg.installing) toast(`Bạn đang dùng bản mới nhất (${APP_VERSION})`); } catch (e) { toast('Không kiểm tra được (đang offline?)'); }
}
window.addEventListener('pagehide', () => { if (saveT) { clearTimeout(saveT); saveProject(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveT) { clearTimeout(saveT); saveProject(); } });
// switching devices: send the work when this app goes to the background, fetch the other device's work when it comes back
document.addEventListener('visibilitychange', () => { if (!syncCfg() || !syncAuto()) return; if (document.hidden) syncNow({ quiet: true }); else if (Date.now() - syncLast > 15000) syncNow({ quiet: true }); });
init();
