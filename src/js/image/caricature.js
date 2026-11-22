/* ========= Caricature: photo → big-head cartoon (runs locally, uses the u2netp cut-out) ========= */
/** Find the head from the cut-out alpha: the neck is the narrowest row with something wider above (head) and below (shoulders). */
function cariFindHead(a, w, h) {
  const ws = new Float32Array(h), xs = new Float32Array(h); let top = -1, bot = -1;
  for (let y = 0; y < h; y++) {
    let c = 0, sx = 0; for (let x = 0; x < w; x++) if (a[y * w + x] > 0.5) { c++; sx += x; }
    ws[y] = c; xs[y] = c ? sx / c : -1;
    if (c > Math.max(2, w * 0.01)) { if (top < 0) top = y; bot = y; }
  }
  if (top < 0 || bot - top < 20) return null;
  const H = bot - top + 1, r = Math.max(2, Math.round(H * 0.012)), sm = new Float32Array(h);
  for (let y = top; y <= bot; y++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= top && yy <= bot) { s += ws[yy]; n++; } } sm[y] = s / n; }
  let best = Infinity, neck = Math.round(top + H * 0.3), runMax = 0;
  const y0 = Math.round(top + H * 0.08), y1 = Math.round(top + H * 0.75), look = Math.round(H * 0.25);
  for (let y = top; y <= y1; y++) {
    runMax = Math.max(runMax, sm[y]);
    if (y < y0) continue;
    let below = 0; for (let k = y; k <= Math.min(bot, y + look); k++) if (sm[k] > below) below = sm[k];
    const s = sm[y] / Math.max(1, Math.min(runMax, below));
    if (s < best) { best = s; neck = y; }
  }
  if (best > 0.85) neck = bot;                        // no clear neck (face close-up): the whole cut-out is the head
  else { const lim = sm[neck] * 1.15; while (neck > y0 && sm[neck - 1] <= lim) neck--; }   // a long neck: cut just under the chin, not at the shoulders
  const cs = []; let hw = 0;
  for (let y = top; y < neck; y++) if (xs[y] >= 0) { cs.push(xs[y]); if (sm[y] > hw) hw = sm[y]; }
  cs.sort((p, q) => p - q);
  return { top, bot, neck, cx: cs.length ? cs[cs.length >> 1] : w / 2, hw: Math.max(hw, 4) };
}
/** Edge-preserving smoothing (bilateral) on rgb floats, only inside the figure */
function cariBilateral(rgb, a, w, h, r, sc) {
  const out = new Float32Array(rgb.length), lut = new Float32Array(766);
  for (let i = 0; i < 766; i++) lut[i] = Math.exp(-(i * i) / (2 * sc * sc));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = i * 3;
    if (a[i] < 0.02) { out[j] = rgb[j]; out[j + 1] = rgb[j + 1]; out[j + 2] = rgb[j + 2]; continue; }
    const r0 = rgb[j], g0 = rgb[j + 1], b0 = rgb[j + 2]; let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx; if (xx < 0 || xx >= w) continue;
        const k = yy * w + xx; if (a[k] < 0.02) continue; const q = k * 3;
        const wt = lut[Math.min(765, (Math.abs(rgb[q] - r0) + Math.abs(rgb[q + 1] - g0) + Math.abs(rgb[q + 2] - b0)) | 0)];
        sr += rgb[q] * wt; sg += rgb[q + 1] * wt; sb += rgb[q + 2] * wt; sw += wt;
      }
    }
    out[j] = sr / sw; out[j + 1] = sg / sw; out[j + 2] = sb / sw;
  }
  return out;
}
/** Flat colours: k-means on the figure's colours, then snap each pixel to its cluster (mix keeps a hint of shading) */
function cariQuant(rgb, a, n, k, mix) {
  const samp = [], step = Math.max(1, Math.floor(n / 15000));
  for (let i = 0; i < n; i += step) if (a[i] > 0.5) samp.push(i);
  if (samp.length < k * 4) return;
  const lum = i => rgb[i * 3] * 0.299 + rgb[i * 3 + 1] * 0.587 + rgb[i * 3 + 2] * 0.114;
  const sorted = samp.slice().sort((p, q) => lum(p) - lum(q));
  let cen = []; for (let c = 0; c < k; c++) { const i = sorted[Math.floor((c + 0.5) / k * sorted.length)]; cen.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]); }
  const near = j => { let bi = 0, bd = Infinity; for (let c = 0; c < k; c++) { const e = cen[c], d = (rgb[j] - e[0]) ** 2 + (rgb[j + 1] - e[1]) ** 2 + (rgb[j + 2] - e[2]) ** 2; if (d < bd) { bd = d; bi = c; } } return bi; };
  for (let it = 0; it < 8; it++) {
    const acc = cen.map(() => [0, 0, 0, 0]);
    for (const i of samp) { const c = near(i * 3), A = acc[c]; A[0] += rgb[i * 3]; A[1] += rgb[i * 3 + 1]; A[2] += rgb[i * 3 + 2]; A[3]++; }
    cen = cen.map((e, c) => acc[c][3] ? [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]] : e);
  }
  for (let i = 0; i < n; i++) {
    if (a[i] < 0.02) continue; const j = i * 3, e = cen[near(j)];
    rgb[j] = e[0] * mix + rgb[j] * (1 - mix); rgb[j + 1] = e[1] * mix + rgb[j + 1] * (1 - mix); rgb[j + 2] = e[2] * mix + rgb[j + 2] * (1 - mix);
  }
}
/** Cartoon colouring + inner ink lines. style: 'flat' | 'soft' | 'bw'; detail 0..100 */
function cariToon(img, a, style, detail) {
  const w = img.width, h = img.height, n = w * h, s = img.data;
  if (style === 'orig') {   // already a drawing: keep its own colours and lines
    const out = makeCanvas(w, h), x = out.getContext('2d'), im = x.createImageData(w, h);
    im.data.set(s); for (let i = 0; i < n; i++) im.data[i * 4 + 3] = Math.round(a[i] * s[i * 4 + 3]);
    x.putImageData(im, 0, 0); return out;
  }
  let rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { rgb[i * 3] = s[i * 4]; rgb[i * 3 + 1] = s[i * 4 + 1]; rgb[i * 3 + 2] = s[i * 4 + 2]; }
  rgb = cariBilateral(rgb, a, w, h, 2, 38); rgb = cariBilateral(rgb, a, w, h, 2, 30);
  const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = rgb[i * 3] * 0.299 + rgb[i * 3 + 1] * 0.587 + rgb[i * 3 + 2] * 0.114;
  if (style === 'bw') { for (let i = 0; i < n; i++) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = Math.min(255, g[i] * 1.08 + 10); cariQuant(rgb, a, n, 4, 1); }
  else {
    const sat = style === 'flat' ? 1.4 : 1.25;
    for (let i = 0; i < n; i++) { const j = i * 3; for (let c = 0; c < 3; c++) rgb[j + c] = clamp(g[i] + (rgb[j + c] - g[i]) * sat + 6, 0, 255); }
    if (style === 'flat') cariQuant(rgb, a, n, 10, 0.8);
  }
  // ink lines: dark-relative-to-surroundings (difference of gaussians), kept away from the cut edge
  const g1 = boxBlur(g, w, h, 1), g2 = gauss(g, w, h, 5), t = 16 - detail * 0.14;
  const er = maxFilter(a.map(v => 1 - v), w, h, 2);
  const out = makeCanvas(w, h), x = out.getContext('2d'), im = x.createImageData(w, h), d = im.data;
  for (let i = 0; i < n; i++) {
    const L = clamp((g2[i] - g1[i] - t) / (t * 0.8 + 3), 0, 1) * (1 - er[i]), j = i * 3, k = i * 4;
    d[k] = rgb[j] * (1 - L) + 30 * L; d[k + 1] = rgb[j + 1] * (1 - L) + 26 * L; d[k + 2] = rgb[j + 2] * (1 - L) + 34 * L; d[k + 3] = Math.round(a[i] * 255);
  }
  x.putImageData(im, 0, 0); return out;
}
/** Bulge (fish-eye) around the face centre: k 0..0.7 magnifies the middle of the face */
function cariBulge(c, cx, cy, R, k) {
  if (k <= 0.001 || R < 4) return;
  const w = c.width, h = c.height, x = c.getContext('2d'), s = x.getImageData(0, 0, w, h).data, out = x.createImageData(w, h), d = out.data;
  d.set(s);
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
  for (let y = y0; y <= y1; y++) for (let X = x0; X <= x1; X++) {
    const dx = X - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r >= R) continue;
    const t = r / R, f = 1 - k * (1 - t) * (1 - t), sx = clamp(cx + dx * f, 0, w - 1.001), sy = clamp(cy + dy * f, 0, h - 1.001);
    const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, p = (iy * w + ix) * 4, q = p + w * 4, o = (y * w + X) * 4;
    for (let ch = 0; ch < 4; ch++) d[o + ch] = (s[p + ch] * (1 - fx) + s[p + 4 + ch] * fx) * (1 - fy) + (s[q + ch] * (1 - fx) + s[q + 4 + ch] * fx) * fy;
  }
  x.putImageData(out, 0, 0);
}
/** Put it together: big head + small body around the neck, face bulge, thick outer outline.
 *  o = {head: 1..2.2, body: 0.5..1, bulge: 0..0.7, neck: -30..30 (% of head height), outline: px} */
