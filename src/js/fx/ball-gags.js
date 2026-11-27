/* ===== ⚽ Ball path + ⚡ one-tap gag combos: everything drawn in code (original), one undo step each ===== */
SETTINGS_KEYS.push('ballOpt');
S.ballOpt = { obj: 'ball', n: 8, ease: 'even', size: 1, hit: true, trail: true, sound: true, tobj: 'remote', crack: true };
let ballMode = null, gagMode = null;
// a plain football: white ball with dark patches that turn with `spin`; `sq` squashes it along angle `sqA`
function aBall(x, cx, cy, r, spin = 0, sq = 0, sqA = 0) {
  x.save(); x.translate(cx, cy); x.rotate(sqA); x.scale(1 + sq * 0.45, 1 - sq * 0.4); x.rotate(-sqA);
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
  x.save(); x.clip(); x.rotate(spin); x.fillStyle = AINK; x.strokeStyle = AINK; x.lineWidth = r * 0.06;
  const pent = (px, py, z, rot) => { x.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * 2 * Math.PI / 5 - Math.PI / 2; x.lineTo(px + Math.cos(a) * z, py + Math.sin(a) * z); } x.closePath(); x.fill(); };
  pent(0, 0, r * 0.34, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * 2 * Math.PI / 5 - Math.PI / 2; pent(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.3, a + Math.PI);
    x.beginPath(); x.moveTo(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34); x.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    const b = a + Math.PI / 5; x.moveTo(Math.cos(b) * r * 0.28, Math.sin(b) * r * 0.28); x.lineTo(Math.cos(b) * r * 0.75, Math.sin(b) * r * 0.75); x.stroke();
  }
  x.restore();
  const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,40,.2)');
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fillStyle = g; x.fill(); x.lineWidth = Math.max(3, r * 0.09); x.strokeStyle = AINK; x.stroke();
  x.restore();
}
const BALL_OBJS = { ball: '⚽ Bóng', boot: '👟 Giày' };
function ballDraw(x, obj, cx, cy, r, spin, sq, sqA) { if (obj === 'boot') aBoot2(x, cx, cy, r / 46, spin); else aBall(x, cx, cy, r, spin, sq, sqA); }
const ballR = () => W * 0.05 * (S.ballOpt.size || 1);
const BALL_EASE = { even: t => t, fast: t => t * t, slow: t => 1 - (1 - t) * (1 - t) };
// n positions along a drawn path, spaced by the chosen speed curve; each with heading + travelled distance
function ballPlan(pts, n, ease) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1] || 1, at = d => { d = clamp(d, 0, L); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const a = pts[i - 1], b = pts[i] || a, seg = (cum[i] - cum[i - 1]) || 1, t = (d - cum[i - 1]) / seg; return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(b.y - a.y, b.x - a.x) }; };
  const E = BALL_EASE[ease] || BALL_EASE.even, out = [];
  for (let j = 0; j < n; j++) { const d = E(n > 1 ? j / (n - 1) : 1) * L; out.push({ ...at(d), d, at }); }
  return out;
}
const rectUnion = (a, b) => !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const rectAround = (x, y, r) => [x - r, y - r, x + r, y + r];
// one frame of a flying object: speed streaks behind it, the object, an impact burst when it squashes
function ballItem(P, j, o) {
  const q = P[j], r = o.r, prev = j ? P[j - 1] : null, spin = o.spin * q.d / r, last = j === P.length - 1, hit = o.hit && last && P.length > 1;
  let rect = rectAround(q.x, q.y, r * (hit ? 2.2 : 1.6));
  const trail = o.trail && prev && Math.hypot(q.x - prev.x, q.y - prev.y) > r * 0.6;
  if (trail) rect = rectUnion(rect, rectAround(prev.x, prev.y, r * 1.2));
  return { rect, draw: x => {
    if (trail) {
      x.save(); x.lineCap = 'round';
      const back = Math.min(q.d - prev.d, r * 7), steps = 10;
      for (const off of [-0.55, 0, 0.55]) {
        x.beginPath();
        for (let k = 0; k <= steps; k++) { const s = q.at(q.d - r * 0.9 - back * k / steps), nx = -Math.sin(s.ang), ny = Math.cos(s.ang); x.lineTo(s.x + nx * off * r, s.y + ny * off * r); }
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = r * (off ? 0.16 : 0.26); x.stroke(); x.strokeStyle = 'rgba(27,27,27,.55)'; x.lineWidth = r * (off ? 0.07 : 0.1); x.stroke();
      }
      x.restore();
    }
    if (hit) { const fx = q.x + Math.cos(q.ang) * r * 0.8, fy = q.y + Math.sin(q.ang) * r * 0.8; aBurst(x, fx, fy, r * 1.6, r * 0.9, 9, '#ffd21f', q.ang, Math.max(3, r * 0.08)); }
    ballDraw(x, o.obj, q.x, q.y, r, spin, hit ? 0.7 : 0, q.ang);
  } };
}
// an animated library effect (dizzy stars, sound word…) centred at (cx, cy), frame t
function animItem(cat, key, t, cx, cy, size) {
  const C = ASSET_CATS[cat], k = size / C.w, w = C.w * k, h = C.h * k;
  return { rect: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], draw: x => { const c = assetRender(cat, key, k, { ...assetOpt, flip: false, t }); x.drawImage(c, cx - c.width / 2, cy - c.height / 2); c.width = 0; } };
}
function confettiItem(j, seed) {
  const R = aRnd(seed), pcs = []; for (let i = 0; i < 46; i++) pcs.push([R() * W, -R() * H * 0.4, 0.6 + R() * 0.8, R() * 6, ['#ff3b5c', '#ffd21f', '#4cd964', '#2f7bff', '#b36bff', '#fff'][i % 6]]);
  return { rect: [0, 0, W, H], draw: x => { for (const [px, py, sp, ph, col] of pcs) { const y = py + j * H * 0.07 * sp, xx = px + Math.sin(j * 0.8 + ph) * W * 0.03; if (y < -40 || y > H + 40) continue; x.save(); x.translate(xx, y); x.rotate(ph + j * 0.6 * sp); x.scale(1, Math.cos(j * 0.9 + ph)); x.fillStyle = col; x.fillRect(-W * 0.012, -W * 0.007, W * 0.024, W * 0.014); x.restore(); } } };
}
// Apply a plan starting at frame i0 as ONE undo step. plan: { n, pix(j) → [items], fx(j, f) → change f.texts/cam/shake/flash, sfx: [[j, kind]] }
async function gagApply(i0, plan) {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  const base = S.frames[i0], added = [];
  // missing frames are copies of the last frame (drawn before anything is stamped)
  if (i0 + plan.n > S.frames.length) {
    const last = plan.copyOf || S.frames[S.frames.length - 1]; await ensureLoaded(last);
    // frameCopyOf keeps mouth/eyes + 〰 path position (lip) and the 🌈 look; plan.copyOf (a pose to go on from) keeps its keys too
    while (i0 + plan.n > S.frames.length + added.length) { const f = frameCopyOf(last); if (plan.copyOf) { f.ppKey = last.ppKey; f.ppEase = last.ppEase; } added.push(f); }
    S.frames.push(...added); loaded.push(...added);
  }
  const camBefore = S.frames.map((f, i) => camAt(i)), multi = [];
  if (added.length) multi.push({ t: targetOf(S.frames[S.frames.length - added.length - 1]), add: { frames: added, index: S.frames.length - added.length, dur0: S.frames[S.frames.length - added.length - 1].dur, dur1: S.frames[S.frames.length - added.length - 1].dur }, bytes: 0 });
  for (let j = 0; j < plan.n; j++) {
    const f = S.frames[i0 + j]; await ensureLoaded(f);
    if (plan.edit) for (const e of plan.edit(j, f) || []) if (e) multi.push(e);
    const items = (plan.pix && plan.pix(j)) || [];
    if (items.length) {
      let R = null; for (const it of items) R = rectUnion(R, it.rect);
      const x0 = clamp(Math.floor(R[0]) - 2, 0, W), y0 = clamp(Math.floor(R[1]) - 2, 0, H), x1 = clamp(Math.ceil(R[2]) + 2, 0, W), y1 = clamp(Math.ceil(R[3]) + 2, 0, H);
      if (x1 > x0 && y1 > y0) {
        const lx = f.canvas.getContext('2d'), rect = [x0, y0, x1 - x0, y1 - y0], before = added.includes(f) ? null : lx.getImageData(...rect);
        for (const it of items) { lx.save(); it.draw(lx); lx.restore(); }
        if (before) multi.push(pixEntry(f, rect, before, lx.getImageData(...rect)));
        f.ver++; queueThumbFor(f);
      }
    }
    if (plan.fx) { const b4 = fxState(f); if (plan.fx(j, f, camBefore) !== false) { const af = fxState(f); if (JSON.stringify(af) !== JSON.stringify(b4)) { multi.push({ t: targetOf(f), fxe: true, before: b4, after: af, bytes: 400 }); f.ver++; } } }
  }
  const sfx = (plan.sfx || []).filter(([j, k]) => SFX[k] && S.frames[i0 + j]).map(([j, k]) => ({ id: newId(), frameId: S.frames[i0 + j].id, kind: k, vol: 0.9 }));
  if (sfx.length) { S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || []; S.audio.sfx.push(...sfx); multi.push({ t: targetOf(base), sfxadd: sfx, bytes: 200 }); }
  if (multi.length) pushEntry({ multi, t: targetOf(base) });
  for (const f of added) await drawThumb(f);
  buildStrip(); updateFrameUI(); fxSyncBar(); scheduleSave(); evictSoon(); requestRender();
  return { n: plan.n, added: added.length, sfx };
}
async function ballRun(pts) {
  const o = S.ballOpt, n = clamp(o.n | 0, 2, 60);
  if (!pts || pts.length < 2 || Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < ballR()) { toast('Đường bay ngắn quá — kéo dài hơn một chút'); return; }
  const P = ballPlan(pts, n, o.ease), opt = { r: ballR(), obj: o.obj, hit: o.hit, trail: o.trail, spin: pts[pts.length - 1].x >= pts[0].x ? 1 : -1 };
  const r = await gagApply(S.cur, { n, pix: j => [ballItem(P, j, opt)], sfx: o.sound ? [[0, 'kick'], ...(n > 3 ? [[1, 'whoosh']] : []), ...(o.hit ? [[n - 1, 'bonk']] : [])] : [] });
  toast(`⚽ Đã cho ${BALL_OBJS[o.obj].slice(2).toLowerCase()} bay qua ${r.n} frame${r.added ? ` (thêm ${r.added} frame mới)` : ''}${r.sfx.length ? ' + tiếng sút' : ''} — bấm Phát để xem, ↶ để làm lại`, 4000);
}
// keep camera snaps sharp: a key on the frame before (its current view) so the zoom doesn't drift in slowly
const camHold = (f, cb, i) => { if (!f.cam) f.cam = { ...cb[i] }; };
const GAGS = {
  shock: { label: '😱 Sốc', hint: 'Chạm vào mặt nhân vật bị sốc', run: p => {
    const i0 = S.cur, n = 6;
    return gagApply(i0, { n,
      pix: j => j < 6 ? [animItem('fight', 'shock', j, p.x, p.y - W * 0.02, W * 0.75)] : [],
      fx: (j, f, cb) => {
        if (j === 0 && i0 > 0) camHold(S.frames[i0 - 1], cb, i0 - 1);
        if (j <= 4) f.cam = { z: Math.max(2.2, cb[i0 + j].z), x: p.x, y: p.y }; else f.cam = { ...cb[i0] };
        f.shake = [30, 20, 12, 6, 0, 0][j]; if (j === 0) f.flash = true;
        if (j >= 1 && j <= 4) { f.texts = (f.texts || []).filter(t => !t.gag); f.texts.push({ id: 'gag-shock-' + i0, gag: 1, str: '!!', x: p.x + W * 0.12, y: p.y - W * 0.2, size: 90, color: '#ffe14d', style: 'shout', rot: 8 }); }
      }, sfx: [[0, 'zap'], [1, 'boing']] });
  } },
  ballface: { label: '🤕 Bóng vào mặt', hint: 'Chạm vào mặt nhân vật — bóng sẽ bay tới đó', run: p => {
    const i0 = S.cur, r = ballR() * 1.2, fromL = p.x > W / 2, sx = fromL ? -r * 2 : W + r * 2, sy = p.y - H * 0.08;
    const pts = [{ x: sx, y: sy }, { x: (sx + p.x) / 2, y: sy - H * 0.05 }, { x: p.x, y: p.y }];
    const P = ballPlan(pts, 4, 'fast'), opt = { r, obj: 'ball', hit: true, trail: true, spin: fromL ? 1 : -1 };
    const head = p.y - W * 0.2;
    return gagApply(i0, { n: 12,
      pix: j => {
        const L = [];
        if (j < 4) L.push(ballItem(P, j, opt));
        else if (j < 8) { const t = (j - 3) / 4, bx = p.x + (fromL ? -1 : 1) * W * 0.12 * t, by = p.y + H * 0.3 * t * t - H * 0.05 * t; L.push({ rect: rectAround(bx, by, r * 1.2), draw: x => aBall(x, bx, by, r, j * (fromL ? -0.9 : 0.9)) }); }
        if (j >= 3 && j < 9) L.push(animItem('sound', 'bonk', j - 3, p.x + (fromL ? 1 : -1) * W * 0.18, p.y - W * 0.28, W * 0.42));
        if (j >= 4) L.push(animItem('dizzy', 'stars', (j - 4) % 8, p.x, head, W * 0.42));
        return L;
      },
      fx: (j, f) => { f.shake = { 3: 28, 4: 16, 5: 8 }[j] || f.shake || 0; if (j === 3) f.flash = true; },
      sfx: [[0, 'whoosh'], [3, 'bonk'], [4, 'swirl']] });
  } },
  goal: { label: '🥅 VÀO!', hint: 'Chạm vào cầu thủ ghi bàn (camera sẽ zoom vào đó)', run: p => {
    const i0 = S.cur, n = 10, seed = (Math.random() * 1e9) | 0;
    return gagApply(i0, { n,
      pix: j => [confettiItem(j, seed), ...(j < 6 ? [animItem('dizzy', 'sparkle', j, p.x, p.y - W * 0.15, W * 0.5)] : [])],
      fx: (j, f, cb) => {
        if (j === 0) { if (i0 > 0) camHold(S.frames[i0 - 1], cb, i0 - 1); f.cam = { ...cb[i0] }; f.flash = true; }
        if (j === n - 1) f.cam = { z: Math.max(1.4, cb[i0].z), x: p.x, y: p.y };
        f.shake = [22, 14, 8, 4][j] || 0;
        f.texts = (f.texts || []).filter(t => !t.gag); f.texts.push({ id: 'gag-goal-' + i0, gag: 1, str: 'VÀOOO!', x: W / 2, y: H * 0.22, size: [70, 150, 120, 130][j] || 125, color: '#ffe14d', style: 'shout', rot: j % 2 ? 4 : -4 });
      }, sfx: [[0, 'whistle'], [0, 'crowd'], [3, 'drum']] });
  } },
  dizzy: { label: '💫 Choáng', hint: 'Chạm vào đầu nhân vật', run: p => gagApply(S.cur, { n: 16,
      pix: j => [animItem('dizzy', 'stars', j % 8, p.x, p.y - W * 0.12, W * 0.42)],
      fx: (j, f) => { if (j < 3) f.shake = [12, 6, 3][j]; }, sfx: [[0, 'swirl'], [8, 'tweet']] }) },
  angry: { label: '😡 Tức điên', hint: 'Chạm vào đầu nhân vật', run: p => {
    const i0 = S.cur, n = 12;
    return gagApply(i0, { n,
      pix: j => [animItem('fight', 'steam', j % 6, p.x, p.y - W * 0.14, W * 0.5)],
      fx: (j, f, cb) => {
        if (j === 0 && i0 > 0) camHold(S.frames[i0 - 1], cb, i0 - 1);
        if (j === 0) f.cam = { ...cb[i0] }; if (j === n - 1) f.cam = { z: Math.max(1.5, cb[i0].z), x: p.x, y: p.y };
        f.shake = 7;
        if (j >= 2) { f.texts = (f.texts || []).filter(t => !t.gag); f.texts.push({ id: 'gag-angry-' + i0, gag: 1, str: 'GRRR!', x: p.x, y: p.y - W * 0.42, size: 100, color: '#ff3b3b', style: 'comic', rot: -6 }); }
      }, sfx: [[0, 'whoosh'], [6, 'whoosh']] });
  } }
};
/* --- 🎯 throw: the selected cut-out winds up and throws, a code-drawn object flies in an arc to the tapped spot
   (smaller as it goes: the target is usually further away, e.g. a TV), smashes it (cracks stay), bounces off and drops.
   Arm angles by role like the gestures, so it works for front and back views. One undo step (gagApply). --- */
