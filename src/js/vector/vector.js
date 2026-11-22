/* ========= Vector line layer ========= */
const vsel = new Set();
const vpsel = new Map();   // "Nhiều chấm" mode: stroke id -> Set of selected point indices (only counts while the stroke is in vsel)
let vpoly = null, vpMinus = false, vpLastTap = null;   // vpMinus: "Khoanh bớt" = the next lasso removes points from the selection          // lasso outline of the current point selection: dragging inside it moves the selected points
const vpGet = id => vsel.has(id) ? vpsel.get(id) : null;
function vpCount() { let n = 0; for (const [id, s] of vpsel) if (vsel.has(id)) n += s.size; return n; }
const cloneVec = v => (v || []).map(st => ({ id: st.id, c: st.c, w: st.w, a: st.a, pts: st.pts.map(q => ({ x: q.x, y: q.y })) }));
function strokePath(ctx, pts) {
  ctx.beginPath(); const n = pts.length; if (!n) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (n === 1) { ctx.lineTo(pts[0].x + 0.01, pts[0].y); return; }
  if (n === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
}
// st.a = the stroke's Độ đậm (missing = 100%). solid: ignore it (fill walls)
function drawVec(ctx, strokes, solid) {
  if (!strokes || !strokes.length) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (const st of strokes) { ctx.globalAlpha = solid || st.a == null ? 1 : st.a; ctx.strokeStyle = st.c; ctx.lineWidth = st.w; strokePath(ctx, st.pts); ctx.stroke(); }
  ctx.restore();
}
function renderVec(c, f, px) {
  if (vsel.size && !motion) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(47,123,255,.35)';
    for (const st of f.vec) if (vsel.has(st.id)) { c.lineWidth = st.w + 10 * px; strokePath(c, st.pts); c.stroke(); }
    c.restore();
  }
  drawVec(c, f.vec);
  if (action && action.kind === 'vdraw' && action.pts.length) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = curOp(); c.strokeStyle = S.color; c.lineWidth = vecBrushW(action.pts); strokePath(c, action.pts); c.stroke(); c.restore();
  }
  if (S.tool === 'vedit' && vsel.size && !motion && !rig) {
    c.save(); c.lineWidth = 1.5 * px;
    const multi = S.vdm === 'multi';
    if (multi && vpoly && vpCount() && !(action && action.kind === 'vlasso')) {
      c.save(); c.setLineDash([6 * px, 6 * px]); c.strokeStyle = 'rgba(255,138,0,.8)'; c.fillStyle = 'rgba(255,138,0,.07)';
      c.beginPath(); vpoly.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    if (S.vdm !== 'move') for (const st of f.vec) if (vsel.has(st.id)) { const ps = multi ? vpGet(st.id) : null; st.pts.forEach((q, i) => {
      if (ps && ps.has(i)) { c.beginPath(); c.arc(q.x, q.y, 6.5 * px, 0, Math.PI * 2); c.fillStyle = '#ff8a00'; c.fill(); c.strokeStyle = '#fff'; c.stroke(); return; }
      const end = i === 0 || i === st.pts.length - 1;
      c.beginPath(); c.arc(q.x, q.y, (end ? 6 : 4.5) * px, 0, Math.PI * 2);
      c.fillStyle = end ? '#2f7bff' : '#fff'; c.fill(); c.strokeStyle = end ? '#fff' : '#2f7bff'; c.stroke();
    }); }
    c.restore();
  }
  if (vboxOn() && !(action && action.kind === 'vlasso')) {
    const b = vselBox(f); if (b) {
      c.save(); c.lineWidth = 1.5 * px; c.setLineDash([7 * px, 5 * px]); c.strokeStyle = '#2f7bff';
      c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.setLineDash([]);
      const hs = vboxHandles(b), r = hs.find(h => h.k === 'r');
      c.beginPath(); c.moveTo(r.x, b.y0); c.lineTo(r.x, r.y); c.stroke();
      for (const h of hs) {
        c.beginPath(); if (h.k === 'r') c.arc(h.x, h.y, 10 * px, 0, Math.PI * 2); else c.rect(h.x - 9 * px, h.y - 9 * px, 18 * px, 18 * px);
        c.fillStyle = h.k === 'r' ? '#2f7bff' : '#fff'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = h.k === 'r' ? '#fff' : '#2f7bff'; c.stroke();
      }
      c.restore();
    }
  }
}
/* --- transform box around the selected strokes: drag inside = move, corners = scale, round knob = rotate --- */
const vboxOn = () => S.tool === 'vedit' && S.vdm !== 'multi' && vsel.size > 0 && !motion && !rig && S.showVec;
function vselBox(f) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of f.vec) if (vsel.has(st.id)) for (const q of st.pts) { const h = st.w / 2; x0 = Math.min(x0, q.x - h); y0 = Math.min(y0, q.y - h); x1 = Math.max(x1, q.x + h); y1 = Math.max(y1, q.y + h); }
  if (x0 === Infinity) return null;
  const pad = 12 * DPR / vs; return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, pad };
}
function vboxHandles(b) {
  const L = b.x0 + b.pad, T = b.y0 + b.pad, R = b.x1 - b.pad, B = b.y1 - b.pad;   // scale about the opposite corner of the drawing itself
  return [{ k: 's', x: b.x0, y: b.y0, ax: R, ay: B }, { k: 's', x: b.x1, y: b.y0, ax: L, ay: B }, { k: 's', x: b.x1, y: b.y1, ax: L, ay: T }, { k: 's', x: b.x0, y: b.y1, ax: R, ay: T },
    { k: 'r', x: (b.x0 + b.x1) / 2, y: b.y0 - 36 * DPR / vs }];
}
function vboxHit(b, p) { let best = null, bd = 24 * DPR / vs; for (const h of vboxHandles(b)) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d <= bd) { bd = d; best = h; } } return best; }
/* colour on the Màu layer inside the selected strokes (and under them) follows when they are moved / scaled / rotated */
function colLiftStart(f) {
  if (!f.col || !S.showCol) return null;
  const sel = selStrokes(); if (!sel.length) return null;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const st of sel) for (const q of st.pts) { const h = st.w / 2 + 2; x0 = Math.min(x0, q.x - h); y0 = Math.min(y0, q.y - h); x1 = Math.max(x1, q.x + h); y1 = Math.max(y1, q.y + h); }
  const m0 = 4 + 0.2 * Math.max(x1 - x0, y1 - y0);   // the drawn curve can bulge past its points: keep it whole so the outline stays closed
  x0 = Math.max(0, Math.floor(x0 - m0)); y0 = Math.max(0, Math.floor(y0 - m0)); x1 = Math.min(W - 1, Math.ceil(x1 + m0)); y1 = Math.min(H - 1, Math.ceil(y1 + m0));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (bw < 3 || bh < 3) return null;
  const wc = makeCanvas(bw, bh), wx = wc.getContext('2d'); wx.translate(-x0, -y0); drawVec(wx, sel);
  const wd = wx.getImageData(0, 0, bw, bh).data; wc.width = 0;
  const n = bw * bh, out = new Uint8Array(n), stack = [];
  const seed = i => { if (!out[i] && wd[i * 4 + 3] <= 60) { out[i] = 1; stack.push(i); } };
  for (let x = 0; x < bw; x++) { seed(x); seed((bh - 1) * bw + x); }
  for (let y = 0; y < bh; y++) { seed(y * bw); seed(y * bw + bw - 1); }
  while (stack.length) { const i = stack.pop(), x = i % bw; if (x > 0) seed(i - 1); if (x < bw - 1) seed(i + 1); if (i >= bw) seed(i - bw); if (i < n - bw) seed(i + bw); }
  const kx = f.col.getContext('2d'), img = kx.getImageData(x0, y0, bw, bh), d = img.data;
  const cc = makeCanvas(bw, bh), cx = cc.getContext('2d'), ci = cx.createImageData(bw, bh), cd = ci.data; let any = 0;
  for (let i = 0; i < n; i++) { const j = i * 4; if (out[i] || !d[j + 3]) continue; cd[j] = d[j]; cd[j + 1] = d[j + 1]; cd[j + 2] = d[j + 2]; cd[j + 3] = d[j + 3]; d[j] = d[j + 1] = d[j + 2] = d[j + 3] = 0; any++; }
  if (!any) { cc.width = 0; return null; }
  cx.putImageData(ci, 0, 0);
  const snap = makeCanvas(); snap.getContext('2d').drawImage(f.col, 0, 0);
  kx.putImageData(img, x0, y0);
  const hole = makeCanvas(); hole.getContext('2d').drawImage(f.col, 0, 0);
  return { cc, x0, y0, x1, y1, snap, hole, m: [1, 0, 0, 1, 0, 0] };
}
/* colour inside a lasso loop (or the whole frame when poly is null) lifts with the strokes picked by that loop:
   lines traced from a picture have gaps, so "colour enclosed by the lines" alone often left the colour behind */
