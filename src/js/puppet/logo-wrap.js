/* ===== 🏷 Dán logo lên áo (like Photoshop: place → remove background → Free Transform › Warp → Multiply / fabric blend) =====
   Full-screen editor over a picture of the frame. The logo is a cubic Bézier patch of 4×4 control points (Photoshop's Warp grid):
   ⬚ 4 góc = drag the corners (inner points follow, like Distort/Perspective); ▦ Uốn lưới = every point, corners drag their handles along.
   〰 Ôm áo bends the patch like a cylinder (edges squeezed, middle bowed) so it wraps around the chest in one slider.
   🎨 Hoà vào áo: the logo takes the brightness of the shirt under it (folds, shadows, outlines show through, like Multiply / a
   displacement of shading) and ✂ Chỉ trên áo keeps it inside the shirt. Background: 🪄 Tự xoá (flood from the border colour, +holes
   inside letters) or 🤖 AI tách nền (u2netp, aiMask).
   Where it goes: a puppet piece under the logo's centre → baked into that piece's picture (the one shown on this frame: p.c or an alt),
   so it follows the body on every frame (new canvas → automatic undo snapshot). No piece → the drawing layer being edited on this
   frame (Nhân vật / Màu / Nền), one pixel undo step. ===== */
const LW = { on: false, img: null, src: null, bgm: 'auto', holes: false, mode: 'corner', base: null, wrap: 0, shade: .75, op: 1, clip: true, tgt: null };
const lwBz = t => { const s = 1 - t; return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t]; };
function lwEval(P, u, v) { const bu = lwBz(u), bv = lwBz(v); let x = 0, y = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const w = bv[i] * bu[j]; x += P[i * 4 + j].x * w; y += P[i * 4 + j].y * w; } return { x, y }; }
const lwLerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
function lwBilin(c0, c1, c2, c3, s, t) { return lwLerp(lwLerp(c0, c1, s), lwLerp(c2, c3, s), t); }   // c0 top-left, c1 top-right, c2 bottom-left, c3 bottom-right
function lwFromCorners(c0, c1, c2, c3) { const P = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) P.push(lwBilin(c0, c1, c2, c3, j / 3, i / 3)); return P; }
// the control points actually used: the user's grid + the 〰 Ôm áo bend (cylinder squeeze across, bow down the middle)
function lwPts() {
  const B = LW.base, w = LW.wrap; if (!w) return B;
  const c0 = B[0], c1 = B[3], c2 = B[12], c3 = B[15], ph = Math.abs(w) * 2.2, k = ph > 1e-3 ? 1 / (2 * Math.sin(ph / 2)) : 0;
  return B.map((p, n) => {
    const s = (n % 4) / 3, t = Math.floor(n / 4) / 3, ex = lwLerp({ x: c1.x - c0.x, y: c1.y - c0.y }, { x: c3.x - c2.x, y: c3.y - c2.y }, t), ey = lwLerp({ x: c2.x - c0.x, y: c2.y - c0.y }, { x: c3.x - c1.x, y: c3.y - c1.y }, s);
    const ds = k ? .5 + Math.sin((s - .5) * ph) * k - s : 0, dt = w * .16 * (1 - (2 * s - 1) * (2 * s - 1));
    return { x: p.x + ex.x * ds + ey.x * dt, y: p.y + ex.y * ds + ey.y * dt };
  });
}
// draw the logo warped onto the patch: N×N cells, 2 textured triangles each (the clip grows a little so cells overlap: no seams)
function lwTri(ctx, img, s, d, grow) {
  const m = ppAffine3(s, d); if (!m) return;
  const cx = (d[0].x + d[1].x + d[2].x) / 3, cy = (d[0].y + d[1].y + d[2].y) / 3;
  ctx.save(); ctx.beginPath();
  d.forEach((q, k) => { const dx = q.x - cx, dy = q.y - cy, l = Math.hypot(dx, dy) || 1, e = (l + grow) / l; k ? ctx.lineTo(cx + dx * e, cy + dy * e) : ctx.moveTo(cx + dx * e, cy + dy * e); });
  ctx.closePath(); ctx.clip(); ctx.transform(...m); ctx.drawImage(img, 0, 0); ctx.restore();
}
function lwGrid(P, N) { const G = []; for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) G.push(lwEval(P, j / N, i / N)); return G; }
function lwDrawWarp(ctx, img, P, N, grow = .7) {
  const G = lwGrid(P, N), w = img.width, h = img.height, at = (i, j) => G[i * (N + 1) + j], sp = (i, j) => ({ x: j / N * w, y: i / N * h });
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    lwTri(ctx, img, [sp(i, j), sp(i, j + 1), sp(i + 1, j)], [at(i, j), at(i, j + 1), at(i + 1, j)], grow);
    lwTri(ctx, img, [sp(i, j + 1), sp(i + 1, j + 1), sp(i + 1, j)], [at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)], grow);
  }
}
function lwOutline(P, n = 12) { const o = []; for (let k = 0; k < n; k++) o.push(lwEval(P, k / n, 0)); for (let k = 0; k < n; k++) o.push(lwEval(P, 1, k / n)); for (let k = n; k > 0; k--) o.push(lwEval(P, k / n, 1)); for (let k = n; k > 0; k--) o.push(lwEval(P, 0, k / n)); return o; }
function lwInside(poly, p) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
/* --- background removal of the logo picture --- */
function lwAutoBg(src, holes, tol = 42) {
  const w = src.width, h = src.height, c = makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, w, h), d = img.data, n = w * h;
  let tr = 0; for (const i of [0, w - 1, (h - 1) * w, n - 1]) if (d[i * 4 + 3] < 30) tr++;
  if (tr >= 3) return c;   // already transparent around (PNG logo)
  const H2 = new Map(); let best = 0, key0 = 0;   // the border's main colour = the paper
  const edge = []; for (let i = 0; i < w; i++) edge.push(i, (h - 1) * w + i); for (let j = 0; j < h; j++) edge.push(j * w, j * w + w - 1);
  for (const i of edge) { const k = (d[i * 4] >> 3) << 10 | (d[i * 4 + 1] >> 3) << 5 | (d[i * 4 + 2] >> 3), v = (H2.get(k) || 0) + 1; H2.set(k, v); if (v > best) { best = v; key0 = k; } }
  const br = ((key0 >> 10) & 31) * 8 + 4, bg = ((key0 >> 5) & 31) * 8 + 4, bb = (key0 & 31) * 8 + 4;
  const dist = new Float32Array(n); for (let i = 0; i < n; i++) dist[i] = Math.hypot(d[i * 4] - br, d[i * 4 + 1] - bg, d[i * 4 + 2] - bb);
  const bgm = new Uint8Array(n);
  if (holes) { for (let i = 0; i < n; i++) if (dist[i] < tol) bgm[i] = 1; }
  else { const st = []; for (const i of edge) if (!bgm[i] && dist[i] < tol) { bgm[i] = 1; st.push(i); }
    while (st.length) { const i = st.pop(), px = i % w, py = (i - px) / w; for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) { if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (!bgm[j] && dist[j] < tol) { bgm[j] = 1; st.push(j); } } } }
  for (let i = 0; i < n; i++) {
    if (bgm[i]) { d[i * 4 + 3] = 0; continue; }
    const px = i % w, py = (i - px) / w; let near = false;   // soft edge next to the removed paper
    for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) if (nx >= 0 && ny >= 0 && nx < w && ny < h && bgm[ny * w + nx]) { near = true; break; }
    if (near && dist[i] < tol * 1.8) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * Math.min(1, (dist[i] - tol) / (tol * .8) + .15));
  }
  x.putImageData(img, 0, 0); return c;
}
function lwCrop(c) { const B = kitOpaqueBox(c), o = makeCanvas(B.w, B.h); o.getContext('2d').drawImage(c, B.x, B.y, B.w, B.h, 0, 0, B.w, B.h); return o; }
async function lwCut() {
  const src = LW.src; if (!src) return;
  let c;
  if (LW.bgm === 'ai') {
    const pr = progress('Đang tách nền logo bằng AI…');
    try { const a = await aiMask(src), m = sharpenMask(a, 70); c = makeCanvas(src.width, src.height); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0); const im = x.getImageData(0, 0, c.width, c.height); for (let i = 0; i < m.length; i++) im.data[i * 4 + 3] = Math.round(im.data[i * 4 + 3] * m[i]); x.putImageData(im, 0, 0); }
    catch (e) { console.error(e); toast('Chưa tách nền bằng AI được, dùng 🪄 Tự xoá'); LW.bgm = 'auto'; c = lwAutoBg(src, LW.holes); }
    finally { pr.close(); }
  } else if (LW.bgm === 'auto') c = lwAutoBg(src, LW.holes);
  else c = kitCopy(src);
  const old = LW.img; LW.img = lwCrop(c);
  if (old && LW.base) {   // keep the placement, fix the height to the new picture's shape
    const P = LW.base, c0 = P[0], c1 = P[3], wd = Math.hypot(c1.x - c0.x, c1.y - c0.y), hd = Math.hypot(P[12].x - c0.x, P[12].y - c0.y), want = wd * LW.img.height / LW.img.width;
    if (LW.mode === 'corner' && hd > 1) { const k = want / hd; const c2 = lwLerp(c0, P[12], k), c3 = lwLerp(c1, P[15], k); LW.base = lwFromCorners(c0, c1, c2, c3); }
  }
}
async function lwLoadFile(file) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { toast('Không đọc được ảnh'); return false; }
  const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = makeCanvas(w, h), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  LW.src = c; await lwCut(); if (!LW.base) lwPlace(); lwTarget(); lwSync(); lwDraw(); return true;
}
/* --- where the logo starts: on the chest of the selected character, else in the middle of the frame --- */
function lwPartBox(p, pose) {
  const M = ppMats(pose)[p.id], im = ppImg(p, pose && pose[p.id]); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const q = mApply(M, im.x + a * im.c.width, im.y + b * im.c.height); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function lwPlace() {
  const f = curFrame(), pose = S.pp ? ppPoseFor(f) : null, ch = S.pp && ppSelChar();
  const torso = ch && S.pp.parts.find(p => ppCharOf(p) === ch && p.role === 'torso') || (ch && ppPart(ch));
  let cx = W / 2, cy = H / 2, w = W * .3;
  let F = null; if (torso && torso.c) { const B = lwPartBox(torso, pose); cx = B.x + B.w * .64; cy = B.y + B.h * .3; w = Math.max(40, B.w * .3); F = B; }
  const h = w * LW.img.height / LW.img.width;
  LW.base = lwFromCorners({ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 }, { x: cx - w / 2, y: cy + h / 2 }, { x: cx + w / 2, y: cy + h / 2 });
  lwZoomTo(F || { x: cx - w * 2, y: cy - h * 2, w: w * 4, h: h * 4 });
}
// show this box (document space) big on the screen, so the small logo is easy to grab with a finger
function lwZoomTo(B) {
  const cv = $('#lwCv'); if (!cv) return; const pad = 1.5, k = Math.min(40, Math.max(lwV.k, Math.min(cv.width / (B.w * pad), cv.height / (B.h * pad))));
  lwV = { k, ox: cv.width / 2 - (B.x + B.w / 2) * k, oy: cv.height / 2 - (B.y + B.h / 2) * k }; lwPrevKey = '';
}
/* --- the target: a visible puppet piece under the logo's centre, else the drawing layer --- */
function lwLayerOf() { const f = curFrame(); return S.layer === 'bg' ? { o: bgOf(f), cv: () => bgOf(f).canvas, name: 'lớp Nền', col: false } : S.layer === 'col' ? { o: f, cv: () => colOf(f, true), name: 'lớp Màu', col: true } : { o: f, cv: () => f.canvas, name: 'lớp Nhân vật', col: false }; }
function lwTarget() {
  if (!LW.base) return;
  const f = curFrame(), pose = S.pp ? ppPoseFor(f) : null, c = lwEval(lwPts(), .5, .5), p = S.pp && S.showPP ? ppHit(c, pose) : null;
  const key = p ? p.id : 'L' + S.layer;
  if (LW.tgt && LW.tgt.key === key) return;
  if (p) {   // this piece alone, posed as on this frame, in document space: the ✂ clip of the preview
    const M = ppMats(pose)[p.id], im = ppImg(p, pose && pose[p.id]), m = makeCanvas(W, H), x = m.getContext('2d'); x.setTransform(...M); x.drawImage(im.c, im.x, im.y);
    LW.tgt = { key, p, mask: m, name: `mảnh "${charBaseName(p.name)}" (đi theo nhân vật ở mọi frame)` };
  } else { const L = lwLayerOf(); LW.tgt = { key, L, mask: LW.fg, name: `${L.name} của frame ${S.cur + 1}` }; }
  const t = $('#lwTgt'); if (t) t.textContent = 'Dán vào: ' + LW.tgt.name;
}
/* --- the logo as it will be pasted, in document space: warped, shaded by the shirt under it, clipped to the shirt --- */
function lwBake(N) {
  const P = lwPts(), O = lwOutline(P, 10); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of O) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  x0 = Math.max(0, Math.floor(x0 - 3)); y0 = Math.max(0, Math.floor(y0 - 3)); x1 = Math.min(W, Math.ceil(x1 + 3)); y1 = Math.min(H, Math.ceil(y1 + 3));
  const w = x1 - x0, h = y1 - y0; if (w < 1 || h < 1) return null;
  const c = makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.translate(-x0, -y0); lwDrawWarp(x, LW.img, P, N); x.setTransform(1, 0, 0, 1, 0, 0);
  const img = x.getImageData(0, 0, w, h), d = img.data, ud = LW.fg.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h).data;
  const md = LW.clip && LW.tgt && LW.tgt.mask ? (LW.tgt.mask === LW.fg ? ud : LW.tgt.mask.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h).data) : null;
  // the shirt's "lit" brightness under the logo (85th percentile): darker than that = fold / shadow / outline
  const Ls = []; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 40 && ud[i + 3] > 60) Ls.push(.299 * ud[i] + .587 * ud[i + 1] + .114 * ud[i + 2]);
  Ls.sort((a, b) => a - b); const Lref = Ls.length ? Math.max(30, Ls[Math.floor(Ls.length * .85)]) : 0;
  let cover = 0, all = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue; all++;
    if (Lref && ud[i + 3] > 20 && LW.shade > 0) {
      const f = Math.max(.15, Math.min(1.3, (.299 * ud[i] + .587 * ud[i + 1] + .114 * ud[i + 2]) / Lref)), s = LW.shade;
      for (let j = 0; j < 3; j++) d[i + j] = f <= 1 ? d[i + j] * (1 - (1 - f) * s) : d[i + j] + (255 - d[i + j]) * Math.min(1, f - 1) * s * .6;
    }
    let a = d[i + 3] * LW.op; if (md) { a *= md[i + 3] / 255; if (md[i + 3] > 20) cover++; }
    d[i + 3] = a;
  }
  if (md && all && cover < all * .05) return lwBakeNoClip(N);   // nothing under it: do not cut it all away
  x.putImageData(img, 0, 0); return { c, x: x0, y: y0, w, h };
}
function lwBakeNoClip(N) { const k = LW.clip; LW.clip = false; try { return lwBake(N); } finally { LW.clip = k; } }
/* --- paste --- */
async function lwApply() {
  const D = lwBake(32); if (!D) return false;
  const f = curFrame(), T = LW.tgt;
  if (T && T.p) {
    const p = T.p, pose = ppPoseFor(f), M = ppMats(pose)[p.id], im = ppImg(p, pose && pose[p.id]), h = im.holder;
    const c = kitCopy(im.c), x = c.getContext('2d'); x.setTransform(...mMul(mT(-im.x, -im.y), mInv(M))); if (LW.clip) x.globalCompositeOperation = 'source-atop'; x.drawImage(D.c, D.x, D.y);
    histFlush(); h.c = c; h.alpha = null; if (h === p) await encodePart(p); else await encodeHolder(h);
    S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); scheduleSave(); requestRender();
    toast('Đã dán logo lên ' + charBaseName(p.name) + ' — đi theo nhân vật ở mọi frame. Lỡ tay thì ↶ Hoàn tác', 4000);
  } else {
    const L = T.L; await ensureLoaded(L.o); const cv = L.cv(); if (!cv) { toast('Lớp này chưa có hình'); return false; }
    const kx = cv.getContext('2d'), rect = [D.x, D.y, D.w, D.h], before = kx.getImageData(...rect);
    kx.drawImage(D.c, D.x, D.y); const after = kx.getImageData(...rect);
    pushEntry(pixEntry(L.o, rect, before, after, L.col)); if (L.col) f.colVer++; markEdited(L.o); requestRender();
    toast('Đã dán logo vào ' + L.name + ' — ↶ Hoàn tác nếu chưa ưng', 3000);
  }
  return true;
}
/* --- the editor --- */
let lwV = { k: 1, ox: 0, oy: 0 }, lwRaf = 0, lwPrev = null, lwPrevKey = '';
const lwDpr = () => Math.min(2, window.devicePixelRatio || 1);
function lwFit() { const cv = $('#lwCv'), r = cv.getBoundingClientRect(), dp = lwDpr(); cv.width = Math.round(r.width * dp); cv.height = Math.round(r.height * dp); const k = Math.min(cv.width / W, cv.height / H) * .94; lwV = { k, ox: (cv.width - W * k) / 2, oy: (cv.height - H * k) / 2 }; }
const lwScr = p => ({ x: p.x * lwV.k + lwV.ox, y: p.y * lwV.k + lwV.oy });
const lwDoc = (sx, sy) => ({ x: (sx - lwV.ox) / lwV.k, y: (sy - lwV.oy) / lwV.k });
function lwDraw() { if (LW.on && !$('#lwOv')) lwClose(); if (!lwRaf && LW.on) lwRaf = requestAnimationFrame(lwPaint); }
function lwPaint() {
  lwRaf = 0; const cv = $('#lwCv'); if (!cv || !LW.on) return; const x = cv.getContext('2d'), dp = lwDpr();
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#1b1b22'; x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(lwV.k, 0, 0, lwV.k, lwV.ox, lwV.oy); x.drawImage(LW.snap, 0, 0);
  if (!LW.img || !LW.base) return;
  const key = JSON.stringify([lwPts(), LW.shade, LW.op, LW.clip, LW.tgt && LW.tgt.key, LW.img.width]);
  if (key !== lwPrevKey) { lwPrev = lwBake(LW.drag ? 12 : 20); lwPrevKey = LW.drag ? '' : key; }
  if (lwPrev) x.drawImage(lwPrev.c, lwPrev.x, lwPrev.y);
  // the grid and the handles (screen space)
  x.setTransform(1, 0, 0, 1, 0, 0); const P = lwPts(), G = 8;
  x.strokeStyle = 'rgba(0,170,255,.85)'; x.lineWidth = 1.5 * dp;
  for (let i = 0; i <= 3; i++) for (const dir of [0, 1]) { x.beginPath(); for (let k = 0; k <= G * 3; k++) { const t = k / (G * 3), q = lwScr(dir ? lwEval(P, i / 3, t) : lwEval(P, t, i / 3)); k ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); } x.stroke(); }
  const hs = LW.mode === 'mesh' ? [...Array(16).keys()] : [0, 3, 12, 15];
  for (const n of hs) { const q = lwScr(LW.base[n]), corner = n === 0 || n === 3 || n === 12 || n === 15, r = (corner ? 11 : 8) * dp;
    x.beginPath(); x.arc(q.x, q.y, r, 0, 7); x.fillStyle = LW.hot === n ? '#ff4081' : corner ? '#fff' : '#bfe6ff'; x.fill(); x.lineWidth = 2.5 * dp; x.strokeStyle = '#0091ea'; x.stroke(); }
}
function lwHit(sx, sy) {
  const dp = lwDpr(), hs = LW.mode === 'mesh' ? [0, 3, 12, 15, ...[...Array(16).keys()].filter(n => ![0, 3, 12, 15].includes(n))] : [0, 3, 12, 15];
  let best = -1, bd = 30 * dp; for (const n of hs) { const q = lwScr(LW.base[n]), d = Math.hypot(q.x - sx, q.y - sy); if (d < bd - (n === 0 || n === 3 || n === 12 || n === 15 ? 4 * dp : 0)) { bd = d; best = n; } }
  if (best >= 0) return { n: best };
  if (lwInside(lwOutline(lwPts(), 10).map(lwScr), { x: sx, y: sy })) return { all: true };
  return null;
}
// move one control point (corner in ⬚ mode = re-fit the patch; corner in ▦ mode drags its neighbours too, like Photoshop's handles)
function lwMovePt(n, dx, dy) {
  const B = LW.base.map(p => ({ ...p }));
  if (LW.mode === 'corner') { B[n].x += dx; B[n].y += dy; LW.base = lwFromCorners(B[0], B[3], B[12], B[15]); return; }
  const i = Math.floor(n / 4), j = n % 4, corner = (i === 0 || i === 3) && (j === 0 || j === 3);
  const mv = (ii, jj, k = 1) => { if (ii < 0 || jj < 0 || ii > 3 || jj > 3) return; const q = B[ii * 4 + jj]; q.x += dx * k; q.y += dy * k; };
  mv(i, j);
  if (corner) { const di = i ? -1 : 1, dj = j ? -1 : 1; mv(i + di, j); mv(i, j + dj); mv(i + di, j + dj, .5); }
  LW.base = B;
}
function lwXform(fn) { const P = LW.base, c = P.reduce((a, p) => ({ x: a.x + p.x / 16, y: a.y + p.y / 16 }), { x: 0, y: 0 }); LW.base = P.map(p => { const q = fn(p.x - c.x, p.y - c.y); return { x: c.x + q.x, y: c.y + q.y }; }); lwTarget(); lwDraw(); }
function lwSync() {
  const ov = $('#lwOv'); if (!ov) return;
  ov.querySelectorAll('[data-lwbg]').forEach(b => b.classList.toggle('on', b.dataset.lwbg === LW.bgm));
  ov.querySelectorAll('[data-lwm]').forEach(b => b.classList.toggle('on', b.dataset.lwm === LW.mode));
  $('#lwHoles').checked = LW.holes; $('#lwClip').checked = LW.clip;
  $('#lwWrap').value = Math.round(LW.wrap * 100); $('#lwShade').value = Math.round(LW.shade * 100); $('#lwOp').value = Math.round(LW.op * 100);
  $('#lwEmpty').hidden = !!LW.img; $('#lwOk').disabled = !LW.img;
}
function lwPick() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { if (i.files[0]) lwLoadFile(i.files[0]); }; i.click(); }
async function lwOpen(file) {
  if (LW.on && $('#lwOv')) { if (file) await lwLoadFile(file); return; }
  if (playing) stopPlay(); commitFloating();
  const f = curFrame(), bg = bgOf(f); await ensureLoaded(f); if (bg) await ensureLoaded(bg);
  LW.snap = makeCanvas(W, H); drawFrameBase(LW.snap.getContext('2d'), f, bg, false);
  LW.fg = makeCanvas(W, H); { const x = LW.fg.getContext('2d'); drawCol(x, f); if (f.canvas && S.showChar) x.drawImage(f.canvas, 0, 0); if (S.pp && S.showPP) drawPuppet(x, f.pp, f.lip); if (S.showVec) drawVec(x, f.vec); }
  Object.assign(LW, { on: true, img: null, src: null, base: null, tgt: null, wrap: 0, hot: -1, drag: null }); lwPrevKey = '';
  const ov = document.createElement('div'); ov.id = 'lwOv'; ov.className = 'ov';   // .ov: closes with the other dialogs
  const rng = (id, lbl, min, max, title) => `<label class="lwR" title="${title}">${lbl}<input type="range" id="${id}" min="${min}" max="${max}"></label>`;
  ov.innerHTML = `<div class="lwBar"><b>🏷 Dán logo lên áo</b><span id="lwTgt" class="lbl"></span><span style="flex:1"></span>
      <button class="chip small on" id="lwPick">🖼 Chọn ảnh logo</button>
      <span class="lbl">Nền:</span><button class="chip small" data-lwbg="auto" title="Xoá phông nền một màu (giấy trắng, nền xanh…) quanh logo">🪄 Tự xoá</button><button class="chip small" data-lwbg="ai" title="Tách nền bằng AI (ảnh chụp, nền nhiều màu)">🤖 AI tách nền</button><button class="chip small" data-lwbg="none">Giữ nền</button>
      <label class="lbl" title="Xoá cả phần nền nằm trong chữ (lỗ của chữ O, A…)"><input type="checkbox" id="lwHoles"> Xoá cả lỗ trong chữ</label></div>
    <div class="lwStage"><canvas id="lwCv"></canvas><div id="lwEmpty" class="lwEmpty">Kéo ảnh logo vào đây, dán (Ctrl+V) hoặc bấm <b>🖼 Chọn ảnh logo</b>.<br>Kéo 4 chấm góc để đặt logo, ▦ Uốn lưới để bẻ cong từng chỗ, 2 ngón để phóng to.</div></div>
    <div class="lwBar"><button class="chip small" data-lwm="corner" title="Kéo 4 góc (như Distort / Perspective của Photoshop)">⬚ 4 góc</button><button class="chip small" data-lwm="mesh" title="16 chấm như Warp của Photoshop: kéo chấm giữa để uốn cong logo theo nếp áo">▦ Uốn lưới</button>
      ${rng('lwWrap', '〰 Ôm áo', -100, 100, 'Bẻ cong cả logo như ôm quanh ngực (kéo phải = cong xuống, trái = cong lên)')}
      ${rng('lwShade', '🎨 Hoà vào áo', 0, 100, 'Logo ăn theo nếp gấp, bóng và nét viền của áo bên dưới (như blend Multiply)')}
      ${rng('lwOp', 'Đậm', 10, 100, 'Độ đậm của logo')}
      <label class="lbl" title="Phần logo thò ra ngoài áo bị cắt bỏ"><input type="checkbox" id="lwClip"> ✂ Chỉ trên áo</label>
      <button class="chip small" data-lwx="s-" title="Nhỏ lại">−</button><button class="chip small" data-lwx="s+" title="To lên">＋</button><button class="chip small" data-lwx="r-" title="Xoay trái">⟲</button><button class="chip small" data-lwx="r+" title="Xoay phải">⟳</button><button class="chip small" data-lwx="flat" title="Bỏ uốn, về hình chữ nhật">↺ Thẳng lại</button>
      <span style="flex:1"></span><button class="btn" id="lwCancel">Huỷ</button><button class="btn primary" id="lwOk">✓ Dán</button></div>`;
  document.body.append(ov); lwFit();
  const on = (sel, ev, fn) => ov.querySelectorAll(sel).forEach(b => b.addEventListener(ev, fn));
  on('#lwPick', 'click', lwPick);
  on('[data-lwbg]', 'click', async e => { LW.bgm = e.currentTarget.dataset.lwbg; lwSync(); if (LW.src) { await lwCut(); lwPrevKey = ''; lwDraw(); } lwSync(); });
  on('#lwHoles', 'change', async e => { LW.holes = e.target.checked; if (LW.src && LW.bgm === 'auto') { await lwCut(); lwPrevKey = ''; lwDraw(); } });
  on('[data-lwm]', 'click', e => { LW.mode = e.currentTarget.dataset.lwm; if (LW.mode === 'corner' && LW.base) LW.base = lwFromCorners(LW.base[0], LW.base[3], LW.base[12], LW.base[15]); lwSync(); lwDraw(); });
  on('#lwWrap', 'input', e => { LW.wrap = e.target.value / 100; lwDraw(); });
  on('#lwShade', 'input', e => { LW.shade = e.target.value / 100; lwDraw(); });
  on('#lwOp', 'input', e => { LW.op = e.target.value / 100; lwDraw(); });
  on('#lwClip', 'change', e => { LW.clip = e.target.checked; lwDraw(); });
  on('[data-lwx]', 'click', e => { if (!LW.base) return; const k = e.currentTarget.dataset.lwx, a = (k === 'r+' ? 5 : -5) * DEG;
    if (k === 's-' || k === 's+') lwXform((x, y) => ({ x: x * (k === 's+' ? 1.1 : 1 / 1.1), y: y * (k === 's+' ? 1.1 : 1 / 1.1) }));
    else if (k === 'flat') { LW.wrap = 0; LW.base = lwFromCorners(LW.base[0], LW.base[3], LW.base[12], LW.base[15]); lwSync(); lwTarget(); lwDraw(); }
    else lwXform((x, y) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) })); });
  on('#lwCancel', 'click', () => lwClose());
  on('#lwOk', 'click', async () => { if (await lwApply()) lwClose(); });
  // pointers: 1 = drag a point / the whole logo / pan; 2 = pinch zoom + pan
  const cv = $('#lwCv'), pts = new Map(); let pinch = null;
  const sp = e => { const r = cv.getBoundingClientRect(), dp = lwDpr(); return { x: (e.clientX - r.left) * dp, y: (e.clientY - r.top) * dp }; };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, sp(e));
    if (pts.size === 2) { LW.drag = null; LW.hot = -1; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v: { ...lwV } }; return; }
    const p = sp(e), h = LW.base ? lwHit(p.x, p.y) : null;
    LW.drag = h ? { ...h, last: lwDoc(p.x, p.y) } : { pan: true, last: p }; LW.hot = h && h.n != null ? h.n : -1; lwDraw();
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, sp(e));
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, k = Math.max(.2, Math.min(40, pinch.v.k * d / (pinch.d || 1)));
      const dc = { x: (pinch.m.x - pinch.v.ox) / pinch.v.k, y: (pinch.m.y - pinch.v.oy) / pinch.v.k }; lwV = { k, ox: m.x - dc.x * k, oy: m.y - dc.y * k }; lwPrevKey = ''; lwDraw(); return; }
    const D = LW.drag; if (!D) return; const p = sp(e);
    if (D.pan) { lwV.ox += p.x - D.last.x; lwV.oy += p.y - D.last.y; D.last = p; lwDraw(); return; }
    const q = lwDoc(p.x, p.y), dx = q.x - D.last.x, dy = q.y - D.last.y; D.last = q;
    if (D.all) LW.base = LW.base.map(o => ({ x: o.x + dx, y: o.y + dy })); else lwMovePt(D.n, dx, dy);
    lwDraw();
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { const was = LW.drag; LW.drag = null; LW.hot = -1; if (was && !was.pan) lwTarget(); lwPrevKey = ''; lwDraw(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = sp(e), k = Math.max(.2, Math.min(40, lwV.k * Math.exp(-e.deltaY * .0015))), dc = lwDoc(p.x, p.y); lwV = { k, ox: p.x - dc.x * k, oy: p.y - dc.y * k }; lwPrevKey = ''; lwDraw(); }, { passive: false });
  ov.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
  ov.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const f2 = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(q => /^image\//.test(q.type)); if (f2) lwLoadFile(f2); });
  lwSync(); lwDraw();
  if (file) await lwLoadFile(file);
}
function lwClose() { const ov = $('#lwOv'); if (ov) ov.remove(); LW.on = false; LW.snap = LW.fg = null; lwPrev = null; if (LW.tgt) LW.tgt.mask = null; LW.tgt = null; }
window.addEventListener('resize', () => { if (LW.on) { lwFit(); lwPrevKey = ''; lwDraw(); } });
document.addEventListener('keydown', e => { if (!LW.on) return; if (!$('#lwOv')) { lwClose(); return; } e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); lwClose(); } }, true);   // the app's shortcuts wait while the editor is open
document.addEventListener('paste', e => {
  if (!LW.on || !$('#lwOv')) return; const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(q => /^image\//.test(q.type));
  if (f) { e.preventDefault(); e.stopPropagation(); lwLoadFile(f); }
}, true);
$('#lwBtn').addEventListener('click', () => lwOpen());
