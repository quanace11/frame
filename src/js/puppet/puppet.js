/* ========= Cut-out puppet (image pieces with pivots) ========= */
let ppSetup = null, ppSel = null, ppDrag = 'rotate', ppCutMode = false, ppKeep = false, ppDir = 1;
const PP_ROLES = { '': '— vai trò —', head: 'Đầu', torso: 'Thân', armL: 'Tay trái (trên)', foreL: 'Cẳng tay trái', armR: 'Tay phải (trên)', foreR: 'Cẳng tay phải', legL: 'Chân trái (đùi)', shinL: 'Ống chân trái', legR: 'Chân phải (đùi)', shinR: 'Ống chân phải', mouth: 'Miệng', eyes: 'Mắt', other: 'Khác' };
const mMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const mT = (x, y) => [1, 0, 0, 1, x, y], mR = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], mS = (x, y) => [x, 0, 0, y, 0, 0];
const mInv = M => { const det = M[0] * M[3] - M[1] * M[2] || 1e-9; return [M[3] / det, -M[1] / det, -M[2] / det, M[0] / det, (M[2] * M[5] - M[3] * M[4]) / det, (M[1] * M[4] - M[0] * M[5]) / det]; };
const mApply = (M, x, y) => ({ x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] });
const ppClone = pp => JSON.parse(JSON.stringify(pp || {}));
const ppPart = id => S.pp && S.pp.parts.find(p => p.id === id);
function ppMats(pose) {
  const M = {}, parts = S.pp.parts;
  const get = (p, guard = 0) => {
    if (M[p.id]) return M[p.id];
    const q = (pose && pose[p.id]) || {};
    const L = mMul(mMul(mMul(mT(p.px + (q.dx || 0), p.py + (q.dy || 0)), mR((q.r || 0) * DEG)), mS((q.sx == null ? 1 : q.sx) * (q.fl ? -1 : 1), q.sy == null ? 1 : q.sy)), mT(-p.px, -p.py));
    const par = p.parent && guard < 20 && parts.find(x => x.id === p.parent);
    M[p.id] = par ? mMul(get(par, guard + 1), L) : L; return M[p.id];
  };
  parts.forEach(p => get(p)); return M;
}
function ppImg(p, q) {
  const v = q && q.v ? q.v : 0;
  if (v > 0 && p.alts && p.alts[v - 1] && p.alts[v - 1].c) { const a = p.alts[v - 1]; return { c: a.c, x: p.ox + (a.dx || 0), y: p.oy + (a.dy || 0), holder: a, vi: v }; }
  return { c: p.c, x: p.ox, y: p.oy, holder: p, vi: 0 };
}
function ppAlphaH(h) { if (!h.alpha && h.c) { const d = h.c.getContext('2d').getImageData(0, 0, h.c.width, h.c.height).data, a = new Uint8Array(h.c.width * h.c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; h.alpha = a; } return h.alpha; }
/* --- soft joints (like bones + mesh warp): instead of two rigid pieces meeting at the elbow/knee, the pixels near the joint
   follow BOTH pieces with a smooth weight, so the limb bends in a curve. The top of an arm/leg also blends into the body
   (shoulder, hip). Drawn as a small strip mesh of triangles per piece; everything far from a joint stays one rigid draw. --- */
SETTINGS_KEYS.push('ppSoft', 'ppSmooth'); S.ppSoft = true; S.ppSmooth = true;
const PP_SOFT2 = { foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR' }, PP_SOFT1 = { armL: 1, armR: 1, legL: 1, legR: 1 };
const ppSkinCache = new WeakMap();
// rest geometry of a piece: bone axis (pivot -> tip), length and limb thickness (measured across the bone on the image)
function ppGeom(p) {
  const tip = p.tip || ppTipOf(p), key = p.c.width + ':' + p.c.height + ':' + p.px + ':' + p.py + ':' + tip.x + ':' + tip.y + ':' + p.ox + ':' + p.oy;
  let g = ppSkinCache.get(p); if (g && g.key === key) return g;
  const L = Math.hypot(tip.x - p.px, tip.y - p.py), ux = L ? (tip.x - p.px) / L : 0, uy = L ? (tip.y - p.py) / L : 1;
  const a = ppAlphaH(p), w = p.c.width, h = p.c.height, ws = [];
  for (const t of [0.3, 0.45, 0.6]) {
    const cx = p.px + ux * L * t - p.ox, cy = p.py + uy * L * t - p.oy; let n = 0;
    for (let s = -L; s <= L; s += 1) { const x = Math.round(cx - uy * s), y = Math.round(cy + ux * s); if (x >= 0 && y >= 0 && x < w && y < h && a[y * w + x] > 100) n++; }
    ws.push(n);
  }
  ws.sort((m, n) => m - n);
  g = { key, ux, uy, L, wid: ws[1] || 0.25 * L }; ppSkinCache.set(p, g); return g;
}
// joints that bend a piece softly: [{c: child piece, two: both sides blend, px, py, ux, uy, b: half-width of the blend}]
function ppSoftJoints(p, byId) {
  const out = [], mk = (c, two) => { const g = ppGeom(c); if (g.L < 6) return; const par = byId[c.parent], gp = par && par.role !== 'torso' ? ppGeom(par) : null;
    const b = clamp((two ? 0.4 : 0.35) * g.wid, 4, 0.4 * Math.min(g.L, gp ? gp.L : 1e9)); out.push({ c, two, px: c.px, py: c.py, ux: g.ux, uy: g.uy, b }); };
  const par = p.parent && byId[p.parent];
  if (par && PP_SOFT2[p.role] === par.role) mk(p, true);
  else if (par && PP_SOFT1[p.role] && par.role === 'torso') mk(p, false);
  for (const c of S.pp.parts) if (c.parent === p.id && PP_SOFT2[c.role] === p.role) mk(c, true);
  return out;
}
const ppSmoothW = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const mLerp = (A, B, t) => t <= 0 ? A : t >= 1 ? B : A.map((v, k) => v + (B[k] - v) * t);
// matrix for a rest point X of piece p: blends towards the parent at its own joint and towards children at theirs
function ppSkinMat(p, joints, M, x, y) {
  let own = M[p.id], self = null;
  for (const j of joints) {
    const t = ppSmoothW(((x - j.px) * j.ux + (y - j.py) * j.uy + j.b) / (2 * j.b));
    if (j.c === p) self = { j, t }; else own = mLerp(own, M[j.c.id], t);
  }
  return self ? mLerp(M[p.parent], own, self.t) : own;
}
function ppAffine3(r, q) {   // affine matrix that maps 3 rest points onto 3 posed points
  const [a, b, c] = r, [A, B, C] = q, d = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y); if (Math.abs(d) < 1e-9) return null;
  const m0 = ((B.x - A.x) * (c.y - a.y) - (C.x - A.x) * (b.y - a.y)) / d, m2 = ((C.x - A.x) * (b.x - a.x) - (B.x - A.x) * (c.x - a.x)) / d;
  const m1 = ((B.y - A.y) * (c.y - a.y) - (C.y - A.y) * (b.y - a.y)) / d, m3 = ((C.y - A.y) * (b.x - a.x) - (B.y - A.y) * (c.x - a.x)) / d;
  return [m0, m1, m2, m3, A.x - m0 * a.x - m2 * a.y, A.y - m1 * a.x - m3 * a.y];
}
function ppPolyDraw(ctx, Mx, poly, im, grow) {
  // clip the polygon (rest space, pushed out a little from its centre so neighbouring cells overlap: no hairline seams)
  // every edge moves out by `grow` (mitred corners), also for thin slivers
  const n = poly.length; let ar = 0; for (let k = 0; k < n; k++) { const a = poly[k], b = poly[(k + 1) % n]; ar += a.x * b.y - b.x * a.y; }
  const sg = ar >= 0 ? 1 : -1, nm = poly.map((a, k) => { const b = poly[(k + 1) % n], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: sg * dy / l, y: -sg * dx / l }; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ctx.save(); ctx.transform(...Mx); ctx.beginPath();
  poly.forEach((q, k) => { const A = nm[(k + n - 1) % n], B = nm[k], d = 1 + A.x * B.x + A.y * B.y, f = grow / Math.max(d, 0.25), X = q.x + (A.x + B.x) * f, Y = q.y + (A.y + B.y) * f; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); });
  ctx.closePath(); ctx.clip();
  const sx = Math.max(0, Math.floor(x0 - im.x - 1)), sy = Math.max(0, Math.floor(y0 - im.y - 1)), ex = Math.min(im.c.width, Math.ceil(x1 - im.x + 1)), ey = Math.min(im.c.height, Math.ceil(y1 - im.y + 1));
  if (ex > sx && ey > sy) ctx.drawImage(im.c, sx, sy, ex - sx, ey - sy, im.x + sx, im.y + sy, ex - sx, ey - sy);
  ctx.restore();
}
function ppDrawSoft(ctx, p, im, M, joints) {
  const g = ppGeom(p), ux = g.ux, uy = g.uy, vx = -uy, vy = ux, W0 = im.c.width, H0 = im.c.height;
  // the piece's image box in (along, across) coordinates of its own bone
  let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const [X, Y] of [[im.x, im.y], [im.x + W0, im.y], [im.x, im.y + H0], [im.x + W0, im.y + H0]]) { const a = (X - p.px) * ux + (Y - p.py) * uy, c = (X - p.px) * vx + (Y - p.py) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const cuts = [a0, a1], zone = [];
  for (const j of joints) {
    const z = (j.px - p.px) * ux + (j.py - p.py) * uy, cosT = Math.max(0.5, Math.abs(j.ux * ux + j.uy * uy)), sinT = Math.sqrt(1 - cosT * cosT), hw = Math.min(a1 - a0, (j.b + (c1 - c0) * sinT) / cosT + 2);
    zone.push([z - hw, z + hw]); for (let k = 0; k <= 8; k++) cuts.push(z - hw + 2 * hw * k / 8);
  }
  const A = [...new Set(cuts.filter(a => a >= a0 && a <= a1).map(a => Math.round(a * 100) / 100))].sort((m, n) => m - n);
  const P = (a, c) => ({ x: p.px + ux * a + vx * c, y: p.py + uy * a + vy * c }), T0 = ctx.getTransform(), sc = (Math.hypot(M[p.id][0], M[p.id][1]) || 1) * (Math.hypot(T0.a, T0.b) || 1), grow = 1 / sc;
  const NC = 3, cs = []; for (let k = 0; k <= NC; k++) cs.push(c0 + (c1 - c0) * k / NC);
  for (let r = 0; r < A.length - 1; r++) {
    const s = A[r], e = A[r + 1]; if (e - s < 0.01) continue;
    const mid = (s + e) / 2, inZone = zone.some(([z0, z1]) => mid > z0 && mid < z1);
    if (!inZone) { const q = P(mid, (c0 + c1) / 2); ppPolyDraw(ctx, ppSkinMat(p, joints, M, q.x, q.y), [P(s, c0), P(e, c0), P(e, c1), P(s, c1)], im, grow); continue; }
    for (let k = 0; k < NC; k++) {
      const R = [P(s, cs[k]), P(e, cs[k]), P(e, cs[k + 1]), P(s, cs[k + 1])], Q = R.map(q => mApply(ppSkinMat(p, joints, M, q.x, q.y), q.x, q.y));
      for (const t of [[0, 1, 2], [0, 2, 3]]) { const Mx = ppAffine3(t.map(i => R[i]), t.map(i => Q[i])); if (Mx) ppPolyDraw(ctx, Mx, t.map(i => R[i]), im, grow); }
    }
  }
}

/* --- smooth playback (like a tween at full frame rate): while playing / exporting video, the puppet moves continuously
   from one frame's pose to the next instead of jumping, so 8 walk frames look like a fluid walk. Long frames hold their
   pose and only blend in the last ~0.16 s. Frames with ease "hold" keep the snap. Lines, colours and drawings are not touched. --- */
const ppSmoothOn = () => !!(S.ppSmooth && S.pp && S.pp.parts.length && S.showPP);
function ppEaseOf(i) { for (let k = i; k >= 0; k--) if (ppIsKey(S.frames[k])) return S.frames[k].ppEase || 'inout'; return 'inout'; }
// monotone cubic through 4 samples (no overshoot on holds), u in 0..1 between y1 and y2
function ppCubic(y0, y1, y2, y3, u) {
  const d0 = y1 - y0, d1 = y2 - y1, d2 = y3 - y2;
  const tg = (a, b) => a * b <= 0 ? 0 : 2 * a * b / (a + b);
  const m1 = tg(d0, d1), m2 = tg(d1, d2), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * y2 + (u3 - u2) * m2;
}
function ppPoseAt(i, tIn, wrap) {
  const n = S.frames.length, f = S.frames[i]; if (!f) return null;
  const at = k => wrap ? S.frames[((k % n) + n) % n] : S.frames[clamp(k, 0, n - 1)];
  const nx = at(i + 1); if (!nx || nx === f || ppEaseOf(i) === 'hold') return f.pp;
  const dur = Math.max(1, f.dur), T = Math.min(dur, 160), u = clamp((tIn * 1000 - (dur - T)) / T, 0, 1);
  if (u <= 0) return f.pp;
  const P = [at(i - 1).pp || {}, f.pp || {}, nx.pp || {}, at(i + 2).pp || {}], out = {};
  const ids = new Set([...Object.keys(P[1]), ...Object.keys(P[2])]);
  for (const id of ids) {
    const q = P.map(pp => pp[id] || {}), b = q[1], c = q[2], o = out[id] = { ...b };
    // rotations: unwrap so 179° -> -179° goes the short way; a big jump (> 150°) is a deliberate cut, keep it
    let r = q.map(x => x.r || 0); for (let k = 1; k < 4; k++) r[k] = r[k - 1] + wrapRad((r[k] - r[k - 1]) * DEG) / DEG;
    if (Math.abs(r[2] - r[1]) > 150 || !!b.fl !== !!c.fl) continue;
    o.r = ppCubic(r[0], r[1], r[2], r[3], u);
    for (const [k, d] of [['dx', 0], ['dy', 0], ['sx', 1], ['sy', 1]]) { const v = q.map(x => x[k] == null ? d : x[k]); if (v[1] !== v[2]) o[k] = ppCubic(v[0], v[1], v[2], v[3], u); }
  }
  return out;
}
function drawPuppet(ctx, pose, lip) {
  if (!S.pp || !S.pp.parts.length) return;
  if (lip && lip.eb) { pose = { ...(pose || {}) }; for (const id in lip.eb) { const ep = ppPart(id), a = lip.eb[id]; if (!ep || !a) continue; const q = pose[id] = { ...(pose[id] || {}) }; if (ep.alts && ep.alts.length) { const L = ep.alts.length; if (a >= 1) q.v = L; else if (L >= 2) q.v = 1; } else q.sy = (q.sy == null ? 1 : q.sy) * (1 - 0.9 * a); } }
  const lipOpen = (pid, lv) => { const mp = ppPart(pid); if (mp) { const q = { ...((pose && pose[mp.id]) || {}) }; if (mp.alts && mp.alts.length) { const v = Math.round(lv * mp.alts.length); if (v) q.v = v; else delete q.v; } else q.sy = (q.sy == null ? 1 : q.sy) * (1 + 0.8 * lv); pose = { ...(pose || {}), [mp.id]: q }; } };
  if (lip && lip.pid) lipOpen(lip.pid, lip.lv);
  if (lip && lip.m) for (const id in lip.m) if (id !== lip.pid) lipOpen(id, lip.m[id]);
  if (lip && lip.mv) pose = ppApplyMv(pose, lip.mv);
  const M = ppMats(pose), byId = {}; S.pp.parts.forEach(p => byId[p.id] = p);
  for (const p of [...S.pp.parts].sort((a, b) => a.z - b.z)) {
    const q = pose && pose[p.id]; if ((q && q.h) || !p.c) continue;
    const im = ppImg(p, q);
    if (S.ppSoft && p.role && (PP_SOFT1[p.role] || PP_SOFT2[p.role])) { const js = ppSoftJoints(p, byId); if (js.length) { ppDrawSoft(ctx, p, im, M, js); continue; } }
    ctx.save(); ctx.transform(...M[p.id]); ctx.drawImage(im.c, im.x, im.y); ctx.restore();
  }
}
function ppHit(pt, pose) {
  if (!S.pp) return null; const M = ppMats(pose);
  for (const p of [...S.pp.parts].sort((a, b) => b.z - a.z)) {
    const q = pose && pose[p.id]; if ((q && q.h) || !p.c) continue;
    const im = ppImg(p, q), l = mApply(mInv(M[p.id]), pt.x, pt.y), x = Math.floor(l.x - im.x), y = Math.floor(l.y - im.y);
    if (x < 0 || y < 0 || x >= im.c.width || y >= im.c.height) continue;
    if (ppAlphaH(im.holder)[y * im.c.width + x] > 30) return p;
  }
  return null;
}
async function encodePart(p) { p.png = await (await toBlob(p.c)).arrayBuffer(); p.alpha = null; }
async function encodeHolder(h) { h.png = await (await toBlob(h.c)).arrayBuffer(); h.alpha = null; }
/* --- setup: cut the imported image into parts --- */
function ppFitJoints(src, pts) {
  const J = rigAutoFit([{ id: 'img', pts }]); if (!J) return J;
  const d = src.getContext('2d').getImageData(0, 0, W, H).data, op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 100;
  { // the body's centre line goes through the head (the box centre is pulled sideways by a raised or stretched arm)
    const t0 = J.head.y, hg = Math.max(J.ftL.y, J.ftR.y) - t0; let sx = 0, c = 0, mn = W, mx = 0;
    for (let y = Math.round(t0); y < t0 + 0.1 * hg; y += 2) for (let x = 0; x < W; x += 2) if (op(x, y)) { sx += x; c++; mn = Math.min(mn, x); mx = Math.max(mx, x); }
    if (c > 20 && mx - mn < 0.35 * hg) { const dx = sx / c - J.root.x; for (const k of ['head', 'neck', 'chest', 'root', 'shL', 'shR', 'hpL', 'hpR']) J[k].x += dx; }
  }
  // image-aware axis, neck and shoulders: the bounding-box centre is off when feet are spread or one arm sticks out,
  // and arms hanging beside the body put the generic shoulders out in the air
  var armsDown = false, headFit = false;
  {
    const A = new Float32Array(W * H); for (let i = 0; i < A.length; i++) A[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    const hd = cariFindHead(A, W, H);
    if (hd && hd.neck < hd.bot - 0.3 * (hd.bot - hd.top)) {
      const H0 = hd.bot - hd.top;
      const rowRun = (y, x0) => {   // opaque run on row y that contains (or is nearest to) x0
        y = Math.round(y); let x = Math.round(x0);
        if (!op(x, y)) { let f = null; for (let k = 1; k < 0.1 * H0 && f == null; k++) { if (op(x - k, y)) f = x - k; else if (op(x + k, y)) f = x + k; } if (f == null) return null; x = f; }
        let a = x, b = x; while (op(a - 1, y)) a--; while (op(b + 1, y)) b++; return [a, b];
      };
      const nr = rowRun(hd.neck, hd.cx), nw = nr ? nr[1] - nr[0] : 0.05 * H0, neckX = nr ? (nr[0] + nr[1]) / 2 : hd.cx;
      let yc = hd.neck + 0.03 * H0;
      for (let y = hd.neck; y < hd.neck + 0.15 * H0; y++) { const r = rowRun(y, neckX); if (r && r[1] - r[0] > nw * 1.8) { yc = y; break; } }
      headFit = true; J.head = { x: Math.abs(hd.cx - neckX) > 0.03 * H0 ? J.head.x : hd.cx, y: hd.top }; J.neck = { x: (J.head.x + neckX) / 2, y: hd.neck }; J.chest = { x: neckX, y: yc };   // a raised arm beside the head pulls hd.cx sideways
      const ys = yc + 0.04 * H0, sr = rowRun(ys, neckX);
      if (sr && sr[1] - sr[0] < 0.42 * H0 && sr[1] - sr[0] > nw * 1.5) {   // arms down: shoulders sit just inside the torso's top corners
        const inset = Math.min(0.04 * H0, (sr[1] - sr[0]) * 0.15);
        J.shL = { x: sr[0] + inset, y: ys }; J.shR = { x: sr[1] - inset, y: ys };
        J.root.x = (sr[0] + sr[1]) / 2; armsDown = true;
        // the arm is the outermost thing on its rows: take the first run from the outside (the centre of a run that
        // also holds the shirt would put the elbow inside the body when the arm touches it)
        const outerRun = (y, sgn) => { y = Math.round(y); let x = sgn < 0 ? 0 : W - 1; while (x >= 0 && x < W && !op(x, y)) x -= sgn; if (x < 0 || x >= W) return null; const a = x; while (op(x - sgn, y)) x -= sgn; return [Math.min(a, x), Math.max(a, x)]; };
        for (const sd of ['L', 'R']) {
          const sgn = sd === 'L' ? -1 : 1, sh = J['sh' + sd], ha = J['ha' + sd];
          for (const [jt, y] of [['ha' + sd, ha.y], ['el' + sd, (sh.y + ha.y) / 2]]) {
            const r = outerRun(y, sgn); if (!r) continue;
            const x = r[1] - r[0] < 0.07 * H0 ? (r[0] + r[1]) / 2 : (sgn < 0 ? r[0] + 0.022 * H0 : r[1] - 0.022 * H0);
            J[jt] = { x, y };
          }
        }
      }
    }
  }
  const top = J.head.y, hgt = Math.max(J.ftL.y, J.ftR.y) - top, cx = J.root.x;
  // legs: follow each foot's run of pixels upward until the two runs join (the crotch). Works when legs are apart at an angle
  // and when the hands hang next to the thighs (a straight scan at the centre line fails there)
  {
    const runAt = (y, x) => { let a = x, b = x; while (op(a - 1, y)) a--; while (op(b + 1, y)) b++; return [a, b]; };
    const near = (y, x, R) => { x = Math.round(x); for (let k = 0; k < R; k++) { if (op(x - k, y)) return runAt(y, x - k); if (op(x + k, y)) return runAt(y, x + k); } return null; };
    const follow = (y, p) => { const m = Math.round((p[0] + p[1]) / 2); if (op(m, y)) return runAt(y, m); for (let x = p[0] - 2; x <= p[1] + 2; x++) if (op(x, y)) return runAt(y, x); return null; };
    let y = Math.round(Math.max(J.ftL.y, J.ftR.y) - 0.03 * hgt), rL = near(y, J.ftL.x, 0.06 * hgt), rR = near(y, J.ftR.x, 0.06 * hgt);
    if (rL && rR && rL[1] < rR[0]) {
      const wL = [], wR = []; let cr = null;
      for (; y > top + 0.35 * hgt; y--) {
        const nL = follow(y, rL), nR = follow(y, rR); if (!nL || !nR) break;
        if (nL[0] === nR[0]) { cr = y; break; }
        wL.push(nL[1] - nL[0]); wR.push(nR[1] - nR[0]); rL = nL; rR = nR;
      }
      if (cr != null && wL.length > 0.1 * hgt) {
        const thigh = w => { const a = w.slice(Math.floor(w.length * 0.6)).sort((p, q) => p - q); return a[Math.floor(a.length * 0.3)] || 0.06 * hgt; };
        const hy = cr - 0.02 * hgt, lx = rL[1] - thigh(wL) * 0.5, rx = rR[0] + thigh(wR) * 0.5;
        J.hpL = { x: lx, y: hy }; J.hpR = { x: rx, y: hy }; J.root = { x: (lx + rx) / 2, y: hy - 0.02 * hgt };
        J.knL = { x: (lx + J.ftL.x) / 2, y: (hy + J.ftL.y) / 2 }; J.knR = { x: (rx + J.ftR.x) / 2, y: (hy + J.ftR.y) / 2 };
        if (J.chest.y > J.root.y - 0.1 * hgt) J.chest.y = J.root.y - 0.25 * hgt;
      }
      else rL = null;
      if (rL) return ppFinishJoints(src, J, op, hgt, top, cx, armsDown, headFit);
    }
  }
  let crotch = null;
  for (let y = Math.round(top + 0.42 * hgt); y < top + 0.85 * hgt; y += 2) {
    if (op(cx, y) || op(cx - 3, y) || op(cx + 3, y)) continue;
    let l = false, r = false; for (let dx = 4; dx < 0.25 * hgt; dx += 3) { if (op(cx - dx, y)) l = true; if (op(cx + dx, y)) r = true; }
    if (l && r) { crotch = y; break; }
  }
  if (crotch) {
    const run = (sgn) => { let a = null, b = null; for (let dx = 3; dx < 0.3 * hgt; dx++) { const x = cx + sgn * dx; if (op(x, crotch + 6)) { if (a == null) a = x; b = x; } else if (a != null) break; } return a == null ? null : (a + b) / 2; };
    const lx = run(-1), rx = run(1), hy = crotch - 0.015 * hgt;
    if (lx != null && rx != null) {
      J.hpL = { x: lx, y: hy }; J.hpR = { x: rx, y: hy }; J.root = { x: cx, y: hy - 0.02 * hgt };
      J.knL = { x: (lx + J.ftL.x) / 2, y: (hy + J.ftL.y) / 2 }; J.knR = { x: (rx + J.ftR.x) / 2, y: (hy + J.ftR.y) / 2 };
      if (J.chest.y > J.root.y - 0.1 * hgt) J.chest.y = J.root.y - 0.25 * hgt;
    }
  }
  return ppFinishJoints(src, J, op, hgt, top, cx, armsDown, headFit);
}
/** shared end of joint fitting: neck/torso line, hands & feet from the drawing's shape, then centre the limb joints */
function ppFinishJoints(src, J, op, hgt, top, cx, armsDown, headFit) {
  if (!headFit) { // neck = narrowest row under the head; the torso starts where the body gets wide again
    const runW = y => { const x0 = Math.round(cx); if (!op(x0, y)) return 0; let a = x0, b = x0; while (op(a - 1, y) && x0 - a < W) a--; while (op(b + 1, y) && b - x0 < W) b++; return b - a; };
    let ny = null, nw = Infinity; for (let y = Math.round(top + 0.1 * hgt); y < top + 0.33 * hgt; y += 2) { const w = runW(y); if (w < nw) { nw = w; ny = y; } }
    if (ny != null) for (let y = ny; y < top + 0.42 * hgt; y += 2) if (runW(y) > Math.max(nw * 1.6, nw + 0.04 * hgt)) {
      if (Math.abs(y - J.chest.y) < 0.12 * hgt) { J.chest.y = y; J.neck.y = Math.min(J.neck.y, (ny + y) / 2); for (const k of ['shL', 'shR']) J[k].y = Math.max(J[k].y, y + 0.03 * hgt); }
      break;
    }
  }
  // arms already placed against the body (arms-down front view) keep their joints; ppFitLimbs still finds the feet
  // (a side whose hand ppFitLimbs finds raised above that elbow is a raised arm: the shape-based fit wins there)
  const keep = armsDown ? ['shL', 'elL', 'haL', 'shR', 'elR', 'haR'].map(k => [k, J[k]]) : null, skip = {};
  try { ppFitLimbs(src, J); } catch (e) { console.warn(e); }
  if (keep) {
    const K = Object.fromEntries(keep);
    for (const sd of ['L', 'R']) {
      if (J['ha' + sd].y < K['el' + sd].y) continue;
      for (const k of ['sh', 'el', 'ha']) J[k + sd] = K[k + sd];
      skip[sd] = true; if (J._out) delete J._out[sd];
    }
  }
  return ppCentreLimbs(J, op, hgt, skip);
}
/** centre limb joints inside the limb (scan across the limb at each joint) */
function ppCentreLimbs(J, op, hgt, skipArms) {   // skipArms: { L: true } = leave that arm's joints as placed
  const runMid = (x0, y0, horiz, range) => {   // horiz=true: scan a column (limb runs horizontally) ; else scan a row
    const at = t => horiz ? op(x0, t) : op(t, y0), c0 = horiz ? y0 : x0;
    let hit = null; for (let k = 0; k < range; k++) { if (at(c0 + k)) { hit = c0 + k; break; } if (at(c0 - k)) { hit = c0 - k; break; } }
    if (hit == null) return null; let a = hit, b = hit; while (at(a - 1) && hit - a < range) a--; while (at(b + 1) && b - hit < range) b++; return (a + b) / 2;
  };
  const rng = Math.round(0.1 * hgt);
  for (const sd of ['L', 'R']) {
    const sh = J['sh' + sd], el = J['el' + sd], ha = J['ha' + sd], sgn = sd === 'L' ? -1 : 1;
    for (const k of ['kn' + sd, 'ft' + sd]) { const jt = J[k]; const m = runMid(jt.x, jt.y - (k[0] === 'f' ? 0.02 * hgt : 0), false, rng); if (m != null) jt.x = m; }
    if (skipArms && skipArms[sd]) continue;
    const horiz = Math.abs(ha.x - sh.x) > Math.abs(ha.y - sh.y);
    if (!(J._out && J._out[sd])) for (const [jt, xoff] of [[el, 0], [ha, -sgn * 0.02 * hgt]]) { const m = runMid(jt.x + (horiz ? xoff : 0), jt.y, horiz, rng); if (m != null) { if (horiz) jt.y = m; else jt.x = m; } }
    if (horiz) { const m = runMid(sh.x + sgn * 0.03 * hgt, sh.y, true, rng); if (m != null) sh.y = m; }
  }
  delete J._out; return J;
}
function ppStartSetup(img) {
  if (playing) stopPlay(); commitFloating(); motionClose(); rigClose();
  const src = makeCanvas(), x = src.getContext('2d');
  const k = Math.min(W * 0.9 / img.width, H * 0.9 / img.height);
  x.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 4) for (let xx = 0; xx < W; xx += 4) if (d[(y * W + xx) * 4 + 3] > 100) pts.push({ x: xx, y });
  if (pts.length < 20) { toast('Ảnh trống sau khi xoá nền'); return; }
  const J = ppFitJoints(src, pts);
  ppSetup = { src, J, split: true };   // 2 segments per limb by default: knees and elbows bend when walking
  setTool('puppet', true);
  ppSyncBar(); requestRender();
  toast('Kéo các chấm cho khớp với vai, khuỷu, hông, gối… rồi bấm Cắt tự động', 4000);
}
const PP_GROUPS = split => split ? [
  { role: 'torso', name: 'Thân', bones: ['chest', 'shL', 'shR', 'hpL', 'hpR'], pivot: 'root', parent: null, z: 9 },
  { role: 'head', name: 'Đầu', bones: ['head', 'neck'], pivot: 'chest', tip: 'neck', parent: 'torso', z: 6 },
  { role: 'legL', name: 'Đùi trái', bones: ['knL'], pivot: 'hpL', tip: 'knL', parent: 'torso', z: 2 }, { role: 'shinL', name: 'Ống chân trái', bones: ['ftL'], pivot: 'knL', tip: 'ftL', parent: 'legL', z: 1 },
  { role: 'legR', name: 'Đùi phải', bones: ['knR'], pivot: 'hpR', tip: 'knR', parent: 'torso', z: 2 }, { role: 'shinR', name: 'Ống chân phải', bones: ['ftR'], pivot: 'knR', tip: 'ftR', parent: 'legR', z: 1 },
  { role: 'armL', name: 'Tay trái (trên)', bones: ['elL'], pivot: 'shL', tip: 'elL', parent: 'torso', z: 5 }, { role: 'foreL', name: 'Cẳng tay trái', bones: ['haL'], pivot: 'elL', tip: 'haL', parent: 'armL', z: 4 },
  { role: 'armR', name: 'Tay phải (trên)', bones: ['elR'], pivot: 'shR', tip: 'elR', parent: 'torso', z: 5 }, { role: 'foreR', name: 'Cẳng tay phải', bones: ['haR'], pivot: 'elR', tip: 'haR', parent: 'armR', z: 4 }
] : [
  { role: 'torso', name: 'Thân', bones: ['chest', 'shL', 'shR', 'hpL', 'hpR'], pivot: 'root', parent: null, z: 9 },
  { role: 'head', name: 'Đầu', bones: ['head', 'neck'], pivot: 'chest', tip: 'neck', parent: 'torso', z: 6 },
  { role: 'legL', name: 'Chân trái', bones: ['knL', 'ftL'], pivot: 'hpL', tip: 'knL', parent: 'torso', z: 2 },
  { role: 'legR', name: 'Chân phải', bones: ['knR', 'ftR'], pivot: 'hpR', tip: 'knR', parent: 'torso', z: 2 },
  { role: 'armL', name: 'Tay trái', bones: ['elL', 'haL'], pivot: 'shL', tip: 'elL', parent: 'torso', z: 5 },
  { role: 'armR', name: 'Tay phải', bones: ['elR', 'haR'], pivot: 'shR', tip: 'elR', parent: 'torso', z: 5 }
];
/* --- part regions: auto split (geodesic, follows drawn outlines) + hand painting before the cut --- */
const PP_R10 = ['torso', 'head', 'legL', 'shinL', 'legR', 'shinR', 'armL', 'foreL', 'armR', 'foreR'], PP_NONE = 10;
const PP_RCOL = ['#ff2d55', '#ffd60a', '#0a84ff', '#64d2ff', '#34c759', '#b4f05a', '#ff8a00', '#a0522d', '#af52de', '#ff7fe0'];
const PP_BONE_R = { chest: 0, shL: 0, shR: 0, hpL: 0, hpR: 0, neck: 1, head: 1, knL: 2, ftL: 3, knR: 4, ftR: 5, elL: 6, haL: 7, elR: 8, haR: 9 };
const ppRoleMap = (r, split) => split || r < 0 || r >= PP_NONE ? r : r === 3 || r === 5 || r === 7 || r === 9 ? r - 1 : r;
const ppInk = (d, i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b); return (255 - mx) - (mx - Math.min(r, g, b)) * 0.7 > 110; };
// Each opaque pixel goes to the bone it can reach first by walking INSIDE the drawing; crossing a dark outline costs extra,
// so a region stops at the line between an arm and the body instead of cutting straight through.
function ppAutoLabels(src, J) {
  const d = src.getContext('2d').getImageData(0, 0, W, H).data, n = W * H, lab = new Int8Array(n).fill(-1), dist = new Int32Array(n).fill(2147483647);
  const bin = new Uint8Array(n), ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 20) { bin[i] = 1; if (ppInk(d, i)) ink[i] = 1; }
  const RB = RBONES.map(j => { const a = J[RP[j]], b = J[j], dx = b.x - a.x, dy = b.y - a.y; return { j, r: PP_BONE_R[j], a, dx, dy, L: dx * dx + dy * dy || 1 }; });
  const byRole = {}; RB.forEach(s => (byRole[s.r] = byRole[s.r] || []).push(s));
  const chestY = J.chest.y - 2;
  const allowed = (r, x, y) => {
    if (r === 0 && y < chestY) return false;                                       // torso never above the chest line
    if (r === 2 || r === 4 || r === 6 || r === 8) {                                 // upper arm / thigh: not on the body side of its joint
      const s = byRole[r][0]; if ((x - s.a.x) * s.dx + (y - s.a.y) * s.dy < 0.02 * s.L) return false;
    }
    return true;
  };
  const Q = []; const push = (i, dd, r) => { if (dd >= dist[i]) return; dist[i] = dd; lab[i] = r; (Q[dd] || (Q[dd] = [])).push(i); };
  for (const s of RB) {
    const len = Math.sqrt(s.L), steps = Math.max(2, Math.ceil(len)), t0 = s.j === 'neck' ? 0.3 : (s.r === 2 || s.r === 4 || s.r === 6 || s.r === 8) ? 0.06 : 0;
    for (let k = Math.round(t0 * steps); k <= steps; k++) { const x = Math.round(s.a.x + s.dx * k / steps), y = Math.round(s.a.y + s.dy * k / steps); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x; if (bin[i] && allowed(s.r, x, y)) push(i, 0, s.r); }
  }
  const NB = [[1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 3], [1, -1, 3], [-1, 1, 3], [-1, -1, 3]], INK = 14;
  for (let dd = 0; dd < Q.length; dd++) {
    const b = Q[dd]; if (!b) continue; Q[dd] = null;
    for (const i of b) {
      if (dist[i] !== dd) continue; const x = i % W, y = (i / W) | 0, r = lab[i];
      for (const [ox, oy, c] of NB) {
        const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const k = Y * W + X;
        if (!bin[k] || !allowed(r, X, Y)) continue; push(k, dd + c + (ink[k] ? INK : 0), r);
      }
    }
  }
  // pieces not connected to any bone (a detached hand, a loose hair strand): nearest bone in a straight line
  for (let i = 0; i < n; i++) if (bin[i] && lab[i] < 0) {
    const q = { x: i % W, y: (i / W) | 0 }; let best = 0, bd = Infinity;
    for (const s of RB) { if (!allowed(s.r, q.x, q.y)) continue; const dd = segDist(q, s.a, { x: s.a.x + s.dx, y: s.a.y + s.dy }); if (dd < bd) { bd = dd; best = s.r; } }
    lab[i] = best;
  }
  return lab;
}
// Joints from the drawing's shape: hands & feet are the tips farthest from the hips when walking inside the drawing.
function ppFitLimbs(src, J) {
  const S4 = 4, gw = Math.ceil(W / S4), gh = Math.ceil(H / S4), d = src.getContext('2d').getImageData(0, 0, W, H).data;
  const occ = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) for (const [ox, oy] of [[1, 1], [3, 3], [1, 3], [3, 1]]) { const X = x * S4 + ox, Y = y * S4 + oy; if (X < W && Y < H && d[(Y * W + X) * 4 + 3] > 100) { occ[y * gw + x] = 1; break; } }
  const bfs = (sx, sy) => {
    const g = new Float32Array(gw * gh).fill(Infinity); let s = Math.round(sy / S4) * gw + Math.round(sx / S4);
    if (!occ[s]) { let bd = Infinity; for (let i = 0; i < occ.length; i++) if (occ[i]) { const dd = Math.hypot(i % gw - sx / S4, ((i / gw) | 0) - sy / S4); if (dd < bd) { bd = dd; s = i; } } }
    if (!occ[s]) return null; g[s] = 0; let cur = [s];
    while (cur.length) { const nx = []; for (const i of cur) { const x = i % gw, y = (i / gw) | 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const k = Y * gw + X; if (occ[k] && g[k] > g[i] + 1) { g[k] = g[i] + 1; nx.push(k); } } } cur = nx; }
    return g;
  };
  const g = bfs(J.root.x, J.root.y); if (!g) return;
  const hgt = Math.max(80, Math.max(J.ftL.y, J.ftR.y) - J.head.y), hc = hgt / S4, tol = 0.12 * hc;
  const sup = new Uint8Array(gw * gh), ext = [];
  for (let k = 0; k < 7; k++) {
    let best = -1, bg = 0.22 * hc; for (let i = 0; i < g.length; i++) if (!sup[i] && occ[i] && g[i] !== Infinity && g[i] > bg) { bg = g[i]; best = i; }
    if (best < 0) break; ext.push({ x: (best % gw) * S4 + 2, y: ((best / gw) | 0) * S4 + 2, g: g[best], i: best });
    const ge = bfs(best % gw * S4, ((best / gw) | 0) * S4); for (let i = 0; i < g.length; i++) if (ge && ge[i] < g[best] - g[i] + tol) sup[i] = 1;
  }
  const P = (x, y) => ({ x, y }), cx = J.root.x, used = new Set();
  // along the walk from a tip back to the hips, the point whose distance-from-hips is `gt`
  const pathTo = (e, gt, stop) => { const out = []; let i = e.i; for (;;) { const q = P((i % gw) * S4 + 2, ((i / gw) | 0) * S4 + 2); out.push(q); if (g[i] <= gt || (stop && Math.hypot(q.x - stop.x, q.y - stop.y) < 0.04 * hgt)) break; const x = i % gw, y = (i / gw) | 0; let nb = i; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const k = Y * gw + X; if (g[k] < g[nb]) nb = k; } if (nb === i) break; i = nb; } return out; };
  // point at fraction f of the walk's length (0 = the tip)
  const along = (pts, f) => { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); let acc = 0; const T = f * L; for (let k = 1; k < pts.length; k++) { const s2 = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); if (acc + s2 >= T) { const u = s2 ? (T - acc) / s2 : 0; return P(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * u, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * u); } acc += s2; } return pts[pts.length - 1]; };
  const gAt = p => { const i = Math.round(p.y / S4) * gw + Math.round(p.x / S4); return g[i] === Infinity || g[i] == null ? null : g[i]; };
  // feet: the two lowest tips below the hips
  const feet = ext.filter(e => e.y > J.root.y + 0.15 * hgt).sort((a, b) => b.y - a.y).slice(0, 2);
  if (feet.length === 2) {
    feet.sort((a, b) => a.x - b.x);
    [['L', feet[0]], ['R', feet[1]]].forEach(([sd, e]) => { used.add(e); const pts = pathTo(e, gAt(J['hp' + sd]) || 0, J['hp' + sd]); J['ft' + sd] = along(pts, 0.04); J['kn' + sd] = along(pts, 0.5); });
  }
  // an arm drawn against the body is not a "tip": find it as a long colour patch inside its own outline, beside the torso
  let comps = null;
  const ppFitArmByOutline = sd => {
    if (!comps) {
      const fill = new Uint8Array(gw * gh); for (let i = 0; i < fill.length; i++) if (occ[i]) { const X = (i % gw) * S4 + 2, Y = ((i / gw) | 0) * S4 + 2; if (X < W && Y < H && !ppInk(d, Y * W + X)) fill[i] = 1; }
      const cid = new Int32Array(gw * gh).fill(-1); comps = [];
      for (let i = 0; i < fill.length; i++) if (fill[i] && cid[i] < 0) {
        const cm = { n: 0, sx: 0, x0: gw, x1: 0, y0: gh, y1: 0, cells: [] }, st = [i]; cid[i] = comps.length;
        while (st.length) { const k = st.pop(), x = k % gw, y = (k / gw) | 0; cm.n++; cm.sx += x; cm.cells.push(k); if (x < cm.x0) cm.x0 = x; if (x > cm.x1) cm.x1 = x; if (y < cm.y0) cm.y0 = y; if (y > cm.y1) cm.y1 = y;
          for (const q of [x > 0 ? k - 1 : -1, x < gw - 1 ? k + 1 : -1, y > 0 ? k - gw : -1, y < gh - 1 ? k + gw : -1]) if (q >= 0 && fill[q] && cid[q] < 0) { cid[q] = comps.length; st.push(q); } }
        comps.push(cm);
      }
    }
    const sgn = sd === 'L' ? -1 : 1, ch = J.chest.y / S4, H4 = hgt / S4, rootCell = Math.round(J.root.y / S4) * gw + Math.round(cx / S4);
    const arm = comps.filter(cm => (cm.sx / cm.n * S4 - cx) * sgn > 0.1 * hgt && cm.y0 < ch + 0.2 * H4 && cm.y1 > ch + 0.15 * H4 && cm.y1 - cm.y0 >= 0.15 * H4 && (cm.x1 - cm.x0) < 0.6 * (cm.y1 - cm.y0) && !cm.cells.includes(rootCell)).sort((a, b) => b.n - a.n)[0];
    if (!arm) return;
    const rowMid = y => { let sx = 0, c = 0; for (const k of arm.cells) if (((k / gw) | 0) === y) { sx += k % gw; c++; } return c ? sx / c * S4 + 2 : null; };
    const yt = arm.y0 + Math.max(1, Math.round(0.03 * H4)), yb = arm.y1, xt = rowMid(yt), xb = rowMid(yb); if (xt == null || xb == null) return;
    let hand = P(xb, yb * S4 + 2);
    const below = comps.filter(cm => cm !== arm && cm.y0 >= arm.y1 - 2 && cm.y0 <= arm.y1 + 4 && cm.x1 >= arm.x0 - 2 && cm.x0 <= arm.x1 + 2 && cm.y1 - cm.y0 < 0.15 * H4).sort((a, b) => b.n - a.n)[0];
    if (below) { let sy = 0; below.cells.forEach(k => sy += (k / gw) | 0); hand = P(below.sx / below.n * S4 + 2, sy / below.n * S4 + 2); }
    (J._out = J._out || {})[sd] = true; J['sh' + sd] = P(xt, yt * S4 + 2); J['ha' + sd] = hand; J['el' + sd] = P((xt + hand.x) / 2, (yt * S4 + 2 + hand.y) / 2);
  };
  // hands: tips left / right of the body, not the head, not the feet
  for (const sd of ['L', 'R']) {
    const sgn = sd === 'L' ? -1 : 1, sh = J['sh' + sd], gs = gAt(sh);
    const c = ext.filter(e => !used.has(e) && (e.x - cx) * sgn > 0.06 * hgt && e.y < J.root.y + 0.3 * hgt && !(Math.abs(e.x - cx) < 0.12 * hgt && e.y < J.chest.y)).sort((a, b) => b.g - a.g)[0];
    if (!c || gs == null || c.g - gs < 0.12 * hc) { ppFitArmByOutline(sd); continue; } used.add(c);
    const pts = pathTo(c, gs, sh); J['ha' + sd] = along(pts, 0.1); J['el' + sd] = along(pts, 0.55);
  }
}
let ppLabTool = 'brush', ppLabSize = 26, ppLabPick = 6, ppLastCut = null;
function ppLabEff(st) { const n = W * H, out = new Int8Array(n); for (let i = 0; i < n; i++) out[i] = st.hand[i] >= 0 ? st.hand[i] : st.auto[i]; return out; }
function ppLabBegin() {
  const st = ppSetup; if (!st) return;
  const pm = progress('Đang chia vùng tay, chân, đầu…');
  setTimeout(() => {
    try {
      if (!st.auto || st.autoJ !== JSON.stringify(st.J)) { st.auto = ppAutoLabels(st.src, st.J); st.autoJ = JSON.stringify(st.J); }
      if (!st.hand) st.hand = new Int8Array(W * H).fill(-1);
      st.bin = new Uint8Array(W * H); const d = st.src.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 0; i < W * H; i++) st.bin[i] = d[i * 4 + 3] > 20 ? 1 : 0;
      st.stage = 'paint'; st.undo = st.undo || []; st.redo = st.redo || [];
      if (!st.ov) st.ov = makeCanvas();
      if (!st.gray) {   // grey + a little contrast by hand: ctx.filter does not work on older iPad Safari
        st.gray = makeCanvas(); const gx = st.gray.getContext('2d'); gx.drawImage(st.src, 0, 0);
        const im = gx.getImageData(0, 0, W, H), p = im.data;
        for (let i = 0; i < p.length; i += 4) { const y = Math.max(0, Math.min(255, (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2] - 128) * 1.2 + 128)); p[i] = p[i + 1] = p[i + 2] = y; }
        gx.putImageData(im, 0, 0);
      }
      ppLabOverlay(st);
    } finally { pm.close(); }
    ppSyncBar(); requestRender();
    toast('Mỗi màu là một mảnh. Chỗ nào sai: chọn tên mảnh rồi tô lên hình', 4500);
  }, 30);
}
function ppLabOverlay(st, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) {
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W - 1, x1 | 0); y1 = Math.min(H - 1, y1 | 0); if (x1 < x0 || y1 < y0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, im = new ImageData(w, h), o = im.data, cols = PP_RCOL.map(hexToRgb);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y0 + y) * W + x0 + x; if (!st.bin[i]) continue; const k = (y * w + x) * 4;
    const v = st.hand[i] >= 0 ? st.hand[i] : st.auto[i];
    if (v === PP_NONE) { const s = ((x0 + x + y0 + y) >> 3) & 1; o[k] = o[k + 1] = o[k + 2] = s ? 40 : 200; o[k + 3] = 200; continue; }
    const c = cols[ppRoleMap(v, st.split)] || cols[0]; o[k] = c[0]; o[k + 1] = c[1]; o[k + 2] = c[2]; o[k + 3] = 255;
  }
  st.ov.getContext('2d').putImageData(im, x0, y0);
}
function ppLabSnap(st) { st.undo.push(st.hand.slice()); if (st.undo.length > 15) st.undo.shift(); st.redo.length = 0; }
function ppLabHistory(back) {
  const st = ppSetup; const from = back ? st.undo : st.redo, to = back ? st.redo : st.undo;
  if (!from.length) { toast(back ? 'Không còn gì để hoàn tác' : 'Không còn gì để làm lại'); return; }
  to.push(st.hand); st.hand = from.pop(); ppLabOverlay(st); ppLabSyncBar(); requestRender(); toast(back ? 'Hoàn tác' : 'Làm lại', 700);
}
function ppLabDab(st, a, b) {
  const r = ppLabSize, v = ppLabPick, x0 = Math.floor(Math.min(a.x, b.x) - r), y0 = Math.floor(Math.min(a.y, b.y) - r), x1 = Math.ceil(Math.max(a.x, b.x) + r), y1 = Math.ceil(Math.max(a.y, b.y) + r);
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
    const i = y * W + x; if (!st.bin[i] || segDist({ x, y }, a, b) > r) continue; st.hand[i] = v;
  }
  ppLabOverlay(st, x0, y0, x1, y1); requestRender();
}
// tap = take the whole patch of similar colour under the finger (+ the outline around it)
function ppLabBucket(st, p) {
  const X = Math.round(p.x), Y = Math.round(p.y); if (X < 0 || Y < 0 || X >= W || Y >= H || !st.bin[Y * W + X]) { toast('Chạm lên hình nhân vật'); return false; }
  const d = st.src.getContext('2d').getImageData(0, 0, W, H).data, s = Y * W + X, T = 48, seen = new Uint8Array(W * H);
  const r0 = d[s * 4], g0 = d[s * 4 + 1], b0 = d[s * 4 + 2], seedInk = ppInk(d, s);
  const ok = i => st.bin[i] && (seedInk ? ppInk(d, i) : !ppInk(d, i)) && Math.abs(d[i * 4] - r0) + Math.abs(d[i * 4 + 1] - g0) + Math.abs(d[i * 4 + 2] - b0) < T * 2;
  let stack = [s], x0 = X, y0 = Y, x1 = X, y1 = Y; seen[s] = 1; const got = [];
  while (stack.length) { const i = stack.pop(); got.push(i); const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const k of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (k >= 0 && !seen[k] && ok(k)) { seen[k] = 1; stack.push(k); } }
  // grow a few pixels into the dark outline so the line goes with the patch
  let front = got;
  if (!seedInk) for (let it = 0; it < 6; it++) { const nx = []; for (const i of front) { const x = i % W; for (const k of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (k >= 0 && k < W * H && !seen[k] && st.bin[k] && ppInk(d, k)) { seen[k] = 1; nx.push(k); got.push(k); } } front = nx; }
  for (const i of got) st.hand[i] = ppLabPick;
  ppLabOverlay(st, x0 - 8, y0 - 8, x1 + 8, y1 + 8); requestRender(); return true;
}
function ppLabLasso(st, poly) {
  if (!poly || poly.length < 3) return;
  const m = makeCanvas(), mx = m.getContext('2d'); mx.beginPath(); mx.moveTo(poly[0].x, poly[0].y); poly.forEach(q => mx.lineTo(q.x, q.y)); mx.closePath(); mx.fillStyle = '#000'; mx.fill();
  let x0 = W, y0 = H, x1 = 0, y1 = 0; poly.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1)); if (x1 < x0 || y1 < y0) return;
  const a = mx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (st.bin[i] && a[((y - y0) * (x1 - x0 + 1) + x - x0) * 4 + 3] > 127) st.hand[i] = ppLabPick; }
  ppLabOverlay(st, x0, y0, x1, y1);
}
function ppLabStart(p, base) {
  const st = ppSetup; ppLabSnap(st);
  if (ppLabTool === 'bucket') { if (!ppLabBucket(st, p)) st.undo.pop(); ppLabSyncBar(); return; }
  if (ppLabTool === 'lasso') { lasso = [p]; action = { ...base, kind: 'lablasso' }; requestRender(); return; }
  action = { ...base, kind: 'labpaint', last: p }; ppLabDab(st, p, p);
}
function ppLabPartList(st) {
  const gs = PP_GROUPS(st.split).map(g => [PP_R10.indexOf(g.role), g.name]);
  return [...gs, [PP_NONE, '🚫 Bỏ đi (nền thừa)']];
}
function ppLabSyncBar() {
  const st = ppSetup, list = ppLabPartList(st), box = $('#ppLabParts');
  if (!list.some(([v]) => v === ppLabPick)) ppLabPick = list[0][0];
  box.innerHTML = list.map(([v, name]) => `<button class="chip small ${v === ppLabPick ? 'on' : ''}" data-plp="${v}"><i style="background:${v === PP_NONE ? 'repeating-linear-gradient(45deg,#333 0 4px,#ccc 4px 8px)' : PP_RCOL[v]}"></i>${name}</button>`).join('');
  box.querySelectorAll('[data-plp]').forEach(b => b.addEventListener('click', () => { ppLabPick = +b.dataset.plp; ppLabSyncBar(); }));
  document.querySelectorAll('[data-plt]').forEach(b => b.classList.toggle('on', b.dataset.plt === ppLabTool));
  $('#ppLabSize').value = ppLabSize; $('#ppLabSplit').checked = st.split;
  $('#ppLabUndo').disabled = !(st.undo && st.undo.length); $('#ppLabRedo').disabled = !(st.redo && st.redo.length);
}
// what is saved of a cut-out piece: ONE place for IndexedDB (saveProject), ZIP export and 🧍 Kho nhân vật (all three read
// it back with { ...q }). A new piece field only needs adding here.
function ppPartMeta(p) { return { id: p.id, name: p.name, role: p.role, parent: p.parent, z: p.z, ox: p.ox, oy: p.oy, px: p.px, py: p.py, tip: p.tip || null, asset: p.asset || null }; }
// a new character appears from the frame being edited on: frames before it keep showing only what they had
function ppHideBefore(parts) { for (let i = 0; i < S.cur; i++) { const f = S.frames[i]; f.pp = f.pp || {}; for (const q of parts) f.pp[q.id] = { ...(f.pp[q.id] || {}), h: true }; f.ppKey = true; } }
// a character was added (cut, 🧍 Kho nhân vật, ⚽ Cầu thủ mẫu): add its pieces on top of the others
function ppPushChar(parts) {
  if (!S.pp) { S.pp = { parts: [] }; S.frames.forEach(f => { if (!f.pp) f.pp = {}; }); }
  S.pp.parts.push(...parts); ppRenormZ(); ppHideBefore(parts);
}
// …then show it: puppet on, tab Tư thế, every thumbnail redrawn, saved (undo: automatic snapshot)
function ppShowAdded() { S.showPP = true; updateToggles(); openTab('pp', 'pose'); ppSyncBar(); S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); requestRender(); }
async function ppAutoCut(whole) {
  const st = ppSetup; if (!st) return;
  let addMode = false;
  const recut = st.recut && S.pp && st.recut.ids.some(id => ppPart(id)) ? st.recut : null;
  if (S.pp && S.pp.parts.length && !recut) {
    const r = await modal({ title: 'Đã có nhân vật ghép', html: '<p><b>Thêm nhân vật</b>: giữ nhân vật cũ, thêm nhân vật này vào cùng cảnh.<br><b>Thay thế</b>: xoá nhân vật cũ và tư thế cũ.</p>', buttons: [{ label: 'Huỷ', value: null }, { label: 'Thay thế', value: 'replace', cls: 'danger' }, { label: '＋ Thêm nhân vật', value: 'add', primary: true }] });
    if (!r) return; addMode = r === 'add';
  }
  const pm = progress('Đang cắt mảnh…'); await new Promise(r => setTimeout(r, 30));
  const x = st.src.getContext('2d'), img = x.getImageData(0, 0, W, H), d = img.data, n = W * H;
  // regions: what the user painted wins, else the automatic split (recomputed if the joints moved since)
  if (!whole && (!st.auto || st.autoJ !== JSON.stringify(st.J))) { st.auto = ppAutoLabels(st.src, st.J); st.autoJ = JSON.stringify(st.J); }
  const eff = whole ? null : st.hand ? ppLabEff(st) : st.auto;
  const bin = new Uint8Array(n); let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 20 && !(eff && eff[i] === PP_NONE)) { bin[i] = 1; const xx = i % W, yy = (i / W) | 0; if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy; }
  let groups;
  if (whole) groups = [{ role: 'torso', name: 'Cả người', bones: RBONES, pivot: 'root', parent: null, z: 2 }];
  else groups = PP_GROUPS(st.split);
  const label = new Int8Array(n).fill(-1), J = JSON.parse(JSON.stringify(st.J));
  const dt = chamferDT(bin, W, H);
  const hgt0 = Math.max(80, by1 - by0);
  const gIndex = {}; groups.forEach((g, gi) => gIndex[g.role] = gi);
  for (let i = 0; i < n; i++) if (bin[i]) { if (whole) label[i] = 0; else { const gi = gIndex[PP_R10[ppRoleMap(eff[i], st.split)]]; label[i] = gi == null ? 0 : gi; } }
  // when a region was painted away from its joint, put the pivot where the piece really meets its parent (centre of the seam)
  if (!whole) for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]; if (!g.parent) continue; const par = gIndex[g.parent];
    const seam = [], pv = J[g.pivot];
    for (let y = Math.max(1, by0); y <= Math.min(H - 2, by1); y++) for (let xx = Math.max(1, bx0); xx <= Math.min(W - 2, bx1); xx++) { const i = y * W + xx; if (label[i] === gi && (label[i - 1] === par || label[i + 1] === par || label[i - W] === par || label[i + W] === par)) seam.push(xx, y); }
    if (seam.length < 10) continue;
    // the part of the seam nearest the old joint (a long seam, e.g. an arm drawn against the body, pivots at its top end)
    let nx = 0, ny = 0, nd = Infinity; for (let k = 0; k < seam.length; k += 2) { const dd = Math.hypot(seam[k] - pv.x, seam[k + 1] - pv.y); if (dd < nd) { nd = dd; nx = seam[k]; ny = seam[k + 1]; } }
    const rr = Math.max(8, 0.05 * hgt0); let sx = 0, sy = 0, c = 0; for (let k = 0; k < seam.length; k += 2) if (Math.hypot(seam[k] - nx, seam[k + 1] - ny) <= rr) { sx += seam[k]; sy += seam[k + 1]; c++; }
    const bc = { x: sx / c, y: sy / c };
    if (Math.hypot(bc.x - pv.x, bc.y - pv.y) <= 0.035 * hgt0) continue;
    J[g.pivot] = bc;
    let far = null, fd = -1; for (let y = by0; y <= by1; y++) for (let xx = bx0; xx <= bx1; xx++) { const i = y * W + xx; if (label[i] === gi) { const dd = (xx - bc.x) ** 2 + (y - bc.y) ** 2; if (dd > fd) { fd = dd; far = { x: xx, y }; } } }
    if (!far || g.role === 'head') continue;
    const end = { x: bc.x + (far.x - bc.x) * 0.9, y: bc.y + (far.y - bc.y) * 0.9 }, bn = g.bones;
    J[bn[bn.length - 1]] = end; if (bn.length === 2) J[bn[0]] = { x: (bc.x + end.x) / 2, y: (bc.y + end.y) / 2 };
  }
  const hw = {};
  for (const j of RBONES) {
    const a = J[RP[j]], b = J[j], vals = [];
    for (let t = 0.3; t <= 0.71; t += 0.1) { const x = Math.round(a.x + (b.x - a.x) * t), y = Math.round(a.y + (b.y - a.y) * t); if (x >= 0 && y >= 0 && x < W && y < H && bin[y * W + x]) vals.push(dt[y * W + x]); }
    vals.sort((p, q) => p - q); hw[j] = vals.length ? vals[vals.length >> 1] : 0.03 * hgt0;
  }
  // where an arm/leg merges into the body the distance transform is huge; the forearm/shin width is a better guess
  for (const sd of ['L', 'R']) { if (hw['ha' + sd]) hw['el' + sd] = Math.min(hw['el' + sd], hw['ha' + sd] * 1.4); if (hw['ft' + sd]) hw['kn' + sd] = Math.min(hw['kn' + sd], hw['ft' + sd] * 1.6); }
  // arms hanging down (front view) are drawn OVER the body, and the body gets the area behind them filled in,
  // so swinging an arm does not leave a hole in the shirt
  const front = new Set();
  if (!whole) for (const sd of ['L', 'R']) {
    const gi = gIndex['arm' + sd]; if (gi == null) continue;
    const sh = J['sh' + sd], ha = J['ha' + sd], L = Math.hypot(ha.x - sh.x, ha.y - sh.y) || 1;
    if ((ha.y - sh.y) / L > 0.6) { front.add(gi); groups[gi].z = 12; const fi = gIndex['fore' + sd]; if (fi != null) { front.add(fi); groups[fi].z = 11; } }
  }
  const capR = groups.map(g => { if (whole || !g.parent) return 0; return Math.max(10, Math.min(0.08 * hgt0, (hw[g.tip] || 0.025 * hgt0) * 1.3)); });
  // descendants of each group (for joint fill: the child and everything hanging off it)
  const desc = groups.map((g, gi) => { const s = new Set([gi]); let grew = true; while (grew) { grew = false; groups.forEach((h, hi) => { if (h.parent && s.has(gIndex[h.parent]) && !s.has(hi)) { s.add(hi); grew = true; } }); } return s; });
  // Joints. Children are drawn UNDER their parent, so the parent's edge hides the seam (like a sleeve over a shoulder).
  // 1) parent gets back pixels on ITS side of the joint that were assigned to the child (filled with parent-like colour)
  // 2) the child's cap (disk at the joint, hidden under the parent at rest) is painted with the child's own colours
  const extra = groups.map(() => new Map()), capCol = groups.map(() => new Map()), trim = groups.map(() => new Set());
  if (!whole) {
    let jn = 0; const njoints = groups.filter(g => g.parent).length, mode = ppFillMode === 'off' ? 'fast' : ppFillMode;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]; if (!g.parent) continue;
      const par = gIndex[g.parent], pv = J[g.pivot], tp = J[g.tip], R = capR[gi] * 1.2, cr = Math.ceil(R * 2.2);
      const bdx = tp.x - pv.x, bdy = tp.y - pv.y, bl = Math.hypot(bdx, bdy) || 1;
      pm.set(`Đang vá khớp ${++jn}/${njoints}${mode === 'ai' ? ' (AI)' : ''}…`);
      const cx0 = Math.max(0, Math.floor(pv.x - cr)), cy0 = Math.max(0, Math.floor(pv.y - cr)), cx1 = Math.min(W, Math.ceil(pv.x + cr)), cy1 = Math.min(H, Math.ceil(pv.y + cr));
      const cw = cx1 - cx0, ch = cy1 - cy0; if (cw < 4 || ch < 4) continue;
      const rgba = new Uint8ClampedArray(cw * ch * 4), kPar = new Uint8Array(cw * ch), hPar = new Uint8Array(cw * ch), kChild = new Uint8Array(cw * ch), hChild = new Uint8Array(cw * ch);
      let anyP = false, anyC = false;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const X = cx0 + x, Y = cy0 + y, i = Y * W + X, k = y * cw + x; rgba.set(d.subarray(i * 4, i * 4 + 4), k * 4);
        const l = label[i]; if (!bin[i] || l < 0) continue;
        const mine = desc[gi].has(l), dist = Math.hypot(X - pv.x, Y - pv.y), along = ((X - pv.x) * bdx + (Y - pv.y) * bdy) / bl;
        const R0 = d[i * 4], G0 = d[i * 4 + 1], B0 = d[i * 4 + 2], mx0 = Math.max(R0, G0, B0), ink0 = (255 - mx0) - (mx0 - Math.min(R0, G0, B0)) * 0.7;
        const solid = d[i * 4 + 3] > 200;
        if (mine) {
          if (ink0 < 110 && solid) kChild[k] = 1;
          if (ppFillMode !== 'off' && dist <= R && along < 0) { hPar[k] = 1; anyP = true; }
          else if (g.role !== 'head' && along >= 0 && along < capR[gi] * 0.6 && dist > capR[gi]) trim[gi].add(i);   // square corners of the limb end: hand them to the parent
        }
        else if (l === par) { if (solid) kPar[k] = 1; if (dist <= capR[gi]) { hChild[k] = 1; anyC = true; } }   // only the parent's own pixels (an arm next to the body must not paint over the shirt)
      }
      if (anyP && kPar.some(v => v)) {
        const res = await fillCrop(rgba, cw, ch, kPar, hPar, mode);
        for (let k = 0; k < hPar.length; k++) if (hPar[k]) { const x = k % cw, y = (k / cw) | 0; extra[par].set((cy0 + y) * W + cx0 + x, [res[k * 4], res[k * 4 + 1], res[k * 4 + 2]]); }
      }
      if (anyC && !(front.has(gi) && g.parent === 'torso') && kChild.some(v => v)) {
        const res = diffuseFill(rgba, cw, ch, kChild);
        for (let k = 0; k < hChild.length; k++) if (hChild[k]) { const x = k % cw, y = (k / cw) | 0; capCol[gi].set((cy0 + y) * W + cx0 + x, [res[k * 4], res[k * 4 + 1], res[k * 4 + 2]]); }
      }
    }
  }
  groups.forEach((g, gi) => { if (!g.parent) return; const par = gIndex[g.parent]; for (const i of trim[gi]) if (!extra[par].has(i)) extra[par].set(i, [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); });
  const tor = gIndex.torso;
  const legG = new Set(['legL', 'legR', 'shinL', 'shinR'].map(r => gIndex[r]).filter(v => v != null));
  if ((front.size || legG.size) && tor != null && !whole) {
    pm.set('Đang vá phần thân sau tay, chân…');
    const hole = []; let hx0 = W, hy0 = H, hx1 = -1, hy1 = -1;
    const shR = Math.round(0.07 * hgt0), nearSh = (x, y) => ['L', 'R'].some(sd => front.has(gIndex['arm' + sd]) && Math.hypot(x - J['sh' + sd].x, y - J['sh' + sd].y) < shR);   // the round of the shoulder
    // the body's left/right edge on each row (arms: also look a little up and down, so a sleeve that covers the whole row is still inside)
    const rMn = new Int32Array(H).fill(W), rMx = new Int32Array(H).fill(-1);
    for (let y = by0; y <= by1; y++) for (let xx = bx0; xx <= bx1; xx++) if (label[y * W + xx] === tor) { if (xx < rMn[y]) rMn[y] = xx; rMx[y] = xx; }
    const vr = Math.round(0.06 * hgt0);
    for (let y = by0; y <= by1; y++) {
      if (rMx[y] < 0) continue;
      let amn = rMn[y], amx = rMx[y];
      for (let k = Math.max(by0, y - vr); k <= Math.min(by1, y + vr); k++) if (rMx[k] >= 0) { amn = Math.min(amn, rMn[k]); amx = Math.max(amx, rMx[k]); }
      const mn = rMn[y], mx = rMx[y];
      for (let xx = Math.max(bx0, amn - shR); xx <= Math.min(bx1, amx + shR); xx++) { const i = y * W + xx, l = label[i]; if (bin[i] && !extra[tor].has(i) && ((front.has(l) && ((xx > amn && xx < amx) || nearSh(xx, y))) || (legG.has(l) && xx > mn && xx < mx))) { hole.push(i); if (xx < hx0) hx0 = xx; if (xx > hx1) hx1 = xx; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y; } }
    }
    if (hole.length) {
      const P = 12; hx0 = Math.max(0, hx0 - P); hy0 = Math.max(0, hy0 - P); hx1 = Math.min(W - 1, hx1 + P); hy1 = Math.min(H - 1, hy1 + P);
      const cw = hx1 - hx0 + 1, ch = hy1 - hy0 + 1, rgba = new Uint8ClampedArray(cw * ch * 4), kn = new Uint8Array(cw * ch), ho = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) { const i = (hy0 + y) * W + hx0 + xx, k = y * cw + xx; rgba.set(d.subarray(i * 4, i * 4 + 4), k * 4); if (label[i] === tor && d[i * 4 + 3] > 200) kn[k] = 1; }
      for (const i of hole) ho[(((i / W) | 0) - hy0) * cw + (i % W) - hx0] = 1;
      const res = await fillCrop(rgba, cw, ch, kn, ho, ppFillMode === 'ai' ? 'ai' : 'fast');
      for (const i of hole) { const k = ((((i / W) | 0) - hy0) * cw + (i % W) - hx0) * 4; extra[tor].set(i, [res[k], res[k + 1], res[k + 2]]); }
    }
  }
  const parts = [], idOf = {};
  groups.forEach(g => idOf[g.role] = newId());
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi], pv = J[g.pivot], cR = capR[gi], ex = extra[gi], cc = capCol[gi], tr = trim[gi];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const parI = g.parent ? gIndex[g.parent] : -1;
    const isCap = i => cR && bin[i] && (label[i] === parI || label[i] === gi) && Math.hypot(i % W - pv.x, ((i / W) | 0) - pv.y) <= cR;
    const inPart = i => (label[i] === gi && !tr.has(i)) || isCap(i) || ex.has(i);
    for (let y = by0; y <= by1; y++) for (let xx = bx0; xx <= bx1; xx++) { const i = y * W + xx; if (inPart(i)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) continue;
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1, c = makeCanvas(pw, ph), cx = c.getContext('2d'), out = cx.createImageData(pw, ph);
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) {
      const i = y * W + xx, j = ((y - y0) * pw + (xx - x0)) * 4;
      const e = ex.get(i);
      if (label[i] === gi && !e && !tr.has(i)) { out.data.set(d.subarray(i * 4, i * 4 + 4), j); continue; }
      if (e) { out.data[j] = e[0]; out.data[j + 1] = e[1]; out.data[j + 2] = e[2]; out.data[j + 3] = d[i * 4 + 3]; continue; }
      if (isCap(i)) { const col = cc.get(i); if (col) { out.data[j] = col[0]; out.data[j + 1] = col[1]; out.data[j + 2] = col[2]; out.data[j + 3] = d[i * 4 + 3]; } }
    }
    cx.putImageData(out, 0, 0);
    const tipJ = whole ? null : g.role === 'head' ? 'head' : g.role === 'torso' ? 'chest' : g.bones[g.bones.length - 1];
    parts.push({ id: idOf[g.role], name: g.name, role: whole ? '' : g.role, parent: g.parent ? idOf[g.parent] : null, z: g.z, ox: x0, oy: y0, px: pv.x, py: pv.y, c, tip: tipJ ? { x: J[tipJ].x, y: J[tipJ].y } : null });
  }
  ppRenormZ0(parts);
  for (const p of parts) await encodePart(p);
  if (recut) {
    // cut again after fixing regions: swap this character's pieces, keep its poses, other characters and attached extras
    const old = S.pp.parts.filter(q => recut.ids.includes(q.id)), oldIds = new Set(old.map(q => q.id));
    const zb = old.length ? Math.min(...old.map(q => q.z)) : 0, suf = ((old.find(q => !q.parent) || old[0] || { name: '' }).name.match(/ \(NV\d+\)$/) || [''])[0];
    parts.forEach(q => { q.z = zb + q.z * 0.01; q.name += suf; });
    const map = {}; for (const [role, oid] of Object.entries(recut.roleId)) map[oid] = idOf[role] || idOf[PP_R10[ppRoleMap(PP_R10.indexOf(role), st.split)]] || idOf.torso;
    S.pp.parts.forEach(q => { if (!oldIds.has(q.id) && oldIds.has(q.parent)) q.parent = map[q.parent] || null; });
    const carry = {}; for (const [role, oid] of Object.entries(recut.roleId)) if (idOf[role]) carry[oid] = idOf[role];
    S.frames.forEach(f => { if (!f.pp) return; for (const oid of oldIds) { const q = f.pp[oid]; delete f.pp[oid]; if (q && carry[oid]) f.pp[carry[oid]] = q; } f.ver++; });
    S.pp.parts = S.pp.parts.filter(q => !oldIds.has(q.id)); S.pp.parts.push(...parts); ppRenormZ();
  } else if (addMode) {
    const zb = Math.max(...S.pp.parts.map(q => q.z)) + 1, nv = S.pp.parts.filter(q => !q.parent).length + 1;
    parts.forEach(q => { q.z += zb; q.name += ` (NV${nv})`; }); S.pp.parts.push(...parts);
  } else { S.pp = { parts }; S.frames.forEach(f => { f.pp = {}; f.ppKey = undefined; }); }
  // a new character appears from the frame being edited on: frames before it keep showing only what they had
  if (!recut) ppHideBefore(parts);
  // remember how this character was cut, so "Sửa lại vùng cắt" can reopen it (this session only)
  const roleId = {}; parts.forEach(q => { if (q.role) roleId[q.role] = q.id; });
  ppLastCut = whole ? null : { src: st.src, J: st.J, split: st.split, auto: st.auto, autoJ: st.autoJ, hand: st.hand || null, ids: parts.map(q => q.id), roleId };
  ppSetup = null; ppSel = parts[0] ? parts[0].id : null; pm.close();
  ppShowAdded();
  toast(whole ? 'Đã tạo 1 mảnh — dùng ✂ Khoanh cắt để tách tay, chân…' : `Đã cắt ${parts.length} mảnh — chạm mảnh rồi kéo để xoay quanh khớp. Cho nhân vật di chuyển: tab 🎞 Tạo frame → ✎ Vẽ đường đi / 🛷 Trượt gối`, 6000);
}
/* --- lasso cut a new part out of the selected part --- */
async function ppCutLasso(poly) {
  const src = ppPart(ppSel); if (!src) { toast('Chọn mảnh nguồn trước'); return; }
  const f = curFrame(), M = ppMats(ppPoseFor(f)), inv = mInv(M[src.id]);
  const lp = poly.map(q => { const l = mApply(inv, q.x, q.y); return { x: l.x - src.ox, y: l.y - src.oy }; });
  const b = [Infinity, Infinity, -Infinity, -Infinity]; lp.forEach(q => { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); });
  const x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(src.c.width, Math.ceil(b[2])), y1 = Math.min(src.c.height, Math.ceil(b[3]));
  if (x1 - x0 < 3 || y1 - y0 < 3) return;
  const c = makeCanvas(x1 - x0, y1 - y0), cx = c.getContext('2d');
  cx.save(); cx.translate(-x0, -y0); polyPath(cx, lp); cx.clip(); cx.drawImage(src.c, 0, 0); cx.restore();
  const a = cx.getImageData(0, 0, c.width, c.height).data; let any = false; for (let i = 3; i < a.length; i += 4) if (a[i] > 20) { any = true; break; }
  if (!any) { toast('Vùng khoanh không có hình của mảnh đang chọn'); return; }
  if (!ppKeep) { const nc = makeCanvas(src.c.width, src.c.height); nc.getContext('2d').drawImage(src.c, 0, 0); src.c = nc; const sx = src.c.getContext('2d'); sx.save(); polyPath(sx, lp); sx.globalCompositeOperation = 'destination-out'; sx.fill(); sx.restore(); await encodePart(src); }
  // pivot: point of the new piece nearest to the parent's pivot
  let best = { x: src.ox + (x0 + x1) / 2, y: src.oy + y0 }, bd = Infinity;
  for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) if (a[(y * c.width + xx) * 4 + 3] > 60) { const X = src.ox + x0 + xx, Y = src.oy + y0 + y, dd = Math.hypot(X - src.px, Y - src.py); if (dd < bd) { bd = dd; best = { x: X, y: Y }; } }
  const p = { id: newId(), name: 'Mảnh ' + (S.pp.parts.length + 1), role: '', parent: src.id, z: src.z + 0.5, ox: src.ox + x0, oy: src.oy + y0, px: best.x, py: best.y, c };
  await encodePart(p);
  S.pp.parts.push(p); ppRenormZ(); ppSel = p.id; ppCutMode = false;
  S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); ppSyncBar(); scheduleSave(); requestRender();
  toast('Đã tách mảnh mới — đặt Vai trò, kéo chấm hồng để chỉnh điểm xoay', 3500);
}
/* --- manual patch: lasso a gap, fill it on the selected part --- */
let ppPatchMode = false, ppPathMode = false, lassoOpen = false;
async function ppPatchLasso(poly) {
  const part = ppPart(ppSel); if (!part) { toast('Chọn mảnh cần vá trước'); return; }
  const f = curFrame(), M = ppMats(ppPoseFor(f)), inv = mInv(M[part.id]);
  const lp = poly.map(q => { const l = mApply(inv, q.x, q.y); return { x: l.x - part.ox, y: l.y - part.oy }; });
  const b = [Infinity, Infinity, -Infinity, -Infinity]; lp.forEach(q => { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); });
  const pad = 24, nx0 = Math.min(0, Math.floor(b[0]) - pad), ny0 = Math.min(0, Math.floor(b[1]) - pad);
  const nx1 = Math.max(part.c.width, Math.ceil(b[2]) + pad), ny1 = Math.max(part.c.height, Math.ceil(b[3]) + pad);
  const nw = nx1 - nx0, nh = ny1 - ny0; if (nw * nh > 9e6) { toast('Vùng vá quá lớn'); return; }
  const pm = progress(ppFillMode === 'ai' ? 'Đang vá bằng AI… (lần đầu tải mô hình ~50 MB)' : 'Đang vá…'); await new Promise(r => setTimeout(r, 30));
  try {
    const big = makeCanvas(nw, nh), bx = big.getContext('2d'); bx.drawImage(part.c, -nx0, -ny0);
    const mk = makeCanvas(nw, nh), mx = mk.getContext('2d'); mx.translate(-nx0, -ny0); polyPath(mx, lp); mx.fillStyle = '#fff'; mx.fill();
    const rgba = bx.getImageData(0, 0, nw, nh).data, md = mx.getImageData(0, 0, nw, nh).data, N = nw * nh;
    const known = new Uint8Array(N), hole = new Uint8Array(N);
    for (let i = 0; i < N; i++) { if (md[i * 4 + 3] > 127) hole[i] = 1; else if (rgba[i * 4 + 3] > 200) known[i] = 1; }
    if (!known.some(v => v)) { pm.close(); toast('Vùng khoanh phải chạm vào hình của mảnh để lấy màu'); return; }
    const res = await fillCrop(rgba, nw, nh, known, hole, ppFillMode === 'off' ? 'fast' : ppFillMode);
    const outI = new ImageData(new Uint8ClampedArray(rgba), nw, nh);
    for (let i = 0; i < N; i++) if (hole[i]) { outI.data[i * 4] = res[i * 4]; outI.data[i * 4 + 1] = res[i * 4 + 1]; outI.data[i * 4 + 2] = res[i * 4 + 2]; outI.data[i * 4 + 3] = 255; }
    bx.putImageData(outI, 0, 0);
    part.c = big; part.ox += nx0; part.oy += ny0; await encodePart(part);
    ppPatchMode = false; S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); ppSyncBar(); scheduleSave(); requestRender();
    pm.close(); toast('Đã vá');
  } catch (e) { pm.close(); console.error(e); toast('Lỗi vá: ' + e.message, 3000); }
}
function ppRenormZ0(parts) { parts.slice().sort((a, b) => a.z - b.z).forEach((p, i) => p.z = i); }
function ppRenormZ() { [...S.pp.parts].sort((a, b) => a.z - b.z).forEach((p, i) => p.z = i); }
/* --- posing --- */
function ppQ(f, id) { f.pp = f.pp || {}; return (f.pp[id] = f.pp[id] || {}); }
function ppStart(p, base) {
  const f = curFrame();
  if (ppPathMode) { lasso = [p]; lassoOpen = true; action = { ...base, kind: 'pppath' }; return; }
  if (ppCutMode || ppPatchMode) { lasso = [p]; action = { ...base, kind: ppPatchMode ? 'pppatch' : 'ppcut' }; return; }
  if (ppPaint) {
    const sel = ppPart(ppSel); if (!sel) { toast('Chọn mảnh cần vẽ trước'); return; }
    const q = f.pp && f.pp[sel.id], im0 = ppImg(sel, q), h = im0.holder;
    if (!h.padded) { const PAD = 60, nc = makeCanvas(h.c.width + PAD * 2, h.c.height + PAD * 2); nc.getContext('2d').drawImage(h.c, PAD, PAD); h.c = nc; h.padded = true; h.alpha = null; if (h === sel) { sel.ox -= PAD; sel.oy -= PAD; } else { h.dx = (h.dx || 0) - PAD; h.dy = (h.dy || 0) - PAD; } }
    const im = ppImg(sel, q), M = ppMats(ppPoseFor(f))[sel.id], inv = mInv(M), l = mApply(inv, p.x, p.y), sc = Math.hypot(M[0], M[1]) || 1;
    const cx = im.c.getContext('2d'), before = cx.getImageData(0, 0, im.c.width, im.c.height);
    const pt = { x: l.x - im.x, y: l.y - im.y };
    cx.save(); cx.globalCompositeOperation = ppPaint === 'erase' ? 'destination-out' : 'source-over'; cx.fillStyle = S.color; cx.beginPath(); cx.arc(pt.x, pt.y, bsz() / sc / 2, 0, Math.PI * 2); cx.fill(); cx.restore();
    action = { ...base, kind: 'pppaint', part: sel, im, inv, sc, last: pt, before }; requestRender(); return;
  }
  const sel = ppPart(ppSel);
  if (sel) {
    const M = ppMats(ppPoseFor(f)), wp = mApply(M[sel.id], sel.px, sel.py);
    if (ppDrag === 'pivot' || Math.hypot(wp.x - p.x, wp.y - p.y) < 16 * DPR / vs && ppDrag === 'pivot') { action = { ...base, kind: 'pppivot', last: p }; return; }
  }
  const hit = ppHit(p, ppPoseFor(f));
  if (!hit) { if (ppDrag !== 'pivot') { ppSel = null; ppSyncBar(); requestRender(); } return; }
  if (hit.id !== ppSel) { ppSel = hit.id; ppSyncBar(); }
  const M = ppMats(ppPoseFor(f)), wp = mApply(M[hit.id], hit.px, hit.py), q = ppQ(f, hit.id);
  action = { ...base, kind: ppDrag === 'move' ? 'ppmove' : ppDrag === 'ik' ? 'ppik' : 'pprot', before: ppState(f), part: hit, last: p, a0: Math.atan2(p.y - wp.y, p.x - wp.x), r0: q.r || 0, wp };
  requestRender();
}
function ppMove(p) {
  const a = action, f = curFrame();
  if (a.kind === 'ppcut' || a.kind === 'pppatch' || a.kind === 'pppath') { const l = lasso[lasso.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); } return; }
  if (a.kind === 'pppaint') {
    const l = mApply(a.inv, p.x, p.y), pt = { x: l.x - a.im.x, y: l.y - a.im.y }, cx = a.im.c.getContext('2d');
    cx.save(); cx.globalCompositeOperation = ppPaint === 'erase' ? 'destination-out' : 'source-over'; cx.strokeStyle = S.color; cx.lineWidth = bsz() / a.sc; cx.lineCap = cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(a.last.x, a.last.y); cx.lineTo(pt.x, pt.y); cx.stroke(); cx.restore(); a.last = pt; a.im.holder.alpha = null; requestRender(); return;
  }
  if (a.kind === 'ppik') { ppIKDrag(a.part, p, f); }
  else if (a.kind === 'pprot') { const q = ppQ(f, a.part.id), ang = Math.atan2(p.y - a.wp.y, p.x - a.wp.x); let dr = (ang - a.a0) / DEG; q.r = a.r0 + dr; }
  else if (a.kind === 'ppmove') {
    const q = ppQ(f, a.part.id), par = a.part.parent && ppPart(a.part.parent);
    let dx = p.x - a.last.x, dy = p.y - a.last.y;
    if (par) { const Mi = mInv(ppMats(ppPoseFor(f))[par.id]); const o = mApply(Mi, 0, 0), v = mApply(Mi, dx, dy); dx = v.x - o.x; dy = v.y - o.y; }
    q.dx = (q.dx || 0) + dx; q.dy = (q.dy || 0) + dy; a.last = p;
  } else if (a.kind === 'pppivot') {
    const sel = ppPart(ppSel); if (!sel) return; const Mi = mInv(ppMats(ppPoseFor(f))[sel.id]);
    const o = mApply(Mi, a.last.x, a.last.y), n2 = mApply(Mi, p.x, p.y); sel.px += n2.x - o.x; sel.py += n2.y - o.y; a.last = p;
  }
  f.ver++; requestRender();
}
function ppEnd() {
  const a = action, f = curFrame();
  if (a.kind === 'ppcut') { const poly = lasso; lasso = null; if (poly && poly.length > 2) ppCutLasso(poly); requestRender(); return; }
  if (a.kind === 'pppath') { const poly = lasso; lasso = null; lassoOpen = false; ppPathMode = false; ppSyncBar(); if (poly && poly.length > 2) ppApplyPath(poly); requestRender(); return; }
  if (a.kind === 'pppaint') {
    const c = a.im.c, after = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    pushEntry({ partpix: true, pid: a.part.id, vi: a.im.vi, before: a.before, after, bytes: a.before.data.length * 2 });
    encodeHolder(a.im.holder); S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); scheduleSave(); ppSyncBar(); return;
  }
  if (a.kind === 'pppatch') { const poly = lasso; lasso = null; if (poly && poly.length > 2) ppPatchLasso(poly); requestRender(); return; }
  if (a.kind === 'pprot' || a.kind === 'ppmove' || a.kind === 'ppik') { f.ppKey = true; pushEntry(ppEntry(f, a.before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); }
  if (a.kind === 'pppivot') { scheduleSave(); }
}
function ppEntry(f, before, after) { return { t: targetOf(f), ppose: true, before, after, bytes: 200 }; }
function ppEdit(fn) { const f = curFrame(), sel = ppPart(ppSel); if (!sel) { toast('Chạm chọn một mảnh trước'); return; } const before = ppState(f); fn(ppQ(f, sel.id), sel, f); f.ppKey = true; pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); }
/* --- tween & presets --- */
const lerp = (a, b, t) => a + (b - a) * t;
function ppLerpPose(A, B, t) {
  const out = {}; const ids = new Set([...Object.keys(A || {}), ...Object.keys(B || {})]);
  for (const id of ids) {
    const a = (A && A[id]) || {}, b = (B && B[id]) || {};
    out[id] = { r: lerpA(a.r || 0, b.r || 0, t), dx: lerp(a.dx || 0, b.dx || 0, t), dy: lerp(a.dy || 0, b.dy || 0, t), sx: lerp(a.sx == null ? 1 : a.sx, b.sx == null ? 1 : b.sx, t), sy: lerp(a.sy == null ? 1 : a.sy, b.sy == null ? 1 : b.sy, t), fl: t < 0.5 ? a.fl : b.fl, h: t < 0.5 ? a.h : b.h, v: t < 1 ? a.v : b.v };
  }
  return out;
}
let ppInsertAuto = false;
async function ppInsertFrames(poses, durMs) {
  const f0 = curFrame(), i0 = S.cur; await ensureLoaded(f0);
  // frameCopyOf keeps the mouth/eyes and the 〰 path position (f.lip): without it the character jumped back to where it was before the path
  const added = poses.map(pose => { const f = frameCopyOf(f0); f.dur = durMs || f0.dur; f.pp = pose; f.ppKey = !ppInsertAuto; return f; });
  S.frames.splice(i0 + 1, 0, ...added); loaded.push(...added);
  pushEntry({ t: targetOf(f0), add: { frames: added, index: i0 + 1, dur0: f0.dur, dur1: f0.dur }, bytes: 0 });
  for (const f of added) await drawThumb(f);
  buildStrip(); updateFrameUI(); evictSoon(); scheduleSave();
  return added.length;
}
async function ppTween() {
  const A = curFrame(), B = S.frames[S.cur + 1];
  if (!B) { toast('Cần frame kế tiếp làm tư thế đích: Nhân bản frame, chỉnh tư thế, quay lại frame trước rồi bấm'); return; }
  const n = clamp(+$('#ppTweenN').value || 3, 1, 24), poses = [];
  for (let k = 1; k <= n; k++) { const t = k / (n + 1), e = t * t * (3 - 2 * t); poses.push(ppLerpPose(A.pp, B.pp, e)); }
  A.ppKey = true; B.ppKey = true;
  ppInsertAuto = true; const c = await ppInsertFrames(poses, A.dur); ppInsertAuto = false; ppRetween();
  toast(`Đã chèn ${c} frame giữa (tự cập nhật khi bạn sửa 2 keyframe) — bấm Phát để xem`, 3500);
}
function ppByRole(role) { if (!S.pp) return null; const ch = ppSelChar(); return S.pp.parts.find(p => p.role === role && (!ch || ppCharOf(p) === ch)) || null; }
function ppPresetPose(type, k, n, base, hgt) {
  const ph = 2 * Math.PI * k / n, s = Math.sin(ph), c = Math.cos(ph), P = ppClone(base), f = ppDir;
  const add = (role, prop, v) => { const p = ppByRole(role); if (!p) return; const q = P[p.id] = P[p.id] || {}; q[prop] = (q[prop] == null ? (prop[0] === 's' ? 1 : 0) : q[prop]) + v; };
  const mul = (role, prop, v) => { const p = ppByRole(role); if (!p) return; const q = P[p.id] = P[p.id] || {}; q[prop] = (q[prop] == null ? 1 : q[prop]) * v; };
  switch (type) {
    case 'walk': case 'run': {
      const R = type === 'run', th = R ? 40 : 22, ar = R ? 35 : 18, kn = R ? 60 : 30;
      add('legL', 'r', -f * th * s); add('legR', 'r', f * th * s); add('armL', 'r', f * ar * s); add('armR', 'r', -f * ar * s);
      add('shinL', 'r', f * kn * Math.max(0, c)); add('shinR', 'r', f * kn * Math.max(0, -c));
      add('foreL', 'r', -f * (R ? 50 : 10)); add('foreR', 'r', -f * (R ? 50 : 10));
      add('torso', 'dy', -(R ? 0.025 : 0.01) * hgt * Math.cos(2 * ph)); if (R) add('torso', 'r', f * 6); add('head', 'r', 2 * s); break;
    }
    case 'jump': { const air = Math.max(0, s), cr = Math.max(0, -s); add('torso', 'dy', (-0.22 * air + 0.05 * cr) * hgt); add('armL', 'r', 70 * air); add('armR', 'r', -70 * air); add('legL', 'r', 12 * cr); add('legR', 'r', -12 * cr); break; }
    case 'wave': { const p = ppByRole('foreR') ? 'foreR' : 'armR'; add(p, 'r', 25 * s); break; }
    case 'nod': add('head', 'r', 8 * s); break;
    case 'shake': add('head', 'r', 10 * Math.sin(2 * ph)); break;
    case 'breathe': mul('torso', 'sy', 1 + 0.015 * s); add('head', 'dy', -0.006 * hgt * s); add('armL', 'r', 2 * s); add('armR', 'r', -2 * s); break;
    case 'talk': { const mp = ppByRole('mouth'), open = (1 - Math.cos(2 * ph)) / 2; if (mp && mp.alts && mp.alts.length) { const q = P[mp.id] = P[mp.id] || {}; q.v = Math.round(open * mp.alts.length) || undefined; } else mul('mouth', 'sy', 1 + 0.7 * open); break; }
    case 'blink': { const pulse = Math.exp(-Math.pow((ph - Math.PI) / 0.5, 2)), ep = ppByRole('eyes'); if (ep && ep.alts && ep.alts.length) { const q = P[ep.id] = P[ep.id] || {}; q.v = pulse > 0.5 ? ep.alts.length : pulse > 0.2 && ep.alts.length >= 2 ? 1 : undefined; } else mul('eyes', 'sy', 1 - 0.9 * pulse); break; }
  }
  return P;
}
const PP_PRESETS = { walk: ['Đi bộ', 8, 0.1], run: ['Chạy', 6, 0.07], jump: ['Nhảy', 8, 0.08], wave: ['Vẫy tay', 6, 0.1], nod: ['Gật đầu', 6, 0.1], shake: ['Lắc đầu', 6, 0.07], breathe: ['Thở', 8, 0.15], talk: ['Nói (vai trò Miệng)', 6, 0.08], blink: ['Chớp mắt (vai trò Mắt)', 8, 0.1] };
let ppPreset = 'walk';
async function ppMakePreset() {
  const f0 = curFrame(), n = clamp(+$('#ppPN').value || PP_PRESETS[ppPreset][1], 2, 24), dur = Math.round((+$('#ppPDur').value || PP_PRESETS[ppPreset][2]) * 1000);
  const need = { talk: 'mouth', blink: 'eyes' }[ppPreset];
  if (need && !ppByRole(need)) { toast(`Chưa có mảnh vai trò "${PP_ROLES[need]}" — khoanh cắt mảnh đó rồi đặt Vai trò`, 4000); return; }
  const tor = ppByRole('torso'), hgt = tor ? Math.max(200, tor.c.height * 2.2) : H * 0.6;
  const poses = []; for (let k = 1; k < n; k++) poses.push(ppPresetPose(ppPreset, k, n, f0.pp, hgt));
  const c = await ppInsertFrames(poses, dur); f0.dur = dur; updateFrameUI();
  toast(`Đã tạo ${c} frame ${PP_PRESETS[ppPreset][0].toLowerCase()} — chỉnh tay từng frame nếu cần`, 3500);
}
/* --- auto blink: closes the eyes for ~0.1-0.2s every few seconds on every frame, without adding frames.
   Stored as an overlay in f.lip.eb = {eyesPartId: 0..1} so it survives in-betweening and is saved with lip sync. --- */
