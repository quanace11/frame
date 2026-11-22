/* ===== ⬚ 8-handle transform box (like Free Transform in Adobe Animate) =====
   A box = a rectangle in its own local space (x0, y0, x1, y1) + matrix M (local -> doc).
   4 corners = bigger / smaller keeping the proportions, 4 edge handles = stretch one side, round knob above = rotate,
   drag inside = move. The handle opposite the dragged one stays where it is.
   Used by the floating picture (Chọn vùng, Nhập ảnh, Kho hình) and by a whole character / image layer in Ghép (ppDrag 'box'). */
const XB_H = { tl: [-1, -1], t: [0, -1], tr: [1, -1], r: [1, 0], br: [1, 1], b: [0, 1], bl: [-1, 1], l: [-1, 0] };
const xbPx = () => DPR / vs;   // one screen pixel in doc units
function xbLocal(b, k) { const [sx, sy] = XB_H[k]; return { x: (b.x0 + b.x1) / 2 + sx * (b.x1 - b.x0) / 2, y: (b.y0 + b.y1) / 2 + sy * (b.y1 - b.y0) / 2 }; }
const xbDoc = (b, k) => { const l = xbLocal(b, k); return mApply(b.M, l.x, l.y); };
function xbCentre(b) { return mApply(b.M, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); }
// rotate knob: above the top edge (on screen), 40 px out
function xbKnob(b) {
  const t = xbDoc(b, 't'), c = xbCentre(b); let dx = t.x - c.x, dy = t.y - c.y, l = Math.hypot(dx, dy);
  if (l < 1e-6) { dx = -b.M[2]; dy = -b.M[3]; l = Math.hypot(dx, dy) || 1; }
  const d = 40 * xbPx(); return { x: t.x + dx / l * d, y: t.y + dy / l * d };
}
// which part of the box is under p: 'rot', a handle key, 'in' or null
function xbHit(b, p, touch) {
  if (!b) return null;
  const tol = (touch ? 30 : 20) * xbPx(), kn = xbKnob(b);
  if (Math.hypot(kn.x - p.x, kn.y - p.y) <= tol) return 'rot';
  // small box on screen: the handles must not cover its middle, so dragging the middle still moves it
  const bw = Math.hypot(b.M[0], b.M[1]) * Math.abs(b.x1 - b.x0), bh = Math.hypot(b.M[2], b.M[3]) * Math.abs(b.y1 - b.y0);
  let best = null, bd = Math.max(6 * xbPx(), Math.min(tol, 0.3 * Math.min(bw, bh)));
  for (const k of ['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l']) {
    const q = xbDoc(b, k), d = Math.hypot(q.x - p.x, q.y - p.y) * (k.length === 1 ? 1.15 : 1);   // corners win when both are close (small box)
    if (d <= bd) { bd = d; best = k; }
  }
  if (best) return best;
  const l = mApply(mInv(b.M), p.x, p.y);
  return l.x >= Math.min(b.x0, b.x1) && l.x <= Math.max(b.x0, b.x1) && l.y >= Math.min(b.y0, b.y1) && l.y <= Math.max(b.y0, b.y1) ? 'in' : null;
}
/* what dragging handle k from p0 to p does, relative to the box as it was at the start:
   { type: 'move', dx, dy } | { type: 'rot', a (radians), c (doc centre) } | { type: 'scale', kx, ky, a (local anchor that stays put) } */
