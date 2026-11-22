/* ===== 🫳 Kéo uốn (S.selMode 'warp'): khoanh một chỗ của hình (lông mày, miệng, tóc…) rồi kéo:
   bên trong vòng đi theo hẳn (như chấm vàng), dải quanh vòng giãn mềm (độ rộng S.warpSoft), xa hơn đứng yên (như chấm xanh).
   Nét + Màu + phần đã vẽ của Nền + nét vector cùng uốn, nên dùng được cho ảnh vẽ đưa vào. Mỗi lần kéo = 1 bước hoàn tác.
   Kéo bắt đầu trong vòng = uốn tiếp, ngoài vòng = khoanh vòng mới. ===== */
let warpSel = null;   // { f, poly, win: [x, y, w, h], w: Float32Array (0..1 over win), R }
const WARP_SOFT = { 1: 0.15, 2: 0.45, 3: 0.9 }, WARP_SOFT_N = { 1: 'Cứng', 2: 'Vừa', 3: 'Mềm' };
function warpSoftK() { return WARP_SOFT[S.warpSoft] || WARP_SOFT[2]; }
function warpBuild(poly, f) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of poly) { a[0] = Math.min(a[0], p.x); a[1] = Math.min(a[1], p.y); a[2] = Math.max(a[2], p.x); a[3] = Math.max(a[3], p.y); }
  const R = Math.max(12, Math.max(a[2] - a[0], a[3] - a[1]) * warpSoftK());
  const win = rectFromBox(a, Math.max(R, Math.max(a[2] - a[0], a[3] - a[1]) * 0.9) + 4); if (!win) return null;   // room for the band to widen on long drags
  const [wx, wy, ww, wh] = win, n = ww * wh;
  const mc = makeCanvas(ww, wh), mx = mc.getContext('2d'); mx.translate(-wx, -wy); polyPath(mx, poly); mx.fillStyle = '#000'; mx.fill();
  const md = mx.getImageData(0, 0, ww, wh).data, d = new Float32Array(n);
  let inside = 0;
  for (let i = 0; i < n; i++) { if (md[i * 4 + 3] > 127) { d[i] = 0; inside++; } else d[i] = 1e9; }
  if (inside < 9) return null;
  // two-pass chamfer distance (1, √2) from the loop
  const S2 = Math.SQRT2;
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) { const i = y * ww + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) { v = Math.min(v, d[i - ww] + 1); if (x > 0) v = Math.min(v, d[i - ww - 1] + S2); if (x < ww - 1) v = Math.min(v, d[i - ww + 1] + S2); } d[i] = v; }
  for (let y = wh - 1; y >= 0; y--) for (let x = ww - 1; x >= 0; x--) { const i = y * ww + x; let v = d[i];
    if (x < ww - 1) v = Math.min(v, d[i + 1] + 1); if (y < wh - 1) { v = Math.min(v, d[i + ww] + 1); if (x < ww - 1) v = Math.min(v, d[i + ww + 1] + S2); if (x > 0) v = Math.min(v, d[i + ww - 1] + S2); } d[i] = v; }
  const ws = { f, poly, win, d, R0: R, R: 0, w: new Float32Array(n) };
  warpSetR(ws, R); return ws;
}
// band width: never thinner than 1.6 × the drag, else the picture would fold over itself
function warpSetR(ws, R) {
  if (Math.abs(R - ws.R) < 0.5) return; ws.R = R;
  const d = ws.d, w = ws.w;
  for (let i = 0; i < d.length; i++) { const t = 1 - d[i] / R; w[i] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
}
function warpW(ws, x, y) {
  const [wx, wy, ww, wh] = ws.win, ix = Math.round(x - wx), iy = Math.round(y - wy);
  return ix < 0 || iy < 0 || ix >= ww || iy >= wh ? 0 : ws.w[iy * ww + ix];
}
// the layers that bend: lines + colour of the frame, and lớp Nền when the picture is drawn there (not just white paper)
function warpLayers(f, ws) {
  const out = [{ o: f, col: false, cv: f.canvas }];
  if (f.col) out.push({ o: f, col: true, cv: f.col });
  const bg = bgOf(f);
  if (S.showBg && bg && bg.canvas) {
    const [wx, wy, ww, wh] = ws.win, a = bg.canvas.getContext('2d').getImageData(wx, wy, ww, wh).data; let n = 0, k = 0;
    for (let i = 0; i < ww * wh; i++) if (ws.w[i] >= 1) { k++; const j = i * 4; if (a[j + 3] >= 20 && !(a[j] > 235 && a[j + 1] > 235 && a[j + 2] > 235)) n++; }
    if (k && n > k * 0.03) out.push({ o: bg, col: false, cv: bg.canvas });
  }
  return out;
}
function warpBegin(p, base) {
  const f = curFrame(), ws = warpSel;
  const layers = warpLayers(f, ws).map(L => ({ ...L, snap: cloneCv(L.cv) }));
  action = { ...base, kind: 'warp', p0: p, layers, done: null, vecBefore: f.vec && f.vec.length ? cloneVec(f.vec) : null, D: { x: 0, y: 0 } };
}
function warpApply(D) {
  const A = action, ws = warpSel, f = ws.f, [wx, wy, ww, wh] = ws.win;
  A.D = D;
  const dd = Math.hypot(D.x, D.y), [, , w0w, w0h] = ws.win;
  warpSetR(ws, Math.min(Math.max(ws.R0, dd * 1.6), Math.max(4, Math.min(w0w, w0h) / 2)));
  const r = rectFromBox([Math.min(wx, wx + D.x), Math.min(wy, wy + D.y), Math.max(wx + ww, wx + ww + D.x), Math.max(wy + wh, wy + wh + D.y)], 2); if (!r) return;
  const [rx, ry, rw, rh] = r;
  for (const L of A.layers) {
    const x = L.cv.getContext('2d');
    if (A.done) { x.save(); x.beginPath(); x.rect(...A.done); x.clip(); x.globalCompositeOperation = 'copy'; x.drawImage(L.snap, 0, 0); x.restore(); }
    const src = L.snap.getContext('2d').getImageData(rx, ry, rw, rh).data, img = x.createImageData(rw, rh), o = img.data;
    for (let y = 0; y < rh; y++) for (let xx = 0; xx < rw; xx++) {
      const qx = rx + xx, qy = ry + y, oi = (y * rw + xx) * 4;
      // inverse of p → p + D·w(p): find t = w(q − D·t) by bisection (the map is monotone along D)
      let sx, sy;
      if (warpW(ws, qx, qy) === 0 && warpW(ws, qx - D.x, qy - D.y) === 0) { sx = qx; sy = qy; }
      else { let lo = 0, hi = 1; for (let it = 0; it < 9; it++) { const t = (lo + hi) / 2; if (t - warpW(ws, qx - D.x * t, qy - D.y * t) < 0) lo = t; else hi = t; } const t = (lo + hi) / 2; sx = qx - D.x * t; sy = qy - D.y * t; }
      sx -= rx; sy -= ry;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      let r0 = 0, g0 = 0, b0 = 0, a0 = 0;
      for (let k = 0; k < 4; k++) {
        const px = x0 + (k & 1), py = y0 + (k >> 1); if (px < 0 || py < 0 || px >= rw || py >= rh) continue;
        const wt = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), si = (py * rw + px) * 4, al = src[si + 3] * wt;
        r0 += src[si] * al; g0 += src[si + 1] * al; b0 += src[si + 2] * al; a0 += al;
      }
      if (a0 > 0) { o[oi] = r0 / a0; o[oi + 1] = g0 / a0; o[oi + 2] = b0 / a0; o[oi + 3] = a0; }
    }
    x.putImageData(img, rx, ry);
    if (L.col) L.o.colVer++; else L.o.ver++;
  }
  A.done = r; A.all = A.all ? rectFromBox(unionBox([A.all[0], A.all[1], A.all[0] + A.all[2], A.all[1] + A.all[3]], [rx, ry, rx + rw, ry + rh]), 0) : r;
  if (A.vecBefore) {
    const vb = A.vecBefore;
    f.vec = cloneVec(vb).map(st => { for (const q of st.pts) { const w = warpW(ws, q.x, q.y); q.x += D.x * w; q.y += D.y * w; } return st; });
    f.vec.forEach((st, i) => { const s0 = vb[i]; for (const k in s0) if (k !== 'pts' && !(k in st)) st[k] = s0[k]; });
  }
}
function warpEnd(cancel) {
  const A = action, ws = warpSel, f = ws && ws.f;
  if (!A || !ws) return;
  const moved = Math.hypot(A.D.x, A.D.y) >= 0.5;
  if (cancel || !moved || !A.all) {
    if (A.done) for (const L of A.layers) { const x = L.cv.getContext('2d'); x.save(); x.globalCompositeOperation = 'copy'; x.drawImage(L.snap, 0, 0); x.restore(); if (L.col) L.o.colVer++; else L.o.ver++; }
    if (A.vecBefore) f.vec = A.vecBefore;
  } else {
    const r = A.all, entries = [];
    for (const L of A.layers) { entries.push(pixEntry(L.o, r, L.snap.getContext('2d').getImageData(...r), L.cv.getContext('2d').getImageData(...r), L.col)); if (L.o !== f) markEdited(L.o); }
    if (A.vecBefore) entries.push(vecEntry(f, A.vecBefore, cloneVec(f.vec)));
    pushEntry(entries.length > 1 ? { multi: entries } : entries[0]); markEdited(f);
    warpSel = warpBuild(ws.poly.map(q => ({ x: q.x + A.D.x, y: q.y + A.D.y })), f) || null;   // the loop follows what was dragged
  }
  for (const L of A.layers) L.snap.width = 0;
  requestRender();
}
function renderWarpSel(c, px) {
  if (!warpSel) return;
  if (warpSel.f !== curFrame() || S.tool !== 'lasso' || selMode() !== 'warp') { warpSel = null; return; }
  const p = warpSel.poly;
  c.save(); c.beginPath(); c.moveTo(p[0].x, p[0].y); for (const q of p) c.lineTo(q.x, q.y); c.closePath();
  c.fillStyle = 'rgba(255,170,0,.12)'; c.fill(); c.lineWidth = 2 * px; c.setLineDash([8 * px, 6 * px]); c.strokeStyle = '#ff9800'; c.stroke(); c.restore();
}
function liftSelection(poly) {
  if (selMode() === 'warp') { warpSel = warpBuild(poly, curFrame()); if (!warpSel) toast('Vòng khoanh nhỏ quá'); else toast('Kéo từ trong vòng để uốn. Khoanh chỗ khác để chọn lại', 2500); requestRender(); return; }
  const mode = selMode(), fr = curFrame(); if (!fr || !fr.canvas) return;
  const bgO = bgOf(fr), onBg = S.layer === 'bg';
  // the layers this mode takes
  let lineO = onBg ? bgO : fr, takeLine = true, takeCol = !onBg && !!fr.col, takeVec = !onBg, takeBg = false, only = null;
  if (mode === 'all') { lineO = fr; takeCol = !!fr.col; takeVec = true; takeBg = !!(S.showBg && bgO && bgO.canvas); }
  // 🧩 looks at everything you see: the frame's lines + colour, and the drawn (not white) part of lớp Nền,
  // because a picture's colour may sit in another layer than its lines (then only the lines would move)
  else if (mode === 'part') { lineO = fr; takeCol = !!fr.col; takeVec = true; takeBg = !!(S.showBg && bgO && bgO.canvas); }
  else if (mode === 'layer' && !onBg) { only = S.layer; takeLine = only === 'char'; takeCol = only === 'col' && !!fr.col; takeVec = only === 'vec'; }
  if (!lineO || !lineO.canvas) return;
  let rect, mc;
  if (mode === 'part') {
    const srcs = [];
    if (takeBg) srcs.push(x => x.drawImage(bgO.canvas, 0, 0));
    if (takeCol) srcs.push(x => x.drawImage(fr.col, 0, 0));
    srcs.push(x => x.drawImage(lineO.canvas, 0, 0));
    if (takeVec && S.showVec && fr.vec && fr.vec.length) srcs.push(x => drawVec(x, fr.vec));
    const r = partMask(poly, srcs);
    if (!r) { toast('Không có mảng nào nằm gọn trong vòng khoanh — khoanh rộng hơn một chút quanh phần muốn lấy', 3500); return; }
    ({ rect, mc } = r);
  } else {
    let a = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of poly) { a[0] = Math.min(a[0], p.x); a[1] = Math.min(a[1], p.y); a[2] = Math.max(a[2], p.x); a[3] = Math.max(a[3], p.y); }
    rect = rectFromBox(a, 1);
    if (!rect || rect[2] < 4 || rect[3] < 4) return;
    mc = makeCanvas(rect[2], rect[3]); const mx = mc.getContext('2d'); mx.translate(-rect[0], -rect[1]); polyPath(mx, poly); mx.fillStyle = '#000'; mx.fill();
  }
  const [bx, by, bw, bh] = rect;
  const snap = makeCanvas(); snap.getContext('2d').drawImage(lineO.canvas, 0, 0);
  const fc = takeLine ? cutPiece(lineO.canvas, rect, mc) : makeCanvas(bw, bh);
  floating = { t: targetOf(lineO), o: lineO, c: fc, cx: bx + bw / 2, cy: by + bh / 2, scale: 1, rot: 0, flip: 1, snap, dirty: [bx, by, bx + bw, by + bh] };
  if (only) floating.only = only;
  if (takeCol) { // colour under the lines moves together with them
    const csnap = makeCanvas(); csnap.getContext('2d').drawImage(fr.col, 0, 0);
    Object.assign(floating, { cc: cutPiece(fr.col, rect, mc), csnap });
  }
  if (takeBg && mode === 'part' && !inkCount(bgO.canvas, rect, mc)) takeBg = false;   // nothing drawn in lớp Nền there: leave it alone
  if (takeBg) { // background piece: its "before" is kept now (before the hole), so undo / Huỷ bring the background back
    const sn = makeCanvas(); sn.getContext('2d').drawImage(bgO.canvas, 0, 0);
    floating.extra = [{ cv: bgO.canvas, o: bgO, col: false, snap: sn }];
    floating.bc = cutPiece(bgO.canvas, rect, mode === 'part' ? inkMask(bgO.canvas, rect, mc) : mc); bgO.ver++;
  }
  if (takeVec && !floatLiftVec(floating, poly) && only === 'vec') { floating.snap.width = 0; floating = null; toast('Không có nét vector nào nằm trong vòng khoanh'); requestRender(); return; }
  if (mode === 'pic' && !onBg && S.showBg && bgO && bgO.canvas && inkCount(bgO.canvas, rect, mc) > bw * bh * 0.05)
    toast('Một phần hình trong vòng nằm ở lớp Nền nên không đi theo. Muốn lấy cả nó: Huỷ, rồi chọn 🧩 Từng mảng (hoặc 🔲 Tất cả + nền)', 5000);
  else if (mode === 'pic' && onBg && [fr.canvas, fr.col].some(cv => cv && inkCount(cv, rect, mc) > bw * bh * 0.02))
    toast('Đang lấy lớp Nền, phần hình ở lớp Nhân vật/Màu không đi theo. Muốn lấy cả hình: Huỷ, rồi chọn 🧩 Từng mảng', 5000);
  showSelbar(); requestRender();
}
// the part of a mask where the layer has drawing that is not plain white paper (used for lớp Nền)
function inkMask(cv, rect, mc) {
  const [bx, by, bw, bh] = rect, d = cv.getContext('2d').getImageData(bx, by, bw, bh), a = d.data;
  const m = mc.getContext('2d').getImageData(0, 0, bw, bh), md = m.data;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] < 20 || (a[i] > 235 && a[i + 1] > 235 && a[i + 2] > 235)) md[i + 3] = 0;
  const out = makeCanvas(bw, bh); out.getContext('2d').putImageData(m, 0, 0); return out;
}
function inkCount(cv, rect, mc) {
  const [bx, by, bw, bh] = rect, a = cv.getContext('2d').getImageData(bx, by, bw, bh).data, md = mc.getContext('2d').getImageData(0, 0, bw, bh).data;
  let n = 0; for (let i = 0; i < a.length; i += 4) if (md[i + 3] > 127 && a[i + 3] >= 20 && !(a[i] > 235 && a[i + 1] > 235 && a[i + 2] > 235)) n++;
  return n;
}
/* vector strokes (lớp Nét) inside the loop move together with the picture: they are drawn into the lifted lines
   (become pixels when put down) and leave f.vec; floating.vecBefore keeps the old list for undo / Huỷ */
