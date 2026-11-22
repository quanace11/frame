/* ========= Rig (bones) + body motions + facial expressions ========= */
const RJ = ['root', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'hpL', 'knL', 'ftL', 'hpR', 'knR', 'ftR'];
const RP = { chest: 'root', neck: 'chest', head: 'neck', shL: 'chest', elL: 'shL', haL: 'elL', shR: 'chest', elR: 'shR', haR: 'elR', hpL: 'root', knL: 'hpL', ftL: 'knL', hpR: 'root', knR: 'hpR', ftR: 'knR' };
const RKIDS = {}; RJ.forEach(j => { if (RP[j]) (RKIDS[RP[j]] = RKIDS[RP[j]] || []).push(j); });
const RBONES = RJ.filter(j => j !== 'root');
const RADJ = {}; RBONES.forEach(a => { RADJ[a] = new Set(RBONES.filter(b => b !== a && (RP[a] === b || RP[b] === a || RP[a] === RP[b]))); });
const DEG = Math.PI / 180;
const isDerived = id => /~(lip|tear)/.test(id);
const wrapRad = a => Math.atan2(Math.sin(a), Math.cos(a));
const lerpA = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return a + d * t; };
let rig = null;   // open rig session
const BODY = {
  none: { label: 'Không', n: 6, dur: 0.1 }, idle: { label: 'Thở', n: 8, dur: 0.15 }, walk: { label: 'Đi bộ', n: 8, dur: 0.1, stride: 0.5 },
  run: { label: 'Chạy', n: 6, dur: 0.07, stride: 1.0 }, jump: { label: 'Nhảy', n: 8, dur: 0.08, stride: 0.3 }, roll: { label: 'Lăn lộn', n: 8, dur: 0.07, stride: 1.4 },
  wave: { label: 'Vẫy tay', n: 6, dur: 0.1 }, celebrate: { label: 'Ăn mừng', n: 6, dur: 0.1 }, fall: { label: 'Ngã', n: 8, dur: 0.08, once: true }
};
const FACE = {
  none: { label: 'Không' }, blink: { label: 'Chớp mắt', n: 8, dur: 0.1 }, talk: { label: 'Nói', n: 6, dur: 0.08 }, laugh: { label: 'Cười lớn', n: 6, dur: 0.08 },
  cry: { label: 'Khóc', n: 8, dur: 0.1 }, scream: { label: 'Gào thét', n: 6, dur: 0.06 }, angry: { label: 'Giận', n: 6, dur: 0.08 },
  surprised: { label: 'Ngạc nhiên', n: 6, dur: 0.1 }, sad: { label: 'Buồn', n: 8, dur: 0.15 }
};
function vecBBox(vec) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const st of vec) if (!isDerived(st.id)) for (const q of st.pts) { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); }
  return b;
}
function rigAutoFit(vec) {
  const b = vecBBox(vec); if (!isFinite(b[0])) return null;
  const pts = []; vec.forEach(st => { if (!isDerived(st.id)) pts.push(...st.pts); });
  const hgt = b[3] - b[1], cx = (b[0] + b[2]) / 2, Y = t => b[1] + t * hgt, P = (x, y) => ({ x, y });
  const J = {};
  J.head = P(cx, Y(0)); J.neck = P(cx, Y(0.2)); J.chest = P(cx, Y(0.27)); J.root = P(cx, Y(0.55));
  const sw = Math.min(0.1 * hgt, (b[2] - b[0]) * 0.3);
  J.shL = P(cx - sw, Y(0.29)); J.shR = P(cx + sw, Y(0.29));
  const band = pts.filter(q => q.y > Y(0.2) && q.y < Y(0.65));
  const exL = band.reduce((a, q) => q.x < a.x ? q : a, { x: cx, y: Y(0.4) }), exR = band.reduce((a, q) => q.x > a.x ? q : a, { x: cx, y: Y(0.4) });
  const armLen = 0.33 * hgt;
  const hand = (sh, ex, sgn) => Math.abs(ex.x - sh.x) > 0.18 * hgt ? P(ex.x + (sh.x - ex.x) * 0.1, ex.y + (sh.y - ex.y) * 0.1) : P(sh.x + sgn * 0.04 * hgt, sh.y + armLen);
  // arms spread out (T-pose): put shoulders on the torso edges, measured below the arms
  if (Math.abs(exL.x - cx) > 0.25 * hgt && Math.abs(exR.x - cx) > 0.25 * hgt) {
    const tb = pts.filter(q => q.y > Y(0.38) && q.y < Y(0.5) && Math.abs(q.x - cx) < 0.25 * hgt);
    if (tb.length > 4) {
      const tl = Math.min(...tb.map(q => q.x)), tr = Math.max(...tb.map(q => q.x));
      if (cx - tl > 0.03 * hgt) J.shL.x = tl + (cx - tl) * 0.08;
      if (tr - cx > 0.03 * hgt) J.shR.x = tr - (tr - cx) * 0.08;
    }
  }
  J.haL = hand(J.shL, exL, -1); J.haR = hand(J.shR, exR, 1);
  J.elL = P((J.shL.x + J.haL.x) / 2, (J.shL.y + J.haL.y) / 2 + 0.01 * hgt); J.elR = P((J.shR.x + J.haR.x) / 2, (J.shR.y + J.haR.y) / 2 + 0.01 * hgt);
  const bottom = pts.filter(q => q.y > Y(0.85));
  const fL = bottom.filter(q => q.x < cx), fR = bottom.filter(q => q.x >= cx);
  const avgx = (arr, d) => arr.length ? arr.reduce((a, q) => a + q.x, 0) / arr.length : d;
  const hw = 0.06 * hgt;
  J.hpL = P(cx - hw, Y(0.56)); J.hpR = P(cx + hw, Y(0.56));
  J.ftL = P(avgx(fL, cx - hw), Y(0.96)); J.ftR = P(avgx(fR, cx + hw), Y(0.96));
  J.knL = P((J.hpL.x + J.ftL.x) / 2, Y(0.76)); J.knR = P((J.hpR.x + J.ftR.x) / 2, Y(0.76));
  return J;
}
function rigInfo(J) { const I = {}; for (const j of RBONES) { const p = RP[j], dx = J[j].x - J[p].x, dy = J[j].y - J[p].y; I[j] = { L: Math.hypot(dx, dy), a: Math.atan2(dy, dx) }; } return I; }
function rigHeight(J) { return Math.max(40, Math.max(J.ftL.y, J.ftR.y) - J.head.y); }
function solvePose(J, I, P, h) {
  const pos = { root: { x: J.root.x + (P.dx || 0) * h, y: J.root.y + (P.dy || 0) * h } }, d = { root: 0 };
  for (const j of RBONES) {
    const p = RP[j], inf = I[j]; let A;
    if (P.abs && P.abs[j] != null) A = P.abs[j] * DEG; else A = inf.a + d[p] + ((P.rel && P.rel[j]) || 0) * DEG;
    d[j] = A - inf.a; pos[j] = { x: pos[p].x + inf.L * Math.cos(A), y: pos[p].y + inf.L * Math.sin(A) };
  }
  const rot = (P.rot || 0) * DEG;
  if (rot) { const c = pos.root, cs = Math.cos(rot), sn = Math.sin(rot); for (const j of RBONES) { const x = pos[j].x - c.x, y = pos[j].y - c.y; pos[j] = { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs }; d[j] += rot; } }
  return { pos, d };
}
const RLIMB_ROOT = new Set(['elL', 'elR', 'knL', 'knR']);   // upper arms & thighs: ignore points on the body side of the joint
function boneWeights(q, J) {
  let b1 = null, d1 = Infinity; const dist = {};
  for (const j of RBONES) {
    const a = J[RP[j]], b = J[j];
    if (RLIMB_ROOT.has(j)) { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; if (L && ((q.x - a.x) * dx + (q.y - a.y) * dy) / L < (j[0] === 'e' ? 0.18 : 0.06)) { dist[j] = Infinity; continue; } }
    const dd = segDist(q, a, b); dist[j] = dd; if (dd < d1) { d1 = dd; b1 = j; }
  }
  let b2 = null, d2 = Infinity; for (const j of RADJ[b1]) if (dist[j] < d2) { d2 = dist[j]; b2 = j; }
  if (!isFinite(d2)) b2 = null;
  const w1 = 1 / Math.pow(d1 + 3, 4), w2 = b2 ? 1 / Math.pow(d2 + 3, 4) : 0, s = w1 + w2;
  return b2 ? [[b1, w1 / s], [b2, w2 / s]] : [[b1, 1]];
}
function crSample(P, sp) {
  if (P.length < 3) { if (P.length === 2) { const L = Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y), m = Math.max(1, Math.ceil(L / sp)), o = []; for (let i = 0; i <= m; i++) o.push({ x: P[0].x + (P[1].x - P[0].x) * i / m, y: P[0].y + (P[1].y - P[0].y) * i / m }); return o; } return P.map(q => ({ ...q })); }
  const out = [{ ...P[0] }];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    const m = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / sp));
    for (let k = 1; k <= m; k++) { const t = k / m, u = 1 - t; out.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y }); }
  }
  return out;
}
function skinVec(vec, J, pose, simplify) {
  return vec.map(st => {
    const pts = crSample(st.pts, 7).map(q => {
      let x = 0, y = 0;
      for (const [j, w] of boneWeights(q, J)) { const p = RP[j], c = Math.cos(pose.d[j]), s = Math.sin(pose.d[j]), vx = q.x - J[p].x, vy = q.y - J[p].y; x += w * (pose.pos[p].x + vx * c - vy * s); y += w * (pose.pos[p].y + vx * s + vy * c); }
      return { x, y };
    });
    return { id: st.id, c: st.c, w: st.w, a: st.a, pts: simplify ? rdp(pts, 0.7) : pts };
  });
}
function bodyPose(type, ph, f, A, prog, cyc) {
  const s = Math.sin(ph), c = Math.cos(ph), P = { abs: {}, rel: {}, dx: 0, dy: 0, rot: 0 }, a = P.abs;
  const side = deg => 90 - f * deg;
  const up = () => { a.chest = -90; a.neck = -90; a.head = -90; };
  switch (type) {
    case 'idle': P.rel = { chest: 1.5 * A * s, head: 3 * A * Math.sin(ph + 1), elL: 4 * A * s, elR: -4 * A * s }; P.dy = -0.006 * A * (1 - c) / 2; break;
    case 'walk': case 'run': {
      const R = type === 'run', th = (R ? 45 : 25) * A, kn = (R ? 85 : 40) * A, ar = (R ? 40 : 22) * A, fb = R ? 80 : 18, lean = (R ? 12 : 4) * A;
      if (f) {
        const tA = th * s, tB = -tA, kA = kn * Math.max(0, c), kB = kn * Math.max(0, -c);
        a.knL = side(tA); a.ftL = side(tA - kA); a.knR = side(tB); a.ftR = side(tB - kB);
        const aA = -ar * s, aB = -aA; a.elL = side(aA); a.haL = side(aA + fb); a.elR = side(aB); a.haR = side(aB + fb);
        a.chest = -90 + f * lean; a.neck = -90 + f * lean * 0.5; a.head = -90 + f * lean * 0.5;
      } else {
        const u = Math.max(0, s), dn = Math.max(0, -s), k = R ? 1.8 : 1;
        a.knL = 92 + 14 * k * A * u; a.ftL = 90 - 22 * k * A * u; a.knR = 88 - 14 * k * A * dn; a.ftR = 90 + 22 * k * A * dn;
        a.elL = 100 + 12 * k * A * s; a.haL = a.elL - (R ? 55 : 8); a.elR = 80 + 12 * k * A * s; a.haR = a.elR + (R ? 55 : 8);
        up(); P.rot = 3 * A * s * (R ? 1.5 : 1);
      }
      P.dy = -(R ? 0.03 : 0.012) * A * Math.cos(2 * ph); break;
    }
    case 'jump': {
      const air = Math.max(0, s), cr = Math.max(0, -s);
      P.dy = -0.28 * A * air + 0.07 * A * cr;
      a.knL = 92 + 28 * cr + 12 * air; a.ftL = 90 - 28 * cr - 12 * air; a.knR = 88 - 28 * cr - 12 * air; a.ftR = 90 + 28 * cr + 12 * air;
      a.elL = lerpA(100, 215, air); a.haL = a.elL + 10; a.elR = lerpA(80, -35, air); a.haR = a.elR - 10; up(); break;
    }
    case 'celebrate': {
      const pump = 12 * A * s; a.elL = -135 + pump; a.haL = -122 + pump; a.elR = -45 - pump; a.haR = -58 - pump;
      a.knL = 93; a.ftL = 90; a.knR = 87; a.ftR = 90; up(); P.dy = -0.04 * A * Math.max(0, s); break;
    }
    case 'wave': a.elR = -35; a.haR = -95 + 32 * A * s; P.rel = { head: 2 * s }; break;
    case 'roll': {
      const g = f || 1;
      a.knL = a.knR = 90 - g * 100; a.ftL = a.ftR = 90 + g * 40; a.elL = a.elR = 90 - g * 70; a.haL = a.haR = 90 - g * 150;
      a.chest = -90 + g * 35; a.neck = a.head = -90 + g * 60; P.rot = g * ph / DEG; break;
    }
    case 'fall': {
      const e = prog * prog, g = f || 1; P.rot = g * 90 * e; P.dy = 0.18 * e;
      a.elL = lerpA(100, 200, prog) + 25 * Math.sin(ph * 3); a.haL = a.elL + 20; a.elR = lerpA(80, -20, prog) - 25 * Math.sin(ph * 3); a.haR = a.elR - 20;
      a.knL = 92 + 20 * prog; a.ftL = 90; a.knR = 88 - 20 * prog; a.ftR = 90; up(); break;
    }
  }
  return P;
}
/* --- face --- */
function groupBox(list) { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const st of list) for (const q of st.pts) { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); } return b; }
function xfGroup(list, fn) { if (!list.length) return; const b = groupBox(list), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; for (const st of list) st.pts = st.pts.map(q => fn(q, cx, cy, b)); }
const scaleG = (list, sx, sy) => xfGroup(list, (q, cx, cy) => ({ x: cx + (q.x - cx) * sx, y: cy + (q.y - cy) * sy }));
const moveG = (list, dx, dy) => list.forEach(st => st.pts = st.pts.map(q => ({ x: q.x + dx, y: q.y + dy })));
const rotG = (list, deg) => { const r = deg * DEG, cs = Math.cos(r), sn = Math.sin(r); xfGroup(list, (q, cx, cy) => ({ x: cx + (q.x - cx) * cs - (q.y - cy) * sn, y: cy + (q.x - cx) * sn + (q.y - cy) * cs })); };
const flipG = list => xfGroup(list, (q, cx, cy) => ({ x: q.x, y: cy - (q.y - cy) }));
function lipStroke(st, open) {
  let P = st.pts; if (P.length < 2) return null;
  if (P.length < 8) P = crSample(P, 4);
  const xs = P.map(q => q.x), wid = Math.max(...xs) - Math.min(...xs) || 20, c2 = cumLen(P), L = c2[c2.length - 1] || 1;
  return { id: st.id + '~lip', c: st.c, w: st.w, a: st.a, pts: P.map((q, i) => ({ x: q.x, y: q.y + Math.sin(Math.PI * c2[i] / L) * open * wid })) };
}
function applyExpr(vec, type, ph, A, J) {
  const F = S.rig && S.rig.face; if (!type || type === 'none' || !F) return vec;
  const out = vec.map(st => ({ id: st.id, c: st.c, w: st.w, a: st.a, pts: st.pts.map(q => ({ ...q })) }));
  const pick = ids => out.filter(st => ids.includes(st.id));
  const hcx = (J.head.x + J.neck.x) / 2, hl = Math.hypot(J.head.x - J.neck.x, J.head.y - J.neck.y) || 100;
  const eyes = pick(F.eyes), mouth = pick(F.mouth), brows = pick(F.brows);
  const sideOf = list => { const L = [], R = []; for (const st of list) { const b = groupBox([st]); ((b[0] + b[2]) / 2 < hcx ? L : R).push(st); } return [L, R]; };
  const [eL, eR] = sideOf(eyes), [bL, bR] = sideOf(brows);
  const mainMouth = mouth.slice().sort((p, q) => groupBox([q])[2] - groupBox([q])[0] - (groupBox([p])[2] - groupBox([p])[0]))[0];
  const eyeY = sy => { scaleG(eL, 1, sy); scaleG(eR, 1, sy); };
  const eyeS = sc => { scaleG(eL, sc, sc); scaleG(eR, sc, sc); };
  const browRot = (deg, dy) => { rotG(bL, deg); rotG(bR, -deg); moveG(brows, 0, dy * hl); };
  const openMouth = o => { if (mainMouth && o > 0.02) { const l = lipStroke(mainMouth, o); if (l) out.push(l); } };
  const shakeFace = dx => moveG([...eyes, ...mouth, ...brows], dx * hl, 0);
  const tears = () => {
    for (const side of [eL, eR]) {
      if (!side.length) continue; const b = groupBox(side), ex = (b[0] + b[2]) / 2, ey = b[3] + 0.02 * hl;
      const len = (0.55 + 0.45 * ((ph / (2 * Math.PI) * 2) % 1)) * hl * 0.8 * A, pts = [];
      for (let j = 0; j <= 7; j++) pts.push({ x: ex + Math.sin(j * 1.3 + ph * 3) * 0.035 * hl, y: ey + len * j / 7 });
      out.push({ id: side[0].id + '~tear', c: '#3fa9f5', w: Math.max(3, 0.05 * hl), pts });
    }
  };
  switch (type) {
    case 'blink': { const t = ph % (2 * Math.PI), pulse = Math.exp(-Math.pow((t - Math.PI) / 0.5, 2)); eyeY(1 - 0.92 * pulse); break; }
    case 'talk': openMouth((1 - Math.cos(2 * ph)) / 2 * 0.5 * A); break;
    case 'laugh': eyeY(0.35); { const k = Math.abs(Math.sin(2 * ph)); openMouth((0.45 + 0.3 * k) * A); moveG([...eyes, ...mouth, ...brows], 0, -0.03 * hl * k); } break;
    case 'cry': eyeY(0.45); browRot(-15 * A, 0); if (mainMouth) flipG([mainMouth]); openMouth((0.3 + 0.12 * Math.sin(4 * ph)) * A); tears(); break;
    case 'scream': eyeY(0.15); browRot(22 * A, 0.04); openMouth(1.0 * A); if (mainMouth) scaleG([mainMouth], 1.1, 1); shakeFace(Math.sin(ph * 4) * 0.02 * A); break;
    case 'angry': eyeY(0.65); browRot(20 * A, 0.04); if (mainMouth) { flipG([mainMouth]); scaleG([mainMouth], 1, 0.6); } shakeFace(Math.sin(ph * 2) * 0.012 * A); break;
    case 'surprised': eyeS(1.3 + 0.05 * Math.sin(2 * ph)); moveG(brows, 0, -0.08 * hl * A); if (mainMouth) scaleG([mainMouth], 0.6, 1); openMouth(0.7 * A); break;
    case 'sad': eyeY(0.8); browRot(-15 * A, 0.01); if (mainMouth) flipG([mainMouth]); break;
  }
  return out;
}
function guessFace(vec, J) {
  const hc = { x: (J.head.x + J.neck.x) / 2, y: (J.head.y + J.neck.y) / 2 }, hl = Math.hypot(J.head.x - J.neck.x, J.head.y - J.neck.y) || 100;
  const cand = vec.filter(st => !isDerived(st.id)).map(st => { const b = groupBox([st]); return { st, b, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: b[2] - b[0], h: b[3] - b[1] }; })
    .filter(c => Math.hypot(c.b[2] - c.b[0], c.b[3] - c.b[1]) < 0.55 * hl && c.st.pts.every(q => Math.hypot(q.x - hc.x, q.y - hc.y) < 0.75 * hl));
  const below = cand.filter(c => c.cy > hc.y && c.w > c.h).sort((p, q) => q.cy - p.cy);
  const mouth = below.length ? [below[0]] : [];
  const upper = cand.filter(c => !mouth.includes(c) && c.cy < (mouth[0] ? mouth[0].cy - 0.08 * hl : hc.y + 0.1 * hl));
  const eyes = [], brows = [];
  for (const sideC of [upper.filter(c => c.cx < hc.x), upper.filter(c => c.cx >= hc.x)]) {
    sideC.sort((p, q) => p.cy - q.cy);
    if (sideC.length >= 2 && sideC[0].w > sideC[0].h * 2.2 && sideC[0].cy < sideC[1].cy - 0.03 * hl) { brows.push(sideC[0]); eyes.push(...sideC.slice(1)); }
    else eyes.push(...sideC);
  }
  return { eyes: eyes.map(c => c.st.id), mouth: mouth.map(c => c.st.id), brows: brows.map(c => c.st.id) };
}
/* --- session --- */
function rigFrameVec(k) {
  const R = rig, J = S.rig.J, I = rigInfo(J), h = rigHeight(J), n = R.n, cyc = R.cyc;
  const ph = 2 * Math.PI * cyc * k / n, prog = BODY[R.body].once ? (n > 1 ? k / (n - 1) : 0) : k / n;
  let v = applyExpr(R.base, R.face, ph, R.amp, J);
  if (R.body === 'none') return { vec: v, pose: null };
  const P = bodyPose(R.body, BODY[R.body].once ? prog * Math.PI * 2 : ph, R.dir, R.amp, prog, cyc);
  if (R.travel && R.dir && BODY[R.body].stride) P.dx += R.dir * BODY[R.body].stride * R.amp * cyc * (k / n);
  const pose = solvePose(J, I, P, h);
  return { vec: skinVec(v, J, pose, R.simplify), pose };
}
function rigOpen() {
  const f = curFrame(); if (!f) return;
  const base = f.vec.filter(st => !isDerived(st.id));
  if (!base.length) { toast('Lớp Nét trống — nhập ảnh "Chuyển thành nét vẽ" hoặc vẽ nét vector trước'); return; }
  if (playing) stopPlay(); motionClose();
  if (!S.rig || !S.rig.J) S.rig = { J: rigAutoFit(base), face: { eyes: [], mouth: [], brows: [] } };
  if (!S.rig.face.eyes.length && !S.rig.face.mouth.length) S.rig.face = guessFace(base, S.rig.J);
  rig = { base: cloneVec(base), body: 'none', face: 'none', dir: 1, travel: false, amp: 1, n: 8, cyc: 1, dur: 0.1, keep: true, k: 0, timer: null, pv: null, pose: null, bones: true, simplify: false };
  vsel.clear(); $('#vecbar').hidden = true; $('#rigbar').hidden = false;
  syncRigUI(); rigPreview(); scheduleSave();
}
function rigClose() {
  if (!rig) return; clearTimeout(rig.timer); rig = null; $('#rigbar').hidden = true; vsel.clear(); updVecBar(); requestRender();
}
function rigPreview() {
  if (!rig) return; clearTimeout(rig.timer);
  const anim = rig.body !== 'none' || rig.face !== 'none';
  if (!anim) { rig.pv = null; rig.pose = null; requestRender(); return; }
  const r = rigFrameVec(rig.k); rig.pv = r.vec; rig.pose = r.pose; requestRender();
  rig.timer = setTimeout(() => { if (!rig) return; rig.k = (rig.k + 1) % rig.n; rigPreview(); }, Math.max(30, rig.dur * 1000));
}
function syncRigUI() {
  const R = rig, F = S.rig.face;
  document.querySelectorAll('[data-rb]').forEach(b => b.classList.toggle('on', b.dataset.rb === R.body));
  document.querySelectorAll('[data-rf]').forEach(b => b.classList.toggle('on', b.dataset.rf === R.face));
  document.querySelectorAll('[data-rd]').forEach(b => b.classList.toggle('on', +b.dataset.rd === R.dir));
  $('#rgEyes').textContent = `Mắt (${F.eyes.length})`; $('#rgMouth').textContent = `Miệng (${F.mouth.length})`; $('#rgBrows').textContent = `Lông mày (${F.brows.length})`;
  $('#rgAmp').value = Math.round(R.amp * 100); $('#rgAmpVal').textContent = Math.round(R.amp * 100) + '%';
  $('#rgN').value = R.n; $('#rgNVal').textContent = R.n; $('#rgCyc').value = R.cyc; $('#rgCycVal').textContent = R.cyc; $('#rgDur').value = R.dur;
  $('#rgTravel').checked = R.travel; $('#rgKeep').checked = R.keep; $('#rgBones').classList.toggle('on', R.bones);
  $('#rgInfo').textContent = `${R.n} frame · ${(R.n * R.dur).toFixed(2)}s`;
  $('#rgGo').disabled = R.body === 'none' && R.face === 'none';
}
function rigSetPreset(kind, key) {
  rig[kind] = key;
  const lead = rig.body !== 'none' ? BODY[rig.body] : FACE[rig.face];
  if (lead && lead.n) { rig.n = lead.n; rig.dur = lead.dur; }
  if (kind === 'face' && key !== 'none' && !S.rig.face.eyes.length && !S.rig.face.mouth.length) toast('Chưa gán mắt/miệng — chạm chọn nét rồi bấm Mắt/Miệng, hoặc Tự đoán', 3500);
  rig.k = 0; syncRigUI(); rigPreview();
}
function rigPointer(p, base) {
  const J = S.rig.J, tol = 22 * DPR / vs;
  let best = null, bd = Infinity; for (const j of RJ) { const d = Math.hypot(J[j].x - p.x, J[j].y - p.y); if (d < bd) { bd = d; best = j; } }
  if (rig.bones && bd <= tol) { action = { ...base, kind: 'rjoint', j: best, last: p }; return; }
  const hit = hitStroke(rig.base, p, 14 * DPR / vs);
  if (hit) { vsel.has(hit.id) ? vsel.delete(hit.id) : vsel.add(hit.id); requestRender(); }
}
function rigMoveJoint(j, dx, dy) { const J = S.rig.J; J[j].x += dx; J[j].y += dy; (RKIDS[j] || []).forEach(k => rigMoveJoint(k, dx, dy)); }
function renderRig(c, px) {
  if (!rig || !S.rig) return;
  const drawSk = (pos, alpha, wid, dots) => {
    c.save(); c.globalAlpha = alpha; c.lineCap = 'round';
    for (const j of RBONES) { const p = RP[j]; c.strokeStyle = /L$/.test(j) ? '#ffb21e' : /R$/.test(j) ? '#00c7be' : '#ff3b9a'; c.lineWidth = wid * px; c.beginPath(); c.moveTo(pos[p].x, pos[p].y); c.lineTo(pos[j].x, pos[j].y); c.stroke(); }
    if (dots) for (const j of RJ) { c.beginPath(); c.arc(pos[j].x, pos[j].y, (j === 'root' ? 9 : 7) * px, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#222'; c.stroke(); }
    c.restore();
  };
  if (!rig.pv) {
    const F = S.rig.face, col = id => F.eyes.includes(id) ? 'rgba(76,217,100,.55)' : F.mouth.includes(id) ? 'rgba(255,59,92,.55)' : F.brows.includes(id) ? 'rgba(179,107,255,.55)' : null;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const st of rig.base) { const cc = col(st.id); if (cc) { c.strokeStyle = cc; c.lineWidth = st.w + 9 * px; strokePath(c, st.pts); c.stroke(); } }
    c.restore();
  }
  if (rig.bones) drawSk(S.rig.J, rig.pv ? 0.25 : 0.85, rig.pv ? 3 : 5, !rig.pv);
  if (rig.pose && rig.bones) drawSk(rig.pose.pos, 0.7, 3, false);
}
async function rigCommit() {
  const R = rig; if (!R) return; clearTimeout(R.timer);
  const f0 = curFrame(), i0 = S.cur, durMs = Math.round(R.dur * 1000);
  await ensureLoaded(f0);
  R.simplify = true;
  const added = [], entries = [];
  const mk = kk => { const f = newFrameObj(f0.bgId); f.dur = durMs; f.canvas.getContext('2d').drawImage(f0.canvas, 0, 0); copyCol(f, f0); f.ver = 1; f.pngVer = 0; f.vec = cloneVec(rigFrameVec(kk).vec); f.pp = ppClone(f0.pp); f.lip = lipCopy(f0); lookCopy(f, f0); return f; };
  if (R.keep) { for (let kk = 0; kk < R.n; kk++) added.push(mk(kk)); }
  else {
    const before = cloneVec(f0.vec); f0.vec = cloneVec(rigFrameVec(0).vec);
    entries.push(vecEntry(f0, before, cloneVec(f0.vec))); markEdited(f0);
    for (let kk = 1; kk < R.n; kk++) added.push(mk(kk));
  }
  const oldDur = f0.dur; f0.dur = durMs;
  S.frames.splice(i0 + 1, 0, ...added); loaded.push(...added);
  entries.push({ t: targetOf(f0), add: { frames: added, index: i0 + 1, dur0: oldDur, dur1: durMs }, bytes: 0 });
  pushEntry(entries.length === 1 ? entries[0] : { multi: entries });
  rigClose();
  for (const f of added) await drawThumb(f);
  buildStrip(); updateFrameUI(); evictSoon(); scheduleSave();
  toast(`Đã tạo ${added.length} frame ${R.body !== 'none' ? BODY[R.body].label.toLowerCase() : ''}${R.face !== 'none' ? ' + ' + FACE[R.face].label.toLowerCase() : ''} — bấm Phát để xem`, 3500);
}
// wiring
$('#vecRig').addEventListener('click', rigOpen);
Object.entries(BODY).forEach(([k, v]) => { const b = document.createElement('button'); b.className = 'chip small'; b.dataset.rb = k; b.textContent = v.label; b.addEventListener('click', () => rigSetPreset('body', k)); $('#rgBody').append(b); });
Object.entries(FACE).forEach(([k, v]) => { const b = document.createElement('button'); b.className = 'chip small'; b.dataset.rf = k; b.textContent = v.label; b.addEventListener('click', () => rigSetPreset('face', k)); $('#rgFace').append(b); });
document.querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', () => { rig.dir = +b.dataset.rd; syncRigUI(); rigPreview(); }));
const assignFace = key => { if (!vsel.size) { toast('Chạm chọn các nét trước (chạm lại để bỏ chọn)'); return; } const ids = [...vsel]; for (const k of ['eyes', 'mouth', 'brows']) S.rig.face[k] = S.rig.face[k].filter(id => !ids.includes(id)); S.rig.face[key] = ids; vsel.clear(); syncRigUI(); rigPreview(); requestRender(); scheduleSave(); };
$('#rgEyes').addEventListener('click', () => assignFace('eyes'));
$('#rgMouth').addEventListener('click', () => assignFace('mouth'));
$('#rgBrows').addEventListener('click', () => assignFace('brows'));
$('#rgGuess').addEventListener('click', () => { S.rig.face = guessFace(rig.base, S.rig.J); syncRigUI(); rigPreview(); requestRender(); const F = S.rig.face; toast(`Đoán: ${F.eyes.length} nét mắt, ${F.mouth.length} miệng, ${F.brows.length} lông mày`); });
$('#rgClearFace').addEventListener('click', () => { S.rig.face = { eyes: [], mouth: [], brows: [] }; syncRigUI(); rigPreview(); requestRender(); });
$('#rgRefit').addEventListener('click', () => { S.rig.J = rigAutoFit(rig.base); rigPreview(); requestRender(); scheduleSave(); });
$('#rgBones').addEventListener('click', () => { rig.bones = !rig.bones; syncRigUI(); requestRender(); });
$('#rgAmp').addEventListener('input', e => { rig.amp = e.target.value / 100; syncRigUI(); });
$('#rgN').addEventListener('input', e => { rig.n = +e.target.value; rig.k %= rig.n; syncRigUI(); });
$('#rgCyc').addEventListener('input', e => { rig.cyc = +e.target.value; syncRigUI(); });
$('#rgDur').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { rig.dur = v; syncRigUI(); } });
$('#rgTravel').addEventListener('change', e => { rig.travel = e.target.checked; });
$('#rgKeep').addEventListener('change', e => { rig.keep = e.target.checked; });
$('#rgCancel').addEventListener('click', rigClose);
$('#rgGo').addEventListener('click', rigCommit);
$('#rgMini').addEventListener('click', () => { const mb = $('#rigbar'); mb.classList.toggle('mini'); $('#rgMini').textContent = mb.classList.contains('mini') ? '▴ Mở rộng' : '▾ Thu gọn'; });

