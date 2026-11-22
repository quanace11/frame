/* ===== asset library: eyes, mouths, faces, hands, effects (all drawn in code, original) ===== */
const AINK = '#1b1b1b';
function aInk(x, lw) { x.strokeStyle = AINK; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; }
function aHeart(x, cx, cy, r, col) { x.beginPath(); x.moveTo(cx, cy + r * 0.9); x.bezierCurveTo(cx - r * 1.6, cy - r * 0.1, cx - r * 0.7, cy - r * 1.3, cx, cy - r * 0.45); x.bezierCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 1.6, cy - r * 0.1, cx, cy + r * 0.9); x.closePath(); x.fillStyle = col; x.fill(); aInk(x, r * 0.16); x.stroke(); }
function aStar(x, cx, cy, r, col, pts = 5, inner = 0.45) { x.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pts, rr = i % 2 ? r * inner : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = col; x.fill(); aInk(x, r * 0.12); x.stroke(); }
function aDrop(x, cx, cy, r, col) { x.beginPath(); x.moveTo(cx, cy - r * 1.6); x.bezierCurveTo(cx + r * 0.3, cy - r * 0.9, cx + r, cy - r * 0.2, cx + r, cy + r * 0.3); x.arc(cx, cy + r * 0.3, r, 0, Math.PI); x.bezierCurveTo(cx - r, cy - r * 0.2, cx - r * 0.3, cy - r * 0.9, cx, cy - r * 1.6); x.fillStyle = col; x.fill(); aInk(x, r * 0.18); x.stroke(); x.beginPath(); x.ellipse(cx - r * 0.35, cy + r * 0.15, r * 0.18, r * 0.32, 0.3, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); }
/* one eye; side=-1 screen-left, +1 screen-right */
function aEye(x, cx, cy, t, side, look = 0) {
  const lw = 5;
  const white = (rx, ry, clip) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); aInk(x, lw); x.stroke(); };
  const pupil = (r, dx = 0, dy = 0, hl = true) => { x.beginPath(); x.ellipse(cx + dx, cy + dy, r * 0.82, r, 0, 0, Math.PI * 2); x.fillStyle = AINK; x.fill(); if (hl) { x.beginPath(); x.arc(cx + dx - r * 0.3, cy + dy - r * 0.38, r * 0.3, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); } };
  const lidClip = (fn, y0, slope = 0) => { x.save(); x.beginPath(); x.moveTo(cx - 60, y0 - slope * 60); x.lineTo(cx + 60, y0 + slope * 60); x.lineTo(cx + 60, cy + 80); x.lineTo(cx - 60, cy + 80); x.closePath(); x.clip(); fn(); x.restore(); aInk(x, lw * 1.4); x.beginPath(); const hw = 30; x.moveTo(cx - hw, y0 - slope * hw); x.lineTo(cx + hw, y0 + slope * hw); x.stroke(); };
  switch (t) {
    case 'open': white(24, 32); pupil(15, look * 9, 3); break;
    case 'big': white(29, 38); pupil(20, look * 8, 4); x.beginPath(); x.arc(cx + 7, cy + 13, 4, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); break;
    case 'down': white(24, 32); pupil(14, 0, 13); break;
    case 'half': lidClip(() => { white(24, 32); pupil(15, 0, 6); }, cy - 2); break;
    case 'sleepy': lidClip(() => { white(24, 32); pupil(14, 0, 10); }, cy + 8); break;
    case 'angry': lidClip(() => { white(24, 30); pupil(13, -side * 3, 4); }, cy - 12, -side * 0.45); break;
    case 'shock': white(28, 36); pupil(6, 0, 0, false); break;
    case 'closed': aInk(x, lw * 1.3); x.beginPath(); x.moveTo(cx - 24, cy); x.quadraticCurveTo(cx, cy + 20, cx + 24, cy); x.stroke(); break;
    case 'happy': aInk(x, lw * 1.3); x.beginPath(); x.moveTo(cx - 24, cy + 8); x.quadraticCurveTo(cx, cy - 22, cx + 24, cy + 8); x.stroke(); break;
    case 'squint': aInk(x, lw * 1.4); x.beginPath(); x.moveTo(cx + side * 22, cy - 18); x.lineTo(cx - side * 18, cy); x.lineTo(cx + side * 22, cy + 18); x.stroke(); break;
    case 'cry': aInk(x, lw * 1.3); x.beginPath(); x.moveTo(cx - 24, cy + 6); x.quadraticCurveTo(cx, cy - 16, cx + 24, cy + 6); x.stroke();
      x.beginPath(); x.moveTo(cx - 12, cy + 8); x.bezierCurveTo(cx - 20, cy + 40, cx - 8, cy + 70, cx - 14, cy + 100); x.lineTo(cx + 14, cy + 100); x.bezierCurveTo(cx + 8, cy + 70, cx + 20, cy + 40, cx + 12, cy + 8); x.closePath(); x.fillStyle = '#7cc8ff'; x.fill(); aInk(x, 3); x.stroke(); break;
    case 'dizzy': aInk(x, lw); x.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.2) { const r = 2 + a * 1.4; x.lineTo(cx + Math.cos(a * side) * r, cy + Math.sin(a * side) * r); } x.stroke(); break;
    case 'heart': aHeart(x, cx, cy + 2, 22, '#ff3b5c'); break;
    case 'star': aStar(x, cx, cy, 30, '#ffd23f'); break;
    case 'x': aInk(x, lw * 1.4); x.beginPath(); x.moveTo(cx - 18, cy - 18); x.lineTo(cx + 18, cy + 18); x.moveTo(cx + 18, cy - 18); x.lineTo(cx - 18, cy + 18); x.stroke(); break;
    case 'dot': x.beginPath(); x.ellipse(cx, cy, 8, 11, 0, 0, Math.PI * 2); x.fillStyle = AINK; x.fill(); break;
  }
}
function aBrow(x, cx, cy, t, side) {
  if (!t || t === 'none') return; aInk(x, 7); x.beginPath();
  const o = side * 30, i = -side * 26; // outer / inner x offsets
  if (t === 'neutral') { x.moveTo(cx + i, cy - 46); x.quadraticCurveTo(cx, cy - 56, cx + o, cy - 46); }
  else if (t === 'up') { x.moveTo(cx + i, cy - 56); x.quadraticCurveTo(cx, cy - 68, cx + o, cy - 54); }
  else if (t === 'angry') { x.moveTo(cx + i, cy - 30); x.lineTo(cx + o, cy - 54); }
  else if (t === 'sad') { x.moveTo(cx + i, cy - 56); x.lineTo(cx + o, cy - 38); }
  else if (t === 'scrunch') { x.moveTo(cx + i, cy - 28); x.quadraticCurveTo(cx + side * 4, cy - 48, cx + o, cy - 40); }
  x.stroke();
}
/* pair of eyes in a 300x140 box */
function aEyes(x, t, brow, look = 0) { aBrow(x, 95, 82, brow, -1); aBrow(x, 205, 82, brow, 1); aEye(x, 95, 82, t, -1, look); aEye(x, 205, 82, t, 1, look); }
/* mouth in a 200x120 box, centre (100,60) */
function aMouth(x, t) {
  const lw = 5, dark = '#4a1414', tongue = '#ff6b7f';
  const fillShape = (path, teethTop, tng) => { x.save(); path(); x.fillStyle = dark; x.fill(); x.clip(); if (teethTop) { x.fillStyle = '#fff'; x.fillRect(0, 0, 200, teethTop); } if (tng) { x.beginPath(); x.ellipse(100, tng, 34, 18, 0, 0, Math.PI * 2); x.fillStyle = tongue; x.fill(); } x.restore(); path(); aInk(x, lw); x.stroke(); };
  switch (t) {
    case 'closed': aInk(x, lw * 1.2); x.beginPath(); x.moveTo(62, 58); x.quadraticCurveTo(100, 66, 138, 58); x.stroke(); break;
    case 'smile': aInk(x, lw * 1.2); x.beginPath(); x.moveTo(52, 46); x.quadraticCurveTo(100, 96, 148, 46); x.stroke(); break;
    case 'half': fillShape(() => { x.beginPath(); x.ellipse(100, 60, 26, 11, 0, 0, Math.PI * 2); }, 0, 70); break;
    case 'open': fillShape(() => { x.beginPath(); x.moveTo(56, 42); x.quadraticCurveTo(100, 36, 144, 42); x.quadraticCurveTo(138, 100, 100, 102); x.quadraticCurveTo(62, 100, 56, 42); x.closePath(); }, 52, 96); break;
    case 'o': fillShape(() => { x.beginPath(); x.ellipse(100, 62, 20, 27, 0, 0, Math.PI * 2); }, 0, 84); break;
    case 'e': fillShape(() => { x.beginPath(); x.moveTo(50, 48); x.quadraticCurveTo(100, 40, 150, 48); x.quadraticCurveTo(146, 80, 100, 82); x.quadraticCurveTo(54, 80, 50, 48); x.closePath(); }, 58, 0);
      x.save(); x.beginPath(); x.moveTo(50, 48); x.quadraticCurveTo(100, 40, 150, 48); x.quadraticCurveTo(146, 80, 100, 82); x.quadraticCurveTo(54, 80, 50, 48); x.clip(); x.fillStyle = '#fff'; x.fillRect(0, 72, 200, 20); x.restore(); break;
    case 'grin': fillShape(() => { x.beginPath(); x.moveTo(46, 38); x.lineTo(154, 38); x.quadraticCurveTo(150, 104, 100, 106); x.quadraticCurveTo(50, 104, 46, 38); x.closePath(); }, 52, 98); break;
    case 'frown': aInk(x, lw * 1.2); x.beginPath(); x.moveTo(58, 80); x.quadraticCurveTo(100, 36, 142, 80); x.stroke(); break;
    case 'grit': x.beginPath(); x.roundRect(48, 40, 104, 44, 16); x.fillStyle = '#fff'; x.fill(); aInk(x, lw); x.stroke(); aInk(x, 3); x.beginPath(); x.moveTo(52, 62); x.lineTo(148, 62); for (let i = 1; i < 6; i++) { x.moveTo(48 + i * 104 / 6, 42); x.lineTo(48 + i * 104 / 6, 82); } x.stroke(); break;
    case 'tongue': aInk(x, lw * 1.2); x.beginPath(); x.moveTo(52, 44); x.quadraticCurveTo(100, 80, 148, 44); x.stroke(); x.beginPath(); x.moveTo(82, 62); x.lineTo(82, 86); x.arc(100, 86, 18, Math.PI, 0, true); x.lineTo(118, 62); x.fillStyle = tongue; x.fill(); aInk(x, 4); x.stroke(); x.beginPath(); x.moveTo(100, 66); x.lineTo(100, 88); x.stroke(); break;
    case 'wavy': aInk(x, lw * 1.1); x.beginPath(); for (let i = 0; i <= 40; i++) { const xx = 50 + i * 2.5; x.lineTo(xx, 60 + Math.sin(i / 40 * Math.PI * 4) * 8); } x.stroke(); break;
    case 'scream': fillShape(() => { x.beginPath(); x.ellipse(100, 62, 40, 52, 0, 0, Math.PI * 2); }, 26, 104); break;
    case 'smirk': aInk(x, lw * 1.2); x.beginPath(); x.moveTo(64, 62); x.quadraticCurveTo(112, 70, 140, 44); x.stroke(); break;
    case 'cat': aInk(x, lw * 1.1); x.beginPath(); x.moveTo(60, 52); x.quadraticCurveTo(78, 76, 100, 56); x.quadraticCurveTo(122, 76, 140, 52); x.stroke(); break;
  }
}
function aBlush(x, y) { for (const cx of [62, 238]) { x.beginPath(); x.ellipse(cx, y, 24, 12, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(255,110,140,.55)'; x.fill(); aInk(x, 2.5); x.strokeStyle = 'rgba(220,60,90,.8)'; x.beginPath(); for (let k = -1; k <= 1; k++) { x.moveTo(cx + k * 10 - 4, y + 5); x.lineTo(cx + k * 10 + 4, y - 5); } x.stroke(); } }
function aVein(x, cx, cy, r) { x.strokeStyle = '#e8213a'; x.lineWidth = r * 0.28; x.lineCap = 'round'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; x.beginPath(); const px = cx + Math.cos(a) * r * 0.8, py = cy + Math.sin(a) * r * 0.8; x.arc(px, py, r * 0.55, a + Math.PI * 0.75, a + Math.PI * 1.25); x.stroke(); } }
function aSweat(x, cx, cy, r) { aDrop(x, cx, cy, r, '#8fd3ff'); }
function aZzz(x, cx, cy, s) { x.font = `900 ${s}px system-ui,sans-serif`; x.lineJoin = 'round'; [[0, 0, 1], [s * 0.7, -s * 0.6, 0.75], [s * 1.25, -s * 1.1, 0.55]].forEach(([dx, dy, k]) => { x.save(); x.translate(cx + dx, cy + dy); x.scale(k, k); x.lineWidth = s * 0.14; x.strokeStyle = AINK; x.strokeText('Z', 0, 0); x.fillStyle = '#fff'; x.fillText('Z', 0, 0); x.restore(); }); }
/* full face features in a 300x260 box: eyes at top, mouth below */
function aFace(x, o) {
  x.save(); x.translate(0, 10); aEyes(x, o.e, o.b, o.look || 0); x.restore();
  x.save(); x.translate(50, 140); aMouth(x, o.m); x.restore();
  if (o.blush) aBlush(x, 150);
  if (o.vein) aVein(x, 262, 34, 20);
  if (o.sweat) aSweat(x, 268, 70, 13);
  if (o.lines) { aInk(x, 4); x.beginPath(); x.moveTo(132, 30); x.lineTo(140, 44); x.moveTo(168, 30); x.lineTo(160, 44); x.moveTo(150, 24); x.lineTo(150, 40); x.stroke(); }
  if (o.zzz) aZzz(x, 220, 40, 34);
}
/* hands, 200x200, palm/finger shapes are thick round strokes → one clean merged outline */
function aHand(x, kind, skin) {
  const sh = [], cap = (x1, y1, x2, y2, r) => sh.push({ t: 'c', x1, y1, x2, y2, r }), box = (x0, y0, w, h, r) => sh.push({ t: 'b', x0, y0, w, h, r }), ring = (cx, cy, rr, w) => sh.push({ t: 'r', cx, cy, rr, w });
  const det = []; const line = (...p) => det.push(p);
  switch (kind) {
    case 'point': box(56, 78, 64, 70, 24); cap(112, 92, 176, 92, 12); cap(116, 112, 130, 112, 10); cap(116, 129, 128, 129, 10); cap(112, 145, 122, 145, 9); cap(74, 102, 118, 108, 10); cap(28, 114, 60, 114, 27);
      line(112, 121, 132, 121); line(110, 138, 128, 137); break;
    case 'thumb': box(62, 92, 74, 68, 20); cap(128, 102, 148, 102, 10); cap(128, 120, 148, 120, 10); cap(128, 138, 146, 138, 10); cap(126, 154, 140, 154, 9); cap(80, 98, 80, 30, 14); cap(100, 160, 100, 196, 27);
      line(126, 111, 150, 111); line(126, 129, 150, 129); line(126, 147, 146, 147); break;
    case 'fist': box(50, 76, 100, 74, 24); cap(64, 74, 64, 100, 13); cap(89, 70, 89, 100, 13); cap(114, 70, 114, 100, 13); cap(138, 76, 138, 100, 12); cap(58, 124, 116, 122, 12); cap(100, 150, 100, 196, 28);
      line(76, 66, 76, 100); line(101, 62, 101, 100); line(126, 64, 126, 100); break;
    case 'open': box(60, 90, 80, 76, 24); cap(72, 96, 60, 32, 11); cap(92, 90, 88, 18, 11); cap(112, 90, 118, 22, 11); cap(132, 98, 148, 42, 10); cap(64, 142, 26, 108, 12); cap(100, 166, 100, 198, 26);
      line(80, 140, 120, 126); break;
    case 'peace': box(64, 102, 76, 64, 20); cap(86, 108, 70, 26, 11); cap(110, 108, 126, 26, 11); cap(124, 112, 142, 112, 9); cap(124, 128, 142, 128, 9); cap(70, 140, 116, 124, 10); cap(102, 166, 102, 198, 26);
      line(122, 120, 144, 120); break;
    case 'ok': box(62, 96, 84, 70, 22); ring(72, 86, 20, 20); cap(100, 98, 106, 26, 10); cap(120, 100, 134, 32, 10); cap(138, 108, 156, 52, 9); cap(104, 166, 104, 198, 26); break;
    case 'wave': x.save(); x.translate(100, 110); x.rotate(-0.25); x.translate(-100, -110); aHand(x, 'open', skin); x.restore();
      aInk(x, 5); x.beginPath(); x.arc(100, 110, 96, Math.PI * 1.08, Math.PI * 1.32); x.moveTo(30, 150); x.arc(100, 110, 84, Math.PI * 1.1, Math.PI * 1.3); x.stroke(); x.beginPath(); x.arc(100, 110, 96, -Math.PI * 0.32, -Math.PI * 0.08); x.stroke(); return;
    case 'up': x.save(); x.translate(100, 100); x.rotate(-Math.PI / 2); x.translate(-100, -100); aHand(x, 'point', skin); x.restore(); return;
  }
  const pass = (stroke) => {
    for (const s of sh) {
      if (s.t === 'c') { x.beginPath(); x.moveTo(s.x1, s.y1); x.lineTo(s.x2, s.y2); x.lineCap = 'round'; x.lineWidth = s.r * 2 + (stroke ? 10 : 0); x.strokeStyle = stroke ? AINK : skin; x.stroke(); }
      else if (s.t === 'b') { x.beginPath(); x.roundRect(s.x0, s.y0, s.w, s.h, s.r); if (stroke) { x.lineWidth = 10; x.strokeStyle = AINK; x.stroke(); } x.fillStyle = stroke ? AINK : skin; x.fill(); }
      else { x.beginPath(); x.arc(s.cx, s.cy, s.rr, 0, Math.PI * 2); x.lineWidth = s.w + (stroke ? 10 : 0); x.strokeStyle = stroke ? AINK : skin; x.stroke(); }
    }
  };
  pass(true); pass(false); aInk(x, 3.5); x.beginPath(); for (const [a, b, c2, d] of det) { x.moveTo(a, b); x.lineTo(c2, d); } x.stroke();
}
