/* ========= Input ========= */
const touches = new Map();
let action = null;    // {id, touch, kind, t0, rect}
let gesture = null;   // touch pan/pinch
let mousePan = null;
function toDoc(ev, rect) {
  const { x, y } = scrToDoc((ev.clientX - rect.left) * DPR, (ev.clientY - rect.top) * DPR);
  let p = 1;
  if (ev.pointerType === 'pen') p = ev.pressure > 0 ? ev.pressure : 0.5;
  return { x, y, p };
}
function layerVisible() { return S.layer === 'bg' ? S.showBg : S.layer === 'vec' ? S.showVec : S.layer === 'col' ? S.showCol : S.showChar; }
function startAction(e, isTouch) {
  const f = curFrame(); if (!f || !f.canvas) return;
  const rect = view.getBoundingClientRect();
  const p = e.tapAt || toDoc(e, rect);
  const base = { id: e.pointerId, touch: isTouch, t0: performance.now(), rect };
  if (ppSetup && ppSetup.stage === 'paint') { ppLabStart(p, base); return; }
  if (ppSetup) {
    const J = ppSetup.J, tol = 24 * DPR / vs; let best = null, bd = Infinity;
    for (const j of RJ) { const d = Math.hypot(J[j].x - p.x, J[j].y - p.y); if (d < bd) { bd = d; best = j; } }
    if (bd <= tol) action = { ...base, kind: 'ppjoint', j: best, last: p };
    return;
  }
  if (S.tool === 'fx' && ballMode) { ballMode.pts = [p]; action = { ...base, kind: 'ballpath' }; requestRender(); return; }
  // a finger tap only counts when the finger lifts without a 2nd finger joining (that is a pinch / 2-finger undo)
  if (isTouch && S.tool === 'fx' && !(fxHit(f, p)) && (gagMode || camPresetMode || fxCamPick)) { action = { ...base, kind: 'fxtap', p }; return; }
  if (S.tool === 'fx' && gagMode) { const k = gagMode; gagMode = null; ballSyncBar(); gagRun(k, p); return; }
  if (S.tool === 'fx') {
    const t = fxHit(f, p);
    if (t) { fxSel = t.id; action = { ...base, kind: 'fxmove', t, last: p, before: fxState(f) }; fxSyncBar(); requestRender(); return; }
    if (glOn() && glStart(p, base)) return;   // ✨ Lóe sáng: mark / move / resize the glowing opening
    if (camPresetMode) { camPresetApply(p); return; }
    if (fxCamPick) { fxEdit(fr => { const c0 = camEditBox(S.cur); camSetBox(fr, { z: Math.max(c0.z, 1.5), x: p.x, y: p.y }); }); return; }
    if (TABS.fx === 'cam' && !panelHidden.fx) {   // Camera tab: drag the box to move it, a corner to zoom, or outside it to draw a new shot
      const b = camBox(camEditBox(S.cur)), tol = 30 * DPR / vs, before = fxState(f);
      const corner = [[-1, -1], [1, -1], [-1, 1], [1, 1]].find(([sx, sy]) => Math.hypot(p.x - (b.cx + sx * b.hw), p.y - (b.cy + sy * b.hh)) <= tol);
      if (corner) action = { ...base, kind: 'camsize', b, before, corner };
      else if (b.z > 1.001 && Math.abs(p.x - b.cx) < b.hw && Math.abs(p.y - b.cy) < b.hh) action = { ...base, kind: 'cammove', b, before, p0: p };
      else action = { ...base, kind: 'camdraw', before, p0: p, r: null };
      fxSel = null; fxSyncBar(); requestRender(); return;
    }
    fxSel = null; fxSyncBar(); requestRender(); return;
  }
  if (S.tool === 'puppet' && HC) { hcStart(p, base); return; }
  if (S.tool === 'puppet') { if (plPin) { plPinAt(p); return; } if (S.pp) ppStart(p, base); else toast('Nhập ảnh → chọn "Nhân vật ghép" để bắt đầu'); return; }
  if (rig) { rigPointer(p, base); return; }
  if (motion) { if (motion.type === 'swing') { motion.pivot = { x: p.x, y: p.y }; motion.pv = motionVec(f.vec, motion.k, motion); requestRender(); } return; }
  if (refEdit) { action = { ...base, kind: 'refmove', last: p }; return; }
  if (floating) { if (floating.c && floatXbStart(p, base)) return; action = { ...base, kind: 'move', last: p }; $('#selbar').classList.add('peek'); return; }
  if (S.tool === 'vedit') { vecStart(p, base); return; }
  if (S.layer === 'vec' && (S.tool === 'brush' || S.tool === 'eraser')) {
    if (!S.showVec) { toast('Lớp Nét đang ẩn — bấm 👁 để hiện'); return; }
    if (S.tool === 'brush') { snapPrepare(); const sp0 = snapPoint(p); action = { ...base, kind: 'vdraw', pts: [sp0], sp: sp0 }; requestRender(); }
    else { action = { ...base, kind: 'verase', before: cloneVec(f.vec), removed: 0 }; vecEraseAt(p); }
    return;
  }
  switch (S.tool) {
    case 'brush': case 'eraser': {
      if (!layerVisible()) { toast('Lớp đang ẩn — bấm 👁 để hiện'); return; }
      const o = activeObj(); if (!o || !o.canvas) return;
      strokeBegin(p, e.timeStamp); action = { ...base, kind: 'stroke' }; break;
    }
    case 'fill': if (e.altKey) { pickBack = 'fill'; doPick(p); break; } if (!layerVisible()) { toast('Lớp đang ẩn'); return; } doFill(p); break;
    case 'pick': if (e.tapAt) { doPick(p); break; } action = { ...base, kind: 'pick', p }; if (e.clientX || e.clientY) pickLoupe(e, pickColorAt(p)); break;   // drag to see the colour, lift to pick it
    case 'lasso': if (selMode() === 'warp' && warpSel && warpSel.f === curFrame() && warpW(warpSel, p.x, p.y) >= 0.5) { warpBegin(p, base); break; } warpSel = null; lasso = [p]; action = { ...base, kind: 'lasso' }; requestRender(); break;
  }
}
function moveAction(e) {
  const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
  const list = evs.length ? evs : [e];
  if (action.kind === 'stroke' && stroke) {
    for (const ev of list) strokePoint(toDoc(ev, action.rect), ev.timeStamp);
    const pr = e.getPredictedEvents ? e.getPredictedEvents() : [];
    stroke.pred = pr.length ? pr.slice(-3).map(ev => toDoc(ev, action.rect)) : null;
  }
  else if (action.kind === 'pick') { action.p = toDoc(e, action.rect); pickLoupe(e, pickColorAt(action.p)); }
  else if (action.kind === 'fxtap') { const p = toDoc(e, action.rect); if (Math.hypot(p.x - action.p.x, p.y - action.p.y) > 24 * DPR / vs) action.moved = true; }
  else if (action.kind === 'ballpath') {
    if (ballMode && ballMode.pts) for (const ev of list) { const p = toDoc(ev, action.rect), l = ballMode.pts[ballMode.pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 4 / vs) ballMode.pts.push(p); }
    requestRender();
  }
  else if (action.kind === 'warp') { const p = toDoc(e, action.rect); warpApply({ x: p.x - action.p0.x, y: p.y - action.p0.y }); requestRender(); }
  else if (action.kind === 'lasso') {
    const p = toDoc(e, action.rect), l = lasso[lasso.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); }
  } else if (action.kind.startsWith('v')) {
    for (const ev of list) vecMove(toDoc(ev, action.rect));
  } else if (action.kind === 'cammove' || action.kind === 'camsize' || action.kind === 'camdraw') {
    const p = toDoc(e, action.rect), f = curFrame(), b = action.b;
    if (action.kind === 'cammove') camSetBox(f, { z: b.z, x: b.cx + p.x - action.p0.x, y: b.cy + p.y - action.p0.y });
    else if (action.kind === 'camsize') camSetBox(f, camCornerBox(b, action.corner, p));
    else { action.r = [Math.min(action.p0.x, p.x), Math.min(action.p0.y, p.y), Math.max(action.p0.x, p.x), Math.max(action.p0.y, p.y)]; if (Math.max(action.r[2] - action.r[0], action.r[3] - action.r[1]) > 40) camSetBox(f, camFromRect(...action.r)); }
    requestRender();
  } else if (action.kind.startsWith('gl')) { glMove(toDoc(e, action.rect));
  } else if (action.kind === 'fxmove') {
    const p = toDoc(e, action.rect); action.t.x += p.x - action.last.x; action.t.y += p.y - action.last.y; action.last = p; requestRender();
  } else if (action.kind === 'labpaint') {
    if (ppSetup) for (const ev of list) { const p = toDoc(ev, action.rect); ppLabDab(ppSetup, action.last, p); action.last = p; }
  } else if (action.kind === 'lablasso') {
    const p = toDoc(e, action.rect), l = lasso[lasso.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); }
  } else if (action.kind === 'ppjoint') {
    const p = toDoc(e, action.rect), mv = (j, dx, dy) => { ppSetup.J[j].x += dx; ppSetup.J[j].y += dy; (RKIDS[j] || []).forEach(k => mv(k, dx, dy)); };
    mv(action.j, p.x - action.last.x, p.y - action.last.y); action.last = p; requestRender();
  } else if (action.kind.startsWith('hc')) {
    hcMove(toDoc(e, action.rect));
  } else if (action.kind.startsWith('pp')) {
    ppMove(toDoc(e, action.rect));
  } else if (action.kind === 'rjoint') {
    const p = toDoc(e, action.rect); rigMoveJoint(action.j, p.x - action.last.x, p.y - action.last.y); action.last = p; if (rig) rig.pose = null; requestRender();
  } else if (action.kind === 'refmove') {
    const p = toDoc(e, action.rect); REF.cx += p.x - action.last.x; REF.cy += p.y - action.last.y; action.last = p; requestRender();
  } else if (action.kind === 'flxb') { floatXbMove(toDoc(e, action.rect));
  } else if (action.kind === 'move' && floating) {
    const p = toDoc(e, action.rect); floating.cx += p.x - action.last.x; floating.cy += p.y - action.last.y; action.last = p; requestRender();
  }
}
function endAction() {
  if (!action) return;
  $('#selbar').classList.remove('peek');
  if (action.kind === 'fxtap') { const a = action; action = null; if (!a.moved) startAction({ clientX: 0, clientY: 0, pointerType: 'touch', pointerId: a.id, tapAt: a.p }, false); action = null; return; }
  if (action.kind === 'pick') { const p = action.p; action = null; doPick(p); return; }
  if (action.kind.startsWith('gl')) { glEnd(); return; }
  if (action.kind === 'stroke') strokeEnd();
  else if (action.kind === 'refmove') scheduleSave();
  else if (action.kind === 'rjoint') { scheduleSave(); rigPreview(); }
  else if (action.kind.startsWith('cam')) {
    const f = curFrame(), af = fxState(f);
    if (JSON.stringify(af.cam) !== JSON.stringify(action.before.cam)) { pushEntry({ t: targetOf(f), fxe: true, before: action.before, after: af, bytes: 400 }); f.ver++; scheduleSave(); }
    else if (action.kind === 'camdraw' && performance.now() - action.t0 < 400) toast('Kéo một khung quanh chỗ muốn quay (vd. người + TV) — camera sẽ zoom vừa khung đó', 3000);
    action = null; fxSyncBar(); requestRender(); return;
  }
  else if (action.kind === 'fxmove') { const f = curFrame(); pushEntry({ t: targetOf(f), fxe: true, before: action.before, after: fxState(f), bytes: 400 }); f.ver++; scheduleSave(); }
  else if (action.kind.startsWith('hc')) hcEnd();
  else if (action.kind.startsWith('pp') && action.kind !== 'ppjoint') ppEnd();
  else if (action.kind.startsWith('v')) vecEnd();
  else if (action.kind === 'lablasso') { const poly = lasso; lasso = null; if (ppSetup) { ppLabLasso(ppSetup, poly); ppLabSyncBar(); } requestRender(); }
  else if (action.kind === 'labpaint') { if (ppSetup) ppLabSyncBar(); }
  else if (action.kind === 'ballpath') { const pts = ballMode && ballMode.pts; ballMode = null; ballSyncBar(); requestRender(); ballRun(pts); }
  else if (action.kind === 'lasso') { const poly = lasso; lasso = null; if (poly && poly.length > 2) liftSelection(poly); requestRender(); updUndoBtns(); }
  else if (action.kind === 'warp') { warpEnd(false); updUndoBtns(); }
  action = null;
}
function abortAction() {
  if (!action) return;
  $('#selbar').classList.remove('peek');
  if (action.kind === 'stroke') strokeAbort();
  if (action.kind === 'pick') pickLoupe(null);
  if (action.kind === 'lasso' || action.kind === 'vlasso') { lasso = null; requestRender(); }
  if (action.kind === 'warp') warpEnd(true);
  glAbort();
  if (action.kind === 'ballpath' && ballMode) { ballMode.pts = null; requestRender(); }
  if (action.kind === 'vbend' || action.kind === 'vmove' || action.kind === 'verase' || action.kind === 'vmulti' || action.kind === 'vxform') { if (action.col) colLiftAbort(curFrame(), action.col); curFrame().vec = action.before; if (action.kind === 'vmulti' && action.polyBase) vpoly = action.polyBase; requestRender(); }
  if (action.kind === 'pprot' || action.kind === 'ppmove' || action.kind === 'ppik') { ppSetState(curFrame(), action.before); requestRender(); }
  if (action.kind === 'hcjoint' && action.r) action.r.jm = action.jm0 || null;
  if (action.kind === 'hcpaint' && HC && action.before) { hcPaintUndo(action.before); requestRender(); }
  if (action.kind === 'hclasso' || action.kind === 'ppcut' || action.kind === 'pppatch' || action.kind === 'pppath') { lasso = null; lassoOpen = false; requestRender(); }
  if ((action.kind === 'fxmove' || action.kind.startsWith('cam')) && action.before) { fxSetState(curFrame(), action.before); fxSyncBar(); requestRender(); }
  if ((action.kind === 'labpaint' || action.kind === 'lablasso') && ppSetup) { lasso = null; if (ppSetup.undo.length) ppSetup.hand = ppSetup.undo.pop(); ppLabOverlay(ppSetup); requestRender(); }
  action = null;
}
function gestureBase() {
  const rect = view.getBoundingClientRect(), pts = [...touches.values()];
  const g = gesture || { t0: performance.now(), max: 0, moved: false, starts: new Map() };
  for (const [id, p] of touches) if (!g.starts.has(id)) g.starts.set(id, { x: p.x, y: p.y });
  g.max = Math.max(g.max, touches.size); g.rect = rect; g.s0 = vs; g.r0 = vr; g.tx0 = vtx; g.ty0 = vty; g.rotating = false;
  if (pts.length >= 2) { g.m0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; g.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1; g.a0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x); }
  else if (pts.length === 1) { g.m0 = { x: pts[0].x, y: pts[0].y }; g.d0 = 1; }
  gesture = g;
}
function gestureMove() {
  const g = gesture, pts = [...touches.values()]; if (!pts.length) return;
  for (const [id, p] of touches) { const s = g.starts.get(id); if (s && Math.hypot(p.x - s.x, p.y - s.y) > 12) g.moved = true; }
  if (pts.length === 1) { vtx = g.tx0 + (pts[0].x - g.m0.x) * DPR; vty = g.ty0 + (pts[0].y - g.m0.y) * DPR; }
  else {
    const m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const ns = clamp(g.s0 * d / g.d0, fitS * 0.25, fitS * ZOOM_MAX);
    const doc = scrToDocWith((g.m0.x - g.rect.left) * DPR, (g.m0.y - g.rect.top) * DPR, g.s0, g.r0, g.tx0, g.ty0);
    let dr = wrapRad(Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) - g.a0);
    if (S.rotGesture !== false && (g.rotating || Math.abs(dr) > 12 * DEG)) { g.rotating = true; let nr = g.r0 + dr; const q = Math.round(nr / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(nr - q) < 6 * DEG) nr = q; vr = nr; } else vr = g.r0;
    vs = ns; setViewAnchor(doc.x, doc.y, (m.x - g.rect.left) * DPR, (m.y - g.rect.top) * DPR);
  }
  requestRender();
}
let penSeen = false, fingerHinted = false;
// without "Ngón tay cũng vẽ" one finger pans the view; but these are touch-first actions (the buttons even say "chạm lên khung"),
// so one finger does them: picking a spot for 🔍 Cận cảnh / combos, drawing ⚽ / 〰 paths, dragging texts, the camera box, puppet parts and joints
function fingerActs(e) {
  const f = curFrame(); if (!f || !f.canvas) return false;
  const p = toDoc(e, view.getBoundingClientRect());
  if (S.tool === 'pick') return true;   // 💧 Dò màu: the finger picks (drag to see the colour, lift to take it)
  // the 8 handles + rotate knob of a ⬚ box stick out past the picture: a finger on them works the box instead of panning
  if (floating) { const k = floating.c && xbHit(floatXbox(), p, true); return !!k && k !== 'in'; }
  if (HC && S.tool === 'puppet') return !!hcHitJoint(p);
  if (plPin && S.tool === 'puppet') return true;   // 📍 Kho bộ phận: a finger tap places the part
  if (ppSetup) { if (ppSetup.stage === 'paint') return false; const tol = 24 * DPR / vs; return RJ.some(j => Math.hypot(ppSetup.J[j].x - p.x, ppSetup.J[j].y - p.y) <= tol); }
  if (S.tool === 'fx') {
    if (ballMode || gagMode || camPresetMode || fxCamPick || fxHit(f, p)) return true;
    if (glOn() && (glPick || glHit(f, p))) return true;
    if (TABS.fx === 'cam' && !panelHidden.fx) { const b = camBox(camEditBox(S.cur)), tol = 30 * DPR / vs; return [[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sy]) => Math.hypot(p.x - (b.cx + sx * b.hw), p.y - (b.cy + sy * b.hh)) <= tol) || (b.z > 1.001 && Math.abs(p.x - b.cx) < b.hw && Math.abs(p.y - b.cy) < b.hh); }
    return false;
  }
  if (S.tool === 'puppet' && S.pp && !rig && !motion) {
    if (ppPathMode || jgMode) return true;
    if (bwMode) return bwHitPin(p, f) || !!ppHit(p, ppPoseFor(f));
    if ((ppPaint || ppJEOn()) && ppPrevHit(p, f)) return true;
    if (ppPaint) return ppPaint === 'sel' || ppPaint === 'fill' || ppPaint === 'pick';   // taps work with a finger; brush/eraser strokes need the pen (or 'Ngón tay cũng vẽ')
    if (ppCutMode || ppPatchMode) return false;
    if (ppJEOn()) return !!ppJEHit(p, f) || !!ppHit(p, ppPoseFor(f));
    const sel = ppDrag === 'box' && ppPart(ppSel), b = sel && ppBoxOf(f, ppCharOf(sel) || sel.id);
    if (ppDrag === 'bone') { const lk = ppLeanKnob(f); if (lk && Math.hypot(lk.x - p.x, lk.y - p.y) <= 24 * DPR / vs) return true; }
    return !!(b && xbHit(b, p, true)) || !!ppHit(p, ppPoseFor(f));
  }
  return false;
}
// one quick finger tap with Đổ màu fills there (one finger still pans when it drags), even without "Ngón tay cũng vẽ"
function fingerTap(g) {
  const s = [...g.starts.values()][0]; if (!s || !g.rect) return;
  vtx = g.tx0; vty = g.ty0;   // undo the few pixels the tap may have panned
  const p = scrToDoc((s.x - g.rect.left) * DPR, (s.y - g.rect.top) * DPR);
  startAction({ clientX: 0, clientY: 0, pointerType: 'touch', pointerId: -1, tapAt: { ...p, p: 1 } }, true); requestRender();
}
function gestureEnd() {
  const g = gesture; gesture = null; if (!g) return;
  // a beginner without a stylus drags one finger to draw and the drawing only slides: say how to draw with a finger (once)
  if (g.max === 1 && g.moved && !penSeen && !fingerHinted && !S.fingerDraw && ['brush', 'eraser', 'lasso'].includes(S.tool)) { fingerHinted = true; toast('1 ngón tay dùng để kéo khung vẽ. Không có bút? Vào ☰ Menu → bật “Ngón tay cũng vẽ”', 5000); }
  if (!g.moved && performance.now() - g.t0 < 400) { if (g.max === 2) undo(); else if (g.max >= 3) redo(); else if (g.max === 1 && S.tool === 'fill') fingerTap(g); }
}
view.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { view.setPointerCapture(e.pointerId); } catch (_) {}
  if (playing) { stopPlay(); return; }
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (action) {
      if (action.touch && performance.now() - action.t0 < 350) { abortAction(); gesture = null; gestureBase(); }
      return; // pen is drawing: ignore palm
    }
    if (gesture) { gestureBase(); return; }
    if (touches.size === 1 && (S.fingerDraw || fingerActs(e))) { startAction(e, true); return; }
    gestureBase(); return;
  }
  if (e.pointerType === 'pen') penSeen = true;
  if (e.pointerType === 'mouse' && e.button !== 0) { mousePan = { x: e.clientX, y: e.clientY, tx: vtx, ty: vty }; return; }
  gesture = null;
  if (action) return;
  startAction(e, false);
});
view.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (action && action.touch && action.id === e.pointerId) { moveAction(e); return; }
    if (gesture) gestureMove();
    return;
  }
  if (mousePan) { vtx = mousePan.tx + (e.clientX - mousePan.x) * DPR; vty = mousePan.ty + (e.clientY - mousePan.y) * DPR; requestRender(); return; }
  if (action && action.id === e.pointerId) moveAction(e);
});
function onUp(e, cancelled) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.delete(e.pointerId);
    if (action && action.touch && action.id === e.pointerId) { cancelled ? abortAction() : endAction(); return; }
    if (gesture) { if (touches.size === 0) gestureEnd(); else gestureBase(); }
    return;
  }
  if (mousePan) { mousePan = null; return; }
  if (action && action.id === e.pointerId) endAction();
}
view.addEventListener('pointerup', e => onUp(e, false));
view.addEventListener('pointercancel', e => onUp(e, true));
view.addEventListener('contextmenu', e => e.preventDefault());
view.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = view.getBoundingClientRect(), mx = (e.clientX - rect.left) * DPR, my = (e.clientY - rect.top) * DPR;
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    const ns = clamp(vs * Math.exp(-e.deltaY * 0.0015), fitS * 0.25, fitS * ZOOM_MAX), doc = scrToDoc(mx, my);
    vs = ns; setViewAnchor(doc.x, doc.y, mx, my);
  } else { vtx -= e.deltaX * DPR; }
  requestRender();
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
// block page pan / pinch-zoom over the drawing area, but let the panels on it (bảng Ghép, Chữ & FX, Layer…) scroll with a finger
function touchScrollable(el, stop) {
  for (; el && el !== stop && el.nodeType === 1; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}
document.addEventListener('touchmove', e => {
  const st = e.target.closest && e.target.closest('#stage'); if (!st) return;
  if (e.touches.length === 1 && touchScrollable(e.target, st)) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false });