function floatLiftVec(fl, poly) {
  const f = fl.o; if (!fl || f.kind !== 'char' || !S.showVec || !f.vec || !f.vec.length) return 0;
  const pick = f.vec.filter(st => strokeInsideFrac(st, poly) >= 0.75); if (!pick.length) return 0;
  const [bx, by] = [fl.cx - fl.c.width / 2, fl.cy - fl.c.height / 2], x = fl.c.getContext('2d');
  x.save(); x.translate(-bx, -by); drawVec(x, pick); x.restore();
  fl.vecBefore = cloneVec(f.vec); const ids = new Set(pick.map(st => st.id)); f.vec = f.vec.filter(st => !ids.has(st.id)); vsel.clear();
  return pick.length;
}
function floatVecEntry(fl) { return fl.vecBefore ? vecEntry(fl.o, fl.vecBefore, cloneVec(fl.o.vec)) : null; }
function floatVecRestore(fl) { if (fl.vecBefore) { fl.o.vec = fl.vecBefore; fl.vecBefore = null; } }
function floatFromImage(bmp, colBmp) {
  if (S.layer === 'vec' || S.layer === 'col' || (colBmp && S.layer === 'bg')) setLayer('char');            // pixels go into a pixel layer
  if (S.tool === 'vedit' || S.tool === 'puppet') setTool('brush');
  const o = activeObj(); if (!o || !o.canvas) return;
  commitFloating();
  const maxSide = Math.max(W, H) * 1.5;
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const fc = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  fc.getContext('2d').drawImage(bmp, 0, 0, fc.width, fc.height);
  const snap = makeCanvas(); snap.getContext('2d').drawImage(o.canvas, 0, 0);
  const fit = Math.min(W * 0.9 / fc.width, H * 0.9 / fc.height, 1);
  floating = { t: targetOf(o), o, c: fc, cx: W / 2, cy: H / 2, scale: fit, rot: 0, flip: 1, snap, dirty: null };
  if (colBmp && o.kind === 'char') {   // colour that goes into the Màu layer under the lines, moved together with them
    const cc = makeCanvas(fc.width, fc.height); cc.getContext('2d').drawImage(colBmp, 0, 0, cc.width, cc.height);
    const csnap = makeCanvas(); csnap.getContext('2d').drawImage(colOf(o, true), 0, 0);
    Object.assign(floating, { cc, csnap });
    if (!S.showCol) { S.showCol = true; updateToggles(); }
  }
  setTool('lasso'); showSelbar(); requestRender();
}
function drawFloating(c, img) {
  img = img || (floating && floating.c);
  if (!floating || !img) return;
  c.save(); c.translate(floating.cx, floating.cy); c.rotate(floating.rot); c.scale(floating.scale * floating.flip, floating.scale * (floating.ay || 1));
  c.drawImage(img, -img.width / 2, -img.height / 2); c.restore();
}
function floatBox() {
  const f = floating, w = f.c.width / 2 * f.scale, h = f.c.height / 2 * f.scale * (f.ay || 1), cs = Math.cos(f.rot), sn = Math.sin(f.rot);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of [[-w, -h], [w, -h], [w, h], [-w, h]]) {
    const X = f.cx + x * cs - y * sn, Y = f.cy + x * sn + y * cs;
    box[0] = Math.min(box[0], X); box[1] = Math.min(box[1], Y); box[2] = Math.max(box[2], X); box[3] = Math.max(box[3], Y);
  }
  return box;
}
function unionBox(a, b) { if (!a) return b; if (!b) return a; return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }
