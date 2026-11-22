/* ========= Snap-to-line (🧲) ========= */
let snapField = null, snapKey = '';
const SNAP_SCALE = 0.5;
function snapSourceKey() {
  const f = curFrame(), prev = S.onion ? S.frames[S.cur - 1] : null, bg = bgOf(f);
  return [f.id, f.ver, S.showChar, S.showVec, S.showBg, bg && bg.ver, prev ? prev.id + '.' + prev.ver : '', REF.c && REF.show ? [REF.cx, REF.cy, REF.scale, REF.rot].join(',') : '', S.snapR, W, H].join('|');
}
function buildSnapField() {
  const key = snapSourceKey(); if (snapField && key === snapKey) return snapField;
  const w = Math.round(W * SNAP_SCALE), h = Math.round(H * SNAP_SCALE), c = makeCanvas(w, h), x = c.getContext('2d');
  x.save(); x.scale(SNAP_SCALE, SNAP_SCALE);
  const f = curFrame(), bg = bgOf(f), prev = S.onion ? S.frames[S.cur - 1] : null;
  const layers = fr => { if (S.showChar && fr.canvas) x.drawImage(fr.canvas, 0, 0); if (S.showVec) drawVec(x, fr.vec); };
  if (S.showBg && bg && bg.canvas) x.drawImage(bg.canvas, 0, 0);
  layers(f); if (prev && prev.canvas) layers(prev);
  x.restore();
  const n = w * h, d = x.getImageData(0, 0, w, h).data, bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = d[i * 4 + 3] > 90 ? 1 : 0;
  if (REF.c && REF.show) { // ink of the tracing image
    const rc = makeCanvas(w, h), rx = rc.getContext('2d'); rx.scale(SNAP_SCALE, SNAP_SCALE); rx.translate(REF.cx, REF.cy); rx.rotate(REF.rot); rx.scale(REF.scale, REF.scale); rx.drawImage(REF.c, -REF.c.width / 2, -REF.c.height / 2);
    const a = inkAlpha(rx.getImageData(0, 0, w, h), 55); for (let i = 0; i < n; i++) if (a[i] > 0.4) bin[i] = 1;
  }
  const dt = chamferDT(bin, w, h); zhangSuen(bin, w, h);
  for (let i = 0; i < n; i++) if (bin[i] && dt[i] > 9) bin[i] = 0;      // centre lines of big filled areas are not lines
  // nearest line pixel for every pixel within radius (multi-source BFS)
  const R = Math.max(2, Math.round(S.snapR * SNAP_SCALE)), near = new Int32Array(n).fill(-1), dist = new Uint16Array(n).fill(65535);
  let q = []; for (let i = 0; i < n; i++) if (bin[i]) { near[i] = i; dist[i] = 0; q.push(i); }
  for (let step = 0; step < R && q.length; step++) {
    const nq = [];
    for (const i of q) { const xx = i % w; for (const j of [xx > 0 ? i - 1 : -1, xx < w - 1 ? i + 1 : -1, i - w, i + w, xx > 0 ? i - w - 1 : -1, xx < w - 1 ? i - w + 1 : -1, xx > 0 ? i + w - 1 : -1, xx < w - 1 ? i + w + 1 : -1]) { if (j < 0 || j >= n || near[j] >= 0) continue; near[j] = near[i]; dist[j] = step + 1; nq.push(j); } }
    q = nq;
  }
  snapField = { w, h, near }; snapKey = key; return snapField;
}
function snapPoint(p) {
  if (!S.snap || !snapField) return p;
  const F = snapField, x = Math.round(p.x * SNAP_SCALE), y = Math.round(p.y * SNAP_SCALE);
  if (x < 0 || y < 0 || x >= F.w || y >= F.h) return p;
  const k = F.near[y * F.w + x]; if (k < 0) return p;
  const tx = (k % F.w + 0.5) / SNAP_SCALE, ty = (Math.floor(k / F.w) + 0.5) / SNAP_SCALE, s = 0.85;
  return { x: p.x + (tx - p.x) * s, y: p.y + (ty - p.y) * s, p: p.p };
}
function snapPrepare() { if (S.snap) { try { buildSnapField(); } catch (e) { console.error(e); snapField = null; } } }

