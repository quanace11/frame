/* ===== front / behind: where the floating picture lands when it is put down =====
   'top'   = lớp Nhân vật, on top of the lines (default)
   'under' = behind this frame's lines AND colours (into lớp Màu, drawn underneath what is there)
   'bg'    = into the background, behind everything of the frame */
const FLOAT_PLACES = { top: '⬆ Trên cùng', under: '⬇ Sau nét vẽ', bg: '🖼 Lên nền', bottom: '⏬ Dưới cùng' };
function floatPlace(fl) { fl = fl || floating; return !fl ? null : fl.place || (fl.t.type === 'bg' ? 'bg' : 'top'); }
function floatFrame(fl) { return fl.o.kind === 'char' ? fl.o : curFrame(); }
// the draws that put the floating picture down: [{ o, col, img, op }] in drawing order
function floatDraws(fl) {
  const pl = floatPlace(fl), fr = floatFrame(fl), out = [];
  // a piece lifted from lớp Nền (🔲 Tất cả + nền) goes back into the background, behind the rest of the picture
  if (fl.bc) { const b = bgOf(fr); if (b && b.canvas && pl !== 'bottom') out.push({ o: b, col: false, img: fl.bc }); }
  if (pl === 'bg') { const b = bgOf(fr); if (!b || !b.canvas) return out; if (fl.cc) out.push({ o: b, col: false, img: fl.cc }); if (fl.c) out.push({ o: b, col: false, img: fl.c }); }
  else if (pl === 'bottom') { const b = bgOf(fr); if (!b || !b.canvas) return out; if (fl.c) out.push({ o: b, col: false, img: fl.c, op: 'destination-over' }); if (fl.cc) out.push({ o: b, col: false, img: fl.cc, op: 'destination-over' }); if (fl.bc) out.push({ o: b, col: false, img: fl.bc, op: 'destination-over' }); }
  else if (pl === 'under') { if (fl.c) out.push({ o: fr, col: true, img: fl.c, op: 'destination-over' }); if (fl.cc) out.push({ o: fr, col: true, img: fl.cc, op: 'destination-over' }); }
  // on top with its own colour: the colour also hides old lines underneath it (else old lines would show through, since lớp Nhân vật is above lớp Màu)
  else { if (fl.cc) out.push({ o: fr, col: true, img: fl.cc }); if (fl.cc && fl.only !== 'col') out.push({ o: fr, col: false, img: fl.cc, op: 'destination-out' }); if (fl.c) out.push({ o: fr, col: false, img: fl.c }); }
  return out;
}
// canvas a draw goes into; keeps a "before" copy of it for undo / cancel (the source layer already has f.snap / f.csnap)
function floatTarget(fl, d) {
  const cv = d.col ? colOf(d.o, true) : d.o.canvas; if (!cv) return null;
  if (d.o === fl.o && (!d.col || fl.csnap)) return cv;
  fl.extra = fl.extra || [];
  if (!fl.extra.some(x => x.cv === cv)) { const sn = makeCanvas(); sn.getContext('2d').drawImage(cv, 0, 0); fl.extra.push({ cv, o: d.o, col: d.col, snap: sn }); }
  return cv;
}
function floatPutDown(fl) {
  const save = floating; floating = fl;
  for (const d of floatDraws(fl)) {
    const cv = floatTarget(fl, d); if (!cv) continue;
    const x = cv.getContext('2d'); x.save(); if (d.op) x.globalCompositeOperation = d.op; drawFloating(x, d.img); x.restore();
    if (d.col) d.o.colVer++; else d.o.ver++;
  }
  floating = save;
}
function restoreFloatExtra(fl) {
  for (const x of fl.extra || []) { if (x.cv.width) { const k = x.cv.getContext('2d'); k.save(); k.globalCompositeOperation = 'copy'; k.drawImage(x.snap, 0, 0); k.restore(); } if (x.col) x.o.colVer++; else x.o.ver++; queueThumbFor(x.o); x.snap.width = 0; }
  fl.extra = null;
}
function setFloatPlace(pl) {
  if (!floating || !FLOAT_PLACES[pl]) return;
  floating.place = pl; syncFloatPlace();
  if (pl === 'under' && !S.showCol) { S.showCol = true; updateToggles(); }
  const fr = floatFrame(floating), n = S.frames.filter(g => g.bgId === fr.bgId).length, share = n > 1 ? ` Nền này dùng chung ${n} frame nên cả ${n} frame đều thấy.` : '';
  const used = floatBgUsed(floating);   // how much of the background under the picture is already drawn on (0..1)
  if ((pl === 'bg' || pl === 'bottom') && !S.showBg) { S.showBg = true; updateToggles(); }
  if (pl === 'bottom') toast(used > 0.9 ? 'Hình nằm dưới cùng, nhưng lớp Nền đang phủ kín chỗ này nên sẽ bị che hết. Muốn thấy hình thì chọn 🖼 Lên nền.' + share : 'Hình nằm dưới cùng: sau mọi thứ, kể cả hình đã có trong lớp Nền.' + share, 4000);
  else if (pl === 'bg') toast((used > 0.02 ? 'Hình vào lớp Nền và đè lên hình đã có trong nền. Muốn nằm sau cả hình đó thì chọn ⏬ Dưới cùng.' : 'Hình vào lớp Nền, nằm sau nét vẽ và màu.') + share, 4000);
  else if (pl === 'under') toast(used > 0.02 ? 'Hình nằm sau nét vẽ và màu của frame, nhưng vẫn đè lên lớp Nền. Hình người nằm trong lớp Nền thì chọn ⏬ Dưới cùng.' : 'Hình sẽ nằm sau nét vẽ và màu của frame này', 4000);
  else toast('Hình sẽ nằm trên cùng, che nét vẽ bên dưới', 2000);
  requestRender();
}
// preview: the lines layer with the floating colour cut out of it (what floatPutDown will do)
let knockCv = null;
function floatKnock(src) {
  if (!knockCv || knockCv.width !== W || knockCv.height !== H) knockCv = makeCanvas();
  const x = knockCv.getContext('2d'); x.save(); x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'destination-out'; drawFloating(x, floating.cc); x.restore();
  return knockCv;
}
function floatBgUsed(fl) {
  const b = bgOf(floatFrame(fl)); if (!b || !b.canvas) return 0;
  const save = floating; floating = fl; const r = rectFromBox(floatBox(), 0); floating = save; if (!r) return 0;
  const d = b.canvas.getContext('2d').getImageData(...r).data; let n = 0, k = 0;
  for (let i = 3; i < d.length; i += 4 * 7) { k++; if (d[i] > 200) n++; }
  return k ? n / k : 0;
}
function syncFloatPlace() {
  const box = $('#selPlace'); if (!box || !floating) return;
  box.hidden = !!floating.anim || !floating.c;
  box.querySelectorAll('[data-fpl]').forEach(b => b.classList.toggle('on', b.dataset.fpl === floatPlace()));
}
// turn the floating picture into a cut-out piece (mảnh ghép): it can then go in front of / behind puppet characters
async function floatToPart() {
  const fl = floating; if (!fl || !fl.c) return;
  const box = floatBox(), rect = rectFromBox(box, 2); if (!rect) return;
  const [bx, by, bw, bh] = rect, c = makeCanvas(bw, bh), x = c.getContext('2d');
  x.translate(-bx, -by); if (fl.bc) drawFloating(x, fl.bc); if (fl.cc) drawFloating(x, fl.cc); drawFloating(x, fl.c);
  floating = null; hideSelbar(); histFlush();
  // put the source layer back as it was, except the hole left by a lifted selection (that stays, as one undo step with the new piece)
  const entries = [];
  restoreFloatExtra(fl);
  if (fl.o.canvas) {
    const lx = fl.o.canvas.getContext('2d');
    if (fl.dirty) { const r2 = rectFromBox(fl.dirty, 2); if (r2) entries.push(pixEntry(fl.o, r2, fl.snap.getContext('2d').getImageData(...r2), lx.getImageData(...r2))); }
    else { lx.save(); lx.globalCompositeOperation = 'copy'; lx.drawImage(fl.snap, 0, 0); lx.restore(); fl.o.ver++; }
  }
  if (fl.csnap && fl.o.col) {
    const kx = fl.o.col.getContext('2d');
    if (fl.dirty) { const r2 = rectFromBox(fl.dirty, 2); if (r2) entries.push(pixEntry(fl.o, r2, fl.csnap.getContext('2d').getImageData(...r2), kx.getImageData(...r2), true)); }
    else { kx.save(); kx.globalCompositeOperation = 'copy'; kx.drawImage(fl.csnap, 0, 0); kx.restore(); }
    fl.o.colVer++; fl.csnap.width = 0;
  }
  fl.snap.width = 0;
  { const ve = floatVecEntry(fl); if (ve) entries.push(ve); }
  const s0 = histSnap();
  if (!S.pp) { S.pp = { parts: [] }; S.frames.forEach(f => { if (!f.pp) f.pp = {}; }); }
  const nProp = S.pp.parts.filter(q => /^Hình \d+$/.test(q.name)).length + 1;
  const p = { id: newId(), name: 'Hình ' + nProp, role: '', parent: null, z: (S.pp.parts.length ? Math.max(...S.pp.parts.map(q => q.z)) : 0) + 1, ox: bx, oy: by, px: bx + bw / 2, py: by + bh / 2, c, alts: [] };
  await encodePart(p); S.pp.parts.push(p); ppRenormZ(); ppSel = p.id; ppDrag = 'box';
  entries.push({ snap: { before: s0, after: histSnap(), fr: [] }, bytes: 2000 });
  pushEntry(entries.length > 1 ? { multi: entries } : entries[0]);
  S.showPP = true; updateToggles(); markEdited(fl.o);
  setTool('puppet'); openTab('pp', 'parts'); ppSyncBar();
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); requestRender();
  toast('Đã thành mảnh ghép "' + p.name + '" — dùng ⏫ ⏬ (hoặc ▲ ▼) ở 🧩 Mảnh & hình để đặt trước/sau nhân vật', 4500);
}
function stampFloating() {
  if (!floating || !floating.c || !floating.o.canvas) return;
  floatPutDown(floating);
  floating.dirty = unionBox(floating.dirty, floatBox());
  requestRender(); toast('Đã in một bản — kéo tiếp hoặc bấm Xong');
}
function commitFloating() {
  if (!floating) return;
  const f = floating; floating = null; hideSelbar();
  if (!f.o.canvas) return;
  const lx = f.o.canvas.getContext('2d');
  let box = f.dirty;
  if (f.c) { const save = floating; floating = f; box = unionBox(box, floatBox()); floating = save; floatPutDown(f); }
  const rect = box && rectFromBox(box, 2);
  if (rect) {
    const before = f.snap.getContext('2d').getImageData(...rect);
    const after = lx.getImageData(...rect);
    const entries = [pixEntry(f.o, rect, before, after)];
    if (f.csnap && f.o.col) { entries.push(pixEntry(f.o, rect, f.csnap.getContext('2d').getImageData(...rect), f.o.col.getContext('2d').getImageData(...rect), true)); f.o.colVer++; }
    for (const x of f.extra || []) { entries.push(pixEntry(x.o, rect, x.snap.getContext('2d').getImageData(...rect), x.cv.getContext('2d').getImageData(...rect), x.col)); x.snap.width = 0; if (x.o !== f.o) markEdited(x.o); }
    const ve = floatVecEntry(f); if (ve) entries.push(ve);
    pushEntry(entries.length > 1 ? { multi: entries } : entries[0]);
  } else { if (f.extra) restoreFloatExtra(f); floatVecRestore(f); }
  f.extra = null;
  if (f.csnap) f.csnap.width = 0;
  if (f.anim && f.o.kind === 'char') { const keep = makeCanvas(); keep.getContext('2d').drawImage(f.snap, 0, 0); assetStampAnim(f, keep); }
  f.snap.width = 0; markEdited(f.o); requestRender();
}
function cancelFloating() {
  if (!floating) return;
  const f = floating; floating = null; hideSelbar();
  if (f.o.canvas) { const lx = f.o.canvas.getContext('2d'); lx.save(); lx.globalCompositeOperation = 'copy'; lx.drawImage(f.snap, 0, 0); lx.restore(); }
  restoreFloatCol(f); restoreFloatExtra(f); floatVecRestore(f);
  f.snap.width = 0; f.o.ver++; queueThumbFor(f.o); requestRender();
}
function restoreFloatCol(f) {
  if (!f.csnap) return;
  if (f.o.col) { const kx = f.o.col.getContext('2d'); kx.save(); kx.globalCompositeOperation = 'copy'; kx.drawImage(f.csnap, 0, 0); kx.restore(); f.o.colVer++; }
  f.csnap.width = 0; f.csnap = null;
}
function showSelbar() {
  const sb = $('#selbar'); sb.hidden = false; syncLassoBar();
  $('#selScale').value = Math.round(floating.scale * 100); $('#selScaleVal').textContent = Math.round(floating.scale * 100) + '%';
  $('#selRot').value = 0; $('#selRotVal').textContent = '0°';
  syncFloatPlace(); twSync(); selbarAvoid();
}
// the bar sits over the top of the canvas: when the lifted picture is under it, slide the drawing down so it can be seen (landscape tablets, 🎞 Chuyển động)
function selbarAvoid() {
  const sb = $('#selbar'); if (!floating || !floating.c || sb.hidden) return;
  requestAnimationFrame(() => {
    if (!floating || !floating.c || sb.hidden) return;
    const b = floatBox(), m = viewMat(), vr = view.getBoundingClientRect(), r = sb.getBoundingClientRect();
    const ys = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => (m[1] * x + m[3] * y + m[5]) / DPR + vr.top);
    const top = Math.min(...ys), bot = Math.max(...ys), room = vr.bottom - 70 - bot, need = r.bottom + 12 - top;
    if (need <= 0) return;
    const dy = Math.min(need, Math.max(0, room)); if (dy < 8) return;
    vty += dy * DPR; requestRender();
  });
}
function hideSelbar() { $('#selbar').hidden = true; syncLassoBar(); }

