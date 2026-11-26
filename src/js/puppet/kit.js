/* ===== ⚽ Cầu thủ mẫu: a ready-cut footballer drawn with code (kit colours, pattern, number, skin, hair), every limb already a puppet part
   with its role and joints, so gestures / motion presets / 〰 Đường đi work at once. The head is a plain original face: swap it for your own
   caricature head with 🔄 Đổi hình mảnh (keeps the joint, the poses and the undo history).
   The shirt is a template (👕 Áo đấu, kit-maker.js): colour slots (body / trim / collar, shorts, socks), sleeve stripes drawn along the arm,
   the user's own logo pictures and a typed number + name. The torso has 4 views as picture variants (alts 1..3 = 3/4, side, back): logos on
   the far half get squeezed toward the edge in 3/4, chest logos hide on the side/back views, the number + name show on the back. ===== */
const KIT_COLS = [['#e53935', '#ffffff'], ['#1e88e5', '#ffffff'], ['#fafafa', '#1a237e'], ['#fdd835', '#1b5e20'], ['#43a047', '#ffffff'], ['#212121', '#fdd835'], ['#8e24aa', '#ffffff'], ['#fb8c00', '#212121'], ['#81d4fa', '#ffffff'], ['#b71c1c', '#1565c0']];
const KIT_PATS = { plain: 'Trơn', stripes: 'Sọc dọc', hoops: 'Sọc ngang', half: 'Nửa nửa', sash: 'Sọc chéo' };
const KIT_SKIN = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
const KIT_HAIR = { short: 'Tóc ngắn', spiky: 'Tóc dựng', bun: 'Búi tóc', bald: 'Đầu trọc', curly: 'Tóc xoăn' };
const KIT_HAIRC = ['#1b1b1b', '#5d4037', '#a1887f', '#f9d976', '#c62828'];
const KIT_VIEWS = [['front', 'Trước'], ['q', '3/4'], ['side', 'Nghiêng'], ['back', 'Sau']];   // torso picture 0 + alts 1..3
let kitOpt = { c: 0, pat: 'plain', num: 10, skin: 1, hair: 'short', hc: 0, shorts: '', socks: '', boots: '#212121' };
try { Object.assign(kitOpt, JSON.parse(localStorage.getItem('fs-kit') || '{}')); } catch (e) {}
const KIT_INK = '#1d1d24';
// the colour slots of a kit: picked colours win, else the old preset pair (KIT_COLS[c])
function kitCols(o) {
  const [c1, c2] = KIT_COLS[o.c] || KIT_COLS[0], body = o.body || c1, trim = o.trim || c2;
  return { body, trim, collar: o.collar || trim, shorts: o.shorts || (body === '#fafafa' || body === '#ffffff' ? '#1a237e' : body === '#212121' ? '#212121' : '#fafafa'), socks: o.socks || body };
}
// logo pictures (data URLs, the user's own images) decoded once
const KIT_IMG = new Map();
function kitImg(src) { let im = KIT_IMG.get(src); if (!im) { im = new Image(); im.src = src; KIT_IMG.set(src, im); } return im.complete && im.naturalWidth ? im : null; }
async function kitLogosReady(o) {
  for (const l of (o && o.logos) || []) { kitImg(l.src); const im = KIT_IMG.get(l.src); if (!im.complete) await new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }); }
  if (o && (o.numStyle === 'comic' || o.pname)) await fontsReady();
}
// the pieces in document coordinates (front view, feet near the bottom, big head for the caricature look)
function kitLayout() {
  const u = Math.min(W / 1080, H / 1920), cx = W / 2, ft = H * .86, hip = ft - 285 * u, nk = hip - 235 * u, sh = nk + 28 * u;
  return { u, cx, ft, hip, nk, sh,
    J: { hpL: { x: cx - 46 * u, y: hip }, hpR: { x: cx + 46 * u, y: hip }, knL: { x: cx - 50 * u, y: hip + 135 * u }, knR: { x: cx + 50 * u, y: hip + 135 * u },
      ftL: { x: cx - 52 * u, y: hip + 262 * u }, ftR: { x: cx + 52 * u, y: hip + 262 * u }, shL: { x: cx - 92 * u, y: sh }, shR: { x: cx + 92 * u, y: sh },
      elL: { x: cx - 112 * u, y: sh + 105 * u }, elR: { x: cx + 112 * u, y: sh + 105 * u }, haL: { x: cx - 120 * u, y: sh + 200 * u }, haR: { x: cx + 120 * u, y: sh + 200 * u },
      neck: { x: cx, y: nk }, root: { x: cx, y: hip } } };
}
function kitFill(x, o, a, b, w, h, vertical) {   // the shirt pattern over a rectangle, clipped by the caller
  const K = kitCols(o); x.fillStyle = K.body; x.fillRect(a, b, w, h); x.fillStyle = K.trim;
  if (o.pat === 'stripes') { const s = w / 7; for (let i = 1; i < 7; i += 2) x.fillRect(a + i * s, b, s, h); }
  else if (o.pat === 'hoops') { const s = Math.max(8, h / 7); for (let yy = b + s; yy < b + h; yy += s * 2) x.fillRect(a, yy, w, s); }
  else if (o.pat === 'half' && !vertical) x.fillRect(a + w / 2, b, w / 2, h);
  else if (o.pat === 'sash' && !vertical) { x.beginPath(); x.moveTo(a, b + h * .05); x.lineTo(a + w * .28, b); x.lineTo(a + w, b + h * .72); x.lineTo(a + w, b + h); x.closePath(); x.fill(); }
}
function kitCapsule(x, p0, p1, r0, r1) {   // a limb: rounded at both joints so it bends cleanly
  const a = Math.atan2(p1.y - p0.y, p1.x - p0.x), n = a + Math.PI / 2;
  x.beginPath(); x.arc(p0.x, p0.y, r0, n, n + Math.PI); x.lineTo(p1.x - Math.cos(n) * r1, p1.y - Math.sin(n) * r1); x.arc(p1.x, p1.y, r1, n + Math.PI, n + Math.PI * 2); x.closePath();
}
// stripes drawn ALONG a limb (pivot → tip), so they turn and bend with the arm / leg; off = offsets across the limb
function kitLimbStripes(x, p0, p1, from, to, offs, w, col) {
  const l = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1, ux = (p1.x - p0.x) / l, uy = (p1.y - p0.y) / l;
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'butt';
  for (const o of offs) { x.beginPath(); x.moveTo(p0.x + ux * from - uy * o, p0.y + uy * from + ux * o); x.lineTo(p0.x + ux * to - uy * o, p0.y + uy * to + ux * o); x.stroke(); }
  x.lineCap = 'round';
}
function kitBoxCanvas(box, draw) {
  const [x0, y0, x1, y1] = box.map(Math.round), c = makeCanvas(Math.max(1, x1 - x0), Math.max(1, y1 - y0)), x = c.getContext('2d');
  x.translate(-x0, -y0); x.lineJoin = 'round'; x.lineCap = 'round'; draw(x); return c;
}
function kitPart(name, role, box, pv, tip, z, draw) {
  const [x0, y0] = box.map(Math.round), c = kitBoxCanvas(box, draw);
  return { id: newId(), name, role, parent: null, z, ox: x0, oy: y0, px: pv.x, py: pv.y, c, tip: tip ? { x: tip.x, y: tip.y } : null };
}
/* --- the number, the name and the logos (stickers) on a shirt. B = the shirt's box (x, y, w, h); logo x/y are 0..1 inside it, s = width / B.w.
   Used for the drawn player and, clipped to the picture, for a character the user drew (kit-maker.js). --- */
