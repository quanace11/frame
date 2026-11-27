/* ========= Working canvases ========= */
let scv, sctx, work, wctx;
function setupWorkCanvases() {
  scv = makeCanvas(); sctx = scv.getContext('2d');
  work = makeCanvas(); wctx = work.getContext('2d');
  tintCache.clear();
}
const tintCache = new Map();
SETTINGS_KEYS.push('onionPrev', 'onionNext', 'onionTrue', 'onionCol', 'onionPal', 'onionKeys', 'onionLayer'); S.onionPrev = 1; S.onionNext = 1;
S.onionTrue = false; S.onionCol = false; S.onionPal = 0; S.onionKeys = false; S.onionLayer = false;
// 🧍 onion of one layer only (S.onionLayer, in Ghép with a layer picked): the faded frames show just that character,
// so one person can be timed in a crowd. drawPuppet skips every other layer while ppOnlyRoot is set.
var ppOnlyRoot = null;
const onionOnly = () => S.onionLayer && S.tool === 'puppet' && S.pp ? lgSelRoot() : null;
// colour pairs for onion skin: [before near, before far, after near, after far]
const ONION_PALS = [['#ff3b5c', '#ff8a3b', '#2f7bff', '#26b8c9', 'Đỏ / Xanh dương'], ['#e0409a', '#b35ce0', '#1fae4b', '#8bc34a', 'Hồng / Xanh lá'], ['#7a5a3a', '#a08060', '#3a5a7a', '#6080a0', 'Nâu / Xám xanh']];
// onion frames: [index, colour, alpha], farthest first so the nearest frame draws on top; alpha fades with distance.
// S.onionKeys: count only frames that change the drawing (skip held copies, like "onion keyframes only" in pro apps)
function onionList() {
  const L = [], P = S.onionPrev ?? 1, N = S.onionNext ?? 1, pal = ONION_PALS[S.onionPal | 0] || ONION_PALS[0];
  const fade = Math.max(P, N) > 4 ? 0.78 : 0.6;
  const pick = (dir, n) => { const out = []; let i = S.cur, last = S.frames[S.cur];
    while (out.length < n) { i += dir; if (i < 0 || i >= S.frames.length) break; const g = S.frames[i]; if (S.onionKeys && onionSame(g, last)) continue; out.push(i); last = g; }
    return out; };
  const before = pick(-1, P), after = pick(1, N);
  for (let d = Math.max(P, N); d >= 1; d--) {
    const a = S.onionAlpha * Math.pow(fade, d - 1);
    if (before[d - 1] != null) L.push([before[d - 1], d === 1 ? pal[0] : pal[1], a]);
    if (after[d - 1] != null) L.push([after[d - 1], d === 1 ? pal[2] : pal[3], a]);
  }
  return L;
}
// two frames look the same when they were copied and never changed (same lines, colour, strokes, pose)
const onionSameC = new Map();
function onionSame(a, b) {
  if (!a || !b || a === b) return a === b;
  const key = a.id + '|' + b.id, sig = a.ver + '.' + (a.colVer | 0) + ':' + b.ver + '.' + (b.colVer | 0) + ':' + JSON.stringify(a.pp || 0).length + ':' + JSON.stringify(b.pp || 0).length, c = onionSameC.get(key);
  if (c && c.sig === sig) return c.v;
  if (onionSameC.size > 400) onionSameC.clear();
  const v = onionSameRaw(a, b); onionSameC.set(key, { sig, v }); return v;
}
function onionSameRaw(a, b) {
  if (a.thumb && b.thumb && a.thumb.width === b.thumb.width) { try { const da = a.thumb.getContext('2d').getImageData(0, 0, a.thumb.width, a.thumb.height).data, db = b.thumb.getContext('2d').getImageData(0, 0, b.thumb.width, b.thumb.height).data; for (let k = 0; k < da.length; k += 8) if (Math.abs(da[k] - db[k]) > 6) return false; return true; } catch (e) {} }
  return false;
}
function onionDialog() {
  const chips = (k) => [0, 1, 2, 3, 4, 6, 8].map(n => `<button class="chip small ${(S[k] ?? 1) === n ? 'on' : ''}" data-ok="${k}" data-n="${n}">${n}</button>`).join('');
  const tg = (k, l) => `<button class="chip small ${S[k] ? 'on' : ''}" data-otg="${k}">${l}</button>`;
  modal({ title: 'Onion skin', html: `<p class="lbl">Hiện mờ các frame bên cạnh để vẽ chuyển động đều tay. Màu thứ nhất = frame trước, màu thứ hai = frame sau, càng xa càng mờ.</p>
<div class="set-row"><span>Số frame trước</span><span class="grp">${chips('onionPrev')}</span></div>
<div class="set-row"><span>Số frame sau</span><span class="grp">${chips('onionNext')}</span></div>
<div class="set-row"><span>Độ mờ</span><input type="range" id="onA" min="5" max="70" value="${Math.round(S.onionAlpha * 100)}"></div>
<div class="set-row"><span>Màu onion</span><span class="grp">${ONION_PALS.map((p, i) => `<button class="chip small ${(S.onionPal | 0) === i ? 'on' : ''}" data-opal="${i}"><b style="color:${p[0]}">●</b><b style="color:${p[2]}">●</b> ${p[4]}</button>`).join('')}</span></div>
<div class="set-row"><span>Kiểu hiện</span><span class="grp">${tg('onionTrue', '🎨 Màu thật (không nhuộm)')}${tg('onionCol', '🖌 Hiện cả lớp Màu')}${tg('onionKeys', '🔑 Bỏ qua frame giữ y hệt')}${tg('onionLayer', '🧍 Chỉ layer đang chọn (Ghép)')}</span></div>`,
    buttons: [{ label: 'Xong', value: null, primary: true }], onOpen: ov => {
      const redo = () => { tintCache.clear(); S.onion = true; updateToggles(); saveSettings(); requestRender(); };
      ov.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => { S[b.dataset.ok] = +b.dataset.n; ov.querySelectorAll(`[data-ok=${b.dataset.ok}]`).forEach(x => x.classList.toggle('on', x === b)); redo(); }));
      ov.querySelectorAll('[data-opal]').forEach(b => b.addEventListener('click', () => { S.onionPal = +b.dataset.opal; ov.querySelectorAll('[data-opal]').forEach(x => x.classList.toggle('on', x === b)); redo(); }));
      ov.querySelectorAll('[data-otg]').forEach(b => b.addEventListener('click', () => { S[b.dataset.otg] = !S[b.dataset.otg]; b.classList.toggle('on', !!S[b.dataset.otg]); redo(); }));
      ov.querySelector('#onA').addEventListener('input', e => { S.onionAlpha = e.target.value / 100; saveSettings(); requestRender(); });
    } });
}
function onionTint(f, col) {
  let e = tintCache.get(f.id);
  const only = onionOnly(), mode = (S.onionTrue ? 't' : '') + (S.onionCol ? 'c' + (f.colVer | 0) : '') + (only ? 'L' + only : '');
  if (e && e.ver === f.ver && e.col === col && e.mode === mode) return e.c;
  const c = e ? e.c : makeCanvas(Math.round(W / 2), Math.round(H / 2));
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height);
  if (only) { x.save(); x.scale(c.width / W, c.height / H); ppOnlyRoot = only; try { drawPuppet(x, f.pp, f.lip); } finally { ppOnlyRoot = null; } x.restore(); }
  else {
  if (S.onionCol && f.col) drawCol(x, f, c.width, c.height);   // by default onion shows lines only, not the colour layer
  x.drawImage(f.canvas, 0, 0, c.width, c.height);
  if (S.pp && S.showPP) { x.save(); x.scale(c.width / W, c.height / H); drawPuppet(x, f.pp, f.lip); x.restore(); }
  }
  if (!only && f.vec && f.vec.length) { x.save(); x.scale(c.width / W, c.height / H); drawVec(x, f.vec); x.restore(); }
  if (!S.onionTrue) { x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); }
  x.globalCompositeOperation = 'source-over';
  tintCache.set(f.id, { ver: f.ver, col, mode, c });
  if (tintCache.size > 2 + (S.onionPrev | 0) + (S.onionNext | 0)) {
    const keep = new Set(onionList().map(([i]) => S.frames[i]).filter(Boolean).map(f => f.id));
    for (const k of tintCache.keys()) if (!keep.has(k)) tintCache.delete(k);
  }
  return c;
}

