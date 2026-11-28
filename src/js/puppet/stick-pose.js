/* ===== ✏ Vẽ người que → nhân vật vào dáng (stick-figure posing) =====
   For people who can't draw: scribble a stick figure over a cut-out character and it takes that pose.
   Each stroke is matched to the nearest limb of the nearest character: an arm / leg (starts near the shoulder / hip,
   bent strokes bend the elbow / knee at the sharpest corner), the body (hips → neck: the whole character leans,
   feet keep their screen angle), or the head (a line from the neck, or a circle where the head should be).
   Every stroke is 1 undo step (ppKeyEdit) and makes this frame a keyframe, so tweening, 🌊 Phát mượt,
   🫠 / 🫨 and the layer timeline all keep working. `tests/test_ve_nguoi_que.py`. */
let skMode = false, skCur = null, skDone = { fid: null, list: [] };
const SK_COL = { armL: '#ffb21e', legL: '#ffb21e', armR: '#00c7be', legR: '#00c7be', torso: '#ff3b9a', head: '#ff3b9a' };
function skSet(on) {
  if (!S.pp || !S.pp.parts.some(p => !p.parent)) { skMode = false; skSync(); toast('Cần nhân vật ghép trước: ⚽ Cầu thủ mẫu, 🧍 Kho nhân vật, hoặc Nhập ảnh → Nhân vật ghép', 4000); return; }
  skMode = on == null ? !skMode : on;
  if (skMode) {
    if (playing) stopPlay(); if (S.tool !== 'puppet') setTool('puppet');
    ppPathMode = ppCutMode = ppPatchMode = false; ppPaint = null;
    if (jgMode) { jgMode = false; jgSync(); } if (bwMode) { bwMode = false; bwSync(); }
    if (typeof ppJEOn === 'function' && ppJEOn()) $('#ppJointBtn').click();
    toast('Vẽ mỗi tay / chân 1 nét từ vai / hông ra (gập ở khuỷu / gối thì vẽ gập), 1 nét hông → cổ = nghiêng người, vòng tròn = hướng đầu. Vẽ xong nét nào nhân vật vào dáng nét đó', 6000);
  }
  skCur = null; skSync(); requestRender();
}
function skSync() {
  const b = document.getElementById('skBtn'); if (!b) return;
  b.textContent = skMode ? '✓ Xong que' : '✏ Người que'; b.classList.toggle('on', skMode);
}
function skStart(p, base) { skCur = [p]; action = { ...base, kind: 'ppsk' }; requestRender(); }
function skMove(p) { const l = skCur && skCur[skCur.length - 1]; if (l && Math.hypot(p.x - l.x, p.y - l.y) > 2 / vs) { skCur.push(p); requestRender(); } }
function skEnd() { const pts = skCur; skCur = null; if (pts) skStroke(pts); requestRender(); }
/* world points of one character's chains on frame f */
function skChains(f, ch) {
  const parts = S.pp.parts.filter(p => (ppCharOf(p) || p.id) === ch), by = r => parts.find(p => p.role === r);
  const P = ppPoseFor(f); if (P && P[ch] && P[ch].h) return null;
  const off = lyrOff('lh'); if (off && off.has(ch)) return null;
  const M = ppMats(P), w = (p, x, y) => mApply(M[p.id], x, y), piv = p => w(p, p.px, p.py), tip = p => { const t = ppTipOf(p); return w(p, t.x, t.y); };
  const out = {};
  for (const sd of ['L', 'R']) for (const [k, up, lo] of [['arm', 'arm', 'fore'], ['leg', 'leg', 'shin']]) {
    const a = by(up + sd), b = by(lo + sd); if (!a) continue;
    out[k + sd] = { kind: 'limb', up: a, lo: b && b.parent === a.id ? b : null, at: piv(a), far: b && b.parent === a.id ? tip(b) : tip(a) };
  }
  const head = by('head'), tor = by('torso');
  const mid = (u, v) => u && v ? { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 } : u || v;
  const hip = mid(out.legL && out.legL.at, out.legR && out.legR.at), neck = head ? piv(head) : mid(out.armL && out.armL.at, out.armR && out.armR.at);
  if (tor && hip && neck && Math.hypot(neck.x - hip.x, neck.y - hip.y) > 4) out.torso = { kind: 'torso', p: tor, at: hip, far: neck };
  if (head && head.c) out.head = { kind: 'head', p: head, at: piv(head), far: w(head, head.ox + head.c.width / 2, head.oy + head.c.height / 2) };
  // body size, to make distances comparable between big and small characters
  const sz = out.torso ? Math.hypot(out.torso.far.x - out.torso.at.x, out.torso.far.y - out.torso.at.y) : head && head.c ? head.c.height * Math.hypot(M[head.id][0], M[head.id][1]) : 120;
  out.sz = Math.max(40, sz);
  return out;
}
/* which character + chain a stroke is meant for */
function skPick(f, pts) {
  const A = pts[0], B = pts[pts.length - 1], len = pts.reduce((s, q, i) => i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0, 0);
  const closed = pts.length > 8 && Math.hypot(A.x - B.x, A.y - B.y) < len * 0.25;
  const C = closed ? pts.reduce((s, q) => ({ x: s.x + q.x / pts.length, y: s.y + q.y / pts.length }), { x: 0, y: 0 }) : null;
  const done = skDone.fid === f.id ? skDone.list : [];
  let best = null;
  for (const root of S.pp.parts.filter(p => !p.parent && p.c)) {
    const ch = skChains(f, root.id); if (!ch) continue; const L = ch.sz;
    for (const [k, c] of Object.entries(ch)) {
      if (k === 'sz') continue;
      let cost, rev = false;
      if (closed) { if (k !== 'head') continue; cost = Math.hypot(C.x - c.far.x, C.y - c.far.y) / L; }
      else {
        const dA = Math.hypot(A.x - c.at.x, A.y - c.at.y), dB = Math.hypot(B.x - c.at.x, B.y - c.at.y); rev = dB < dA;
        const far = rev ? A : B;
        cost = Math.min(dA, dB) / L + 0.12 * Math.hypot(far.x - c.far.x, far.y - c.far.y) / L;
        if (k === 'torso') { const dA2 = Math.hypot(A.x - c.far.x, A.y - c.far.y), dB2 = Math.hypot(B.x - c.far.x, B.y - c.far.y), alt = Math.min(dA2, dB2) / L + 0.12 * Math.min(dA, dB) / L; if (alt < cost) { cost = alt; rev = dA2 < dB2; rev = !rev; } }   // drawn neck → hips
        // the 2nd stroke from the shoulders goes to the other arm (until both are drawn: then redrawing one is fine)
        const twin = /L$/.test(k) ? k.replace(/L$/, 'R') : /R$/.test(k) ? k.replace(/R$/, 'L') : null, did = kk => done.some(d => d.ch === root.id && d.k === kk);
        if (twin && ch[twin] && did(k) && !did(twin)) cost += 0.6;
        // about as long as that limb / the body
        cost += 0.15 * Math.abs(len - Math.hypot(c.far.x - c.at.x, c.far.y - c.at.y)) / L;
      }
      if (!best || cost < best.cost) best = { cost, ch: root.id, k, c, rev, C };
    }
  }
  return best && best.cost < 2.5 ? best : null;
}
/* turn part p so the screen direction from point fn().a to fn().b becomes `ang` (radians); works when a flip mirrors rotation */
function skAim(f, p, ang, fn) {
  const cur = () => { const v = fn(); return Math.atan2(v.b.y - v.a.y, v.b.x - v.a.x); };
  const q = ppQ(f, p.id), r0 = q.r || 0, dd = wrapRad(ang - cur()) / DEG;
  q.r = r0 + dd; if (Math.abs(wrapRad(ang - cur())) > 0.05) { q.r = r0 - dd; if (Math.abs(wrapRad(ang - cur())) > 0.05) q.r = r0 + dd; }
}
function skLimbAngles(pts) {
  const A = pts[0], B = pts[pts.length - 1], ch = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  let bi = -1, bd = 0;
  for (let i = 1; i < pts.length - 1; i++) { const q = pts[i], d = Math.abs((B.x - A.x) * (A.y - q.y) - (A.x - q.x) * (B.y - A.y)) / ch; if (d > bd) { bd = d; bi = i; } }
  const a0 = Math.atan2(B.y - A.y, B.x - A.x);
  if (bi < 0 || bd < ch * 0.12) return [a0, a0];
  const K = pts[bi]; return [Math.atan2(K.y - A.y, K.x - A.x), Math.atan2(B.y - K.y, B.x - K.x)];
}
function skStroke(pts) {
  const f = curFrame(); if (pts.length < 2) return;
  const len = pts.reduce((s, q, i) => i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0, 0);
  if (len < 14 * DPR / vs) return;
  const m = skPick(f, pts); if (!m) { toast('Nét này xa nhân vật quá: bắt đầu vẽ từ vai, hông hoặc cổ', 2500); return; }
  const P = m.rev ? pts.slice().reverse() : pts, A = P[0], B = P[P.length - 1];
  ppSel = m.k === 'torso' || m.k === 'head' ? m.c.p.id : m.c.up.id;   // ppKeyEdit makes the selected character's layer a keyframe
  ppKeyEdit(fr => {
    fr.ppKey = true;
    const M = () => ppMats(ppPoseFor(fr)), w = (p, x, y) => mApply(M()[p.id], x, y);
    if (m.k === 'torso') {
      const legs = {}; const abs = ppCurAbs(fr, m.ch); for (const r of ['legL', 'legR', 'shinL', 'shinR']) if (abs[r] != null) legs[r] = abs[r];
      skAim(fr, m.c.p, Math.atan2(B.y - A.y, B.x - A.x), () => { const c = skChains(fr, m.ch); return { a: c.torso.at, b: c.torso.far }; });
      if (Object.keys(legs).length && !m.c.p.parent) ppApplyAbs(fr, legs, m.ch);   // the root turned: the feet stay on the ground
    } else if (m.k === 'head') {
      const h = m.c.p, to = m.C || B, from = m.C ? w(h, h.px, h.py) : A;
      skAim(fr, h, Math.atan2(to.y - from.y, to.x - from.x), () => ({ a: w(h, h.px, h.py), b: w(h, h.ox + h.c.width / 2, h.oy + h.c.height / 2) }));
    } else {
      const { up, lo } = m.c, [a1, a2] = lo ? skLimbAngles(P) : [Math.atan2(B.y - A.y, B.x - A.x)];
      const end = p => ppTipOf(p);
      skAim(fr, up, a1, () => ({ a: w(up, up.px, up.py), b: lo ? w(up, lo.px, lo.py) : (t => w(up, t.x, t.y))(end(up)) }));
      if (lo) skAim(fr, lo, a2, () => ({ a: w(lo, lo.px, lo.py), b: (t => w(lo, t.x, t.y))(end(lo)) }));
    }
  });
  if (skDone.fid !== f.id) skDone = { fid: f.id, list: [] };
  skDone.list = skDone.list.filter(d => !(d.ch === m.ch && d.k === m.k)); skDone.list.push({ ch: m.ch, k: m.k, pts: P });
  scheduleSave();
}
function skDraw(c, f, px) {
  ppDrawBones(c, f, px);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts, col, a) => { c.globalAlpha = a; c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 9 * px; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); c.strokeStyle = col; c.lineWidth = 5 * px; c.stroke(); };
  if (skDone.fid === f.id) for (const d of skDone.list) line(d.pts, SK_COL[d.k] || '#fff', 0.55);
  if (skCur && skCur.length > 1) line(skCur, '#fff', 0.95);
  c.restore();
}
$('#skBtn').addEventListener('click', () => skSet());
document.querySelectorAll('[data-ppd]').forEach(b => b.addEventListener('click', () => { if (skMode) skSet(false); }));