const BLINK_GAP = { calm: [3.2, 5.5], normal: [2.2, 4], often: [1.3, 2.5] };
function blinkRand(seed) { let x = 0; for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) | 0; return () => { x = (x * 1103515245 + 12345) | 0; return ((x >>> 8) & 0xffff) / 0x10000; }; }
function blinkPlan(eyeIds, gap) {
  const T = frameStartTimes(), n = S.frames.length, end = T[n], plan = S.frames.map(() => ({}));
  const at = t => { let i = 0; while (i < n - 1 && T[i + 1] <= t) i++; return i; };
  for (const id of eyeIds) {
    const rnd = blinkRand(id); let t = 0.6 + rnd() * (gap[0] - 0.4);
    while (t < end - 0.05) {
      const i = at(t); plan[i][id] = 1;
      // short frames: half-closed on the frames around it so the blink reads smoothly
      if (S.frames[i].dur <= 85) { for (const j of [i - 1, i + 1]) if (j >= 0 && j < n && !plan[j][id]) plan[j][id] = 0.5; }
      t += gap[0] + rnd() * (gap[1] - gap[0]);
    }
  }
  return plan;
}
function ppEyeParts() { return S.pp ? S.pp.parts.filter(p => p.role === 'eyes') : []; }
function ppHasBlink() { return S.frames.some(f => f.lip && f.lip.eb); }
function ppBlinkInfo() { const el = document.getElementById('ppBlinkInfo'); if (!el) return; const c = S.frames.filter(f => f.lip && f.lip.eb && Object.values(f.lip.eb).some(a => a >= 1)).length; el.textContent = c ? `đang bật: ${c} lần nhắm mắt` : ''; const b = document.getElementById('ppBlinkBtn'); if (b) b.classList.toggle('on', !!c); }
function ppSetBlink(plan) {
  const multi = [];
  S.frames.forEach((f, i) => {
    const before = f.lip ? JSON.stringify(f.lip) : null, l = { ...(f.lip || {}) }; delete l.eb;
    const eb = plan && plan[i]; if (eb && Object.keys(eb).length) l.eb = eb;
    const lip = Object.keys(l).length ? l : null, after = lip ? JSON.stringify(lip) : null;
    if (before === after) return;
    f.lip = lip; f.ver++; queueThumbFor(f); multi.push({ t: targetOf(f), lipe: true, before, after, bytes: 64 });
  });
  if (multi.length) { pushEntry({ multi }); scheduleSave(); requestRender(); }
  ppBlinkInfo(); return multi.length;
}
async function ppAutoBlink() {
  const eyes = ppEyeParts();
  if (!eyes.length) { toast('Chưa có mảnh vai trò "Mắt": chọn mảnh Đầu → 🎨 Kho mắt/miệng/tay → gắn mắt, hoặc ✂ Khoanh tách mắt rồi đặt Vai trò Mắt', 6000); return; }
  const has = ppHasBlink(), T = frameStartTimes(), len = T[S.frames.length];
  if (len < 1.2) toast('Phim mới dài ' + len.toFixed(1) + 's, chớp mắt sẽ rõ hơn khi phim dài từ 2s', 3500);
  const v = await modal({ title: '👁 Chớp mắt tự động', html: `<p>Nhân vật sẽ tự nhắm mắt khoảng 0.1–0.2 giây, cách nhau vài giây, trên toàn bộ ${S.frames.length} frame (${len.toFixed(1)}s). Không thêm frame, sửa tư thế sau vẫn giữ.</p><p class="lbl">${eyes.some(p => p.alts && p.alts.length) ? 'Mắt có hình thay thế: dùng hình cuối làm mắt nhắm (bộ chớp mắt trong Kho hình: mở → lim dim → nhắm).' : 'Mắt chưa có hình nhắm: app sẽ ép dẹt mắt lại. Gắn bộ mắt trong Kho hình để đẹp hơn.'}</p>`,
    buttons: [...(has ? [{ label: 'Bỏ chớp mắt', value: 'off' }] : []), { label: 'Ít chớp', value: 'calm' }, { label: 'Vừa', value: 'normal', primary: true }, { label: 'Hay chớp', value: 'often' }] });
  if (!v) return;
  if (v === 'off') { ppSetBlink(null); toast('Đã bỏ chớp mắt tự động'); return; }
  ppSetBlink(blinkPlan(eyes.map(p => p.id), BLINK_GAP[v]));
  const c = S.frames.filter(f => f.lip && f.lip.eb && Object.values(f.lip.eb).some(a => a >= 1)).length;
  toast(c ? `Đã thêm ${c} lần chớp mắt — bấm Phát để xem` : 'Phim ngắn quá nên chưa có lần chớp nào', 3500);
}
async function ppBake() {
  const f = curFrame(); if (!S.pp) return; await ensureLoaded(f);
  const lc = f.canvas.getContext('2d'), before = lc.getImageData(0, 0, W, H); drawPuppet(lc, f.pp, f.lip);
  const pe = pixEntry(f, [0, 0, W, H], before, lc.getImageData(0, 0, W, H));
  const ppb = ppState(f); S.pp.parts.forEach(p => ppQ(f, p.id).h = true); f.ppKey = true;
  pushEntry({ multi: [pe, ppEntry(f, ppb, ppState(f))] }); markEdited(f); requestRender();
  toast('Đã chốt nhân vật ghép vào lớp Nhân vật (frame này)');
}
/* --- UI --- */
const panelHidden = S.panelHidden = { vedit: false, puppet: false, fx: false };
const PANEL_NAME = { vedit: 'Sửa nét', puppet: 'Nhân vật ghép', fx: 'Chữ & FX' };
function updPanelPill() {
  const t = S.tool, pill = $('#panelPill');
  const hidden = panelHidden[t] === true && !(t === 'vedit' && (motion || rig)) && !(t === 'puppet' && ppSetup);
  pill.hidden = !hidden; if (hidden) pill.textContent = '☰ Mở bảng ' + PANEL_NAME[t];
}
function hidePanel(t) { panelHidden[t] = true; saveSettings(); updVecBar(); ppSyncBar(); fxSyncBar(); updPanelPill(); }
function showPanel() { panelHidden[S.tool] = false; saveSettings(); updVecBar(); ppSyncBar(); fxSyncBar(); updPanelPill(); }
function ppSyncBar() { ppBlinkInfo(); { const a = $('#ppSoftChk'), b = $('#ppSmoothChk'); if (a) a.checked = !!S.ppSoft; if (b) b.checked = !!S.ppSmooth; }
  const bar = $('#ppbar'), show = S.tool === 'puppet' && (!panelHidden.puppet || !!ppSetup);
  bar.hidden = !show; updPanelPill(); if (!show) return;
  $('#ppSetupSec').hidden = !ppSetup; $('#ppPoseSec').hidden = !!ppSetup || !S.pp;
  $('#ppEmpty').hidden = !!ppSetup || !!S.pp;
  document.querySelectorAll('[data-ppf]').forEach(b => b.classList.toggle('on', b.dataset.ppf === ppFillMode));
  if (ppSetup) { $('#ppSplit').checked = ppSetup.split; const lab = ppSetup.stage === 'paint'; $('#ppJointSec').hidden = lab; $('#ppLabSec').hidden = !lab; if (lab) ppLabSyncBar(); return; }
  if (!S.pp) return;
  const sel = ppPart(ppSel), list = $('#ppList');
  list.innerHTML = S.pp.parts.slice().sort((a, b) => b.z - a.z).map(p => `<option value="${p.id}" ${p.id === ppSel ? 'selected' : ''}>${p.name.replace(/</g, '&lt;')}</option>`).join('') + (sel ? '' : '<option value="" selected>— chạm chọn mảnh —</option>');
  $('#ppRole').innerHTML = Object.entries(PP_ROLES).map(([k, v]) => `<option value="${k}" ${sel && sel.role === k ? 'selected' : ''}>${v}</option>`).join('');
  $('#ppParent').innerHTML = '<option value="">— không gắn —</option>' + S.pp.parts.filter(p => !sel || p.id !== sel.id).map(p => `<option value="${p.id}" ${sel && sel.parent === p.id ? 'selected' : ''}>Gắn vào: ${p.name.replace(/</g, '&lt;')}</option>`).join('');
  ['#ppRole', '#ppParent', '#ppUp', '#ppDown', '#ppCharTop', '#ppCharBot', '#ppDel', '#ppRot', '#ppScale', '#ppFlip', '#ppHide', '#ppReset', '#ppRename'].forEach(id => $(id).disabled = !sel);
  const q = sel && curFrame().pp && curFrame().pp[sel.id] || {};
  $('#ppRot').value = Math.round(((q.r || 0) % 360 + 540) % 360 - 180); $('#ppScale').value = Math.round((q.sx == null ? 1 : q.sx) * 100);
  $('#ppHide').textContent = q.h ? 'Hiện' : 'Ẩn';
  document.querySelectorAll('[data-ppd]').forEach(b => b.classList.toggle('on', b.dataset.ppd === ppDrag));
  { const vs2 = $('#ppVars'); vs2.innerHTML = '';
    if (sel) { const q2 = curFrame().pp && curFrame().pp[sel.id], cv = q2 && q2.v ? q2.v : 0;
      [sel.c, ...(sel.alts || []).map(a => a.c)].forEach((cc, i) => { const t = makeCanvas(36, 36), tx = t.getContext('2d'); const k2 = Math.min(34 / cc.width, 34 / cc.height); tx.drawImage(cc, (36 - cc.width * k2) / 2, (36 - cc.height * k2) / 2, cc.width * k2, cc.height * k2); t.className = 'vthumb' + (i === cv ? ' on' : ''); t.title = i ? 'Hình ' + (i + 1) : 'Hình gốc'; t.addEventListener('click', () => ppEdit(q => { if (i) q.v = i; else delete q.v; })); vs2.append(t); }); }
    ['#ppVarAdd', '#ppVarDup', '#ppVarDel', '#ppPaintBtn', '#ppEraseBtn', '#ppDelChar', '#ppLibSave'].forEach(id => $(id).disabled = !sel);
    $('#ppPaintBtn').classList.toggle('on', ppPaint === 'brush'); $('#ppEraseBtn').classList.toggle('on', ppPaint === 'erase'); }
  { const f = curFrame(), k = ppIsKey(f); const kb = $('#ppKeyBtn'); kb.textContent = k ? '🔑 Keyframe' : '∿ Tự động (bấm để khoá)'; kb.classList.toggle('on', k);
    $('#ppEase').innerHTML = Object.entries(EASE_LABEL).map(([k2, v]) => `<option value="${k2}" ${(f.ppEase || 'inout') === k2 ? 'selected' : ''}>${v}</option>`).join(''); $('#ppEase').disabled = !k;
    const ps = $('#ppPoseSel'), cur = ps.value; ps.innerHTML = ppPoseList().map(o => `<option value="${o.id}">${o.name.replace(/</g, '&lt;')}</option>`).join(''); if (cur) ps.value = cur; }
  $('#ppRecut').disabled = !(ppLastCut && ppLastCut.ids.some(id => ppPart(id)));
  $('#ppCutBtn').classList.toggle('on', ppCutMode); $('#ppPatchBtn').classList.toggle('on', ppPatchMode); { const b = $('#ppPathBtn'); if (b) b.classList.toggle('on', !ppPathMode); b && (b.textContent = ppPathMode ? '✕ Huỷ vẽ đường' : '✎ Vẽ đường đi'); }
  document.querySelectorAll('[data-ppp]').forEach(b => b.classList.toggle('on', b.dataset.ppp === ppPreset));
  document.querySelectorAll('[data-ppdir]').forEach(b => b.classList.toggle('on', +b.dataset.ppdir === ppDir));
}
function renderPP(c, f, px) {
  if (ppSetup) {
    c.drawImage(ppSetup.src, 0, 0);
    if (ppSetup.stage === 'paint') { c.save(); if (ppSetup.gray) c.drawImage(ppSetup.gray, 0, 0); c.globalAlpha = 0.62; c.drawImage(ppSetup.ov, 0, 0); c.restore(); return; }
    const J = ppSetup.J; c.save(); c.lineCap = 'round';
    for (const j of RBONES) { const p = RP[j]; c.strokeStyle = /L$/.test(j) ? '#ffb21e' : /R$/.test(j) ? '#00c7be' : '#ff3b9a'; c.lineWidth = 5 * px; c.beginPath(); c.moveTo(J[p].x, J[p].y); c.lineTo(J[j].x, J[j].y); c.stroke(); }
    for (const j of RJ) { c.beginPath(); c.arc(J[j].x, J[j].y, 8 * px, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#222'; c.stroke(); }
    c.restore(); return;
  }
  if (S.tool !== 'puppet' || !S.pp) return;
  const sel = ppPart(ppSel); if (!sel || !sel.c) return;
  const M = ppMats(ppPoseFor(f)), im = ppImg(sel, f.pp && f.pp[sel.id]); c.save(); c.transform(...M[sel.id]);
  c.lineWidth = 2 * px / Math.max(0.2, Math.hypot(M[sel.id][0], M[sel.id][1])); c.setLineDash([8 * px, 6 * px]); c.strokeStyle = ppPaint ? '#2f7bff' : '#ff3b9a';
  c.strokeRect(im.x, im.y, im.c.width, im.c.height); c.restore();
  const wp = mApply(M[sel.id], sel.px, sel.py);
  c.save(); c.beginPath(); c.arc(wp.x, wp.y, (ppDrag === 'pivot' ? 11 : 8) * px, 0, Math.PI * 2); c.fillStyle = '#ff3b9a'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#fff'; c.stroke(); c.restore();
}
$('#ppCutAuto').addEventListener('click', ppLabBegin);
$('#ppLabCut').addEventListener('click', () => ppAutoCut(false));
$('#ppLabBack').addEventListener('click', () => { if (!ppSetup) return; ppSetup.stage = 'joints'; ppSyncBar(); requestRender(); toast('Kéo chấm khớp, rồi bấm ✂ Cắt tự động để xem lại vùng (chỗ đã tô vẫn giữ)', 3500); });
$('#ppLabCancel').addEventListener('click', () => { ppSetup = null; ppSyncBar(); requestRender(); });
$('#ppLabReset').addEventListener('click', () => { const st = ppSetup; if (!st || !st.hand) return; ppLabSnap(st); st.hand.fill(-1); ppLabOverlay(st); ppLabSyncBar(); requestRender(); });
$('#ppLabUndo').addEventListener('click', () => ppSetup && ppLabHistory(true));
$('#ppLabRedo').addEventListener('click', () => ppSetup && ppLabHistory(false));
$('#ppLabSize').addEventListener('input', e => { ppLabSize = +e.target.value; });
$('#ppLabSplit').addEventListener('change', e => { if (!ppSetup) return; ppSetup.split = e.target.checked; ppLabPick = ppRoleMap(ppLabPick, ppSetup.split); ppLabOverlay(ppSetup); ppSyncBar(); requestRender(); });
document.querySelectorAll('[data-plt]').forEach(b => b.addEventListener('click', () => { ppLabTool = b.dataset.plt; ppSyncBar(); if (ppLabTool === 'bucket') toast('Chạm lên một mảng màu (vd. ống tay áo) để gán cả mảng', 3000); }));
$('#ppRecut').addEventListener('click', () => {
  const L = ppLastCut; if (!L || !L.ids.some(id => ppPart(id))) { toast('Chỉ sửa lại được nhân vật vừa cắt trong lần mở app này'); return; }
  if (playing) stopPlay();
  ppSetup = { src: L.src, J: JSON.parse(JSON.stringify(L.J)), split: L.split, auto: L.auto, autoJ: L.autoJ, hand: L.hand ? L.hand.slice() : null, recut: { ids: L.ids, roleId: L.roleId } };
  ppLabBegin();
});
$('#ppCutWhole').addEventListener('click', () => ppAutoCut(true));
$('#ppSplit').addEventListener('change', e => { if (ppSetup) ppSetup.split = e.target.checked; });
$('#ppRefit').addEventListener('click', () => { if (!ppSetup) return; const d = ppSetup.src.getContext('2d').getImageData(0, 0, W, H).data, pts = []; for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (d[(y * W + x) * 4 + 3] > 100) pts.push({ x, y }); ppSetup.J = ppFitJoints(ppSetup.src, pts); requestRender(); });
$('#ppSetupCancel').addEventListener('click', () => { ppSetup = null; ppSyncBar(); requestRender(); });
$('#ppList').addEventListener('change', e => { ppSel = e.target.value || null; ppSyncBar(); requestRender(); });
$('#ppRole').addEventListener('change', e => { const p = ppPart(ppSel); if (p) { p.role = e.target.value; if (p.role && PP_ROLES[p.role] && /^Mảnh /.test(p.name)) p.name = PP_ROLES[p.role]; ppSyncBar(); scheduleSave(); } });
$('#ppParent').addEventListener('change', e => { const p = ppPart(ppSel); if (!p) return; let v = e.target.value || null, g = v, ok = true, n = 0; while (g && n++ < 30) { if (g === p.id) { ok = false; break; } g = (ppPart(g) || {}).parent; } if (!ok) { toast('Không gắn vào mảnh con của chính nó được'); ppSyncBar(); return; } p.parent = v; S.frames.forEach(f => f.ver++); scheduleSave(); requestRender(); });
$('#ppRename').addEventListener('click', async () => { const p = ppPart(ppSel); if (!p) return; let val = null; await modal({ title: 'Đổi tên mảnh', html: `<input id="ppNameIn" value="${p.name.replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">`, buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { val = document.getElementById('ppNameIn').value.trim(); } }] }); if (val) { p.name = val.slice(0, 40); ppSyncBar(); scheduleSave(); } });
$('#ppUp').addEventListener('click', () => { const p = ppPart(ppSel); if (!p) return; p.z += 1.5; ppRenormZ(); S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender(); });
// move a whole character (the selected piece's root and everything hanging from it) in front of / behind all others, keeping its own piece order
function ppCharZ(top) {
  const sel = ppPart(ppSel); if (!sel) return;
  const ch = ppCharOf(sel), mine = S.pp.parts.filter(p => ppCharOf(p) === ch).sort((a, b) => a.z - b.z), rest = S.pp.parts.filter(p => ppCharOf(p) !== ch).sort((a, b) => a.z - b.z);
  if (!rest.length) { toast('Chỉ có một nhân vật/hình — chưa có gì để đặt trước sau'); return; }
  (top ? [...rest, ...mine] : [...mine, ...rest]).forEach((p, i) => p.z = i);
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender();
  toast(top ? 'Đã đưa lên trước mọi nhân vật khác' : 'Đã đưa ra sau mọi nhân vật khác', 1500);
}
$('#ppCharTop').addEventListener('click', () => ppCharZ(true));
$('#ppCharBot').addEventListener('click', () => ppCharZ(false));
$('#ppDown').addEventListener('click', () => { const p = ppPart(ppSel); if (!p) return; p.z -= 1.5; ppRenormZ(); S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender(); });
$('#ppDel').addEventListener('click', async () => { const p = ppPart(ppSel); if (!p) return; const ok = await modal({ title: `Xoá mảnh "${p.name}"?`, html: '<p>Mảnh bị xoá khỏi mọi frame, mảnh con sẽ gắn sang mảnh cha. Lỡ tay thì bấm ↶ Hoàn tác.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá', value: true, cls: 'danger' }] }); if (!ok) return; S.pp.parts.forEach(c => { if (c.parent === p.id) c.parent = p.parent; }); S.pp.parts = S.pp.parts.filter(x => x.id !== p.id); ppSel = null; S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender(); });
$('#ppSoftChk').addEventListener('change', e => { S.ppSoft = e.target.checked; saveSettings(); S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); requestRender(); toast(S.ppSoft ? 'Khớp uốn mềm: khuỷu, gối, vai, hông cong tự nhiên' : 'Khớp gập cứng (2 mảnh rời)'); });
$('#ppSmoothChk').addEventListener('change', e => { S.ppSmooth = e.target.checked; saveSettings(); toast(S.ppSmooth ? 'Phát và xuất video: chuyển động liền mạch giữa các frame' : 'Phát đúng từng frame (kiểu giật frame)'); });
document.querySelectorAll('[data-ppd]').forEach(b => b.addEventListener('click', () => { ppDrag = b.dataset.ppd; ppCutMode = false; ppPaint = null; ppSyncBar(); requestRender(); }));
let ppSlBefore = null;
const ppSlStart = () => { if (!ppSlBefore) ppSlBefore = ppState(curFrame()); };
const ppSlEnd = () => { if (!ppSlBefore) return; const f = curFrame(); f.ppKey = true; pushEntry(ppEntry(f, ppSlBefore, ppState(f))); ppSlBefore = null; markEdited(f); ppRetween(); updateFrameUI(); };
$('#ppRot').addEventListener('input', e => { const p = ppPart(ppSel); if (!p) return; ppSlStart(); ppQ(curFrame(), p.id).r = +e.target.value; curFrame().ver++; requestRender(); });
$('#ppRot').addEventListener('change', ppSlEnd);
$('#ppScale').addEventListener('input', e => { const p = ppPart(ppSel); if (!p) return; ppSlStart(); const q = ppQ(curFrame(), p.id); q.sx = q.sy = e.target.value / 100; curFrame().ver++; requestRender(); });
$('#ppScale').addEventListener('change', ppSlEnd);
$('#ppFlip').addEventListener('click', () => ppEdit(q => { q.fl = !q.fl; }));
$('#ppHide').addEventListener('click', () => ppEdit(q => { q.h = !q.h; }));
$('#ppReset').addEventListener('click', () => ppEdit((q, p, f) => { delete f.pp[p.id]; }));
$('#ppResetAll').addEventListener('click', () => ppKeyEdit(f => { f.pp = {}; f.ppKey = true; }));
$('#ppCutBtn').addEventListener('click', () => { if (!ppSel) { toast('Chạm chọn mảnh nguồn (vd. Thân) trước, rồi khoanh vùng cần tách'); return; } ppCutMode = !ppCutMode; ppPatchMode = false; ppSyncBar(); if (ppCutMode) toast('Khoanh quanh phần muốn tách (tay, miệng, mắt…)', 3000); });
document.querySelectorAll('[data-ppf]').forEach(b => b.addEventListener('click', () => { ppFillMode = b.dataset.ppf; ppSyncBar(); if (ppFillMode === 'ai') toast('AI vá chạy ngay trên máy, miễn phí; lần đầu tải mô hình khoảng 50 MB', 3500); }));
$('#ppPatchBtn').addEventListener('click', () => { if (!ppSel) { toast('Chạm chọn mảnh bị hở (vd. Thân) trước'); return; } ppPatchMode = !ppPatchMode; ppCutMode = false; ppSyncBar(); if (ppPatchMode) toast('Khoanh chỗ bị hở — vùng khoanh nên chạm vào phần hình còn lại để lấy màu', 3500); });
$('#ppKeep').addEventListener('change', e => { ppKeep = e.target.checked; });
$('#ppTweenBtn').addEventListener('click', ppTween);
let ppPaint = null;
$('#ppPaintBtn').addEventListener('click', () => { ppPaint = ppPaint === 'brush' ? null : 'brush'; ppCutMode = ppPatchMode = false; ppSyncBar(); requestRender(); if (ppPaint) toast('Vẽ lên mảnh đang chọn bằng màu và cỡ bút hiện tại (đổi ở thanh trên)', 3000); });
$('#ppEraseBtn').addEventListener('click', () => { ppPaint = ppPaint === 'erase' ? null : 'erase'; ppCutMode = ppPatchMode = false; ppSyncBar(); requestRender(); });
$('#ppVarAdd').addEventListener('click', () => { if (ppSel) $('#ppVarFile').click(); });
$('#ppVarFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; const sel = ppPart(ppSel); if (!file || !sel) return;
  let bmp; try { bmp = await createImageBitmap(file); } catch (err) { toast('Không đọc được ảnh'); return; }
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height)), c = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k)), cx = c.getContext('2d'); cx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  let id = cx.getImageData(0, 0, c.width, c.height); const d = id.data, corner = i => d[i * 4 + 3] > 250;
  if (corner(0) && corner(c.width - 1) && corner((c.height - 1) * c.width)) { const a = colorBgAlpha(id, 60); for (let i = 0; i < a.length; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * a[i]); cx.putImageData(id, 0, 0); }
  // crop to content, fit inside the current image's box, centred on it
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { toast('Ảnh trống sau khi xoá nền'); return; }
  const f = curFrame(), cur = ppImg(sel, f.pp && f.pp[sel.id]), fit = Math.min(cur.c.width / (x1 - x0 + 1), cur.c.height / (y1 - y0 + 1)) * (sel.padded ? 0.8 : 1);
  const out = makeCanvas(Math.max(1, Math.round((x1 - x0 + 1) * fit)), Math.max(1, Math.round((y1 - y0 + 1) * fit))); out.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height);
  const cxm = cur.x + cur.c.width / 2, cym = cur.y + cur.c.height / 2, alt = { c: out, dx: cxm - out.width / 2 - sel.ox, dy: cym - out.height / 2 - sel.oy };
  await encodeHolder(alt); sel.alts = sel.alts || []; sel.alts.push(alt);
  ppEdit(q => { q.v = sel.alts.length; }); scheduleSave(); toast('Đã thêm hình — chạm hình nhỏ để đổi theo từng frame', 3000);
});
$('#ppVarDup').addEventListener('click', async () => { const sel = ppPart(ppSel); if (!sel) return; const f = curFrame(), cur = ppImg(sel, f.pp && f.pp[sel.id]); const c = makeCanvas(cur.c.width, cur.c.height); c.getContext('2d').drawImage(cur.c, 0, 0); const alt = { c, dx: cur.x - sel.ox, dy: cur.y - sel.oy, padded: cur.holder.padded }; await encodeHolder(alt); sel.alts = sel.alts || []; sel.alts.push(alt); ppEdit(q => { q.v = sel.alts.length; }); scheduleSave(); toast('Đã nhân bản — dùng ✎ Vẽ lên mảnh để sửa hình mới', 3000); });
$('#ppVarDel').addEventListener('click', async () => { const sel = ppPart(ppSel); if (!sel) return; const f = curFrame(), v = (f.pp && f.pp[sel.id] && f.pp[sel.id].v) || 0; if (!v) { toast('Hình gốc không xoá được — chọn hình phụ để xoá'); return; }
  const ok = await modal({ title: 'Xoá hình này?', html: '<p>Các frame đang dùng hình này sẽ về hình gốc.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá', value: true, cls: 'danger' }] }); if (!ok) return;
  sel.alts.splice(v - 1, 1); S.frames.forEach(fr => { const q = fr.pp && fr.pp[sel.id]; if (q && q.v) { if (q.v === v) delete q.v; else if (q.v > v) q.v--; } fr.ver++; queueThumbFor(fr); }); ppSyncBar(); scheduleSave(); requestRender(); });
