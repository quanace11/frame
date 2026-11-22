/* ========= IK & aiming ========= */
function ppTipOf(p) {
  if (p.tip) return p.tip;
  // farthest solid pixel from the pivot (rest space)
  const a = ppAlphaH(p), w = p.c.width; let best = { x: p.px, y: p.py }, bd = -1;
  for (let y = 0; y < p.c.height; y += 2) for (let x = 0; x < w; x += 2) if (a[y * w + x] > 100) { const X = p.ox + x, Y = p.oy + y, d = Math.hypot(X - p.px, Y - p.py); if (d > bd) { bd = d; best = { x: X, y: Y }; } }
  p.tip = best; return best;
}
const LOWER = { foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR' };
function ppIKDrag(part, target, f) {
  const M = ppMats(ppPoseFor(f)), qOf = p => ppQ(f, p.id), wrap = wrapRad;
  const up = part.parent && ppPart(part.parent);
  if (LOWER[part.role] && up && up.role === LOWER[part.role]) {
    const S0 = mApply(M[up.id], up.px, up.py), E0 = mApply(M[part.id], part.px, part.py), tip = ppTipOf(part), H0 = mApply(M[part.id], tip.x, tip.y);
    const L1 = Math.hypot(E0.x - S0.x, E0.y - S0.y), L2 = Math.hypot(H0.x - E0.x, H0.y - E0.y); if (L1 < 2 || L2 < 2) return;
    const d = clamp(Math.hypot(target.x - S0.x, target.y - S0.y), Math.abs(L1 - L2) + 0.5, L1 + L2 - 0.5);
    const base = Math.atan2(target.y - S0.y, target.x - S0.x), A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const cross = (E0.x - S0.x) * (H0.y - E0.y) - (E0.y - S0.y) * (H0.x - E0.x), sgn = cross >= 0 ? 1 : -1;
    const th1 = base - sgn * A, E1 = { x: S0.x + L1 * Math.cos(th1), y: S0.y + L1 * Math.sin(th1) }, th2 = Math.atan2(target.y - E1.y, target.x - E1.x);
    const d1 = wrap(th1 - Math.atan2(E0.y - S0.y, E0.x - S0.x)), d2 = wrap(th2 - (Math.atan2(H0.y - E0.y, H0.x - E0.x) + d1));
    qOf(up).r = (qOf(up).r || 0) + d1 / DEG; qOf(part).r = (qOf(part).r || 0) + d2 / DEG;
  } else {
    const P0 = mApply(M[part.id], part.px, part.py), tip = ppTipOf(part), H0 = mApply(M[part.id], tip.x, tip.y);
    const dd = wrap(Math.atan2(target.y - P0.y, target.x - P0.x) - Math.atan2(H0.y - P0.y, H0.x - P0.x));
    qOf(part).r = (qOf(part).r || 0) + dd / DEG;
  }
}

