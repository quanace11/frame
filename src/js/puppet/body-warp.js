/* ===== 🫠 Uốn mềm cả người (soft pin-and-drag warp of a whole character, like Photoshop's Puppet Warp) =====
   Ghim + kéo: chạm lên nhân vật = cắm 1 ghim, kéo ghim = phần đó đi theo, cả người cong mềm theo; bàn chân tự được ghim
   (đứng yên). Không cần cắt mảnh, không cần khớp: dùng được cho ảnh nhập thành layer và cho nhân vật đã cắt (cả người uốn chung).
   🔁 Cho chuyển động: dáng vừa kéo lặp theo nhịp suốt các frame chọn, không thêm frame: ↔ Lắc qua lại (hông đánh sang trái
   rồi phải), ↕ Nhún nhấp nhô, 😂 Cười nắc nẻ (giật nhanh). Phần cao hơn đi trễ một chút (đầu theo sau hông) nên mềm mại.
   Stored as an overlay per frame f.lip.bw = {rootId: {p: [{x, y, dx, dy}] pins in the ROOT piece's own coordinates (rest place +
   pull), k: 'still'|'swing'|'bob'|'laugh', s: beats per second, a: strength, feet: 0 = do not pin the feet}} — like lip.jg, so
   copied frames / tweens / lip sync keep it, undo = 'lipe'. Drawn by drawPuppet → bwDraw: the character's pieces are drawn into a
   buffer, then the buffer is drawn through a triangle grid moved by moving-least-squares (affine) from the pins.
   Motion follows film time (jgClock while playing smoothly / exporting); while editing the drag shows as it is (factor 1). */
const BW_KINDS = {
  still: ['🧷 Đứng yên ở dáng này', 'Giữ đúng dáng vừa kéo, không chuyển động'],
  swing: ['↔ Lắc qua lại', 'Kéo sang bên này rồi sang bên kia (đánh hông, lắc người)'],
  bob: ['↕ Nhún nhấp nhô', 'Nhún xuống rồi lên đều đều, mềm mại'],
  laugh: ['😂 Cười nắc nẻ', 'Giật xuống nhanh từng nhịp như cười ha hả'],
};
// ready-made shapes (pins on the body, in parts of the character's height above the feet), used when nothing was dragged yet
const BW_PRESETS = {
  laugh: ['😂 Cười cả người nhấp nhô', 'laugh', 5, [[-0.18, 0.72, -0.012, 0.035], [0.18, 0.72, 0.012, 0.035], [0, 0.95, 0, 0.05], [0, 0.45, 0, 0.012]]],
  sway: ['↔ Lắc người ngang', 'swing', 2, [[0, 0.5, 0.09, 0], [0, 0.95, 0.05, 0]]],
  hips: ['💃 Đánh hông', 'swing', 2, [[0, 0.45, 0.1, 0], [0, 0.95, -0.02, 0]]],
  bob: ['↕ Nhún nhịp nhàng', 'bob', 2, [[-0.18, 0.7, -0.01, 0.03], [0.18, 0.7, 0.01, 0.03], [0, 0.95, 0, 0.04]]],
};
let bwMode = false, bwOpt = { k: 'swing', s: 2, a: 1, pre: 'hips' };
try { const o = JSON.parse(localStorage.getItem('fs-bodywarp') || 'null'); if (o && typeof o === 'object') bwOpt = { ...bwOpt, ...o }; } catch (e) { /* no storage */ }
const bwSaveOpt = () => { try { localStorage.setItem('fs-bodywarp', JSON.stringify(bwOpt)); } catch (e) { /* no storage */ } };
const bwOf = (lip, rid) => lip && lip.bw && lip.bw[rid];
const bwAny = lip => !!(lip && lip.bw && Object.keys(lip.bw).some(k => { const o = lip.bw[k]; return o && o.p && o.p.length; }));

