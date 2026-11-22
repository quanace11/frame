/* ===== animated cartoon effects (dizzy stars, fight cloud, sound words): each item is a short loop of frames, all drawn in code, original ===== */
function aFS(x, col, lw = 6) { x.fillStyle = col; x.fill(); aInk(x, lw); x.stroke(); }
function aRnd(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function aBurst(x, cx, cy, r1, r2, n, col, rot = 0, lw) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r2 : r1 * (0.82 + 0.18 * ((i * 7) % 5) / 4); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); aFS(x, col, lw || Math.max(4, r1 * 0.06)); }
function aWord(x, s, cx, cy, size, col, lw, rot = 0, sx = 1) { x.save(); x.translate(cx, cy); x.rotate(rot); const m = x.getTransform(); if (m.a * m.d - m.b * m.c < 0) x.scale(-1, 1); x.scale(sx, 1); x.font = `900 ${size}px "Arial Black",Impact,system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = lw * 1.9; x.strokeStyle = AINK; x.strokeText(s, size * 0.05, size * 0.07); x.fillStyle = AINK; x.fillText(s, size * 0.05, size * 0.07); x.lineWidth = lw; x.strokeText(s, 0, 0); x.fillStyle = col; x.fillText(s, 0, 0); x.restore(); }
function aPuffs(x, list, col, lw) { x.beginPath(); for (const [cx, cy, r] of list) { x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, Math.PI * 2); } x.fillStyle = col; x.fill(); aInk(x, lw); x.stroke(); x.fillStyle = col; for (const [cx, cy, r] of list) { x.beginPath(); x.arc(cx, cy, Math.max(1, r - lw * 0.55), 0, Math.PI * 2); x.fill(); } }
function aBird(x, cx, cy, s, flap, dir = 1) { x.save(); x.translate(cx, cy); x.scale(s * dir, s); x.beginPath(); x.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2); aFS(x, '#ffd84a', 4); x.beginPath(); x.moveTo(20, -4); x.lineTo(34, 2); x.lineTo(20, 7); x.closePath(); aFS(x, '#ff8a1f', 3); x.beginPath(); x.ellipse(-4, flap ? -14 : 6, 12, 7, flap ? -0.6 : 0.5, 0, Math.PI * 2); aFS(x, '#ffc21f', 3.5); x.beginPath(); x.arc(9, -5, 3.5, 0, Math.PI * 2); x.fillStyle = AINK; x.fill(); x.restore(); }
function aFist(x, cx, cy, s, rot, col = '#ffd9b8', sleeve = '#e8302f') { x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s); x.beginPath(); x.roundRect(-70, -16, 50, 32, 6); aFS(x, sleeve, 5); x.beginPath(); x.roundRect(-24, -26, 50, 52, 18); aFS(x, col, 5); aInk(x, 3.5); x.beginPath(); for (const y of [-12, 1, 14]) { x.moveTo(12, y); x.lineTo(26, y); } x.moveTo(-14, -26); x.quadraticCurveTo(-4, -8, 10, -10); x.stroke(); x.restore(); }
function aBoot2(x, cx, cy, s, rot) { x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s); x.beginPath(); x.roundRect(-64, -14, 40, 28, 4); aFS(x, '#2a6ee0', 5); x.beginPath(); x.moveTo(-26, -20); x.lineTo(4, -20); x.quadraticCurveTo(8, -6, 26, -4); x.quadraticCurveTo(42, 0, 40, 18); x.lineTo(-26, 18); x.closePath(); aFS(x, '#3a2a20', 5); x.restore(); }
const AN = (n, sfx) => ({ n, sfx });
/* scale/rotation curve for a word that pops in, overshoots and settles */
const POP_S = [0.25, 1.3, 0.92, 1.08, 1, 1], POP_R = [-0.3, 0.14, -0.07, 0.03, 0, 0];
function aPopWord(x, o, W0, H0, fn) { const t = Math.min(o.t | 0, 5), s = POP_S[t] * 0.66; x.save(); x.translate(W0 / 2, H0 / 2); x.rotate(POP_R[t]); x.scale(s, s); x.translate(-W0 / 2, -H0 / 2); fn(x, t); x.restore(); }
const WORDS = {
  pow: ['POW!', 'punch', (x, t) => { aBurst(x, 180, 130, 160, 92, 12, '#ffd21f', 0.1); aWord(x, 'POW!', 180, 134, 96, '#ff2a3d', 9, -0.1); }],
  bam: ['BAM!', 'punch', (x, t) => { aBurst(x, 180, 130, 160, 100, 9, '#ff7a1a', 0.4); aBurst(x, 180, 130, 120, 76, 9, '#ffe14d', 0.6); aWord(x, 'BAM!', 180, 134, 92, '#fff', 9, 0.08); }],
  boom: ['BOOM!', 'boom', (x, t) => { aPuffs(x, [[90, 150, 70], [170, 100, 90], [260, 140, 76], [200, 180, 64], [120, 190, 54]], '#ff5a3d', 8); aPuffs(x, [[140, 140, 50], [200, 120, 56], [240, 160, 40]], '#ffd21f', 6); aWord(x, 'BOOM!', 180, 140, 80, '#fff', 8, -0.06); }],
  wham: ['WHAM!', 'slap', (x, t) => { aBurst(x, 180, 130, 170, 70, 7, '#3a8fff', -0.2); aWord(x, 'WHAM!', 180, 132, 80, '#fff', 8, 0.12); }],
  bonk: ['BONK!', 'bonk', (x, t) => { x.beginPath(); x.ellipse(180, 130, 150, 92, -0.05, 0, Math.PI * 2); aFS(x, '#7ee06a', 8); aWord(x, 'BONK!', 180, 132, 84, '#fff', 8, -0.08); aStar(x, 46, 40, 22, '#ffd21f'); aStar(x, 320, 220, 18, '#ffd21f'); }],
  kapow: ['KAPOW!', 'bang', (x, t) => { aBurst(x, 180, 130, 176, 108, 14, '#ff2a3d', 0); aBurst(x, 180, 130, 140, 92, 14, '#ffd21f', 0.2); aWord(x, 'KAPOW!', 180, 134, 66, '#ff2a3d', 8, -0.12); }],
  smack: ['SMACK!', 'slap', (x, t) => { x.beginPath(); x.roundRect(30, 60, 300, 140, 26); x.save(); x.translate(180, 130); x.rotate(-0.08); x.translate(-180, -130); aFS(x, '#ff6fa8', 8); x.restore(); aWord(x, 'SMACK!', 180, 132, 66, '#fff', 7, -0.08); }],
  crash: ['CRASH!', 'crash', (x, t) => { aBurst(x, 180, 130, 168, 60, 10, '#b8c0ca', 0.3); aInk(x, 5); x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; x.moveTo(180 + Math.cos(a) * 40, 130 + Math.sin(a) * 30); x.lineTo(180 + Math.cos(a + 0.2) * 110, 130 + Math.sin(a + 0.2) * 80); } x.stroke(); aWord(x, 'CRASH!', 180, 132, 70, '#ffd21f', 8, 0.1); }],
  zap: ['ZAP!', 'zap', (x, t) => { x.beginPath(); x.moveTo(200, 0); x.lineTo(90, 150); x.lineTo(170, 150); x.lineTo(120, 260); x.lineTo(280, 100); x.lineTo(196, 100); x.lineTo(250, 0); x.closePath(); aFS(x, '#ffe14d', 8); aWord(x, 'ZAP!', 180, 130, 86, '#2a6ee0', 8, 0.15); }],
  whoosh: ['WHOOSH', 'whoosh', (x, t) => { aInk(x, 9); x.beginPath(); for (const [y, a, b] of [[70, 10, 120], [130, 0, 80], [190, 20, 110]]) { x.moveTo(a, y); x.lineTo(b, y); } x.stroke(); aWord(x, 'WHOOSH', 210, 130, 64, '#8fe3ff', 7, -0.05, 0.9); }],
  ouch: ['OUCH!', 'bonk', (x, t) => { aBurst(x, 180, 130, 150, 104, 16, '#fff', 0, 7); aWord(x, 'OUCH!', 180, 132, 80, '#ff2a3d', 8, 0.1); aStar(x, 40, 220, 20, '#ffd21f'); aStar(x, 330, 40, 24, '#ffd21f'); }],
  boing: ['BOING!', 'boing', (x, t) => { aInk(x, 7); x.beginPath(); for (let i = 0; i <= 60; i++) x.lineTo(30 + i * 5, 220 + Math.sin(i / 60 * Math.PI * 8) * 16); x.stroke(); const s = 'BOING!'; [...s].forEach((ch, i) => aWord(x, ch, 50 + i * 52, 120 + Math.sin(i * 1.3 + t * 1.6) * 22, 74, '#b06bff', 7, (i % 2 ? 0.12 : -0.12))); }],
  splat: ['SPLAT!', 'splat', (x, t) => { const r = aRnd(5); x.beginPath(); for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, rr = i % 2 ? 90 + r() * 20 : 120 + r() * 50; x.lineTo(180 + Math.cos(a) * rr * 1.3, 130 + Math.sin(a) * rr * 0.85); } x.closePath(); aFS(x, '#7fdc3a', 8); for (const [cx, cy, rr] of [[30, 40, 14], [340, 60, 12], [40, 230, 10], [320, 230, 16]]) { x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); aFS(x, '#7fdc3a', 5); } aWord(x, 'SPLAT!', 180, 132, 70, '#fff', 8, -0.1); }],
  bang: ['BANG!', 'bang', (x, t) => { aBurst(x, 180, 130, 170, 88, 11, '#fff', 0.25, 8); aBurst(x, 180, 130, 130, 74, 11, '#ff2a3d', 0.1); aWord(x, 'BANG!', 180, 134, 84, '#ffd21f', 9, -0.06); }],
  oops: ['OOPS!', 'slide', (x, t) => { x.beginPath(); x.ellipse(180, 120, 150, 86, 0, 0, Math.PI * 2); x.moveTo(110, 190); aFS(x, '#fff', 8); x.beginPath(); x.moveTo(110, 186); x.lineTo(70, 250); x.lineTo(150, 196); x.fillStyle = '#fff'; x.fill(); aInk(x, 8); x.stroke(); x.beginPath(); x.ellipse(180, 120, 146, 82, 0, 0.4, 2.4); x.strokeStyle = '#fff'; x.lineWidth = 10; x.stroke(); aWord(x, 'OOPS!', 180, 122, 78, '#ff8a1f', 8, 0.06); }],
  haha: ['HAHA', 'pop', (x, t) => { aWord(x, 'HA', 110, 90 - (t % 2) * 10, 92, '#ffd21f', 9, -0.2); aWord(x, 'HA', 250, 170 + (t % 2) * 10, 92, '#ffd21f', 9, 0.18); }]
};
function aDizzyStars(x, o) { const t = o.t | 0, n = 8, cx = 150, cy = 120, rx = 120, ry = 34; const st = []; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + t * Math.PI * 2 / n, d = Math.sin(a); st.push([d, cx + Math.cos(a) * rx, cy + d * ry, a]); } st.sort((a, b) => a[0] - b[0]); x.strokeStyle = 'rgba(255,210,31,.6)'; x.lineWidth = 6; x.lineCap = 'round'; for (const [, , , a] of st) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, a - 0.5, a - 0.12); x.stroke(); } for (const [d, sx, sy] of st) aStar(x, sx, sy, 20 + 9 * (d + 1) / 2, d > 0 ? '#ffd21f' : '#ffe98a'); }
function aDizzyBirds(x, o) { const t = o.t | 0, cx = 150, cy = 120, rx = 120, ry = 36, st = []; for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + t * Math.PI * 2 / 8, d = Math.sin(a); st.push([d, cx + Math.cos(a) * rx, cy + d * ry, a]); } st.sort((a, b) => a[0] - b[0]); for (const [d, bx, by, a] of st) aBird(x, bx, by, 0.85 + 0.35 * (d + 1) / 2, (t + Math.round(a * 3)) % 2, Math.cos(a) > 0 ? -1 : 1); aInk(x, 3); x.beginPath(); for (let i = 0; i < 3; i++) { const a = i * 2.1 + t * 0.9; x.moveTo(cx + Math.cos(a) * 60, 40 + Math.sin(a) * 10); x.lineTo(cx + Math.cos(a) * 60 + 8, 34 + Math.sin(a) * 10); } x.stroke(); }
function aSpiral(x, cx, cy, r, rot, col, lw) { x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.12) { const rr = r * a / (Math.PI * 6); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.strokeStyle = AINK; x.lineWidth = lw + 5; x.lineCap = 'round'; x.stroke(); x.strokeStyle = col; x.lineWidth = lw; x.stroke(); x.restore(); }
function aSpinEyes(x, o) { const t = o.t | 0, rot = t * Math.PI / 3; for (const [cx, s] of [[90, 1], [210, -1]]) { x.beginPath(); x.ellipse(cx, 80, 52, 58, 0, 0, Math.PI * 2); aFS(x, '#fff', 6); x.save(); x.beginPath(); x.ellipse(cx, 80, 46, 52, 0, 0, Math.PI * 2); x.clip(); x.save(); x.translate(cx, 80); x.rotate(rot * s); x.beginPath(); for (let a = 0; a < Math.PI * 7; a += 0.1) { const rr = 46 * a / (Math.PI * 7); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * s); } aInk(x, 6); x.stroke(); x.restore(); x.restore(); } }
function aSparkPop(x, o) { const t = o.t | 0, P = [[60, 60, 0], [170, 40, 2], [250, 90, 4], [90, 150, 3], [210, 160, 1], [140, 100, 5]]; for (const [cx, cy, ph] of P) { const k = Math.sin(((t + ph) % 6) / 6 * Math.PI); if (k < 0.08) continue; aStar(x, cx, cy, 34 * k, ph % 2 ? '#fff6a6' : '#ffd21f', 4, 0.28); } aInk(x, 4); x.beginPath(); for (const [cx, cy, ph] of P) { const k = ((t + ph + 3) % 6) / 6; if (k > 0.5) continue; x.moveTo(cx - 12, cy + 20); x.lineTo(cx - 4, cy + 20); } x.stroke(); }
function aConfused(x, o) { const t = o.t | 0; [[70, 0, '#ffd21f'], [150, 2, '#ff8a1f'], [230, 4, '#3a8fff']].forEach(([cx, ph, col], i) => { const b = Math.sin((t + ph) / 6 * Math.PI * 2); aWord(x, '?', cx, 110 + b * 22, 110 - i * 8, col, 9, b * 0.25); }); }
function aSwirlHalo(x, o) { const t = o.t | 0; aSpiral(x, 100, 100, 80, t * Math.PI / 3, '#b06bff', 7); }
function aZzzFloat(x, o) { const t = o.t | 0; for (let i = 0; i < 3; i++) { const p = ((t + i * 2) % 6) / 6, s = 30 + p * 50; aWord(x, 'Z', 50 + p * 120 + i * 10, 200 - p * 160, s, '#fff', s * 0.12, -0.2 + p * 0.3); } }
/* fight cloud: wobbling dust cloud with fists, boots, stars and grawlix popping out */
function aFight(x, o) {
  const t = o.t | 0, r = aRnd(31 + t * 17), cx = 200, cy = 210;
  aInk(x, 6); x.beginPath(); for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, r0 = 150 + r() * 20; x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8); x.lineTo(cx + Math.cos(a) * (r0 + 30 + r() * 20), cy + Math.sin(a) * (r0 + 30) * 0.8); } x.stroke();
  const pops = [[0.3, 'fist'], [2.2, 'boot'], [4.1, 'fist2'], [1.2, 'star'], [3.3, 'bang'], [5.2, 'star']];
  for (let i = 0; i < pops.length; i++) { if ((i + t) % 3 === 0) continue; const [a0, k] = pops[i], a = a0 + (r() - 0.5) * 0.5, px = cx + Math.cos(a) * 168, py = cy + Math.sin(a) * 150;
    if (k === 'fist') aFist(x, px, py, 0.9, a, '#ffd9b8', '#e8302f'); else if (k === 'fist2') aFist(x, px, py, 0.9, a, '#c98c5e', '#2a6ee0'); else if (k === 'boot') aBoot2(x, px, py, 0.9, a); else if (k === 'star') aStar(x, px, py, 26, '#ffd21f'); else aWord(x, '#@!', px, py, 40, '#ff2a3d', 5, a * 0.2); }
  const puffs = []; for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, rr = 84 + r() * 14; puffs.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.82, 44 + r() * 14]); } puffs.push([cx, cy, 92]); aPuffs(x, puffs, '#f2ece0', 8);
  x.fillStyle = 'rgba(160,140,110,.25)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(cx - 70 + r() * 140, cy - 50 + r() * 100, 18 + r() * 16, 0, Math.PI * 2); x.fill(); }
  aInk(x, 5); x.beginPath(); for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, rr = 30 + r() * 50, sx = cx + Math.cos(a) * rr, sy = cy + Math.sin(a) * rr * 0.7; x.moveTo(sx, sy); x.quadraticCurveTo(sx + 20, sy - 18, sx + 34, sy); } x.stroke();
  if (t % 2 === 0) aStar(x, cx - 40 + r() * 80, cy - 30 + r() * 60, 20, '#ffd21f'); else aWord(x, '!', cx - 30 + r() * 60, cy - 20 + r() * 40, 50, '#ff2a3d', 6);
}
function aImpact(x, o) { const t = o.t | 0, S0 = [0.35, 1, 1.15, 0.95, 0.6][t] || 0.6; x.globalAlpha = t >= 4 ? 0.6 : 1; aBurst(x, 150, 150, 140 * S0, 70 * S0, 10, '#ffd21f', t * 0.15); aBurst(x, 150, 150, 90 * S0, 46 * S0, 10, '#fff', 0.3 + t * 0.15); x.globalAlpha = 1; }
function aPunchFly(x, o) { const t = o.t | 0, px = 70 + t * 46; aInk(x, 7); x.beginPath(); for (const [dy, len] of [[-30, 1], [0, 1.3], [30, 0.9]]) { x.moveTo(Math.max(0, px - 80 - 90 * len), 100 + dy); x.lineTo(px - 80, 100 + dy); } x.stroke(); if (t < 5) aFist(x, px, 100, 1, 0); else { aBurst(x, 300, 100, 80, 40, 9, '#ffd21f'); aFist(x, 270, 100, 1, 0); } }
function aShock(x, o) { const t = o.t | 0; for (let i = 0; i < 3; i++) { const p = (t + i * 2) / 6; if (p > 1) continue; x.globalAlpha = 1 - p * 0.8; x.beginPath(); x.ellipse(150, 150, 20 + p * 130, 12 + p * 80, 0, 0, Math.PI * 2); x.lineWidth = 14 * (1 - p) + 4; x.strokeStyle = AINK; x.stroke(); x.lineWidth = Math.max(1, 14 * (1 - p)); x.strokeStyle = '#fff'; x.stroke(); } x.globalAlpha = 1; }
function aPoof(x, o) { const t = o.t | 0, p = (t + 1) / 6, r = aRnd(9); x.globalAlpha = t >= 4 ? 1 - (t - 3) * 0.3 : 1; const L = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * 0.3; L.push([150 + Math.cos(a) * 90 * p, 150 + Math.sin(a) * 70 * p, (26 + r() * 14) * (0.6 + p * 0.6)]); } L.push([150, 150, 50 * (0.5 + p * 0.5)]); aPuffs(x, L, '#f2ece0', 6); x.globalAlpha = 1; }
function aSteam(x, o) { const t = o.t | 0; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const p = ((t + i * 3) % 6) / 6, cx = 150 + s * (70 + p * 50), cy = 200 - p * 150, r = 20 + p * 30; x.globalAlpha = 1 - p * 0.6; aPuffs(x, [[cx, cy, r], [cx + s * r * 0.7, cy + r * 0.3, r * 0.7], [cx - s * r * 0.5, cy + r * 0.5, r * 0.6]], '#f4f4f4', 5); } x.globalAlpha = 1; }
function aBump(x, o) { const t = o.t | 0, k = [0.2, 0.7, 1.1, 0.95, 1.02][t] ?? 1; x.beginPath(); x.ellipse(100, 150, 70 * k, 60 * k, 0, Math.PI, 0); x.lineTo(170, 150); aFS(x, o.skin || '#ffcfb0', 6); x.beginPath(); x.ellipse(100 - 22 * k, 150 - 34 * k, 14 * k, 8 * k, -0.5, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.75)'; x.fill(); if (t >= 2) { aInk(x, 6); x.beginPath(); for (const a of [-2.4, -1.57, -0.74]) { x.moveTo(100 + Math.cos(a) * 82, 150 + Math.sin(a) * 76); x.lineTo(100 + Math.cos(a) * (100 + t % 2 * 10), 150 + Math.sin(a) * (94 + t % 2 * 10)); } x.stroke(); } }
function aSweatFly(x, o) { const t = o.t | 0, p = t / 5; [[-1, -0.9], [1, -0.9], [-1, -0.3], [1, -0.4]].forEach(([s, up], i) => { const q = (p + i * 0.17) % 1, dx = s * (40 + q * 110), dy = up * 120 * q + 160 * q * q; x.save(); x.translate(150 + dx, 140 + dy - 60); x.rotate(s * (0.4 + q)); aDrop(x, 0, 0, 16 - q * 5, '#7fd0ff'); x.restore(); }); }
function aHitStars(x, o) { const t = o.t | 0; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, p = ((t + i) % 6) / 6, rr = 30 + p * 100; if (p > 0.85) continue; aStar(x, 150 + Math.cos(a) * rr, 150 + Math.sin(a) * rr * 0.8, 36 * (1 - p * 0.5), i % 2 ? '#ffd21f' : '#fff'); } }
function aSpeedRush(x, o) { const t = o.t | 0, r = aRnd(3 + t * 11); aInk(x, 6); x.beginPath(); for (let i = 0; i < 9; i++) { const y = 20 + i * 30 + r() * 10, a = r() * 120, l = 100 + r() * 160; x.moveTo(a, y); x.lineTo(a + l, y); } x.stroke(); }
const ANIM_CATS = {
  dizzy: { name: '💫 Choáng', anim: true, w: 300, h: 200, items: {
    stars: ['Sao quay vòng', aDizzyStars, AN(8, 'swirl')], birds: ['Chim bay vòng', aDizzyBirds, AN(8, 'tweet')], spin: ['Mắt xoáy', aSpinEyes, AN(6, 'swirl')],
    sparkle: ['Đom đóm mắt', aSparkPop, AN(6, 'ting')], confused: ['Ngơ ngác ???', aConfused, AN(6, 'boing')], swirl: ['Vòng xoáy', (x, o) => { x.save(); x.translate(50, 0); aSwirlHalo(x, o); x.restore(); }, AN(6, 'swirl')], zzz: ['Zzz bay', aZzzFloat, AN(6, null)] } },
  fight: { name: '🥊 Đánh nhau', anim: true, w: 400, h: 420, items: {
    cloud: ['Đánh nhau túi bụi', aFight, AN(8, 'scuffle')], impact: ['Va chạm', (x, o) => { x.save(); x.translate(50, 60); aImpact(x, o); x.restore(); }, AN(5, 'punch')], punch: ['Cú đấm bay', (x, o) => { x.save(); x.translate(20, 110); aPunchFly(x, o); x.restore(); }, AN(6, 'whoosh')],
    hitstars: ['Sao văng', (x, o) => { x.save(); x.translate(50, 60); aHitStars(x, o); x.restore(); }, AN(6, 'bonk')], shock: ['Sóng chấn động', (x, o) => { x.save(); x.translate(50, 60); aShock(x, o); x.restore(); }, AN(6, 'boom')],
    poof: ['Khói bụi', (x, o) => { x.save(); x.translate(50, 60); aPoof(x, o); x.restore(); }, AN(6, 'poof')], bump: ['U đầu', (x, o) => { x.save(); x.translate(60, 70); x.scale(1.4, 1.4); aBump(x, o); x.restore(); }, AN(5, 'bonk')],
    steam: ['Tức bốc khói', (x, o) => { x.save(); x.translate(50, 100); aSteam(x, o); x.restore(); }, AN(6, 'whoosh')], sweat: ['Mồ hôi văng', (x, o) => { x.save(); x.translate(5, 20); x.scale(1.3, 1.3); aSweatFly(x, o); x.restore(); }, AN(6, 'pop')],
    speed: ['Vệt lao nhanh', (x, o) => { x.save(); x.translate(20, 70); aSpeedRush(x, o); x.restore(); }, AN(4, 'whoosh')] } },
  sound: { name: '💥 Chữ âm thanh', anim: true, w: 360, h: 260, items: Object.fromEntries(Object.entries(WORDS).map(([k, [label, sfx, fn]]) => [k, [label, (x, o) => aPopWord(x, o, 360, 260, fn), AN(6, sfx)]])) }
};
const ASSET_CATS = {
  ...ANIM_CATS,
  eyes: { name: '👀 Mắt', w: 300, h: 140, rel: 0.55, at: 0.42, items: {
    open: ['Mở', x => aEyes(x, 'open', 'neutral')], big: ['Mở to', x => aEyes(x, 'big', 'up')], half: ['Lim dim', x => aEyes(x, 'half', 'neutral')], closed: ['Nhắm', x => aEyes(x, 'closed', 'neutral')],
    happy: ['Cười híp', x => aEyes(x, 'happy', 'up')], angry: ['Giận', x => aEyes(x, 'angry', 'angry')], sad: ['Buồn', x => aEyes(x, 'down', 'sad')], shock: ['Hoảng', x => aEyes(x, 'shock', 'up')],
    squint: ['Nhăn > <', x => aEyes(x, 'squint', 'scrunch')], cry: ['Khóc', x => aEyes(x, 'cry', 'sad')], lookL: ['Liếc trái', x => aEyes(x, 'open', 'neutral', -1)], lookR: ['Liếc phải', x => aEyes(x, 'open', 'neutral', 1)],
    sleepy: ['Buồn ngủ', x => aEyes(x, 'sleepy', 'none')], dizzy: ['Choáng', x => aEyes(x, 'dizzy', 'none')], heart: ['Mắt tim', x => aEyes(x, 'heart', 'none')], star: ['Mắt sao', x => aEyes(x, 'star', 'none')], x: ['X X', x => aEyes(x, 'x', 'none')], dot: ['Chấm', x => aEyes(x, 'dot', 'neutral')] },
    sets: { blink: ['Bộ chớp mắt (mở → lim dim → nhắm)', ['open', 'half', 'closed']] } },
  mouth: { name: '👄 Miệng', w: 200, h: 120, rel: 0.32, at: 0.74, items: {
    closed: ['Ngậm', x => aMouth(x, 'closed')], half: ['Hé', x => aMouth(x, 'half')], open: ['Há (A)', x => aMouth(x, 'open')], o: ['Tròn (O)', x => aMouth(x, 'o')], e: ['Nhe (E)', x => aMouth(x, 'e')],
    smile: ['Cười', x => aMouth(x, 'smile')], grin: ['Cười to', x => aMouth(x, 'grin')], frown: ['Mếu', x => aMouth(x, 'frown')], grit: ['Nghiến răng', x => aMouth(x, 'grit')], tongue: ['Lè lưỡi', x => aMouth(x, 'tongue')],
    wavy: ['Run run', x => aMouth(x, 'wavy')], scream: ['Gào', x => aMouth(x, 'scream')], smirk: ['Nhếch mép', x => aMouth(x, 'smirk')], cat: ['Miệng mèo', x => aMouth(x, 'cat')] },
    sets: { lip: ['Bộ nhép miệng (ngậm → hé → há) — dùng cho Nhép miệng theo giọng', ['closed', 'half', 'open']], vowel: ['Bộ nói rõ (ngậm → E → O → A)', ['closed', 'e', 'o', 'open']] } },
  face: { name: '😠 Biểu cảm', w: 300, h: 260, rel: 0.72, at: 0.55, items: {
    happy: ['Vui', x => aFace(x, { e: 'open', b: 'neutral', m: 'smile', blush: 1 })], laugh: ['Cười lớn', x => aFace(x, { e: 'happy', b: 'up', m: 'grin' })], angry: ['Giận', x => aFace(x, { e: 'angry', b: 'angry', m: 'grit', vein: 1 })],
    grimace: ['Nhăn nhó', x => aFace(x, { e: 'squint', b: 'scrunch', m: 'grit', lines: 1, sweat: 1 })], wail: ['Khóc to', x => aFace(x, { e: 'cry', b: 'sad', m: 'scream' })], sad: ['Buồn', x => aFace(x, { e: 'down', b: 'sad', m: 'frown' })],
    shock: ['Sốc', x => aFace(x, { e: 'shock', b: 'up', m: 'scream', sweat: 1 })], smug: ['Tự mãn', x => aFace(x, { e: 'half', b: 'neutral', m: 'smirk' })], dizzy: ['Choáng', x => aFace(x, { e: 'dizzy', b: 'none', m: 'wavy' })],
    scared: ['Sợ', x => aFace(x, { e: 'shock', b: 'sad', m: 'wavy', sweat: 1 })], sleep: ['Ngủ', x => aFace(x, { e: 'closed', b: 'none', m: 'o', zzz: 1 })], love: ['Yêu', x => aFace(x, { e: 'heart', b: 'none', m: 'smile', blush: 1 })],
    excited: ['Phấn khích', x => aFace(x, { e: 'star', b: 'up', m: 'grin' })], silly: ['Tinh nghịch', x => aFace(x, { e: 'happy', b: 'neutral', m: 'tongue' })], ko: ['Gục', x => aFace(x, { e: 'x', b: 'none', m: 'tongue' })] },
    sets: { emo: ['Bộ biểu cảm (vui, giận, buồn, sốc, cười, nhăn)', ['happy', 'angry', 'sad', 'shock', 'laugh', 'grimace']] } },
  hand: { name: '✋ Tay', w: 200, h: 200, rel: 0.9, at: 0.85, skin: true, items: {
    point: ['Chỉ trỏ', (x, o) => aHand(x, 'point', o.skin)], up: ['Chỉ lên', (x, o) => aHand(x, 'up', o.skin)], thumb: ['Like', (x, o) => aHand(x, 'thumb', o.skin)], fist: ['Nắm đấm', (x, o) => aHand(x, 'fist', o.skin)],
    open: ['Xoè tay', (x, o) => aHand(x, 'open', o.skin)], wave: ['Vẫy', (x, o) => aHand(x, 'wave', o.skin)], peace: ['Chữ V', (x, o) => aHand(x, 'peace', o.skin)], ok: ['OK', (x, o) => aHand(x, 'ok', o.skin)] },
    sets: { gest: ['Bộ cử chỉ tay (xoè, nắm, chỉ, like, V, OK)', ['open', 'fist', 'point', 'thumb', 'peace', 'ok']] } },
  fx: { name: '💦 Hiệu ứng', w: 200, h: 200, rel: 0.4, at: 0.1, items: {
    sweat: ['Mồ hôi', x => aSweat(x, 100, 104, 40)], vein: ['Gân giận', x => aVein(x, 100, 100, 52)], tears: ['Nước mắt', x => { for (const cx of [60, 140]) { x.beginPath(); x.moveTo(cx - 12, 30); x.bezierCurveTo(cx - 22, 90, cx - 6, 140, cx - 16, 190); x.lineTo(cx + 16, 190); x.bezierCurveTo(cx + 6, 140, cx + 22, 90, cx + 12, 30); x.closePath(); x.fillStyle = '#7cc8ff'; x.fill(); aInk(x, 4); x.stroke(); } }],
    blush: ['Má hồng', x => { x.save(); x.translate(10, 10); x.scale(0.6, 0.6); aBlush(x, 150); x.restore(); }], sparkle: ['Lấp lánh', x => { aStar(x, 70, 80, 46, '#ffe14d', 4, 0.28); aStar(x, 145, 140, 30, '#ffe14d', 4, 0.28); aStar(x, 150, 50, 18, '#fff3a6', 4, 0.28); }],
    excl: ['Dấu !', x => { x.font = '900 170px system-ui,sans-serif'; x.textAlign = 'center'; x.lineWidth = 14; x.lineJoin = 'round'; x.strokeStyle = AINK; x.strokeText('!', 100, 170); x.fillStyle = '#ff3b3b'; x.fillText('!', 100, 170); }],
    quest: ['Dấu ?', x => { x.font = '900 160px system-ui,sans-serif'; x.textAlign = 'center'; x.lineWidth = 14; x.lineJoin = 'round'; x.strokeStyle = AINK; x.strokeText('?', 100, 165); x.fillStyle = '#ffd23f'; x.fillText('?', 100, 165); }],
    heart: ['Tim', x => aHeart(x, 100, 105, 62, '#ff3b5c')], zzz: ['Zzz', x => aZzz(x, 40, 170, 70)],
    speed: ['Vệt tốc độ', x => { aInk(x, 6); x.beginPath(); [[20, 40, 150], [40, 75, 180], [10, 110, 160], [50, 145, 185], [25, 175, 120]].forEach(([a, y, b]) => { x.moveTo(a, y); x.lineTo(b, y); }); x.stroke(); }],
    puff: ['Khói giận', x => { x.beginPath(); [[60, 120, 40], [100, 95, 48], [145, 120, 40], [80, 150, 36], [125, 152, 36]].forEach(([cx, cy, r]) => { x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, Math.PI * 2); }); x.fillStyle = '#e9e9e9'; x.fill(); aInk(x, 6); x.stroke(); x.fillStyle = '#e9e9e9'; [[60, 120, 34], [100, 95, 42], [145, 120, 34], [80, 150, 30], [125, 152, 30]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }); }],
    bulb: ['Ý tưởng', x => { aInk(x, 6); x.beginPath(); for (let k = 0; k < 7; k++) { const a = Math.PI * (1.0 + k / 6); x.moveTo(100 + Math.cos(a) * 66, 88 + Math.sin(a) * 66); x.lineTo(100 + Math.cos(a) * 88, 88 + Math.sin(a) * 88); } x.stroke(); x.beginPath(); x.arc(100, 88, 46, Math.PI * 0.8, Math.PI * 2.2); x.lineTo(118, 150); x.lineTo(82, 150); x.closePath(); x.fillStyle = '#ffe14d'; x.fill(); aInk(x, 6); x.stroke(); x.beginPath(); x.roundRect(80, 150, 40, 26, 6); x.fillStyle = '#bbb'; x.fill(); x.stroke(); }],
    stars: ['Sao choáng', x => { aInk(x, 4); x.beginPath(); x.ellipse(100, 110, 84, 30, 0, 0, Math.PI * 2); x.stroke(); [[20, 110], [100, 140], [180, 110], [100, 80]].forEach(([cx, cy], i) => aStar(x, cx, cy, i === 1 ? 22 : 17, '#ffd23f')); }] },
    sets: {} }
};
const ASSET_SKINS = ['#ffd9b8', '#f2bf94', '#c98c5e', '#8a5634', '#ffffff', '#ffe14d'];
let assetOpt = { skin: '#ffd9b8', flip: false, size: 1, cover: true, loops: 1, sound: true };
const assetAnimN = (cat, key) => { const it = ASSET_CATS[cat].items[key]; return (it[2] && it[2].n) || 1; };
function assetRender(cat, key, k, opt = assetOpt) {
  const C = ASSET_CATS[cat], it = C.items[key], c = makeCanvas(Math.max(1, Math.round(C.w * k)), Math.max(1, Math.round(C.h * k))), x = c.getContext('2d');
  x.save(); if (opt.flip) { x.translate(c.width, 0); x.scale(-1, 1); } x.scale(k, k); it[1](x, opt); x.restore(); return c;
}
/* colour of the parent part under a rest-space rectangle, for covering the old feature */
function assetSkinUnder(par, rx, ry, rw, rh) {
  const im = ppImg(par, null), d = im.c.getContext('2d').getImageData(0, 0, im.c.width, im.c.height).data, cols = [];
  for (let y = Math.max(0, Math.floor(ry - im.y)); y < Math.min(im.c.height, ry - im.y + rh); y += 2) for (let x = Math.max(0, Math.floor(rx - im.x)); x < Math.min(im.c.width, rx - im.x + rw); x += 2) {
    const i = (y * im.c.width + x) * 4; if (d[i + 3] < 200) continue; const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; if (l > 110) cols.push([l, d[i], d[i + 1], d[i + 2]]);
  }
  if (cols.length < 10) return null; cols.sort((a, b) => a[0] - b[0]); const m = cols[cols.length >> 1]; return `rgb(${m[1]},${m[2]},${m[3]})`;
}
async function assetToPart(cat, keys) {
  const C = ASSET_CATS[cat], par = ppPart(ppSel);
  if (!par) { toast('Chạm chọn mảnh để gắn vào (vd. Đầu cho mắt/miệng, Cẳng tay cho bàn tay)', 3500); return; }
  // same-category asset part selected → add/switch a variant instead of a new piece
  if (par.asset && par.asset.cat === cat && keys.length === 1) {
    let idx = par.asset.keys.indexOf(keys[0]);
    if (idx < 0) { const a = { c: assetRender(cat, keys[0], par.asset.k, par.asset.opt), dx: 0, dy: 0 }; if (par.asset.cover) assetCover(a.c, par.asset.cover, par.asset.opt); await encodeHolder(a); par.alts = par.alts || []; par.alts.push(a); par.asset.keys.push(keys[0]); idx = par.asset.keys.length - 1; }
    ppEdit(q => { if (idx) q.v = idx; else delete q.v; }); S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); scheduleSave(); toast('Đã đổi thành "' + C.items[keys[0]][0] + '" ở frame này (frame khác giữ nguyên)', 2500); return;
  }
  const im = ppImg(par, null), pw = im.c.width, ph = im.c.height;
  const ref = cat === 'hand' ? Math.max(pw, ph) * 0.55 : pw;
  const k = clamp(ref * C.rel * assetOpt.size / C.w, 0.05, 6), opt = { ...assetOpt }, w = C.w * k, h = C.h * k;
  let cx = im.x + pw / 2, cy = im.y + ph * C.at;
  if (cat === 'hand' && par.tip) { cx = par.tip.x; cy = par.tip.y; }
  if (cat === 'fx') { cx = im.x + pw * 0.85; cy = im.y + ph * 0.12; }
  const ox = cx - w / 2, oy = cy - h / 2;
  let cover = null; if (assetOpt.cover && (cat === 'eyes' || cat === 'mouth' || cat === 'face')) cover = assetSkinUnder(par, ox, oy, w, h);
  const mk = key => { const c = assetRender(cat, key, k, opt); if (cover) assetCover(c, cover, opt); return c; };
  const p = { id: newId(), name: C.name.replace(/^\S+\s/, '') + ' (kho)', role: '', parent: par.id, z: par.z + 0.5, ox, oy, px: cx, py: cat === 'hand' ? cy : cy, c: mk(keys[0]), alts: [], asset: { cat, keys: [...keys], k, opt, cover } };
  if (cat === 'mouth' && !ppByRole('mouth')) p.role = 'mouth';
  if (cat === 'eyes' && !ppByRole('eyes')) p.role = 'eyes';
  for (const key of keys.slice(1)) { const a = { c: mk(key), dx: 0, dy: 0 }; await encodeHolder(a); p.alts.push(a); }
  await encodePart(p); S.pp.parts.push(p); ppRenormZ(); ppSel = p.id;
  S.frames.forEach(fr => { fr.ver++; queueThumbFor(fr); }); ppSyncBar(); scheduleSave(); requestRender();
  toast(keys.length > 1 ? `Đã gắn ${keys.length} hình — chọn hình ở mục "Hình thay thế" cho từng frame${p.role ? ', đã đặt vai trò ' + PP_ROLES[p.role] : ''}` : 'Đã gắn — kéo chế độ "Di chuyển" để chỉnh chỗ; chọn mảnh này rồi bấm hình khác trong Kho để đổi theo frame', 4500);
}
/* paint a soft skin patch behind the drawing so the old eyes/mouth are hidden */
function assetCover(c, col, opt) { const x = c.getContext('2d'); x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = col; x.beginPath(); x.ellipse(c.width / 2, c.height / 2, c.width * 0.5, c.height * 0.5, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
/* animated effect: place frame 0 like a pasted image; on ✓ the same position/size/rotation is stamped on the next frames (new frames are added at the end if needed) */
function assetToFrameAnim(cat, key) {
  if (S.layer !== 'char') setLayer('char');
  const k = (W * 0.42 * assetOpt.size) / ASSET_CATS[cat].w, opt = { ...assetOpt, t: 0 };
  floatFromImage(assetRender(cat, key, k, opt)); if (!floating) return;
  floating.anim = { cat, key, k, opt, loops: clamp(assetOpt.loops | 0, 1, 4), sound: assetOpt.sound };
  toast(`Kéo đặt chỗ, chỉnh cỡ/xoay rồi bấm ✓ — hiệu ứng sẽ chạy qua ${assetAnimN(cat, key) * floating.anim.loops} frame`, 3500);
}
async function assetStampAnim(fl, keep) {
  const A = fl.anim, n = assetAnimN(A.cat, A.key), total = n * A.loops, i0 = S.frames.indexOf(fl.o); if (i0 < 0) return;
  const base = S.frames[i0], pix = [], added = [];
  for (let j = 1; j < total; j++) {
    let fr = S.frames[i0 + j];
    if (!fr) { fr = newFrameObj(base.bgId); fr.dur = base.dur; fr.canvas.getContext('2d').drawImage(keep, 0, 0); copyCol(fr, base); fr.ver = 1; fr.pngVer = 0; fr.vec = cloneVec(base.vec); fr.pp = ppClone(base.pp); fr.lip = lipCopy(base); fr.texts = JSON.parse(JSON.stringify(base.texts || [])); S.frames.push(fr); loaded.push(fr); added.push(fr); }
    else await ensureLoaded(fr);
    const lx = fr.canvas.getContext('2d'), c = assetRender(A.cat, A.key, A.k, { ...A.opt, t: j % n }), save = floating;
    floating = { ...fl, c }; const rect = rectFromBox(floatBox(), 2); const before = added.includes(fr) ? null : lx.getImageData(...rect); drawFloating(lx); floating = save;
    if (before) pix.push(pixEntry(fr, rect, before, lx.getImageData(...rect)));
    fr.ver++; queueThumbFor(fr);
  }
  const multi = [...pix]; if (added.length) multi.push({ t: targetOf(S.frames[S.frames.indexOf(added[0]) - 1]), add: { frames: added, index: S.frames.indexOf(added[0]), dur0: base.dur, dur1: base.dur }, bytes: 0 });
  if (multi.length) pushEntry({ multi, t: targetOf(base) });
  const sk = A.sound && ASSET_CATS[A.cat].items[A.key][2].sfx;
  if (sk && SFX[sk]) { S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || []; S.audio.sfx.push({ id: newId(), frameId: base.id, kind: sk, vol: 0.9 }); }
  for (const f of added) await drawThumb(f);
  buildStrip(); updateFrameUI(); fxSyncBar(); scheduleSave(); evictSoon(); requestRender();
  toast(`Đã đặt hiệu ứng vào ${total} frame${added.length ? ` (thêm ${added.length} frame mới)` : ''}${sk && SFX[sk] ? ` + âm thanh "${SFX[sk].label}"` : ''} — bấm Phát để xem`, 4000);
}
function assetToFrame(cat, key) {
  if (ASSET_CATS[cat].anim) return assetToFrameAnim(cat, key); const c = assetRender(cat, key, (W * 0.3 * assetOpt.size) / ASSET_CATS[cat].w, assetOpt); floatFromImage(c); toast('Kéo để đặt, kéo góc để đổi cỡ — bấm ✓ để dán', 2500); }
function assetDialog(startCat) {
  let cat = startCat || 'dizzy', animT = null;
  const ppOK = () => S.pp && S.pp.parts.length;
  modal({ title: '🎨 Kho hình', html: `<div class="mrow" id="aCats" style="flex-wrap:wrap;gap:4px"></div>
    <div class="mrow" style="flex-wrap:wrap;gap:6px;margin:8px 0"><span class="lbl">Đặt vào:</span><button class="chip small" data-adst="pp">Nhân vật ghép (mảnh đang chọn)</button><button class="chip small" data-adst="frame">Frame (lớp nhân vật)</button></div>
    <div class="mrow" style="flex-wrap:wrap;gap:6px"><span class="lbl">Cỡ</span><input type="range" id="aSize" min="0.4" max="2.5" step="0.05" value="${assetOpt.size}" style="width:110px"><label class="lbl"><input type="checkbox" id="aFlip" ${assetOpt.flip ? 'checked' : ''}> Lật ngang</label><label class="lbl" id="aCoverL"><input type="checkbox" id="aCover" ${assetOpt.cover ? 'checked' : ''}> Che mắt/miệng cũ bằng màu da</label><span id="aSkins" class="mrow" style="gap:3px"></span><span id="aAnimOpt" class="mrow" style="gap:4px;margin-left:10px"><span class="lbl">Lặp</span><button class="chip small" data-aloop="1">1×</button><button class="chip small" data-aloop="2">2×</button><button class="chip small" data-aloop="3">3×</button><label class="lbl"><input type="checkbox" id="aSound" ${assetOpt.sound ? 'checked' : ''}> Kèm âm thanh</label></span></div>
    <div id="aSets" style="margin:8px 0;display:flex;flex-wrap:wrap;gap:6px"></div>
    <div id="aGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;max-height:46vh;overflow:auto;padding:2px"></div>
    <p class="lbl" id="aHint" style="margin-top:8px"></p>`,
    buttons: [{ label: 'Đóng', value: null }],
    onOpen: (ov, close) => {
      let dst = ppOK() ? 'pp' : 'frame';
      const draw = () => {
        const C = ASSET_CATS[cat]; if (C.anim) dst = 'frame';
        ov.querySelector('#aAnimOpt').style.display = C.anim ? '' : 'none'; ov.querySelectorAll('[data-aloop]').forEach(b => b.classList.toggle('on', +b.dataset.aloop === assetOpt.loops));
        ov.querySelector('#aCats').innerHTML = Object.entries(ASSET_CATS).map(([k, v]) => `<button class="chip small ${k === cat ? 'on' : ''}" data-acat="${k}">${v.name}</button>`).join('');
        ov.querySelectorAll('[data-adst]').forEach(b => { b.classList.toggle('on', b.dataset.adst === dst); b.disabled = b.dataset.adst === 'pp' && (!ppOK() || !!C.anim); });
        ov.querySelector('#aSkins').innerHTML = C.skin ? ASSET_SKINS.map(s => `<button data-skin="${s}" title="Màu da" style="width:26px;height:26px;border-radius:50%;border:3px solid ${s === assetOpt.skin ? 'var(--accent)' : 'var(--line)'};background:${s};cursor:pointer"></button>`).join('') : '';
        ov.querySelector('#aCoverL').style.display = /eyes|mouth|face/.test(cat) && dst === 'pp' ? '' : 'none';
        ov.querySelector('#aSets').innerHTML = dst === 'pp' ? Object.entries(C.sets).map(([k, v]) => `<button class="btn" data-aset="${k}">＋ ${v[0]}</button>`).join('') : '';
        const g = ov.querySelector('#aGrid'); g.innerHTML = ''; clearInterval(animT); const anims = [];
        for (const [key, it] of Object.entries(C.items)) {
          const b = document.createElement('button'); b.className = 'chip'; b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px;height:auto;background:#fff;color:#222';
          const t = assetRender(cat, key, 72 / Math.max(C.w, C.h), { ...assetOpt, t: 0 }); t.style.cssText = 'max-width:72px;max-height:72px'; b.append(t);
          if (C.anim) { const fr = []; for (let i = 0; i < assetAnimN(cat, key); i++) fr.push(assetRender(cat, key, 72 / Math.max(C.w, C.h), { ...assetOpt, t: i })); anims.push([t, fr]); const sk = it[2] && it[2].sfx; if (sk && SFX[sk]) { b.title = 'Âm thanh: ' + SFX[sk].label; } } const s = document.createElement('span'); s.textContent = it[0]; s.style.fontSize = '11px'; b.append(s);
          b.addEventListener('click', async () => { if (dst === 'pp') { close(null); await assetToPart(cat, [key]); } else { close(null); assetToFrame(cat, key); } });
          g.append(b);
        }
        if (anims.length) { let tick = 0; animT = setInterval(() => { if (!ov.isConnected) { clearInterval(animT); return; } tick++; for (const [t, fr] of anims) { const f = fr[tick % fr.length], x = t.getContext('2d'); x.clearRect(0, 0, t.width, t.height); x.drawImage(f, 0, 0); } }, 110); }
        const sel = ppPart(ppSel);
        ov.querySelector('#aHint').textContent = C.anim ? 'Hiệu ứng động: đặt ở frame đang xem rồi bấm ✓, app tự vẽ tiếp lên các frame sau (thiếu frame thì tự thêm). Bấm Phát để xem chuyển động.' : dst === 'frame' ? 'Hình dán vào frame đang xem như ảnh — kéo, đổi cỡ, xoay rồi bấm ✓.' : !sel ? 'Chưa chọn mảnh: đóng bảng, chạm vào mảnh (vd. Đầu) rồi mở lại Kho.' : sel.asset && sel.asset.cat === cat ? `Đang chọn mảnh kho "${sel.name}": bấm một hình để đổi hình ở frame này.` : `Sẽ gắn vào mảnh "${sel.name}", tự cử động theo mảnh đó. Gắn bộ nhiều hình để đổi theo frame (nhép miệng, chớp mắt, đổi biểu cảm).`;
      };
      ov.addEventListener('click', async e => {
        const t = e.target.closest('[data-acat],[data-adst],[data-skin],[data-aset],[data-aloop]'); if (!t) return;
        if (t.dataset.aloop) assetOpt.loops = +t.dataset.aloop; else if (t.dataset.acat) cat = t.dataset.acat; else if (t.dataset.adst) dst = t.dataset.adst; else if (t.dataset.skin) assetOpt.skin = t.dataset.skin;
        else if (t.dataset.aset) { close(null); await assetToPart(cat, ASSET_CATS[cat].sets[t.dataset.aset][1]); return; }
        draw();
      });
      ov.querySelector('#aSize').addEventListener('input', e => { assetOpt.size = +e.target.value; });
      ov.querySelector('#aFlip').addEventListener('change', e => { assetOpt.flip = e.target.checked; draw(); });
      ov.querySelector('#aSound').addEventListener('change', e => { assetOpt.sound = e.target.checked; });
      ov.querySelector('#aCover').addEventListener('change', e => { assetOpt.cover = e.target.checked; });
      ov.querySelector('.dlg').style.maxWidth = '760px';
      draw();
    } });
}
