/* ========= Fill & pick ========= */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function doFill(p) {
  const f = curFrame(); if (!f || !f.canvas) return;
  if (S.layer !== 'bg') {
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    // tapping on pixels already painted in the Nhân vật layer recolours them there (old way); empty areas fill the Màu layer
    const a0 = S.showChar ? f.canvas.getContext('2d').getImageData(x0, y0, 1, 1).data[3] : 0;
    if (a0 < 100) { fillColLayer(f, p); return; }
    if (S.layer === 'col') { toast('Chạm vào bên trong vùng, không phải lên nét'); return; }
  }
  fillPixels(activeObj(), p);
}
function lineWalls(f) {           // 1 where a line is (pixel lines of Nhân vật + vector Nét), else 0
  const n = W * H, walls = new Uint8Array(n);
  if (S.showChar && f.canvas) { const d = f.canvas.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 0; i < n; i++) if (d[i * 4 + 3] >= 100) walls[i] = 1; }
  if (S.showVec && f.vec && f.vec.length) {
    const wc = makeCanvas(), wx = wc.getContext('2d'); drawVec(wx, f.vec, true);
    const d = wx.getImageData(0, 0, W, H).data; for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 90) walls[i] = 1; wc.width = 0;
  }
  return walls;
}
// gap closing for the fill tool: radius in px per level (Tắt / Nhỏ / Vừa / Lớn), remembered in settings
SETTINGS_KEYS.push('fillGap'); S.fillGap = 1;
const GAP_R = [0, 3, 6, 11], GAP_N = ['Tắt', 'Nhỏ', 'Vừa', 'Lớn'];
function syncFillBtns() { $('#gapBtn').textContent = 'Bịt khe: ' + GAP_N[S.fillGap | 0]; $('#gapBtn').classList.toggle('on', !!S.fillGap); }
setTimeout(syncFillBtns, 0);   // after loadSettings()
$('#gapBtn').addEventListener('click', () => { S.fillGap = ((S.fillGap | 0) + 1) % 4; syncFillBtns(); saveSettings(); toast(S.fillGap ? `Bịt khe hở tới ~${Math.round(GAP_R[S.fillGap] * 1.6)}px khi đổ màu` : 'Tắt bịt khe: màu chỉ dừng ở nét kín', 2200); });
// chamfer distance (in px) from every pixel to the nearest line pixel, capped at cap
function wallDist(walls, cap) {
  const d = new Uint16Array(W * H), C = cap * 3 + 3;
  for (let i = 0; i < d.length; i++) d[i] = walls[i] ? 0 : C;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let v = d[i]; if (!v) continue;
    if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3; if (y > 0) { if (d[i - W] + 3 < v) v = d[i - W] + 3; if (x > 0 && d[i - W - 1] + 4 < v) v = d[i - W - 1] + 4; if (x < W - 1 && d[i - W + 1] + 4 < v) v = d[i - W + 1] + 4; } d[i] = v; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let v = d[i]; if (!v) continue;
    if (x < W - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3; if (y < H - 1) { if (d[i + W] + 3 < v) v = d[i + W] + 3; if (x < W - 1 && d[i + W + 1] + 4 < v) v = d[i + W + 1] + 4; if (x > 0 && d[i + W - 1] + 4 < v) v = d[i + W - 1] + 4; } d[i] = v; }
  for (let i = 0; i < d.length; i++) d[i] = d[i] / 3;
  return d;
}
/* Fill into the frame's colour layer. The area is bounded by lines only; the colour also runs under the lines up to their
   middle (split with the neighbouring area), so erasing a line later leaves the colour exactly where it was — no gap, no spreading. */
