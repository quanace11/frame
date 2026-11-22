/* ========= Pixel lines → vector strokes ========= */
function pixelsToStrokes(canvas) {   // canvas: W×H with lines on transparent
  const x = canvas.getContext('2d'), id = x.getImageData(0, 0, W, H), d = id.data, n = W * H;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 90) { const xx = i % W, yy = (i / W) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < 0) return [];
  x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3); x1 = Math.min(W - 1, x1 + 3); y1 = Math.min(H - 1, y1 + 3);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) a[y * w + xx] = d[((y0 + y) * W + x0 + xx) * 4 + 3] / 255;
  const strokes = vectorizeAlpha(a, w, h, 0.35);
  const colorAt = (px, py) => { const X = Math.round(px), Y = Math.round(py); let best = null, ba = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = X + dx, yy = Y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const i = (yy * W + xx) * 4; if (d[i + 3] > ba) { ba = d[i + 3]; best = [d[i], d[i + 1], d[i + 2]]; } } return best; };
  return strokes.map(st => {
    const pts = st.pts.map(q => ({ x: q.x + x0, y: q.y + y0 }));
    const cols = pts.map(q => colorAt(q.x, q.y)).filter(Boolean); cols.sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]));
    const c = cols.length ? cols[cols.length >> 1] : [17, 17, 17];
    return { id: newId(), c: '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''), w: Math.max(0.8, st.w), pts };
  });
}
async function convertPixelsToVector(fromFloating) {
  const f = curFrame(); if (!f) return;
  await ensureLoaded(f);
  let src;
  if (fromFloating) {
    if (!floating || !floating.c) { toast('Không có vùng chọn'); return; }
    src = makeCanvas(); drawFloating(src.getContext('2d'));
  } else src = f.canvas;
  const pm = progress('Đang chuyển nét pixel → vector…'); await new Promise(r => setTimeout(r, 30));
  let strokes;
  try { strokes = pixelsToStrokes(src); } catch (e) { pm.close(); toast('Lỗi: ' + e.message); return; }
  pm.close();
  if (!strokes.length) { toast('Không tìm thấy nét pixel nào'); return; }
  if (strokes.length > 3000) toast(`Có ${strokes.length} nét — hơi nhiều, có thể chậm`, 3000);
  const vBefore = cloneVec(f.vec);
  if (fromFloating) {
    const fl = floating; floating = null; hideSelbar();
    if (fl.o.canvas) { const lx = fl.o.canvas.getContext('2d'); lx.save(); lx.globalCompositeOperation = 'copy'; lx.drawImage(fl.snap, 0, 0); lx.restore(); }
    restoreFloatCol(fl); restoreFloatExtra(fl); fl.snap.width = 0; fl.o.ver++;
    f.vec.push(...strokes); pushVecUndo(f, fl.vecBefore || vBefore); fl.vecBefore = null; markEdited(f);   // vector lines that were lifted are traced again with the rest
  } else {
    const keep = await modal({ title: `Đã dò được ${strokes.length} nét`, html: '<p>Xoá nét pixel cũ ở lớp Nhân vật (frame này) sau khi chuyển sang vector?</p><p class="lbl" style="font-size:12px">Nếu lớp có cả mảng tô màu, hãy chọn Giữ lại.</p>',
      buttons: [{ label: 'Giữ lại pixel', value: 'keep' }, { label: 'Xoá pixel', value: 'clear', primary: true }] });
    if (!keep) return;
    const entries = [];
    if (keep === 'clear') { const lc = f.canvas.getContext('2d'), before = lc.getImageData(0, 0, W, H); lc.clearRect(0, 0, W, H); entries.push(pixEntry(f, [0, 0, W, H], before, lc.getImageData(0, 0, W, H))); }
    f.vec.push(...strokes); entries.push(vecEntry(f, vBefore, cloneVec(f.vec)));
    pushEntry(entries.length > 1 ? { multi: entries } : entries[0]); markEdited(f);
  }
  setLayer('vec'); setTool('vedit'); vsel.clear(); strokes.forEach(st => vsel.add(st.id)); updVecBar(); requestRender();
  toast(`Đã chuyển thành ${strokes.length} nét vector — dùng Sửa nét để chỉnh`, 3500);
}
