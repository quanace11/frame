/* ===== Scene library: original backgrounds drawn with code (no images), fit any frame size ===== */
function scRand(seed) { let x = seed | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
function scGrad(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function scRect(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
function scRound(x, c, a, b, w, h, r) { x.fillStyle = c; x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); x.fill(); }
function scCloud(x, cx, cy, s, c = '#ffffff') { x.fillStyle = c; x.beginPath(); for (const [dx, dy, r] of [[0, 0, 1], [-1.1, .25, .7], [1.1, .25, .75], [-.5, -.45, .7], [.55, -.4, .65]]) { x.moveTo(cx + dx * s + r * s, cy + dy * s); x.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); } x.fill(); }
function scTree(x, cx, by, s, leaf = '#3f9b4f', dark = '#2f7d3f') { scRect(x, '#7a5233', cx - s * .09, by - s * .9, s * .18, s * .9); x.fillStyle = dark; x.beginPath(); x.arc(cx, by - s * 1.15, s * .55, 0, 7); x.fill(); x.fillStyle = leaf; x.beginPath(); x.arc(cx - s * .2, by - s * 1.3, s * .42, 0, 7); x.arc(cx + s * .25, by - s * 1.25, s * .38, 0, 7); x.arc(cx, by - s * 1.55, s * .36, 0, 7); x.fill(); }
function scWindow(x, a, b, w, h, sky, frame = '#f4efe6') { scRound(x, frame, a - w * .06, b - w * .06, w * 1.12, h + w * .12, w * .04); x.fillStyle = scGrad(x, 0, b, 0, b + h, sky); x.fillRect(a, b, w, h); scRect(x, frame, a + w / 2 - w * .025, b, w * .05, h); scRect(x, frame, a, b + h / 2 - w * .025, w, w * .05); }
function scFloor(x, w, h, y, c1, c2, n = 8) { scRect(x, c1, 0, y, w, h - y); x.strokeStyle = c2; x.lineWidth = Math.max(1, w * .004); for (let i = 1; i < n; i++) { const yy = y + (h - y) * Math.pow(i / n, 1.6); x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); } }
// football scenes: crowd rows (far = small, drawn first), striped pitch with lines, plain ad boards (no brands), goal with net
const SC_SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac', '#5c3a21'];
function scCrowd(x, w, y0, y1, seed, cols, k = 1, flash = 0) {
  const r = scRand(seed); let y = y0, row = 0;
  while (y < y1) {
    const t = (y - y0) / Math.max(1, y1 - y0), s = w * (.011 + t * .014) * k;
    for (let xx = -s + (row % 2) * s * .9; xx < w + s; xx += s * 1.75) {
      const jx = xx + (r() - .5) * s * .5, jy = y + (r() - .5) * s * .3, up = r() < .12;   // some fans have their arms up
      x.fillStyle = cols[(r() * cols.length) | 0];
      if (up) { x.fillRect(jx - s * .75, jy - s * .9, s * .22, s * 1.4); x.fillRect(jx + s * .53, jy - s * .9, s * .22, s * 1.4); }
      x.beginPath(); x.ellipse(jx, jy + s * .95, s * .8, s * .8, 0, 0, 7); x.fill();
      x.fillStyle = SC_SKIN[(r() * SC_SKIN.length) | 0]; x.beginPath(); x.arc(jx, jy, s * .48, 0, 7); x.fill();
      if (flash && r() < flash) { x.fillStyle = '#fffbe0'; x.beginPath(); x.arc(jx + s * .5, jy - s * .2, s * .22, 0, 7); x.fill(); }
    }
    y += s * 1.35; row++;
  }
}
function scBoards(x, w, y, bh, cols) {
  const n = 5, bw = w / n; for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length]; scRect(x, c[0], i * bw, y, bw + 1, bh);
    x.fillStyle = c[1]; x.beginPath(); x.moveTo(i * bw + bw * .12, y + bh * .78); x.lineTo(i * bw + bw * .3, y + bh * .22); x.lineTo(i * bw + bw * .88, y + bh * .22); x.lineTo(i * bw + bw * .7, y + bh * .78); x.fill();
  }
  scRect(x, 'rgba(0,0,0,.35)', 0, y + bh - bh * .08, w, bh * .08);
}
function scGrass(x, w, h, y0, c1, c2, n = 10) {
  for (let i = 0; i < n; i++) { const a = y0 + (h - y0) * Math.pow(i / n, 1.5), b = y0 + (h - y0) * Math.pow((i + 1) / n, 1.5); scRect(x, i % 2 ? c2 : c1, 0, a, w, b - a + 1); }
}
function scLines(x, w, h, y0, a = .9) {
  x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = w * .007; const d = h - y0, ty = y0 + d * .05;
  x.beginPath(); x.moveTo(0, ty); x.lineTo(w, ty); x.moveTo(w * .5, ty); x.lineTo(w * .5, h); x.stroke();
  x.lineWidth = w * .008; x.beginPath(); x.ellipse(w * .5, y0 + d * .45, w * .34, d * .17, 0, 0, 7); x.stroke();
  x.fillStyle = `rgba(255,255,255,${a})`; x.beginPath(); x.ellipse(w * .5, y0 + d * .45, w * .014, d * .008, 0, 0, 7); x.fill();
}
function scStadium(x, w, h, night) {
  const gy = h * .42;
  x.fillStyle = night ? scGrad(x, 0, 0, 0, h * .2, ['#050817', '#141c3f']) : scGrad(x, 0, 0, 0, h * .2, ['#5fb4ff', '#cdeaff']); x.fillRect(0, 0, w, h * .2);
  if (!night) scCloud(x, w * .72, h * .035, w * .05);
  scRect(x, night ? '#1a1d26' : '#5b6270', 0, h * .06, w, h * .32); x.fillStyle = night ? '#232733' : '#7c8492'; x.beginPath(); x.moveTo(0, h * .06); x.lineTo(w, h * .045); x.lineTo(w, h * .07); x.lineTo(0, h * .085); x.fill();
  scCrowd(x, w, h * .09, h * .37, 11, night ? ['#3b2a4f', '#24344f', '#5a1f2b', '#2f3a2a', '#433'] : ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#43a047', '#fb8c00', '#8e24aa'], 1, night ? .08 : 0);
  if (night) {
    scRect(x, 'rgba(5,8,23,.35)', 0, h * .06, w, h * .32);
    for (const cx of [w * .12, w * .88]) { scRect(x, '#2b2f3a', cx - w * .006, 0, w * .012, h * .08);
      const g = x.createRadialGradient(cx, h * .03, 2, cx, h * .03, w * .3); g.addColorStop(0, 'rgba(255,255,235,.95)'); g.addColorStop(.15, 'rgba(255,255,220,.45)'); g.addColorStop(1, 'rgba(255,255,220,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h * .35);
      scRound(x, '#fffde8', cx - w * .07, h * .015, w * .14, h * .03, w * .005); x.fillStyle = '#d9d3a8'; for (let i = 1; i < 4; i++) x.fillRect(cx - w * .07 + i * w * .035, h * .015, w * .003, h * .03); }
  }
  scRect(x, night ? '#101219' : '#3d424c', 0, h * .37, w, h * .016);
  scBoards(x, w, h * .386, h * .034, night ? [['#1565c0', '#90caf9'], ['#c62828', '#ffcdd2'], ['#2e7d32', '#c8e6c9']] : [['#1e88e5', '#ffffff'], ['#e53935', '#ffeb3b'], ['#43a047', '#ffffff'], ['#fb8c00', '#ffffff']]);
  scGrass(x, w, h, gy, night ? '#2f7d32' : '#4caf50', night ? '#276a2b' : '#43a047');
  scLines(x, w, h, gy, night ? .8 : .92);
  if (night) { const g = x.createLinearGradient(0, gy, 0, h); g.addColorStop(0, 'rgba(255,255,230,.12)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(0, gy, w, h - gy); }
}
function scBall(x, cx, cy, r) {
  x.fillStyle = '#fff'; x.strokeStyle = '#222'; x.lineWidth = r * .1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#222'; x.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; x.lineTo(cx + Math.cos(a) * r * .38, cy + Math.sin(a) * r * .38); } x.fill();
  x.lineWidth = r * .07; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5, b = a + Math.PI / 5;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * r * .38, cy + Math.sin(a) * r * .38); x.lineTo(cx + Math.cos(a) * r * .66, cy + Math.sin(a) * r * .66); x.stroke();
    x.beginPath(); x.arc(cx, cy, r * .98, b - .32, b + .32); x.lineTo(cx + Math.cos(b) * r * .8, cy + Math.sin(b) * r * .8); x.closePath(); x.fill(); }
}
function scShirt(x, cx, cy, s, c, num) {
  x.fillStyle = c; x.beginPath(); x.moveTo(cx - s * .28, cy - s * .5); x.lineTo(cx - s * .62, cy - s * .3); x.lineTo(cx - s * .5, cy - s * .05); x.lineTo(cx - s * .34, cy - s * .12); x.lineTo(cx - s * .34, cy + s * .5);
  x.lineTo(cx + s * .34, cy + s * .5); x.lineTo(cx + s * .34, cy - s * .12); x.lineTo(cx + s * .5, cy - s * .05); x.lineTo(cx + s * .62, cy - s * .3); x.lineTo(cx + s * .28, cy - s * .5);
  x.quadraticCurveTo(cx, cy - s * .34, cx - s * .28, cy - s * .5); x.fill();
  if (num != null) { x.fillStyle = '#fff'; x.font = `900 ${Math.round(s * .42)}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), cx, cy + s * .14); }
}
const SCENES = {
  pitch: ['⚽ Sân bóng', (x, w, h) => scStadium(x, w, h, false)],
  pitchNight: ['🌃 Sân bóng đêm', (x, w, h) => scStadium(x, w, h, true)],
  goal: ['🥅 Khung thành', (x, w, h) => {
    scRect(x, '#3d424c', 0, 0, w, h * .4); scCrowd(x, w, -h * .01, h * .36, 23, ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#43a047', '#fb8c00'], 1.4);
    scRect(x, 'rgba(0,0,0,.18)', 0, 0, w, h * .36); scRect(x, '#2b2f36', 0, h * .36, w, h * .02);
    scBoards(x, w, h * .38, h * .04, [['#1e88e5', '#ffffff'], ['#e53935', '#ffeb3b'], ['#43a047', '#ffffff']]);
    scGrass(x, w, h, h * .42, '#4caf50', '#43a047', 9);
    const L = w * .07, R = w * .93, T = h * .3, B = h * .62, bl = w * .17, br = w * .83, bt = h * .35, bb = h * .555;
    x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(L, T); x.lineTo(bl, bt); x.lineTo(br, bt); x.lineTo(R, T); x.lineTo(R, B); x.lineTo(br, bb); x.lineTo(bl, bb); x.lineTo(L, B); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = Math.max(1, w * .002); x.beginPath();
    for (let i = 0; i <= 24; i++) { const t = i / 24, xx = bl + (br - bl) * t; x.moveTo(xx, bt); x.lineTo(xx, bb); x.moveTo(xx, bt); x.lineTo(L + (R - L) * t, T); }
    for (let i = 0; i <= 10; i++) { const t = i / 10, yy = bt + (bb - bt) * t; x.moveTo(bl, yy); x.lineTo(br, yy); x.moveTo(L, T + (B - T) * t); x.lineTo(bl, yy); x.moveTo(R, T + (B - T) * t); x.lineTo(br, yy); }
    for (let i = 1; i < 6; i++) { const t = i / 6; x.moveTo(L + (bl - L) * t, T + (bt - T) * t); x.lineTo(L + (bl - L) * t, B + (bb - B) * t); x.moveTo(R + (br - R) * t, T + (bt - T) * t); x.lineTo(R + (br - R) * t, B + (bb - B) * t); }
    x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = w * .007; x.beginPath(); x.moveTo(0, B); x.lineTo(w, B); x.moveTo(w * .2, B); x.lineTo(w * .1, h * .72); x.lineTo(w * .9, h * .72); x.lineTo(w * .8, B); x.stroke();
    x.beginPath(); x.moveTo(-w * .1, h * .86); x.lineTo(w * 1.1, h * .86); x.stroke();
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(L, B, R - L, h * .008);
    const pw = w * .032; scRect(x, '#e9e9e9', L - pw / 2, T - pw / 2, pw, B - T + pw / 2); scRect(x, '#e9e9e9', R - pw / 2, T - pw / 2, pw, B - T + pw / 2); scRect(x, '#e9e9e9', L - pw / 2, T - pw / 2, R - L + pw, pw);
    scRect(x, '#ffffff', L - pw / 2, T - pw / 2, pw * .45, B - T + pw / 2); scRect(x, '#ffffff', R - pw / 2, T - pw / 2, pw * .45, B - T + pw / 2); scRect(x, '#ffffff', L - pw / 2, T - pw / 2, R - L + pw, pw * .45);
    x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.ellipse(w * .5, h * .8, w * .012, h * .005, 0, 0, 7); x.fill(); }],
  stands: ['📣 Khán đài', (x, w, h) => {
    scRect(x, '#2a2e38', 0, 0, w, h); scCrowd(x, w, -h * .02, h * .9, 31, ['#e53935', '#e53935', '#ffffff', '#1e88e5', '#fdd835', '#212121'], 3.2);
    const r = scRand(5);
    for (let i = 0; i < 5; i++) { const fx = w * (.08 + i * .21 + r() * .05), fy = h * (.12 + r() * .45), fw = w * .2, fh = w * .12, c = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ffffff'][i];
      scRect(x, '#5d4037', fx - w * .006, fy, w * .012, h * .2); x.fillStyle = c; x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + fw * .5, fy - fh * .25, fx + fw, fy); x.lineTo(fx + fw, fy + fh); x.quadraticCurveTo(fx + fw * .5, fy + fh * .75, fx, fy + fh); x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(fx, fy + fh * .4, fw, fh * .2); }
    scRect(x, '#1e3a8a', 0, h * .88, w, h * .12); x.fillStyle = '#ffffff'; for (let xx = 0; xx < w; xx += w * .2) x.fillRect(xx, h * .9, w * .1, h * .012);
    scRect(x, '#b0bec5', 0, h * .875, w, h * .008); }],
  tunnel: ['🚪 Đường hầm', (x, w, h) => {
    const ox0 = w * .36, ox1 = w * .64, oy0 = h * .32, oy1 = h * .56;
    x.fillStyle = scGrad(x, 0, oy0, 0, oy1, ['#fffef2', '#e8ffe0', '#7ccf6a']); x.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
    x.fillStyle = '#2a2e35'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(ox1, oy0); x.lineTo(ox0, oy0); x.fill();
    x.fillStyle = '#3c424c'; x.beginPath(); x.moveTo(0, 0); x.lineTo(ox0, oy0); x.lineTo(ox0, oy1); x.lineTo(0, h); x.fill(); x.beginPath(); x.moveTo(w, 0); x.lineTo(ox1, oy0); x.lineTo(ox1, oy1); x.lineTo(w, h); x.fill();
    x.fillStyle = '#4b525d'; x.beginPath(); x.moveTo(0, h); x.lineTo(ox0, oy1); x.lineTo(ox1, oy1); x.lineTo(w, h); x.fill();
    x.fillStyle = '#2e7d32'; x.beginPath(); x.moveTo(w * .3, h); x.lineTo(w * .47, oy1); x.lineTo(w * .53, oy1); x.lineTo(w * .7, h); x.fill();
    for (let i = 0; i < 6; i++) { const t = Math.pow(i / 6, .8), yy = oy0 * t, hw = (w * .5 - (w * .5 - (ox1 - ox0) / 2) * t) * .25; scRect(x, 'rgba(255,255,230,.85)', w * .5 - hw, yy + h * .01 * (1 - t), hw * 2, h * .012 * (1 - t) + 2); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = Math.max(1, w * .003); for (let i = 1; i < 6; i++) { const t = i / 6; x.beginPath(); x.moveTo(ox0 * t, oy0 * t); x.lineTo(ox0 * t, h - (h - oy1) * t); x.moveTo(w - (w - ox1) * t, oy0 * t); x.lineTo(w - (w - ox1) * t, h - (h - oy1) * t); x.stroke(); }
    const g = x.createRadialGradient(w * .5, (oy0 + oy1) / 2, w * .05, w * .5, (oy0 + oy1) / 2, w * .75); g.addColorStop(0, 'rgba(255,255,235,.55)'); g.addColorStop(1, 'rgba(255,255,235,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }],
  locker: ['👕 Phòng thay đồ', (x, w, h) => {
    const fy = h * .7; scRect(x, '#24507e', 0, 0, w, fy); scFloor(x, w, h, fy, '#9aa3ad', '#87909a', 7);
    for (let i = 0; i < 4; i++) { const lx = w * (.035 + i * .24), ly = h * .16, lw = w * .21, lh = h * .4;
      scRound(x, '#1a3a5c', lx, ly, lw, lh, w * .008); scRound(x, '#10273f', lx + lw * .06, ly + lh * .04, lw * .88, lh * .9, w * .006);
      scRect(x, '#9e9e9e', lx + lw * .2, ly + lh * .1, lw * .6, h * .004); scShirt(x, lx + lw / 2, ly + lh * .36, lw * .78, '#d32f2f', [7, 10, 9, 4][i]);
      scRect(x, '#f5f5f5', lx + lw * .3, ly + lh * .78, lw * .4, lh * .08); }
    scRect(x, '#0f2741', 0, h * .58, w, h * .01);
    scRound(x, '#a1673a', w * .02, h * .62, w * .96, h * .035, w * .008); scRect(x, '#7a4a26', w * .02, h * .652, w * .96, h * .008);
    for (const lx of [.08, .5, .9]) scRect(x, '#5d3a1e', w * lx - w * .012, h * .655, w * .024, h * .06); }],
  press: ['🎤 Họp báo', (x, w, h) => {
    scRect(x, '#e8eef5', 0, 0, w, h * .7);
    for (let yy = 0, row = 0; yy < h * .66; yy += w * .2, row++) for (let xx = (row % 2) * w * .1 - w * .05; xx < w + w * .1; xx += w * .2) { scBall(x, xx, yy + w * .08, w * .035); x.fillStyle = '#1e3a8a'; x.fillRect(xx - w * .06, yy + w * .14, w * .12, w * .012); }
    x.fillStyle = 'rgba(232,238,245,.35)'; x.fillRect(0, 0, w, h * .7);
    scFloor(x, w, h, h * .7, '#37474f', '#2e3b42', 5);
    scRound(x, '#1e3a8a', -w * .02, h * .62, w * 1.04, h * .2, w * .01); scRect(x, '#162c69', -w * .02, h * .62, w * 1.04, h * .02);
    for (const mx of [.32, .5, .68]) { scRect(x, '#222', w * mx - w * .006, h * .565, w * .012, h * .055); scRect(x, '#333', w * mx - w * .03, h * .615, w * .06, h * .008);
      scRound(x, '#2b2b2b', w * mx - w * .018, h * .54, w * .036, h * .03, w * .015); x.fillStyle = '#555'; for (let k = 0; k < 3; k++) x.fillRect(w * mx - w * .014, h * .546 + k * h * .007, w * .028, h * .002); }
    for (const bx of [.18, .82]) { scRound(x, 'rgba(160,210,255,.85)', w * bx - w * .02, h * .565, w * .04, h * .055, w * .01); scRect(x, '#1565c0', w * bx - w * .012, h * .555, w * .024, h * .012); }
    scRound(x, '#ffffff', w * .4, h * .595, w * .2, h * .025, w * .004); }],
  trophy: ['🏆 Lễ trao cúp', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h, ['#0b1a3f', '#173a7a', '#0b1a3f']); x.fillRect(0, 0, w, h);
    for (const [cx, a] of [[w * .15, .35], [w * .85, -.35], [w * .5, 0]]) { x.save(); x.translate(cx, 0); x.rotate(a); const g = x.createLinearGradient(0, 0, 0, h * .8); g.addColorStop(0, 'rgba(255,255,220,.35)'); g.addColorStop(1, 'rgba(255,255,220,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(-w * .03, 0); x.lineTo(w * .03, 0); x.lineTo(w * .2, h * .8); x.lineTo(-w * .2, h * .8); x.fill(); x.restore(); }
    const r = scRand(17); for (let i = 0; i < 160; i++) { x.save(); x.translate(r() * w, r() * h * .8); x.rotate(r() * 6); x.fillStyle = ['#ffd54f', '#ef5350', '#42a5f5', '#66bb6a', '#ffffff'][(r() * 5) | 0]; x.fillRect(-w * .008, -w * .004, w * .016, w * .008); x.restore(); }
    scRect(x, '#0a1430', 0, h * .78, w, h * .22); scRound(x, '#c9a227', w * .12, h * .74, w * .76, h * .05, w * .008); scRect(x, '#8d6e1f', w * .12, h * .785, w * .76, h * .012);
    const cx = w * .5, top = h * .5; x.fillStyle = '#f2c94c';
    x.beginPath(); x.moveTo(cx - w * .12, top); x.lineTo(cx + w * .12, top); x.quadraticCurveTo(cx + w * .11, top + h * .1, cx + w * .02, top + h * .12); x.lineTo(cx - w * .02, top + h * .12); x.quadraticCurveTo(cx - w * .11, top + h * .1, cx - w * .12, top); x.fill();
    x.strokeStyle = '#f2c94c'; x.lineWidth = w * .018; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * w * .125, top + h * .035, w * .05, h * .028, 0, s < 0 ? Math.PI * .5 : -Math.PI * .5, s < 0 ? Math.PI * 1.5 : Math.PI * .5); x.stroke(); }
    scRect(x, '#e0b43a', cx - w * .018, top + h * .12, w * .036, h * .07); scRound(x, '#c9a227', cx - w * .09, top + h * .19, w * .18, h * .05, w * .006);
    x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(cx - w * .06, top + h * .04, w * .02, h * .03, -.3, 0, 7); x.fill(); }],
  sky: ['☀️ Trời xanh', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h, ['#5fb4ff', '#a8dcff', '#e6f6ff']); x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(w * .8, h * .12, w * .09, 0, 7); x.fill();
    scCloud(x, w * .25, h * .16, w * .07); scCloud(x, w * .7, h * .3, w * .055); scCloud(x, w * .15, h * .42, w * .045);
    x.fillStyle = '#7fcf6a'; x.beginPath(); x.moveTo(0, h * .72); x.quadraticCurveTo(w * .3, h * .62, w * .62, h * .7); x.quadraticCurveTo(w * .85, h * .76, w, h * .68); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    x.fillStyle = '#5db85a'; x.beginPath(); x.moveTo(0, h * .8); x.quadraticCurveTo(w * .5, h * .72, w, h * .82); x.lineTo(w, h); x.lineTo(0, h); x.fill(); }],
  sunset: ['🌇 Hoàng hôn', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h * .75, ['#2d2a6e', '#8a3f8f', '#ff7a59', '#ffc56b']); x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffe59a'; x.beginPath(); x.arc(w * .5, h * .66, w * .16, 0, 7); x.fill();
    const r = scRand(7); x.fillStyle = '#2a1f3d'; let xx = 0; while (xx < w) { const bw = w * (.08 + r() * .1), bh = h * (.08 + r() * .14); x.fillRect(xx, h * .75 - bh, bw, bh + 2); xx += bw; }
    x.fillStyle = '#1d1630'; x.fillRect(0, h * .75, w, h * .25);
    x.fillStyle = 'rgba(255,200,120,.35)'; for (let i = 0; i < 6; i++) x.fillRect(w * (.36 + r() * .2), h * (.78 + i * .03), w * (.08 + r() * .1), h * .006); }],
  night: ['🌙 Đêm thành phố', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h, ['#0b1030', '#1b2457', '#3a3f7a']); x.fillRect(0, 0, w, h);
    const r = scRand(3); x.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { const s = r() * w * .004 + 1; x.globalAlpha = .4 + r() * .6; x.fillRect(r() * w, r() * h * .55, s, s); } x.globalAlpha = 1;
    x.fillStyle = '#fff4c9'; x.beginPath(); x.arc(w * .78, h * .14, w * .07, 0, 7); x.fill(); x.fillStyle = '#1b2457'; x.beginPath(); x.arc(w * .81, h * .125, w * .06, 0, 7); x.fill();
    let xx = -w * .02; while (xx < w) { const bw = w * (.1 + r() * .12), bh = h * (.18 + r() * .25), top = h * .8 - bh; x.fillStyle = r() < .5 ? '#161a3a' : '#20254d'; x.fillRect(xx, top, bw, bh + 2);
      x.fillStyle = '#ffd86b'; for (let wy = top + w * .03; wy < h * .78; wy += w * .05) for (let wx = xx + w * .02; wx < xx + bw - w * .03; wx += w * .045) if (r() < .35) x.fillRect(wx, wy, w * .022, w * .026); xx += bw + w * .01; }
    x.fillStyle = '#10132b'; x.fillRect(0, h * .8, w, h * .2); }],
  room: ['🛏 Phòng ngủ', (x, w, h) => {
    const fy = h * .7; scRect(x, '#f3d9c6', 0, 0, w, fy); x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < w; i += w * .1) x.fillRect(i, 0, w * .05, fy);
    scFloor(x, w, h, fy, '#c99a6b', '#b38556', 7); scRect(x, '#e9c6ad', 0, fy - h * .015, w, h * .015);
    scWindow(x, w * .58, h * .16, w * .3, h * .2, ['#8fd0ff', '#d8f1ff']);
    scRound(x, '#7a5c8f', w * .06, h * .2, w * .22, h * .14, w * .01); scRound(x, '#f7f1e8', w * .075, h * .21, w * .19, h * .12, w * .006); x.fillStyle = '#ffb36b'; x.beginPath(); x.arc(w * .17, h * .27, w * .04, 0, 7); x.fill();
    scRound(x, '#8b5e3c', w * .02, fy - h * .12, w * .42, h * .14, w * .01); scRound(x, '#6fa8dc', w * .03, fy - h * .14, w * .4, h * .07, w * .02); scRound(x, '#fff', w * .04, fy - h * .17, w * .12, h * .04, w * .02);
    scRound(x, '#a0714f', w * .78, fy - h * .1, w * .16, h * .1, w * .008); x.fillStyle = '#ffe08a'; x.beginPath(); x.moveTo(w * .82, fy - h * .17); x.lineTo(w * .9, fy - h * .17); x.lineTo(w * .92, fy - h * .12); x.lineTo(w * .8, fy - h * .12); x.fill(); scRect(x, '#555', w * .855, fy - h * .12, w * .01, h * .02); }],
  classroom: ['🏫 Lớp học', (x, w, h) => {
    const fy = h * .68; scRect(x, '#e8f0d8', 0, 0, w, fy); scRect(x, '#c8d6b0', 0, fy - h * .08, w, h * .08);
    scFloor(x, w, h, fy, '#d8b98a', '#c4a273', 6);
    scRound(x, '#8a6a45', w * .08, h * .1, w * .84, h * .24, w * .01); scRect(x, '#2f5d46', w * .1, h * .115, w * .8, h * .21);
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = w * .006; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * .16, h * .17); x.lineTo(w * .45, h * .17); x.moveTo(w * .16, h * .21); x.lineTo(w * .36, h * .21); x.moveTo(w * .55, h * .16); x.lineTo(w * .66, h * .27); x.moveTo(w * .66, h * .16); x.lineTo(w * .55, h * .27); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(w * .8, h * .38, w * .05, 0, 7); x.fill(); x.strokeStyle = '#444'; x.lineWidth = w * .005; x.stroke(); x.beginPath(); x.moveTo(w * .8, h * .38); x.lineTo(w * .8, h * .355); x.moveTo(w * .8, h * .38); x.lineTo(w * .82, h * .385); x.stroke();
    for (const [dx, s] of [[.04, 1], [.62, 1]]) { scRect(x, '#b07a45', w * dx, h * .82, w * .34 * s, h * .03); scRect(x, '#7d5530', w * (dx + .03), h * .85, w * .02, h * .15); scRect(x, '#7d5530', w * (dx + .29), h * .85, w * .02, h * .15); } }],
  street: ['🏙 Đường phố', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h * .6, ['#8fd3ff', '#dff3ff']); x.fillRect(0, 0, w, h); scCloud(x, w * .3, h * .1, w * .05);
    const r = scRand(11), cols = ['#f2a65a', '#e76f51', '#6c9bd2', '#f4d35e', '#9ccc65', '#c792ea'];
    let xx = -w * .03; while (xx < w) { const bw = w * (.22 + r() * .12), bh = h * (.3 + r() * .2), top = h * .7 - bh; scRect(x, cols[(r() * cols.length) | 0], xx, top, bw, bh);
      scRect(x, 'rgba(0,0,0,.12)', xx, top, bw, h * .015);
      for (let wy = top + h * .04; wy < h * .62; wy += h * .07) for (let wx = xx + bw * .14; wx < xx + bw - bw * .2; wx += bw * .3) { scRect(x, '#fff8e6', wx, wy, bw * .18, h * .04); scRect(x, '#7fb7e6', wx + bw * .02, wy + h * .004, bw * .14, h * .032); }
      scRect(x, '#5b3a29', xx + bw * .38, h * .62, bw * .24, h * .08); xx += bw; }
    scRect(x, '#bdbdbd', 0, h * .7, w, h * .05); scRect(x, '#9e9e9e', 0, h * .745, w, h * .008); scRect(x, '#555b66', 0, h * .753, w, h * .25);
    x.fillStyle = '#f5f5f5'; for (let i = 0; i < 5; i++) x.fillRect(w * (i * .24 + .02), h * .87, w * .13, h * .012); }],
  park: ['🌳 Công viên', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h * .6, ['#7cc6ff', '#d4efff']); x.fillRect(0, 0, w, h); scCloud(x, w * .7, h * .12, w * .06); scCloud(x, w * .2, h * .22, w * .04);
    x.fillStyle = '#88d07a'; x.fillRect(0, h * .62, w, h * .38);
    scTree(x, w * .12, h * .64, w * .22); scTree(x, w * .88, h * .66, w * .26, '#4caf50', '#388e3c'); scTree(x, w * .62, h * .6, w * .14, '#66bb6a', '#43a047');
    x.fillStyle = '#e8d3a8'; x.beginPath(); x.moveTo(w * .42, h * .62); x.lineTo(w * .58, h * .62); x.lineTo(w * .95, h); x.lineTo(w * .05, h); x.fill();
    scRect(x, '#8d5a3b', w * .66, h * .74, w * .26, h * .018); scRect(x, '#8d5a3b', w * .66, h * .705, w * .26, h * .015); scRect(x, '#5d3d28', w * .68, h * .758, w * .015, h * .04); scRect(x, '#5d3d28', w * .895, h * .758, w * .015, h * .04);
    const r = scRand(5); for (let i = 0; i < 14; i++) { x.fillStyle = ['#ff6b8a', '#ffd54f', '#fff'][i % 3]; x.beginPath(); x.arc(r() * w * .35, h * (.68 + r() * .28), w * .008, 0, 7); x.fill(); } }],
  office: ['💼 Văn phòng', (x, w, h) => {
    const fy = h * .7; scRect(x, '#dfe6ee', 0, 0, w, fy); scFloor(x, w, h, fy, '#9aa5b1', '#8a95a1', 5);
    scWindow(x, w * .08, h * .1, w * .5, h * .26, ['#6fb8ff', '#cfe9ff'], '#c3ccd6');
    x.fillStyle = '#9fb3c8'; for (let i = 0; i < 5; i++) x.fillRect(w * (.1 + i * .09), h * (.26 - i % 2 * .05), w * .07, h * (.1 + i % 2 * .05));
    scRound(x, '#ffffff', w * .66, h * .12, w * .26, h * .16, w * .01); x.fillStyle = '#4caf50'; x.fillRect(w * .7, h * .22, w * .04, h * .04); x.fillStyle = '#ff9800'; x.fillRect(w * .76, h * .18, w * .04, h * .08); x.fillStyle = '#2196f3'; x.fillRect(w * .82, h * .15, w * .04, h * .11);
    scRect(x, '#6d4c41', w * .1, fy - h * .02, w * .8, h * .03); scRect(x, '#5d4037', w * .14, fy + h * .01, w * .03, h * .14); scRect(x, '#5d4037', w * .83, fy + h * .01, w * .03, h * .14);
    scRound(x, '#263238', w * .58, fy - h * .13, w * .22, h * .1, w * .008); scRect(x, '#4fc3f7', w * .595, fy - h * .12, w * .19, h * .08); scRect(x, '#263238', w * .675, fy - h * .03, w * .03, h * .012);
    scRound(x, '#a1887f', w * .2, fy - h * .07, w * .07, h * .05, w * .01); x.fillStyle = '#43a047'; x.beginPath(); x.ellipse(w * .235, fy - h * .1, w * .05, h * .04, 0, 0, 7); x.fill(); }],
  kitchen: ['🍳 Nhà bếp', (x, w, h) => {
    const fy = h * .72; scRect(x, '#fff7e8', 0, 0, w, fy); x.strokeStyle = '#efe2c8'; x.lineWidth = Math.max(1, w * .003); for (let yy = h * .38; yy < fy; yy += w * .06) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); } for (let xx = 0; xx < w; xx += w * .06) { x.beginPath(); x.moveTo(xx, h * .38); x.lineTo(xx, fy); x.stroke(); }
    scFloor(x, w, h, fy, '#e0a96d', '#c98f55', 6);
    scRound(x, '#7fb3a6', w * .03, h * .08, w * .4, h * .16, w * .01); scRound(x, '#7fb3a6', w * .57, h * .08, w * .4, h * .16, w * .01); x.fillStyle = '#5e8f83'; for (const xx of [.22, .76]) x.fillRect(w * xx, h * .14, w * .025, h * .04);
    scRect(x, '#8fc1b5', 0, fy - h * .17, w, h * .17); scRect(x, '#d7ccc8', 0, fy - h * .19, w, h * .025); x.fillStyle = '#5e8f83'; for (let xx = .1; xx < 1; xx += .25) x.fillRect(w * xx, fy - h * .12, w * .08, h * .01);
    scRect(x, '#455a64', w * .4, fy - h * .215, w * .2, h * .02); x.fillStyle = '#e53935'; x.beginPath(); x.ellipse(w * .47, fy - h * .23, w * .05, h * .015, 0, 0, 7); x.fill(); scRect(x, '#333', w * .52, fy - h * .235, w * .08, h * .008); }],
  beach: ['🏖 Bãi biển', (x, w, h) => {
    x.fillStyle = scGrad(x, 0, 0, 0, h * .5, ['#4fb3ff', '#bfe6ff']); x.fillRect(0, 0, w, h); scCloud(x, w * .3, h * .12, w * .05);
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(w * .82, h * .1, w * .07, 0, 7); x.fill();
    x.fillStyle = scGrad(x, 0, h * .45, 0, h * .66, ['#1e88c9', '#4fc3e8']); x.fillRect(0, h * .45, w, h * .21);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = w * .006; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { const yy = h * (.5 + i * .025), xx = w * ((i * .37) % 1); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + w * .12, yy); x.stroke(); }
    x.fillStyle = '#f6dca0'; x.beginPath(); x.moveTo(0, h * .66); x.quadraticCurveTo(w * .5, h * .62, w, h * .67); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.moveTo(0, h * .66); x.quadraticCurveTo(w * .5, h * .62, w, h * .67); x.lineTo(w, h * .675); x.quadraticCurveTo(w * .5, h * .635, 0, h * .67); x.fill();
    scRect(x, '#8d6e63', w * .14, h * .62, w * .012, h * .2); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#fff' : '#ef5350'; x.beginPath(); x.moveTo(w * .146, h * .6); x.arc(w * .146, h * .64, w * .16, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); x.fill(); } }],
  studio: ['🎨 Phông trơn', (x, w, h) => {
    const g = x.createRadialGradient(w * .5, h * .42, w * .05, w * .5, h * .5, Math.max(w, h) * .75); g.addColorStop(0, '#fff3e0'); g.addColorStop(.6, '#ffcc80'); g.addColorStop(1, '#f57c00'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.ellipse(w * .5, h * .86, w * .38, h * .03, 0, 0, 7); x.fill(); }],
  focus: ['💥 Tập trung', (x, w, h) => {
    scRect(x, '#fffdf5', 0, 0, w, h); const cx = w * .5, cy = h * .45, R = Math.hypot(w, h), r = scRand(9); x.fillStyle = '#1a1a1a';
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2 + r() * .02, da = .006 + r() * .012, r0 = Math.min(w, h) * (.3 + r() * .12); x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a - da) * R, cy + Math.sin(a - da) * R); x.lineTo(cx + Math.cos(a + da) * R, cy + Math.sin(a + da) * R); x.fill(); } }]
};
function drawScene(x, key, w, h) { x.save(); SCENES[key][1](x, w, h); x.restore(); }
async function applyScene(key, onlyThis) {
  if (playing) stopPlay(); commitFloating();
  const f = curFrame(), shared = S.frames.filter(g => g.bgId === f.bgId).length;
  if (onlyThis && shared > 1) await newBg(false);
  const b = bgOf(curFrame()); if (!b) return; await ensureLoaded(b);
  const x = b.canvas.getContext('2d'), before = x.getImageData(0, 0, W, H);
  x.clearRect(0, 0, W, H); drawScene(x, key, W, H);
  pushEntry(pixEntry(b, [0, 0, W, H], before, x.getImageData(0, 0, W, H))); markEdited(b);
  if (S.layer === 'bg') setLayer('char');
  buildStrip(); updateFrameUI(); requestRender();
  const n = S.frames.filter(g => g.bgId === b.id).length;
  toast(`Đã đặt nền "${SCENES[key][0].replace(/^\S+\s/, '')}"${n > 1 ? ` cho ${n} frame dùng chung nền` : ' cho frame này'} — vẽ thêm lên lớp Nền nếu muốn`, 3500);
}
function sceneDialog() {
  const f = curFrame(), shared = S.frames.filter(g => g.bgId === f.bgId).length;
  let only = false; const tw = 96, th = Math.round(tw * H / W);
  modal({ title: '🏞 Nền vẽ sẵn', html: `<p class="lbl" style="margin-top:0">Chạm một nền để đặt sau nhân vật. Nền vẽ bằng code nên vừa mọi khung, dùng thoải mái không lo bản quyền. Có thể vẽ thêm lên lớp Nền.</p>
    ${shared > 1 ? `<div class="mrow" style="gap:6px;margin:6px 0"><span class="lbl">Áp cho:</span><button class="chip small on" data-sco="0">Cả ${shared} frame đang dùng chung nền</button><button class="chip small" data-sco="1">Chỉ frame này (cảnh mới)</button></div>` : ''}
    <div id="scGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${tw + 16}px,1fr));gap:8px;max-height:56vh;overflow:auto;padding:2px"></div>`,
    buttons: [{ label: 'Đóng', value: null }],
    onOpen: (ov, close) => {
      const g = ov.querySelector('#scGrid');
      for (const k of Object.keys(SCENES)) {
        const b = document.createElement('button'); b.className = 'chip'; b.dataset.scene = k; b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;height:auto;min-height:44px';
        const c = makeCanvas(tw * 2, th * 2); drawScene(c.getContext('2d'), k, c.width, c.height); c.style.cssText = `width:${tw}px;height:${th}px;border-radius:6px`; b.append(c);
        const t = document.createElement('span'); t.textContent = SCENES[k][0]; t.style.fontSize = '12px'; b.append(t);
        b.addEventListener('click', () => { close(null); applyScene(k, only); }); g.append(b);
      }
      ov.querySelectorAll('[data-sco]').forEach(b => b.addEventListener('click', () => { only = b.dataset.sco === '1'; ov.querySelectorAll('[data-sco]').forEach(x => x.classList.toggle('on', x === b)); }));
      ov.querySelector('.dlg').style.maxWidth = '720px';
    } });
}
