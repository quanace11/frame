/* ===== ✂ Cắt từng bộ phận: draw a character by hand on a frame, then lasso its body parts into a cut-out with bones =====
   Like making a cut-out rig in Adobe Animate, but quicker: pick a role (Thân, Đầu, Tay trên trái…) and lasso that part
   of the drawing on this frame (Nét + Màu + vector lines). Loops may overlap: draw each one round a bit past the joint
   (thigh past the knee, shin above the knee). The joint goes in the middle of where a part overlaps its parent (drag the
   pink dot to move it), and bones are linked by role (shin → thigh → body), so gestures and symbols work straight away.
   ✓ Xong turns the loops into one character layer from this frame on, clears the drawing that was cut from the frame,
   and is 1 undo step. `HC` = the cut in progress (null when off). */
let HC = null;
const HC_SEQ = ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'];
const HC_PARENT = { head: 'torso', armL: 'torso', armR: 'torso', legL: 'torso', legR: 'torso', foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR', eyes: 'head', mouth: 'head', other: 'torso' };
const HC_Z = { torso: 9, head: 6, armL: 5, armR: 5, foreL: 4, foreR: 4, legL: 2, legR: 2, shinL: 1, shinR: 1, other: 7 };
const HC_COL = { torso: '#ff9f1c', head: '#ff3b9a', armL: '#2ec4b6', foreL: '#3a86ff', armR: '#8ac926', foreR: '#06d6a0', legL: '#a06cd5', shinL: '#7b2cbf', legR: '#e76f51', shinR: '#f4a261', other: '#ffd60a' };
function hcSource(f) {   // what the frame shows of its own drawing: Màu under Nét pixels, vector lines on top
  const c = makeCanvas(), x = c.getContext('2d');
  if (S.showCol && f.col) x.drawImage(f.col, 0, 0);
  if (S.showChar && f.canvas) x.drawImage(f.canvas, 0, 0);
  if (S.showVec && f.vec && f.vec.length) drawVec(x, f.vec);
  return c;
}
async function hcBegin() {
  const f = curFrame(); if (!f) return;
  if (playing) stopPlay(); commitFloating(); await ensureLoaded(f);
  const src = hcSource(f), d = src.getContext('2d').getImageData(0, 0, W, H).data;
  let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++;
  if (n < 40 && hcFlattenLayer(f)) return hcBegin();   // an imported picture that became a layer: put it back into the frame, then cut it
  if (n < 40) { toast('Frame này chưa có hình vẽ. Vẽ nhân vật ở lớp Nét / Màu trước (đồ qua ảnh mờ cũng được), rồi bấm ✂ Cắt từng bộ phận', 4500); return; }
  HC = { f, src, ink: d, regs: [], role: 'torso', drag: null };
  setTool('puppet'); hcSync(); requestRender();
  toast('Khoanh Thân trước. Mỗi vùng bo tròn quá khớp một chút, các vùng được chồng lên nhau', 4000);
}
/* the frame is empty but the selected layer is a single picture (Nhập ảnh → layer riêng): draw it into this frame's
   Nhân vật layer where it stands and remove the layer, as one undo step, so ✂ Cắt từng bộ phận can cut it */
function hcFlattenLayer(f) {
  if (!S.pp || !S.pp.parts.length) return false;
  const rid = ppSelChar(), parts = rid ? S.pp.parts.filter(p => ppCharOf(p) === rid) : [];
  if (parts.length !== 1 || parts[0].lh) return false;
  histFlush(); const hb = histSnap(), x = f.canvas.getContext('2d'), before = x.getImageData(0, 0, W, H);
  ppOnlyRoot = rid; try { drawPuppet(x, f.pp, f.lip); } finally { ppOnlyRoot = null; }
  const after = x.getImageData(0, 0, W, H);
  S.pp.parts = S.pp.parts.filter(p => p !== parts[0]); if (ppSel === parts[0].id) ppSel = null;
  markEdited(f); lyrSync(true); ppSyncBar(); render();
  const ha = histSnap(), fr = [];
  for (const [g, a] of ha.fm) { const bs = hb.fm.get(g); if (bs !== undefined && bs !== a) fr.push([g, bs, a]); }
  pushEntry({ multi: [pixEntry(f, [0, 0, W, H], before, after), { snap: { before: hb, after: ha, fr }, bytes: 2000 }] }); histRebase();
  return true;
}
function hcCancel() { HC = null; lasso = null; hcSync(); ppSyncBar(); requestRender(); }
function hcMask(poly) {
  const c = makeCanvas(), x = c.getContext('2d'); polyPath(x, poly); x.fillStyle = '#fff'; x.fill();
  const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); let b = [W, H, -1, -1];
  for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] > 127) { m[i] = 1; const xx = i % W, yy = (i - xx) / W; if (xx < b[0]) b[0] = xx; if (yy < b[1]) b[1] = yy; if (xx > b[2]) b[2] = xx; if (yy > b[3]) b[3] = yy; }
  c.width = 0; return { m, b };
}
function hcReg(role) { return HC && HC.regs.find(r => r.role === role); }
function hcParentOf(r) {
  let pr = HC_PARENT[r.role] && hcReg(HC_PARENT[r.role]);
  if (!pr || pr === r) pr = hcReg('torso');
  if (!pr || pr === r) pr = HC.regs.find(q => q !== r && q.role === 'torso') || (HC.regs[0] !== r ? HC.regs[0] : null);
  return pr && pr !== r ? pr : null;
}
function hcRoot() { return hcReg('torso') || HC.regs[0] || null; }
// joint of a part = middle of the drawing where its loop overlaps its parent's loop (no ink there → middle of the overlap,
// no overlap at all → the part's drawing nearest to the parent)
function hcJointAuto(r, pr) {
  const a = r.m, b = pr.m, ink = HC.ink, x0 = Math.max(r.b[0], pr.b[0]), y0 = Math.max(r.b[1], pr.b[1]), x1 = Math.min(r.b[2], pr.b[2]), y1 = Math.min(r.b[3], pr.b[3]);
  let sx = 0, sy = 0, n = 0, ex = 0, ey = 0, en = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (!a[i] || !b[i]) continue; ex += x; ey += y; en++; if (ink[i * 4 + 3] > 20) { sx += x; sy += y; n++; } }
  if (n > 8) return { x: sx / n, y: sy / n };
  if (en) return { x: ex / en, y: ey / en };
  let cx = 0, cy = 0, cn = 0;
  for (let y = pr.b[1]; y <= pr.b[3]; y += 3) for (let x = pr.b[0]; x <= pr.b[2]; x += 3) { const i = y * W + x; if (b[i] && ink[i * 4 + 3] > 20) { cx += x; cy += y; cn++; } }
  if (!cn) return { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] };
  cx /= cn; cy /= cn; let best = { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] }, bd = Infinity;
  for (let y = r.b[1]; y <= r.b[3]; y += 2) for (let x = r.b[0]; x <= r.b[2]; x += 2) { const i = y * W + x; if (a[i] && ink[i * 4 + 3] > 20) { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < bd) { bd = dd; best = { x, y }; } } }
  return best;
}
function hcJoint(r) {
  if (r.jm) return r.jm;
  const pr = hcParentOf(r);
  if (pr) return hcJointAuto(r, pr);
  // the root turns round the hips: between the legs' joints, else the bottom middle of the body
  const legs = ['legL', 'legR'].map(hcReg).filter(Boolean).map(q => hcJointAuto(q, r));
  if (legs.length) return { x: legs.reduce((s, q) => s + q.x, 0) / legs.length, y: legs.reduce((s, q) => s + q.y, 0) / legs.length };
  return { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] + (r.b[3] - r.b[1]) * 0.85 };
}
function hcAdd(poly) {
  if (!HC || poly.length < 3) return;
  const { m, b } = hcMask(poly);
  let ink = 0; for (let y = b[1]; y <= b[3]; y += 2) for (let x = b[0]; x <= b[2]; x += 2) { const i = y * W + x; if (m[i] && HC.ink[i * 4 + 3] > 20) ink++; }
  if (b[2] < 0 || ink < 6) { toast('Vùng khoanh không có hình vẽ'); return; }
  const role = HC.role, old = HC.regs.findIndex(r => r.role === role && role !== 'other');
  const r = { role, poly, m, b, jm: null };
  if (old >= 0) HC.regs[old] = r; else HC.regs.push(r);
  const kid = Object.keys(HC_PARENT).find(k => HC_PARENT[k] === role && HC_SEQ.includes(k) && !hcReg(k) && role !== 'torso');
  const next = kid || HC_SEQ.find(q => !hcReg(q)); HC.role = next || 'other';
  hcSync(); requestRender();
}
function hcHitJoint(p) {
  const tol = 22 * DPR / vs;
  for (const r of HC.regs) { if (r === hcRoot() && !r.jm && HC.regs.length < 2) continue; const j = hcJoint(r); if (Math.hypot(j.x - p.x, j.y - p.y) < tol) return r; }
  return null;
}
function hcStart(p, base) {
  const r = hcHitJoint(p);
  if (r) { const j = hcJoint(r), jm0 = r.jm; r.jm = { x: j.x, y: j.y }; action = { ...base, kind: 'hcjoint', r, jm0, last: p }; return; }
  lasso = [p]; lassoOpen = false; action = { ...base, kind: 'hclasso' };
}
function hcMove(p) {
  const a = action; if (!a || !HC) return;
  if (a.kind === 'hcjoint') { a.r.jm.x += p.x - a.last.x; a.r.jm.y += p.y - a.last.y; a.last = p; requestRender(); return; }
  const l = lasso && lasso[lasso.length - 1]; if (l && Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); }
}
function hcEnd() {
  const a = action; if (!a || !HC) return;
  if (a.kind === 'hclasso') { const poly = lasso; lasso = null; if (poly && poly.length > 2 && performance.now() - a.t0 > 120) hcAdd(poly); requestRender(); }
}
function hcDraw(c, px) {
  if (!HC) return;
  c.save();
  for (const r of HC.regs) {
    const col = HC_COL[r.role] || '#ffd60a';
    polyPath(c, r.poly); c.globalAlpha = 0.16; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
    c.lineWidth = 3 * px; c.strokeStyle = col; c.setLineDash([10 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    const t = PP_ROLES[r.role] || 'Khác', lx = (r.b[0] + r.b[2]) / 2, ly = (r.b[1] + r.b[3]) / 2;
    c.font = `bold ${20 * px}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5 * px; c.strokeStyle = '#000'; c.strokeText(t, lx, ly); c.fillStyle = col; c.fillText(t, lx, ly);
  }
  for (const r of HC.regs) {
    const j = hcJoint(r), pr = hcParentOf(r);
    if (!pr && HC.regs.length < 2) continue;
    c.beginPath(); c.arc(j.x, j.y, 10 * px, 0, Math.PI * 2); c.fillStyle = '#ff3b9a'; c.fill(); c.lineWidth = 3 * px; c.strokeStyle = '#fff'; c.stroke();
  }
  c.restore();
}
function hcSync() {
  const bar = $('#hcBar'); if (!bar) return;
  bar.hidden = !HC || S.tool !== 'puppet';
  document.body.classList.toggle('hcOn', !!HC);
  if (!HC) return;
  bar.querySelectorAll('[data-hcr]').forEach(b => { const k = b.dataset.hcr, done = k !== 'other' && !!hcReg(k); b.classList.toggle('on', HC.role === k); b.classList.toggle('done', done); b.textContent = (done ? '✓ ' : '') + (k === 'other' ? 'Khác' : PP_ROLES[k]); });
  $('#hcUndo').disabled = !HC.regs.length; $('#hcDone').disabled = !HC.regs.length;
  $('#hcHint').textContent = `Khoanh: ${HC.role === 'other' ? 'Khác' : PP_ROLES[HC.role]} · đã có ${HC.regs.length} vùng`;
}
function hcParts() {   // the loops → cut-out pieces (each piece = the drawing inside its loop, overlaps kept in both)
  const ids = new Map(HC.regs.map(r => [r, newId()])), parts = [], root = hcRoot();
  for (const r of HC.regs) {
    const x0 = Math.max(0, r.b[0] - 2), y0 = Math.max(0, r.b[1] - 2), x1 = Math.min(W, r.b[2] + 3), y1 = Math.min(H, r.b[3] + 3);
    const c = makeCanvas(x1 - x0, y1 - y0), cx = c.getContext('2d');
    cx.save(); cx.translate(-x0, -y0); polyPath(cx, r.poly); cx.clip(); cx.drawImage(HC.src, 0, 0); cx.restore();
    const j = hcJoint(r), pr = r === root ? null : hcParentOf(r) || root;
    const kid = HC.regs.find(q => q !== r && hcParentOf(q) === r && (HC_PARENT[q.role] === r.role));
    let tip = kid ? hcJoint(kid) : null;
    if (!tip) { let bd = -1; for (let y = r.b[1]; y <= r.b[3]; y += 3) for (let x = r.b[0]; x <= r.b[2]; x += 3) { const i = y * W + x; if (r.m[i] && HC.ink[i * 4 + 3] > 20) { const dd = (x - j.x) ** 2 + (y - j.y) ** 2; if (dd > bd) { bd = dd; tip = { x, y }; } } } }
    parts.push({ id: ids.get(r), name: r.role === 'other' ? 'Mảnh ' + (parts.length + 1) : PP_ROLES[r.role], role: r.role === 'other' ? '' : r.role,
      parent: pr ? ids.get(pr) : null, z: HC_Z[r.role] || 7, ox: x0, oy: y0, px: j.x, py: j.y, c, tip });
  }
  return parts;
}
async function hcFinish() {
  if (!HC || !HC.regs.length) return;
  const f = HC.f; if (f !== curFrame()) { toast('Quay lại frame đang cắt để xong'); return; }
  const pm = progress('Đang tạo nhân vật…'); await new Promise(r => setTimeout(r, 30));
  try {
    histFlush(); const hb = histSnap();
    const parts = hcParts(); for (const p of parts) await encodePart(p);
    // the drawing that was cut leaves this frame (it is the character now): pixels inside the loops + vector lines mostly inside
    const ents = [], all = HC.regs, b = [W, H, 0, 0];
    for (const r of all) { b[0] = Math.min(b[0], r.b[0]); b[1] = Math.min(b[1], r.b[1]); b[2] = Math.max(b[2], r.b[2] + 1); b[3] = Math.max(b[3], r.b[3] + 1); }
    const rect = [b[0], b[1], Math.max(1, b[2] - b[0]), Math.max(1, b[3] - b[1])];
    const clear = (cv, col) => {
      if (!cv) return; const x = cv.getContext('2d'), before = x.getImageData(...rect);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; for (const r of all) { polyPath(x, r.poly); x.fill(); } x.restore();
      ents.push(pixEntry(f, rect, before, x.getImageData(...rect), col));
    };
    if (S.showChar) clear(f.canvas, false);
    if (S.showCol && f.col) { clear(f.col, true); f.colVer++; }
    if (S.showVec && f.vec && f.vec.length) {
      const vb = cloneVec(f.vec), inside = st => { let n = 0; for (const q of st.pts) if (all.some(r => pip(q, r.poly))) n++; return st.pts.length && n / st.pts.length >= 0.6; };
      f.vec = f.vec.filter(st => !inside(st)); if (f.vec.length !== vb.length) ents.push(vecEntry(f, vb, cloneVec(f.vec)));
    }
    ppPushChar(parts);
    const n = parts.length; HC = null; hcSync();
    ppSel = (parts.find(p => !p.parent) || parts[0]).id; ppDrag = 'box';
    markEdited(f); ppShowAdded(); lyrSync(true); render();   // drawn once first: drawing fills the parts' alpha caches, which the snapshot sees
    const ha = histSnap(), fr = [];
    for (const [g, a] of ha.fm) { const bs = hb.fm.get(g); if (bs !== undefined && bs !== a) fr.push([g, bs, a]); }
    ents.push({ snap: { before: hb, after: ha, fr }, bytes: 2000 });
    pushEntry({ multi: ents }); histRebase();
    pm.close();
    toast(`Đã tạo nhân vật ${n} mảnh có xương. Chạm 2 lần vào 1 mảnh để xoay quanh khớp; Dòng layer để đặt keyframe`, 5000);
  } catch (e) { pm.close(); console.error(e); toast('Lỗi cắt: ' + e.message, 3000); }
}
document.querySelectorAll('[data-hcr]').forEach(b => b.addEventListener('click', () => { if (!HC) return; HC.role = b.dataset.hcr; hcSync(); }));
$('#hcUndo').addEventListener('click', () => { if (!HC || !HC.regs.length) return; const r = HC.regs.pop(); HC.role = r.role; hcSync(); requestRender(); });
$('#hcCancel').addEventListener('click', hcCancel);
$('#hcDone').addEventListener('click', hcFinish);
document.querySelectorAll('.hcStart').forEach(b => b.addEventListener('click', hcBegin));
