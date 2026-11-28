/* ===== 🧩 Vẽ nhiều mảnh một lần (✎ Vẽ lại mảnh on 2–3 parts at once) =====
   Joints of a cut-out tear a little when they bend: pick the pieces around the tear (upper arm + forearm, or the body +
   a thigh) and paint over the seam in one go. Each stroke is drawn in frame space, then every stroke pixel goes to the
   picked piece showing there (the top one), or, over empty space, to the piece whose bone is nearest; the eraser rubs all
   picked pieces under it. Every touched piece gets a NEW canvas (padded, then cropped like ✎ Vẽ lại mảnh) → one undo
   step (`multi` of `partpix`). `tests/test_ve_nhieu_manh.py`. */
const ppPG = new Set();
const ppPGActive = () => ppPG.size >= 2 && [...ppPG].every(id => ppPart(id));
function ppPGTap(p, f) {
  const hit = ppHit(p, ppPoseFor(f), true); if (!hit) { toast('Chạm vào mảnh muốn thêm vào nhóm'); return; }
  if (ppPG.has(hit.id)) ppPG.delete(hit.id); else ppPG.add(hit.id);
  ppSel = hit.id; ppSyncBar(); requestRender();
  toast(ppPG.size >= 2 ? `Nhóm ${ppPG.size} mảnh: ${[...ppPG].map(id => ppPart(id).name).join(', ')} — bấm 🖌 Bút hoặc ⌫ Tẩy rồi vẽ qua chỗ nối` : 'Chạm thêm 1–2 mảnh nằm cạnh (vd. bắp tay + cẳng tay)', 3000);
}
// the bone of a piece in frame space (pivot → its first child's pivot, else its tip)
function ppPGBone(p, M) {
  const kid = S.pp.parts.find(q => q.parent === p.id), t = kid ? { x: kid.px, y: kid.py } : ppTipOf(p);
  return [mApply(M[p.id], p.px, p.py), mApply(M[p.id], t.x, t.y)];
}
function ppPGStart(p, base, f) {
  const erase = ppPaint === 'erase', B = brushOf(erase ? 'eraser' : 'brush'), size = bsz();
  const ink = makeCanvas(W, H);
  const eng = makeBrushEngine(ink.getContext('2d'), { brush: B, color: S.color, size, pressure: S.pressure, flowK: B.kind === 'dab' && !erase ? Math.max(1, ppPaintOp(false, { kind: 'line' }) / (B.op0 || 1)) : 1, smooth: S.smooth, erase: false });
  action = { ...base, kind: 'pppaint', group: true, eng, ink, erase, op: ppPaintOp(erase, B), f, pad: size * 2 + 8, box: [p.x, p.y, p.x, p.y] };
  eng.add({ x: p.x, y: p.y, p: p.p }, performance.now()); requestRender();
  if (!erase) addRecentColor(S.color);
}
function ppPGMove(a, p) {
  a.eng.add({ x: p.x, y: p.y, p: p.p }, performance.now());
  a.box = [Math.min(a.box[0], p.x), Math.min(a.box[1], p.y), Math.max(a.box[2], p.x), Math.max(a.box[3], p.y)]; requestRender();
}
function ppPGEnd(a) {
  a.eng.end();
  const bx = Math.max(0, Math.floor(a.box[0] - a.pad)), by = Math.max(0, Math.floor(a.box[1] - a.pad)), bw = Math.min(W, Math.ceil(a.box[2] + a.pad)) - bx, bh = Math.min(H, Math.ceil(a.box[3] + a.pad)) - by;
  const done = () => { action = null; requestRender(); };
  if (bw < 1 || bh < 1) return done();
  const ink = a.ink.getContext('2d').getImageData(bx, by, bw, bh).data, n = bw * bh;
  const P = ppPoseFor(a.f), M = ppMats(P), group = [...ppPG].map(ppPart).filter(q => q && q.c && !(P && P[q.id] && P[q.id].h)).sort((u, v) => v.z - u.z);
  if (!group.length) return done();
  // where each picked piece shows, inside the stroke's box
  const tmp = makeCanvas(bw, bh), tx = tmp.getContext('2d');
  const alphas = group.map(g => {
    const im = ppImg(g, P && P[g.id]); tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, bw, bh);
    tx.setTransform(1, 0, 0, 1, -bx, -by); tx.transform(...M[g.id]); tx.drawImage(im.c, im.x, im.y);
    const d = tx.getImageData(0, 0, bw, bh).data, A = new Uint8Array(n); for (let k = 0; k < n; k++) A[k] = d[k * 4 + 3]; return A;
  });
  const bones = group.map(g => ppPGBone(g, M));
  const segD = (s, x, y) => { const vx = s[1].x - s[0].x, vy = s[1].y - s[0].y, t = Math.max(0, Math.min(1, ((x - s[0].x) * vx + (y - s[0].y) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(x - s[0].x - vx * t, y - s[0].y - vy * t); };
  const owner = new Int8Array(n).fill(-1);
  for (let k = 0; k < n; k++) {
    if (!ink[k * 4 + 3]) continue;
    if (a.erase) { owner[k] = 99; continue; }
    let o = alphas.findIndex(A => A[k] > 40);   // group is sorted top first
    if (o < 0) { const x = bx + k % bw + 0.5, y = by + ((k / bw) | 0) + 0.5; let bd = Infinity; bones.forEach((s, gi) => { const dd = segD(s, x, y); if (dd < bd) { bd = dd; o = gi; } }); }
    owner[k] = o;
  }
  const list = [];
  group.forEach((g, gi) => {
    const mk = makeCanvas(bw, bh), mx = mk.getContext('2d'), md = mx.createImageData(bw, bh); let any = false;
    for (let k = 0; k < n; k++) if (owner[k] === gi || (owner[k] === 99 && alphas[gi][k])) { md.data.set(ink.subarray(k * 4, k * 4 + 4), k * 4); any = true; }
    if (!any) return;
    mx.putImageData(md, 0, 0);
    const C = ppPaintCtx(g, a.f), im = C.im, st0 = ppHolderGet(g, C.vi);
    const cs = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(([x, y]) => mApply(C.inv, x, y));
    const nx = Math.floor(Math.min(im.x, ...cs.map(q => q.x))), ny = Math.floor(Math.min(im.y, ...cs.map(q => q.y)));
    const ww = Math.min(4096, Math.ceil(Math.max(im.x + im.c.width, ...cs.map(q => q.x))) - nx), hh = Math.min(4096, Math.ceil(Math.max(im.y + im.c.height, ...cs.map(q => q.y))) - ny);
    const out = makeCanvas(ww, hh), ox = out.getContext('2d'); ox.drawImage(im.c, im.x - nx, im.y - ny);
    ox.save(); ox.globalCompositeOperation = a.erase ? 'destination-out' : 'source-over'; ox.globalAlpha = a.op;
    ox.setTransform(1, 0, 0, 1, -nx, -ny); ox.transform(...C.inv); ox.drawImage(mk, bx, by); ox.restore();
    const t = ppPaintTrim(out), lx = nx + t.x, ly = ny + t.y;
    const st1 = { c: t.c, png: null, alpha: null, padded: false, x: C.vi ? lx - g.ox : lx, y: C.vi ? ly - g.oy : ly };
    const h = ppHolderSet(g, C.vi, st1); st1.alpha = ppAlphaH(h);
    list.push({ e: { partpix: true, pid: g.id, vi: C.vi, before: st0, after: st1, bytes: 4 * (st0.c.width * st0.c.height + st1.c.width * st1.c.height) }, h, st1 });
  });
  action = null;
  if (!list.length) { requestRender(); return; }
  const E = list.length === 1 ? list[0].e : { multi: list.map(x => x.e) };
  pushEntry(E); ppPaintRefresh();
  Promise.all(list.map(x => toBlob(x.st1.c).then(b => b.arrayBuffer()).then(buf => { x.st1.png = buf; if (x.h.c === x.st1.c) x.h.png = buf; }))).then(() => { histCover(E); scheduleSave(); });
}
// outline of the picked pieces + the stroke being drawn
function ppPGDraw(c, f) {
  if (!ppPaint || !ppPG.size) return;
  const P = ppPoseFor(f), M = ppMats(P), px = DPR / vs;
  c.save(); c.setLineDash([8 * px, 6 * px]);
  for (const id of ppPG) {
    const g = ppPart(id); if (!g || !g.c) continue; const im = ppImg(g, P && P[g.id]);
    c.save(); c.transform(...M[g.id]); c.lineWidth = 2.5 * px / Math.max(0.2, Math.hypot(M[g.id][0], M[g.id][1])); c.strokeStyle = '#ff9f1a'; c.strokeRect(im.x, im.y, im.c.width, im.c.height); c.restore();
  }
  c.restore();
  if (action && action.group) { c.save(); c.globalAlpha = action.erase ? 0.45 : action.op; c.drawImage(action.ink, 0, 0); c.restore(); }
}
