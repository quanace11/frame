/* ===== 🔗 Sửa cả nhóm cho nhiều frame (like Animate's "Edit multiple frames") =====
   S.ppScope = 'one' (only this frame, as before) / 'after' (this frame + every later frame) / 'all' (every frame).
   A ⬚ Cả nhóm edit (move, resize, stretch, turn) or dragging the root in 🦴 Tạo dáng is first done live on this frame;
   when the finger lifts, the same change is applied to the layer's other keyframes in the range: each frame keeps its
   own pose, the character is scaled/turned around its own feet (bottom-middle of its box on that frame) and moved by the
   same amount. Tweened frames follow through ppRetween. One undo step (multi of ppose).
   📐 Cỡ frame này cho frame khác (ppSizeSync): the character gets this frame's size on the other keyframes, feet stay put. */
S.ppScope = 'one';
const PP_SCOPE_LABEL = { one: 'chỉ frame này', after: 'frame này + các frame sau', all: 'mọi frame' };
function ppScopeIdx(scope, cur) {
  const out = []; for (let i = 0; i < S.frames.length; i++) if (i !== cur && (scope === 'all' || (scope === 'after' && i > cur))) out.push(i);
  return out;
}
// the point that stays put on frame g: bottom-middle of the layer's box (its feet), in the root's own space
function ppFeetLocal(g, rid) {
  const b = ppBoxOf(g, rid), r = ppPart(rid);
  return b ? { x: (b.x0 + b.x1) / 2, y: b.y1 } : { x: r.px, y: r.py };
}
const ppSv = v => v == null ? 1 : v;
// change the root pose q of frame g: scale ×kx/×ky, turn +dr, then shift so the feet land at (feet before + t)
function ppRootChange(g, rid, kx, ky, dr, t, setS) {
  const a = ppFeetLocal(g, rid), w0 = mApply(ppMats(g.pp)[rid], a.x, a.y), q = ppQ(g, rid);
  if (setS) { if (setS.sx == null) delete q.sx; else q.sx = setS.sx; if (setS.sy == null) delete q.sy; else q.sy = setS.sy; }
  else {
    if (Math.abs(kx - 1) > 1e-6) q.sx = ppSv(q.sx) * kx;
    if (Math.abs(ky - 1) > 1e-6) q.sy = ppSv(q.sy) * ky;
  }
  if (Math.abs(dr) > 1e-6) q.r = (q.r || 0) + dr;
  const w1 = mApply(ppMats(g.pp)[rid], a.x, a.y);
  q.dx = (q.dx || 0) + w0.x + t.x - w1.x; q.dy = (q.dy || 0) + w0.y + t.y - w1.y;
  g.ver++; markEdited(g); queueThumbFor(g);
}
// called by ppEnd after the edit on this frame was done; returns the extra undo entries for the other frames
function ppScopeSpread(f, rid, beforePP) {
  if (S.ppScope === 'one' || !rid || S.frames.length < 2) return [];
  const cur = S.frames.indexOf(f), q0 = (beforePP && beforePP[rid]) || {}, q1 = (f.pp && f.pp[rid]) || {};
  const kx = ppSv(q1.sx) / ppSv(q0.sx), ky = ppSv(q1.sy) / ppSv(q0.sy), dr = (q1.r || 0) - (q0.r || 0);
  const a = ppFeetLocal(f, rid), A0 = mApply(ppMats(beforePP)[rid], a.x, a.y), A1 = mApply(ppMats(f.pp)[rid], a.x, a.y), t = { x: A1.x - A0.x, y: A1.y - A0.y };
  const out = [];
  for (const i of ppScopeIdx(S.ppScope, cur)) {
    const g = S.frames[i]; if (!ppLayerKey(g, rid)) continue;
    const before = ppState(g); ppRootChange(g, rid, kx, ky, dr, t); out.push(ppEntry(g, before, ppState(g)));
  }
  return out;
}
function ppScopeSet(sc) {
  S.ppScope = PP_SCOPE_LABEL[sc] ? sc : 'one'; ppScopeSync();
  if (S.ppScope !== 'one') toast(`⬚ Cả nhóm: dời, phóng to/thu nhỏ, xoay nhân vật sẽ áp cho ${PP_SCOPE_LABEL[S.ppScope]}`, 3000);
}
// the row only means something with 2+ frames (it also keeps the Ghép bar short on an upright tablet)
function ppScopeSync() { document.querySelectorAll('[data-ppsc]').forEach(b => b.classList.toggle('on', b.dataset.ppsc === S.ppScope)); const r = $('#ppScopeRow'); if (r) r.classList.toggle('solo', S.frames.length < 2); }
async function ppSizeSync() {
  const f = curFrame(), sel = ppPart(ppSel), rid = sel && (ppCharOf(sel) || sel.id);
  if (!rid) { toast('Chạm chọn nhân vật / hình trước'); return; }
  if (S.frames.length < 2) { toast('Mới có 1 frame'); return; }
  let sc = null;
  await modal({ title: '📐 Cỡ frame này cho frame khác', html: `<p>"${lyrName(ppPart(rid))}" sẽ to/nhỏ đúng như ở frame này. Mỗi frame giữ dáng, chỗ đứng (chân) và hướng xoay của nó.</p>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Các frame sau', action: () => { sc = 'after'; } }, { label: 'Mọi frame', primary: true, action: () => { sc = 'all'; } }] });
  if (!sc) return;
  commitFloating(); histFlush();
  const q = (f.pp && f.pp[rid]) || {}, setS = { sx: q.sx, sy: q.sy }, list = [];
  for (const i of ppScopeIdx(sc, S.cur)) {
    const g = S.frames[i]; if (!ppLayerKey(g, rid)) continue;
    const gq = (g.pp && g.pp[rid]) || {}; if (ppSv(gq.sx) === ppSv(q.sx) && ppSv(gq.sy) === ppSv(q.sy)) continue;
    const before = ppState(g); ppRootChange(g, rid, 1, 1, 0, { x: 0, y: 0 }, setS); list.push(ppEntry(g, before, ppState(g)));
  }
  if (!list.length) { toast('Các frame đã cùng cỡ với frame này'); return; }
  pushEntry(list.length > 1 ? { multi: list } : list[0]); ppRetween(); updateFrameUI(); requestRender();
  toast(`📐 Đã đổi cỡ ở ${list.length} keyframe — chạm 2 ngón để hoàn tác`, 2500);
}
document.querySelectorAll('[data-ppsc]').forEach(b => b.addEventListener('click', () => ppScopeSet(b.dataset.ppsc)));
$('#ppSizeSync').addEventListener('click', ppSizeSync);
ppScopeSync();