/* ========= Render ========= */
let playing = false, playCanvas = null;
function render() {
  rq = false;
  const c = vctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#0f1013'; c.fillRect(0, 0, view.width, view.height);
  c.setTransform(...viewMat());
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 20 * DPR / vs;
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.shadowBlur = 0; c.shadowColor = 'transparent';
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  { const deg = Math.round(((vr / DEG) % 360 + 360) % 360); $('#zoomLbl').textContent = Math.round(vs / fitS * 100) + '%' + (deg ? ` · ${deg}°` : ''); }
  if (playing) {
    if (vtOn()) vtPlayTick((pNow() - playT0) / 1000, playSpeed);
    if (playCanvas) { c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip(); const now = pNow(), tf = (now - playFT0) / 1000; drawFrameFx(c, playIdx, playCanvas, (now - playT0) / 1000, tf, null, ppSmoothOn() ? ppLiveOver(playIdx, tf, S.loop) : null); c.restore(); }
    if (S.safe) drawSafeZone(c, 1 / vs * DPR);
    requestRender(); return;
  }
  const f = curFrame(); if (!f) return;
  const bg = bgOf(f);
  if (S.bgVideo && bgVid.ready && S.showBg) drawVideoCover(c, bgVid.el);
  if (stroke) buildWork();
  if (floating && floatPlace() === 'bottom') { if (floating.bc) drawFloating(c, floating.bc); if (floating.cc) drawFloating(c, floating.cc); drawFloating(c); }
  else if (S.showBg && bg && bg.canvas) { if (floating || (S.layer === 'bg' && S.tool !== 'fx')) c.drawImage(stroke && stroke.t.type === 'bg' ? work : bg.canvas, 0, 0); else drawBgImg(c, S.cur, bg.canvas); }
  drawSpeedLines(c, f, S.cur);
  if (floating && floating.bc && floatPlace() !== 'bottom') drawFloating(c, floating.bc);
  if (floating && floatPlace() === 'bg') { if (floating.cc) drawFloating(c, floating.cc); drawFloating(c); }
  if (floating && floatPlace() === 'bottom' && S.showBg && bg && bg.canvas) c.drawImage(stroke && stroke.t.type === 'bg' ? work : bg.canvas, 0, 0); // bottom: picture was drawn first (below), background drawing goes over it
  if (REF.c && (REF.show || refEdit)) {
    c.save(); c.globalAlpha = REF.opacity; c.translate(REF.cx, REF.cy); c.rotate(REF.rot); c.scale(REF.scale, REF.scale);
    c.drawImage(REF.c, -REF.c.width / 2, -REF.c.height / 2); c.restore();
    if (refEdit) {
      const px0 = 1 / vs * DPR; c.save(); c.translate(REF.cx, REF.cy); c.rotate(REF.rot); c.scale(REF.scale, REF.scale);
      const k = 1 / REF.scale; c.lineWidth = 2 * px0 * k; c.setLineDash([8 * px0 * k, 6 * px0 * k]); c.strokeStyle = '#7d6bff';
      c.strokeRect(-REF.c.width / 2, -REF.c.height / 2, REF.c.width, REF.c.height); c.restore();
    }
  }
  if (S.onion) {
    for (const [i, col, a] of onionList()) {
      const of = S.frames[i];
      if (of && of.canvas) { c.globalAlpha = a; c.drawImage(onionTint(of, col), 0, 0, W, H); c.globalAlpha = 1; }
      else if (of && !of.canvas) ensureLoaded(of).then(requestRender);
    }
  }
  if (floating && floatPlace() === 'under') { if (floating.cc) drawFloating(c, floating.cc); drawFloating(c); }
  const trace = ppTracing(); if (trace) ppDrawTrace(c, f); hcTraceChip(trace);
  if (S.showCol && f.col) c.drawImage(stroke && stroke.cv === f.col ? work : f.col, 0, 0);
  if (floating && floating.cc && S.showCol && floatPlace() === 'top') drawFloating(c, floating.cc);
  drawGhosts(c, f);
  if (S.showChar && f.canvas) {
    let img = stroke && stroke.cv === f.canvas ? work : f.canvas;
    if (floating && floating.cc && floating.only !== 'col' && floatPlace() === 'top') { img = floatKnock(img); }
    c.drawImage(img, 0, 0);
  }
  if (floating && floatPlace() === 'top') drawFloating(c);
  if (stroke) drawStrokePred(c);
  if (S.sym && (S.tool === 'brush' || S.tool === 'eraser')) { const q = 1 / vs * DPR; c.save(); c.setLineDash([10 * q, 8 * q]); c.lineWidth = 1.5 * q; c.strokeStyle = 'rgba(125,107,255,.85)'; c.beginPath(); if (S.sym !== 2) { c.moveTo(W / 2, 0); c.lineTo(W / 2, H); } if (S.sym !== 1) { c.moveTo(0, H / 2); c.lineTo(W, H / 2); } c.stroke(); c.restore(); }
  const px = 1 / vs * DPR;
  if (S.pp && S.showPP && !ppSetup && !trace) { ppPaintFocus = ppPaintFocusId(); const jp = (ppJEOn() || ppPrevOn()) && ppPoseFor(f); try { drawPuppet(c, jp || f.pp, jp ? { ...(f.lip || {}), mv: null, off: null } : f.lip); } finally { ppPaintFocus = null; } }
  if (S.showVec) renderVec(c, rig && rig.pv ? { vec: rig.pv } : rig ? { vec: f.vec } : motion && motion.pv ? { vec: motion.pv } : f, px);
  if (rig) renderRig(c, px);
  if (HC) hcDraw(c, px); else renderPP(c, f, px);
  bwDrawPins(c, f, px);
  if (S.tool === 'fx' && TABS.fx === 'look') { c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip(); drawFocusLines(c, f, S.cur, 0); drawFilter(c, f); c.restore(); }
  if (f.texts && f.texts.length) drawTexts(c, f, S.tool === 'fx' ? fxSel : null);
  if (S.safe) drawSafeZone(c, px);
  if (S.tool === 'fx') {
    const { cx, cy, hw, hh, z } = camBox(camEditBox(S.cur));
    if (camCanStart(f)) {   // a move: the other box (thin) with an arrow from the start shot to the end shot
      const st = camSide === 'start', bA = camBox(camAt(S.cur, 0)), bB = camBox(camEdit(S.cur)), o = st ? bB : bA;
      c.save(); c.setLineDash([4 * px, 8 * px]); c.lineWidth = 2 * px; c.strokeStyle = st ? '#ffb21e' : '#9ad'; c.strokeRect(o.cx - o.hw, o.cy - o.hh, o.hw * 2, o.hh * 2);
      c.setLineDash([]); c.strokeStyle = '#fff'; c.lineWidth = 3 * px; c.beginPath(); c.moveTo(bA.cx, bA.cy); c.lineTo(bB.cx, bB.cy); c.stroke();
      const an = Math.atan2(bB.cy - bA.cy, bB.cx - bA.cx), L = 22 * px; if (Math.hypot(bB.cx - bA.cx, bB.cy - bA.cy) > L) { c.beginPath(); c.moveTo(bB.cx, bB.cy); c.lineTo(bB.cx - L * Math.cos(an - 0.45), bB.cy - L * Math.sin(an - 0.45)); c.moveTo(bB.cx, bB.cy); c.lineTo(bB.cx - L * Math.cos(an + 0.45), bB.cy - L * Math.sin(an + 0.45)); c.stroke(); }
      c.font = `bold ${22 * px}px system-ui`; c.textBaseline = 'top'; c.lineWidth = 5 * px; c.strokeStyle = '#000';
      for (const [b, t, col, e] of [[bA, '▶ Đầu', '#9ad', 0], [bB, '⏹ Cuối', '#ffb21e', 1]]) {   // start label top-left, end label bottom-right
        c.textAlign = e ? 'right' : 'left'; c.textBaseline = e ? 'bottom' : 'top';
        const tx = e ? b.cx + b.hw - 8 * px : b.cx - b.hw + 8 * px, ty = e ? b.cy + b.hh - 8 * px : b.cy - b.hh + 8 * px; c.strokeText(t, tx, ty); c.fillStyle = col; c.fillText(t, tx, ty);
      }
      c.restore();
    }
    if (z > 1.001) { c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.rect(0, 0, W, H); c.rect(cx - hw, cy - hh, hw * 2, hh * 2); c.fill('evenodd'); c.restore(); }
    c.save(); c.setLineDash([14 * px, 10 * px]); c.lineWidth = 3 * px; c.strokeStyle = camSide === 'start' && camCanStart(f) ? '#4fc3ff' : f.cam ? '#ffb21e' : '#9ad'; c.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2); c.restore();
    if (TABS.fx === 'cam') {   // corner handles: drag to zoom in/out
      c.save(); c.fillStyle = '#ffb21e'; c.strokeStyle = '#111'; c.lineWidth = 2 * px; const r = 11 * px;
      for (const [qx, qy] of [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh]]) { c.beginPath(); c.arc(qx, qy, r, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
      if (action && action.kind === 'camdraw' && action.r) { const [x0, y0, x1, y1] = action.r; c.save(); c.setLineDash([10 * px, 6 * px]); c.lineWidth = 2.5 * px; c.strokeStyle = '#ff3b9a'; c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.restore(); }
    }
  }
  if (motion && motion.type === 'swing' && motion.pivot) {
    const q = motion.pivot; c.save(); c.lineWidth = 2 * px; c.strokeStyle = '#fff'; c.fillStyle = '#ff3b9a';
    c.beginPath(); c.arc(q.x, q.y, 9 * px, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(q.x - 16 * px, q.y); c.lineTo(q.x + 16 * px, q.y); c.moveTo(q.x, q.y - 16 * px); c.lineTo(q.x, q.y + 16 * px); c.stroke(); c.restore();
  }
  if (ballMode) renderBallPath(c, px);
  renderWarpSel(c, px);
  if (lasso && lasso.length > 1) {
    c.lineWidth = 2 * px; c.setLineDash([8 * px, 6 * px]);
    c.beginPath(); c.moveTo(lasso[0].x, lasso[0].y); for (const p of lasso) c.lineTo(p.x, p.y); if (!lassoOpen) c.closePath();
    c.strokeStyle = '#000'; c.stroke(); c.lineDashOffset = 7 * px; c.strokeStyle = '#fff'; c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
  }
  if (floating && floating.c && floating.tw) renderTween(c, px);
  if (floating && floating.c) xbDraw(c, floatXbox(), px, '#ffb21e');
}

/* ========= Shorts safe zone (only on screen, never exported) ========= */
// Where YouTube Shorts / TikTok cover the video with their own UI. Fractions of the frame for 9:16.
SETTINGS_KEYS.push('safe'); S.safe = 0;
/* tracing paper: while drawing with Bút / Tẩy / Đổ màu on the drawing layers, cut-out characters are drawn faded and UNDER
   the lines + colour (like onion paper), so you can trace over a character and fill colour there. Play / export unchanged. */
SETTINGS_KEYS.push('ppTrace'); S.ppTrace = true;
function ppTracing() { return !!(S.pp && S.pp.parts.length && S.showPP && !ppSetup && !playing && (HC || (S.ppTrace && (S.tool === 'brush' || S.tool === 'eraser' || S.tool === 'fill') && S.layer !== 'bg'))); }
let ppTraceCv = null;
function ppDrawTrace(c, f) {
  if (!ppTraceCv || ppTraceCv.width !== W || ppTraceCv.height !== H) ppTraceCv = makeCanvas();
  const x = ppTraceCv.getContext('2d'); x.clearRect(0, 0, W, H); drawPuppet(x, f.pp, f.lip);
  c.save(); c.globalAlpha = 0.4; c.drawImage(ppTraceCv, 0, 0); c.restore();
}
const SAFE_916 = { l: 0.055, r: 0.15, t: 0.08, b: 0.22 };
function safeRect() {
  if (H > W * 1.4) { const z = SAFE_916; return { x: W * z.l, y: H * z.t, w: W * (1 - z.l - z.r), h: H * (1 - z.t - z.b), tall: true }; }
  return { x: W * 0.05, y: H * 0.05, w: W * 0.9, h: H * 0.9, tall: false };
}
function drawSafeZone(c, px) {
  const r = safeRect();
  c.save();
  c.fillStyle = 'rgba(255,40,90,.13)'; c.beginPath(); c.rect(0, 0, W, H); c.rect(r.x, r.y, r.w, r.h); c.fill('evenodd');
  c.setLineDash([12 * px, 8 * px]); c.lineWidth = 2.5 * px; c.strokeStyle = 'rgba(255,40,90,.9)'; c.strokeRect(r.x, r.y, r.w, r.h); c.setLineDash([]);
  if (r.tall) {
    const fs = Math.max(13 * px, W * 0.022); c.font = `600 ${fs}px system-ui,sans-serif`; c.fillStyle = 'rgba(200,20,70,.85)'; c.textBaseline = 'middle';
    c.textAlign = 'center'; c.fillText('Thanh tìm kiếm / tiêu đề', W / 2, r.y / 2);
    c.fillText('Tên kênh · mô tả · nhạc', (r.x + r.x + r.w) / 2, r.y + r.h + (H - r.y - r.h) * 0.45);
    c.save(); c.translate(r.x + r.w + (W - r.x - r.w) / 2, H * 0.62); c.rotate(-Math.PI / 2); c.fillText('Nút thích · bình luận · chia sẻ', 0, 0); c.restore();
    // like/comment/share buttons hint
    c.fillStyle = 'rgba(255,40,90,.25)'; const bx = r.x + r.w + (W - r.x - r.w) / 2, br = Math.min((W - r.x - r.w) * 0.32, W * 0.04);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(bx, H * 0.48 + i * br * 3.2, br, 0, Math.PI * 2); c.fill(); }
  }
  if (S.safe === 2) {
    c.strokeStyle = 'rgba(40,140,255,.7)'; c.lineWidth = 1.5 * px; c.beginPath();
    for (let i = 1; i < 3; i++) { c.moveTo(W * i / 3, 0); c.lineTo(W * i / 3, H); c.moveTo(0, H * i / 3); c.lineTo(W, H * i / 3); }
    c.stroke();
    c.strokeStyle = 'rgba(40,140,255,.9)'; c.beginPath(); c.moveTo(W / 2 - 18 * px, H / 2); c.lineTo(W / 2 + 18 * px, H / 2); c.moveTo(W / 2, H / 2 - 18 * px); c.lineTo(W / 2, H / 2 + 18 * px); c.stroke();
  }
  c.restore();
}
$('#safeBtn').addEventListener('click', () => cycleSafe());
function cycleSafe() {
  S.safe = ((S.safe || 0) + 1) % 3; updateToggles(); saveSettings(); requestRender();
  toast(['Đã tắt vùng an toàn', 'Vùng hồng sẽ bị chữ và nút của Shorts/TikTok che: đặt mặt nhân vật và chữ quan trọng trong khung', 'Thêm lưới 1/3 + tâm khung để bố cục'][S.safe], 3000);
}

