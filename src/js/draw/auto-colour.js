/* ===== 🪄 auto-colour from the previous frame: each closed area takes the colour that covered most of it in the previous frame ===== */
function autoColorFrame(src, f) {
  const sc = src && src.col; if (!sc) return 0;
  const walls = lineWalls(f), n = W * H;
  const gr = GAP_R[S.fillGap | 0] || 0; let fw = walls;
  if (gr) { const dist = wallDist(walls, gr + 1); fw = new Uint8Array(n); for (let i = 0; i < n; i++) fw[i] = dist[i] <= gr ? 1 : 0; }
  const sd0 = sc.getContext('2d').getImageData(0, 0, W, H).data;
  // the character usually moved a little: find the shift that best lines up the previous frame's lines with this one's
  const [mx, my] = autoColShift(lineWalls(src), walls);
  let sd = sd0; if (mx || my) { sd = new Uint8ClampedArray(n * 4); for (let y = 0; y < H; y++) { const sy = y - my; if (sy < 0 || sy >= H) continue; for (let x = 0; x < W; x++) { const sx = x - mx; if (sx < 0 || sx >= W) continue; const a = (y * W + x) * 4, b2 = (sy * W + sx) * 4; sd[a] = sd0[b2]; sd[a + 1] = sd0[b2 + 1]; sd[a + 2] = sd0[b2 + 2]; sd[a + 3] = sd0[b2 + 3]; } } }
  const cv = colOf(f, true), kx = cv.getContext('2d'), before = kx.getImageData(0, 0, W, H), img = kx.getImageData(0, 0, W, H), d = img.data;
  const lab = new Int32Array(n), stack = [], cols = [0]; let id = 0, filled = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (lab[s0] || fw[s0]) continue;
    id++; const px = []; stack.push(s0); lab[s0] = id;
    while (stack.length) { const i = stack.pop(); px.push(i); const x = i % W;
      if (x > 0 && !lab[i - 1] && !fw[i - 1]) { lab[i - 1] = id; stack.push(i - 1); }
      if (x < W - 1 && !lab[i + 1] && !fw[i + 1]) { lab[i + 1] = id; stack.push(i + 1); }
      if (i >= W && !lab[i - W] && !fw[i - W]) { lab[i - W] = id; stack.push(i - W); }
      if (i < n - W && !lab[i + W] && !fw[i + W]) { lab[i + W] = id; stack.push(i + W); } }
    // vote: colours of the previous frame's colour layer under this area
    const votes = new Map(); let colored = 0;
    const step = px.length > 4000 ? Math.ceil(px.length / 4000) : 1;
    for (let k = 0; k < px.length; k += step) { const j = px[k] * 4; if (sd[j + 3] < 200) continue; colored++; const key = (sd[j] << 16) | (sd[j + 1] << 8) | sd[j + 2]; votes.set(key, (votes.get(key) || 0) + 1); }
    const total = Math.ceil(px.length / step);
    if (px.length < 6 || colored < total * 0.35) { cols.push(-1); continue; }
    let best = -1, bv = 0; for (const [k, v] of votes) if (v > bv) { bv = v; best = k; }
    cols.push(best);
    const r = best >> 16 & 255, g = best >> 8 & 255, b = best & 255;
    for (const i of px) { const j = i * 4; if (d[j + 3] >= 200) continue; d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255; filled++; }
  }
  if (!filled) return 0;
  // run the colours under the lines (and through sealed gaps) from the nearest coloured area, like the bucket does
  const LIM = 28, dist = new Uint8Array(n).fill(255), owner = new Int32Array(n), q = new Int32Array(n); let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (lab[i] && cols[lab[i]] >= 0) { const x = i % W;
    if ((x > 0 && !lab[i - 1]) || (x < W - 1 && !lab[i + 1]) || (i >= W && !lab[i - W]) || (i < n - W && !lab[i + W])) { dist[i] = 0; owner[i] = cols[lab[i]]; q[qt++] = i; } }
  while (qh < qt) { const i = q[qh++], nd = dist[i] + 1; if (nd > LIM) continue; const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= n || lab[j] || dist[j] <= nd) continue; if (!walls[j] && !fw[j]) continue; dist[j] = nd; owner[j] = owner[i]; q[qt++] = j; } }
  for (let i = 0; i < n; i++) if (!lab[i] && dist[i] <= LIM) { const j = i * 4; if (d[j + 3] >= 200) continue; const c = owner[i]; d[j] = c >> 16 & 255; d[j + 1] = c >> 8 & 255; d[j + 2] = c & 255; d[j + 3] = 255; }
  kx.putImageData(img, 0, 0); f.colVer++;
  return pixEntry(f, [0, 0, W, H], before, img, true);
}
// coarse-to-fine search of the (dx,dy) that maps the previous lines onto the current ones (current ≈ previous shifted by dx,dy)
function autoColShift(wa, wb) {
  const grid = (w, k) => { const gw = Math.ceil(W / k), gh = Math.ceil(H / k), g = new Uint8Array(gw * gh); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (w[y * W + x]) g[((y / k) | 0) * gw + ((x / k) | 0)] = 1; return { g, gw, gh }; };
  const best = (k, R, cx, cy) => {
    const A = grid(wa, k), B = grid(wb, k), pts = []; for (let i = 0; i < B.g.length; i++) if (B.g[i]) pts.push(i);
    if (!pts.length) return [cx, cy];
    let bs = -1, bx = cx, by = cy;
    for (let dy = cy - R; dy <= cy + R; dy++) for (let dx = cx - R; dx <= cx + R; dx++) {
      let sc = 0; for (const i of pts) { const x = i % B.gw - dx, y = ((i / B.gw) | 0) - dy; if (x >= 0 && y >= 0 && x < A.gw && y < A.gh && A.g[y * A.gw + x]) sc++; }
      sc -= (Math.abs(dx - cx) + Math.abs(dy - cy)) * 0.001;   // prefer the smaller move on ties
      if (sc > bs) { bs = sc; bx = dx; by = dy; }
    }
    return [bx, by];
  };
  const [c8x, c8y] = best(8, 12, 0, 0), [c2x, c2y] = best(2, 5, c8x * 4, c8y * 4);
  return [c2x * 2, c2y * 2];
}
async function autoColor(all) {
  if (playing) stopPlay(); commitFloating();
  if (!S.showCol) { toast('Lớp Màu đang ẩn — bấm 👁 để hiện'); return; }
  const i0 = S.cur; if (i0 === 0) { toast('Đây là frame đầu: tô màu frame này trước, rồi sang frame sau bấm 🪄'); return; }
  const prev = S.frames[i0 - 1]; await ensureLoaded(prev);
  if (!prev.col) { toast(`Frame ${i0} chưa có màu: tô màu frame đó bằng 🪣 trước`, 3500); return; }
  const last = all ? S.frames.length - 1 : i0, pm = last > i0 ? progress('Đang tô màu…') : null, multi = []; let done = 0;
  try {
    for (let i = i0; i <= last; i++) {
      const src = S.frames[i - 1], f = S.frames[i]; await ensureLoaded(src); await ensureLoaded(f);
      if (pm) { pm.set(`Đang tô màu frame ${i + 1}/${last + 1}…`); await new Promise(r => setTimeout(r, 0)); }
      const e = autoColorFrame(src, f); if (e) { multi.push(e); markEdited(f); done++; }
      if (multi.length * 2 * W * H * 4 > 120e6) break;   // keep undo memory sane on long runs
    }
  } finally { if (pm) pm.close(); }
  if (multi.length) pushEntry(multi.length === 1 ? multi[0] : { multi, t: targetOf(S.frames[i0]) });
  requestRender(); updUndoBtns(); evictSoon();
  toast(done ? `Đã tô màu ${done} frame theo frame trước — chỗ nào sai thì đổ lại bằng 🪣, hoàn tác 1 lần để bỏ hết` : 'Không tìm thấy vùng nào trùng với vùng đã tô ở frame trước', 4000);
}
{ const b = $('#autoColBtn'); let t = null, long = false;
  b.addEventListener('pointerdown', () => { long = false; clearTimeout(t); t = setTimeout(async () => { long = true; const v = await modal({ title: '🪄 Tô theo frame trước', html: `<p>Tô màu từ frame ${S.cur + 1} tới frame cuối (${S.frames.length}), mỗi frame lấy màu của frame ngay trước nó.</p>`, buttons: [{ label: 'Huỷ', value: false }, { label: 'Chỉ frame này', value: 'one' }, { label: 'Tới frame cuối', value: 'all', primary: true }] }); if (v) autoColor(v === 'all'); }, 550); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
  b.addEventListener('click', () => { if (long) { long = false; return; } autoColor(false); });
  b.addEventListener('contextmenu', e => e.preventDefault()); }

function fillPixels(o, p) {
  if (!o || !o.canvas) return;
  let walls = null;
  if (o.kind === 'char' && o.vec && o.vec.length && S.showVec) {
    const wc = makeCanvas(), wx = wc.getContext('2d'); drawVec(wx, o.vec, true);
    const wd = wx.getImageData(0, 0, W, H).data; walls = new Uint8Array(W * H);
    for (let i = 0; i < walls.length; i++) walls[i] = wd[i * 4 + 3]; wc.width = 0;
  }
  const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
  const lc = o.canvas.getContext('2d');
  const img = lc.getImageData(0, 0, W, H), d = img.data;
  const s0 = (y0 * W + x0) * 4, tr = d[s0], tg = d[s0 + 1], tb = d[s0 + 2], ta = d[s0 + 3];
  const [fr, fg, fb] = hexToRgb(S.color);
  if (ta === 255 && tr === fr && tg === fg && tb === fb) return;
  const tol = S.fillTol;
  const mask = new Uint8Array(W * H);
  if (walls && walls[y0 * W + x0] > 90) { toast('Chạm vào bên trong vùng, không phải lên nét'); return; }
  const match = i => { if (walls && walls[i] > 90) return false; const j = i * 4; return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) + Math.abs(d[j + 3] - ta) * 1.5 <= tol; };
  let minX = x0, maxX = x0, minY = y0, maxY = y0;
  const stack = [x0, y0];
  while (stack.length) {
    const sy = stack.pop(), sx = stack.pop(), row = sy * W;
    if (mask[row + sx] || !match(row + sx)) continue;
    let l = sx, r = sx;
    while (l > 0 && !mask[row + l - 1] && match(row + l - 1)) l--;
    while (r < W - 1 && !mask[row + r + 1] && match(row + r + 1)) r++;
    for (let k = l; k <= r; k++) mask[row + k] = 1;
    if (l < minX) minX = l; if (r > maxX) maxX = r; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= H) continue;
      const nrow = ny * W; let inSeg = false;
      for (let k = l; k <= r; k++) {
        const ok = !mask[nrow + k] && match(nrow + k);
        if (ok && !inSeg) { stack.push(k, ny); inSeg = true; } else if (!ok) inSeg = false;
      }
    }
  }
  // grow 1px to tuck under anti-aliased line edges, paint behind existing pixels
  const g = walls ? 3 : 1;
  const x1 = Math.max(0, minX - g), x2 = Math.min(W - 1, maxX + g), y1 = Math.max(0, minY - g), y2 = Math.min(H - 1, maxY + g);
  const rect = [x1, y1, x2 - x1 + 1, y2 - y1 + 1];
  const before = lc.getImageData(...rect);
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
    const i = y * W + x;
    let m = mask[i] || (x > 0 && mask[i - 1]) || (x < W - 1 && mask[i + 1]) || (y > 0 && mask[i - W]) || (y < H - 1 && mask[i + W]);
    if (!m && walls && walls[i] > 0) { // tuck colour under vector lines (up to 3px)
      for (let r = 2; r <= 3 && !m; r++) m = (x >= r && mask[i - r]) || (x < W - r && mask[i + r]) || (y >= r && mask[i - r * W]) || (y < H - r && mask[i + r * W]);
    }
    if (!m) continue;
    const j = i * 4, a = d[j + 3] / 255;
    d[j] = Math.round(d[j] * a + fr * (1 - a)); d[j + 1] = Math.round(d[j + 1] * a + fg * (1 - a)); d[j + 2] = Math.round(d[j + 2] * a + fb * (1 - a)); d[j + 3] = 255;
  }
  lc.putImageData(img, 0, 0, ...rect);
  const after = lc.getImageData(...rect);
  pushUndo(o, rect, before, after); markEdited(o); requestRender();
}
function doPick(p) {
  const f = curFrame(), bg = bgOf(f);
  const c = makeCanvas(1, 1), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1, 1);
  if (S.showBg && bg && bg.canvas) x.drawImage(bg.canvas, -Math.floor(p.x), -Math.floor(p.y));
  if (S.showCol && f.col) x.drawImage(f.col, -Math.floor(p.x), -Math.floor(p.y));
  if (S.showChar && f.canvas) x.drawImage(f.canvas, -Math.floor(p.x), -Math.floor(p.y));
  if (S.pp && S.showPP) { x.save(); x.translate(-Math.floor(p.x), -Math.floor(p.y)); drawPuppet(x, f.pp, f.lip); x.restore(); }
  if (S.showVec && f.vec.length) { x.save(); x.translate(-Math.floor(p.x), -Math.floor(p.y)); drawVec(x, f.vec); x.restore(); }
  const d = x.getImageData(0, 0, 1, 1).data;
  setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
  const back = pickBack && pickBack !== 'pick' ? pickBack : 'brush';
  toast(back === 'fill' ? 'Đã lấy màu — chạm vào vùng để đổ màu này' : 'Đã lấy màu');
  setTool(back);
}
let pickBack = null;   // tool to return to after the eyedropper

