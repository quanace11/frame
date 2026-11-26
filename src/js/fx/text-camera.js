/* ========= Text, camera & effects ========= */
let fxSel = null, fxCamPick = false;
const fxState = f => JSON.parse(JSON.stringify({ texts: f.texts || [], cam: f.cam || null, shake: f.shake || 0, flash: !!f.flash }));
function fxSetState(f, st) { f.texts = JSON.parse(JSON.stringify(st.texts)); f.cam = st.cam ? { ...st.cam } : null; f.shake = st.shake; f.flash = st.flash; }
function fxEdit(fn) { const f = curFrame(), before = fxState(f); fn(f); pushEntry({ t: targetOf(f), fxe: true, before, after: fxState(f), bytes: 400 }); f.ver++; queueThumbFor(f); scheduleSave(); fxSyncBar(); requestRender(); }
const fxFont = st => st === 'caption' ? '800 {s}px system-ui,-apple-system,sans-serif' : "{s}px Bangers, 'Impact', 'Arial Black', sans-serif";
function fxLines(t) { return String(t.str || '').split('\n'); }
const fxBoxes = new Map();
/* --- ✨ animated text (like CapCut / 万彩 text animations): t.an = how it comes in, t.lp = a loop while it stays, t.ao = how it leaves.
   Time-based over the run of neighbouring frames that hold the same text id (made by "Giữ cho"), so it works with holds and copies.
   Only moves when the film plays / exports (drawFrameFx passes the frame index); editing and still pictures show it at rest. --- */
