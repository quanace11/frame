/* ========= Image processing ========= */
function boxBlur(src, w, h, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w; let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) { tmp[row + x] = acc / d; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / d; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}
function gauss(src, w, h, r) { let a = boxBlur(src, w, h, Math.max(1, Math.round(r / 1.7))); a = boxBlur(a, w, h, Math.max(1, Math.round(r / 1.7))); return boxBlur(a, w, h, Math.max(1, Math.round(r / 1.7))); }
function maxFilter(a, w, h, r) {
  if (r < 1) return a;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = -r; k <= r; k++) { const v = a[y * w + clamp(x + k, 0, w - 1)]; if (v > m) m = v; } tmp[y * w + x] = m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = -r; k <= r; k++) { const v = tmp[clamp(y + k, 0, h - 1) * w + x]; if (v > m) m = v; } out[y * w + x] = m; }
  return out;
}
function grayOf(img) { const d = img.data, n = img.width * img.height, g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return g; }
/** Line art: dark-relative-to-surroundings detector (difference of gaussians). Returns alpha 0..1 */
function lineArtAlpha(img, detail, thick, forVec) {
  const w = img.width, h = img.height, g = grayOf(img);
  const scale = Math.max(w, h) / 1000;
  // for vectors use a wide surround so thick strokes come out solid (one centre line, not two edges)
  const g1 = forVec ? g : gauss(g, w, h, Math.max(1, 1 * scale)), g2 = gauss(g, w, h, Math.max(2, (forVec ? 18 : 4) * scale));
  const t = 22 - detail * 0.2;          // detail 0..100 -> threshold 22..2
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) { const diff = g2[i] - g1[i]; a[i] = clamp((diff - t) / Math.max(2, t), 0, 1); }
  // keep solid dark areas too (hair, black clothes) as fill
  return maxFilter(a, w, h, thick);
}
/** Ink detector for drawn art: dark + low-colour pixels that stand out locally.
 *  Coloured fills (red shirt, green shorts) are ignored; big black areas (hair, shoes) come out as an outline ring. */
function inkAlpha(img, detail) {
  const w = img.width, h = img.height, d = img.data, n = w * h, scale = Math.max(w, h) / 1000;
  const ink = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], al = d[i * 4 + 3] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    ink[i] = Math.max(0, (255 - mx) - (mx - mn) * 0.7) * al;
  }
  const bg = gauss(ink, w, h, Math.max(3, 7 * scale));
  const t = 175 - detail * 1.4;           // detail 0..100 -> threshold 175..35
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = ink[i];
    a[i] = clamp((v - t) / 25, 0, 1) * clamp((v - bg[i] - 6) / 22, 0, 1);
  }
  return a;
}
/** Split a coloured drawing into two layers: the dark outlines (→ Nhân vật pixels) and the picture's own colours (→ Màu layer).
 *  Every area keeps its colour, and the colour also runs under the lines (each line pixel takes the nearest clean colour),
 *  so erasing a line later leaves no hole. fig = figure alpha 0..1 (after background removal) or null for the whole image.
 *  flat: shading inside each closed area is snapped to its few main colours (like filling with the bucket). */
