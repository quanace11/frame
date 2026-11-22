/* ===== 🗂 Layers (like Adobe Animate's layer panel) =====
   Every cut-out character and every picture made into a layer (Nhập ảnh → layer riêng, 🧩 Thành mảnh ghép) is one layer:
   its root piece + everything hanging from it. The layer order = which character stands in front.
   The hand-drawn layers (Nét, Nhân vật, Màu, Nền) are listed too, in the order they are drawn.
   Root-piece fields: lname (layer name), lh (hidden on every frame), lk (locked: can't be picked on the canvas);
   saved through ppPartMeta, undone by the automatic undo (the pieces' meta is in the snapshot). */
SETTINGS_KEYS.push('lyrOpen'); S.lyrOpen = false;
const lyrRoots = () => S.pp ? S.pp.parts.filter(p => !p.parent || !ppPart(p.parent)) : [];
const lyrParts = rootId => S.pp ? S.pp.parts.filter(p => ppCharOf(p) === rootId || p.id === rootId) : [];
// ids of pieces whose layer has one of the flags set (null when no layer has it: the common case costs nothing)
function lyrOff(flag, flag2) {
  if (!S.pp) return null; const roots = S.pp.parts.filter(p => (p[flag] || (flag2 && p[flag2])) && !p.parent); if (!roots.length) return null;
  const ids = new Set(roots.map(r => r.id)), out = new Set();
  for (const p of S.pp.parts) { const r = ppCharOf(p) || p.id; if (ids.has(r)) out.add(p.id); }
  return out;
}
// front first
function lyrOrder() {
  const zOf = r => Math.max(...lyrParts(r.id).map(p => p.z));
  return lyrRoots().map(r => ({ r, z: zOf(r) })).sort((a, b) => b.z - a.z).map(o => o.r);
}
function lyrName(r) {
  if (r.lname) return r.lname;
  const n = lyrParts(r.id).length;
  if (n > 1) { const k = lyrRoots().filter(q => lyrParts(q.id).length > 1).indexOf(r) + 1; return 'Nhân vật ' + k; }
  return r.name || 'Hình';
}
// put the layers in this order (front first): each layer keeps the order of its own pieces
function lyrApplyOrder(order) {
  let z = 0;
  for (const r of order.slice().reverse()) for (const p of lyrParts(r.id).sort((a, b) => a.z - b.z)) p.z = z++;
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); requestRender(); lyrSync(true); ppSyncBar();
}
function lyrMove(rootId, d) {
  const o = lyrOrder(), i = o.findIndex(r => r.id === rootId), j = clamp(i + d, 0, o.length - 1); if (i < 0 || i === j) return;
  const [r] = o.splice(i, 1); o.splice(j, 0, r); lyrApplyOrder(o);
}
function lyrFlag(rootId, flag) {
  const r = ppPart(rootId); if (!r) return; r[flag] = r[flag] ? null : true;
  if (flag === 'lh') { S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); toast(r.lh ? `Đã ẩn "${lyrName(r)}" ở mọi frame (cả khi xuất video)` : `Đã hiện "${lyrName(r)}"`, 2000); }
  else { if (r.lk && ppPart(ppSel) && ppCharOf(ppPart(ppSel)) === r.id) ppSel = null; toast(r.lk ? `Đã khoá "${lyrName(r)}": chạm lên khung vẽ không chọn trúng nữa` : `Đã mở khoá "${lyrName(r)}"`, 2200); }
  scheduleSave(); requestRender(); lyrSync(true); ppSyncBar();
}
function lyrSelect(rootId) {
  if (playing) stopPlay();
  const r = ppPart(rootId); if (!r) return;
  if (S.tool !== 'puppet') setTool('puppet');
  if (!S.showPP) { S.showPP = true; updateToggles(); }
  ppSel = r.id; ppDrag = 'box'; ppPaint = null; ppSyncBar(); requestRender(); lyrSync(true);
}
async function lyrRename(rootId) {
  const r = ppPart(rootId); if (!r) return; let val = null;
  await modal({ title: 'Đổi tên layer', html: `<input id="lyrNameIn" value="${lyrName(r).replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { val = document.getElementById('lyrNameIn').value.trim(); } }] });
  if (val) { r.lname = val.slice(0, 40); scheduleSave(); lyrSync(true); }
}

/* --- ⬚ whole character / picture with the 8-handle box (ppDrag 'box') --- */
// the layer's box: in the root piece's own space, so it turns and stretches with the character
function ppBoxOf(f, rootId) {
  const root = ppPart(rootId); if (!root || !f) return null;
  const pose = ppPoseFor(f), M = ppMats(pose), inv = mInv(M[root.id]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of lyrParts(root.id)) {
    const q = pose && pose[p.id]; if ((q && q.h) || !p.c) continue;
    const im = ppImg(p, q), T = mMul(inv, M[p.id]);
    for (const [x, y] of [[im.x, im.y], [im.x + im.c.width, im.y], [im.x, im.y + im.c.height], [im.x + im.c.width, im.y + im.c.height]]) {
      const l = mApply(T, x, y); x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y); x1 = Math.max(x1, l.x); y1 = Math.max(y1, l.y);
    }
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1, M: M[root.id] };
}
let ppLastTap = null;
function ppBoxStart(p, base, f) {
  const sel = ppPart(ppSel), root = sel && (ppCharOf(sel) || sel.id), b = root && ppBoxOf(f, root), k = b && xbHit(b, p, base.touch);
  const go = (rid, kk, bb) => { const q0 = { ...((f.pp && f.pp[rid]) || {}) }; action = { ...base, kind: 'ppbox', k: kk, p0: p, b: bb, root: rid, q0, before: ppState(f), moved: false }; requestRender(); };
  if (k && k !== 'in') { go(root, k, b); return; }
  const hit = ppHit(p, ppPoseFor(f), true), now = performance.now();
  if (hit && ppLastTap && ppLastTap.id === hit.id && now - ppLastTap.t < 380) {   // double tap: edit this one piece (like double-click into a symbol)
    ppLastTap = null; ppSel = hit.id; ppDrag = 'rotate'; ppSyncBar(); requestRender();
    toast(`Đang sửa riêng mảnh "${hit.name}" — kéo để xoay quanh khớp. Bấm ⬚ Cả nhóm để chọn lại cả nhân vật`, 3500); return;
  }
  ppLastTap = hit ? { id: hit.id, t: now } : null;
  const hr = hit && (ppCharOf(hit) || hit.id);
  if (hr && hr !== root) { ppSel = hr; ppSyncBar(); lyrSync(); go(hr, 'in', ppBoxOf(f, hr)); return; }
  if (k === 'in' || hr) { if (ppSel !== root) { ppSel = root; ppSyncBar(); } go(root, 'in', b); return; }
  ppSel = null; ppSyncBar(); lyrSync(); requestRender();
}
function ppBoxMove(p, f) {
  const a = action, q = ppQ(f, a.root), q0 = a.q0;
  if (!a.moved && Math.hypot(p.x - a.p0.x, p.y - a.p0.y) < 3 * xbPx()) return;
  a.moved = true;
  for (const key of Object.keys(q)) delete q[key]; Object.assign(q, q0);
  const r = xbDrag(a.b, a.k, a.p0, p);
  if (r.type === 'move') { q.dx = (q0.dx || 0) + r.dx; q.dy = (q0.dy || 0) + r.dy; }
  else {
    const A = r.type === 'rot' ? { x: (a.b.x0 + a.b.x1) / 2, y: (a.b.y0 + a.b.y1) / 2 } : r.a;
    if (r.type === 'rot') q.r = (q0.r || 0) + r.a / DEG;
    else { q.sx = (q0.sx == null ? 1 : q0.sx) * r.kx; q.sy = (q0.sy == null ? 1 : q0.sy) * r.ky; }
    const d = xbKeep(a.b.M, ppMats(ppPoseFor(f))[a.root], A); q.dx = (q.dx || 0) + d.dx; q.dy = (q.dy || 0) + d.dy;
  }
  f.ver++; requestRender();
}

/* --- a picture becomes its own layer (Nhập ảnh, like importing to a new layer in Animate) --- */
SETTINGS_KEYS.push('impLayer'); S.impLayer = true;
async function imgToLayer(img, col, name) {
  if (playing) stopPlay(); commitFloating(); histFlush();
  const w0 = img.width, h0 = img.height, c0 = makeCanvas(w0, h0), x0c = c0.getContext('2d');
  if (col) x0c.drawImage(col, 0, 0, w0, h0); x0c.drawImage(img, 0, 0, w0, h0);
  // crop the empty margin
  const d = x0c.getImageData(0, 0, w0, h0).data; let bx0 = w0, by0 = h0, bx1 = -1, by1 = -1;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) if (d[(y * w0 + x) * 4 + 3] > 8) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 < 0) { toast('Ảnh trống — không có gì để đưa vào layer'); return null; }
  const cw = bx1 - bx0 + 1, ch = by1 - by0 + 1, k = Math.min(1, W * 0.9 / cw, H * 0.9 / ch), tw = Math.max(1, Math.round(cw * k)), th = Math.max(1, Math.round(ch * k));
  const c = makeCanvas(tw, th), cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(c0, bx0, by0, cw, ch, 0, 0, tw, th); c0.width = 0;
  const n = (S.pp ? S.pp.parts.filter(q => /^Ảnh \d+$/.test(q.lname || '')).length : 0) + 1;
  name = name || 'Ảnh ' + n;
  const ox = Math.round((W - tw) / 2), oy = Math.round((H - th) / 2);
  const p = { id: newId(), name, lname: name, role: '', parent: null, z: 0, ox, oy, px: ox + tw / 2, py: oy + th / 2, c, alts: [] };
  p.z = S.pp && S.pp.parts.length ? Math.max(...S.pp.parts.map(q => q.z)) + 1 : 0;
  await encodePart(p); ppPushChar([p]);
  lyrShowNew(p);
  toast(`Đã thành layer "${name}" — kéo để dời, kéo 8 chấm vuông để phóng to/thu nhỏ, nút tròn để xoay. 🗂 Layer để đặt trước/sau`, 5000);
  return p;
}
function lyrShowNew(p) {
  ppSel = p.id; ppDrag = 'box'; ppPaint = null; S.showPP = true; updateToggles();
  if (S.tool !== 'puppet') setTool('puppet');
  if (!S.lyrOpen) { S.lyrOpen = true; saveSettings(); }
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); lyrSync(true); scheduleSave(); requestRender();
}

/* --- the panel --- */
var LYR_DRAW = [['vec', '✒️', 'Nét (vector)', 'showVec'], ['char', '✏️', 'Vẽ tay (Nhân vật)', 'showChar'], ['col', '🎨', 'Màu', 'showCol'], ['bg', '🖼', 'Nền', 'showBg']];
var lyrSig = '';
function lyrSync(force) {
  const pan = $('#lyrPanel'), btn = $('#lyrBtn'); if (!pan) return;
  if (btn) btn.classList.toggle('on', !!S.lyrOpen);
  pan.hidden = !S.lyrOpen; if (!S.lyrOpen) return;
  const order = lyrOrder(), sel = ppPart(ppSel), selRoot = S.tool === 'puppet' && sel ? (ppCharOf(sel) || sel.id) : null;
  const sig = JSON.stringify([order.map(r => [r.id, lyrName(r), r.lh, r.lk]), selRoot, S.tool, S.layer, S.showVec, S.showChar, S.showCol, S.showBg, S.showPP]);
  if (!force && sig === lyrSig) return; lyrSig = sig;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const drawRow = ([k, ic, nm, show]) => `<div class="lyr draw${S.tool !== 'puppet' && S.tool !== 'fx' && S.layer === k ? ' on' : ''}" data-ld="${k}"><span class="lic">${ic}</span><span class="lnm">${nm}</span><button class="leye" data-lde="${k}" title="Ẩn/hiện">${S[show] ? '👁' : '🚫'}</button></div>`;
  const ppRow = r => `<div class="lyr pp${r.id === selRoot ? ' on' : ''}${r.lh ? ' off' : ''}" data-lr="${r.id}"><span class="lgrip" title="Kéo lên/xuống để đổi trước/sau">≡</span><span class="lic">${lyrParts(r.id).length > 1 ? '🧍' : '🖼'}</span><span class="lnm">${esc(lyrName(r))}</span>`
    + `<button class="leye" data-lre="${r.id}" title="Ẩn/hiện layer ở mọi frame">${r.lh ? '🚫' : '👁'}</button><button class="llock" data-lrk="${r.id}" title="Khoá: không chọn trúng khi chạm khung vẽ">${r.lk ? '🔒' : '🔓'}</button></div>`;
  const list = drawRow(LYR_DRAW[0]) + (order.length ? order.map(ppRow).join('') : '<div class="lyr empty">Chưa có layer ảnh/nhân vật — bấm ＋ Ảnh</div>') + LYR_DRAW.slice(1).map(drawRow).join('');
  $('#lyrList').innerHTML = list;
  const has = !!selRoot;
  ['#lyrUp', '#lyrDown', '#lyrRen', '#lyrDel'].forEach(id => { $(id).disabled = !has; });
}
function lyrWire() {
  const list = $('#lyrList');
  list.addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.lde) { const k = t.dataset.lde, m = { vec: 'showVec', char: 'showChar', col: 'showCol', bg: 'showBg' }[k]; S[m] = !S[m]; updateToggles(); requestRender(); lyrSync(true); return; }
    if (t.dataset.lre) { lyrFlag(t.dataset.lre, 'lh'); return; }
    if (t.dataset.lrk) { lyrFlag(t.dataset.lrk, 'lk'); return; }
    const row = t.closest('.lyr'); if (!row || row.classList.contains('empty')) return;
    if (row.dataset.ld) { if (S.tool === 'puppet' || S.tool === 'fx' || S.tool === 'vedit') setTool('brush'); setLayer(row.dataset.ld); lyrSync(true); return; }
    if (row.dataset.lr) lyrSelect(row.dataset.lr);
  });
  list.addEventListener('dblclick', e => { const row = e.target.closest('.lyr.pp'); if (row) lyrRename(row.dataset.lr); });
  // drag the ≡ grip to reorder (touch, pen, mouse)
  list.addEventListener('pointerdown', e => {
    const g = e.target.closest('.lgrip'); if (!g) return; e.preventDefault();
    const row = g.closest('.lyr'), id = row.dataset.lr, y0 = e.clientY; let dy = 0;
    row.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch (er) {}
    const mv = ev => { dy = ev.clientY - y0; row.style.transform = `translateY(${dy}px)`; };
    const up = ev => {
      g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      row.classList.remove('drag'); row.style.transform = '';
      const rows = [...list.querySelectorAll('.lyr.pp')], y = ev.clientY; let to = rows.length - 1;
      for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { to = i; break; } }
      const o = lyrOrder(), from = o.findIndex(r => r.id === id); if (from < 0) return;
      if (to > from && rows[to] && y < rows[to].getBoundingClientRect().top + rows[to].getBoundingClientRect().height / 2) to--;
      if (Math.abs(dy) < 6 || to === from) { lyrSync(true); return; }
      const [r] = o.splice(from, 1); o.splice(to, 0, r); lyrApplyOrder(o);
      toast(to < from ? `"${lyrName(r)}" lên trước` : `"${lyrName(r)}" ra sau`, 1500);
    };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });
  const selRoot = () => { const s = ppPart(ppSel); return s ? (ppCharOf(s) || s.id) : null; };
  $('#lyrUp').addEventListener('click', () => { const r = selRoot(); if (r) lyrMove(r, -1); });
  $('#lyrDown').addEventListener('click', () => { const r = selRoot(); if (r) lyrMove(r, 1); });
  $('#lyrRen').addEventListener('click', () => { const r = selRoot(); if (r) lyrRename(r); });
  $('#lyrDel').addEventListener('click', () => { if (selRoot()) $('#ppDelChar').click(); });
  $('#lyrAdd').addEventListener('click', () => { S.impLayer = true; saveSettings(); $('#imgFile').click(); });
  $('#lyrClose').addEventListener('click', () => { S.lyrOpen = false; saveSettings(); lyrSync(true); });
  $('#lyrBtn').addEventListener('click', () => { S.lyrOpen = !S.lyrOpen; saveSettings(); lyrSync(true); });
}
lyrWire();
