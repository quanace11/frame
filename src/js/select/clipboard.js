/* ===== copy / paste a selection across frames ===== */
let selClip = null;
const cloneCv = c => { if (!c) return null; const k = makeCanvas(c.width, c.height); k.getContext('2d').drawImage(c, 0, 0); return k; };
function copyFloating() {
  if (!floating || !floating.c) return;
  const f = floating; selClip = { c: cloneCv(f.c), cc: cloneCv(f.cc), cx: f.cx, cy: f.cy, scale: f.scale, rot: f.rot, flip: f.flip };
  $('#pasteBtn').hidden = false; toast('Đã chép — sang frame khác bấm 📋 Dán (ở thanh frame)', 2500);
}
function drawClip(ctx, img) { const q = selClip; ctx.save(); ctx.translate(q.cx, q.cy); ctx.rotate(q.rot); ctx.scale(q.scale * q.flip, q.scale); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); }
function pasteHere() {
  if (!selClip) return;
  if (S.layer !== 'char') setLayer('char');
  if (S.tool !== 'lasso') setTool('lasso');
  commitFloating();
  const o = activeObj(); if (!o || !o.canvas) return;
  const snap = makeCanvas(); snap.getContext('2d').drawImage(o.canvas, 0, 0);
  const q = selClip;
  floating = { t: targetOf(o), o, c: cloneCv(q.c), cx: q.cx, cy: q.cy, scale: q.scale, rot: q.rot, flip: q.flip, snap, dirty: null };
  if (q.cc) { const cv = colOf(o, true); Object.assign(floating, { cc: cloneCv(q.cc), csnap: cloneCv(cv) }); }
  showSelbar(); requestRender();
}
async function pasteToFrames(n) {
  if (!selClip) return;
  commitFloating();
  const i0 = S.cur, i1 = Math.min(S.frames.length - 1, i0 + n - 1), entries = [];
  const box = (() => { const q = selClip, w = q.c.width / 2 * q.scale, h = q.c.height / 2 * q.scale, cs = Math.cos(q.rot), sn = Math.sin(q.rot), b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of [[-w, -h], [w, -h], [w, h], [-w, h]]) { const X = q.cx + x * cs - y * sn, Y = q.cy + x * sn + y * cs; b[0] = Math.min(b[0], X); b[1] = Math.min(b[1], Y); b[2] = Math.max(b[2], X); b[3] = Math.max(b[3], Y); } return b; })();
  const rect = rectFromBox(box, 2); if (!rect) return;
  const pm = progress('Đang dán…');
  try {
    for (let i = i0; i <= i1; i++) {
      const f = S.frames[i]; await ensureLoaded(f);
      const lx = f.canvas.getContext('2d'), before = lx.getImageData(...rect); drawClip(lx, selClip.c); entries.push(pixEntry(f, rect, before, lx.getImageData(...rect)));
      if (selClip.cc) { const kx = colOf(f, true).getContext('2d'), cb = kx.getImageData(...rect); drawClip(kx, selClip.cc); entries.push(pixEntry(f, rect, cb, kx.getImageData(...rect), true)); f.colVer++; }
      markEdited(f);
    }
    pushEntry({ multi: entries });
  } finally { pm.close(); }
  requestRender(); toast(`Đã dán vào ${i1 - i0 + 1} frame (frame ${i0 + 1}–${i1 + 1}) — hoàn tác 1 lần để bỏ`, 3000);
}
async function pasteDialog() {
  if (!selClip) { toast('Chọn vùng bằng công cụ Chọn vùng rồi bấm 📋 Chép trước'); return; }
  const left = S.frames.length - S.cur; let inp = null;
  const v = await modal({ title: '📋 Dán hình đã chép', html: `<p class="lbl">Hình được dán đúng vị trí lúc chép. Dán vào nhiều frame hợp cho đạo cụ, vật đứng yên, chữ…</p>
<div class="set-row"><span>Dán vào frame này và các frame sau, tổng số</span><input type="number" id="pasteN" min="1" max="${left}" value="${Math.min(left, 5)}" style="width:80px"></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Dán nhiều frame', value: 'many' }, { label: 'Dán & chỉnh tay', value: 'one', primary: true }],
    onOpen: ov => { inp = ov.querySelector('#pasteN'); inp.addEventListener('keydown', e => e.stopPropagation()); } });
  const n = clamp(parseInt(inp && inp.value) || 1, 1, left);
  if (v === 'one') pasteHere(); else if (v === 'many') await pasteToFrames(n);
}