$('#ppDelChar').addEventListener('click', async () => { const sel = ppPart(ppSel); if (!sel) return; const ch = ppCharOf(sel), list = S.pp.parts.filter(p => ppCharOf(p) === ch);
  const ok = await modal({ title: `Xoá cả nhân vật (${list.length} mảnh)?`, html: '<p>Lỡ tay thì bấm ↶ Hoàn tác để lấy lại.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá', value: true, cls: 'danger' }] }); if (!ok) return;
  const ids = new Set(list.map(p => p.id)); S.pp.parts = S.pp.parts.filter(p => !ids.has(p.id)); if (!S.pp.parts.length) S.pp = null; ppSel = null; S.frames.forEach(fr => { if (fr.pp) ids.forEach(id => delete fr.pp[id]); fr.ver++; queueThumbFor(fr); }); ppSyncBar(); scheduleSave(); requestRender(); });
$('#ppKeyBtn').addEventListener('click', () => ppKeyEdit(f => { f.ppKey = !ppIsKey(f); }));
$('#ppEase').addEventListener('change', e => ppKeyEdit(f => { f.ppEase = e.target.value; }));
$('#ppPoseApply').addEventListener('click', () => ppApplyPose($('#ppPoseSel').value));
$('#ppPoseSave').addEventListener('click', ppSavePose);
$('#ppPoseDel').addEventListener('click', () => { const v = $('#ppPoseSel').value; if (!v.startsWith('u:')) { toast('Tư thế có sẵn (⭐) không xoá được'); return; } S.poses = (S.poses || []).filter(p => 'u:' + p.id !== v); ppSyncBar(); scheduleSave(); });
$('#ppFlipChar').addEventListener('click', ppFlipChar);
Object.entries(PP_PRESETS).forEach(([k, v]) => { const b = document.createElement('button'); b.className = 'chip small'; b.dataset.ppp = k; b.textContent = v[0]; b.addEventListener('click', () => { ppPreset = k; $('#ppPN').value = v[1]; $('#ppPDur').value = v[2]; ppSyncBar(); }); $('#ppPresets').append(b); });
document.querySelectorAll('[data-ppdir]').forEach(b => b.addEventListener('click', () => { ppDir = +b.dataset.ppdir; ppSyncBar(); }));
$('#ppPresetGo').addEventListener('click', ppMakePreset);
/* --- 〰 motion path (like Animate's motion guide): draw a line, the selected character travels along it over N frames.
   Stored as an overlay offset per frame in f.lip.mv = {rootPartId: {x, y}} (like auto blink), so re-tweening poses,
   walk cycles and lip sync never wipe it. Missing frames are added by repeating the poses from the current frame on
   (a walk cycle keeps walking). One undo step. --- */
