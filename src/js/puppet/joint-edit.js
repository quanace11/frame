/* ===== 🔧 Sửa khớp: after cutting, move a character's joints, wiggle the limbs to see where the picture tears,
   then round the joint (◯) or redraw it (✎) so it stays whole when the arm/leg turns =====
   While it is on, the character is shown in its rest pose (the drawing as it was cut; the root keeps its place on this
   frame), so a joint is put exactly on the elbow/knee of the drawing. 🔄 Thử cử động swings every limb round its joint.
   Moving a joint changes p.px/p.py (and the parent's tip when it pointed at it): undo through the automatic undo.
   ◯ Bo tròn khớp: the piece drawn behind gets a disc (its own colour + outline) under its picture round the joint, the
   piece in front is cut to a round end with an outline arc, both round the same centre → no gap or corner when turning.
   Pixel changes are `partpix` entries (one `multi` for several pieces). */
let ppJE = null;   // { wig, ph, t0 }
const ppJEOn = () => !!ppJE && S.tool === 'puppet' && !!S.pp && !playing && !ppSetup && !HC;
const ppJEAmp = p => !p.parent || p.role === 'mouth' || p.role === 'eyes' ? 0 : p.role === 'head' ? 12 : 28;
// rest pose for every piece but the roots (they keep their pose on this frame, so the character stays where it is)
function ppJEPose(P) {
  const out = {}, a = ppJE && ppJE.wig && !action ? Math.sin(ppJE.ph) : 0;
  for (const p of S.pp.parts) { const q = (P && P[p.id]) || {}; out[p.id] = !p.parent ? q : { r: ppJEAmp(p) * a, ...(q.h ? { h: 1 } : {}) }; }
  return out;
}
function ppJETick() { if (!ppJE || !ppJE.wig) return; ppJE.ph = (performance.now() - ppJE.t0) / 1000 * 3; if (ppJEOn()) requestRender(); requestAnimationFrame(ppJETick); }
// joints shown: every piece hung on a parent, of the selected character (or of every character)
function ppJEJoints(f) {
  const sel = ppPart(ppSel), rid = sel && (ppCharOf(sel) || sel.id), P = ppPoseFor(f);
  return S.pp.parts.filter(p => p.parent && p.c && ppPart(p.parent) && !(P[p.id] && P[p.id].h) && (!rid || ppCharOf(p) === rid));
}
function ppJEHit(pt, f) {
  const M = ppMats(ppPoseFor(f)), tol = 24 * DPR / vs; let best = null, bd = tol;
  for (const p of ppJEJoints(f)) { const w = mApply(M[p.id], p.px, p.py), d = Math.hypot(w.x - pt.x, w.y - pt.y); if (d <= bd) { bd = d; best = p; } }
  return best;
}
function ppJEGo() {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật ghép'); return; }
  if (ppJE) { ppJEStop(); return; }
  if (playing) stopPlay();
  ppJE = { wig: false, ph: 0, t0: performance.now() }; ppPaint = null; ppCutMode = ppPatchMode = ppPathMode = false;
  ppSyncBar(); requestRender();
  toast('Hình về dáng gốc. Kéo chấm xanh để dời khớp vào đúng khuỷu tay, đầu gối… 🔄 Thử cử động để xem chỗ nào bị hở', 4500);
}
function ppJEStop() { ppJE = null; ppPaint = null; ppSyncBar(); requestRender(); }
function ppJEStart(p, base, f) {
  const j = ppJEHit(p, f);
  if (j) {
    if (j.id !== ppSel) { ppSel = j.id; ppSyncBar(); }
    const par = ppPart(j.parent), tipPar = !!(par && par.tip && Math.hypot(par.tip.x - j.px, par.tip.y - j.py) < 3);
    action = { ...base, kind: 'ppjedit', part: j, last: p, tipPar, moved: false }; requestRender(); return;
  }
  const hit = ppHit(p, ppPoseFor(f), true);
  ppSel = hit ? hit.id : null; ppSyncBar(); requestRender();
  if (hit && !hit.parent) toast('Đây là mảnh gốc. Chạm chấm xanh ở khớp để dời khớp', 2200);
}
function ppJEMove(a, p, f) {
  const sel = a.part; if (!ppPart(sel.id)) return;
  const Mi = mInv(ppMats(ppPoseFor(f))[sel.id]), o = mApply(Mi, a.last.x, a.last.y), n = mApply(Mi, p.x, p.y), dx = n.x - o.x, dy = n.y - o.y;
  sel.px += dx; sel.py += dy; a.last = p; a.moved = true;
  if (a.tipPar) { const par = ppPart(sel.parent); if (par && par.tip) par.tip = { x: par.tip.x + dx, y: par.tip.y + dy }; }
  f.ver++; requestRender();
}
function ppJEEnd(a) { if (a.moved) { S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); scheduleSave(); } ppSyncBar(); requestRender(); }
/* --- ◯ round joint --- */
const ppJECapR = c => { const g = ppGeom(c); return clamp(g.wid / 2, 3, Math.max(4, 0.6 * g.L)); };
// main colour + outline colour of a piece round a point (rest coordinates)
function ppJECols(p, C, R) {
  const c = p.c, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, bins = new Map(), dk = [0, 0, 0, 0], RR = 1.6 * R;
  const x0 = Math.max(0, Math.floor(C.x - p.ox - RR)), x1 = Math.min(w - 1, Math.ceil(C.x - p.ox + RR)), y0 = Math.max(0, Math.floor(C.y - p.oy - RR)), y1 = Math.min(h - 1, Math.ceil(C.y - p.oy + RR));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] < 200 || Math.hypot(p.ox + x - C.x, p.oy + y - C.y) > RR) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (0.3 * r + 0.59 * g + 0.11 * b < 90) { dk[0] += r; dk[1] += g; dk[2] += b; dk[3]++; continue; }
    const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4), e = bins.get(k) || [0, 0, 0, 0]; e[0]++; e[1] += r; e[2] += g; e[3] += b; bins.set(k, e);
  }
  let best = null; for (const e of bins.values()) if (!best || e[0] > best[0]) best = e;
  if (!best) return null;
  const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  return { fill: rgb(best[1] / best[0], best[2] / best[0], best[3] / best[0]), line: dk[3] > 8 ? rgb(dk[0] / dk[3], dk[1] / dk[3], dk[2] / dk[3]) : '#222' };
}
// the piece behind: a disc under its picture round the joint
function ppJEDisc(B, C, R, cols, lw) {
  const x0 = Math.floor(Math.min(B.ox, C.x - R - lw)), y0 = Math.floor(Math.min(B.oy, C.y - R - lw));
  const x1 = Math.ceil(Math.max(B.ox + B.c.width, C.x + R + lw)), y1 = Math.ceil(Math.max(B.oy + B.c.height, C.y + R + lw));
  const o = makeCanvas(x1 - x0, y1 - y0), x = o.getContext('2d');
  x.beginPath(); x.arc(C.x - x0, C.y - y0, R - lw / 2, 0, Math.PI * 2); x.fillStyle = cols.fill; x.fill(); x.lineWidth = lw; x.strokeStyle = cols.line; x.stroke();
  x.drawImage(B.c, B.ox - x0, B.oy - y0);
  return { c: o, png: null, alpha: null, padded: false, x: x0, y: y0 };
}
// the piece in front: cut to a round end (beyond the joint, farther than R) + an outline arc on that end
function ppJETrim(T, C, R, cols, lw) {
  const w = T.c.width, h = T.c.height, id = T.c.getContext('2d').getImageData(0, 0, w, h), d = id.data;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) { sx += x; sy += y; n++; }
  if (!n) return null;
  const ux0 = C.x - (T.ox + sx / n), uy0 = C.y - (T.oy + sy / n), l = Math.hypot(ux0, uy0); if (l < 1) return null;
  const ux = ux0 / l, uy = uy0 / l; let cut = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (!d[i + 3]) continue;
    const X = T.ox + x + 0.5 - C.x, Y = T.oy + y + 0.5 - C.y; if (X * ux + Y * uy <= 0) continue;
    const k = clamp(R + 0.5 - Math.hypot(X, Y), 0, 1); if (k < 1) { d[i + 3] = Math.round(d[i + 3] * k); cut++; }
  }
  if (!cut) return null;
  const o = makeCanvas(w, h), x = o.getContext('2d'); x.putImageData(id, 0, 0);
  const th = Math.atan2(uy, ux); x.globalCompositeOperation = 'source-atop'; x.lineWidth = lw; x.strokeStyle = cols.line;
  x.beginPath(); x.arc(C.x - T.ox, C.y - T.oy, R - lw / 2, th - Math.PI / 2, th + Math.PI / 2); x.stroke();
  return { c: o, png: null, alpha: null, padded: false, x: T.ox, y: T.oy };
}
// round the joint of piece c (where it hangs on its parent); edits = Map pid → {p, st0, st1}
function ppJERound(c, edits) {
  const par = ppPart(c.parent); if (!par || !c.c || !par.c) return false;
  const C = { x: c.px, y: c.py }, R = ppJECapR(c), lw = clamp(R * 0.12, 1.5, 6);
  const B = c.z <= par.z ? c : par, T = B === c ? par : c, cols = ppJECols(B, C, R) || ppJECols(T, C, R); if (!cols) return false;
  const put = (p, st) => { if (!st) return; const e = edits.get(p.id) || { p, st0: ppHolderGet(p, 0) }; ppHolderSet(p, 0, st); e.st1 = st; edits.set(p.id, e); };
  put(B, ppJEDisc(B, C, R, cols, lw));
  if (T.parent) put(T, ppJETrim(T, C, R, cols, lw));   // never cut the body (root) round a shoulder/hip
  return true;
}
function ppJECommit(edits) {
  const list = [...edits.values()]; if (!list.length) return;
  const es = list.map(({ p, st0, st1 }) => { st1.alpha = ppAlphaH(p); return { partpix: true, pid: p.id, vi: 0, before: st0, after: st1, bytes: 4 * (st0.c.width * st0.c.height + st1.c.width * st1.c.height) }; });
  const e = es.length === 1 ? es[0] : { multi: es }; pushEntry(e); ppPaintRefresh();
  Promise.all(list.map(({ p, st1 }) => toBlob(st1.c).then(b => b.arrayBuffer()).then(buf => { st1.png = buf; if (p.c === st1.c) p.png = buf; }))).then(() => { histCover(e); scheduleSave(); });
}
const ppJELimb = p => !!p.parent && (PP_SOFT1[p.role] || PP_SOFT2[p.role] || ((!p.role || p.role === 'other') && !ppJEInside(p)));
function ppJEInside(p) {   // an eye, a mouth: the picture lies inside its parent's box
  const q = ppPart(p.parent); if (!q || !q.c) return false;
  return p.ox >= q.ox && p.oy >= q.oy && p.ox + p.c.width <= q.ox + q.c.width && p.oy + p.c.height <= q.oy + q.c.height;
}
function ppJERoundSel() {
  const sel = ppPart(ppSel); if (!sel || !sel.parent) { toast('Chạm chấm xanh ở khớp cần bo tròn trước'); return; }
  const ed = new Map(); if (!ppJERound(sel, ed)) { toast('Không tìm thấy màu ở chỗ khớp này'); return; }
  ppJECommit(ed); toast('◯ Đã bo tròn khớp ' + sel.name + '. 🔄 Thử cử động để xem; chưa đẹp thì ✎ Vẽ chỗ khớp hoặc ↶', 3500);
}
function ppJERoundAll() {
  const f = curFrame(), ed = new Map(), js = ppJEJoints(f).filter(ppJELimb); let n = 0;
  for (const c of js) if (ppJERound(c, ed)) n++;
  if (!n) { toast('Không có khớp tay/chân nào để bo tròn'); return; }
  ppJECommit(ed); toast(`◯ Đã bo tròn ${n} khớp tay/chân. 🔄 Thử cử động để xem`, 3000);
}
function ppJESync() {
  const bar = $('#ppJointBar'); bar.hidden = !ppJE;
  ['#ppJointBtn', '#ppJointBtn2'].forEach(id => $(id).classList.toggle('on', !!ppJE));
  if (!ppJE) return;
  const sel = ppPart(ppSel);
  $('#ppJEWig').classList.toggle('on', !!ppJE.wig);
  $('#ppJERound').disabled = !(sel && sel.parent);
  $('#ppJEName').textContent = sel && sel.parent ? 'Khớp: ' + sel.name : '';
}
function ppJEDraw(c, f, px) {
  ppDrawBones(c, f, px);
  const sel = ppPart(ppSel); if (!sel || !sel.parent || !sel.c) return;
  const M = ppMats(ppPoseFor(f)), w = mApply(M[sel.id], sel.px, sel.py), k = Math.hypot(M[sel.id][0], M[sel.id][1]) || 1;
  c.save(); c.setLineDash([6 * px, 5 * px]); c.lineWidth = 2 * px; c.strokeStyle = '#ff3b9a';
  c.beginPath(); c.arc(w.x, w.y, ppJECapR(sel) * k, 0, Math.PI * 2); c.stroke(); c.restore();
}
$('#ppJointBtn').addEventListener('click', ppJEGo);
$('#ppJointBtn2').addEventListener('click', ppJEGo);
$('#ppJEWig').addEventListener('click', () => { if (!ppJE) return; ppJE.wig = !ppJE.wig; ppJE.t0 = performance.now(); ppJE.ph = 0; ppJESync(); requestRender(); if (ppJE.wig) requestAnimationFrame(ppJETick); });
$('#ppJERound').addEventListener('click', ppJERoundSel);
$('#ppJERoundAll').addEventListener('click', ppJERoundAll);
$('#ppJEPaint').addEventListener('click', () => { if (ppPaint && ppPaint !== 'erase') { ppPaint = null; ppSyncBar(); requestRender(); return; } ppPaintGo('brush'); });
$('#ppJEErase').addEventListener('click', () => ppPaintGo('erase'));
$('#ppJEUndo').addEventListener('click', () => undo());
$('#ppJERedo').addEventListener('click', () => redo());
$('#ppJEDone').addEventListener('click', ppJEStop);