function colLiftPoly(f, poly) {
  if (!f.col || !S.showCol) return null;
  let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
  if (poly) { x0 = W; y0 = H; x1 = -1; y1 = -1; for (const q of poly) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1)); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (bw < 3 || bh < 3) return null;
  const snap = makeCanvas(); snap.getContext('2d').drawImage(f.col, 0, 0);
  const cc = makeCanvas(bw, bh), cx = cc.getContext('2d');
  cx.save(); cx.translate(-x0, -y0); if (poly) { polyPath(cx, poly); cx.clip(); } cx.drawImage(f.col, 0, 0); cx.restore();
  const kx = f.col.getContext('2d'); kx.save(); if (poly) { polyPath(kx, poly); kx.globalCompositeOperation = 'destination-out'; kx.fill(); } else kx.clearRect(0, 0, W, H); kx.restore();
  const hole = makeCanvas(); hole.getContext('2d').drawImage(f.col, 0, 0);
  return { cc, x0, y0, x1, y1, snap, hole, m: [1, 0, 0, 1, 0, 0] };
}
// the loop that picked the current stroke selection (Sửa nét): dragging those strokes moves the colour inside it too
let vselLoop = null;
const vselKey = () => [...vsel].sort().join(',');
function vselLoopSet(poly) { vselLoop = vsel.size ? { poly: poly && poly.map(q => ({ x: q.x, y: q.y })), key: vselKey() } : null; }
function vselLoopOk() { return vselLoop && vsel.size && vselLoop.key === vselKey(); }
function colLiftSel(f) { return vselLoopOk() ? colLiftPoly(f, vselLoop.poly) : colLiftStart(f); }
function vselLoopMove(m) { if (vselLoopOk() && vselLoop.poly) vselLoop.poly = vselLoop.poly.map(q => ({ x: m[0] * q.x + m[2] * q.y + m[4], y: m[1] * q.x + m[3] * q.y + m[5] })); }
function colLiftApply(f, L, m) {      // m: canvas transform [a, b, c, d, e, f] in document space
  const kx = f.col.getContext('2d'); kx.save(); kx.globalCompositeOperation = 'copy'; kx.drawImage(L.hole, 0, 0);
  kx.globalCompositeOperation = 'source-over'; kx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); kx.drawImage(L.cc, L.x0, L.y0); kx.restore(); L.m = m; f.colVer++;
}
function colLiftAbort(f, L) { if (!L) return; const kx = f.col.getContext('2d'); kx.save(); kx.globalCompositeOperation = 'copy'; kx.drawImage(L.snap, 0, 0); kx.restore(); f.colVer++; L.snap.width = L.hole.width = L.cc.width = 0; }
function colLiftEnd(f, L) {           // -> pixel undo entry for the Màu layer
  const m = L.m, xs = [L.x0, L.x1], ys = [L.y0, L.y1]; let bx0 = L.x0, by0 = L.y0, bx1 = L.x1, by1 = L.y1;
  for (const x of xs) for (const y of ys) { const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5]; bx0 = Math.min(bx0, X); by0 = Math.min(by0, Y); bx1 = Math.max(bx1, X); by1 = Math.max(by1, Y); }
  const rect = rectFromBox([bx0, by0, bx1, by1], 2); let e = null;
  if (rect) { const kx = f.col.getContext('2d'); e = pixEntry(f, rect, L.snap.getContext('2d').getImageData(...rect), kx.getImageData(...rect), true); }
  L.snap.width = L.hole.width = L.cc.width = 0; return e;
}
function vxformMove(a, p, f) {
  if (!a.moved) { if (Math.hypot(p.x - a.start.x, p.y - a.start.y) < 3 * DPR / vs) return; a.col = colLiftSel(f); }
  a.moved = true; const h = a.h;
  let m, ws = 1;
  if (h.k === 's') {
    const d0 = Math.hypot(a.start.x - h.ax, a.start.y - h.ay) || 1, s = Math.max(0.05, Math.hypot(p.x - h.ax, p.y - h.ay) / d0); ws = s;
    m = [s, 0, 0, s, h.ax * (1 - s), h.ay * (1 - s)];
  } else {
    const ang = Math.atan2(p.y - a.cy, p.x - a.cx) - Math.atan2(a.start.y - a.cy, a.start.x - a.cx), cs = Math.cos(ang), sn = Math.sin(ang);
    m = [cs, sn, -sn, cs, a.cx - a.cx * cs + a.cy * sn, a.cy - a.cx * sn - a.cy * cs];
  }
  const fn = q => ({ x: m[0] * q.x + m[2] * q.y + m[4], y: m[1] * q.x + m[3] * q.y + m[5] });
  for (const st of f.vec) { const b = a.base.get(st.id); if (!b) continue; st.pts = b.pts.map(fn); st.w = Math.max(0.5, b.w * ws); }
  if (a.col) colLiftApply(f, a.col, m);
  requestRender();
}
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L, 0, 1) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function strokeDist(st, p) {
  const P = st.pts; if (P.length === 1) return Math.hypot(P[0].x - p.x, P[0].y - p.y);
  let m = Infinity; for (let i = 0; i < P.length - 1; i++) m = Math.min(m, segDist(p, P[i], P[i + 1])); return m;
}
function hitStroke(list, p, tol) {
  let best = null, bd = Infinity;
  for (let k = list.length - 1; k >= 0; k--) { const st = list[k], d = strokeDist(st, p) - st.w / 2; if (d <= tol && d < bd) { bd = d; best = st; } }
  return best;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function cumLen(P) { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y)); return c; }