function splitLineColor(img, fig, sens, flat) {
  const w = img.width, h = img.height, n = w * h, d = img.data;
  const A = i => fig ? fig[i] : d[i * 4 + 3] / 255;
  const la = inkAlpha(img, sens);
  for (let i = 0; i < n; i++) la[i] *= A(i);
  const near = maxFilter(la, w, h, 1), isLine = new Uint8Array(n);   // soft edge next to a line is a mix of line + fill: not a clean colour
  for (let i = 0; i < n; i++) if (la[i] > 0.08 || near[i] > 0.3) isLine[i] = 1;
  const rgb = new Uint8ClampedArray(n * 3), has = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!isLine[i] && A(i) > 0.5) { has[i] = 1; rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; }
  if (flat) {
    const seen = new Uint8Array(n), cnt = new Int32Array(4096), sr = new Float64Array(4096), sg = new Float64Array(4096), sb = new Float64Array(4096);
    let comp = new Int32Array(1024);
    for (let s0 = 0; s0 < n; s0++) {
      if (!has[s0] || seen[s0]) continue;
      let len = 0; seen[s0] = 1; comp[len++] = s0;
      for (let q = 0; q < len; q++) {
        const i = comp[q], x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < n && has[j] && !seen[j]) {
          seen[j] = 1; if (len === comp.length) { const c2 = new Int32Array(comp.length * 2); c2.set(comp); comp = c2; } comp[len++] = j;
        }
      }
      const touched = [];
      for (let q = 0; q < len; q++) { const j = comp[q] * 3, r = rgb[j], g = rgb[j + 1], b = rgb[j + 2], k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
        if (!cnt[k]) touched.push(k); cnt[k]++; sr[k] += r; sg[k] += g; sb[k] += b; }
      touched.sort((a, b) => cnt[b] - cnt[a]);
      const seeds = [], minC = Math.max(len * 0.04, 12);
      for (const k of touched) {
        if (cnt[k] < minC && seeds.length) break;
        const c = [sr[k] / cnt[k], sg[k] / cnt[k], sb[k] / cnt[k]];
        if (seeds.length < 8 && !seeds.some(s => Math.abs(s[0] - c[0]) + Math.abs(s[1] - c[1]) + Math.abs(s[2] - c[2]) < 40)) seeds.push(c);
      }
      for (const k of touched) { cnt[k] = 0; sr[k] = sg[k] = sb[k] = 0; }
      // assign every pixel to its nearest main colour, then paint it with that group's average
      const asg = new Int8Array(len), acc = seeds.map(() => [0, 0, 0, 0]);
      for (let q = 0; q < len; q++) {
        const j = comp[q] * 3; let best = -1, bd = 90;   // far from every main colour (small detail): keep it as it is
        for (let s = 0; s < seeds.length; s++) { const e = Math.abs(rgb[j] - seeds[s][0]) + Math.abs(rgb[j + 1] - seeds[s][1]) + Math.abs(rgb[j + 2] - seeds[s][2]); if (e < bd) { bd = e; best = s; } }
        asg[q] = best; if (best >= 0) { const a = acc[best]; a[0] += rgb[j]; a[1] += rgb[j + 1]; a[2] += rgb[j + 2]; a[3]++; }
      }
      for (let q = 0; q < len; q++) { const s = asg[q]; if (s < 0) continue; const a = acc[s], j = comp[q] * 3; rgb[j] = a[0] / a[3]; rgb[j + 1] = a[1] / a[3]; rgb[j + 2] = a[2] / a[3]; }
    }
  }
  // colour runs under the lines: breadth-first from every clean pixel into the line pixels of the figure
  const q = new Int32Array(n); let qh = 0, qt = 0;
  const filled = has.slice();
  for (let i = 0; i < n; i++) if (has[i]) { const x = i % w; if ((x > 0 && !has[i - 1]) || (x < w - 1 && !has[i + 1]) || (i >= w && !has[i - w]) || (i + w < n && !has[i + w])) q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= n || filled[j] || !isLine[j] || A(j) < 0.05) continue;
      filled[j] = 1; rgb[j * 3] = rgb[i * 3]; rgb[j * 3 + 1] = rgb[i * 3 + 1]; rgb[j * 3 + 2] = rgb[i * 3 + 2]; q[qt++] = j;
    }
  }
  const col = makeCanvas(w, h), cx = col.getContext('2d'), ci = cx.createImageData(w, h), cd = ci.data;
  const line = makeCanvas(w, h), lx = line.getContext('2d'), li = lx.createImageData(w, h), ld = li.data;
  let nLine = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    if (filled[i]) { cd[j] = rgb[i * 3]; cd[j + 1] = rgb[i * 3 + 1]; cd[j + 2] = rgb[i * 3 + 2]; cd[j + 3] = isLine[i] ? Math.round(255 * Math.max(A(i), la[i])) : Math.round(255 * A(i)); }
    if (la[i] > 0.02) {
      // line colour = the darkest pixel close by (soft edges are mixed with the fill and look washed out)
      const x = i % w, y = (i - x) / w; let bk = i, bv = 1e9;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const k = yy * w + xx, v = d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2]; if (v < bv && la[k] > 0.3) { bv = v; bk = k; } }
      ld[j] = d[bk * 4]; ld[j + 1] = d[bk * 4 + 1]; ld[j + 2] = d[bk * 4 + 2]; ld[j + 3] = Math.round(255 * la[i]); if (la[i] > 0.5) nLine++;
    }
  }
  cx.putImageData(ci, 0, 0); lx.putImageData(li, 0, 0);
  return { line, col, nLine };
}
/** Background removal by border colour flood fill (good for flat cartoon backgrounds). Returns alpha 0..1 */
function colorBgAlpha(img, tol, holesOut) {
  const w = img.width, h = img.height, d = img.data, n = w * h;
  const bins = new Map();
  const borderIdx = [];
  for (let x = 0; x < w; x++) borderIdx.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) borderIdx.push(y * w, y * w + w - 1);
  for (const i of borderIdx) { const k = (d[i * 4] >> 4) << 8 | (d[i * 4 + 1] >> 4) << 4 | (d[i * 4 + 2] >> 4); bins.set(k, (bins.get(k) || 0) + 1); }
  const seeds = [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, c]) => c > borderIdx.length * 0.08)
    .map(([k]) => [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8]);
  const isBg = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; for (const s of seeds) if (Math.abs(r - s[0]) + Math.abs(g - s[1]) + Math.abs(b - s[2]) <= tol) return true; return false; };
  const bg = new Uint8Array(n), stack = [];
  for (const i of borderIdx) if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of nb) if (j >= 0 && j < n && !bg[j] && isBg(j)) { bg[j] = 1; stack.push(j); }
  }
  const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = bg[i] ? 0 : 1;
  if (holesOut) {   // background-coloured areas closed in by the figure (gap between an arm and the body, eye whites, white logos…)
    const seen = new Uint8Array(n), minA = Math.max(30, n * 0.0002);
    for (let s0 = 0; s0 < n; s0++) {
      if (bg[s0] || seen[s0] || !isBg(s0)) continue;
      const comp = [s0]; seen[s0] = 1;
      for (let q = 0; q < comp.length; q++) { const i = comp[q], x = i % w; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < n && !seen[j] && !bg[j] && isBg(j)) { seen[j] = 1; comp.push(j); } }
      if (comp.length >= minA) holesOut.push(comp);
    }
  }
  return boxBlur(a, w, h, 1);
}
/** true when the image border is mostly one flat colour (drawn character on a plain background) */
function flatBorder(img) {
  const w = img.width, h = img.height, d = img.data, idx = [];
  for (let x = 0; x < w; x += 2) idx.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 2) idx.push(y * w, y * w + w - 1);
  const bins = new Map(); for (const i of idx) { const k = (d[i * 4] >> 4) << 8 | (d[i * 4 + 1] >> 4) << 4 | (d[i * 4 + 2] >> 4); bins.set(k, (bins.get(k) || 0) + 1); }
  const [k] = [...bins.entries()].sort((a, b) => b[1] - a[1])[0], c = [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8];
  let ok = 0; for (const i of idx) if (Math.abs(d[i * 4] - c[0]) + Math.abs(d[i * 4 + 1] - c[1]) + Math.abs(d[i * 4 + 2] - c[2]) < 50) ok++;
  return ok / idx.length > 0.85;
}
/* AI background removal (u2netp, runs locally in the browser) */
let ortSession = null, ortLoading = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('không tải được ' + src)); document.head.append(s); }); }
function getOrt() {
  if (ortSession) return Promise.resolve(ortSession);
  if (!ortLoading) ortLoading = (async () => {
    if (!window.ort) await loadScript('./ort.wasm.min.js');
    const base = new URL('./', document.baseURI).href;
    ort.env.wasm.wasmPaths = base; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    if (!window.U2NETP_B64) await loadScript('./u2netp-model.js');
    const bin = atob(window.U2NETP_B64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    window.U2NETP_B64 = null;
    ortSession = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
    return ortSession;
  })().catch(e => { ortLoading = null; throw e; });
  return ortLoading;
}
async function aiMask(srcCanvas) {
  const sess = await getOrt();
  const S2 = 320, c = makeCanvas(S2, S2), x = c.getContext('2d');
  x.drawImage(srcCanvas, 0, 0, S2, S2);
  const d = x.getImageData(0, 0, S2, S2).data, n = S2 * S2, inp = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) inp[ch * n + i] = (d[i * 4 + ch] / 255 - mean[ch]) / std[ch];
  const feeds = {}; feeds[sess.inputNames[0]] = new ort.Tensor('float32', inp, [1, 3, S2, S2]);
  const out = await sess.run(feeds); const m = out[sess.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
  const mc = makeCanvas(S2, S2), mx = mc.getContext('2d'), mi = mx.createImageData(S2, S2);
  for (let i = 0; i < n; i++) { const v = Math.round((m[i] - lo) / (hi - lo || 1) * 255); mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = v; mi.data[i * 4 + 3] = 255; }
  mx.putImageData(mi, 0, 0);
  // upscale to source size (smooth)
  const big = makeCanvas(srcCanvas.width, srcCanvas.height), bx = big.getContext('2d');
  bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high'; bx.drawImage(mc, 0, 0, big.width, big.height);
  const bd = bx.getImageData(0, 0, big.width, big.height).data, a = new Float32Array(big.width * big.height);
  for (let i = 0; i < a.length; i++) a[i] = bd[i * 4] / 255;
  return a;
}
function sharpenMask(a, edge) { // edge 0..100: 0 soft, 100 hard
  const lo = 0.5 - (1 - edge / 100) * 0.45 - 0.02, hi = 0.5 + (1 - edge / 100) * 0.45 + 0.02;
  const out = new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = clamp((a[i] - lo) / (hi - lo), 0, 1); return out;
}