/* --- geometry --- */
// lowest opaque pixel of each of 32 columns of a piece picture (cached per picture)
const bwBotCache = new WeakMap();
function bwBottoms(h) {
  if (!h || !h.c) return [];
  let g = bwBotCache.get(h); if (g && g.c === h.c) return g.pts;
  const a = ppAlphaH(h), w = h.c.width, hh = h.c.height, pts = [], N = Math.min(32, w);
  for (let k = 0; k < N; k++) { const x = Math.min(w - 1, Math.round((k + 0.5) * w / N)); for (let y = hh - 1; y >= 0; y--) if (a[y * w + x] > 100) { pts.push({ x, y }); break; } }
  bwBotCache.set(h, { c: h.c, pts }); return pts;
}
// world box + feet of a character drawn with matrices M: {x0, y0, x1, y1, fy (ground), fl, fr (feet x), h (height feet → top)}
function bwShape(parts, pose, M) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const bot = [];
  for (const p of parts) {
    const im = ppImg(p, pose && pose[p.id]), m = M[p.id]; if (!im.c || !m) continue;
    for (const [X, Y] of [[0, 0], [im.c.width, 0], [0, im.c.height], [im.c.width, im.c.height]]) { const q = mApply(m, im.x + X, im.y + Y); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    for (const b of bwBottoms(im.holder)) bot.push(mApply(m, im.x + b.x, im.y + b.y));
  }
  if (!(x1 > x0) || !(y1 > y0)) return null;
  let fy = -Infinity; for (const q of bot) fy = Math.max(fy, q.y); if (!isFinite(fy)) fy = y1;
  const h = Math.max(10, fy - y0), band = 0.035 * h; let fl = Infinity, fr = -Infinity;
  for (const q of bot) if (q.y >= fy - band) { fl = Math.min(fl, q.x); fr = Math.max(fr, q.x); }
  if (!isFinite(fl)) { fl = (x0 + x1) / 2; fr = fl; }
  return { x0, y0, x1, y1, fy, fl, fr, h };
}
// pins of the feet (they never move): soles + a little above, so the ankles stay put too
function bwFeetPins(sh) {
  const out = [], xs = sh.fr - sh.fl > 0.08 * sh.h ? [sh.fl, (sh.fl + sh.fr) / 2, sh.fr] : [(sh.fl + sh.fr) / 2 - 0.04 * sh.h, (sh.fl + sh.fr) / 2 + 0.04 * sh.h];
  for (const x of xs) for (const y of [sh.fy, sh.fy - 0.06 * sh.h]) out.push({ p: { x, y }, q: { x, y } });
  return out;
}
// how far along its pull a pin is at film time t (null = editing: the drag as it is)
function bwFactor(o, t, u) {
  if (t == null || !o.k || o.k === 'still') return 1;
  const ph = 2 * Math.PI * (o.s || 2) * t - 0.9 * clamp(u, 0, 1);   // higher up = a little later (the head follows the hips)
  if (o.k === 'swing') return Math.sin(ph);
  if (o.k === 'bob') return (1 - Math.cos(ph)) / 2;
  return Math.pow(Math.abs(Math.sin(ph / 2)), 0.6);   // laugh: quick sharp drops, one per beat
}
// the pins of a character in world coords: [{p: rest, q: where it goes}], feet included
function bwPins(o, MR, sh, t) {
  const pins = o.feet === 0 ? [] : bwFeetPins(sh), A = o.a == null ? 1 : o.a;
  for (const n of o.p || []) {
    const p = mApply(MR, n.x, n.y), u = (sh.fy - p.y) / sh.h, k = A * bwFactor(o, t, u);
    pins.push({ p, q: { x: p.x + (MR[0] * n.dx + MR[2] * n.dy) * k, y: p.y + (MR[1] * n.dx + MR[3] * n.dy) * k }, n });
  }
  return pins;
}
// moving least squares, affine (Schaefer et al. 2006): where rest point v goes; similarity when the pins are in a line
function bwMLS(pins, x, y) {
  let sw = 0, px = 0, py = 0, qx = 0, qy = 0; const ws = [];
  for (const k of pins) { const dx = k.p.x - x, dy = k.p.y - y, d2 = dx * dx + dy * dy; if (d2 < 1e-6) return { x: k.q.x, y: k.q.y }; const w = 1 / d2; ws.push(w); sw += w; px += w * k.p.x; py += w * k.p.y; qx += w * k.q.x; qy += w * k.q.y; }
  if (!sw) return { x, y };
  px /= sw; py /= sw; qx /= sw; qy /= sw;
  let a = 0, b = 0, d = 0, m00 = 0, m01 = 0, m10 = 0, m11 = 0, mu = 0, sr = 0, si = 0;
  pins.forEach((k, i) => {
    const w = ws[i], ax = k.p.x - px, ay = k.p.y - py, bx = k.q.x - qx, by = k.q.y - qy;
    a += w * ax * ax; b += w * ax * ay; d += w * ay * ay; m00 += w * ax * bx; m01 += w * ax * by; m10 += w * ay * bx; m11 += w * ay * by;
    mu += w * (ax * ax + ay * ay); sr += w * (ax * bx + ay * by); si += w * (ax * by - ay * bx);
  });
  const vx = x - px, vy = y - py, det = a * d - b * b;
  if (det > 1e-6 * (a + d) * (a + d)) {
    const i00 = d / det, i01 = -b / det, i11 = a / det, A00 = i00 * m00 + i01 * m10, A01 = i00 * m01 + i01 * m11, A10 = i01 * m00 + i11 * m10, A11 = i01 * m01 + i11 * m11;
    return { x: vx * A00 + vy * A10 + qx, y: vx * A01 + vy * A11 + qy };
  }
  if (mu < 1e-9) return { x: x + qx - px, y: y + qy - py };   // one pin: just slide
  const zr = sr / mu, zi = si / mu; return { x: vx * zr - vy * zi + qx, y: vx * zi + vy * zr + qy };
}

