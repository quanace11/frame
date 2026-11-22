/* ========= Colour picker & brush picker (popovers) ========= */
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function hsvToHex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return rgbHex(f(5) * 255, f(3) * 255, f(1) * 255);
}
function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function normHex(t) {
  t = String(t || '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(t)) t = t.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/.test(t) ? '#' + t : null;
}
const BIG_PALETTE = (() => {
  const out = [];
  for (let i = 0; i < 12; i++) { const v = 255 * i / 11; out.push(rgbHex(v, v, v)); }
  const hues = [0, 18, 35, 52, 75, 110, 150, 180, 205, 230, 270, 320];
  for (const [s, v] of [[0.22, 1], [0.48, 1], [0.88, 1], [0.9, 0.72], [0.85, 0.42]]) for (const h of hues) out.push(hsvToHex(h, s, v));
  out.push('#fde3d0', '#f6c7a8', '#eab08a', '#d99a6c', '#c68652', '#a96b3f', '#8d5524', '#6b3e1e', '#4a2a14', '#f2d16b', '#b5651d', '#3b2a20');
  return out;
})();
function addRecentColor(c) {
  c = (c || '').toLowerCase(); if (!c) return;
  const r = S.recentColors || []; if (r[0] === c) return;
  S.recentColors = [c, ...r.filter(x => x !== c)].slice(0, 24); saveSettings(); renderRecentSw();
}
// a few recent colours that are not already in the fixed palette, next to it in the top bar
function renderRecentSw() {
  const pal = $('#palette'); if (!pal) return;
  pal.querySelectorAll('.rc,.rsep').forEach(e => e.remove());
  const fixed = new Set(PALETTE.map(c => c.toLowerCase())), list = (S.recentColors || []).filter(c => !fixed.has(c)).slice(0, 4);
  if (!list.length) return;
  const sep = document.createElement('span'); sep.className = 'rsep'; pal.append(sep);
  for (const c of list) { const s = document.createElement('button'); s.className = 'sw rc'; s.style.background = c; s.dataset.c = c; s.title = 'Màu vừa dùng ' + c; s.addEventListener('click', () => setColor(c)); pal.append(s); }
  pal.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c.toLowerCase() === S.color.toLowerCase()));
}
let popEl = null;
function closePop() { if (!popEl) return; if (popEl._onClose) popEl._onClose(); popEl.remove(); popEl = null; document.removeEventListener('pointerdown', popOutside, true); }
function popOutside(e) {
  if (!popEl || popEl.contains(e.target) || (popEl._anchor && popEl._anchor.contains(e.target))) return;
  if (e.target === view) e.stopPropagation(); // a tap on the canvas only closes the popover, it does not draw
  closePop();
}
function openPop(anchor, html, cls = '') {
  closePop();
  const d = document.createElement('div'); d.className = 'pop ' + cls; d.innerHTML = html; d._anchor = anchor;
  document.body.append(d); popEl = d;
  const r = anchor.getBoundingClientRect(), pw = d.offsetWidth, ph = d.offsetHeight;
  d.style.left = clamp(r.left, 8, Math.max(8, innerWidth - pw - 8)) + 'px';
  d.style.top = (r.bottom + 6 + ph > innerHeight - 8 ? Math.max(8, innerHeight - ph - 8) : r.bottom + 6) + 'px';
  setTimeout(() => { if (popEl === d) document.addEventListener('pointerdown', popOutside, true); });
  return d;
}
function colorPop() {
  const btn = $('#curColor');
  if (popEl && popEl._anchor === btn) { closePop(); return; }
  const old = S.color;
  const d = openPop(btn, `
    <canvas class="cp-sv"></canvas>
    <canvas class="cp-hue"></canvas>
    <div class="cp-row">
      <div class="cp-prev" title="Trái: màu cũ (chạm để quay lại) · Phải: màu mới"><span class="cp-o"></span><span class="cp-n"></span></div>
      <input class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" title="Mã màu, ví dụ #ff8800">
      <span class="spacer"></span>
      <button class="chip cp-pick" title="Chạm vào hình trên khung vẽ để lấy đúng màu đó">💧 Hút màu</button>
    </div>
    <div class="cp-lbl">Màu vừa dùng</div><div class="cp-grid cp-recent"></div>
    <div class="cp-lbl">Bảng màu</div><div class="cp-grid cp-pal"></div>`);
  const sv = d.querySelector('.cp-sv'), hue = d.querySelector('.cp-hue'), hexIn = d.querySelector('.cp-hex');
  let hsv = hexToHsv(S.color);
  const size = c => { c.width = Math.round(c.clientWidth * DPR); c.height = Math.round(c.clientHeight * DPR); };
  size(sv); size(hue);
  function draw() {
    let x = sv.getContext('2d'), w = sv.width, h = sv.height;
    x.fillStyle = hsvToHex(hsv.h, 1, 1); x.fillRect(0, 0, w, h);
    let g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const mx = hsv.s * w, my = (1 - hsv.v) * h;
    x.lineWidth = 3 * DPR; x.strokeStyle = '#000'; x.beginPath(); x.arc(mx, my, 9 * DPR, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2 * DPR; x.strokeStyle = '#fff'; x.stroke();
    x = hue.getContext('2d'); w = hue.width; h = hue.height;
    g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hsvToHex(i * 60, 1, 1));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const hx = hsv.h / 360 * w; x.lineWidth = 3 * DPR; x.strokeStyle = '#000'; x.strokeRect(hx - 5 * DPR, 1.5 * DPR, 10 * DPR, h - 3 * DPR);
    x.lineWidth = 2 * DPR; x.strokeStyle = '#fff'; x.strokeRect(hx - 5 * DPR, 1.5 * DPR, 10 * DPR, h - 3 * DPR);
  }
  function syncUI(fromHex) {
    d.querySelector('.cp-o').style.background = old; d.querySelector('.cp-n').style.background = S.color;
    if (!fromHex) hexIn.value = S.color;
    d.querySelectorAll('.cp-grid button').forEach(b => b.classList.toggle('on', b.dataset.c === S.color.toLowerCase()));
    draw();
  }
  function setFromHsv() { setColor(hsvToHex(hsv.h, hsv.s, hsv.v)); syncUI(); }
  function drag(el, fn) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} el._drag = e.pointerId; fn(e); });
    el.addEventListener('pointermove', e => { if (el._drag === e.pointerId) fn(e); });
    const up = e => { if (el._drag === e.pointerId) el._drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  drag(sv, e => { const r = sv.getBoundingClientRect(); hsv.s = clamp((e.clientX - r.left) / r.width, 0, 1); hsv.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1); setFromHsv(); });
  drag(hue, e => { const r = hue.getBoundingClientRect(); hsv.h = clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360; if (hsv.s < 0.05 && hsv.v > 0.95) { hsv.s = 1; } setFromHsv(); });
  hexIn.addEventListener('input', () => { const c = normHex(hexIn.value); if (c) { setColor(c); hsv = hexToHsv(c); syncUI(true); } });
  hexIn.addEventListener('change', () => { const c = normHex(hexIn.value); if (!c) toast('Mã màu chưa đúng, ví dụ: #ff8800'); syncUI(); });
  hexIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') hexIn.blur(); });
  d.querySelector('.cp-o').addEventListener('click', () => { setColor(old); hsv = hexToHsv(old); syncUI(); });
  const fill = (sel, list) => {
    const g = d.querySelector(sel);
    if (!list.length) { g.innerHTML = '<span class="cp-empty">Chưa có — màu bạn vẽ sẽ hiện ở đây.</span>'; return; }
    for (const c of list) { const b = document.createElement('button'); b.style.background = c; b.dataset.c = c.toLowerCase(); b.title = c;
      b.addEventListener('click', () => { setColor(c); hsv = hexToHsv(c); syncUI(); }); g.append(b); }
  };
  fill('.cp-recent', (S.recentColors || []).slice(0, 24)); fill('.cp-pal', BIG_PALETTE);
  d.querySelector('.cp-pick').addEventListener('click', () => {
    closePop(); setTool('pick'); toast('Chạm vào hình trên khung vẽ để lấy màu');
  });
  syncUI();
}
// small preview of each brush: an S curve that tapers at both ends, drawn with the real engine
function brushPreview(cv, B, erase) {
  const w = cv.width = Math.round(cv.clientWidth * DPR) || 260, h = cv.height = Math.round(cv.clientHeight * DPR) || 80;
  const off = makeCanvas(w, h), ox = off.getContext('2d');
  const eng = makeBrushEngine(ox, { brush: B, color: erase ? '#000000' : S.color, size: (B.kind === 'dab' ? 7 : 9) * DPR, pressure: true, smooth: 0, erase });
  const N = 60;
  for (let i = 0; i <= N; i++) { const t = i / N; eng.add({ x: w * (0.07 + 0.86 * t), y: h * (0.5 - 0.28 * Math.sin(t * Math.PI * 2)), p: 0.15 + 0.85 * Math.sin(t * Math.PI) }, i * 6); }
  eng.end();
  if (B.grain) applyGrain(ox, B.grain, 0, 0, w, h);
  const x = cv.getContext('2d');
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  if (erase) {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#7d6bff'); g.addColorStop(1, '#ff3b9a');
    x.fillStyle = g; x.fillRect(0, h * 0.15, w, h * 0.7); x.globalCompositeOperation = 'destination-out'; x.drawImage(off, 0, 0);
    x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
  } else { x.globalAlpha = B.alpha || 1; x.drawImage(off, 0, 0); x.globalAlpha = 1; }
}
function updBrushBtn() {
  const el = $('#brushName'); if (!el) return;
  el.textContent = S.tool === 'eraser' ? (ERASERS[S.eraserType] || ERASERS.hard).name : (BRUSHES[S.brush] || BRUSHES.pen).name;
}
function brushPop() {
  const btn = $('#brushBtn');
  if (popEl && popEl._anchor === btn) { closePop(); return; }
  const card = (k, o, kind) => `<button class="br" data-${kind}="${k}" title="${o.tip}"><canvas></canvas><span>${o.name}</span></button>`;
  const d = openPop(btn, `
    <div class="cp-lbl">Loại bút</div>
    <div class="br-grid">${Object.entries(BRUSHES).map(([k, o]) => card(k, o, 'b')).join('')}</div>
    <div class="cp-lbl">Kiểu tẩy</div>
    <div class="br-grid">${Object.entries(ERASERS).map(([k, o]) => card(k, o, 'e')).join('')}</div>
    <div class="br-tip"></div>
    <div class="set-row"><span>Cỡ nét</span><span class="stpw"><button class="stp" data-stp="size" data-d="-1" aria-label="Giảm cỡ">−</button><input type="range" class="sizeR" min="0" max="1000" step="1"><button class="stp" data-stp="size" data-d="1" aria-label="Tăng cỡ">+</button><span class="val sizeV"></span></span></div>
    <div class="set-row"><span title="Mỗi loại bút / kiểu tẩy nhớ độ đậm riêng. Với tẩy: độ đậm thấp thì xoá nhạt">Độ đậm <small class="bp-opfor"></small></span><span class="stpw"><button class="stp" data-stp="op" data-d="-1" aria-label="Giảm độ đậm">−</button><input type="range" class="opR" min="5" max="100" step="1"><button class="stp" data-stp="op" data-d="1" aria-label="Tăng độ đậm">+</button><span class="val opV"></span></span></div>
    <div class="set-row"><span title="Kéo lên cao để nét thẳng và mượt hơn khi tay run (nét đi chậm hơn bút một chút)">Chống run tay</span><input type="range" class="bp-smooth" min="0" max="90" step="1"><span class="val bp-smoothv"></span></div>
    <label class="set-row"><span title="Nét to nhỏ theo lực nhấn bút">Nét theo lực nhấn bút</span><input type="checkbox" class="bp-press"></label>
    <label class="set-row"><span title="Bật: phóng to thì nét vẽ mảnh lại, bút trông luôn to như nhau trên màn hình (để vẽ chi tiết). Tắt: cỡ tính theo hình, phóng to thì nét cũng to theo">Giữ cỡ bút khi phóng to</span><input type="checkbox" class="bp-zs"></label>`, 'wide');
  const tip = d.querySelector('.br-tip');
  function sync() {
    const isE = S.tool === 'eraser';
    d.querySelectorAll('[data-b]').forEach(b => b.classList.toggle('on', !isE && b.dataset.b === S.brush));
    d.querySelectorAll('[data-e]').forEach(b => b.classList.toggle('on', isE && b.dataset.e === S.eraserType));
    tip.textContent = isE ? (ERASERS[S.eraserType] || ERASERS.hard).tip : (BRUSHES[S.brush] || BRUSHES.pen).tip;
    d.querySelector('.bp-opfor').textContent = '(' + (isE ? (ERASERS[S.eraserType] || ERASERS.hard).name : (BRUSHES[S.brush] || BRUSHES.pen).name).toLowerCase() + ')';
    updBrushBtn(); syncSizeOp();
  }
  d.querySelectorAll('[data-b]').forEach(b => { brushPreview(b.querySelector('canvas'), BRUSHES[b.dataset.b], false);
    b.addEventListener('click', () => { S.brush = b.dataset.b; saveSettings(); if (S.tool !== 'brush') setTool('brush'); sync(); }); });
  d.querySelectorAll('[data-e]').forEach(b => { brushPreview(b.querySelector('canvas'), BRUSHES[ERASERS[b.dataset.e].base], true);
    b.addEventListener('click', () => { S.eraserType = b.dataset.e; saveSettings(); if (S.tool !== 'eraser') setTool('eraser'); sync(); }); });
  const sm = d.querySelector('.bp-smooth'); wireSizeOp(d);
  sm.value = Math.round(S.smooth * 100); d.querySelector('.bp-smoothv').textContent = sm.value + '%';
  sm.addEventListener('input', () => { S.smooth = sm.value / 100; d.querySelector('.bp-smoothv').textContent = sm.value + '%'; saveSettings(); });
  const pr = d.querySelector('.bp-press'); pr.checked = !!S.pressure;
  pr.addEventListener('change', () => { S.pressure = pr.checked; updateToggles(); saveSettings(); });
  const zs = d.querySelector('.bp-zs'); zs.checked = S.sizeScreen !== false;
  zs.addEventListener('change', () => { S.sizeScreen = zs.checked; saveSettings(); toast(zs.checked ? 'Phóng to thì nét mảnh lại để vẽ chi tiết' : 'Cỡ nét tính theo hình: phóng to thì nét cũng to'); });
  sync();
}
// background options live in a small menu so the top bar stays short; the real buttons are moved in and back out
function bgMenuPop() {
  const btn = $('#bgMenuBtn');
  if (popEl && popEl._anchor === btn) { closePop(); return; }
  const d = openPop(btn, `<div class="cp-lbl">Nền của frame này: <b class="bgm-info"></b></div>
    <div class="bgm-row" data-k="newBgBtn"><span>Cho frame này nền trống riêng, dùng khi sang cảnh mới</span></div>
    <div class="bgm-row" data-k="splitBgBtn"><span>Sửa nền ở frame này mà không đổi các frame khác</span></div>
    <div class="bgm-row" data-k="bgVidBtn"><span>Dùng một đoạn video làm nền phía sau nhân vật</span></div>
    <div class="bgm-row" data-k="vidFramesBtn"><span>Ghép theo video (cắt, nối như dựng phim, vẽ đè lên) hoặc tách thành từng frame để đồ theo</span></div>
    <div class="bgm-row"><button class="chip small on bgm-scene">🏞 Nền vẽ sẵn</button><span>Phòng, lớp học, phố, công viên, biển… chạm là có cảnh</span></div>`, 'bgm');
  const hold = $('#bgHold'), info = $('#bgInfo');
  d.querySelector('.bgm-info').textContent = info.textContent;
  d.querySelectorAll('.bgm-row[data-k]').forEach(r => r.prepend($('#' + r.dataset.k)));
  d.querySelector('.bgm-scene').addEventListener('click', () => { closePop(); sceneDialog(); });
  d._onClose = () => d.querySelectorAll('.bgm-row[data-k] > button').forEach(b => hold.insertBefore(b, info));
  d.addEventListener('click', e => { if (e.target.closest('.bgm-row > button')) setTimeout(closePop, 0); });
}
$('#bgMenuBtn').addEventListener('click', bgMenuPop);
$('#curColor').addEventListener('click', colorPop);
$('#brushBtn').addEventListener('click', brushPop);

