/* ========= Strokes ========= */
// Brush types. kind: line = round tip drawn as a dense polyline, nib = flat slanted calligraphy nib, dab = stamped soft dabs.
// sizeK: size multiplier; press:false = width ignores pressure; pexp/pmin: pressure curve; alpha: default 'Độ đậm' (whole-stroke opacity);
// grain: paper texture mask; speed: fast strokes get thinner; taper: thin start; flow/spacing/jitter: dab settings.
const BRUSHES = {
  pen:    { name: 'Bút tròn', tip: 'Nét tròn, mượt, to nhỏ theo lực nhấn. Dùng cho hầu hết mọi việc.', kind: 'line', pexp: 0.85 },
  ink:    { name: 'Bút mực', tip: 'Nét thanh đậm rõ như bút lông kim: đầu nét thon, vuốt nhanh thì nét mảnh lại. Hợp để đi viền.', kind: 'line', pexp: 1.4, pmin: 0.06, taper: 1, speed: 0.32 },
  pencil: { name: 'Bút chì', tip: 'Nét mảnh có vân giấy, hợp để phác thảo.', kind: 'line', sizeK: 0.6, pexp: 1, grain: 'fine', alpha: 0.9 },
  marker: { name: 'Bút dạ', tip: 'Nét đều, hơi trong: tô chồng lên nhau thì đậm hơn. Hợp để tô bóng.', kind: 'line', press: false, sizeK: 1.4, alpha: 0.5 },
  callig: { name: 'Thư pháp', tip: 'Ngòi dẹt nghiêng: kéo chéo thì mảnh, kéo ngang hay dọc thì đậm.', kind: 'nib', sizeK: 1.3, pexp: 0.7 },
  crayon: { name: 'Sáp màu', tip: 'Nét sần như bút sáp, phấn.', kind: 'line', sizeK: 1.2, pexp: 0.6, grain: 'coarse' },
  soft:   { name: 'Cọ mềm', tip: 'Cọ viền mềm, ấn mạnh thì to và đậm hơn. Hợp để tô má hồng, bóng mờ.', kind: 'dab', dab: 'round', sizeK: 1.5, pexp: 0.8, flow: 0.35, spacing: 0.06, pflow: true },
  air:    { name: 'Bút phun', tip: 'Phun sương mờ, giữ lâu càng đậm. Hợp để tô ánh sáng, khói.', kind: 'dab', dab: 'soft', sizeK: 2.4, press: false, flow: 0.07, spacing: 0.07, pflow: true, op0: 0.3 },
  water:  { name: 'Màu nước', tip: 'Loang nhẹ, viền đậm hơn giữa, có vân giấy.', kind: 'dab', dab: 'wet', sizeK: 1.8, pexp: 0.6, flow: 0.13, spacing: 0.07, jitter: 0.12, grain: 'paper', op0: 0.6 }
};
const ERASERS = {
  hard: { name: 'Tẩy cứng', base: 'pen', tip: 'Xoá sạch, viền gọn.' },
  soft: { name: 'Tẩy mềm', base: 'soft', tip: 'Xoá viền mềm, ấn nhẹ thì xoá nhạt.' },
  air:  { name: 'Tẩy nhẹ', base: 'air', tip: 'Làm mờ dần từng chút, như phun tẩy.' }
};
// "Độ đậm": every brush and eraser type remembers its own value (S.brushOp), starting from the brush's own default.
// The slider value IS the stroke opacity, so 100% always means fully dark (marker, airbrush included).
// Dab brushes (soft, air, water; op0 = default): below op0 the whole stroke gets lighter, above it the dabs build up faster
// so 100% can reach full darkness. At op0 they look exactly as designed.
function opKey() { return S.tool === 'eraser' ? 'e:' + (ERASERS[S.eraserType] ? S.eraserType : 'hard') : (BRUSHES[S.brush] ? S.brush : 'pen'); }
function opDefault(k) { return k.startsWith('e:') ? 1 : (BRUSHES[k].op0 || BRUSHES[k].alpha || 1); }
function curOp() { const k = opKey(), v = (S.brushOp || {})[k]; return clamp(v != null ? v : opDefault(k), 0.05, 1); }
function setOp(v) { S.brushOp = S.brushOp || {}; S.brushOp[opKey()] = clamp(Math.round(v * 100) / 100, 0.05, 1); syncSizeOp(); saveSettings(); }
const SIZE_MAX = 150;   // the size slider is not linear: the left half covers 1–38 so thin lines are easy to set
const sizeToPos = s => Math.round(Math.sqrt((clamp(s, 1, SIZE_MAX) - 1) / (SIZE_MAX - 1)) * 1000);
const posToSize = v => Math.max(1, Math.round(1 + (SIZE_MAX - 1) * Math.pow(v / 1000, 2)));
function sizeStep(s, d) { const k = d > 0 ? s : s - 1, st = k < 10 ? 1 : k < 30 ? 2 : k < 60 ? 5 : 10; return clamp(d > 0 ? Math.floor(s / st) * st + st : Math.ceil(s / st) * st - st, 1, SIZE_MAX); }
// brush size in document pixels. With "Giữ cỡ khi phóng to" (S.sizeScreen, default on) the number means the size at the
// fitted view (100%), so zooming in draws finer lines and the brush looks the same on screen at any zoom.
function bsz() { return S.sizeScreen === false || !fitS || !vs ? S.size : Math.max(0.25, S.size * fitS / vs); }
function setSize(v) { S.size = clamp(Math.round(v), 1, SIZE_MAX); syncSizeOp(); saveSettings(); }
// refresh every size / opacity control (top bar + Bút ▾ menu)
function syncSizeOp() {
  const op = Math.round(curOp() * 100);
  document.querySelectorAll('input.sizeR').forEach(e => { e.value = sizeToPos(S.size); });
  document.querySelectorAll('.sizeV').forEach(e => { e.textContent = S.size; });
  document.querySelectorAll('input.opR').forEach(e => { e.value = op; });
  document.querySelectorAll('.opV').forEach(e => { e.textContent = op + '%'; });
}
// wire the − / + buttons and sliders inside root; holding a button keeps stepping
function wireSizeOp(root) {
  root.querySelectorAll('input.sizeR').forEach(e => e.addEventListener('input', () => setSize(posToSize(+e.value))));
  root.querySelectorAll('input.opR').forEach(e => e.addEventListener('input', () => setOp(e.value / 100)));
  root.querySelectorAll('.stp').forEach(b => {
    const d = +b.dataset.d, step = () => b.dataset.stp === 'size' ? setSize(sizeStep(S.size, d)) : setOp(Math.round(curOp() * 20 + d) / 20);
    let t1 = 0, t2 = 0; const stop = () => { clearTimeout(t1); clearInterval(t2); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); stop(); step(); t1 = setTimeout(() => { t2 = setInterval(step, 90); }, 420); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => b.addEventListener(n, stop));
    b.addEventListener('click', e => { if (e.detail === 0) step(); });   // keyboard
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}
// tap the number in the top bar: a big slider + quick presets
function sizeOpPop(btn) {
  if (popEl && popEl._anchor === btn) { closePop(); return; }
  const isS = btn.dataset.pop === 'size', k = isS ? 'size' : 'op';
  const pre = isS ? [1, 2, 3, 5, 8, 12, 20, 35, 60, 100, 150] : [10, 20, 30, 50, 70, 85, 100];
  const d = openPop(btn, `<div class="cp-lbl">${isS ? 'Cỡ nét' : 'Độ đậm <small>(' + (S.tool === 'eraser' ? (ERASERS[S.eraserType] || ERASERS.hard).name : (BRUSHES[S.brush] || BRUSHES.pen).name).toLowerCase() + ')</small>'}</div>
    <div class="stpw" style="display:flex;align-items:center;gap:6px"><button class="stp" data-stp="${k}" data-d="-1" aria-label="Giảm">−</button>${isS ? '<input type="range" class="sizeR" min="0" max="1000" step="1">' : '<input type="range" class="opR" min="5" max="100" step="1">'}<button class="stp" data-stp="${k}" data-d="1" aria-label="Tăng">+</button><span class="val ${isS ? 'sizeV' : 'opV'}" style="min-width:40px"></span></div>
    <div class="qs-row">${pre.map(v => `<button class="chip small" data-qv="${v}">${v}${isS ? '' : '%'}</button>`).join('')}</div>`);
  const mark = () => d.querySelectorAll('[data-qv]').forEach(b => b.classList.toggle('on', +b.dataset.qv === (isS ? S.size : Math.round(curOp() * 100))));
  wireSizeOp(d);
  d.querySelectorAll('[data-qv]').forEach(b => b.addEventListener('click', () => { isS ? setSize(+b.dataset.qv) : setOp(b.dataset.qv / 100); mark(); }));
  d.addEventListener('input', mark); d.addEventListener('pointerup', () => setTimeout(mark, 0));
  syncSizeOp(); mark();
}
function brushOf(tool) { return tool === 'eraser' ? BRUSHES[(ERASERS[S.eraserType] || ERASERS.hard).base] : (BRUSHES[S.brush] || BRUSHES.pen); }
function hexA(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function dabCanvas(kind, col) {
  const N = 64, c = makeCanvas(N, N), x = c.getContext('2d'), g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  const st = kind === 'round' ? [[0, 1], [0.5, 0.95], [0.8, 0.45], [1, 0]] : kind === 'wet' ? [[0, 0.55], [0.7, 0.7], [0.88, 0.9], [1, 0]] : [[0, 1], [0.35, 0.6], [0.7, 0.18], [1, 0]];
  for (const [o, a] of st) g.addColorStop(o, hexA(col, a));
  x.fillStyle = g; x.fillRect(0, 0, N, N); return c;
}
// tileable paper textures (value noise with wrap-around), used as an alpha mask fixed to the paper
const grainCache = {};
function grainCanvas(kind) {
  if (grainCache[kind]) return grainCache[kind];
  const N = 256, c = makeCanvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
  const noise = G => { const g = new Float32Array(G * G); for (let i = 0; i < g.length; i++) g[i] = Math.random(); const out = new Float32Array(N * N), k = N / G;
    for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
      const fx = xx / k, fy = y / k, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % G) * G + x0 % G], b = g[(y0 % G) * G + (x0 + 1) % G], cc = g[((y0 + 1) % G) * G + x0 % G], dd = g[((y0 + 1) % G) * G + (x0 + 1) % G];
      out[y * N + xx] = (a + (b - a) * sx) * (1 - sy) + (cc + (dd - cc) * sx) * sy;
    } return out; };
  const lo = noise(kind === 'fine' ? 64 : kind === 'coarse' ? 32 : 16), mid = kind === 'paper' ? noise(64) : null;
  for (let i = 0; i < N * N; i++) {
    const r = Math.random(); let a;
    if (kind === 'fine') a = clamp((0.55 * r + 0.45 * lo[i] - 0.2) / 0.5, 0, 1);
    else if (kind === 'coarse') a = clamp((0.3 * r + 0.7 * lo[i] - 0.2) / 0.32, 0, 1);
    else a = 0.5 + 0.3 * lo[i] + 0.2 * mid[i] - 0.08 * r;
    d[i * 4 + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0); return (grainCache[kind] = c);
}
function applyGrain(ctx, kind, x, y, w, h) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = 1;
  ctx.fillStyle = ctx.createPattern(grainCanvas(kind), 'repeat'); ctx.fillRect(x, y, w, h); ctx.restore();
}
// The drawing engine: stabilises raw input (time-window weighted average + pressure smoothing), interpolates with
// midpoint quadratic curves, then samples the curve densely so width/opacity change smoothly instead of in steps.
// o: {brush, color, size, pressure, smooth (0..0.9), erase, dirty(x, y, r)}
function makeBrushEngine(ctx, o) {
  const B = o.brush, col = o.erase ? '#000000' : o.color, winMs = (o.smooth || 0) * 120;
  const pmin = B.pmin != null ? B.pmin : 0.12, size = o.size * (B.sizeK || 1);
  const dab = B.kind === 'dab' ? dabCanvas(B.dab, col) : null;
  const nib = -Math.PI / 4, ncos = Math.cos(nib), nsin = Math.sin(nib);
  const E = { B, raw: [], pts: [], ps: null, v: 0, sf: 1, lastRaw: null, dist: 0, carry: 0 };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
  const dirty = o.dirty || (() => {});
  function widthOf(p) {
    let w = size;
    if (o.pressure && B.press !== false) w *= pmin + (1 - pmin) * Math.pow(clamp(p.p, 0, 1), B.pexp || 0.85);
    if (B.speed) w *= p.sf;
    if (B.taper) w *= Math.min(1, 0.25 + p.d / (o.size * 2.5 + 10));
    return Math.max(0.5, w);
  }
  const flowOf = p => Math.min(1, B.flow * (o.flowK || 1) * (B.pflow && o.pressure ? 0.25 + 0.75 * clamp(p.p, 0, 1) : 1));
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2, a: (a.a + b.a) / 2 });
  function stamp(x, y, w, a) {
    const r = w / 2 * (B.jitter ? 1 + B.jitter * (Math.random() * 2 - 1) : 1);
    ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
  }
  function dot(p) {
    dirty(p.x, p.y, p.w / 2 + 3);
    if (B.kind === 'dab') { stamp(p.x, p.y, p.w, p.a); ctx.globalAlpha = 1; E.carry = Math.max(0.6, p.w * B.spacing); }
    else if (B.kind === 'nib') { const hx = ncos * p.w / 2, hy = nsin * p.w / 2; ctx.lineWidth = Math.max(1.5, p.w * 0.14); ctx.beginPath(); ctx.moveTo(p.x - hx, p.y - hy); ctx.lineTo(p.x + hx, p.y + hy); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  function seg(A, C, Bp) {
    const L = C ? Math.hypot(C.x - A.x, C.y - A.y) + Math.hypot(Bp.x - C.x, Bp.y - C.y) : Math.hypot(Bp.x - A.x, Bp.y - A.y);
    const n = Math.max(1, Math.min(800, Math.ceil(L / (B.kind === 'nib' ? 1.5 : 1)))), P = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, wm = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, x = C ? u * u * A.x + 2 * u * t * C.x + t * t * Bp.x : A.x + (Bp.x - A.x) * t, y = C ? u * u * A.y + 2 * u * t * C.y + t * t * Bp.y : A.y + (Bp.y - A.y) * t;
      const q = { x, y, w: A.w + (Bp.w - A.w) * t, a: A.a + (Bp.a - A.a) * t }; P.push(q);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (q.w > wm) wm = q.w;
    }
    dirty(x0, y0, wm / 2 + 3); dirty(x1, y1, wm / 2 + 3);
    if (B.kind === 'line') { // merge runs of near-equal width into one path
      let i0 = 0;
      for (let i = 1; i < P.length; i++) {
        if (i < P.length - 1 && Math.abs(P[i + 1].w - P[i0].w) <= 0.3) continue;
        ctx.lineWidth = (P[i0].w + P[i].w) / 2; ctx.beginPath(); ctx.moveTo(P[i0].x, P[i0].y);
        for (let k = i0 + 1; k <= i; k++) ctx.lineTo(P[k].x, P[k].y);
        ctx.stroke(); i0 = i;
      }
    } else if (B.kind === 'nib') {
      for (let i = 1; i < P.length; i++) {
        const p = P[i - 1], q = P[i], hp = p.w / 2, hq = q.w / 2;
        ctx.lineWidth = Math.max(1, p.w * 0.12); ctx.beginPath();
        ctx.moveTo(p.x - ncos * hp, p.y - nsin * hp); ctx.lineTo(q.x - ncos * hq, q.y - nsin * hq); ctx.lineTo(q.x + ncos * hq, q.y + nsin * hq); ctx.lineTo(p.x + ncos * hp, p.y + nsin * hp);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else {
      for (let i = 1; i < P.length; i++) {
        const p = P[i - 1], q = P[i], d = Math.hypot(q.x - p.x, q.y - p.y);
        while (E.carry <= d) { const t = d ? E.carry / d : 0, w = p.w + (q.w - p.w) * t; stamp(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, w, p.a + (q.a - p.a) * t); E.carry += Math.max(0.6, w * B.spacing); }
        E.carry -= d;
      }
      ctx.globalAlpha = 1;
    }
  }
  function add(raw, t) {
    if (E.ps == null) E.ps = raw.p; else E.ps += (raw.p - E.ps) * 0.4;
    if (E.lastRaw) { const dt = Math.max(1, t - E.lastRaw.t), d = Math.hypot(raw.x - E.lastRaw.x, raw.y - E.lastRaw.y); E.v += (Math.min(d / dt, 8) - E.v) * 0.25; }
    E.lastRaw = { x: raw.x, y: raw.y, t };
    E.raw.push({ x: raw.x, y: raw.y, t });
    while (E.raw.length > 1 && E.raw[0].t < t - winMs) E.raw.shift();
    let sx = 0, sy = 0, sw = 0;
    for (const q of E.raw) { const w = winMs > 0 ? 1 + 3 * clamp((q.t - (t - winMs)) / winMs, 0, 1) : 1; sx += q.x * w; sy += q.y * w; sw += w; }
    const p = { x: sx / sw, y: sy / sw, p: E.ps }, pts = E.pts, last = pts[pts.length - 1];
    if (last) { const d = Math.hypot(p.x - last.x, p.y - last.y); if (d < 0.35) return; E.dist += d; }
    if (B.speed) E.sf += (clamp(1.1 - E.v * B.speed, 0.3, 1) - E.sf) * 0.3;
    p.d = E.dist; p.sf = E.sf; p.w = widthOf(p); p.a = B.kind === 'dab' ? flowOf(p) : 1;
    pts.push(p); const n = pts.length;
    if (n === 1) dot(p);
    else if (n === 2) seg(pts[0], null, mid(pts[0], p));
    else seg(mid(pts[n - 3], pts[n - 2]), pts[n - 2], mid(pts[n - 2], p));
  }
  function end() {
    if (E.lastRaw && winMs > 0) { const r = E.lastRaw; let t = r.t; for (let k = 0; k < 10; k++) { t += winMs / 8; add({ x: r.x, y: r.y, p: E.ps }, t); } }
    const n = E.pts.length;
    if (n >= 2) seg(mid(E.pts[n - 2], E.pts[n - 1]), null, E.pts[n - 1]);
  }
  return { E, add, end };
}
let stroke = null;
function widthFor(p) { const z = bsz(); return S.pressure ? Math.max(Math.min(0.6, z), z * (0.12 + 0.88 * Math.pow(p, 0.85))) : z; }
function growDirty(x, y, r) {
  const d = stroke.dirty, b = stroke.bbox;
  d[0] = Math.min(d[0], x - r); d[1] = Math.min(d[1], y - r); d[2] = Math.max(d[2], x + r); d[3] = Math.max(d[3], y + r);
  b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y - r); b[2] = Math.max(b[2], x + r); b[3] = Math.max(b[3], y + r);
}
// symmetry: a second brush engine draws the mirrored stroke into the same layer
const symPt = p => S.sym === 2 ? { ...p, y: H - p.y } : S.sym === 3 ? { ...p, x: W - p.x, y: H - p.y } : { ...p, x: W - p.x };
function strokeEngines() {
  const st = stroke, o = { brush: st.B, color: S.color, size: bsz(), pressure: S.pressure, flowK: st.B.kind === 'dab' && !st.erase ? Math.max(1, curOp() / (st.B.op0 || 1)) : 1, smooth: st.shape ? 0 : S.smooth, erase: st.erase, dirty: growDirty };
  st.eng = makeBrushEngine(sctx, o); st.eng2 = S.sym ? makeBrushEngine(sctx, o) : null;
}
function strokeFeed(p, t) { stroke.eng.add(p, t); if (stroke.eng2) stroke.eng2.add(symPt(p), t); }
function strokeBegin(p, t) {
  snapPrepare(); p = snapPoint(p);
  const o = activeObj(), erase = S.tool === 'eraser', B = brushOf(S.tool);
  const isCol = S.layer === 'col' && o.kind === 'char';
  t = t != null ? t : performance.now();
  stroke = { t: targetOf(o), o, cv: isCol ? colOf(o, true) : o.canvas, col: isCol, erase, B, pred: null,
    bbox: [Infinity, Infinity, -Infinity, -Infinity], dirty: [0, 0, W, H], full: true, opacity: erase || B.kind !== 'dab' ? curOp() : Math.min(1, curOp() / (B.op0 || 1)),
    raw: [{ ...p, t }], shape: !erase && S.shapeMode ? S.shapeMode : null, hold: { x: p.x, y: p.y }, clip: !erase && !!S.clipIn };
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1; sctx.clearRect(0, 0, W, H);
  strokeEngines(); strokeFeed(p, t);
  if (!erase) addRecentColor(S.color);
  requestRender();
}
function strokePoint(raw, t) {
  raw = snapPoint(raw); t = t != null ? t : performance.now();
  const st = stroke; st.raw.push({ ...raw, t });
  if (st.shape) { if (!st.locked) { st.end = raw; shapeRedraw(); } }
  else {
    strokeFeed(raw, t);
    // QuickShape: holding the pen still for a moment turns the freehand stroke into a line / ellipse
    if (!st.erase && Math.hypot(raw.x - st.hold.x, raw.y - st.hold.y) > 5 / (vs / DPR)) { st.hold = { x: raw.x, y: raw.y }; clearTimeout(st.holdT); st.holdT = setTimeout(() => quickShape(st), 550); }
  }
  requestRender();
}
// rebuild the stroke as a clean shape from its start point to st.end (or the fitted ellipse box)
function shapePts(st) {
  const a = st.raw[0], b = st.end || st.raw[st.raw.length - 1], P = [];
  const pr = st.raw.reduce((s, q) => s + (q.p || 0.5), 0) / st.raw.length;
  const line = (x0, y0, x1, y1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4)); for (let i = P.length ? 1 : 0; i <= n; i++) P.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, p: pr }); };
  if (st.shape === 'line') line(a.x, a.y, b.x, b.y);
  else if (st.shape === 'rect') { line(a.x, a.y, b.x, a.y); line(b.x, a.y, b.x, b.y); line(b.x, b.y, a.x, b.y); line(a.x, b.y, a.x, a.y); }
  else {
    const bx = st.box || { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rx: Math.abs(b.x - a.x) / 2, ry: Math.abs(b.y - a.y) / 2 };
    const n = Math.max(24, Math.ceil(Math.PI * (bx.rx + bx.ry) / 4)), a0 = bx.a0 || 0;
    for (let i = 0; i <= n + 1; i++) { const t = a0 + i / n * Math.PI * 2; P.push({ x: bx.cx + Math.cos(t) * bx.rx, y: bx.cy + Math.sin(t) * bx.ry, p: pr }); }
  }
  return P;
}
function shapeRedraw() {
  const st = stroke;
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1; sctx.clearRect(0, 0, W, H);
  st.dirty = [0, 0, W, H]; strokeEngines();
  let t = st.raw[0].t; for (const q of shapePts(st)) strokeFeed(q, t += 8);
  st.eng.end(); if (st.eng2) st.eng2.end(); st.shapeDone = true;
}
// drawing helpers for the brush: quick shapes, symmetry, draw-inside (lock alpha); remembered in settings
SETTINGS_KEYS.push('shapeMode', 'sym', 'clipIn'); S.shapeMode = ''; S.sym = 0; S.clipIn = false;
const SHAPES = [['', '✏ Tự do'], ['line', '╱ Thẳng'], ['rect', '▭ Chữ nhật'], ['ellipse', '◯ Tròn']], SYMS = ['⇋ Đối xứng', '⇋ Đối xứng: trái–phải', '⇋ Đối xứng: trên–dưới', '⇋ Đối xứng: 4 góc'];
// icon + words; on a narrow top bar only the icon shows (the words stay in the tooltip and in the toast on tap)
function setIconLabel(el, t) { const k = t.indexOf(' '); el.innerHTML = '<b class="tico">' + t.slice(0, k) + '</b><span class="tlbl"> ' + t.slice(k + 1) + '</span>'; el.setAttribute('aria-label', t); }
function syncShapeBtns() { const sh = SHAPES.find(x => x[0] === (S.shapeMode || '')) || SHAPES[0]; setIconLabel($('#shapeBtn'), sh[1]); $('#shapeBtn').classList.toggle('on', !!S.shapeMode); setIconLabel($('#symBtn'), SYMS[S.sym | 0]); $('#symBtn').classList.toggle('on', !!S.sym); $('#clipBtn').classList.toggle('on', !!S.clipIn); }
setTimeout(syncShapeBtns, 0);   // after loadSettings()
$('#shapeBtn').addEventListener('click', () => { const i = SHAPES.findIndex(x => x[0] === (S.shapeMode || '')); S.shapeMode = SHAPES[(i + 1) % SHAPES.length][0]; syncShapeBtns(); saveSettings(); if (S.shapeMode) toast('Kéo từ điểm đầu tới điểm cuối để vẽ ' + SHAPES.find(x => x[0] === S.shapeMode)[1].slice(2).toLowerCase(), 2200); else toast('Vẽ tự do', 1500); });
$('#symBtn').addEventListener('click', () => { S.sym = ((S.sym | 0) + 1) % 4; syncShapeBtns(); saveSettings(); requestRender(); toast(S.sym ? SYMS[S.sym].replace('⇋ ', '') : 'Tắt vẽ đối xứng', 1800); });
$('#clipBtn').addEventListener('click', () => { S.clipIn = !S.clipIn; syncShapeBtns(); saveSettings(); toast(S.clipIn ? 'Nét mới chỉ hiện trên chỗ đã vẽ ở lớp này (tô bóng, đổi màu nét)' : 'Vẽ bình thường', 2500); });
let quickShapeHint = false;
function quickShape(st) {
  if (stroke !== st || st.shape || st.raw.length < 6) return;
  const R = st.raw, a = R[0], b = R[R.length - 1]; let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 1; i < R.length; i++) len += Math.hypot(R[i].x - R[i - 1].x, R[i].y - R[i - 1].y);
  for (const q of R) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  if (len < 30) return;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < len * 0.22 && x1 - x0 > 12 && y1 - y0 > 12) { st.shape = 'ellipse'; st.box = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, a0: Math.atan2((a.y - (y0 + y1) / 2) / ((y1 - y0) / 2), (a.x - (x0 + x1) / 2) / ((x1 - x0) / 2)) }; }
  else if (chord > len * 0.6) st.shape = 'line';
  else return;
  st.end = { x: b.x, y: b.y }; shapeRedraw(); requestRender();
  if (!quickShapeHint) { quickShapeHint = true; toast(st.shape === 'line' ? 'Đã nắn thành đường thẳng — kéo tiếp để chỉnh đầu nét' : 'Đã nắn thành hình tròn', 2200); }
  if (st.shape === 'ellipse') st.locked = true;
}
// predicted pointer positions: drawn on screen only (never saved) to hide input latency
function drawStrokePred(c) {
  const st = stroke; if (!st || !st.pred || !st.pred.length || st.erase || st.shape || st.eng2 || st.clip) return;
  const B = st.B, pts = st.eng.E.pts, n = pts.length;
  if (B.kind !== 'line' || B.grain || st.opacity < 1 || S.smooth > 0.35 || n < 2) return;
  const a = pts[n - 2], b = pts[n - 1];
  c.save(); c.globalAlpha = st.opacity; c.strokeStyle = S.color; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = b.w;
  c.beginPath(); c.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2); c.lineTo(b.x, b.y); for (const q of st.pred) c.lineTo(q.x, q.y); c.stroke(); c.restore();
}
// the stroke as it will be applied: scv, masked by the paper grain for textured brushes
let tcv = null, tctx = null;
function strokeLayer(r) {
  const g = stroke.B.grain; if (!g || !r) return scv;
  if (!tcv || tcv.width !== W || tcv.height !== H) { tcv = makeCanvas(); tctx = tcv.getContext('2d'); }
  const [x, y, w, h] = r;
  tctx.clearRect(x, y, w, h); tctx.drawImage(scv, x, y, w, h, x, y, w, h); applyGrain(tctx, g, x, y, w, h);
  return tcv;
}
function buildWork() {
  const o = stroke.o, cv = stroke.cv; if (!o.canvas || !cv) return;
  const d = stroke.dirty;
  if (!(d[2] > d[0] && d[3] > d[1])) return;
  const x = Math.max(0, Math.floor(d[0])), y = Math.max(0, Math.floor(d[1]));
  const w = Math.min(W, Math.ceil(d[2])) - x, h = Math.min(H, Math.ceil(d[3])) - y;
  stroke.dirty = [Infinity, Infinity, -Infinity, -Infinity];
  if (w <= 0 || h <= 0) return;
  const L = strokeLayer([x, y, w, h]);
  wctx.save(); wctx.beginPath(); wctx.rect(x, y, w, h); wctx.clip();
  wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1; wctx.clearRect(x, y, w, h);
  wctx.drawImage(cv, 0, 0);
  if (stroke.erase) { wctx.globalCompositeOperation = 'destination-out'; wctx.globalAlpha = stroke.opacity; wctx.drawImage(L, 0, 0); }
  else { if (stroke.clip) wctx.globalCompositeOperation = 'source-atop'; wctx.globalAlpha = stroke.opacity; wctx.drawImage(L, 0, 0); }
  wctx.restore();
}
function rectFromBox(b, pad = 0) {
  const x = Math.max(0, Math.floor(b[0] - pad)), y = Math.max(0, Math.floor(b[1] - pad));
  const x2 = Math.min(W, Math.ceil(b[2] + pad)), y2 = Math.min(H, Math.ceil(b[3] + pad));
  return x2 > x && y2 > y ? [x, y, x2 - x, y2 - y] : null;
}
function strokeEnd() {
  if (!stroke) return;
  clearTimeout(stroke.holdT);
  if (stroke.shape && !stroke.shapeDone) shapeRedraw();
  if (!stroke.shapeDone) { stroke.eng.end(); if (stroke.eng2) stroke.eng2.end(); }
  const o = stroke.o, rect = rectFromBox(stroke.bbox, 2);
  if (rect && o.canvas && stroke.cv) {
    const lc = stroke.cv.getContext('2d'), L = strokeLayer(rect);
    const before = lc.getImageData(...rect);
    lc.save(); lc.beginPath(); lc.rect(...rect); lc.clip();
    lc.globalCompositeOperation = stroke.erase ? 'destination-out' : stroke.clip ? 'source-atop' : 'source-over'; lc.globalAlpha = stroke.opacity;
    lc.drawImage(L, 0, 0); lc.restore();
    const after = lc.getImageData(...rect);
    pushEntry(pixEntry(o, rect, before, after, stroke.col)); if (stroke.col) o.colVer++;
    markEdited(o);
  }
  stroke = null; requestRender();
}
function strokeAbort() { if (stroke) clearTimeout(stroke.holdT); stroke = null; requestRender(); }