/* --- drawing (called by drawPuppet for a character that has pins) --- */
const bwBuf = new Map();   // root id → reused canvas
// draw the character's pieces through the warp; false = could not (caller draws them normally)
function bwDraw(ctx, rid, parts, pose, M, drawOne, o) {
  const MR = M[rid], sh = MR && bwShape(parts, pose, M); if (!sh) return false;
  const t = jgClock, pins = bwPins(o, MR, sh, t);
  const moved = pins.some(k => Math.abs(k.q.x - k.p.x) + Math.abs(k.q.y - k.p.y) > 0.01);
  if (!moved) return false;
  const pad = Math.max(8, 0.06 * sh.h), x0 = sh.x0 - pad, y0 = sh.y0 - pad, bw = sh.x1 - sh.x0 + 2 * pad, bh = sh.y1 - sh.y0 + 2 * pad;
  const T = ctx.getTransform(), s = Math.min(Math.hypot(T.a, T.b) || 1, 2400 / Math.max(bw, bh)), cw = Math.ceil(bw * s), ch = Math.ceil(bh * s);
  if (cw < 2 || ch < 2 || cw * ch > 8e6) return false;
  let cv = bwBuf.get(rid); if (!cv) { cv = makeCanvas(cw, ch); bwBuf.set(rid, cv); } else if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const bx = cv.getContext('2d'); bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, cw, ch); bx.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
  for (const p of parts) drawOne(bx, p);
  bx.setTransform(1, 0, 0, 1, 0, 0);
  // the grid over the box (a bit past it so a pulled edge still has room), rest in buffer pixels, moved in world coords
  const NX = 12, NY = clamp(Math.round(NX * bh / bw), 8, 32), G = [], src = { c: cv, x: 0, y: 0 };
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const X = x0 + bw * i / NX, Y = y0 + bh * j / NY; G.push([{ x: (X - x0) * s, y: (Y - y0) * s }, bwMLS(pins, X, Y)]); }
  const T0 = ctx.getTransform(); ctx.save(); ctx.setTransform(T0);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const q = [G[j * (NX + 1) + i], G[j * (NX + 1) + i + 1], G[(j + 1) * (NX + 1) + i + 1], G[(j + 1) * (NX + 1) + i]];
    for (const tr of [[0, 1, 2], [0, 2, 3]]) { const Mx = ppAffine3(tr.map(k => q[k][0]), tr.map(k => q[k][1])); if (Mx) ppPolyDraw(ctx, Mx, tr.map(k => q[k][0]), src, 1); }
  }
  ctx.restore();
  return true;
}