function cariCompose(tc, hd, o) {
  const w = tc.width, h = tc.height;
  const head = hd || { top: 0, bot: h - 1, neck: h - 1, cx: w / 2, hw: w / 2 };
  const hh0 = Math.max(4, head.neck - head.top);
  const neck = Math.round(clamp(head.neck + o.neck / 100 * hh0, head.top + 4, head.bot));
  const hasBody = neck < head.bot - 4, hH = neck - head.top, f = hasBody ? Math.max(3, Math.round(hH * 0.1)) : 0;
  const hs = o.head, bs = hasBody ? o.body : hs, cx = head.cx;
  // head piece (feathered at the neck so it melts into the body)
  const hp = makeCanvas(w, Math.min(h, neck + f)), hx = hp.getContext('2d'); hx.drawImage(tc, 0, 0);
  if (hasBody) {   // below the chin keep only the neck's columns, then fade out
    const nd = hx.getImageData(0, neck, w, 1).data; let nx0 = w, nx1 = -1;
    for (let X = 0; X < w; X++) if (nd[X * 4 + 3] > 128) { if (X < nx0) nx0 = X; nx1 = X; }
    if (nx1 >= nx0) { const m = Math.round((nx1 - nx0) * 0.08) + 2; hx.clearRect(0, neck, Math.max(0, nx0 - m), f + 1); hx.clearRect(nx1 + m, neck, w, f + 1); }
    const gr = hx.createLinearGradient(0, neck, 0, neck + f); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    hx.globalCompositeOperation = 'destination-in'; hx.fillStyle = gr; hx.fillRect(0, 0, w, hp.height); hx.globalCompositeOperation = 'source-over';
  }
  cariBulge(hp, cx, head.top + hH * 0.58, Math.max(hH * 0.62, head.hw * 0.62), o.bulge);
  const pad = Math.ceil(o.outline) + 6;
  const L = Math.max(cx * hs, cx * bs), R = Math.max((w - cx) * hs, (w - cx) * bs);
  const T = (neck - head.top) * hs, B = hasBody ? (head.bot - neck) * bs : 0;
  const OW = Math.ceil(L + R + 2 * pad), OH = Math.ceil(T + B + 2 * pad), NX = pad + L, NY = pad + T;
  const out = makeCanvas(OW, OH), x = out.getContext('2d'); x.imageSmoothingQuality = 'high';
  if (hasBody) {   // body below the neck, smaller
    x.save(); x.beginPath(); x.rect(0, NY, OW, OH); x.clip();
    x.translate(NX, NY); x.scale(bs, bs); x.drawImage(tc, -cx, -neck); x.restore();
  }
  x.save(); x.translate(NX, NY); x.scale(hs, hs); x.drawImage(hp, -cx, -neck); x.restore();
  if (o.outline > 0.5) {   // thick outer outline like a sticker
    const im = x.getImageData(0, 0, OW, OH), d = im.data, n = OW * OH, A = new Float32Array(n);
    for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255 > 0.35 ? 1 : 0;
    const D = boxBlur(maxFilter(A, OW, OH, Math.round(o.outline)), OW, OH, 1);
    const ink = x.createImageData(OW, OH), e = ink.data;
    for (let i = 0; i < n; i++) { e[i * 4] = 30; e[i * 4 + 1] = 26; e[i * 4 + 2] = 34; e[i * 4 + 3] = Math.round(D[i] * 255); }
    const oc = makeCanvas(OW, OH), ox = oc.getContext('2d'); ox.putImageData(ink, 0, 0); ox.drawImage(out, 0, 0);
    return cariTrim(oc, pad);
  }
  return cariTrim(out, pad);
}
/** Crop away empty transparent margins (keep a small pad) */
function cariTrim(c, pad) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const o = makeCanvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, -x0, -y0); return o;
}