function kitNum(x, o, s, X, Y, size) {
  const K = kitCols(o), st = o.numStyle || '';
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  if (!st) {   // the first look of ⚽ Cầu thủ mẫu
    x.font = `900 ${Math.round(size)}px system-ui,-apple-system,sans-serif`; x.lineWidth = size * .08; x.strokeStyle = o.pat === 'plain' ? 'rgba(0,0,0,.25)' : K.body; x.strokeText(s, X, Y); x.fillStyle = o.pat === 'plain' ? K.trim : '#ffffff'; x.fillText(s, X, Y);
  } else {
    const col = o.numC || K.trim;
    x.font = st === 'comic' ? `${Math.round(size * 1.12)}px Bangers,'Arial Black',sans-serif` : `900 ${Math.round(size)}px 'Arial Black',system-ui,-apple-system,sans-serif`;
    if (st === 'outline') { x.lineWidth = size * .15; x.strokeStyle = col; x.strokeText(s, X, Y); x.fillStyle = K.body; x.fillText(s, X, Y); }   // hollow two-tone block
    else { x.lineWidth = size * .1; x.strokeStyle = 'rgba(0,0,0,.3)'; x.strokeText(s, X, Y); x.fillStyle = col; x.fillText(s, X, Y); }
  }
  x.restore();
}
const kitNumStr = o => String(o.num == null ? '' : o.num).replace(/\D/g, '').slice(0, 2);
function kitDecals(x, o, B, face) {
  if (face === 'front') for (const l of o.logos || []) {
    const im = kitImg(l.src); if (!im) continue; const w = l.s * B.w, h = w * im.naturalHeight / im.naturalWidth;
    x.drawImage(im, B.x + l.x * B.w - w / 2, B.y + l.y * B.h - h / 2, w, h);
  }
  const num = kitNumStr(o), pos = o.numPos || 'front';
  if (num && face === 'front' && pos !== 'back') { if (pos === 'both') kitNum(x, o, num, B.x + B.w * .5, B.y + B.h * .25, B.w * .17); else kitNum(x, o, num, B.x + B.w / 2, B.y + B.h * .474, B.w * .43); }
  if (num && face === 'back' && pos !== 'front') kitNum(x, o, num, B.x + B.w / 2, B.y + B.h * .52, B.w * .56);
  if (face === 'back' && o.pname) {
    const K = kitCols(o), sz = B.w * .14; x.save(); x.font = `${Math.round(sz)}px Bangers,'Arial Black',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = String(o.pname).toUpperCase().slice(0, 14), k = Math.min(1, B.w * .8 / Math.max(1, x.measureText(t).width));
    x.translate(B.x + B.w / 2, B.y + B.h * .2); x.scale(k, 1); x.lineWidth = sz * .1; x.strokeStyle = 'rgba(0,0,0,.3)'; x.strokeText(t, 0, 0); x.fillStyle = o.numC || K.trim; x.fillText(t, 0, 0); x.restore();
  }
}
function kitShirtBox(L) { const { u, cx } = L; return { x: cx - 100 * u, y: L.nk, w: 200 * u, h: L.hip + 18 * u - L.nk }; }
function kitTorsoBox(L) { const { u, cx } = L; return [cx - 120 * u, L.nk - 50 * u, cx + 120 * u, L.hip + 70 * u].map(Math.round); }
// the shirt seen from the front or the back (plain = no logos / number, for the side view)
function kitShirt(x, o, L, face, plain) {
  const { u, cx } = L, K = kitCols(o), top = L.nk, bot = L.hip + 18 * u, lw = 5 * u, dip = face === 'back' ? 9 * u : 30 * u;
  const body = () => { x.beginPath(); x.moveTo(cx - 40 * u, top); x.quadraticCurveTo(cx - 100 * u, top + 6 * u, cx - 106 * u, L.sh + 30 * u); x.lineTo(cx - 90 * u, bot); x.lineTo(cx + 90 * u, bot); x.lineTo(cx + 106 * u, L.sh + 30 * u); x.quadraticCurveTo(cx + 100 * u, top + 6 * u, cx + 40 * u, top); x.quadraticCurveTo(cx, top + dip, cx - 40 * u, top); x.closePath(); };
  body(); x.save(); x.clip(); kitFill(x, o, cx - 110 * u, top - 5 * u, 220 * u, bot - top + 10 * u, false); if (!plain) kitDecals(x, o, kitShirtBox(L), face); x.restore();
  body(); x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke();
  x.beginPath(); x.moveTo(cx - 40 * u, top); x.quadraticCurveTo(cx, top + dip, cx + 40 * u, top); x.strokeStyle = K.collar; x.lineWidth = 9 * u; x.stroke(); x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke();
}
// the torso piece (neck + shorts + shirt) in one view. 3/4 and side: the shirt drawn front-on is squeezed, the near half a little and the
// far half a lot, so what is printed on the far half gets thin and slides to the edge (like it turns away). The shorts stay over the legs.
function kitTorsoCanvas(o, L, view = 'front', skin = KIT_SKIN[1]) {
  const { u, cx } = L, K = kitCols(o), box = kitTorsoBox(L), lw = 5 * u;
  const ink = x => { x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke(); };
  return kitBoxCanvas(box, x => {
    x.beginPath(); x.rect(cx - 30 * u, L.nk - 42 * u, 60 * u, 62 * u); x.fillStyle = skin; x.fill(); ink(x);   // the neck stays on the body, so any new head sits on it
    const bot = L.hip + 18 * u;
    x.beginPath(); x.moveTo(cx - 92 * u, bot - 14 * u); x.lineTo(cx + 92 * u, bot - 14 * u); x.lineTo(cx + 98 * u, L.hip + 62 * u); x.lineTo(cx + 6 * u, L.hip + 62 * u); x.lineTo(cx, L.hip + 30 * u); x.lineTo(cx - 6 * u, L.hip + 62 * u); x.lineTo(cx - 98 * u, L.hip + 62 * u); x.closePath();
    x.fillStyle = K.shorts; x.fill(); ink(x);
    const sc = kitBoxCanvas(box, y => kitShirt(y, o, L, view === 'back' ? 'back' : 'front', view === 'side'));
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    if (view === 'q' || view === 'side') {
      const [wl, wr] = view === 'q' ? [.97, .66] : [.84, .46], m = Math.round(cx) - box[0], w2 = sc.width - m;
      x.drawImage(sc, 0, 0, m, sc.height, m - m * wl, 0, m * wl, sc.height); x.drawImage(sc, m, 0, w2, sc.height, m, 0, w2 * wr, sc.height);
    } else x.drawImage(sc, 0, 0);
    x.restore();
  });
}
function kitHeadBox(L) { const { u, cx } = L, hcY = L.nk - 150 * u, hr = 128 * u; return [cx - hr - 40 * u, hcY - hr - 70 * u, cx + hr + 40 * u, hcY + hr * 1.04 + 6 * u]; }
// the head: a plain friendly face (original), big for the caricature look; back = the back of the head (hair, ears) for the back view
function kitHeadDraw(x, o, L, back) {
  const { u, cx } = L, lw = 5 * u, skin = KIT_SKIN[o.skin] || KIT_SKIN[1], hairC = KIT_HAIRC[o.hc] || KIT_HAIRC[0], hcY = L.nk - 150 * u, hr = 128 * u;
  const ink = () => { x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke(); };
  if (o.hair === 'curly') { x.fillStyle = hairC; for (let i = 0; i < 11; i++) { const a = Math.PI * (1.02 + i * .096); x.beginPath(); x.arc(cx + Math.cos(a) * hr * .98, hcY + Math.sin(a) * hr * .98, 34 * u, 0, 7); x.fill(); } }
  if (o.hair === 'bun') { x.beginPath(); x.arc(cx, hcY - hr - 18 * u, 42 * u, 0, 7); x.fillStyle = hairC; x.fill(); ink(); }
  x.beginPath(); x.ellipse(cx - hr * .98, hcY + 10 * u, 22 * u, 32 * u, 0, 0, 7); x.ellipse(cx + hr * .98, hcY + 10 * u, 22 * u, 32 * u, 0, 0, 7); x.fillStyle = skin; x.fill(); ink();
  x.beginPath(); x.ellipse(cx, hcY, hr * .95, hr * 1.04, 0, 0, 7); x.fillStyle = skin; x.fill(); ink();
  if (back) {
    if (o.hair !== 'bald') { x.save(); x.beginPath(); x.ellipse(cx, hcY, hr * .95, hr * 1.04, 0, 0, 7); x.clip(); x.beginPath(); x.ellipse(cx, hcY - hr * .18, hr * 1.02, hr * .98, 0, 0, 7); x.fillStyle = hairC; x.fill(); x.restore(); x.beginPath(); x.ellipse(cx, hcY, hr * .95, hr * 1.04, 0, 0, 7); ink(); }
    else { x.beginPath(); x.ellipse(cx + hr * .3, hcY - hr * .55, hr * .22, hr * .1, .5, 0, 7); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill(); }
    if (o.hair === 'spiky') { x.beginPath(); x.moveTo(cx - hr * .95, hcY - hr * .2); for (let i = 0; i <= 8; i++) { const t = i / 8, xx = cx - hr * .95 + t * hr * 1.9, base = hcY - hr * (.2 + Math.sin(t * Math.PI) * .75); x.lineTo(xx - hr * .1, base); x.lineTo(xx + hr * .05, base - hr * .38 * Math.sin(t * Math.PI + .3)); } x.lineTo(cx + hr * .95, hcY - hr * .2); x.closePath(); x.fillStyle = hairC; x.fill(); ink(); }
    return;
  }
  if (o.hair === 'short' || o.hair === 'bun' || o.hair === 'curly') { x.beginPath(); x.ellipse(cx, hcY - hr * .28, hr * .97, hr * .8, 0, Math.PI * 1.02, Math.PI * 1.98); x.quadraticCurveTo(cx + hr * .5, hcY - hr * .5, cx, hcY - hr * .42); x.quadraticCurveTo(cx - hr * .55, hcY - hr * .55, cx - hr * .95, hcY - hr * .3); x.closePath(); x.fillStyle = hairC; x.fill(); ink(); }
  else if (o.hair === 'spiky') { x.beginPath(); x.moveTo(cx - hr * .95, hcY - hr * .2); for (let i = 0; i <= 8; i++) { const t = i / 8, xx = cx - hr * .95 + t * hr * 1.9, base = hcY - hr * (.2 + Math.sin(t * Math.PI) * .75); x.lineTo(xx - hr * .1, base); x.lineTo(xx + hr * .05, base - hr * .38 * Math.sin(t * Math.PI + .3)); } x.lineTo(cx + hr * .95, hcY - hr * .2); x.quadraticCurveTo(cx, hcY - hr * .5, cx - hr * .95, hcY - hr * .2); x.closePath(); x.fillStyle = hairC; x.fill(); ink(); }
  else { x.beginPath(); x.ellipse(cx - hr * .35, hcY - hr * .6, hr * .22, hr * .1, -.5, 0, 7); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill(); }
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * hr * .36, hcY + hr * .02, hr * .17, hr * .2, 0, 0, 7); x.fillStyle = '#fff'; x.fill(); ink();
    x.beginPath(); x.arc(cx + s * hr * .33, hcY + hr * .05, hr * .085, 0, 7); x.fillStyle = KIT_INK; x.fill();
    x.beginPath(); x.moveTo(cx + s * hr * .18, hcY - hr * .3); x.quadraticCurveTo(cx + s * hr * .36, hcY - hr * .4, cx + s * hr * .56, hcY - hr * .28); x.strokeStyle = o.hair === 'bald' ? KIT_INK : hairC; x.lineWidth = 10 * u; x.stroke(); }
  x.beginPath(); x.moveTo(cx - hr * .04, hcY + hr * .16); x.quadraticCurveTo(cx + hr * .14, hcY + hr * .36, cx - hr * .06, hcY + hr * .4); x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke();
  x.beginPath(); x.moveTo(cx - hr * .3, hcY + hr * .56); x.quadraticCurveTo(cx, hcY + hr * .78, cx + hr * .3, hcY + hr * .56); x.stroke();
}
// everything that a kit change redraws is kept with the player: torso.kit = {gen, o: the options}, other drawn pieces {gen}
// (saved through ppPartMeta, so 👕 Áo đấu can redraw the shirt later, also after 🧍 Kho nhân vật / 📮 / ZIP)
const kitPickAll = o => JSON.parse(JSON.stringify(o));
function kitParts(o = kitOpt) {
  const L = kitLayout(), { u, cx, J } = L, lw = 5 * u, skin = KIT_SKIN[o.skin] || KIT_SKIN[1], K = kitCols(o), sl = o.sleeve || 'cuff';
  const ink = x => { x.strokeStyle = KIT_INK; x.lineWidth = lw; x.stroke(); };
  const P = {};
  // torso: shirt (pattern, collar, logos, number) + shorts, with its 3 other views as picture variants
  P.torso = kitPart('Thân', 'torso', kitTorsoBox(L), J.root, { x: cx, y: L.nk }, 3, x => { const b = kitTorsoBox(L); x.drawImage(kitTorsoCanvas(o, L, 'front', skin), b[0], b[1]); });
  P.torso.alts = KIT_VIEWS.slice(1).map(([v]) => ({ c: kitTorsoCanvas(o, L, v, skin), dx: 0, dy: 0 }));
  // legs: thigh (shorts at the top, skin), shin (sock + boot)
  for (const s of ['L', 'R']) {
    const hp = J['hp' + s], kn = J['kn' + s], ftp = J['ft' + s], side = s === 'L' ? -1 : 1, nm = s === 'L' ? 'trái' : 'phải';
    P['leg' + s] = kitPart('Đùi ' + nm, 'leg' + s, [hp.x - 40 * u, hp.y - 40 * u, hp.x + 40 * u, kn.y + 36 * u], hp, kn, 1, x => {
      kitCapsule(x, hp, kn, 34 * u, 27 * u); x.fillStyle = skin; x.fill(); x.save(); x.clip(); x.fillStyle = K.shorts; x.fillRect(hp.x - 50 * u, hp.y - 50 * u, 100 * u, 105 * u);
      if (sl === 'line' || sl === 'twin') { x.save(); x.beginPath(); x.rect(hp.x - 50 * u, hp.y - 50 * u, 100 * u, 105 * u); x.clip(); kitLimbStripes(x, hp, kn, -40 * u, 60 * u, sl === 'twin' ? [-side * 22 * u, -side * 30 * u] : [-side * 25 * u], 5 * u, K.trim); x.restore(); }
      x.restore(); kitCapsule(x, hp, kn, 34 * u, 27 * u); ink(x); });
    P['shin' + s] = kitPart('Ống chân ' + nm, 'shin' + s, [kn.x - 36 * u + Math.min(0, side) * 30 * u, kn.y - 34 * u, kn.x + 36 * u + Math.max(0, side) * 30 * u, ftp.y + 40 * u], kn, ftp, 0, x => {
      kitCapsule(x, kn, ftp, 26 * u, 21 * u); x.fillStyle = K.socks; x.fill(); x.save(); x.clip(); x.fillStyle = skin; x.fillRect(kn.x - 40 * u, kn.y - 40 * u, 80 * u, 50 * u); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(kn.x - 40 * u, kn.y + 18 * u, 80 * u, 9 * u); x.restore(); kitCapsule(x, kn, ftp, 26 * u, 21 * u); ink(x);
      x.beginPath(); x.moveTo(ftp.x - 24 * u, ftp.y - 14 * u); x.lineTo(ftp.x + 18 * u, ftp.y - 14 * u); x.quadraticCurveTo(ftp.x + side * 62 * u + 6 * u * side, ftp.y + 2 * u, ftp.x + side * 58 * u, ftp.y + 24 * u); x.lineTo(ftp.x - side * 26 * u, ftp.y + 24 * u); x.quadraticCurveTo(ftp.x - side * 30 * u, ftp.y, ftp.x - 24 * u, ftp.y - 14 * u); x.closePath();
      x.fillStyle = o.boots || '#212121'; x.fill(); ink(x); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(ftp.x - 14 * u, ftp.y + 2 * u, 26 * u, 5 * u); });
  }
  // arms: short sleeve + skin (sleeve trim: a cuff, or stripes running down the arm), forearm with a round hand
  for (const s of ['L', 'R']) {
    const shp = J['sh' + s], el = J['el' + s], ha = J['ha' + s], nm = s === 'L' ? 'trái' : 'phải';
    P['arm' + s] = kitPart('Tay ' + nm + ' (trên)', 'arm' + s, [Math.min(shp.x, el.x) - 38 * u, shp.y - 38 * u, Math.max(shp.x, el.x) + 38 * u, el.y + 30 * u], shp, el, 4, x => {
      kitCapsule(x, shp, el, 29 * u, 22 * u); x.fillStyle = skin; x.fill(); x.save(); x.clip();
      x.save(); x.beginPath(); x.rect(shp.x - 45 * u, shp.y - 45 * u, 90 * u, 100 * u); x.clip(); kitFill(x, { ...o, pat: o.pat === 'stripes' ? 'plain' : o.pat }, shp.x - 45 * u, shp.y - 45 * u, 90 * u, 100 * u, true);
      if (sl === 'line') kitLimbStripes(x, shp, el, -35 * u, 70 * u, [0], 7 * u, K.trim); else if (sl === 'twin') kitLimbStripes(x, shp, el, -35 * u, 70 * u, [-7 * u, 7 * u], 5 * u, K.trim);
      x.restore();
      if (sl === 'cuff') { x.fillStyle = K.trim; x.fillRect(shp.x - 45 * u, shp.y + 48 * u, 90 * u, 7 * u); }
      x.restore(); kitCapsule(x, shp, el, 29 * u, 22 * u); ink(x); });
    P['fore' + s] = kitPart('Cẳng tay ' + nm, 'fore' + s, [Math.min(el.x, ha.x) - 40 * u, el.y - 30 * u, Math.max(el.x, ha.x) + 40 * u, ha.y + 40 * u], el, ha, 5, x => {
      kitCapsule(x, el, ha, 21 * u, 17 * u); x.fillStyle = skin; x.fill(); ink(x);
      x.beginPath(); x.arc(ha.x, ha.y + 12 * u, 25 * u, 0, 7); x.fillStyle = skin; x.fill(); ink(x); });
  }
  // head: pivot at the neck; picture variant 1 = the back of the head (👕 Góc áo: Sau)
  const hb = kitHeadBox(L), hcY = L.nk - 150 * u;
  P.head = kitPart('Đầu', 'head', hb, { x: cx, y: L.nk - 4 * u }, { x: cx, y: hcY }, 6, x => kitHeadDraw(x, o, L, false));
  P.head.alts = [{ c: kitBoxCanvas(hb, x => kitHeadDraw(x, o, L, true)), dx: 0, dy: 0 }];
  P.head.name = 'Đầu (thay bằng đầu biếm hoạ)';
  // hierarchy like a cut character
  for (const s of ['L', 'R']) { P['leg' + s].parent = P.torso.id; P['shin' + s].parent = P['leg' + s].id; P['arm' + s].parent = P.torso.id; P['fore' + s].parent = P['arm' + s].id; }
  P.head.parent = P.torso.id;
  for (const p of Object.values(P)) p.kit = { gen: 1 };
  P.torso.kit = { gen: 1, o: kitPickAll(o) };
  return Object.values(P);
}
function kitPreview(o, size = 220) {
  const parts = kitParts(o); return charThumb(parts.sort((a, b) => a.z - b.z), size);
}
async function kitAdd(o = kitOpt) {
  if (playing) stopPlay(); commitFloating();
  await kitLogosReady(o);
  const parts = kitParts(o); ppRenormZ0(parts);
  for (const p of parts) { await encodePart(p); for (const a of p.alts || []) await encodeHolder(a); }
  const others = S.pp ? S.pp.parts.filter(q => !q.parent).length : 0, suf = others ? ` (NV${others + 1})` : '';
  const zb = S.pp && S.pp.parts.length ? Math.max(...S.pp.parts.map(q => q.z)) + 1 : 0;
  parts.forEach(q => { q.z = zb + q.z * 0.01; q.name += suf; });
  ppPushChar(parts);
  ppSel = parts.find(q => q.role === 'head').id;
  ppShowAdded();
  toast('Đã thêm cầu thủ — đang chọn Đầu: bấm 🔄 Đổi hình mảnh (tab Mảnh & hình) để thay bằng đầu biếm hoạ của bạn', 5000);
  return parts;
}
function kitDialog() {
  const o = { ...kitOpt }, chip = (attr, v, on, html, extra = '') => `<button class="chip small ${on ? 'on' : ''}" data-${attr}="${v}" ${extra}>${html}</button>`;
  const dot = c => `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c};border:2px solid #0006;vertical-align:middle"></span>`;
  modal({ title: '⚽ Cầu thủ mẫu', html: `<p class="lbl" style="margin-top:0">Nhân vật đã cắt sẵn từng mảnh (đầu, thân, tay, chân có khớp) — tạo dáng, cử chỉ, đường đi dùng được ngay. Sau đó thay <b>Đầu</b> bằng đầu biếm hoạ của bạn bằng 🔄 Đổi hình mảnh.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start"><div id="kitPrev" style="background:#fff;border-radius:10px;width:220px;height:220px;flex:none"></div>
    <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:8px">
      <div><span class="lbl">Màu áo</span><br>${KIT_COLS.map((c, i) => chip('kc', i, o.c === i, dot(c[0]) + dot(c[1]), 'style="min-width:56px"')).join(' ')}</div>
      <div><span class="lbl">Kiểu áo</span><br>${Object.entries(KIT_PATS).map(([k, v]) => chip('kp', k, o.pat === k, v)).join(' ')}</div>
      <div><span class="lbl">Số áo</span> <input id="kitNum" type="text" inputmode="numeric" maxlength="2" value="${String(o.num).replace(/\D/g, '')}" style="width:64px;height:40px;font-size:18px;text-align:center"></div>
      <div><span class="lbl">Màu da</span><br>${KIT_SKIN.map((c, i) => chip('ks', i, o.skin === i, dot(c))).join(' ')}</div>
      <div><span class="lbl">Tóc</span><br>${Object.entries(KIT_HAIR).map(([k, v]) => chip('kh', k, o.hair === k, v)).join(' ')}<br>${KIT_HAIRC.map((c, i) => chip('khc', i, o.hc === i, dot(c))).join(' ')}</div>
    </div></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '👕 Áo đấu chi tiết…', value: 'maker' }, { label: '＋ Thêm cầu thủ', value: 'add', primary: true }],
    onOpen: ov => {
      const prev = () => { const c = kitPreview(o); c.style.cssText = 'width:220px;height:220px'; const p = ov.querySelector('#kitPrev'); p.innerHTML = ''; p.append(c); };
      const grp = (attr, set) => ov.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => { set(b.dataset[attr.replace(/-./g, m => m[1].toUpperCase())]); ov.querySelectorAll(`[data-${attr}]`).forEach(x => x.classList.toggle('on', x === b)); prev(); }));
      grp('kc', v => { o.c = +v; delete o.body; delete o.trim; delete o.collar; o.shorts = o.socks = ''; }); grp('kp', v => o.pat = v); grp('ks', v => o.skin = +v); grp('kh', v => o.hair = v); grp('khc', v => o.hc = +v);
      ov.querySelector('#kitNum').addEventListener('input', e => { o.num = e.target.value.replace(/\D/g, '').slice(0, 2); prev(); });
      ov.querySelector('.dlg').style.maxWidth = '640px'; prev();
    } }).then(v => { if (v === 'maker') { kitMaker(null, o); return; } if (v !== 'add') return; kitOpt = o; try { localStorage.setItem('fs-kit', JSON.stringify(o)); } catch (e) {} kitAdd(o).then(ps => ppAskNew(ps && ps[0] && ppCharOf(ps[0]))); });
}
/* --- 🔄 Đổi hình mảnh: put another picture (e.g. a caricature head) on the selected part, keeping its joint, poses and children.
   The new picture is fitted to the old piece's height, centred, its bottom on the old bottom (a head sits on the neck). White paper
   touching the edges becomes transparent. A new canvas (never edited in place) → the automatic undo snapshot keeps the old one. --- */
async function ppSwapImage(file) {
  const p = ppPart(ppSel); if (!p) { toast('Chạm chọn mảnh cần đổi hình trước'); return false; }
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { toast('Không đọc được ảnh'); return false; }
  const k0 = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), sw = Math.max(1, Math.round(bmp.width * k0)), sh = Math.max(1, Math.round(bmp.height * k0));
  const src = makeCanvas(sw, sh), sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(bmp, 0, 0, sw, sh); if (bmp.close) bmp.close();
  const img = sx.getImageData(0, 0, sw, sh), d = img.data; let opaque = 0;
  for (const i of [0, sw - 1, (sh - 1) * sw, sh * sw - 1]) if (d[i * 4 + 3] > 250) opaque++;
  if (opaque >= 3) { const fig = aiWhiteMask(img); for (let i = 0; i < sw * sh; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * fig[i]); sx.putImageData(img, 0, 0); }
  // crop to what is drawn
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1; for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { toast('Ảnh trống (toàn nền trắng/trong suốt)'); return false; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = p.c.height / ch, nw = Math.max(1, Math.round(cw * k)), nh = Math.max(1, Math.round(ch * k));
  const c = makeCanvas(nw, nh), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, x0, y0, cw, ch, 0, 0, nw, nh); src.width = 0;
  const midX = p.ox + p.c.width / 2, bot = p.oy + p.c.height;
  p.c = c; p.ox = Math.round(midX - nw / 2); p.oy = Math.round(bot - nh); p.alts = []; delete p.asset; delete p.kit;   // a new picture: 👕 Áo đấu no longer redraws this piece
  S.frames.forEach(f => { const q = f.pp && f.pp[p.id]; if (q && q.v) f.pp[p.id] = { ...q, v: 0 }; });   // the old picture's variants are gone
  await encodePart(p);
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender();
  toast('Đã đổi hình mảnh — lỡ tay thì ↶ Hoàn tác', 3000); return true;
}
function ppSwapPick() {
  if (!ppPart(ppSel)) { toast('Chạm chọn mảnh cần đổi hình trước (vd. Đầu)'); return; }
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { if (i.files[0]) ppSwapImage(i.files[0]); }; i.click();
}
$('#kitBtn0').addEventListener('click', kitDialog);
$('#kitBtn').addEventListener('click', kitDialog);
$('#ppSwapBtn').addEventListener('click', ppSwapPick);
$('#ppLibSave').addEventListener('click', charLibSave);