function pip(p, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) ins = !ins; } return ins; }
function vecBrushW(pts) { if (!S.pressure) return bsz(); const ap = pts.reduce((a, q) => a + q.p, 0) / pts.length; return widthFor(ap); }
function selStrokes() { const f = curFrame(); return f ? f.vec.filter(st => vsel.has(st.id)) : []; }

function vecStart(p, base) {
  const f = curFrame(), tol = 14 * DPR / vs;
  if (!S.showVec) { toast('Lớp Nét đang ẩn'); return; }
  const mode = S.vdm || 'point', ptol = (mode === 'move' ? 14 : 22) * DPR / vs;
  if (mode === 'multi') { vecMultiStart(p, base, f); return; }
  const box = vboxOn() ? vselBox(f) : null, bh = box && vboxHit(box, p);
  if (bh) { action = { ...base, kind: 'vxform', h: bh, start: p, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, before: cloneVec(f.vec), base: new Map(selStrokes().map(st => [st.id, { pts: st.pts.map(q => ({ x: q.x, y: q.y })), w: st.w }])), moved: false }; return; }
  let best = null, bd = ptol;   // nearest point wins, not the first one in range
  if (mode !== 'move') for (const st of f.vec) if (vsel.has(st.id)) for (let i = 0; i < st.pts.length; i++) { const d = Math.hypot(st.pts[i].x - p.x, st.pts[i].y - p.y); if (d <= bd) { bd = d; best = { st, i }; } }   // "Cả nét" works on whole strokes only
  const startBend = (st, i, before) => { action = { ...base, kind: 'vbend', st, i, start: p, basePts: st.pts.map(q => ({ ...q })), cum: cumLen(st.pts), before: before || cloneVec(f.vec), moved: false }; };
  if (best) { startBend(best.st, best.i); return; }
  const hit = hitStroke(f.vec, p, tol);
  if (hit) {
    // "Cả nét": tap toggles a stroke in/out of the selection (pick many); dragging a selected stroke moves all of them, dragging an unselected one moves just it
    if (mode === 'move') { action = { ...base, kind: 'vmove', start: p, last: p, tapId: hit.id, wasSel: vsel.has(hit.id), before: cloneVec(f.vec), moved: false }; return; }
    if (!vsel.has(hit.id)) { vsel.clear(); vsel.add(hit.id); updVecBar(); requestRender(); return; }   // first tap only selects
    // on a selected stroke between points: insert a new point there and drag just that one
    const before = cloneVec(f.vec), P = hit.pts; let si = 0, sd = Infinity;
    for (let i = 0; i < P.length - 1; i++) { const d = segDist(p, P[i], P[i + 1]); if (d < sd) { sd = d; si = i; } }
    P.splice(si + 1, 0, { x: p.x, y: p.y }); startBend(hit, si + 1, before); action.moved = true; requestRender(); return;
  }
  if (box && p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1) { action = { ...base, kind: 'vmove', start: p, last: p, before: cloneVec(f.vec), moved: false }; return; }
  lasso = [p]; action = { ...base, kind: 'vlasso' }; requestRender();
}
/* --- "Nhiều chấm": lasso many points (across strokes), drag them together, unselected points stay as anchors --- */
function vecMultiStart(p, base, f) {
  let best = null, bd = 22 * DPR / vs;
  if (vpMinus) { lasso = [p]; action = { ...base, kind: 'vlasso', multi: true }; requestRender(); return; }   // Khoanh bớt: every stroke is a lasso (a tap drops the nearest dot)
  for (const st of f.vec) if (vsel.has(st.id)) for (let i = 0; i < st.pts.length; i++) { const d = Math.hypot(st.pts[i].x - p.x, st.pts[i].y - p.y); if (d <= bd) { bd = d; best = { st, i }; } }
  const inPoly = !best && !vpMinus && vpoly && vpCount() && pip(p, vpoly);
  if (best || inPoly) { action = { ...base, kind: 'vmulti', start: p, tap: best, before: cloneVec(f.vec), polyBase: vpoly && vpoly.map(q => ({ ...q })), moved: false }; return; }
  lasso = [p]; action = { ...base, kind: 'vlasso', multi: true }; requestRender();
}
function vpWeights(f) {     // per stroke: base points + weight (1 = selected, 0 = anchor, in between = optional soft falloff)
  const R = +S.mbendR || 0, out = [];
  for (const st of f.vec) {
    const s = vpGet(st.id); if (!s || !s.size) continue;
    const n = st.pts.length, w = new Float32Array(n), sel = [...s].filter(i => i < n);
    if (R > 0) { const c = cumLen(st.pts); for (let j = 0; j < n; j++) { let d = Infinity; for (const i of sel) d = Math.min(d, Math.abs(c[j] - c[i])); const t = d / R; w[j] = t < 1 ? (1 - t * t) * (1 - t * t) : 0; } }
    else for (const i of sel) w[i] = 1;
    out.push({ st, base: st.pts.map(q => ({ x: q.x, y: q.y })), w });
  }
  return out;
}
function vecMultiMove(a, p, f) {
  const dx = p.x - a.start.x, dy = p.y - a.start.y;
  if (!a.moved) {
    if (Math.hypot(dx, dy) < 10 * DPR / vs) return;   // a bit of finger/pen wobble still counts as a tap
    if (a.tap) { const s = vpGet(a.tap.st.id); if (!s || !s.has(a.tap.i)) { if (!vpsel.has(a.tap.st.id) || !vsel.has(a.tap.st.id)) vpsel.set(a.tap.st.id, new Set()); vpsel.get(a.tap.st.id).add(a.tap.i); } }
    a.moved = true; a.w = vpWeights(f); updVecBar();
    a.col = vpoly ? colLiftPoly(f, vpoly) : vselLoopOk() && !vselLoop.poly ? colLiftPoly(f, null) : null;
  }
  if (a.col) colLiftApply(f, a.col, [1, 0, 0, 1, dx, dy]);
  for (const e of a.w) for (let j = 0; j < e.base.length; j++) { const k = e.w[j]; if (!k) continue; e.st.pts[j].x = e.base[j].x + dx * k; e.st.pts[j].y = e.base[j].y + dy * k; }
  if (a.polyBase) vpoly = a.polyBase.map(q => ({ x: q.x + dx, y: q.y + dy }));
  requestRender();
}
function vecMultiTap(a) {      // tap on a point toggles it in/out of the selection
  if (!a.tap) return; const id = a.tap.st.id, now = performance.now(), L = vpLastTap;
  if (L && L.id === id && L.i === a.tap.i && now - L.t < 450) {   // quick 2nd tap on the same point: drop that whole line from the selection
    vpLastTap = null; vsel.delete(id); vpsel.delete(id); if (!vpCount()) { vsel.clear(); vpoly = null; }
    toast('Đã bỏ chọn cả nét này'); return;
  }
  vpLastTap = { id, i: a.tap.i, t: now };
  let s = vpGet(id); if (!s) { s = new Set(); vpsel.set(id, s); }
  s.has(a.tap.i) ? s.delete(a.tap.i) : s.add(a.tap.i);
}
function distToPoly(p, poly) {   // shortest distance from p to the lasso outline
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0;
    d = Math.min(d, Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t));
  }
  return d;
}
function strokeInsideFrac(st, poly) {   // share of the stroke's length that lies inside the lasso (only strokes mostly inside get picked)
  const P = st.pts; if (P.length < 2) return P.length && pip(P[0], poly) ? 1 : 0;
  let tot = 0, inn = 0;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.y - a.y) || 0.01; for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4; tot += l / 4; if (pip({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, poly)) inn += l / 4; } }
  return tot ? inn / tot : 0;
}
function vecMultiLasso(poly, f) {
  let area = 0; if (poly.length > 2) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  if (vpMinus) {   // "Khoanh bớt": unselect the points inside this loop, keep the rest
    if (!vpCount()) return;
    if (Math.abs(area / 2) < 200) { let best = null, bd = 22 * DPR / vs; for (const st of f.vec) { const s = vpGet(st.id); if (s) for (const i of s) { const q = st.pts[i], d = q ? Math.hypot(q.x - poly[0].x, q.y - poly[0].y) : Infinity; if (d <= bd) { bd = d; best = { st, s, i }; } } }
      if (best) { best.s.delete(best.i); if (!best.s.size) { vsel.delete(best.st.id); vpsel.delete(best.st.id); } if (!vpCount()) { vsel.clear(); vpoly = null; } } return; }
    let n = 0; for (const st of f.vec) { const s = vpGet(st.id); if (!s) continue; st.pts.forEach((q, i) => { if (s.has(i) && pip(q, poly)) { s.delete(i); n++; } }); if (!s.size) { vsel.delete(st.id); vpsel.delete(st.id); } }
    if (!vpCount()) { vsel.clear(); vpoly = null; }
    toast(n ? `Đã bỏ chọn ${n} chấm` : 'Vùng khoanh không có chấm cam nào'); return;
  }
  vpsel.clear(); vpoly = null; vsel.clear();
  if (Math.abs(area / 2) < 200) { const hit = hitStroke(f.vec, poly[0], 14 * DPR / vs); if (hit) vsel.add(hit.id); else if (charPixelAt(f, poly[0])) vecOfferConvert(); return; }   // tap: show one stroke's points
  // strict: a point must sit clearly inside the loop, not on its edge (falls back to plain inside if that leaves nothing)
  const m = 8 * DPR / vs, pick = strict => { vsel.clear(); vpsel.clear(); for (const st of f.vec) { const idx = []; st.pts.forEach((q, i) => { if (pip(q, poly) && (!strict || distToPoly(q, poly) >= m)) idx.push(i); }); if (idx.length) { vsel.add(st.id); vpsel.set(st.id, new Set(idx)); } } };
  pick(true); if (!vsel.size) pick(false);
  if (vsel.size) vpoly = poly; else toast('Không có chấm nào trong vùng khoanh');
}
function densifyPts(P, L, map) {   // add points along the drawn curve (same shape), map[old index] = new index
  if (P.length < 2) { map[0] = 0; return P.map(q => ({ x: q.x, y: q.y })); }
  const out = [{ x: P[0].x, y: P[0].y }]; map[0] = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, lin = P.length === 2;
    const c1 = lin ? p1 : { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = lin ? p2 : { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    const k = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / L);
    for (let s = 1; s < k; s++) { const t = s / k, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; out.push({ x: a * p1.x + b * c1.x + c * c2.x + d * p2.x, y: a * p1.y + b * c1.y + c * c2.y + d * p2.y }); }
    out.push({ x: p2.x, y: p2.y }); map[i + 1] = out.length - 1;
  }
  return out;
}
function vecDensify() {
  vecOp((f, sel) => sel.forEach(st => {
    const map = [], s = vpGet(st.id); st.pts = densifyPts(st.pts, 28, map);
    if (s) { const ns = new Set(); for (let i = 0; i < map.length - 1; i++) if (s.has(i)) { ns.add(map[i]); if (s.has(i + 1)) for (let j = map[i] + 1; j < map[i + 1]; j++) ns.add(j); } if (s.has(map.length - 1)) ns.add(map[map.length - 1]); vpsel.set(st.id, ns); }
  }));
  toast('Đã thêm chấm dọc nét');
}
/* lines drawn on the Nhân vật layer are pixels: Sửa nét can't grab them, so offer to turn them into editable strokes */
function charPixelAt(f, p) {
  if (!S.showChar || !f || !f.canvas) return false;
  const x = Math.round(p.x), y = Math.round(p.y), r = Math.round(8 * DPR / vs);
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), d = f.canvas.getContext('2d').getImageData(x0, y0, Math.min(W, x + r + 1) - x0, Math.min(H, y + r + 1) - y0).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 100) return true;
  return false;
}
function charHasPixels(f) {
  if (!f || !f.canvas) return false;
  const c = makeCanvas(108, 192), x = c.getContext('2d'); x.drawImage(f.canvas, 0, 0, 108, 192);
  const d = x.getImageData(0, 0, 108, 192).data; c.width = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return true;
  return false;
}
async function vecOfferConvert() {
  const ok = await modal({ title: 'Đây là nét pixel', html: '<p>Nét này được vẽ ở lớp <b>Nhân vật</b> (dạng pixel) nên chưa sửa được bằng Sửa nét.</p><p><b>Muốn dời cả người</b> (hoặc làm người trượt, chạy qua nhiều frame)? Bấm <b>✋ Dời cả hình</b>: nét và màu đi cùng nhau.</p><p>Muốn uốn từng nét? Chuyển các nét pixel của frame này thành <b>nét sửa được</b>. Màu ở lớp Màu thì vẫn nằm yên.</p><p class="lbl" style="font-size:12px">Mẹo: chọn lớp <b>Nét</b> trước khi vẽ thì nét luôn sửa được, kể cả sau khi tô màu hay đổi công cụ. App sẽ nhớ lớp này cho lần sau.</p>',
    buttons: [{ label: 'Để sau', value: false }, { label: 'Chuyển thành nét sửa được', value: 'conv' }, { label: '✋ Dời cả hình', value: 'all', primary: true }] });
  if (ok === 'conv') convertPixelsToVector(false);
  else if (ok === 'all') liftAll();
}
// box around everything drawn on this frame (lines, colour, vector lines), in document pixels
function frameContentBox(f) {
  const k = 4, w = Math.ceil(W / k), h = Math.ceil(H / k), c = makeCanvas(w, h), x = c.getContext('2d');
  x.scale(1 / k, 1 / k); if (f.col && S.showCol) x.drawImage(f.col, 0, 0); if (f.canvas) x.drawImage(f.canvas, 0, 0); if (f.vec && S.showVec) drawVec(x, f.vec);
  const d = x.getImageData(0, 0, w, h).data; c.width = 0; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 8) { const xx = i % w, yy = (i / w) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  return x1 < 0 ? null : [Math.max(0, (x0 - 2) * k), Math.max(0, (y0 - 2) * k), Math.min(W, (x1 + 3) * k), Math.min(H, (y1 + 3) * k)];
}
// "✋ Dời cả hình": lift everything of this frame (lines + colour + vector lines) as one picture
async function liftAll() {
  const f = curFrame(); if (!f) return; await ensureLoaded(f);
  if (S.tool !== 'lasso') setTool('lasso'); if (S.layer !== 'char') setLayer('char');
  commitFloating();
  const b = frameContentBox(f); if (!b) { toast('Frame này chưa có hình nào'); return; }
  liftSelection([{ x: b[0], y: b[1] }, { x: b[2], y: b[1] }, { x: b[2], y: b[3] }, { x: b[0], y: b[3] }]);
  if (floating) toast('Đã chọn cả hình — kéo để dời, hoặc bấm 🎞 Chuyển động để tạo các frame trượt/chạy', 4000);
}
function vecEraseAt(p) {
  const f = curFrame(), r = Math.max(bsz() / 2, 6 * DPR / vs);
  const n0 = f.vec.length; f.vec = f.vec.filter(st => strokeDist(st, p) - st.w / 2 > r);
  if (f.vec.length !== n0) { action.removed += n0 - f.vec.length; requestRender(); }
}
function vecMove(p) {
  const a = action, f = curFrame();
  if (a.kind === 'vdraw') {
    p = snapPoint(p);
    const k = S.smooth, q = { x: a.sp.x + (p.x - a.sp.x) * (1 - k), y: a.sp.y + (p.y - a.sp.y) * (1 - k), p: p.p };
    if (Math.hypot(q.x - a.sp.x, q.y - a.sp.y) < 0.8) return;
    a.sp = q; a.pts.push(q); a.last = p; requestRender();
  } else if (a.kind === 'verase') vecEraseAt(p);
  else if (a.kind === 'vlasso') { const l = lasso[lasso.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); } }
  else if (a.kind === 'vmulti') vecMultiMove(a, p, f);
  else if (a.kind === 'vxform') vxformMove(a, p, f);
  else if (a.kind === 'vmove') {
    if (!a.moved) {
      if (a.start && Math.hypot(p.x - a.start.x, p.y - a.start.y) < 6 * DPR / vs) return;
      if (a.tapId && !a.wasSel) { vsel.clear(); vsel.add(a.tapId); updVecBar(); }
      a.col = colLiftSel(f);
    }
    const dx = p.x - a.last.x, dy = p.y - a.last.y; a.last = p; a.moved = true;
    for (const st of f.vec) if (vsel.has(st.id)) for (const q of st.pts) { q.x += dx; q.y += dy; }
    if (a.col && a.start) colLiftApply(f, a.col, [1, 0, 0, 1, p.x - a.start.x, p.y - a.start.y]);
    requestRender();
  } else if (a.kind === 'vbend') {
    const dx = p.x - a.start.x, dy = p.y - a.start.y, R = S.bendR, ci = a.cum[a.i]; a.moved = true;
    const st = f.vec.find(x => x.id === a.st.id); if (!st) return;
    for (let j = 0; j < st.pts.length; j++) {
      const t = Math.abs(a.cum[j] - ci) / R, wgt = j === a.i ? 1 : (S.vdm || 'point') !== 'soft' || t >= 1 ? 0 : (1 - t * t) * (1 - t * t);
      st.pts[j].x = a.basePts[j].x + dx * wgt; st.pts[j].y = a.basePts[j].y + dy * wgt;
    }
    requestRender();
  }
}
function vecEnd() {
  const a = action, f = curFrame();
  if (a.kind === 'vdraw') {
    if (a.last) a.pts.push({ ...a.last });
    const before = cloneVec(f.vec);
    const pts = rdp(a.pts, 0.9).map(q => ({ x: q.x, y: q.y }));
    const op = curOp(); f.vec.push({ id: newId(), c: S.color, w: vecBrushW(a.pts), ...(op < 1 ? { a: op } : {}), pts });
    pushVecUndo(f, before); markEdited(f);
  } else if (a.kind === 'verase') { if (a.removed) { pushVecUndo(f, a.before); markEdited(f); } }
  else if (a.kind === 'vlasso' && a.multi) { const poly = lasso; lasso = null; vecMultiLasso(poly, f); }
  else if (a.kind === 'vmulti') { if (a.moved && a.col) { const pe = colLiftEnd(f, a.col), ve = vecEntry(f, a.before, cloneVec(f.vec)); pushEntry(pe ? { multi: [pe, ve] } : ve); markEdited(f); } else if (a.moved) { pushVecUndo(f, a.before); markEdited(f); } else vecMultiTap(a); }
  else if (a.kind === 'vlasso') {
    const poly = lasso; lasso = null;
    let area = 0; if (poly.length > 2) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
    if (Math.abs(area / 2) < 200) { vsel.clear(); if (poly.length && charPixelAt(f, poly[0])) vecOfferConvert(); }
    else { vsel.clear(); for (const st of f.vec) if (strokeInsideFrac(st, poly) >= 0.75) vsel.add(st.id); vselLoopSet(poly); if (!vsel.size) toast('Không có nét nào nằm gọn trong vùng khoanh'); }
  } else if ((a.kind === 'vmove' || a.kind === 'vxform') && a.moved && a.col) {
    vselLoopMove(a.col.m);
    const pe = colLiftEnd(f, a.col), ve = vecEntry(f, a.before, cloneVec(f.vec)); pushEntry(pe ? { multi: [pe, ve] } : ve); markEdited(f);
  } else if ((a.kind === 'vmove' || a.kind === 'vbend' || a.kind === 'vxform') && a.moved) { pushVecUndo(f, a.before); markEdited(f); }
  else if (a.kind === 'vmove' && a.tapId) { a.wasSel ? vsel.delete(a.tapId) : vsel.add(a.tapId); }
  updVecBar(); requestRender();
}
function updVecBar() {
  const show = S.tool === 'vedit' && !motion && !rig && !panelHidden.vedit;
  $('#vecbar').hidden = !show; updPanelPill(); if (!show) return;
  for (const id of [...vpsel.keys()]) if (!vsel.has(id)) vpsel.delete(id);
  if (!vsel.size) vpoly = null;
  const f = curFrame(), sel = selStrokes(), multi = S.vdm === 'multi', np = multi ? vpCount() : 0;
  $('#vecInfo').textContent = np ? `Đã chọn ${np} chấm trên ${vpsel.size} nét` : sel.length ? `Đã chọn ${sel.length} nét` : multi ? 'Khoanh vùng quanh các chấm cần kéo' : `${f ? f.vec.length : 0} nét · chưa chọn`;
  ['#vecW', '#vecRot', '#vecScale', '#vecColor', '#vecSmooth', '#vecDel', '#vecMotion', '#vecDense'].forEach(id => $(id).disabled = !sel.length);
  $('#vecMBend').value = S.mbendR || 0; $('#vecMBend').hidden = $('#vecMBendL').hidden = $('#vecMinus').hidden = !multi;
  if (!multi) vpMinus = false; $('#vecMinus').classList.toggle('on', vpMinus);
  if (sel.length && !vx) $('#vecW').value = sel[0].w;
  $('#vecBend').value = S.bendR; $('#vecBend').hidden = S.vdm !== 'soft';
  document.querySelectorAll('[data-vdm]').forEach(b => b.classList.toggle('on', b.dataset.vdm === S.vdm));
}
let vx = null;    // pending slider edit: {before, center, base}
function vxBegin() {
  if (vx) return vx; const f = curFrame(), sel = selStrokes(); if (!sel.length) return null;
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const st of sel) for (const q of st.pts) { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); }
  vx = { before: cloneVec(f.vec), cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, base: new Map(sel.map(st => [st.id, { pts: st.pts.map(q => ({ ...q })), w: st.w }])) };
  return vx;
}
function vxApply() {
  if (!vx) return; const rot = $('#vecRot').value * Math.PI / 180, sc = $('#vecScale').value / 100, cs = Math.cos(rot), sn = Math.sin(rot);
  for (const st of selStrokes()) {
    const b = vx.base.get(st.id); if (!b) continue;
    st.pts = b.pts.map(q => { const x = (q.x - vx.cx) * sc, y = (q.y - vx.cy) * sc; return { x: vx.cx + x * cs - y * sn, y: vx.cy + x * sn + y * cs }; });
  }
  requestRender();
}
function vxEnd() {
  if (!vx) return; const f = curFrame(); pushVecUndo(f, vx.before); markEdited(f); vx = null;
  $('#vecRot').value = 0; $('#vecScale').value = 100; updVecBar();
}
function vecOp(fn) { const f = curFrame(), sel = selStrokes(); if (!sel.length) return; const before = cloneVec(f.vec); fn(f, sel); pushVecUndo(f, before); markEdited(f); updVecBar(); requestRender(); }
function vecDelete() { vecOp((f) => { f.vec = f.vec.filter(st => !vsel.has(st.id)); vsel.clear(); }); }
function smoothPts(P) { if (P.length < 3) return P; const out = P.map(q => ({ ...q })); for (let i = 1; i < P.length - 1; i++) { out[i].x = (P[i - 1].x + 2 * P[i].x + P[i + 1].x) / 4; out[i].y = (P[i - 1].y + 2 * P[i].y + P[i + 1].y) / 4; } return out; }
async function vecBake() {
  const f = curFrame(); const list = vsel.size ? selStrokes() : f.vec;
  if (!list.length) { toast('Lớp Nét đang trống'); return; }
  await ensureLoaded(f);
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const st of list) for (const q of st.pts) { b[0] = Math.min(b[0], q.x - st.w); b[1] = Math.min(b[1], q.y - st.w); b[2] = Math.max(b[2], q.x + st.w); b[3] = Math.max(b[3], q.y + st.w); }
  const rect = rectFromBox(b, 2); const lc = f.canvas.getContext('2d');
  const vBefore = cloneVec(f.vec);
  let pe = null;
  if (rect) { const before = lc.getImageData(...rect); drawVec(lc, list); pe = pixEntry(f, rect, before, lc.getImageData(...rect)); }
  const ids = new Set(list.map(st => st.id)); f.vec = f.vec.filter(st => !ids.has(st.id)); vsel.clear();
  const ve = vecEntry(f, vBefore, cloneVec(f.vec));
  pushEntry(pe ? { multi: [pe, ve] } : ve); markEdited(f); updVecBar(); requestRender();
  toast(`Đã chốt ${list.length} nét vào lớp Nhân vật (pixel)`);
}
$('#vecW').addEventListener('input', e => { if (!vxBegin()) return; const w = +e.target.value; for (const st of selStrokes()) st.w = w; requestRender(); });
$('#vecW').addEventListener('change', vxEnd);
['#vecRot', '#vecScale'].forEach(id => { $(id).addEventListener('input', () => { if (vxBegin()) vxApply(); }); $(id).addEventListener('change', vxEnd); });
$('#vecBend').addEventListener('input', e => { S.bendR = +e.target.value; });
$('#vecMBend').addEventListener('input', e => { S.mbendR = +e.target.value; });
$('#vecMBend').addEventListener('change', saveSettings);
$('#vecDense').addEventListener('click', vecDensify);
document.querySelectorAll('[data-vdm]').forEach(b => b.addEventListener('click', () => { S.vdm = b.dataset.vdm; saveSettings(); updVecBar(); toast({ point: 'Kéo chấm nào chỉ chấm đó di chuyển. Chạm giữa 2 chấm để thêm chấm mới.', soft: 'Kéo chấm sẽ uốn cong cả đoạn nét lân cận', move: 'Chạm từng nét để chọn nhiều nét (chạm lại để bỏ). Kéo để dời, kéo góc khung để phóng to/thu nhỏ, nút tròn để xoay.', multi: 'Khoanh vùng quanh các chấm (vd cả cẳng chân) rồi kéo bên trong vùng. Chấm không chọn đứng yên làm mốc. Chạm 1 chấm để thêm/bớt, chạm nhanh 2 lần để bỏ cả nét, ➖ Khoanh bớt để bỏ nhiều chấm.' }[S.vdm], 4000); requestRender(); }));
$('#vecColor').addEventListener('click', () => vecOp((f, sel) => sel.forEach(st => st.c = S.color)));
$('#vecSmooth').addEventListener('click', () => vecOp((f, sel) => sel.forEach(st => { st.pts = smoothPts(smoothPts(st.pts)); })));
$('#vecAll').addEventListener('click', () => { const f = curFrame(); vsel.clear(); vpsel.clear(); vpoly = null; f.vec.forEach(st => { vsel.add(st.id); if (S.vdm === 'multi') vpsel.set(st.id, new Set(st.pts.map((_, i) => i))); }); vselLoopSet(null); updVecBar(); requestRender(); });
$('#vecDel').addEventListener('click', vecDelete);
$('#vecNone').addEventListener('click', () => { vsel.clear(); updVecBar(); requestRender(); });
$('#vecMinus').addEventListener('click', () => { vpMinus = !vpMinus; updVecBar(); if (vpMinus) toast('Khoanh quanh các chấm cam bị chọn lố để bỏ chọn. Bấm ➖ lần nữa để tắt.', 3500); requestRender(); });
$('#vecBake').addEventListener('click', vecBake);