/* --- smooth playback: pins with the same count on this frame and the next blend over the last 0.16 s (like lip.mv) --- */
function bwLipAt(i, tIn, lip) {
  const f = S.frames[i], nx = S.frames[i + 1], a = lip && lip.bw; if (!a || !nx || !nx.lip || !nx.lip.bw) return lip;
  const dur = Math.max(1, f.dur), T = Math.min(dur, 160), u = clamp((tIn * 1000 - (dur - T)) / T, 0, 1); if (u <= 0) return lip;
  const bw = {};
  for (const id in a) {
    const o = a[id], n = nx.lip.bw[id];
    if (!n || !o.p || !n.p || o.p.length !== n.p.length || (o.k || 'still') !== 'still' || (n.k || 'still') !== 'still') { bw[id] = o; continue; }
    bw[id] = { ...o, p: o.p.map((q, k) => { const r = n.p[k]; return { x: q.x + (r.x - q.x) * u, y: q.y + (r.y - q.y) * u, dx: q.dx + (r.dx - q.dx) * u, dy: q.dy + (r.dy - q.dy) * u }; }) };
  }
  return { ...lip, bw };
}

/* --- editing: ghim + kéo on the canvas (Ghép tool) --- */
function bwEdit(f, fn) {
  const before = f.lip ? JSON.stringify(f.lip) : null, l = { ...(f.lip || {}) }; l.bw = { ...(l.bw || {}) }; fn(l.bw);
  for (const k in l.bw) if (!l.bw[k] || !l.bw[k].p || !l.bw[k].p.length) delete l.bw[k];
  if (!Object.keys(l.bw).length) delete l.bw; const lip = Object.keys(l).length ? l : null, after = lip ? JSON.stringify(lip) : null;
  if (before === after) return null; f.lip = lip; f.ver++; queueThumbFor(f); return { t: targetOf(f), lipe: true, before, after, bytes: 64 };
}
function bwToggle(on) {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật / hình. Nhập ảnh (thành layer) hoặc cắt nhân vật trước'); return; }
  bwMode = on == null ? !bwMode : on;
  if (bwMode) { ppPathMode = ppCutMode = ppPatchMode = false; ppPaint = null; jgMode = false; if (typeof jgSync === 'function') jgSync(); if (playing) stopPlay(); if (S.tool !== 'puppet') setTool('puppet'); }
  bwSync(); if (typeof ppSyncBar === 'function') ppSyncBar(); requestRender();
  if (bwMode) toast('Chạm lên người = cắm ghim, kéo ghim = uốn mềm. Bàn chân tự ghim đứng yên. Chạm lại 1 ghim = bỏ ghim', 5000);
}
function bwSync() {
  const b = document.getElementById('bwBtn'); if (b) { b.textContent = bwMode ? '✓ Xong uốn' : '📌 Ghim + kéo'; b.classList.toggle('on', !bwMode); }
  let n = 0; S.frames.forEach(f => { if (bwAny(f.lip)) n++; });
  const el = document.getElementById('bwInfo'); if (el) el.textContent = n ? `${n} frame đang uốn` : '';
}
// the character a point is on (or the selected one)
function bwRootAt(p, f) { const h = ppHit(p, ppPoseFor(f), true); return h ? ppCharOf(h) || h.id : null; }
function bwCharParts(rid) { return S.pp.parts.filter(p => (ppCharOf(p) || p.id) === rid); }
// pins of a character on frame f in world coords, as they show now (editing: factor 1)
function bwWorld(f, rid) {
  const o = bwOf(f.lip, rid), P = ppPoseFor(f), M = ppMats(P), sh = M[rid] && bwShape(bwCharParts(rid), P, M);
  return sh ? { o, M, MR: M[rid], sh, pins: o ? bwPins(o, M[rid], sh, null) : bwFeetPins(sh) } : null;
}
function bwStart(p, base, f) {
  const tol = 26 * DPR / vs;
  // a pin of any character that has some on this frame
  for (const rid in (f.lip && f.lip.bw) || {}) {
    const w = bwWorld(f, rid); if (!w || !w.o) continue;
    const k = w.pins.findIndex(k => k.n && Math.hypot(k.q.x - p.x, k.q.y - p.y) <= tol);
    if (k >= 0) { const idx = w.o.p.indexOf(w.pins[k].n); action = { ...base, kind: 'bwpin', rid, idx, before: f.lip ? JSON.stringify(f.lip) : null, p0: p, q0: { ...w.pins[k].q }, isNew: false, moved: false }; return; }
  }
  const rid = bwRootAt(p, f); if (!rid) { toast('Chạm lên nhân vật / hình để cắm ghim'); return; }
  if (ppSel == null || (ppCharOf(ppPart(ppSel)) || ppSel) !== rid) { ppSel = rid; ppSyncBar(); }
  const w = bwWorld(f, rid); if (!w) return;
  // the picture under the finger may already be bent: the new pin's rest place = where that bit of picture came from
  const inv = w.pins.map(k => ({ p: k.q, q: k.p })), r = w.pins.length > 0 && w.o ? bwMLS(inv, p.x, p.y) : p;
  const before = f.lip ? JSON.stringify(f.lip) : null, li = mInv(w.MR), rl = mApply(li, r.x, r.y), d = { x: p.x - r.x, y: p.y - r.y };
  const dl = { x: li[0] * d.x + li[2] * d.y, y: li[1] * d.x + li[3] * d.y };
  const l = { ...(f.lip || {}) }; l.bw = { ...(l.bw || {}) }; const o = l.bw[rid] = { k: 'still', s: 2, a: 1, ...(l.bw[rid] || {}) }; o.p = [...(o.p || []), { x: rl.x, y: rl.y, dx: dl.x, dy: dl.y }];
  if (o.k !== 'still' || o.a !== 1) { o.k = 'still'; o.a = 1; }   // dragging again = a still shape (🔁 Cho chuyển động makes it move)
  f.lip = l; f.ver++;
  action = { ...base, kind: 'bwpin', rid, idx: o.p.length - 1, before, p0: p, q0: { ...p }, isNew: true, moved: false };
  requestRender();
}
function bwMove(a, p) {
  const f = curFrame(), o = bwOf(f.lip, a.rid), n = o && o.p[a.idx]; if (!n) return;
  if (!a.moved && Math.hypot(p.x - a.p0.x, p.y - a.p0.y) < 6 * DPR / vs) return;
  if (!a.moved) { a.moved = true; const l = { ...f.lip, bw: { ...f.lip.bw, [a.rid]: { ...o, k: 'still', a: 1, p: o.p.map(q => ({ ...q })) } } }; f.lip = l; }
  const oo = f.lip.bw[a.rid], m = oo.p[a.idx], MR = ppMats(ppPoseFor(f))[a.rid], li = mInv(MR);
  const rest = mApply(MR, m.x, m.y), tx = a.q0.x + p.x - a.p0.x, ty = a.q0.y + p.y - a.p0.y, d = { x: tx - rest.x, y: ty - rest.y };
  m.dx = li[0] * d.x + li[2] * d.y; m.dy = li[1] * d.x + li[3] * d.y;
  f.ver++; requestRender();
}
function bwEnd(a) {
  const f = curFrame();
  if (!a.moved && !a.isNew) {   // a tap on a pin = take it away
    const before = a.before; bwEdit(f, bw => { const o = bw[a.rid]; if (o) bw[a.rid] = { ...o, p: o.p.filter((q, k) => k !== a.idx) }; });
    const after = f.lip ? JSON.stringify(f.lip) : null; if (before !== after) pushEntry({ t: targetOf(f), lipe: true, before, after, bytes: 64 });
    scheduleSave(); requestRender(); bwSync(); updateFrameUI(); return;
  }
  const after = f.lip ? JSON.stringify(f.lip) : null;
  if (a.before !== after) { pushEntry({ t: targetOf(f), lipe: true, before: a.before, after, bytes: 64 }); markEdited(f); scheduleSave(); }
  queueThumbFor(f); bwSync(); updateFrameUI(); requestRender();
}
function bwHitPin(p, f) {
  const tol = 26 * DPR / vs;
  for (const rid in (f.lip && f.lip.bw) || {}) { const w = bwWorld(f, rid); if (w && w.pins.some(k => k.n && Math.hypot(k.q.x - p.x, k.q.y - p.y) <= tol)) return true; }
  return false;
}
// pins on the canvas while 📌 is on: feet (blue, still), dragged pins (orange) with a line from where they were
function bwDrawPins(c, f, px) {
  if (!bwMode || S.tool !== 'puppet' || !S.pp) return;
  const rids = new Set(Object.keys((f.lip && f.lip.bw) || {})); const sel = ppSel && ppPart(ppSel); if (sel) rids.add(ppCharOf(sel) || sel.id);
  c.save();
  for (const rid of rids) {
    const w = bwWorld(f, rid); if (!w) continue;
    for (const k of w.pins) {
      if (k.n) { c.strokeStyle = 'rgba(255,178,30,.8)'; c.lineWidth = 2 * px; c.setLineDash([5 * px, 4 * px]); c.beginPath(); c.moveTo(k.p.x, k.p.y); c.lineTo(k.q.x, k.q.y); c.stroke(); c.setLineDash([]); }
      c.beginPath(); c.arc(k.q.x, k.q.y, (k.n ? 11 : 7) * px, 0, Math.PI * 2); c.fillStyle = k.n ? '#ffb21e' : '#3fa7ff'; c.fill(); c.lineWidth = 2.5 * px; c.strokeStyle = '#fff'; c.stroke();
      if (k.n) { c.beginPath(); c.arc(k.q.x, k.q.y, 3 * px, 0, Math.PI * 2); c.fillStyle = '#222'; c.fill(); }
    }
  }
  c.restore();
}