const TX_IN = { '': 'Không', pop: '💥 Bật ra', type: '⌨ Gõ từng chữ', up: '⬆ Bay lên', drop: '⬇ Rơi nảy', zoom: '🔍 Thu từ to', spin: '🌀 Xoay vào', fade: '🌫 Hiện dần' };
const TX_LP = { '': 'Không', shake: '〰 Rung', pulse: '💓 Đập nhịp', float: '☁ Bồng bềnh', wiggle: '↔ Lắc lư' };
const TX_OUT = { '': 'Không', fade: '🌫 Mờ đi', shrink: '🔻 Thu nhỏ', up: '⬆ Bay đi' };
function txRun(i, id) {
  const n = S.frames.length, has = k => (S.frames[k].texts || []).some(x => x.id === id);
  let a = i, b = i; while (a > 0 && has(a - 1)) a--; while (b < n - 1 && has(b + 1)) b++; return [a, b];
}
const txChars = t => fxLines(t).reduce((m, l) => m + l.length, 0);
const txInDur = t => t.an === 'type' ? clamp(txChars(t) * 0.06, 0.3, 2.5) : ({ pop: 0.35, up: 0.4, drop: 0.6, zoom: 0.35, spin: 0.45, fade: 0.5 }[t.an] || 0);
const backOut = u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
// how text t looks at time tIn into frame i: {k scale, a alpha, dx, dy, r degrees, ch = visible characters or -1}
function txAnim(t, i, tIn) {
  const o = { k: 1, a: 1, dx: 0, dy: 0, r: 0, ch: -1 }; if (!t.an && !t.lp && !t.ao) return o;
  const T = frameStartTimes(), [a, b] = txRun(i, t.id), tau = T[i] + tIn, u0 = tau - T[a], left = T[b + 1] - tau, s = t.size || 90;
  if (t.an) {
    const d = txInDur(t), u = clamp(u0 / d, 0, 1), e = EASE.out(u);
    if (t.an === 'pop') { o.k = Math.max(0, backOut(u)); o.a = Math.min(1, u * 3); }
    else if (t.an === 'type') o.ch = Math.floor(u * txChars(t) + 1e-6);
    else if (t.an === 'up') { o.dy = (1 - e) * s * 2.5; o.a = u; }
    else if (t.an === 'drop') { o.dy = -(1 - EASE.bounce(u)) * H * 0.3; o.a = Math.min(1, u * 4); }
    else if (t.an === 'zoom') { o.k = lerp(3, 1, e); o.a = u; }
    else if (t.an === 'spin') { o.r = -(1 - e) * 200; o.k = e; }
    else if (t.an === 'fade') o.a = u;
  }
  if (t.lp) {
    if (t.lp === 'shake') { o.dx += s * 0.05 * Math.sin(u0 * 61) * Math.cos(u0 * 23); o.dy += s * 0.05 * Math.cos(u0 * 53) * Math.sin(u0 * 31); }
    else if (t.lp === 'pulse') o.k *= 1 + 0.09 * Math.max(0, Math.sin(u0 * Math.PI * 4));
    else if (t.lp === 'float') o.dy += s * 0.12 * Math.sin(u0 * Math.PI * 1.6);
    else if (t.lp === 'wiggle') o.r += 7 * Math.sin(u0 * Math.PI * 3);
  }
  if (t.ao) {
    const d = t.ao === 'up' ? 0.4 : 0.35, u = clamp(1 - left / d, 0, 1);
    if (t.ao === 'fade') o.a *= 1 - u;
    else if (t.ao === 'shrink') o.k *= Math.max(0, 1 - u * u);
    else if (t.ao === 'up') { o.dy -= EASE.in(u) * s * 3; o.a *= 1 - u; }
  }
  return o;
}
// the moments a GIF must split a frame into small steps for the text to move
function txWins(T) {
  const out = [], seen = new Set();
  S.frames.forEach((f, i) => (f.texts || []).forEach(t => {
    if ((!t.an && !t.lp && !t.ao) || seen.has(t.id + ':' + i)) return;
    const [a, b] = txRun(i, t.id); for (let k = a; k <= b; k++) seen.add(t.id + ':' + k);
    if (t.lp) { out.push({ t0: T[a], t1: T[b + 1] }); return; }
    if (t.an) out.push({ t0: T[a], t1: T[a] + txInDur(t) + 0.05 });
    if (t.ao) out.push({ t0: T[b + 1] - 0.45, t1: T[b + 1] });
  }));
  return out;
}
function drawTexts(ctx, f, selId, fi, tIn) {
  for (const t of (f.texts || [])) {
    const A = fi != null && !trSkip ? txAnim(t, fi, tIn || 0) : null;
    if (A && (A.a <= 0.003 || A.k <= 0.003 || A.ch === 0)) continue;
    const lines = fxLines(t), s = t.size || 90, lh = s * 1.05;
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate((t.rot || 0) * DEG);
    if (A) { ctx.translate(A.dx, A.dy); if (A.r) ctx.rotate(A.r * DEG); if (A.k !== 1) ctx.scale(A.k, A.k); if (A.a < 1) ctx.globalAlpha *= A.a; }
    ctx.font = fxFont(t.style).replace('{s}', s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let txt = t.style === 'caption' ? lines : lines.map(l => l.toUpperCase());
    const w = Math.max(...txt.map(l => ctx.measureText(l).width), 10), h = lh * txt.length;
    if (A && A.ch >= 0) {   // typing: the box keeps its full size, letters appear one by one (left-aligned so they don't jump)
      let left = A.ch; const full = txt; txt = full.map(l => { const p = l.slice(0, Math.max(0, left)); left -= l.length; return p; });
      ctx.textAlign = 'left'; const ws = full.map(l => ctx.measureText(l).width);
      txt = txt.map((l, k) => ({ l, x: -ws[k] / 2 }));
    }
    if (t.style === 'bubble') {
      const rx = w / 2 + s * 0.6, ry = h / 2 + s * 0.45;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.moveTo(-rx * 0.35, ry * 0.8); ctx.lineTo(-rx * 0.65 + (t.tx || 0), ry * 1.55 + (t.ty || 0)); ctx.lineTo(-rx * 0.05, ry * 0.95);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = s * 0.08; ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, rx - s * 0.04, ry - s * 0.04, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    } else if (t.style === 'shout') {
      const R = Math.max(w, h) / 2 + s * 0.7, n = 14; ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? R * 0.72 : R; ctx.lineTo(Math.cos(a) * rr * (w / Math.max(w, h) * 0.5 + 0.6), Math.sin(a) * rr * (h / Math.max(w, h) * 0.5 + 0.55)); }
      ctx.closePath(); ctx.fillStyle = '#ffd400'; ctx.fill(); ctx.lineWidth = s * 0.07; ctx.strokeStyle = '#111'; ctx.stroke();
    }
    txt.forEach((l0, i) => {
      const y = (i - (txt.length - 1) / 2) * lh, l = typeof l0 === 'string' ? l0 : l0.l, x0 = typeof l0 === 'string' ? 0 : l0.x;
      if (!l) return;
      if (t.style === 'bubble') { ctx.fillStyle = t.color && t.color !== '#ffe14d' ? t.color : '#111'; ctx.fillText(l, x0, y); }
      else { ctx.lineWidth = s * (t.style === 'caption' ? 0.16 : 0.2); ctx.strokeStyle = t.style === 'shout' ? '#fff' : '#111'; ctx.strokeText(l, x0, y); ctx.fillStyle = t.style === 'shout' ? (t.color === '#ffe14d' ? '#e0141e' : t.color) : (t.color || '#ffe14d'); ctx.fillText(l, x0, y); }
    });
    fxBoxes.set(t.id, { x: t.x, y: t.y, w: w + s, h: h + s * 0.6, rot: t.rot || 0 });
    if (selId === t.id) { ctx.setLineDash([12, 8]); ctx.lineWidth = 4; ctx.strokeStyle = '#ff3b9a'; ctx.strokeRect(-w / 2 - s * 0.5, -h / 2 - s * 0.3, w + s, h + s * 0.6); }
    ctx.restore();
  }
}
function fxHit(f, p) {
  for (const t of [...(f.texts || [])].reverse()) { const b = fxBoxes.get(t.id); if (!b) continue; const a = -b.rot * DEG, dx = p.x - b.x, dy = p.y - b.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return t; }
  return null;
}
// Camera keys live on frames (f.cam = {z, x, y, tr?, d?}). Old keys (no `tr`) glide to the NEXT key and arrive on it
// (keys on neighbouring frames switch exactly at the frame — the one-tap combos rely on that). New keys say how the shot
// begins ON this frame: tr 'cut' = jump straight to it, tr 'smooth' = start moving here and arrive after d seconds.
// Time-based, so a single long still frame can still push in slowly. tIn = seconds into frame i.
const camPlain = c => ({ z: c.z || 1, x: c.x, y: c.y });
// how a smooth key moves (c.e); c.s = the shot it starts from (else wherever the camera was), so a move can live on one frame
const CAM_EASE = {
  inout: EASE.inout, linear: EASE.linear, in: EASE.in, out: EASE.out,
  crash: t => { const u = clamp(t, 0, 1), c1 = 2.2, v = u - 1; return 1 + (c1 + 1) * v * v * v + c1 * v * v; },   // fast, overshoots a bit, settles
  steps: t => t <= 0 ? 0 : Math.min(1, Math.ceil(t * 3 - 1e-9) / 3)   // 3 hard jumps closer (dramatic "dun dun DUN")
};
const CAM_EASE_LABEL = { inout: 'Mượt (chậm–nhanh–chậm)', linear: 'Đều (Ken Burns)', out: 'Nhanh rồi chậm dần', in: 'Chậm rồi nhanh dần', crash: 'Giật nhanh (crash zoom)', steps: '3 nhịp giật' };
// extra camera life that is not a framing: impact shake when a move arrives (c.hit px) and a handheld sway (c.hh) that
// lasts until the next key. Only drawn in the final picture (playback / video / GIF), never in the edit box.
function camFx(i, tIn = 0) {
  const n = S.frames.length, out = { sh: 0, ox: 0, oy: 0 }; if (!n) return out;
  i = clamp(i, 0, n - 1); const T = frameStartTimes(), tau = T[i] + Math.max(0, tIn);
  let hh = null;
  S.frames.forEach((f, k) => {
    const c = f.cam; if (!c || T[k] > tau) return;
    hh = c.hh ? { c, t0: T[k] } : null;
    if (c.hit) { const ta = T[k] + (c.tr === 'smooth' ? Math.max(0.05, c.d || 1) * (c.e === 'crash' ? 0.55 : 1) : 0), q = (tau - ta) / 0.45; if (q >= 0 && q < 1) out.sh += c.hit * (1 - q) * (1 - q); }
  });
  if (hh) { const t = tau, a = W * 0.006 * hh.c.hh / Math.max(1, hh.c.z || 1); out.ox = a * (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 3.1 + 1.3)); out.oy = a * (Math.cos(t * 1.3 + 0.4) + 0.5 * Math.sin(t * 2.6 + 2.1)); }
  return out;
}
// the moments a GIF must split a frame into small steps so camera moves show (pushes, crash zooms, shakes, handheld)
function camWins(T) {
  const out = [], n = S.frames.length;
  S.frames.forEach((f, k) => {
    const c = f.cam; if (!c) return;
    let e = k + 1; while (e < n && !S.frames[e].cam) e++;
    const d = c.tr === 'smooth' ? Math.max(0.05, c.d || 1) : 0;
    if (d) out.push({ t0: T[k], t1: Math.min(T[e], T[k] + d) });
    if (c.hit) out.push({ t0: T[k] + d * (c.e === 'crash' ? 0.55 : 1), t1: Math.min(T[e], T[k] + d + 0.45) });
    if (c.hh) out.push({ t0: T[k], t1: T[e], step: 0.1 });
  });
  return out;
}
// camera move from view A to view C (u = 0…1) as ONE straight zoom: the zoom grows evenly (log scale) round the point
// that sits at the same place on screen in both views, so the target (a face) comes straight in. Lerping the centre and
// the zoom apart made the target drift out and swing back ("lượn"). Same zoom (a pan) = plain slide.
function camMix(A, C, u) {
  if (Math.abs(C.z - A.z) < 0.02 * Math.max(A.z, C.z)) return { z: lerp(A.z, C.z, u), x: lerp(A.x, C.x, u), y: lerp(A.y, C.y, u) };
  const z = A.z * Math.pow(C.z / A.z, u), fx = (C.x * C.z - A.x * A.z) / (C.z - A.z), fy = (C.y * C.z - A.y * A.z) / (C.z - A.z), k = A.z / z;
  return { z, x: fx - (fx - A.x) * k, y: fy - (fy - A.y) * k };
}
function camAt(i, tIn = 0) {
  const def = { z: 1, x: W / 2, y: H / 2 }, n = S.frames.length; if (!n) return def;
  i = clamp(i, 0, n - 1);
  const T = frameStartTimes(), tau = T[i] + Math.max(0, tIn), keys = [];
  S.frames.forEach((f, k) => { if (f.cam) keys.push(k); });
  let start = def, v = def;
  for (let j = 0; j < keys.length; j++) {
    const k = keys[j], C = camPlain(S.frames[k].cam); if (T[k] > tau) break;
    const nk = keys[j + 1], next = nk != null ? S.frames[nk].cam : null;
    // value of this key's segment at time t (t ≥ T[k], before the next key)
    const at = t => {
      const c = S.frames[k].cam; let a = C;
      if (c.tr === 'smooth') { const d = Math.max(0.05, c.d || 1), u = (CAM_EASE[c.e] || EASE.inout)(clamp((t - T[k]) / d, 0, 1)), A = c.s ? camPlain(c.s) : start; a = camMix(A, C, u); }
      if (next && !next.tr && nk > k + 1) { const u = EASE.inout(clamp((t - T[k]) / Math.max(1e-6, T[nk] - T[k]), 0, 1)), B = camPlain(next); a = camMix(a, B, u); }
      return a;
    };
    if (nk == null || T[nk] > tau) { v = at(tau); break; }
    start = at(T[nk]); v = start;
  }
  return { z: v.z, x: v.x, y: v.y };
}
// what the camera box shows while editing frame i: its own key (the shot it moves to), else the camera at the frame start
const camEdit = i => S.frames[i] && S.frames[i].cam ? camPlain(S.frames[i].cam) : camAt(i);
const camBox = cam => { const z = Math.max(1, cam.z || 1), hw = W / (2 * z), hh = H / (2 * z); return { z, hw, hh, cx: clamp(cam.x, hw, W - hw), cy: clamp(cam.y, hh, H - hh) }; };
const CAM_ZMAX = 8;
SETTINGS_KEYS.push('camTr', 'camD');
S.camTr = 'cut'; S.camD = 1;
// set frame f's camera key; a new key takes the chosen transition (✂ cut / 〰 smooth), an existing one keeps its own
const camClamp = c => { const z = clamp(c.z || 1, 1, CAM_ZMAX), hw = W / (2 * z), hh = H / (2 * z); return { z, x: clamp(c.x, hw, W - hw), y: clamp(c.y, hh, H - hh) }; };
function camKeySet(f, c, tr) {
  const o = f.cam || {};
  f.cam = { ...camClamp(c), tr: tr || o.tr || S.camTr };
  if (f.cam.tr === 'smooth') { f.cam.d = o.d || S.camD; if (o.s) f.cam.s = o.s; if (o.e) f.cam.e = o.e; }   // re-framing keeps how the move runs
  if (o.hit) f.cam.hit = o.hit; if (o.hh) f.cam.hh = o.hh; if (o.k && (f.cam.tr === 'smooth') === (o.tr === 'smooth')) f.cam.k = o.k;
}
// which box the Camera tab edits: the shot the key moves TO (end), or — for a smooth move — the shot it starts FROM
let camSide = 'end';
const camCanStart = f => !!(f && f.cam && f.cam.tr === 'smooth');
const camEditBox = i => camSide === 'start' && camCanStart(S.frames[i]) ? camAt(i, 0) : camEdit(i);
function camSetBox(f, c) {
  if (camSide === 'start' && camCanStart(f)) f.cam = { ...f.cam, s: camClamp(c) };
  else camKeySet(f, c);
}
// the box's corner opposite to the dragged one stays put; the new 9:16 box reaches the finger
function camCornerBox(b, corner, p) {
  const ax = b.cx - corner[0] * b.hw, ay = b.cy - corner[1] * b.hh;
  const w = Math.max(W / CAM_ZMAX, Math.abs(p.x - ax), Math.abs(p.y - ay) * W / H), hgt = w * H / W, z = clamp(W / w, 1, CAM_ZMAX);
  return { z, x: ax + corner[0] * w / 2, y: ay + corner[1] * hgt / 2 };
}
// a dragged rectangle → the smallest 9:16 shot that shows all of it
function camFromRect(x0, y0, x1, y1) { const w = Math.max(8, Math.abs(x1 - x0)), h = Math.max(8, Math.abs(y1 - y0)); return { z: clamp(Math.min(W / w, H / h), 1, CAM_ZMAX), x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; }
function camApply(ctx, cam, shakePx, tsec, seed) {
  const z = Math.max(1, cam.z || 1), hw = W / (2 * z), hh = H / (2 * z);
  const cx = clamp(cam.x, hw, W - hw), cy = clamp(cam.y, hh, H - hh);
  let sx = 0, sy = 0; if (shakePx) { sx = shakePx * Math.sin(tsec * 71 + seed * 13.1) * Math.cos(tsec * 37); sy = shakePx * Math.cos(tsec * 59 + seed * 7.7) * Math.sin(tsec * 43); }
  ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(z, z); ctx.translate(-cx, -cy);
}
// one line in the Camera tab: what the camera does on frame i and how long that lasts
function camStatus(i) {
  const n = S.frames.length, f = S.frames[i], z = camEdit(i).z, pct = Math.round(z * 100) + '%';
  let k = i; while (k >= 0 && !S.frames[k].cam) k--;
  let e = i + 1; while (e < n && !S.frames[e].cam) e++;
  const until = e < n ? `tới hết frame ${e}, frame ${e + 1} có key khác` : 'tới hết phim';
  if (k < 0) return `Frame ${i + 1}: toàn cảnh (chưa có camera key nào trước đó).`;
  if (z <= 1.01 && !(f.cam && f.cam.tr === 'smooth')) return `Frame ${i + 1}: toàn cảnh${f.cam ? ' (key ↩ ở frame này)' : ''}, giữ ${until}.`;
  if (f.cam && f.cam.k && CAM_FX[f.cam.k]) return `Frame ${i + 1}: ${CAM_FX[f.cam.k].label} trong ${(f.cam.d || 0).toFixed(1)} giây, tới zoom ${pct}, giữ ${until}. Bấm ▶ Khung đầu / ⏹ Khung cuối để chỉnh từng khung.`;
  return f.cam ? `Frame ${i + 1}: key zoom ${pct}. Zoom này giữ ${until}. Muốn hết zoom: sang frame cần dừng rồi bấm ↩ Bỏ zoom từ đây.`
    : `Frame ${i + 1}: vẫn zoom (giữ từ key ở frame ${k + 1}), kéo ${until}. Bấm ↩ Bỏ zoom từ đây để về toàn cảnh từ frame này.`;
}
// 🎥 badge on frames that have a camera key (✂ = cut, 〰 = smooth push)
function camBadges() {
  const any = S.frames.some(g => g.cam);
  S.frames.forEach((g, i) => {
    if (!g.el) return; let ck = g.el.querySelector('.camk');
    const zoomed = !g.cam && any && camAt(i).z > 1.01;   // no key here, but still zoomed from an earlier key
    if (!g.cam && !zoomed) { if (ck) ck.remove(); return; }
    if (!ck) { ck = document.createElement('span'); g.el.append(ck); }
    ck.className = 'camk' + (g.cam ? '' : ' held');
    ck.textContent = g.cam ? (g.cam.tr === 'smooth' && (g.cam.s || g.cam.z > 1.01) ? '🎥〰' : g.cam.z <= 1.01 ? '🎥↩' : g.cam.tr === 'cut' ? '🎥✂' : '🎥') : '🔍';
    ck.title = g.cam ? 'Camera key ở frame này' : 'Vẫn đang zoom (giữ từ camera key trước)';
  });
}
function fxSyncBar() { updateWaves(); lgSync(); camBadges(); trBadges(); trSyncBar(); ghostSync(); lookSync();
  const bar = $('#fxbar'), show = S.tool === 'fx' && !panelHidden.fx; bar.hidden = !show; updPanelPill(); if (!show) return;
  const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel);
  ['#fxEditTxt', '#fxSize', '#fxRot', '#fxDelTxt', '#fxKeep', '#fxColorTxt', '#txIn', '#txLp', '#txOut', '#txPrev'].forEach(id => $(id).disabled = !t);
  txSyncBar(t);
  document.querySelectorAll('[data-fxs]').forEach(b => b.classList.toggle('on', t ? t.style === b.dataset.fxs : fxNewStyle === b.dataset.fxs));
  if (t) { $('#fxSize').value = t.size || 90; $('#fxRot').value = t.rot || 0; }
  const cam = camEditBox(S.cur); $('#fxZoom').value = Math.round(cam.z * 100); $('#fxZoomVal').textContent = Math.round(cam.z * 100) + '%';
  $('#fxCamKey').classList.toggle('on', !!f.cam); $('#fxCamKey').textContent = f.cam ? '🗑 Xoá key ở frame này' : '＋ Đặt key ở frame này';
  $('#camWide').disabled = !f.cam && camAt(S.cur).z <= 1.01; $('#camStat').textContent = camStatus(S.cur);
  $('#fxPick').classList.toggle('on', fxCamPick); $('#camPushIn').classList.toggle('on', camPresetMode === 'push'); $('#camCutIn').classList.toggle('on', camPresetMode === 'cut');
  document.querySelectorAll('[data-camfx]').forEach(b => b.classList.toggle('on', camPresetMode === b.dataset.camfx));
  { const mv = camCanStart(f), side = mv ? camSide : 'end';
    document.querySelectorAll('[data-camside]').forEach(b => { b.classList.toggle('on', b.dataset.camside === side); b.disabled = !mv; });
    $('#camSwap').disabled = $('#camEase').disabled = !mv; $('#camEase').value = mv ? f.cam.e || 'inout' : 'inout';
    $('#camHit').classList.toggle('on', !!(f.cam && f.cam.hit)); $('#camHand').classList.toggle('on', !!(f.cam && f.cam.hh)); }
  { const tr = f.cam ? (f.cam.tr || 'old') : S.camTr; document.querySelectorAll('[data-camtr]').forEach(b => b.classList.toggle('on', b.dataset.camtr === tr)); const d = f.cam && f.cam.tr === 'smooth' ? f.cam.d || 1 : S.camD; $('#camD').value = d; $('#camDVal').textContent = d.toFixed(1) + 's'; $('#camD').disabled = tr !== 'smooth'; } $('#fxShake').value = f.shake || 0; $('#fxFlash').classList.toggle('on', !!f.flash);
  const sf = (S.audio && S.audio.sfx || []).filter(x => x.frameId === f.id);
  $('#fxSfxList').innerHTML = sf.map(x => `<button class="chip small" data-sfxdel="${x.id}" title="Bỏ âm thanh này">${(SFX[x.kind] || {}).label || x.kind} ✕</button>`).join('');
  $('#fxSfxList').querySelectorAll('[data-sfxdel]').forEach(b => b.addEventListener('click', () => { S.audio.sfx = S.audio.sfx.filter(x => x.id !== b.dataset.sfxdel); fxSyncBar(); scheduleSave(); }));
  const A = S.audio || {};
  $('#fxMusicName').textContent = A.music ? '🎵 ' + A.music.name : 'chưa có'; voiceRows(); beatSync();
  $('#fxMusicDel').disabled = !A.music; $('#fxLip').disabled = !voiceClips().length;
  $('#fxMusicVol').value = Math.round(((A.music && A.music.vol) ?? 0.6) * 100);
}
function txSyncBar(t) {
  const fill = (id, L) => { const el = $(id); if (!el.options.length) el.innerHTML = Object.entries(L).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); };
  fill('#txIn', TX_IN); fill('#txLp', TX_LP); fill('#txOut', TX_OUT);
  $('#txIn').value = t ? t.an || '' : ''; $('#txLp').value = t ? t.lp || '' : ''; $('#txOut').value = t ? t.ao || '' : '';
  if (!t) { $('#txInfo').textContent = 'Chạm 1 chữ trên khung để chọn'; return; }
  const [a, b] = txRun(S.cur, t.id); $('#txInfo').textContent = a === b ? 'chữ này chỉ ở 1 frame (dùng Giữ cho, hoặc 🗂 Dòng layer: kéo đầu thanh vàng 🔤 để kéo dài)' : `chữ ở frame ${a + 1}–${b + 1}`;
}
// set the animation of the selected text on every neighbouring frame that holds it (undo: automatic snapshot)
function txSetAnim(key, val) {
  const t = (curFrame().texts || []).find(x => x.id === fxSel); if (!t) return;
  const [a, b] = txRun(S.cur, t.id);
  for (let k = a; k <= b; k++) { const g = S.frames[k], x = (g.texts || []).find(y => y.id === t.id); if (!x) continue; if (val) x[key] = val; else delete x[key]; g.ver++; }
  scheduleSave(); fxSyncBar(); requestRender();
  if (val) toast('Bấm ▶ Xem thử (hoặc Phát) để thấy chữ chuyển động', 2000);
}
let playRangeOnce = null;   // a play range for one preview (▶ Xem thử), else the multi-selection
function txPreview() {
  const t = (curFrame().texts || []).find(x => x.id === fxSel); if (!t) return;
  if (playing) stopPlay(); const [a, b] = txRun(S.cur, t.id);
  playRangeOnce = [a, Math.min(S.frames.length - 1, b + 1)]; startPlay();
}
let fxNewStyle = 'comic';
async function fxAskText(init) {
  let v = null;
  await modal({ title: init ? 'Sửa chữ' : 'Thêm chữ', html: `<textarea id="fxTxtIn" rows="3" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:18px" placeholder="vd. COME BACK!">${(init || '').replace(/</g, '&lt;')}</textarea><p class="lbl" style="font-size:12px">Xuống dòng để chia nhiều dòng.</p>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Xong', primary: true, action: () => { v = document.getElementById('fxTxtIn').value; } }], onOpen: ov => setTimeout(() => ov.querySelector('#fxTxtIn').focus(), 50) });
  return v && v.trim() ? v.trim().slice(0, 200) : null;
}
async function fxAddText() {
  const str = await fxAskText(''); if (!str) return;
  const cam = camEdit(S.cur), t = { id: newId(), str, x: cam.x, y: cam.y - H / (cam.z * 5), size: fxNewStyle === 'caption' ? 64 : 110, color: '#ffe14d', style: fxNewStyle, rot: fxNewStyle === 'comic' ? -6 : 0 };
  fxEdit(f => { f.texts = f.texts || []; f.texts.push(t); }); fxSel = t.id; fxSyncBar();
}
/* --- quick subtitles: paste the script, lines are timed to the voice track (or spread evenly) --- */
// speech segments [start, end] in seconds from the voice's RMS envelope (gaps < 0.25 s merged)
async function voiceSegments(ab) {
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100), b = await ac.decodeAudioData(ab.slice(0));
  const d = b.getChannelData(0), hop = Math.round(b.sampleRate / 100), n = Math.floor(d.length / hop), env = new Float32Array(n);
  let mx = 1e-6; for (let i = 0; i < n; i++) { let e = 0; for (let j = i * hop; j < (i + 1) * hop; j += 2) e += d[j] * d[j]; env[i] = Math.sqrt(e / (hop / 2)); if (env[i] > mx) mx = env[i]; }
  const th = mx * 0.12, seg = []; let st = -1;
  for (let i = 0; i <= n; i++) { const on = i < n && env[i] > th; if (on && st < 0) st = i; if (!on && st >= 0) { seg.push([st / 100, i / 100]); st = -1; } }
  const out = []; for (const g of seg) { const L = out[out.length - 1]; if (L && g[0] - L[1] < 0.25) L[1] = g[1]; else out.push([...g]); }
  return { segs: out.filter(g => g[1] - g[0] > 0.06), dur: b.duration };
}
// share the speech time between the lines by length; move each cut into the nearest pause when one is close
function timeLines(lines, segs) {
  const tot = segs.reduce((a, g) => a + g[1] - g[0], 0), w = lines.map(l => Math.max(3, l.replace(/\s+/g, '').length)), W0 = w.reduce((a, b) => a + b, 0);
  const at = sp => { for (const g of segs) { const L = g[1] - g[0]; if (sp <= L) return g[0] + sp; sp -= L; } return segs[segs.length - 1][1]; };
  const cuts = [segs[0][0]]; let acc = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    acc += w[i] / W0 * tot; let t = at(acc);
    let best = null; for (let k = 0; k < segs.length - 1; k++) { const gm = (segs[k][1] + segs[k + 1][0]) / 2; if (Math.abs(gm - t) < 0.6 && (!best || Math.abs(gm - t) < Math.abs(best - t))) best = gm; }
    if (best != null && best > cuts[cuts.length - 1] + 0.2) t = best; cuts.push(Math.max(t, cuts[cuts.length - 1] + 0.2));
  }
  cuts.push(segs[segs.length - 1][1] + 0.3);
  return lines.map((l, i) => [cuts[i], cuts[i + 1]]);
}
function wrapSub(str, size) {
  const c = makeCanvas(8, 8).getContext('2d'); c.font = fxFont('caption').replace('{s}', size);
  const maxW = W * 0.78, out = []; let cur = '';
  for (const word of str.split(/\s+/)) { const t = cur ? cur + ' ' + word : word; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
  if (cur) out.push(cur); return out.join('\n');
}
async function quickSubtitles() {
  const A = S.audio || {}, hasV = !!A.voice; let txt = null, mode = null;
  const v = await modal({ title: '📝 Phụ đề nhanh', html: `<p class="lbl">Dán lời thoại, <b>mỗi dòng là một câu phụ đề</b>. ${hasV ? 'App nghe giọng đã thêm để đặt từng câu đúng lúc nói.' : 'Chưa có giọng lồng tiếng: phụ đề được chia đều từ frame đang xem tới cuối.'} Chạy lại sẽ thay bộ phụ đề cũ.</p>
<textarea id="qsIn" rows="7" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:17px" placeholder="Xin chào mọi người!&#10;Hôm nay mình kể chuyện này…"></textarea>`,
    buttons: [{ label: 'Huỷ', value: null }, ...(hasV ? [{ label: 'Chia đều', value: 'even', action: () => { txt = document.getElementById('qsIn').value; } }] : []), { label: hasV ? '🗣 Theo giọng' : 'Tạo phụ đề', value: hasV ? 'voice' : 'even', primary: true, action: () => { txt = document.getElementById('qsIn').value; } }],
    onOpen: ov => { const ta = ov.querySelector('#qsIn'); ta.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => ta.focus(), 50); } });
  mode = v; if (!mode || !txt) return;
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 300); if (!lines.length) return;
  const T = frameStartTimes(), n = S.frames.length; let spans, t0;
  if (mode === 'voice') {
    const pm = progress('Đang nghe giọng…');
    try {
      const vi = Math.max(0, S.frames.findIndex(f => f.id === A.voice.frameId)); t0 = T[vi];
      const { segs } = await voiceSegments(A.voice.buf);
      if (!segs.length) { pm.close(); toast('Không nghe thấy tiếng nói trong file giọng'); return; }
      spans = timeLines(lines, segs);
    } finally { pm.close(); }
  } else { t0 = T[S.cur]; const L = T[n] - t0, wts = lines.map(l => Math.max(3, l.length)), tw = wts.reduce((a, b) => a + b, 0); let a = 0; spans = lines.map((l, i) => { const s0 = a; a += wts[i] / tw * L; return [s0, a]; }); }
  const size = 62, ids = lines.map(() => newId()), entries = [];
  for (let i = 0; i < n; i++) {
    const f = S.frames[i], mid = (T[i] + T[i + 1]) / 2 - t0, k = spans.findIndex(sp => mid >= sp[0] && mid < sp[1]);
    const had = (f.texts || []).some(t => t.sub); if (k < 0 && !had) continue;
    const before = fxState(f); f.texts = (f.texts || []).filter(t => !t.sub);
    if (k >= 0) { f.texts.push({ id: ids[k], str: wrapSub(lines[k], size), x: W / 2, y: H * 0.7, size, color: '#ffffff', style: 'caption', rot: 0, sub: true }); }
    entries.push({ t: targetOf(f), fxe: true, before, after: fxState(f), bytes: 400 }); f.ver++; queueThumbFor(f);
  }
  if (entries.length) pushEntry({ multi: entries });
  const end = t0 + spans[spans.length - 1][1];
  scheduleSave(); fxSyncBar(); requestRender(); updUndoBtns();
  toast(end > T[n] + 0.3 ? `Đã đặt ${lines.length} câu — phim ngắn hơn lời thoại ${(end - T[n]).toFixed(1)}s, thêm frame để hiện hết` : `Đã đặt ${lines.length} câu phụ đề — hoàn tác 1 lần để bỏ`, 3500);
}
/* --- sound effects (synthesised, no copyright) --- */
const SFX = {
  pop: { label: 'Bụp', dur: 0.25 }, whoosh: { label: 'Vút', dur: 0.6 }, punch: { label: 'Đấm', dur: 0.35 }, boing: { label: 'Boing', dur: 0.7 },
  ting: { label: 'Ting', dur: 1.3 }, whistle: { label: 'Còi trọng tài', dur: 1.3 }, drum: { label: 'Trống', dur: 0.5 }, crowd: { label: 'Khán giả ồ', dur: 2.2 },
  bonk: { label: 'Cốp', dur: 0.3 }, slap: { label: 'Bốp', dur: 0.25 }, bang: { label: 'Bùm', dur: 0.6 }, boom: { label: 'Nổ', dur: 1.2 }, crash: { label: 'Loảng xoảng', dur: 1.3 }, zap: { label: 'Điện giật', dur: 0.45 },
  splat: { label: 'Bẹp', dur: 0.35 }, poof: { label: 'Phụt khói', dur: 0.5 }, slide: { label: 'Huýt trượt', dur: 0.8 }, swirl: { label: 'Choáng vòng vòng', dur: 1.2 }, tweet: { label: 'Chim kêu', dur: 1.2 }, scuffle: { label: 'Đánh túi bụi', dur: 1.6 }, kick: { label: 'Sút bóng', dur: 0.3 },
  tvoff: { label: 'Tắt TV', dur: 0.9 }, tvon: { label: 'Bật TV', dur: 0.9 }, glitch: { label: 'Nhiễu rè', dur: 0.6 }, roar: { label: 'Hét giận', dur: 1.5 }, shutter: { label: 'Máy ảnh tách', dur: 0.18 }
};
const sfxCache = {};
async function sfxBuffer(kind) {
  if (sfxCache[kind]) return sfxCache[kind];
  const sr = 44100, d = SFX[kind].dur, oc = new OfflineAudioContext(1, Math.ceil(sr * d), sr), t0 = 0;
  const noise = (len) => { const b = oc.createBuffer(1, Math.ceil(sr * len), sr), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; const s = oc.createBufferSource(); s.buffer = b; return s; };
  const env = (g, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); };
  const osc = (type, f0, f1, dur) => { const o = oc.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); return o; };
  const out = oc.destination;
  if (kind === 'pop') { const o = osc('sine', 700, 110, 0.15), g = oc.createGain(); env(g, 0.005, 0.9, 0.2); o.connect(g).connect(out); o.start(); }
  if (kind === 'whoosh') { const n = noise(d), bp = oc.createBiquadFilter(), g = oc.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(300, 0); bp.frequency.exponentialRampToValueAtTime(3500, d * 0.6); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.8, d * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, d); n.connect(bp).connect(g).connect(out); n.start(); }
  if (kind === 'punch') { const o = osc('sine', 150, 40, 0.25), g = oc.createGain(); env(g, 0.003, 1, 0.3); o.connect(g).connect(out); o.start(); const n = noise(0.1), lp = oc.createBiquadFilter(), g2 = oc.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1800; env(g2, 0.002, 0.7, 0.08); n.connect(lp).connect(g2).connect(out); n.start(); }
  if (kind === 'boing') { const o = osc('sine', 160, 440, 0.6), lfo = oc.createOscillator(), lg = oc.createGain(), g = oc.createGain(); lfo.frequency.value = 14; lg.gain.value = 40; lfo.connect(lg).connect(o.frequency); env(g, 0.01, 0.7, 0.65); o.connect(g).connect(out); o.start(); lfo.start(); }
  if (kind === 'ting') { [1760, 2637, 3520].forEach((fq, i) => { const o = osc('sine', fq), g = oc.createGain(); env(g, 0.003, [0.5, 0.25, 0.12][i], 1.2); o.connect(g).connect(out); o.start(); }); }
  if (kind === 'whistle') { [[0, 0.32], [0.45, 0.8]].forEach(([s0, len]) => { const o = oc.createOscillator(), tr = oc.createOscillator(), tg = oc.createGain(), g = oc.createGain(); o.frequency.value = 2900; tr.frequency.value = 32; tg.gain.value = 140; tr.connect(tg).connect(o.frequency); g.gain.setValueAtTime(0.0001, s0); g.gain.exponentialRampToValueAtTime(0.35, s0 + 0.02); g.gain.setValueAtTime(0.35, s0 + len - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, s0 + len); o.connect(g).connect(out); o.start(s0); tr.start(s0); o.stop(s0 + len); tr.stop(s0 + len); }); }
  if (kind === 'drum') { const o = osc('sine', 110, 45, 0.35), g = oc.createGain(); env(g, 0.002, 1, 0.45); o.connect(g).connect(out); o.start(); const n = noise(0.15), hp = oc.createBiquadFilter(), g2 = oc.createGain(); hp.type = 'highpass'; hp.frequency.value = 2000; env(g2, 0.001, 0.4, 0.12); n.connect(hp).connect(g2).connect(out); n.start(); }
  if (kind === 'crowd') { const n = noise(d), bp = oc.createBiquadFilter(), g = oc.createGain(), lfo = oc.createOscillator(), lg = oc.createGain(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6; lfo.frequency.value = 3; lg.gain.value = 0.15; g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.6, 0.5); g.gain.linearRampToValueAtTime(0.4, 1.6); g.gain.exponentialRampToValueAtTime(0.0001, d); lfo.connect(lg).connect(g.gain); n.connect(bp).connect(g).connect(out); n.start(); lfo.start(); }
  const envAt = (g, s, a, peak, dec) => { g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + a); g.gain.exponentialRampToValueAtTime(0.0001, s + a + dec); };
  const thump = (s, f0, f1, peak, dec) => { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + dec); envAt(g, s, 0.003, peak, dec); o.connect(g).connect(out); o.start(s); o.stop(s + dec + 0.05); };
  const hiss = (s, len, type, fq, peak, a = 0.002) => { const n = noise(len), f = oc.createBiquadFilter(), g = oc.createGain(); f.type = type; f.frequency.value = fq; envAt(g, s, a, peak, len); n.connect(f).connect(g).connect(out); n.start(s); };
  if (kind === 'bonk') { [[880, 520, 0.45], [440, 300, 0.35]].forEach(([a, b, p]) => { const o = osc('triangle', a, b, 0.12), g = oc.createGain(); env(g, 0.002, p, 0.18); o.connect(g).connect(out); o.start(); }); hiss(0, 0.04, 'highpass', 3000, 0.3); }
  if (kind === 'slap') { hiss(0, 0.12, 'highpass', 1200, 0.65, 0.001); thump(0, 220, 90, 0.4, 0.1); }
  if (kind === 'crash') { hiss(0, 1.1, 'bandpass', 2500, 0.55); thump(0, 120, 40, 0.6, 0.3); for (let i = 0; i < 9; i++) { const s = 0.05 + Math.random() * 0.8, o = oc.createOscillator(), g = oc.createGain(); o.frequency.value = 2500 + Math.random() * 3500; envAt(g, s, 0.001, 0.12, 0.12); o.connect(g).connect(out); o.start(s); o.stop(s + 0.2); } }
  if (kind === 'zap') { const o = osc('sawtooth', 1800, 120, 0.38), lfo = oc.createOscillator(), lg = oc.createGain(), g = oc.createGain(), lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000; lfo.frequency.value = 45; lg.gain.value = 0.25; lfo.connect(lg).connect(g.gain); env(g, 0.005, 0.35, 0.4); o.connect(lp).connect(g).connect(out); o.start(); lfo.start(); }
  if (kind === 'boom') { thump(0, 90, 28, 1, 0.9); hiss(0, 1.0, 'lowpass', 500, 0.8, 0.01); }
  if (kind === 'bang') { thump(0, 160, 50, 0.7, 0.4); hiss(0, 0.45, 'lowpass', 3000, 0.6, 0.001); }
  if (kind === 'kick') { thump(0, 230, 60, 1, 0.16); hiss(0, 0.06, 'highpass', 2200, 0.55, 0.001); }
  if (kind === 'slide') { const o = oc.createOscillator(), v = oc.createOscillator(), vg = oc.createGain(), g = oc.createGain(); o.frequency.setValueAtTime(500, 0); o.frequency.exponentialRampToValueAtTime(1700, 0.35); o.frequency.exponentialRampToValueAtTime(420, 0.75); v.frequency.value = 7; vg.gain.value = 25; v.connect(vg).connect(o.frequency); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.35, 0.03); g.gain.setValueAtTime(0.35, 0.68); g.gain.exponentialRampToValueAtTime(0.0001, 0.78); o.connect(g).connect(out); o.start(); v.start(); }
  if (kind === 'tweet') { for (let i = 0; i < 7; i++) { const s = i * 0.16 + (i % 2) * 0.04, o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(2600, s); o.frequency.exponentialRampToValueAtTime(3900, s + 0.05); o.frequency.exponentialRampToValueAtTime(2900, s + 0.08); envAt(g, s, 0.005, 0.45, 0.08); o.connect(g).connect(out); o.start(s); o.stop(s + 0.12); } }
  if (kind === 'swirl') { const o = oc.createOscillator(), v = oc.createOscillator(), vg = oc.createGain(), g = oc.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(900, 0); o.frequency.exponentialRampToValueAtTime(380, d); v.frequency.value = 9; vg.gain.value = 180; v.connect(vg).connect(o.frequency); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.4, 0.05); g.gain.exponentialRampToValueAtTime(0.0001, d); o.connect(g).connect(out); o.start(); v.start(); }
  if (kind === 'splat') { hiss(0, 0.3, 'lowpass', 900, 0.9, 0.001); thump(0, 200, 60, 0.6, 0.2); }
  if (kind === 'poof') { const n = noise(d), f = oc.createBiquadFilter(), g = oc.createGain(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7; g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(1, 0.06); g.gain.exponentialRampToValueAtTime(0.0001, d); n.connect(f).connect(g).connect(out); n.start(); }
  if (kind === 'scuffle') { for (let i = 0; i < 11; i++) { const s = i * 0.14 + Math.random() * 0.05; thump(s, 140 + Math.random() * 80, 45, 0.45 + Math.random() * 0.2, 0.16); hiss(s, 0.06, 'lowpass', 1500 + Math.random() * 1500, 0.4); } hiss(0, d, 'bandpass', 500, 0.25, 0.1); }
  // old TV: relay click, the picture's whine sliding down, a little static crackle (tvon: the reverse, rising hum + static)
  if (kind === 'tvoff') { hiss(0, 0.035, 'highpass', 2500, 0.9, 0.001); thump(0, 180, 70, 0.5, 0.08); const o = osc('sine', 1500, 55, 0.5), lp = oc.createBiquadFilter(), g = oc.createGain(); lp.type = 'lowpass'; lp.frequency.value = 2500; envAt(g, 0.01, 0.01, 0.3, 0.55); o.connect(lp).connect(g).connect(out); o.start(0.01); o.stop(0.7); hiss(0.02, 0.5, 'bandpass', 4200, 0.12, 0.01); for (let i = 0; i < 6; i++) hiss(0.05 + Math.random() * 0.45, 0.012, 'highpass', 3000, 0.35, 0.001); }
  if (kind === 'tvon') { hiss(0, 0.03, 'highpass', 2500, 0.8, 0.001); const o = osc('sine', 60, 900, 0.35), g = oc.createGain(); g.gain.setValueAtTime(0.0001, 0.02); g.gain.exponentialRampToValueAtTime(0.28, 0.25); g.gain.exponentialRampToValueAtTime(0.0001, 0.75); o.connect(g).connect(out); o.start(0.02); o.stop(0.8); const n = noise(0.8), bp = oc.createBiquadFilter(), g2 = oc.createGain(); bp.type = 'bandpass'; bp.frequency.value = 3800; g2.gain.setValueAtTime(0.0001, 0.05); g2.gain.exponentialRampToValueAtTime(0.25, 0.3); g2.gain.exponentialRampToValueAtTime(0.0001, 0.85); n.connect(bp).connect(g2).connect(out); n.start(0.05); }
  if (kind === 'glitch') { for (let i = 0; i < 9; i++) { const s0 = i * 0.06 + Math.random() * 0.02, o = oc.createOscillator(), g = oc.createGain(); o.type = 'square'; o.frequency.setValueAtTime(200 + Math.random() * 1800, s0); envAt(g, s0, 0.002, 0.18, 0.04); o.connect(g).connect(out); o.start(s0); o.stop(s0 + 0.06); hiss(s0, 0.04, 'highpass', 1500 + Math.random() * 4000, 0.3); } }
  // 📸 camera shutter: a sharp click (curtain opens), a short metal ring, a softer second click (curtain closes)
  if (kind === 'shutter') { hiss(0, 0.012, 'highpass', 3500, 0.9, 0.0005); thump(0, 900, 300, 0.25, 0.02); const o = osc('square', 3100), bp = oc.createBiquadFilter(), g = oc.createGain(); bp.type = 'bandpass'; bp.frequency.value = 3100; bp.Q.value = 6; envAt(g, 0.002, 0.001, 0.08, 0.03); o.connect(bp).connect(g).connect(out); o.start(0); o.stop(0.05); hiss(0.055, 0.016, 'highpass', 2500, 0.55, 0.0005); thump(0.055, 600, 200, 0.18, 0.025); }
  // an angry "AAARGH!": buzzy voice-like tone (sawtooth + vibrato) through two vowel formants, rough breath noise, pitch up then sagging
  if (kind === 'roar') {
    const o = oc.createOscillator(), v = oc.createOscillator(), vg = oc.createGain(), mix = oc.createGain(), g = oc.createGain(), ws = oc.createWaveShaper();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(150, 0); o.frequency.exponentialRampToValueAtTime(260, 0.18); o.frequency.setValueAtTime(260, 0.9); o.frequency.exponentialRampToValueAtTime(170, d);
    v.frequency.value = 6.5; vg.gain.value = 9; v.connect(vg).connect(o.frequency);
    const cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(3 * x); } ws.curve = cv;
    o.connect(ws);
    for (const [fq, q, gn] of [[750, 6, 1], [1200, 7, 0.6], [2600, 8, 0.25]]) { const bp = oc.createBiquadFilter(), bg = oc.createGain(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; bg.gain.value = gn; ws.connect(bp).connect(bg).connect(mix); }
    const n = noise(d), nb = oc.createBiquadFilter(), ng = oc.createGain(); nb.type = 'bandpass'; nb.frequency.value = 1400; nb.Q.value = 0.8; ng.gain.value = 0.35; n.connect(nb).connect(ng).connect(mix); n.start();
    g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.08); g.gain.setValueAtTime(0.9, 0.95); g.gain.exponentialRampToValueAtTime(0.0001, d);
    mix.connect(g).connect(out); o.start(); v.start();
  }
  const buf = await oc.startRendering(); sfxCache[kind] = buf; return buf;
}
async function sfxPreview(kind) { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const b = await sfxBuffer(kind); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); setTimeout(() => ac.close(), (SFX[kind].dur + 0.3) * 1000); } catch (e) {} }
/* --- audio playback / mixing --- */
const decCache = new WeakMap();
const vtNoSound = new WeakSet();
async function decodeAB(ac, ab) { if (decCache.has(ab)) return decCache.get(ab); const b = await ac.decodeAudioData(ab.slice(0)); decCache.set(ab, b); return b; }
function frameStartTimes() { const t = [0]; S.frames.forEach((f, i) => t.push(t[i] + f.dur / 1000)); return t; }
async function scheduleAudio(ac, dest, offsetSec, totalSec, lead = 0.05) {
  // Decode every sound FIRST, then schedule them all against one clock. Before, the start time was read before decoding and each
  // clip was scheduled right after its own decode, so a clip decoded later started late (or in the past = right away from the
  // wrong spot) and overlapping sounds no longer played together in preview / real-time export.
  const A = S.audio || {}, srcs = [], jobs = [], T = frameStartTimes();
  // one clip: starts at st on the timeline, plays the file from off for len seconds (🎚 audio timeline trims / splits)
  const clip = (b, c, kind, vol) => {
    const st = clipStart(c, kind, T); if (st == null) return; const off = Math.min(clipOff(c), b.duration), len = clipLen(c, kind, b.duration);
    if (len <= 0.005 || st + len <= offsetSec + 0.005 || st > totalSec) return;
    const skip = Math.max(0, offsetSec - st); jobs.push([b, Math.max(0, st - offsetSec), off + skip, vol, len - skip]);
  };
  // one bad file only drops itself, never the sounds after it
  const each = async (list, fn) => { for (const x of list) { try { await fn(x); } catch (e) { console.error(e); } } };
  await each(musicClips(), async c => clip(await decodeAB(ac, c.buf), c, 'music', c.vol ?? 0.6));
  await each(voiceClips(), async c => clip(await decodeAB(ac, c.buf), c, 'voice', c.vol ?? 1));
  await each(A.sfx || [], async x => { if (!SFX[x.kind] || clipStart(x, 'sfx', T) == null) return; clip(await sfxBuffer(x.kind), x, 'sfx', x.vol ?? 0.9); });
  // 🎞 the sound of each piece on the video row (a file without sound is skipped)
  await each(vtList(), async o => {
    const vol = o.c.vol ?? 1, src = vtSrc(o.c.s); if (vol <= 0.001 || !src || !src.buf || vtNoSound.has(src.buf)) return;
    if (o.st + o.len <= offsetSec + 0.005 || o.st > totalSec) return;
    let b; try { b = await decodeAB(ac, src.buf); } catch (e) { vtNoSound.add(src.buf); return; }
    const off = Math.min(o.c.off || 0, b.duration), skip = Math.max(0, offsetSec - o.st), len = Math.min(o.len, b.duration - off) - skip;
    if (len > 0.005) jobs.push([b, Math.max(0, o.st - offsetSec), off + skip, vol, len]);
  });
  // transition sounds (📺 click, whoosh…) start with the transition itself, which can begin inside an earlier frame
  await each(trList(T), async x => { const kk = TR_KINDS[x.k].sfx; if (!x.snd || !kk || !SFX[kk]) return; const st = Math.max(0, x.k === 'tvoff' ? x.t0 + x.d * 0.05 : x.t0); if (st < offsetSec - 0.01 || st > totalSec) return; jobs.push([await sfxBuffer(kk), st - offsetSec, 0, 0.8, null]); });
  // 📸 paparazzi: one shutter click per flash (louder for near cameras)
  if (S.frames.some(f => f.pz && f.pz.snd)) await each([0], async () => {
    const b = await sfxBuffer('shutter');
    S.frames.forEach((f, i) => { if (!f.pz || !f.pz.snd) return; for (const e of pzEvents(i)) { const st = T[i] + e.t; if (st < offsetSec - 0.01 || st > totalSec) continue; jobs.push([b, st - offsetSec, 0, 0.25 + 0.35 * Math.min(1, e.s), null]); } });
  });
  const now = ac.currentTime + lead;
  for (const [buf, at, off, vol, dur] of jobs) {
    try { const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g).connect(dest); if (dur != null) s.start(now + at, off, dur); else s.start(now + at, off); srcs.push(s); } catch (e) { console.error(e); }
  }
  return () => srcs.forEach(s => { try { s.stop(); } catch (e) {} });
}
/* --- lip sync from a voice track --- */
// each voice clip moves the mouth of its own character (clip.mouth); a clip without one uses the selected character's mouth
function voiceMouth(c) { const p = c && c.mouth && ppPart(c.mouth); return p && p.role === 'mouth' ? p : ppByRole('mouth'); }
async function fxLipSync() {
  const clips = voiceClips(); if (!clips.length) { toast('Chưa có giọng — bấm ＋ Thêm giọng'); return; }
  if (!clips.some(c => voiceMouth(c))) { toast('Cần mảnh vai trò "Miệng": Ghép → chọn Đầu → ✂ Khoanh tách miệng (giữ chỗ cũ) → Vai trò Miệng. Thêm hình miệng há để đẹp hơn.', 6000); return; }
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100), dec = [];
  for (const c of clips) { if (!S.frames.some(f => f.id === c.frameId)) c.frameId = S.frames[S.cur].id; const buf = await decodeAB(ac, c.buf); srcDurCache.set(c.buf, buf.duration); dec.push({ c, data: buf.getChannelData(0), sr: buf.sampleRate, dur: buf.duration, mouth: voiceMouth(c) }); }
  let T = frameStartTimes(); const need = Math.max(...dec.map(d => clipStart(d.c, 'voice', T) + clipLen(d.c, 'voice', d.dur))) - T[S.frames.length];
  if (need > 0.05) {
    const fd = 0.1, n = Math.ceil(need / fd);
    const ok = await modal({ title: 'Giọng dài hơn số frame', html: `<p>Giọng kéo dài tới ${(need + T[S.frames.length]).toFixed(1)}s. Thêm <b>${n} frame</b> (0.1s/frame, giữ nguyên tư thế frame cuối) để đủ dài?</p>`, buttons: [{ label: 'Không', value: false }, { label: 'Thêm frame', value: true, primary: true }] });
    if (ok) {
      const pm = progress('Đang thêm frame…'); const last = S.frames[S.frames.length - 1]; await ensureLoaded(last);
      const blank = !last.png && last.ver === 0;
      for (let k = 0; k < n; k++) { const f = newFrameObj(last.bgId); f.dur = fd * 1000; if (!blank && last.canvas) { f.canvas.getContext('2d').drawImage(last.canvas, 0, 0); copyCol(f, last); f.ver = 1; } f.vec = cloneVec(last.vec); f.pp = ppClone(last.pp); f.lip = lipCopy(last); f.ppKey = false; S.frames.push(f); loaded.push(f); if (k % 20 === 0) { pm.set(`Đang thêm frame ${k}/${n}…`); await new Promise(r => setTimeout(r, 0)); evictSoon(); } }
      pm.close(); for (const f of S.frames.slice(-n)) await drawThumb(f); ppRetween(); buildStrip(); evictSoon(); T = frameStartTimes();
    }
  }
  const byMouth = new Map();
  for (const d of dec) {
    if (!d.mouth) continue; const st = clipStart(d.c, 'voice', T), off = clipOff(d.c), len = clipLen(d.c, 'voice', d.dur), { data, sr } = d;
    const rms = (a, b) => { let s = 0, c = 0; for (let i = Math.max(0, Math.floor(a * sr)); i < Math.min(data.length, Math.floor(b * sr)); i += 4) { s += data[i] * data[i]; c++; } return c ? Math.sqrt(s / c) : 0; };
    const lv = S.frames.map((f, i) => { const a = T[i] - st, b = T[i + 1] - st; return b <= 0 || a >= len ? null : rms(off + Math.max(0, a), off + Math.min(len, b)); });
    const mx = Math.max(0.0001, ...lv.filter(v => v != null)), arr = byMouth.get(d.mouth.id) || new Array(S.frames.length).fill(null);
    lv.forEach((v, i) => { if (v == null) return; const n2 = v / mx, q = n2 < 0.12 ? 0 : n2 < 0.45 ? 0.5 : 1; arr[i] = Math.max(arr[i] ?? 0, q); });
    byMouth.set(d.mouth.id, arr);
  }
  S.frames.forEach((f, i) => {
    const old = JSON.stringify(f.lip || null), m = {}; for (const [id, arr] of byMouth) if (arr[i] != null) m[id] = arr[i];
    const l = {}; if (f.lip && f.lip.eb) l.eb = f.lip.eb; if (f.lip && f.lip.mv) l.mv = f.lip.mv; if (f.lip && f.lip.off) l.off = f.lip.off; if (f.lip && f.lip.jg) l.jg = f.lip.jg; if (Object.keys(m).length) l.m = m;
    f.lip = Object.keys(l).length ? l : null; if (JSON.stringify(f.lip) !== old) { f.ver++; queueThumbFor(f); }
  });
  scheduleSave(); requestRender(); fxSyncBar();
  const noAlt = [...byMouth.keys()].some(id => { const p = ppPart(id); return p && !(p.alts && p.alts.length); });
  toast(`Đã nhép miệng ${byMouth.size > 1 ? byMouth.size + ' nhân vật ' : ''}theo ${clips.length} giọng${noAlt ? ' (thêm hình miệng há cho mảnh Miệng để đẹp hơn)' : ''}`, 4000);
}
// one row per voice clip: which character speaks it, where it starts, delete
function voiceCharList() { if (!S.pp) return []; const roots = S.pp.parts.filter(p => !p.parent); return roots.map((r, k) => ({ id: r.id, name: 'Nhân vật ' + (k + 1), mouth: S.pp.parts.find(p => p.role === 'mouth' && ppCharOf(p) === r.id) })).filter(x => x.mouth); }
function voiceRows() {
  const el = document.getElementById('fxVoiceList'); if (!el) return;
  const clips = voiceClips(), chars = voiceCharList();
  el.innerHTML = clips.length ? clips.map((c, k) => {
    const m = voiceMouth(c), opts = chars.map(ch => `<option value="${ch.mouth.id}"${m && m.id === ch.mouth.id ? ' selected' : ''}>${ch.name}</option>`).join('');
    return `<span class="vrow" data-vk="${k}"><span class="lbl">🎤 ${k + 1}. ${String(c.name).replace(/</g, '&lt;').slice(0, 28)} · từ frame ${voiceStart(c) + 1}</span>${chars.length > 1 ? `<select class="chip small" data-vmouth="${k}" title="Nhân vật nói câu này (miệng nào nhép)">${opts}</select>` : ''}<button class="chip small" data-vhere="${k}" title="Dời giọng này để bắt đầu ở frame đang xem">📍 Bắt đầu ở frame này</button><button class="chip small" data-vdel="${k}" title="Bỏ giọng này">✕</button></span>`;
  }).join('') : '<span class="lbl">chưa có</span>';
  el.querySelectorAll('[data-vmouth]').forEach(sel => sel.addEventListener('change', () => { const c = voiceClips()[+sel.dataset.vmouth]; if (c) { c.mouth = sel.value; scheduleSave(); toast('Bấm 🗣 Tự nhép miệng để cập nhật'); } }));
  el.querySelectorAll('[data-vhere]').forEach(b => b.addEventListener('click', () => { const c = voiceClips()[+b.dataset.vhere]; if (c) { c.frameId = curFrame().id; delete c.dt; waveKey = ''; updateWaves(); fxSyncBar(); scheduleSave(); toast('Giọng bắt đầu ở frame ' + (S.cur + 1) + ' — bấm 🗣 Tự nhép miệng để cập nhật'); } }));
  el.querySelectorAll('[data-vdel]').forEach(b => b.addEventListener('click', () => voiceDel(+b.dataset.vdel)));
}
function voiceAdd(clip) {
  S.audio = S.audio || {}; const A = S.audio; clip.id = clip.id || newId();
  const m = ppByRole('mouth'); if (m) clip.mouth = m.id;
  if (!A.voice) A.voice = clip; else { A.voices = A.voices || []; A.voices.push(clip); }
}
function voiceDel(k) {
  const A = S.audio; if (!A) return; const clips = voiceClips(), c = clips[k]; if (!c) return;
  const mouth = voiceMouth(c), rest = clips.filter(x => x !== c), still = mouth && rest.some(x => { const mm = voiceMouth(x); return mm && mm.id === mouth.id; });
  if (c === A.voice) { A.voice = (A.voices || []).shift() || null; } else A.voices = (A.voices || []).filter(x => x !== c);
  if (!still) S.frames.forEach(f => { if (!f.lip) return; const l = { ...f.lip }; if (!rest.length || (mouth && l.pid === mouth.id)) { delete l.pid; delete l.lv; } if (l.m && mouth) { l.m = { ...l.m }; delete l.m[mouth.id]; if (!Object.keys(l.m).length) delete l.m; } if (!rest.length) delete l.m; const nl = Object.keys(l).length ? l : null; if (JSON.stringify(nl) !== JSON.stringify(f.lip)) { f.lip = nl; f.ver++; queueThumbFor(f); } });
  waveKey = ''; updateWaves(); fxSyncBar(); scheduleSave(); requestRender();
}