function ppApplyMv(pose, mv) {
  const P = { ...(pose || {}) };
  for (const id in mv) { const m = mv[id]; if (!m || !ppPart(id)) continue; const q = P[id] = { ...(P[id] || {}) }; q.dx = (q.dx || 0) + m.x; q.dy = (q.dy || 0) + m.y; }
  return P;
}
const ppPoseFor = f => f && f.lip && f.lip.mv ? ppApplyMv(f.pp, f.lip.mv) : f && f.pp;
function ppLipAt(i, tIn) {
  const f = S.frames[i], nx = S.frames[i + 1], a = f.lip && f.lip.mv; if (!a || !nx) return f.lip;
  const b = (nx.lip && nx.lip.mv) || {}, dur = Math.max(1, f.dur), T = Math.min(dur, 160), u = clamp((tIn * 1000 - (dur - T)) / T, 0, 1); if (u <= 0) return f.lip;
  const mv = {}; for (const id in a) { const p = a[id], q = b[id] || p; mv[id] = { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }; }
  return { ...f.lip, mv };
}
// even spacing along the drawn line (with a little smoothing of hand jitter)
function ppPathSample(pts) {
  const sm = pts.map((p, i) => { let x = 0, y = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(pts.length - 1, i + 2); k++) { x += pts[k].x; y += pts[k].y; c++; } return { x: x / c, y: y / c }; });
  sm[0] = pts[0]; sm[sm.length - 1] = pts[pts.length - 1];
  const L = [0]; for (let i = 1; i < sm.length; i++) L.push(L[i - 1] + Math.hypot(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y));
  const at = s => { let i = 1; while (i < sm.length - 1 && L[i] < s) i++; const t = L[i] > L[i - 1] ? (s - L[i - 1]) / (L[i] - L[i - 1]) : 0; return { x: sm[i - 1].x + (sm[i].x - sm[i - 1].x) * t, y: sm[i - 1].y + (sm[i].y - sm[i - 1].y) * t }; };
  return { len: L[L.length - 1], at };
}
function ppMvEdit(f, fn) { const before = f.lip ? JSON.stringify(f.lip) : null, l = { ...(f.lip || {}) }; l.mv = { ...(l.mv || {}) }; fn(l.mv); if (!Object.keys(l.mv).length) delete l.mv; const lip = Object.keys(l).length ? l : null, after = lip ? JSON.stringify(lip) : null; if (before === after) return null; f.lip = lip; f.ver++; queueThumbFor(f); return { t: targetOf(f), lipe: true, before, after, bytes: 64 }; }
async function ppApplyPath(pts) {
  const charId = ppSelChar(); if (!charId) { toast('Chưa có nhân vật ghép'); return; }
  const path = ppPathSample(pts); if (path.len < 10) { toast('Đường quá ngắn — kéo dài hơn'); return; }
  const n = clamp(+$('#ppPathN').value || 24, 2, 240), ez = EASE[$('#ppPathEase').value] || EASE.linear, i0 = S.cur, multi = [];
  // not enough frames after this one: repeat the poses from here on (a walk cycle keeps walking)
  const have = S.frames.length - i0;
  if (have < n) {
    const cyc = S.frames.slice(i0), last = S.frames[S.frames.length - 1], added = [];
    for (let k = 0; k < n - have; k++) {
      const src = cyc[(have + k) % cyc.length]; await ensureLoaded(src);
      const f = newFrameObj(cyc[0].bgId);   // the scene stays the one of the frame the path starts on (a blank frame after it must not blink in) f.dur = src.dur; f.canvas.getContext('2d').drawImage(src.canvas, 0, 0); copyCol(f, src); f.ver = 1; f.pngVer = 0; f.vec = cloneVec(src.vec);
      f.pp = ppClone(src.pp); f.ppKey = true; f.ppEase = src.ppEase; f.lip = src.lip ? JSON.parse(JSON.stringify(src.lip)) : null; added.push(f);
    }
    S.frames.push(...added); loaded.push(...added);
    multi.push({ t: targetOf(last), add: { frames: added, index: S.frames.length - added.length, dur0: last.dur, dur1: last.dur }, bytes: 0 });
  }
  const f0 = S.frames[i0], base = (f0.lip && f0.lip.mv && f0.lip.mv[charId]) || { x: 0, y: 0 }, P0 = path.at(0);
  for (let k = 0; k < n; k++) {
    const q = path.at(ez(n > 1 ? k / (n - 1) : 1) * path.len), f = S.frames[i0 + k];
    const e = ppMvEdit(f, mv => { mv[charId] = { x: Math.round((base.x + q.x - P0.x) * 10) / 10, y: Math.round((base.y + q.y - P0.y) * 10) / 10 }; });
    if (e) multi.push(e);
  }
  // frames after the path keep the end position (otherwise the character would jump back)
  const end = S.frames[i0 + n - 1].lip.mv[charId];
  for (let i = i0 + n; i < S.frames.length; i++) { const e = ppMvEdit(S.frames[i], mv => { mv[charId] = { ...end }; }); if (e) multi.push(e); }
  if (multi.length) pushEntry({ multi });
  for (const f of S.frames.slice(i0)) if (!f.thumb) await drawThumb(f);
  buildStrip(); updateFrameUI(); evictSoon(); scheduleSave(); requestRender();
  toast(`Nhân vật đi theo đường qua ${n} frame — bấm ▶ Phát để xem`, 3500);
}
function ppClearPath() {
  const charId = ppSelChar(); if (!charId) return; const multi = [];
  S.frames.forEach(f => { if (f.lip && f.lip.mv && f.lip.mv[charId]) { const e = ppMvEdit(f, mv => { delete mv[charId]; }); if (e) multi.push(e); } });
  if (multi.length) { pushEntry({ multi }); scheduleSave(); requestRender(); toast('Đã bỏ đường đi'); } else toast('Nhân vật này chưa có đường đi');
}
$('#ppPathBtn').addEventListener('click', () => { if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật ghép'); return; } ppPathMode = !ppPathMode; ppCutMode = ppPatchMode = false; ppPaint = null; ppSyncBar(); if (ppPathMode) toast('Kéo bút/ngón vẽ đường nhân vật sẽ đi, bắt đầu từ chỗ nhân vật đang đứng', 3500); });
$('#ppPathClear').addEventListener('click', ppClearPath);
/* --- 🛷 knee slide: the character rushes in, slides with dust and grass flying, stops where it stands now,
 *  leans back and the camera pushes in. One undo step (gagApply: added frames + path + pose + dust pixels + camera + SFX). --- */
function ppCharBox(f) {   // bounding box of the cut-out characters as drawn on frame f
  const k = 0.25, w = Math.ceil(W * k), h = Math.ceil(H * k), c = makeCanvas(w, h), x = c.getContext('2d');
  x.scale(k, k); drawPuppet(x, f.pp, f.lip);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (d[(y * w + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k };
}
const slideRnd = k => { const v = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
/** one dust puff (a soft cartoon cloud) with a few grass bits, t = 0 (just kicked up) … 1 (gone) */
function slidePuffItem(P, t, dir) {
  const r = P.r * (0.6 + 0.9 * t), cx = P.x - dir * P.r * 0.5 * t, cy = P.y - P.r * 0.35 * t, a = 0.85 * Math.pow(1 - t, 1.2);
  const blobs = [0, 1, 2, 3, 4].map(b => { const an = Math.PI * (0.05 + 0.9 * b / 4); return { x: cx - Math.cos(an) * r * 0.62 + (slideRnd(P.seed + b) - 0.5) * r * 0.15, y: cy - Math.sin(an) * r * 0.32, r: r * (0.38 + 0.18 * slideRnd(P.seed + b * 7)) }; });
  const bits = [0, 1, 2].map(b => { const vx = -dir * (0.4 + slideRnd(P.seed + 20 + b)) * P.r * 1.6, vy = -(0.9 + slideRnd(P.seed + 30 + b)) * P.r * 2.2, tt = t * 1.2; return { x: P.x + vx * tt, y: P.y + vy * tt + P.r * 3.2 * tt * tt, ang: Math.atan2(vy + P.r * 6.4 * tt, vx), c: b % 2 ? '#7cc35a' : '#4c9a3a' }; });
  const R = r * 1.3;
  return {
    rect: [Math.min(cx - R, ...bits.map(q => q.x)) - 12, Math.min(cy - R, ...bits.map(q => q.y)) - 12, Math.max(cx + R, ...bits.map(q => q.x)) + 12, Math.max(P.y + r * 0.3, ...bits.map(q => q.y)) + 12],
    draw: x => {
      if (a <= 0.01) return;
      x.globalAlpha = a; x.lineWidth = Math.max(2, r * 0.07); x.strokeStyle = '#b9a581'; x.fillStyle = '#f1e8d5';
      for (const b of blobs) { x.beginPath(); x.arc(b.x, b.y, b.r, 0, Math.PI * 2); x.stroke(); }
      for (const b of blobs) { x.beginPath(); x.arc(b.x, b.y, b.r, 0, Math.PI * 2); x.fill(); }
      x.lineCap = 'round'; x.lineWidth = Math.max(3, P.r * 0.1);
      if (t < 0.8) for (const q of bits) { x.strokeStyle = q.c; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - Math.cos(q.ang) * P.r * 0.35, q.y - Math.sin(q.ang) * P.r * 0.35); x.stroke(); }
    }
  };
}
async function ppSlide(dir) {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật ghép'); return; }
  const charId = ppSelChar(); if (!charId) return;
  if (playing) stopPlay(); ppPathMode = false;
  const i0 = S.cur, f0 = S.frames[i0]; await ensureLoaded(f0);
  const n = clamp(+$('#slideN').value || 20, 4, 120), hold = Math.max(6, Math.round(n * 0.5)), N = n + hold;
  const box = ppCharBox(f0); if (!box) { toast('Không thấy nhân vật trên frame này'); return; }
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0, base = (f0.lip && f0.lip.mv && f0.lip.mv[charId]) || { x: 0, y: 0 };
  const opt = { dust: $('#slideDust').checked, lean: $('#slideLean').checked, cam: $('#slideCam').checked, sfx: $('#slideSfx').checked };
  const D = Math.max(W * 0.6, bw * 1.1);
  const off = j => j >= n - 1 ? 0 : -dir * D * (1 - EASE.out(j / (n - 1)));   // x offset from where the character stands now
  const mine = role => S.pp.parts.find(p => p.role === role && ppCharOf(p) === charId);
  const torso = mine('torso') || ppPart(charId), r0 = id => (f0.pp && f0.pp[id] && f0.pp[id].r) || 0;
  const leanN = Math.min(6, Math.max(2, Math.round(n / 3))), leanAt = j => EASE.inout(clamp((j - (n - 1 - leanN)) / leanN, 0, 1));
  // dust: kicked up at the back of the slide (the lines/pixel layer is under the puppet, so dust under the knees would be hidden)
  // while it moves fast, then left behind on the ground
  const puffs = [], LIFE = 8, ground = box.y1 - bh * 0.03, back = dir > 0 ? box.x0 + bw * 0.04 : box.x1 - bw * 0.04;
  if (opt.dust) for (let k = 0; k < n - 1; k++) { const sp = Math.abs(off(k + 1) - off(k)); if (sp < W * 0.004) continue; puffs.push({ k, x: back + off(k), y: ground, r: clamp(sp * 1.3, bh * 0.09, bh * 0.2), seed: k * 31 + 7 }); }
  const r = await gagApply(i0, {
    n: N, copyOf: f0,
    edit: (j, f) => {
      const out = [ppMvEdit(f, mv => { mv[charId] = { x: Math.round((base.x + off(j)) * 10) / 10, y: base.y }; })];
      if (opt.lean && torso) {
        const before = ppState(f), u = leanAt(j);
        ppQ(f, torso.id).r = r0(torso.id) - dir * 12 * u;   // the head and arms ride along (hands resting on the head stay put)
        f.ppKey = true; const after = ppState(f); if (JSON.stringify(after) !== JSON.stringify(before)) { out.push(ppEntry(f, before, after)); f.ver++; }
      }
      return out;
    },
    pix: j => puffs.filter(P => j >= P.k && j - P.k < LIFE).map(P => slidePuffItem(P, (j - P.k) / LIFE, dir)),
    fx: (j, f, cb) => {
      if (!opt.cam) return false;
      if (j === 0 && !f.cam && S.frames.some((g, i) => i < i0 && g.cam)) { f.cam = { ...cb[i0], tr: 'cut' }; return; }
      if (j !== n - 3 && !(n < 6 && j === n - 1)) return false;
      f.cam = null; camKeySet(f, { z: 1.6, x: (box.x0 + box.x1) / 2, y: box.y0 + bh * 0.38 }, 'smooth'); f.cam.d = 0.7;
    },
    sfx: opt.sfx ? [[0, 'slide'], [n - 1, 'crowd']] : []
  });
  ppRetween(); ppSyncBar();
  toast(`🛷 Đã tạo cảnh trượt gối ${r.n} frame${r.added ? ` (thêm ${r.added} frame)` : ''} — bấm ▶ Phát để xem, ↶ để làm lại`, 4500);
  return r;
}
document.querySelectorAll('[data-slide]').forEach(b => b.addEventListener('click', () => ppSlide(+b.dataset.slide)));

$('#ppBlinkBtn').addEventListener('click', ppAutoBlink);
$('#ppBake').addEventListener('click', ppBake);
$('#projBtn').addEventListener('click', projectsDialog);
$('#wizBtn').addEventListener('click', wizard);
