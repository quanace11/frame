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
/* ===== 📲 Cài app (Android Chrome: beforeinstallprompt) + ⛶ toàn màn hình ===== */
let installEvt = null;
function appInstalled() {
  try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; }
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  let told = false; try { told = sessionStorage.getItem('fs-install-told') === '1'; sessionStorage.setItem('fs-install-told', '1'); } catch (er) {}
  if (!told && !appInstalled()) toast('📲 Cài được Frame thành app (toàn màn hình): Menu → 📲 Cài Frame thành app', 5000);
});
window.addEventListener('appinstalled', () => { installEvt = null; toast('✅ Đã cài Frame: mở bằng biểu tượng Frame Studio trên màn hình chính'); });
async function installDialog() {
  if (appInstalled()) { toast('Bạn đang dùng Frame dạng app rồi'); return; }
  if (installEvt) {
    const ev = installEvt; installEvt = null;
    try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === 'accepted') toast('✅ Đang cài… biểu tượng Frame Studio sẽ hiện trên màn hình chính'); } catch (e) { installHelp(); }
    return;
  }
  installHelp();
}
function installHelp() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const html = ios ? `<ol>
<li>Mở trang này bằng <b>Safari</b>.</li>
<li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → <b>Thêm vào MH chính</b> → <b>Thêm</b>.</li>
<li>Mở Frame bằng biểu tượng <b>Frame Studio</b> trên màn hình chính: không còn thanh địa chỉ.</li></ol>`
    : `<ol>
<li>Trang phải mở bằng <b>chính app Chrome</b>, không phải trong app khác (Claude, Zalo, Messenger, Gmail…). Nếu ở trên cùng không thấy ô địa chỉ của Chrome, bấm <b>⋮</b> → <b>Mở trong Chrome</b>. Không dùng tab ẩn danh.</li>
<li>Trong Chrome bấm <b>⋮</b> (góc trên bên phải) → <b>Cài đặt ứng dụng</b>, hoặc <b>Thêm vào màn hình chính</b> → <b>Cài đặt</b>.</li>
<li>Mở Frame bằng biểu tượng <b>Frame Studio</b> trên màn hình chính: app chạy toàn màn hình, không có thanh Chrome. Bài đã vẽ vẫn còn (cùng bộ nhớ với Chrome).</li></ol>
<p class="lbl">Chưa thấy mục Cài đặt: đợi vài giây cho trang tải xong rồi mở lại ⋮, hoặc tải lại trang. Trong lúc đó dùng <b>⛶ Toàn màn hình</b> để ẩn thanh Chrome.</p>`;
  modal({ title: '📲 Cài Frame thành app', html, buttons: [{ label: 'Đóng', value: false }, { label: '⛶ Toàn màn hình ngay', value: true, primary: true }] }).then(v => { if (v) fullscreenToggle(); });
}
function fullscreenToggle() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!rq) { toast('Máy này không cho toàn màn hình trong trình duyệt: hãy 📲 cài app'); return; }
    const p = rq.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => toast('Không bật được toàn màn hình: hãy 📲 cài app'));
  } catch (e) { toast('Không bật được toàn màn hình: hãy 📲 cài app'); }
}
init();