function fillColLayer(f, p) {
  if (!S.showCol) { toast('Lớp Màu đang ẩn — bấm 👁 để hiện'); return; }
  const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
  const walls = lineWalls(f);
  if (walls[y0 * W + x0]) { toast('Chạm vào bên trong vùng, không phải lên nét'); return; }
  // gap closing: flood inside thickened lines (small holes in the outline get sealed), then grow back up to the real lines
  const gr = GAP_R[S.fillGap | 0] || 0, dist = gr ? wallDist(walls, gr + 1) : null;
  let fw = walls;
  if (gr) { fw = new Uint8Array(W * H); for (let i = 0; i < fw.length; i++) fw[i] = dist[i] <= gr ? 1 : 0; if (fw[y0 * W + x0]) fw = walls; }
  const mask = new Uint8Array(W * H);
  let minX = x0, maxX = x0, minY = y0, maxY = y0;
  const stack = [x0, y0];
  while (stack.length) {
    const sy = stack.pop(), sx = stack.pop(), row = sy * W;
    if (mask[row + sx] || fw[row + sx]) continue;
    let l = sx, r = sx;
    while (l > 0 && !mask[row + l - 1] && !fw[row + l - 1]) l--;
    while (r < W - 1 && !mask[row + r + 1] && !fw[row + r + 1]) r++;
    for (let k = l; k <= r; k++) mask[row + k] = 1;
    if (l < minX) minX = l; if (r > maxX) maxX = r; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= H) continue;
      const nrow = ny * W; let inSeg = false;
      for (let k = l; k <= r; k++) {
        const ok = !mask[nrow + k] && !fw[nrow + k];
        if (ok && !inSeg) { stack.push(k, ny); inSeg = true; } else if (!ok) inSeg = false;
      }
    }
  }
  if (fw !== walls) {   // grow back through non-line pixels by up to gr steps (stays behind the sealed gap)
    let cur = []; for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const i = y * W + x; if (mask[i]) cur.push(i); }
    for (let k = 0; k < gr && cur.length; k++) {
      const nx = [];
      for (const i of cur) { const x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= W * H || mask[j] || walls[j]) continue; mask[j] = 1; nx.push(j); const jx = j % W, jy = (j - jx) / W; if (jx < minX) minX = jx; if (jx > maxX) maxX = jx; if (jy < minY) minY = jy; if (jy > maxY) maxY = jy; } }
      cur = nx;
    }
  }
  // run under the lines: BFS through line pixels from this area (da) and from every other area (db); keep pixels nearer to us
  const R = 28, bx = Math.max(0, minX - 2 * R), by = Math.max(0, minY - 2 * R), bx2 = Math.min(W - 1, maxX + 2 * R), by2 = Math.min(H - 1, maxY + 2 * R);
  const bw = bx2 - bx + 1, bh = by2 - by + 1, BIG = 255;
  const da = new Uint8Array(bw * bh).fill(BIG), db = new Uint8Array(bw * bh).fill(BIG), q = new Int32Array(bw * bh);
  const bfs = (dist, isSrc, lim) => {
    let qh = 0, qt = 0;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const gi = (y + by) * W + x + bx; if (walls[gi] || !isSrc(gi)) continue;
      // only sources touching a line matter
      if ((x > 0 && walls[gi - 1]) || (x < bw - 1 && walls[gi + 1]) || (y > 0 && walls[gi - W]) || (y < bh - 1 && walls[gi + W])) { dist[y * bw + x] = 0; q[qt++] = y * bw + x; }
    }
    while (qh < qt) {
      const li = q[qh++], x = li % bw, y = (li - x) / bw, nd = dist[li] + 1; if (nd > lim) continue;
      const nb = [x > 0 ? li - 1 : -1, x < bw - 1 ? li + 1 : -1, y > 0 ? li - bw : -1, y < bh - 1 ? li + bw : -1];
      for (const nj of nb) { if (nj < 0 || dist[nj] <= nd) continue; const gx = nj % bw, gi = (((nj - gx) / bw) + by) * W + gx + bx; if (!walls[gi]) continue; dist[nj] = nd; q[qt++] = nj; }
    }
  };
  bfs(da, gi => mask[gi], R);
  bfs(db, gi => !mask[gi], 2 * R);
  const [fr, fg, fb] = hexToRgb(S.color);
  const cv = colOf(f, true), kx = cv.getContext('2d');
  const rect = [bx, by, bw, bh], before = kx.getImageData(...rect), img = kx.getImageData(...rect), d = img.data;
  let n = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const li = y * bw + x, gi = (y + by) * W + x + bx;
    if (!(mask[gi] || (walls[gi] && da[li] <= R && da[li] <= db[li]))) continue;
    const j = li * 4; d[j] = fr; d[j + 1] = fg; d[j + 2] = fb; d[j + 3] = 255; n++;
  }
  if (!n) return;
  kx.putImageData(img, bx, by);
  pushEntry(pixEntry(f, rect, before, img, true)); f.colVer++; markEdited(f); requestRender();
  if (S.layer !== 'col' && !fillColHint) { fillColHint = true; toast('Đã đổ vào lớp Màu (dưới nét) — xoá nét màu vẫn giữ nguyên', 3000); }
}
let fillColHint = false;