function aRemote(x, cx, cy, s, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  x.beginPath(); x.roundRect(-14, -46, 28, 92, 10); aFS(x, '#2b2f36', 4);
  x.beginPath(); x.arc(0, -32, 5, 0, Math.PI * 2); x.fillStyle = '#e53935'; x.fill();
  x.fillStyle = '#9aa3ad'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { x.beginPath(); x.arc(-8 + c * 8, -14 + r * 11, 2.6, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.roundRect(-7, 30, 14, 8, 3); x.fillStyle = '#5c6670'; x.fill(); x.restore();
}
function aCan(x, cx, cy, s, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  x.beginPath(); x.roundRect(-20, -34, 40, 68, 6); aFS(x, '#e8433a', 4);
  x.beginPath(); x.rect(-20, -8, 40, 14); x.fillStyle = '#fff'; x.fill();
  x.beginPath(); x.ellipse(0, -34, 20, 5, 0, 0, Math.PI * 2); aFS(x, '#c9ced4', 3); x.restore();
}
function throwObjDraw(x, obj, cx, cy, r, rot) {   // r ≈ half the object's length
  if (obj === 'ball') aBall(x, cx, cy, r * 0.7, rot); else if (obj === 'boot') aBoot2(x, cx, cy, r / 46, rot);
  else if (obj === 'can') aCan(x, cx, cy, r / 34, rot); else aRemote(x, cx, cy, r / 46, rot);
}
// a smashed screen: a dark hole with shards, jagged cracks running out, broken rings between them (t: 0 = just hit … 1 = settled)
function aCrack(x, cx, cy, R, seed, t = 1) {
  const rnd = aRnd(seed), rays = [], n = 11, grow = 0.55 + 0.45 * Math.min(1, t * 2);
  for (let i = 0; i < n; i++) { const a = (i + rnd() * 0.7) * 2 * Math.PI / n, len = R * (0.55 + rnd() * 0.45) * grow, pts = [[cx, cy]]; let px = cx, py = cy; const k = 4 + (rnd() * 3 | 0); for (let s = 1; s <= k; s++) { const d = len * s / k, aa = a + (rnd() - 0.5) * 0.35; px = cx + Math.cos(aa) * d; py = cy + Math.sin(aa) * d; pts.push([px, py]); } rays.push(pts); }
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  const path = pts => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); };
  const lw = Math.max(2, R * 0.022);
  for (const [w, col] of [[lw * 2.6, 'rgba(255,255,255,.85)'], [lw, 'rgba(20,20,24,.9)']]) {
    x.lineWidth = w; x.strokeStyle = col;
    for (const r of rays) { path(r); x.stroke(); }
    for (const f of [0.35, 0.62]) { x.beginPath(); for (let i = 0; i < n; i++) { const a = rays[i], b = rays[(i + 1) % n], ia = Math.min(a.length - 1, Math.round(f * (a.length - 1))), ib = Math.min(b.length - 1, Math.round(f * (b.length - 1))); if (rnd() < 0.25) continue; x.moveTo(a[ia][0], a[ia][1]); x.lineTo(b[ib][0], b[ib][1]); } x.stroke(); }
  }
  x.beginPath(); for (let i = 0; i < 9; i++) { const a = i * 2 * Math.PI / 9, rr = R * (0.08 + rnd() * 0.07); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = '#0d0d10'; x.fill(); x.lineWidth = lw; x.strokeStyle = 'rgba(255,255,255,.8)'; x.stroke();
  x.restore();
}
async function gagThrow(p) {
  const o = S.ballOpt, obj = o.tobj || 'remote', i0 = S.cur, f0 = S.frames[i0]; await ensureLoaded(f0);
  const ch = S.pp && S.pp.parts.length ? ppSelChar() : null, mine = r => ch && S.pp.parts.find(q => q.role === r && ppCharOf(q) === ch);
  // throwing arm: the one whose hand is highest now (the hand holding something up), else the right arm
  const handAt = (pose, side) => { const fo = mine('fore' + side) || mine('arm' + side); if (!fo) return null; const M = ppMats(pose), t = ppTipOf(fo); return mApply(M[fo.id], t.x, t.y); };
  let side = null, start = null;
  if (ch) { const hL = handAt(ppPoseFor(f0), 'L'), hR = handAt(ppPoseFor(f0), 'R'); side = hL && (!hR || hL.y < hR.y - 1) ? 'L' : hR ? 'R' : null; if (side) start = ppCurAbs(f0, ch); }
  const arm = side && mine('arm' + side), fore = side && mine('fore' + side), torso = mine('torso');
  const RELEASE = 5, FLY = 6, HIT = RELEASE + FLY, N = HIT + 12, mir = side === 'L', mapA = a => mir ? 180 - a : a;
  // arm keys (screen angles): rest → wind-up (hand behind the head) → whip toward the target → follow-through down → rest
  const poseAt = j => {
    if (!side) return null;
    const sh = arm ? (() => { const M = ppMats(ppPoseFor(f0)); return mApply(M[arm.id], arm.px, arm.py); })() : { x: p.x, y: p.y };
    const aim = Math.atan2(p.y - sh.y, p.x - sh.x) / DEG;
    const K = [[0, start['arm' + side] ?? 90, start['fore' + side] ?? 90, 0], [3, mapA(-70), mapA(-160), -4], [RELEASE, aim, aim, 5], [RELEASE + 2, mapA(70), mapA(95), 3], [HIT + 3, start['arm' + side] ?? 90, start['fore' + side] ?? 90, 0]];
    let k = 0; while (k < K.length - 2 && j > K[k + 1][0]) k++;
    const [j0, a0, b0, t0] = K[k], [j1, a1, b1, t1] = K[k + 1], u = clamp((j - j0) / (j1 - j0), 0, 1), e = u * u * (3 - 2 * u);
    return { arm: angLerp(a0, a1, e), fore: angLerp(b0, b1, e), lean: lerp(t0, t1, e) * (mir ? -1 : 1) };
  };
  const tf = j => { const P = poseAt(j); if (!P) return null; const f = { pp: ppClone(f0.pp || {}), lip: f0.lip }; const a = {}; if (arm) a['arm' + side] = P.arm; if (fore) a['fore' + side] = P.fore; ppApplyAbs(f, a, ch); if (torso && P.lean) { const q = ppQ(f, torso.id); q.r = (q.r || 0) + P.lean; } return f; };
  const rel = side ? (handAt(ppPoseFor(tf(RELEASE)), side) || { x: W / 2, y: H }) : { x: p.x < W / 2 ? W * 0.75 : W * 0.25, y: H * 1.02 };
  const box = ch ? ppCharBox(f0) : null, R0 = box ? clamp((box.y1 - box.y0) * 0.06, W * 0.025, W * 0.07) : W * 0.045;
  const far = p.y < rel.y ? 0.6 : 0.9, lift = Math.max(H * 0.1, Math.hypot(p.x - rel.x, p.y - rel.y) * 0.35);
  const ctl = { x: (rel.x + p.x) / 2, y: Math.min(rel.y, p.y) - lift }, spinDir = p.x >= rel.x ? 1 : -1, seed = (Math.random() * 1e9) | 0;
  const at = t => ({ x: (1 - t) * (1 - t) * rel.x + 2 * (1 - t) * t * ctl.x + t * t * p.x, y: (1 - t) * (1 - t) * rel.y + 2 * (1 - t) * t * ctl.y + t * t * p.y });
  const crackR = W * 0.13 * (o.size || 1);
  const r = await gagApply(i0, { n: N, copyOf: f0,
    edit: (j, f) => {
      if (!side) return [];
      const g = tf(j), before = ppState(f); f.pp = g.pp; f.ppKey = j === 0 || j === 3 || j === RELEASE || j === RELEASE + 2 || j === HIT + 3 || j === N - 1;
      const after = ppState(f); if (JSON.stringify(after) === JSON.stringify(before)) return []; f.ver++; return [ppEntry(f, before, after)];
    },
    pix: j => {
      const L = [];
      if (o.crack !== false && j >= HIT) L.push({ rect: rectAround(p.x, p.y, crackR * 1.05), draw: x => aCrack(x, p.x, p.y, crackR, seed, (j - HIT) / 2) });
      if (j >= RELEASE && j < HIT) {   // flying: arc, spinning, getting smaller, with a speed trail
        const t = (j - RELEASE + 1) / FLY, q = at(t), q0 = at(Math.max(0, t - 1 / FLY)), rr = R0 * lerp(1, far, t), rot = spinDir * t * Math.PI * 3.2;
        L.push({ rect: rectUnion(rectAround(q.x, q.y, rr * 1.6), rectAround(q0.x, q0.y, rr)), draw: x => {
          x.save(); x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = rr * 0.35; x.beginPath(); x.moveTo(q0.x, q0.y); x.lineTo(lerp(q0.x, q.x, 0.7), lerp(q0.y, q.y, 0.7)); x.stroke(); x.strokeStyle = 'rgba(27,27,27,.45)'; x.lineWidth = rr * 0.12; x.stroke(); x.restore();
          throwObjDraw(x, obj, q.x, q.y, rr, rot);
        } });
      }
      if (j === HIT || j === HIT + 1) L.push({ rect: rectAround(p.x, p.y, R0 * 3), draw: x => aBurst(x, p.x, p.y, R0 * (j === HIT ? 2.6 : 1.8), R0 * 1.1, 10, j === HIT ? '#fff3a0' : '#ffd21f', seed % 6, Math.max(3, R0 * 0.08)) });
      if (j > HIT && j <= HIT + 5) {   // bounce off and drop
        const u = (j - HIT) / 5, bx = p.x - spinDir * R0 * 2.2 * u, by = p.y - R0 * 1.5 * u + H * 0.22 * u * u;
        L.push({ rect: rectAround(bx, by, R0 * far * 1.6), draw: x => throwObjDraw(x, obj, bx, by, R0 * far, spinDir * (3.2 + u * 2.5) * Math.PI) });
      }
      return L;
    },
    fx: (j, f) => {
      if (j < HIT) return false;
      f.shake = { [HIT]: 26, [HIT + 1]: 16, [HIT + 2]: 9, [HIT + 3]: 4 }[j] || 0; if (j === HIT) f.flash = true;
      if (j >= HIT && j < HIT + 5) { f.texts = (f.texts || []).filter(t => !t.gag); f.texts.push({ id: 'gag-throw-' + i0, gag: 1, str: obj === 'ball' || obj === 'boot' ? 'BỐP!' : 'XOẢNG!', x: clamp(p.x, W * 0.25, W * 0.75), y: Math.max(H * 0.1, p.y - crackR * 1.3), size: j === HIT ? 120 : 100, color: '#ffe14d', style: 'shout', rot: j % 2 ? 6 : -6 }); }
      else f.texts = (f.texts || []).filter(t => t.id !== 'gag-throw-' + i0);
    },
    sfx: o.sound === false ? [] : [[RELEASE, 'whoosh'], [HIT, o.crack !== false && obj !== 'ball' ? 'crash' : 'bonk'], [HIT, 'bang']] });
  if (side) { ppRetween(); ppSyncBar(); }
  if (!side && ch == null) toast('Chưa có nhân vật ghép nên vật bay từ dưới khung lên — muốn nhân vật vung tay: Nhập ảnh → Nhân vật ghép', 4500);
  return r;
}
/* --- 📸 Paparazzi: many small camera flashes pop at random spots around the character over N frames (star bursts with a
   soft glow, each lives 2 frames: peak then fading), optional full-screen white flash, shutter clicks. One undo step (gagApply). --- */
const PAP0 = { n: 12, k: 2, white: false, snd: true };
const papOpt = () => (S.ballOpt.pap = { ...PAP0, ...(S.ballOpt.pap || {}) });
// one camera flash at (cx, cy), size r; t = 0 peak, 1 fading afterglow; rot turns the long spikes a little
function aFlashPop(x, cx, cy, r, t = 0, rot = 0) {
  const k = t ? 0.6 : 1, R = r * k;
  x.save(); x.globalAlpha = t ? 0.6 : 1;
  // warm core, blue rim: reads on white paper as well as on a dark background
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,246,190,.95)'); g.addColorStop(0.5, 'rgba(255,214,90,.55)'); g.addColorStop(0.75, 'rgba(120,190,255,.3)'); g.addColorStop(1, 'rgba(120,190,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R * 1.6, 0, Math.PI * 2); x.fill();
  // lens star: 4 long + 4 short tapered spikes, white with a thin ink outline
  x.translate(cx, cy); x.rotate(rot); x.beginPath();
  for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, L = i % 2 ? R * 0.2 : i % 4 ? R * 1.15 : R * 2.5; x.lineTo(Math.cos(an) * L, Math.sin(an) * L); }
  x.closePath(); x.fillStyle = '#fff'; x.fill(); x.lineJoin = 'round'; x.lineWidth = Math.max(1.5, R * 0.05); x.strokeStyle = 'rgba(40,70,120,.85)'; x.stroke();
  x.beginPath(); x.arc(0, 0, R * 0.22, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
  x.restore();
}
// where the flashes go: a ring around the character (or around the tapped spot), mostly just outside its outline
function papSpots(box, n, k, seed) {
  const R = aRnd(seed), cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, rx = (box.x1 - box.x0) / 2 + W * 0.1, ry = (box.y1 - box.y0) / 2 + W * 0.08;
  const per = [[1, 2], [2, 4], [3, 6]][clamp(k | 0, 1, 3) - 1], out = [];
  for (let j = 0; j < n; j++) {
    const m = per[0] + Math.floor(R() * (per[1] - per[0] + 1));
    for (let i = 0; i < m; i++) {
      const a = R() * Math.PI * 2, d = 0.8 + R() * 0.4;
      out.push({ j, x: clamp(cx + Math.cos(a) * rx * d, W * 0.04, W * 0.96), y: clamp(cy + Math.sin(a) * ry * d, H * 0.03, H * 0.97), r: W * (0.03 + R() * 0.04), rot: R() * 0.8 });
    }
  }
  return out;
}
async function gagPaparazzi(p) {
  const o = papOpt(), i0 = S.cur, n = clamp(o.n | 0, 2, 60), seed = (Math.random() * 1e9) | 0;
  let box = await camSubject(S.frames[i0]);
  if (!box || p.x < box.x0 - W * 0.1 || p.x > box.x1 + W * 0.1 || p.y < box.y0 - W * 0.1 || p.y > box.y1 + W * 0.1) box = { x0: p.x - W * 0.18, x1: p.x + W * 0.18, y0: p.y - W * 0.3, y1: p.y + W * 0.3 };
  const spots = papSpots(box, n, o.k, seed);
  // a burst of clicks about every second (frames that don't exist yet will be copies of the last one: same length)
  const durAt = j => (S.frames[i0 + j] || S.frames[S.frames.length - 1]).dur, sfx = [];
  if (o.snd) { let t = 0, next = 0; for (let j = 0; j < n; j++) { if (t >= next) { if (!j) sfx.push([j, 'shutter']); sfx.push([j, 'snaps']); next += 1000; } t += durAt(j); } }
  return gagApply(i0, { n,
    pix: j => spots.filter(s => s.j === j || s.j === j - 1).map(s => ({ rect: rectAround(s.x, s.y, s.r * 2.5), draw: x => aFlashPop(x, s.x, s.y, s.r, s.j === j ? 0 : 1, s.rot) })),
    fx: (j, f) => { if (!o.white || j % 4) return false; f.flash = true; },
    sfx });
}
GAGS.paparazzi = { label: '📸 Paparazzi', hint: 'Chạm vào nhân vật được chụp ảnh — đèn flash sẽ nháy quanh người', run: p => gagPaparazzi(p) };
GAGS.throw = { label: '🎯 Ném vật', hint: 'Chạm vào chỗ muốn ném trúng (vd. màn hình TV)', run: p => gagThrow(p) };
async function gagRun(key, p) {
  const G = GAGS[key]; if (!G) return;
  const r = await G.run(p);
  toast(`${G.label}: xong ${r.n} frame${r.added ? ` (thêm ${r.added} frame mới)` : ''} — bấm Phát để xem, ↶ Hoàn tác nếu chưa ưng`, 4000);
}
function ballModeSet(on) { ballMode = on ? { pts: null } : null; if (on) gagMode = null; ballSyncBar(); requestRender(); if (on) toast('Kéo 1 ngón/bút vẽ đường bay: từ chỗ sút → chỗ bóng tới', 3500); }
function gagModeSet(key) { gagMode = gagMode === key ? null : key; if (gagMode) { ballMode = null; toast(GAGS[key].hint, 3500); } ballSyncBar(); requestRender(); }
function ballSyncBar() {
  const o = S.ballOpt; if (!$('#ballGo')) return;
  $('#ballGo').classList.toggle('on', !!ballMode); $('#ballN').value = o.n;
  document.querySelectorAll('[data-bobj]').forEach(b => b.classList.toggle('on', b.dataset.bobj === o.obj));
  document.querySelectorAll('[data-bease]').forEach(b => b.classList.toggle('on', b.dataset.bease === o.ease));
  $('#ballHit').classList.toggle('on', !!o.hit); $('#ballTrail').classList.toggle('on', !!o.trail); $('#ballSnd').classList.toggle('on', !!o.sound); $('#ballSize').value = o.size;
  document.querySelectorAll('[data-gag]').forEach(b => b.classList.toggle('active', b.dataset.gag === gagMode));
  document.querySelectorAll('[data-tobj]').forEach(b => b.classList.toggle('on', b.dataset.tobj === (o.tobj || 'remote'))); $('#thrCrack').classList.toggle('on', o.crack !== false);
  const pp = papOpt(); if ($('#papN')) { $('#papN').value = pp.n; document.querySelectorAll('[data-papk]').forEach(b => b.classList.toggle('on', +b.dataset.papk === pp.k)); $('#papWhite').classList.toggle('on', !!pp.white); $('#papSnd').classList.toggle('on', !!pp.snd); }
}
function renderBallPath(c, px) {
  if (!ballMode || !ballMode.pts || ballMode.pts.length < 2) return;
  const pts = ballMode.pts; c.save(); c.lineWidth = 3 * px; c.setLineDash([12 * px, 8 * px]); c.strokeStyle = '#ffb21e';
  c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); c.setLineDash([]);
  const P = ballPlan(pts, clamp(S.ballOpt.n | 0, 2, 60), S.ballOpt.ease), r = ballR();
  c.globalAlpha = 0.45; for (const q of P) { c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#111'; c.stroke(); }
  c.restore();
}
function ballWire() {
  $('#ballGo').addEventListener('click', () => ballModeSet(!ballMode));
  $('#ballN').addEventListener('change', e => { S.ballOpt.n = clamp(Math.round(+e.target.value || 8), 2, 60); saveSettings(); ballSyncBar(); });
  $('#ballSize').addEventListener('input', e => { S.ballOpt.size = +e.target.value; saveSettings(); requestRender(); });
  document.querySelectorAll('[data-bobj]').forEach(b => b.addEventListener('click', () => { S.ballOpt.obj = b.dataset.bobj; saveSettings(); ballSyncBar(); }));
  document.querySelectorAll('[data-bease]').forEach(b => b.addEventListener('click', () => { S.ballOpt.ease = b.dataset.bease; saveSettings(); ballSyncBar(); requestRender(); }));
  for (const [id, k] of [['#ballHit', 'hit'], ['#ballTrail', 'trail'], ['#ballSnd', 'sound']]) $(id).addEventListener('click', () => { S.ballOpt[k] = !S.ballOpt[k]; saveSettings(); ballSyncBar(); });
  document.querySelectorAll('[data-gag]').forEach(b => b.addEventListener('click', () => gagModeSet(b.dataset.gag)));
  document.querySelectorAll('[data-tobj]').forEach(b => b.addEventListener('click', () => { S.ballOpt.tobj = b.dataset.tobj; saveSettings(); ballSyncBar(); }));
  $('#thrCrack').addEventListener('click', () => { S.ballOpt.crack = !S.ballOpt.crack; saveSettings(); ballSyncBar(); });
  $('#papN').addEventListener('change', e => { papOpt().n = clamp(Math.round(+e.target.value || 12), 2, 60); saveSettings(); ballSyncBar(); });
  document.querySelectorAll('[data-papk]').forEach(b => b.addEventListener('click', () => { papOpt().k = +b.dataset.papk; saveSettings(); ballSyncBar(); }));
  for (const [id, k] of [['#papWhite', 'white'], ['#papSnd', 'snd']]) $(id).addEventListener('click', () => { const q = papOpt(); q[k] = !q[k]; saveSettings(); ballSyncBar(); });
}

