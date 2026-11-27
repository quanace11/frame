/* ===== ✎ Vẽ lại mảnh: brush / eraser / fill / colour picker on a part's own picture =====
   The picture belongs to the part (or to the alternative picture this frame shows, `alts`), so a fix (a wrong shoe, a leg)
   shows on every frame that uses it and still moves with the rig. Each stroke builds a NEW canvas with room around the
   picture (so a longer shoe can be drawn past the old edge), then crops it to what is drawn; the old canvas + position are
   kept in the undo entry (`partpix`). Brush strokes use the real brush engine (pressure, brush type, Độ đậm). */
let ppPaint = null, ppPaintFocus = null, ppPaintTop = true;
const PP_PAINT_TOOLS = ['sel', 'brush', 'erase', 'fill', 'pick'];
const ppPaintFocusId = () => ppPaint && ppPaintTop && S.tool === 'puppet' && !playing && ppPart(ppSel) ? ppSel : null;
function ppHolderOf(p, vi) { return vi ? p.alts && p.alts[vi - 1] : p; }
function ppHolderGet(p, vi) { const h = ppHolderOf(p, vi); ppAlphaH(h); return { c: h.c, png: h.png, alpha: h.alpha, padded: !!h.padded, x: vi ? h.dx || 0 : p.ox, y: vi ? h.dy || 0 : p.oy }; }
// alt pictures sit at p.ox + a.dx: moving the main picture's origin keeps them where they were
function ppHolderSet(p, vi, st) {
  const h = ppHolderOf(p, vi); if (!h) return null;
  if (vi) { h.dx = st.x; h.dy = st.y; }
  else { const ddx = st.x - p.ox, ddy = st.y - p.oy; p.ox = st.x; p.oy = st.y; for (const a of p.alts || []) { a.dx = (a.dx || 0) - ddx; a.dy = (a.dy || 0) - ddy; } }
  h.c = st.c; h.png = st.png; h.alpha = st.alpha || null; h.padded = st.padded;
  return h;
}
function ppPaintRefresh() { S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); ppSyncBar(); requestRender(); }
function ppPaintApply(e, key) {   // undo / redo
  const pt = ppPart(e.pid), st = e[key]; if (!pt || !ppHolderOf(pt, e.vi)) return;
  const h = ppHolderSet(pt, e.vi, st); st.alpha = ppAlphaH(h);
  if (!st.png) encodeHolder(h).then(() => { if (h.c === st.c) st.png = h.png; });
  ppPaintRefresh(); scheduleSave();
}
function ppPaintCommit(sel, vi, st0, st1) {
  const h = ppHolderSet(sel, vi, st1); st1.alpha = ppAlphaH(h);
  const e = { partpix: true, pid: sel.id, vi, before: st0, after: st1, bytes: 4 * (st0.c.width * st0.c.height + st1.c.width * st1.c.height) };
  pushEntry(e); ppPaintRefresh();
  // the PNG is ready a moment later: cover it too, so it does not become a 2nd (automatic) undo step
  toBlob(st1.c).then(b => b.arrayBuffer()).then(buf => { st1.png = buf; if (h.c === st1.c) h.png = buf; histCover(e); scheduleSave(); });
}
function ppPaintCtx(sel, f) {
  const P = ppPoseFor(f), q = P && P[sel.id], im = ppImg(sel, q), M = ppMats(P)[sel.id];
  return { im, vi: im.vi, inv: mInv(M), sc: Math.hypot(M[0], M[1]) || 1 };
}
function ppPaintOp(erase, B) {
  const k = erase ? 'e:' + (ERASERS[S.eraserType] ? S.eraserType : 'hard') : BRUSHES[S.brush] ? S.brush : 'pen', v = (S.brushOp || {})[k];
  const op = clamp(v != null ? v : opDefault(k), 0.05, 1);
  return erase || B.kind !== 'dab' ? op : Math.min(1, op / (B.op0 || 1));
}
function ppPaintStart(p, base, f) {
  if (ppPaint === 'sel') {
    const hit = ppHit(p, ppPoseFor(f), true); if (!hit) { toast('Chạm vào đúng mảnh cần sửa'); return; }
    ppSel = hit.id; ppPaint = 'brush'; ppSyncBar(); requestRender(); toast('Đang sửa: ' + hit.name + ' — vẽ bằng bút, xong bấm ✓ Xong', 2500); return;
  }
  const sel = ppPart(ppSel); if (!sel) { ppPaint = 'sel'; ppSyncBar(); toast('Chạm vào mảnh cần sửa trước'); return; }
  const C = ppPaintCtx(sel, f), im = C.im, l = mApply(C.inv, p.x, p.y), x = Math.floor(l.x - im.x), y = Math.floor(l.y - im.y);
  if (ppPaint === 'pick') { ppPaintPick(im.c, x, y); return; }
  if (ppPaint === 'fill') { ppPaintFill(sel, C, x, y); return; }
  const erase = ppPaint === 'erase', B = brushOf(erase ? 'eraser' : 'brush'), size = bsz() / C.sc, st0 = ppHolderGet(sel, C.vi);
  const w0 = im.c.width, h0 = im.c.height, MG = Math.ceil(Math.max(160, size * 3, 0.5 * Math.max(w0, h0)));
  const ww = Math.max(w0, Math.min(4096, w0 + MG * 2)), hh = Math.max(h0, Math.min(4096, h0 + MG * 2)), mx = (ww - w0) >> 1, my = (hh - h0) >> 1;
  const bc = makeCanvas(ww, hh), ink = makeCanvas(ww, hh), out = makeCanvas(ww, hh); bc.getContext('2d').drawImage(im.c, mx, my);
  const ax = im.x - mx, ay = im.y - my;   // where the work canvas sits, in the part's own (rest) coordinates
  ppHolderSet(sel, C.vi, { c: out, png: st0.png, alpha: null, padded: true, x: C.vi ? ax - sel.ox : ax, y: C.vi ? ay - sel.oy : ay });
  const eng = makeBrushEngine(ink.getContext('2d'), { brush: B, color: S.color, size, pressure: S.pressure, flowK: B.kind === 'dab' && !erase ? Math.max(1, ppPaintOp(false, { kind: 'line' }) / (B.op0 || 1)) : 1, smooth: S.smooth, erase });
  action = { ...base, kind: 'pppaint', part: sel, vi: C.vi, st0, eng, bc, ink, out, ax, ay, inv: C.inv, erase, op: ppPaintOp(erase, B) };
  eng.add({ x: l.x - ax, y: l.y - ay, p: p.p }, performance.now()); ppPaintCompose(action);
  if (!erase) addRecentColor(S.color);
}
function ppPaintCompose(a) {
  const x = a.out.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.drawImage(a.bc, 0, 0);
  x.globalCompositeOperation = a.erase ? 'destination-out' : 'source-over'; x.globalAlpha = a.op; x.drawImage(a.ink, 0, 0); x.restore();
  const h = ppHolderOf(a.part, a.vi); if (h) h.alpha = null; requestRender();
}
function ppPaintMove(a, p) { const l = mApply(a.inv, p.x, p.y); a.eng.add({ x: l.x - a.ax, y: l.y - a.ay, p: p.p }, performance.now()); ppPaintCompose(a); }
// crop to what is drawn (+2 px); an all-erased picture keeps a 1×1 transparent canvas
function ppPaintTrim(c) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { c: makeCanvas(1, 1), x: 0, y: 0 };
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
  const o = makeCanvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, -x0, -y0); return { c: o, x: x0, y: y0 };
}
function ppPaintEnd(a) {
  a.eng.end(); ppPaintCompose(a);
  const t = ppPaintTrim(a.out), sel = a.part, ox = a.ax + t.x, oy = a.ay + t.y;
  ppPaintCommit(sel, a.vi, a.st0, { c: t.c, png: null, alpha: null, padded: false, x: a.vi ? ox - sel.ox : ox, y: a.vi ? oy - sel.oy : oy });
}
function ppPaintPick(c, x, y) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) { toast('Chạm vào bên trong mảnh để lấy màu'); return; }
  const d = c.getContext('2d').getImageData(x, y, 1, 1).data; if (d[3] < 20) { toast('Chỗ này trong suốt — chạm vào chỗ có màu'); return; }
  setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')); ppPaint = 'brush'; ppSyncBar(); toast('Đã lấy màu — vẽ tiếp bằng 🖌 Bút', 1800);
}
// flood fill one area of the part's picture; a transparent hole only when a line closes it (not the outside)
function ppPaintFill(sel, C, x, y) {
  const o = ppFillCanvas(C.im.c, x, y); if (!o) return;
  const st0 = ppHolderGet(sel, C.vi);
  ppPaintCommit(sel, C.vi, st0, { c: o, png: null, alpha: null, padded: st0.padded, x: st0.x, y: st0.y }); addRecentColor(S.color);
}
// the filled copy of picture c (a new canvas, the old one is kept for undo); null = nothing to fill there (a toast says why)
function ppFillCanvas(c, x, y) {
  const w = c.width, h = c.height;
  if (x < 0 || y < 0 || x >= w || y >= h) { toast('Chạm vào bên trong mảnh để đổ màu'); return null; }
  const id = c.getContext('2d').getImageData(0, 0, w, h), d = id.data, i0 = (y * w + x) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], hole = d[i0 + 3] < 40;
  const same = k => hole ? d[k * 4 + 3] < 40 : d[k * 4 + 3] >= 40 && Math.abs(d[k * 4] - r0) <= 64 && Math.abs(d[k * 4 + 1] - g0) <= 64 && Math.abs(d[k * 4 + 2] - b0) <= 64;
  const m = new Uint8Array(w * h), stack = [y * w + x]; m[stack[0]] = 1; let edge = false;
  while (stack.length) {
    const j = stack.pop(), xx = j % w, yy = (j - xx) / w;
    if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) edge = true;
    if (xx > 0 && !m[j - 1] && same(j - 1)) { m[j - 1] = 1; stack.push(j - 1); }
    if (xx < w - 1 && !m[j + 1] && same(j + 1)) { m[j + 1] = 1; stack.push(j + 1); }
    if (yy > 0 && !m[j - w] && same(j - w)) { m[j - w] = 1; stack.push(j - w); }
    if (yy < h - 1 && !m[j + w] && same(j + w)) { m[j + w] = 1; stack.push(j + w); }
  }
  if (hole && edge) { toast('Chỗ này nằm ngoài hình — chạm vào bên trong 1 vùng có viền bao quanh', 3000); return null; }
  const [R, G, Bc] = hexToRgb(S.color);
  for (let j = 0; j < w * h; j++) {
    if (m[j]) { d[j * 4] = R; d[j * 4 + 1] = G; d[j * 4 + 2] = Bc; d[j * 4 + 3] = 255; continue; }
    // a hole: the soft edge of the line around it is laid over the new colour, so no light ring stays
    if (hole && d[j * 4 + 3] < 255 && ((j % w > 0 && m[j - 1]) || (j % w < w - 1 && m[j + 1]) || (j >= w && m[j - w]) || (j < w * h - w && m[j + w]))) {
      const s = d[j * 4 + 3] / 255; d[j * 4] = d[j * 4] * s + R * (1 - s); d[j * 4 + 1] = d[j * 4 + 1] * s + G * (1 - s); d[j * 4 + 2] = d[j * 4 + 2] * s + Bc * (1 - s); d[j * 4 + 3] = 255;
    }
  }
  const o = makeCanvas(w, h); o.getContext('2d').putImageData(id, 0, 0); return o;
}
function ppPaintSync(sel) {
  const bar = $('#ppPaintBar'); bar.hidden = !ppPaint;
  ['#ppPaintBtn', '#ppPaintBtn2'].forEach(id => $(id).classList.toggle('on', !!ppPaint && ppPaint !== 'erase'));
  $('#ppEraseBtn').classList.toggle('on', ppPaint === 'erase');
  if (!ppPaint) return;
  bar.querySelectorAll('[data-ppt]').forEach(b => b.classList.toggle('on', b.dataset.ppt === ppPaint));
  $('#ppPaintTop').checked = ppPaintTop;
  const root = sel && (ppCharOf(sel) || sel.id), parts = S.pp.parts.filter(q => !root || (ppCharOf(q) || q.id) === root).sort((a, b) => b.z - a.z);
  $('#ppPaintPart').innerHTML = (sel ? '' : '<option value="" selected>— chạm chọn mảnh —</option>') + parts.map(q => `<option value="${q.id}" ${q.id === ppSel ? 'selected' : ''}>${q.name.replace(/</g, '&lt;')}</option>`).join('');
}
function ppPaintGo(tool) {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật ghép'); return; }
  if (ppPaint && (tool === ppPaint || (tool === 'brush' && ppPaint !== 'erase'))) { ppPaint = null; ppSyncBar(); requestRender(); return; }
  const sel = ppPart(ppSel), isGroup = sel && ppDrag === 'box' && S.pp.parts.some(q => q.parent === sel.id);
  ppCutMode = ppPatchMode = ppPathMode = false;
  ppPaint = !sel || (isGroup && tool === 'brush') ? 'sel' : tool;
  ppSyncBar(); requestRender();
  if (ppPaint === 'sel') toast('Chạm vào mảnh cần vẽ lại (vd. giày, ống chân) — hoặc chọn trong ô bên trái', 3500);
  else toast('Vẽ lên ' + sel.name + ' bằng bút, màu, cỡ đang chọn ở thanh trên. Mọi frame đều đổi theo', 3500);
}
$('#ppPaintBtn').addEventListener('click', () => ppPaintGo('brush'));
$('#ppPaintBtn2').addEventListener('click', () => ppPaintGo('brush'));
$('#ppEraseBtn').addEventListener('click', () => ppPaintGo('erase'));
document.querySelectorAll('[data-ppt]').forEach(b => b.addEventListener('click', () => { if (PP_PAINT_TOOLS.includes(b.dataset.ppt)) { ppPaint = b.dataset.ppt; ppSyncBar(); requestRender(); } }));
$('#ppPaintPart').addEventListener('change', e => { if (!e.target.value) return; ppSel = e.target.value; if (ppPaint === 'sel') ppPaint = 'brush'; ppSyncBar(); requestRender(); });
$('#ppPaintTop').addEventListener('change', e => { ppPaintTop = e.target.checked; requestRender(); });
$('#ppPaintUndo').addEventListener('click', () => undo());
$('#ppPaintRedo').addEventListener('click', () => redo());
$('#ppPaintDone').addEventListener('click', () => { ppPaint = null; ppSyncBar(); requestRender(); });