function xbDrag(b, k, p0, p) {
  if (k === 'in') return { type: 'move', dx: p.x - p0.x, dy: p.y - p0.y };
  if (k === 'rot') {
    const c = xbCentre(b); let a = Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(p0.y - c.y, p0.x - c.x);
    a = wrapRad(a); const deg = a / DEG, sn = Math.round(deg / 45) * 45; if (Math.abs(deg - sn) < 3) a = sn * DEG;   // clicks onto 0 / 45 / 90°
    return { type: 'rot', a, c };
  }
  const [sx, sy] = XB_H[k], opp = Object.keys(XB_H).find(o => XB_H[o][0] === -sx && XB_H[o][1] === -sy);
  const A = xbLocal(b, opp), Hh = xbLocal(b, k), l = mApply(mInv(b.M), p.x, p.y), MIN = 0.03;
  let kx = 1, ky = 1;
  if (sx && sy) { const dx = Hh.x - A.x, dy = Hh.y - A.y, d2 = dx * dx + dy * dy || 1; kx = ky = Math.max(MIN, ((l.x - A.x) * dx + (l.y - A.y) * dy) / d2); }
  else if (sx) kx = Math.max(MIN, (l.x - A.x) / ((Hh.x - A.x) || 1));
  else ky = Math.max(MIN, (l.y - A.y) / ((Hh.y - A.y) || 1));
  return { type: 'scale', kx, ky, a: A };
}
// how far to shift so local point A lands where it was under the old matrix
function xbKeep(M0, M1, A) { const w0 = mApply(M0, A.x, A.y), w1 = mApply(M1, A.x, A.y); return { dx: w0.x - w1.x, dy: w0.y - w1.y }; }
function xbDraw(c, b, px, col) {
  if (!b) return;
  col = col || '#2f9bff';
  const P = ['tl', 'tr', 'br', 'bl'].map(k => xbDoc(b, k)), t = xbDoc(b, 't'), kn = xbKnob(b);
  c.save(); c.setLineDash([]);
  c.lineWidth = 3.5 * px; c.strokeStyle = 'rgba(0,0,0,.45)'; c.beginPath(); P.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.stroke();
  c.lineWidth = 1.6 * px; c.strokeStyle = col; c.stroke();
  c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(kn.x, kn.y); c.stroke();
  const s = 7 * px;
  for (const k of ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l']) { const q = xbDoc(b, k); c.fillStyle = '#fff'; c.strokeStyle = col; c.lineWidth = 2 * px; c.fillRect(q.x - s, q.y - s, 2 * s, 2 * s); c.strokeRect(q.x - s, q.y - s, 2 * s, 2 * s); }
  c.beginPath(); c.arc(kn.x, kn.y, 9 * px, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#fff'; c.stroke();
  c.beginPath(); c.arc(kn.x, kn.y, 4.5 * px, -0.3, Math.PI * 1.4); c.stroke();
  c.restore();
}

/* --- the floating picture: corners/edges/knob on screen instead of the Cỡ / Xoay sliders (they still work) --- */
function floatXbox(fl) {
  fl = fl || floating; if (!fl || !fl.c) return null;
  const w = fl.c.width / 2, h = fl.c.height / 2;
  const M = mMul(mMul(mT(fl.cx, fl.cy), mR(fl.rot)), mS(fl.scale * fl.flip, fl.scale * (fl.ay || 1)));
  return { x0: -w, y0: -h, x1: w, y1: h, M };
}
function floatXbStart(p, base) {
  const b = floatXbox(), k = xbHit(b, p, base.touch);
  if (!k || k === 'in') return false;
  const fl = floating; action = { ...base, kind: 'flxb', k, p0: p, b, s0: { cx: fl.cx, cy: fl.cy, scale: fl.scale, ay: fl.ay || 1, rot: fl.rot } };
  return true;
}
function floatXbMove(p) {
  const a = action, fl = floating; if (!fl) return;
  const s = a.s0, r = xbDrag(a.b, a.k, a.p0, p);
  Object.assign(fl, { cx: s.cx, cy: s.cy, scale: s.scale, ay: s.ay, rot: s.rot });
  if (r.type === 'rot') fl.rot = s.rot + r.a;   // the box centre is the picture's centre
  else if (r.type === 'scale') {
    const sxF = s.scale * r.kx, syF = s.scale * s.ay * r.ky;
    fl.scale = clamp(sxF, 0.02, 40); fl.ay = clamp(syF / fl.scale, 0.02, 50);
    const d = xbKeep(a.b.M, floatXbox().M, r.a); fl.cx += d.dx; fl.cy += d.dy;
  }
  floatXbSync(); requestRender();
}
function floatXbSync() {
  const fl = floating; if (!fl) return;
  const sc = Math.round(fl.scale * 100), deg = Math.round(((fl.rot / DEG) % 360 + 540) % 360 - 180);
  const a = $('#selScale'), b = $('#selRot');
  if (a) { a.value = sc; $('#selScaleVal').textContent = sc + '%'; }
  if (b) { b.value = deg; $('#selRotVal').textContent = deg + '°'; }
}
