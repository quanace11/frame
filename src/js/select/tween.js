/* ===== 🎞 tween a lifted picture over many frames (knee slide, run in, fly away…):
   the place it was lifted at = start, drag it to the end, pick frames / path / speed → each frame gets the picture
   at the in-between place, size and tilt. Missing frames are added (copies of this frame without the picture). One undo step. ===== */
const TW = { path: 'line', ease: 'out' };
function twStart() {
  const fl = floating; if (!fl || !fl.c) return;
  if (fl.o.kind !== 'char') { toast('Chuyển động chỉ làm được với hình ở lớp Nhân vật (không phải lớp Nền)'); return; }
  if (fl.anim) { toast('Hiệu ứng động đã tự chạy qua nhiều frame rồi'); return; }
  if (fl.bc) { toast('Vùng chọn có cả lớp Nền (dùng chung nhiều frame) nên không tạo chuyển động được. Chọn lại bằng 👤 Cả hình vẽ hoặc 🧩 Từng mảng.', 4500); return; }
  if (fl.tw) { twStop(); return; }
  fl.tw = { cx: fl.cx, cy: fl.cy, scale: fl.scale, rot: fl.rot, flip: fl.flip };
  twSync(); requestRender(); selbarAvoid(); toast('Kéo hình tới chỗ kết thúc, rồi bấm ✓ Tạo frame', 3000);
}
function twStop() { if (floating) floating.tw = null; twSync(); requestRender(); }
function twSync() {
  const on = !!(floating && floating.tw); $('#selTween').hidden = !on; $('#selTw').classList.toggle('on', on);
  if (floating) $('#selPlace').hidden = on || !!floating.anim || !floating.c;   // less to cover the drawing while picking the end
  document.querySelectorAll('[data-twp]').forEach(b => b.classList.toggle('on', b.dataset.twp === TW.path));
  document.querySelectorAll('[data-twe]').forEach(b => b.classList.toggle('on', b.dataset.twe === TW.ease));
}
// place of the picture at step k of n (0 = start, n-1 = end)
function twPoseAt(fl, k, n) {
  const A = fl.tw, u = n > 1 ? k / (n - 1) : 1, t = (EASE[TW.ease] || EASE.linear)(u), d = Math.hypot(fl.cx - A.cx, fl.cy - A.cy);
  let x = A.cx + (fl.cx - A.cx) * t, y = A.cy + (fl.cy - A.cy) * t;
  if (TW.path === 'arc') y -= Math.sin(Math.PI * t) * Math.max(80, d * 0.35);
  else if (TW.path === 'hop') y -= Math.abs(Math.sin(Math.PI * t * 3)) * Math.max(30, d * 0.1);
  else if (TW.path === 'bump' && k > 0 && k < n - 1) y -= (k % 2 ? 1 : -1) * Math.max(3, Math.min(10, fl.c.height * fl.scale * 0.006));   // a slide over grass: tiny up/down shake
  return { cx: x, cy: y, scale: A.scale + (fl.scale - A.scale) * t, rot: A.rot + (fl.rot - A.rot) * t, flip: t < 0.5 ? A.flip : fl.flip };
}
function twN() { return clamp(parseInt($('#twN').value) || 12, 2, 120); }
function renderTween(c, px) {
  const fl = floating, n = twN(), save = { cx: fl.cx, cy: fl.cy, scale: fl.scale, rot: fl.rot, flip: fl.flip };
  c.save(); c.globalAlpha = 0.35; Object.assign(fl, fl.tw); if (fl.cc) drawFloating(c, fl.cc); drawFloating(c); Object.assign(fl, save); c.restore();
  const pts = []; for (let k = 0; k < n; k++) pts.push(twPoseAt(fl, k, n));
  c.save(); c.lineWidth = 3 * px; c.setLineDash([10 * px, 7 * px]); c.strokeStyle = '#ff3b9a';
  c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.cx, q.cy) : c.moveTo(q.cx, q.cy)); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#ff3b9a'; c.strokeStyle = '#fff'; c.lineWidth = 1.5 * px;
  for (const q of pts) { c.beginPath(); c.arc(q.cx, q.cy, 6 * px, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
}
async function twMake() {
  const fl = floating; if (!fl || !fl.tw || !fl.c) return;
  const n = twN(), i0 = S.frames.indexOf(fl.o); if (i0 < 0) return;
  const pl = floatPlace(fl) === 'under' ? 'under' : 'top';
  floating = null; hideSelbar();
  const pm = progress('Đang tạo ' + n + ' frame…'); await new Promise(r => setTimeout(r, 30));
  try {
    const base = fl.o, rest = cloneCv(base.canvas), restCol = base.col ? cloneCv(base.col) : null;
    const pix = [], added = [];
    const put = (fr, pose) => {   // draw the picture into frame fr at pose; returns the changed rect
      const P = { ...fl, ...pose }, save = floating; floating = P;
      const r = rectFromBox(floatBox(), 2);
      const lx = fr.canvas.getContext('2d'), kx = fl.cc || pl === 'under' ? colOf(fr, true).getContext('2d') : null;
      if (pl === 'under') { kx.save(); kx.globalCompositeOperation = 'destination-over'; drawFloating(kx, fl.c); if (fl.cc) drawFloating(kx, fl.cc); kx.restore(); }
      else { if (fl.cc) { drawFloating(kx, fl.cc); lx.save(); lx.globalCompositeOperation = 'destination-out'; drawFloating(lx, fl.cc); lx.restore(); } drawFloating(lx, fl.c); }
      floating = save; if (kx) fr.colVer++; fr.ver++; return r;
    };
    for (let k = n - 1; k >= 0; k--) {   // last first: frame 1 is the source, new frames copy it without the picture
      const pose = twPoseAt(fl, k, n);
      if (k === 0) {   // the frame it was lifted from: undo goes back to before the lift
        const save = floating; floating = { ...fl, ...pose }; const box = unionBox(fl.dirty, floatBox()); floating = save;
        put(base, pose); const r = rectFromBox(box, 2); if (!r) continue;
        pix.push(pixEntry(base, r, fl.snap.getContext('2d').getImageData(...r), base.canvas.getContext('2d').getImageData(...r)));
        if (base.col) pix.push(pixEntry(base, r, fl.csnap ? fl.csnap.getContext('2d').getImageData(...r) : new ImageData(r[2], r[3]), base.col.getContext('2d').getImageData(...r), true));
        continue;
      }
      let fr = S.frames[i0 + k];
      if (!fr) {
        while (S.frames.length + added.length < i0 + k + 1) {   // build the missing frames once, in order
          const nf = newFrameObj(base.bgId); nf.dur = base.dur; nf.canvas.getContext('2d').drawImage(rest, 0, 0); if (restCol) { colOf(nf, true).getContext('2d').drawImage(restCol, 0, 0); nf.colVer = 1; }
          nf.ver = 1; nf.pngVer = 0; nf.vec = cloneVec(base.vec); nf.pp = ppClone(base.pp); nf.lip = lipCopy(base); nf.texts = JSON.parse(JSON.stringify(base.texts || [])); lookCopy(nf, base); added.push(nf);
        }
        fr = added[i0 + k - S.frames.length]; put(fr, pose); continue;
      }
      await ensureLoaded(fr);
      const save = floating; floating = { ...fl, ...pose }; const r = rectFromBox(floatBox(), 2); floating = save; if (!r) continue;
      const lb = fr.canvas.getContext('2d').getImageData(...r), hadCol = !!fr.col, cb = hadCol ? fr.col.getContext('2d').getImageData(...r) : new ImageData(r[2], r[3]);
      put(fr, pose);
      pix.push(pixEntry(fr, r, lb, fr.canvas.getContext('2d').getImageData(...r)));
      if (fr.col) pix.push(pixEntry(fr, r, cb, fr.col.getContext('2d').getImageData(...r), true));
      markEdited(fr);
    }
    rest.width = 0; if (restCol) restCol.width = 0;
    const multi = [...pix], ve = floatVecEntry(fl); if (ve) multi.push(ve);
    if (added.length) { const last = S.frames[S.frames.length - 1]; S.frames.push(...added); loaded.push(...added); multi.push({ t: targetOf(last), add: { frames: added, index: S.frames.length - added.length, dur0: last.dur, dur1: last.dur }, bytes: 0 }); }
    if (multi.length) pushEntry({ multi, t: targetOf(base) });
    fl.snap.width = 0; if (fl.csnap) fl.csnap.width = 0; fl.extra = null;
    markEdited(base);
    for (const f of added) await drawThumb(f);
    buildStrip(); updateFrameUI(); scheduleSave(); evictSoon(); requestRender();
  } finally { pm.close(); }
  toast(`Đã tạo chuyển động qua ${n} frame (frame ${i0 + 1}–${i0 + n}) — bấm ▶ Phát để xem, hoàn tác 1 lần để bỏ`, 4000);
}