/* --- 🔁 Cho chuyển động: this frame's shape (or a ready-made one) swings / bobs on frames a..b --- */
function bwPresetPins(rid, f, key) {
  const P = ppPoseFor(f), M = ppMats(P), sh = M[rid] && bwShape(bwCharParts(rid), P, M), pr = BW_PRESETS[key]; if (!sh || !pr) return null;
  const li = mInv(M[rid]), cx = (sh.fl + sh.fr) / 2;
  return pr[3].map(([ux, uy, dx, dy]) => { const r = mApply(li, cx + ux * sh.h * 0.5, sh.fy - uy * sh.h), d = { x: dx * sh.h, y: dy * sh.h }; return { x: r.x, y: r.y, dx: li[0] * d.x + li[2] * d.y, dy: li[1] * d.x + li[3] * d.y }; });
}
async function bwAnimDialog() {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật / hình. Nhập ảnh (thành layer) hoặc cắt nhân vật trước'); return; }
  const f = curFrame(), roots = lyrRoots(), own = Object.keys((f.lip && f.lip.bw) || {});
  const sel = ppSel && ppPart(ppSel) ? ppCharOf(ppPart(ppSel)) || ppSel : null, rid = sel || own[0] || (roots.length === 1 ? roots[0].id : null);
  if (!rid) { toast('Chạm chọn nhân vật muốn uốn trước (công cụ Ghép)'); return; }
  const mine = bwOf(f.lip, rid), n = S.frames.length, o = bwOpt, inp = 'style="width:72px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:inherit"';
  const pre = mine ? 'mine' : o.pre in BW_PRESETS ? o.pre : 'hips';
  const shapes = (mine ? `<button class="chip small${pre === 'mine' ? ' on' : ''}" data-bwp="mine" title="Dáng bạn vừa kéo bằng ghim ở frame này">📌 Dáng tôi vừa kéo</button>` : '')
    + Object.entries(BW_PRESETS).map(([k, v]) => `<button class="chip small${k === pre ? ' on' : ''}" data-bwp="${k}">${v[0]}</button>`).join('');
  const kind0 = pre === 'mine' ? (mine.k && mine.k !== 'still' ? mine.k : o.k) : BW_PRESETS[pre][1];
  const kinds = Object.entries(BW_KINDS).map(([k, [l, t]]) => `<button class="chip small${k === kind0 ? ' on' : ''}" data-bwk="${k}" title="${t}">${l}</button>`).join('');
  let out = null;
  const v = await modal({ title: '🫠 Uốn mềm cả người theo nhịp',
    html: `<p>Cả người cong mềm, <b>bàn chân đứng yên</b>, không cần thêm frame hay cắt mảnh. ▶ Phát để xem (bật 🌊 Phát mượt).</p>
      <div class="lbl" style="margin-top:4px"><b>Dáng uốn</b></div><div class="mrow" style="gap:6px;flex-wrap:wrap">${shapes}</div>
      <div class="lbl" style="margin-top:8px"><b>Chuyển động</b></div><div class="mrow" style="gap:6px;flex-wrap:wrap">${kinds}</div>
      <div class="mrow" style="gap:8px;align-items:center;margin-top:8px"><span class="lbl">Mạnh</span><input id="bwA" type="range" min="0.2" max="2.5" step="0.1" value="${o.a}" style="flex:1"><span class="lbl" id="bwAV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center"><span class="lbl">Nhanh</span><input id="bwS" type="range" min="0.5" max="10" step="0.5" value="${o.s}" style="flex:1"><span class="lbl" id="bwSV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px"><span class="lbl">Từ frame</span><input id="bwFrom" type="number" min="1" max="${n}" value="${S.cur + 1}" ${inp}><span class="lbl">tới</span><input id="bwTo" type="number" min="1" max="${n}" value="${n}" ${inp}><span class="lbl">(trên ${n} frame)</span></div>`,
    onOpen: ov => {
      const lab = () => { ov.querySelector('#bwAV').textContent = Math.round(+ov.querySelector('#bwA').value * 100) + '%'; ov.querySelector('#bwSV').textContent = (+ov.querySelector('#bwS').value) + ' nhịp/giây'; };
      const pick = (sel, b) => ov.querySelectorAll(sel).forEach(x => x.classList.toggle('on', x === b));
      ov.querySelectorAll('[data-bwp]').forEach(b => b.addEventListener('click', () => { pick('[data-bwp]', b); const pr = BW_PRESETS[b.dataset.bwp]; if (pr) { pick('[data-bwk]', ov.querySelector(`[data-bwk="${pr[1]}"]`)); ov.querySelector('#bwS').value = pr[2]; lab(); } }));
      ov.querySelectorAll('[data-bwk]').forEach(b => b.addEventListener('click', () => pick('[data-bwk]', b)));
      ov.querySelector('#bwA').addEventListener('input', lab); ov.querySelector('#bwS').addEventListener('input', lab); lab();
    },
    buttons: [{ label: 'Huỷ', value: null }, { label: '✓ Uốn', value: 1, primary: true, action: () => {
      const q = s => document.querySelector(s), pb = q('[data-bwp].on'), kb = q('[data-bwk].on');
      out = { pre: pb ? pb.dataset.bwp : 'hips', k: kb ? kb.dataset.bwk : 'swing', a: +q('#bwA').value, s: +q('#bwS').value,
        from: clamp((+q('#bwFrom').value || 1) - 1, 0, n - 1), to: clamp((+q('#bwTo').value || n) - 1, 0, n - 1) };
    } }],
  });
  if (!v || !out) return;
  bwApply(rid, out);
}
// write the shape + motion of one character on frames from..to as ONE undo step, then play it once
function bwApply(rid, v) {
  const f = curFrame(), a = Math.min(v.from, v.to), b = Math.max(v.from, v.to), multi = [];
  const pins = v.pre === 'mine' && bwOf(f.lip, rid) ? bwOf(f.lip, rid).p.map(q => ({ ...q })) : bwPresetPins(rid, f, v.pre);
  if (!pins || !pins.length) { toast('Không tìm thấy nhân vật ở frame này'); return; }
  bwOpt = { k: v.k, s: v.s, a: v.a, pre: v.pre === 'mine' ? bwOpt.pre : v.pre }; bwSaveOpt();
  for (let i = a; i <= b; i++) { const e = bwEdit(S.frames[i], bw => { bw[rid] = { p: pins.map(q => ({ ...q })), k: v.k, s: v.s, a: v.a }; }); if (e) multi.push(e); }
  if (!multi.length) return;
  pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); bwToggle(false); updateFrameUI(); bwSync();
  const secs = S.frames.slice(a, b + 1).reduce((s, q) => s + q.dur, 0) / 1000;
  toast(secs < 0.6 ? `Đoạn này chỉ ${secs.toFixed(1)} s: kéo dài thời lượng frame để chuyển động lâu hơn` : `🫠 Đã uốn ${b - a + 1} frame. Đang phát thử…`, 3500);
  if (v.k !== 'still' && !ppSmoothOn()) toast('Bật 🌊 Phát mượt để thấy chuyển động cả khi frame đứng lâu', 4000);
  if (playing) stopPlay(); playRangeOnce = [a, b]; startPlay();
}
// 🗑 Bỏ uốn: this frame / every frame (one undo step)
async function bwClear() {
  const here = Object.keys((curFrame().lip && curFrame().lip.bw) || {}); let any = false; S.frames.forEach(f => { if (bwAny(f.lip)) any = true; });
  if (!any) { toast('Chưa có chỗ nào uốn'); return; }
  const v = await modal({ title: '🗑 Bỏ uốn mềm', html: '<p>Bỏ ghim ở frame này hay ở mọi frame?</p>',
    buttons: [{ label: 'Huỷ', value: null }, ...(here.length ? [{ label: 'Chỉ frame này', value: 'here' }] : []), { label: 'Mọi frame', value: 'all', primary: true }] });
  if (!v) return; const multi = [];
  (v === 'all' ? S.frames : [curFrame()]).forEach(f => { const e = bwEdit(f, bw => { for (const k in bw) delete bw[k]; }); if (e) multi.push(e); });
  if (multi.length) { pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); requestRender(); updateFrameUI(); toast('Đã bỏ uốn'); }
  bwSync();
}
{ const b = document.getElementById('bwBtn'); if (b) b.addEventListener('click', () => bwToggle()); }
{ const b = document.getElementById('bwAnim'); if (b) b.addEventListener('click', bwAnimDialog); }
{ const b = document.getElementById('bwClear'); if (b) b.addEventListener('click', bwClear); }
bwSync();
