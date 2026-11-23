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
/* ===== 🦴 Gập thử khớp while redrawing a piece: ✎ Vẽ lại mảnh / 🔧 Sửa khớp show a dot on every joint of the character;
   tap a dot → a round knob on that limb, drag it = the limb turns round its joint. Only a preview (`ppPrev` = extra degrees
   per piece, never saved, cleared when painting ends): the brush paints through the bent pose, so the joint can be drawn
   where it tears and the frame's own pose is not touched. ===== */
let ppPrev = {}, ppPrevJ = null, ppPrevShow = true;
const ppPrevMode = () => S.tool === 'puppet' && !!S.pp && !playing && !ppSetup && !HC && (!!ppPaint || ppJEOn());
const ppPrevOn = () => ppPrevMode() && Object.keys(ppPrev).length > 0;
function ppPrevApply(P) {
  const out = { ...(P || {}) };
  for (const id in ppPrev) if (ppPart(id)) out[id] = { ...(out[id] || {}), r: ((out[id] && out[id].r) || 0) + ppPrev[id] };
  return out;
}
// joints of the character being painted (pieces hung on a parent)
function ppPrevJoints(f) {
  const sel = ppPart(ppSel), rid = sel && (ppCharOf(sel) || sel.id), P = ppPoseFor(f);
  return S.pp.parts.filter(p => p.parent && p.c && ppPart(p.parent) && !(P && P[p.id] && P[p.id].h) && (!rid || ppCharOf(p) === rid));
}
// the knob: on the limb, a fixed distance on screen from its joint
function ppPrevKnob(f, p) {
  const M = ppMats(ppPoseFor(f)), w = mApply(M[p.id], p.px, p.py), t = p.tip || ppTipOf(p), e = mApply(M[p.id], t.x, t.y);
  let dx = e.x - w.x, dy = e.y - w.y; const l = Math.hypot(dx, dy); if (l < 1) { dx = 0; dy = 1; } else { dx /= l; dy /= l; }
  const k = 64 * DPR / vs; return { w, x: w.x + dx * k, y: w.y + dy * k };
}
function ppPrevHit(pt, f) {   // → {knob: part} | {dot: part} | null
  if (!ppPrevMode() || !ppPrevShow) return null;
  const tol = 22 * DPR / vs, j = ppPart(ppPrevJ);
  if (j && ppPrevJoints(f).includes(j)) { const k = ppPrevKnob(f, j); if (Math.hypot(k.x - pt.x, k.y - pt.y) <= tol) return { knob: j }; }
  const M = ppMats(ppPoseFor(f)); let best = null, bd = 14 * DPR / vs;
  for (const p of ppPrevJoints(f)) { const w = mApply(M[p.id], p.px, p.py), d = Math.hypot(w.x - pt.x, w.y - pt.y); if (d <= bd) { bd = d; best = p; } }
  return best ? { dot: best } : null;
}
// called first by ppPaintStart (and ppJEStart): true = the touch was on a joint dot / knob
function ppPrevStart(p, base, f) {
  const h = ppPrevHit(p, f); if (!h) return false;
  // a dot: a tap picks the joint; a stroke that starts on it is a normal brush stroke (the joint is where you draw)
  if (h.dot) { action = { ...base, kind: 'ppprevdot', part: h.dot, p0: p, base, f }; return true; }
  const k = ppPrevKnob(f, h.knob);
  action = { ...base, kind: 'ppprevrot', part: h.knob, wp: k.w, a0: Math.atan2(p.y - k.w.y, p.x - k.w.x), r0: ppPrev[h.knob.id] || 0 };
  return true;
}
function ppPrevMove(a, p) {
  let d = (Math.atan2(p.y - a.wp.y, p.x - a.wp.x) - a.a0) / DEG; d = ((d + 540) % 360) - 180;
  const v = a.r0 + d; if (Math.abs(v) < 0.5) delete ppPrev[a.part.id]; else ppPrev[a.part.id] = v;
  curFrame().ver++; requestRender();
}
function ppPrevDotMove(a, p) {
  if (Math.hypot(p.x - a.p0.x, p.y - a.p0.y) < 6 * DPR / vs) return;
  if (!ppPaint) { action = null; if (ppJEOn()) ppJEStart(a.p0, a.base, a.f); if (action && action.kind === 'ppjedit') ppJEMove(action, p, a.f); return; }
  action = null; ppPaintStart(a.p0, a.base, a.f); if (action && action.kind === 'pppaint') ppPaintMove(action, p);
}
function ppPrevDotEnd(a) {
  ppPrevJ = ppPrevJ === a.part.id ? null : a.part.id; ppSyncBar(); requestRender();
  if (ppPrevJ) toast('Kéo nút tròn để gập thử ' + a.part.name + ', rồi vẽ chỗ khớp. Dáng thử không đổi frame', 3000);
}
function ppPrevReset() { ppPrev = {}; ppPrevJ = null; ppSyncBar(); requestRender(); }
function ppPrevSync() {
  if (!ppPaint && !ppJE) { ppPrev = {}; ppPrevJ = null; }
  const b = $('#ppPrevReset'), c = $('#ppPrevShow'); if (c) c.checked = ppPrevShow;
  if (b) b.disabled = !Object.keys(ppPrev).length;
}
function ppPrevDraw(c, f, px) {
  ppGhostDraw(c, f, px);
  if (!ppPrevMode() || !ppPrevShow) return;
  const M = ppMats(ppPoseFor(f)), j = ppPart(ppPrevJ);
  c.save();
  for (const p of ppPrevJoints(f)) {
    const w = mApply(M[p.id], p.px, p.py), on = p === j;
    c.beginPath(); c.arc(w.x, w.y, (on ? 8 : 6) * px, 0, Math.PI * 2); c.fillStyle = on ? '#ff3b9a' : ppPrev[p.id] ? '#ffb21e' : '#2f7bff'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#fff'; c.stroke();
  }
  if (j && ppPrevJoints(f).includes(j)) {
    const k = ppPrevKnob(f, j); c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 5 * px; c.beginPath(); c.moveTo(k.w.x, k.w.y); c.lineTo(k.x, k.y); c.stroke();
    c.strokeStyle = '#ff3b9a'; c.lineWidth = 2.5 * px; c.stroke();
    c.beginPath(); c.arc(k.x, k.y, 13 * px, 0, Math.PI * 2); c.fillStyle = '#ff3b9a'; c.fill(); c.lineWidth = 2.5 * px; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = '#fff'; c.font = `bold ${15 * px}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⟳', k.x, k.y + px);
  }
  c.restore();
}
$('#ppPrevReset').addEventListener('click', ppPrevReset);
$('#ppPrevShow').addEventListener('change', e => { ppPrevShow = e.target.checked; requestRender(); });
/* ===== 👻 Bóng các góc: while redrawing a piece, the limb at the chosen joint (or the piece being painted) is shown faded
   at several angles round its joint at once (−135° … +135°, every 45°) + a dashed circle (radius = half the limb width)
   round the joint. Where all the ghosts meet the body shows where the outline must go so it still fits the body
   whether the arm hangs down, is held out or raised: draw the joint end as that circle. Screen only. ===== */
let ppGhostOn = true;
const PP_GHOST_OFF = [-135, -90, -45, 45, 90, 135];
function ppGhostPart() { const j = ppPart(ppPrevJ); if (j && j.parent) return j; const s = ppPart(ppSel); return s && s.parent && ppPart(s.parent) ? s : null; }
function ppGhostDraw(c, f, px) {
  if (!ppGhostOn || !ppPrevMode()) return;
  const J = ppGhostPart(); if (!J || !J.c) return;
  const base = ppPoseFor(f), r0 = (base[J.id] && base[J.id].r) || 0, kids = new Set([J.id]);
  for (let more = true; more;) { more = false; for (const p of S.pp.parts) if (!kids.has(p.id) && kids.has(p.parent)) { kids.add(p.id); more = true; } }
  const list = S.pp.parts.filter(p => kids.has(p.id) && p.c).sort((a, b) => a.z - b.z);
  c.save(); c.globalAlpha = 0.22;
  for (const d of PP_GHOST_OFF) {
    const P = { ...base, [J.id]: { ...(base[J.id] || {}), r: r0 + d } }, M = ppMats(P);
    for (const p of list) { const q = P[p.id]; if (q && q.h) continue; const im = ppImg(p, q); c.save(); c.transform(...M[p.id]); c.drawImage(im.c, im.x, im.y); c.restore(); }
  }
  c.restore();
  const M = ppMats(base), w = mApply(M[J.id], J.px, J.py), k = Math.hypot(M[J.id][0], M[J.id][1]) || 1;
  c.save(); c.setLineDash([6 * px, 5 * px]); c.lineWidth = 2 * px; c.strokeStyle = '#ff3b9a';
  c.beginPath(); c.arc(w.x, w.y, ppJECapR(J) * k, 0, Math.PI * 2); c.stroke(); c.restore();
}
$('#ppGhostOn').addEventListener('change', e => { ppGhostOn = e.target.checked; requestRender(); });
