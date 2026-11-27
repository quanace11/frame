/* ===== 🦴 Xưởng ghép xương: a workshop of its own to build a cut-out character from separate pieces =====
   For pieces made elsewhere (an AI picture with the head, body, arms, legs drawn apart on white paper): ＋ Ảnh mảnh takes
   one or more pictures, removes the white paper touching the edge (aiWhiteMask) and splits every loose piece into its own
   piece. Then, on one screen:
   ✋ Ghép   drag a piece (its attached pieces come along), the round knob turns + resizes it, ⏫ ⏬ ↔ ⧉ 🗑, ✂ Khoanh tách
             (lasso part of a piece off into a new piece, joined where it was cut)
   🦴 Xương  drag from a piece onto another = attach it there, the joint where the drag started; drag a joint dot = move the
             joint; 🪄 Tự gắn xương attaches the loose pieces where they overlap (+ guesses head / arms / legs)
   ✎ Vẽ     brush / eraser / fill / colour picker on the selected piece (the real brush engine, like ✎ Vẽ lại mảnh)
   🤸 Thử    drag a piece = bend it round its joint (only a preview), 🔄 Lắc thử swings every joint
   ✓ Xong bakes each piece (position, size, turn, flip) into a part picture, the joints become pivots and the pieces a
   character (ppPushChar, one undo step) that animates like any cut character; ✏ Sửa nhân vật này opens a character that is
   already in the project (rest pose) and ✓ Xong writes the pieces back into it, same ids, so every frame keeps its poses.
   The workshop keeps its own undo (RS.undo) and, for a new character, a draft in IndexedDB (`rig-studio`) so closing the
   app does not lose the pieces. Piece = {id, name, role, c, x, y, ax, ay, s, r, fl, parent, jx, jy, z, src, ao, alts}:
   canvas pixel (u, v) → frame point = T(x, y)·R(r)·S(±s, s)·T(−ax, −ay); the joint (jx, jy) is in the piece's own pixels,
   so it moves with the piece. --- */
let RS = null;
const RS_KEY = 'rig-studio', RS_UNDO = 80;
const rsAlphaC = new WeakMap();
function rsAlpha(c) {
  let a = rsAlphaC.get(c); if (a) return a;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; a = new Uint8Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  rsAlphaC.set(c, a); return a;
}
const rsPc = id => RS && RS.pcs.find(p => p.id === id);
const rsA = p => mMul(mMul(mMul(mT(p.x, p.y), mR(p.r * DEG)), mS(p.s * (p.fl ? -1 : 1), p.s)), mT(-p.ax, -p.ay));
const rsJL = p => p.jx == null ? { x: p.c.width / 2, y: p.c.height / 2 } : { x: p.jx, y: p.jy };
const rsJD = p => { const l = rsJL(p); return mApply(rsA(p), l.x, l.y); };
const rsKids = id => RS.pcs.filter(p => p.parent === id);
function rsDesc(id) { const out = []; const walk = (k, n) => { if (n > 40) return; for (const c of rsKids(k)) { out.push(c); walk(c.id, n + 1); } }; walk(id, 0); return out; }
const rsIsDesc = (a, b) => rsDesc(a.id).includes(b);   // b hangs (somewhere) under a
const rsRoots = () => RS.pcs.filter(p => !p.parent);
const rsShift = (p, dx, dy) => { p.ax += dx; p.ay += dy; if (p.jx != null) { p.jx += dx; p.jy += dy; } p.ao = { x: p.ao.x + dx, y: p.ao.y + dy }; };
// posed matrices (🤸 Thử): every piece turns round its own joint, children follow; elsewhere the pieces lie as placed
function rsMats() {
  const P = {}, by = new Map(RS.pcs.map(p => [p.id, p])), pose = RS.mode === 'pose' ? RS.pose : {};
  const get = (p, g = 0) => {
    if (P[p.id]) return P[p.id];
    const J = rsJD(p), a = (pose[p.id] || 0) * DEG; let L = a ? mMul(mMul(mT(J.x, J.y), mR(a)), mT(-J.x, -J.y)) : [1, 0, 0, 1, 0, 0];
    const par = p.parent && g < 40 && by.get(p.parent); if (par) L = mMul(get(par, g + 1), L);
    return (P[p.id] = L);
  };
  const M = {}; RS.pcs.forEach(p => { M[p.id] = mMul(get(p), rsA(p)); }); return { P, M };
}
function rsHit(pt, skip) {
  const { M } = rsMats();
  for (const p of [...RS.pcs].sort((a, b) => b.z - a.z)) {
    if (p === skip) continue;
    const l = mApply(mInv(M[p.id]), pt.x, pt.y), x = Math.floor(l.x), y = Math.floor(l.y);
    if (x < 0 || y < 0 || x >= p.c.width || y >= p.c.height) continue;
    if (rsAlpha(p.c)[y * p.c.width + x] > 30) return p;
  }
  return null;
}
const rsCorners = (M, c) => [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]].map(([u, v]) => mApply(M, u, v));
/* --- undo inside the workshop (piece fields + canvas refs: a canvas is never changed in place) --- */
const rsSnap = () => ({ pcs: RS.pcs.map(p => ({ ...p, ao: { ...p.ao } })), sel: RS.sel });
function rsPush() { RS.undo.push(rsSnap()); if (RS.undo.length > RS_UNDO) RS.undo.shift(); RS.redo.length = 0; RS.dirty = true; }
function rsPutBack(g) { RS.pcs = g.pcs.map(p => ({ ...p, ao: { ...p.ao } })); RS.sel = rsPc(g.sel) ? g.sel : null; rsChanged(); }
function rsUndo() { if (!RS.undo.length) { toast('Không còn gì để hoàn tác'); return; } RS.redo.push(rsSnap()); rsPutBack(RS.undo.pop()); }
function rsRedo() { if (!RS.redo.length) return; RS.undo.push(rsSnap()); rsPutBack(RS.redo.pop()); }
function rsChanged() { rsSync(); rsDraw(); rsDraftSoon(); }
/* --- pictures → pieces: white paper touching the edge goes, every loose piece is its own piece --- */
let rsN = 0;
function rsNewPiece(c, o) {
  rsN++; const z = RS.pcs.reduce((m, q) => Math.max(m, q.z), -1) + 1;
  return { id: newId(), name: o.name || 'Mảnh ' + rsN, role: o.role || '', c, x: o.x, y: o.y, ax: c.width / 2, ay: c.height / 2, s: o.s || 1, r: 0, fl: false, parent: null, jx: null, jy: null, z, src: null, ao: { x: 0, y: 0 }, alts: null };
}
function rsCutPaper(id) {
  const w = id.width, h = id.height, d = id.data, n = w * h, fig = aiWhiteMask(id);
  for (let i = 0; i < n; i++) if (!fig[i]) d[i * 4 + 3] = 0;
  // the soft edge of a line against the paper: light pixels next to the paper fade out instead of leaving a white rim
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!fig[i]) continue;
    if (!((x > 0 && !fig[i - 1]) || (x < w - 1 && !fig[i + 1]) || (y > 0 && !fig[i - w]) || (y < h - 1 && !fig[i + w]))) continue;
    const m = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); if (m > 170) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * clamp((255 - m) / 85, 0, 1));
  }
}
// loose pieces of a picture with see-through background: [{b: [x0, y0, x1, y1], n, k}] + the label of every pixel
function rsBlobs(id) {
  const w = id.width, h = id.height, d = id.data, lab = new Int32Array(w * h), out = [], st = [];
  for (let i0 = 0; i0 < w * h; i0++) {
    if (lab[i0] || d[i0 * 4 + 3] <= 24) continue;
    const k = out.length + 1, b = [w, h, -1, -1]; let n = 0; lab[i0] = k; st.push(i0);
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i - x) / w; n++;
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X; if (!lab[j] && d[j * 4 + 3] > 24) { lab[j] = k; st.push(j); }
      }
    }
    out.push({ b, n, k });
  }
  return { blobs: out, lab };
}
function rsAddImage(img, name, opt = {}) {
  const white = opt.white != null ? opt.white : RS.white, split = opt.split != null ? opt.split : RS.split;
  const k0 = Math.min(1, 1600 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k0)), h = Math.max(1, Math.round(img.height * k0));
  const src = makeCanvas(w, h), sx = src.getContext('2d'); sx.drawImage(img, 0, 0, w, h);
  const id = sx.getImageData(0, 0, w, h), d = id.data;
  const seeThrough = [0, w - 1, (h - 1) * w, h * w - 1].some(i => d[i * 4 + 3] < 250);
  if (white && !seeThrough) rsCutPaper(id);
  const { blobs, lab } = rsBlobs(id), total = blobs.reduce((m, q) => m + q.n, 0);
  if (!total) { toast('Ảnh này không có hình (chỉ có giấy trắng?)'); return []; }
  const minN = Math.max(60, total * 0.003);
  let keep = split ? blobs.filter(q => q.n >= minN) : [];
  if (!keep.length) { const b = [w, h, -1, -1]; for (const q of blobs) { b[0] = Math.min(b[0], q.b[0]); b[1] = Math.min(b[1], q.b[1]); b[2] = Math.max(b[2], q.b[2]); b[3] = Math.max(b[3], q.b[3]); } keep = [{ b, n: total, k: 0 }]; }
  const B = [w, h, -1, -1]; for (const q of keep) { B[0] = Math.min(B[0], q.b[0]); B[1] = Math.min(B[1], q.b[1]); B[2] = Math.max(B[2], q.b[2]); B[3] = Math.max(B[3], q.b[3]); }
  const bw = B[2] - B[0] + 1, bh = B[3] - B[1] + 1, s = Math.min(2, 0.8 * W / bw, 0.8 * H / bh), bcx = (B[0] + B[2] + 1) / 2, bcy = (B[1] + B[3] + 1) / 2;
  const out = [], base = name.replace(/\.[a-z0-9]+$/i, '').slice(0, 24);
  keep.sort((a, b) => b.n - a.n);   // the biggest piece (the body) at the back, small ones (hands, eyes) in front
  keep.forEach((q, n) => {
    const x0 = Math.max(0, q.b[0] - 2), y0 = Math.max(0, q.b[1] - 2), x1 = Math.min(w - 1, q.b[2] + 2), y1 = Math.min(h - 1, q.b[3] + 2), cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const c = makeCanvas(cw, ch), cx = c.getContext('2d'), pd = cx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y + y0) * w + x + x0; if (q.k && lab[i] !== q.k && !(lab[i] === 0 && d[i * 4 + 3])) continue;
      const o = (y * cw + x) * 4; pd.data[o] = d[i * 4]; pd.data[o + 1] = d[i * 4 + 1]; pd.data[o + 2] = d[i * 4 + 2]; pd.data[o + 3] = d[i * 4 + 3];
    }
    cx.putImageData(pd, 0, 0);
    const p = rsNewPiece(c, { name: keep.length > 1 ? `${base || 'Mảnh'} ${n + 1}` : base || null, s, x: W / 2 + ((x0 + x1 + 1) / 2 - bcx) * s, y: H / 2 + ((y0 + y1 + 1) / 2 - bcy) * s });
    RS.pcs.push(p); out.push(p);
  });
  return out;
}
async function rsImportFiles(files) {
  if (!RS || !files || !files.length) return;
  const pm = progress('Đang tách mảnh…'); await new Promise(r => setTimeout(r, 30));
  rsPush(); let n = 0;
  try {
    for (const f of files) { const bmp = await createImageBitmap(f); n += rsAddImage(bmp, f.name || 'Mảnh').length; if (bmp.close) bmp.close(); }
  } catch (e) { console.error(e); toast('Không mở được ảnh: ' + e.message, 3000); }
  pm.close();
  if (!n) { RS.undo.pop(); rsChanged(); return; }
  RS.sel = RS.pcs[RS.pcs.length - 1].id; rsChanged();
  toast(`Đã thêm ${n} mảnh. ✋ Kéo để ghép, rồi 🦴 Xương: kéo từ mảnh con sang mảnh cha để gắn khớp (hoặc 🪄 Tự gắn xương)`, 5500);
}
/* --- 🪄 Tự gắn xương: loose pieces hang on the piece they overlap most (joint = middle of the overlap), else the nearest --- */
function rsMasks() {
  const k = 0.25, w = Math.ceil(W * k), h = Math.ceil(H * k), c = makeCanvas(w, h), x = c.getContext('2d'), out = new Map();
  for (const p of RS.pcs) {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.setTransform(k, 0, 0, k, 0, 0); x.transform(...rsA(p)); x.drawImage(p.c, 0, 0);
    const d = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); let n = 0, sx = 0, sy = 0, xx = 0, yy = 0, xy = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 60) { const X = i % w, Y = (i / w) | 0; m[i] = 1; n++; sx += X; sy += Y; xx += X * X; yy += Y * Y; xy += X * Y; }
    // long axis of the piece (an arm, a leg): from the second moments
    const mx = n ? sx / n : 0, my = n ? sy / n : 0, a = n ? xx / n - mx * mx : 1, b = n ? xy / n - mx * my : 0, cc = n ? yy / n - my * my : 1, th = 0.5 * Math.atan2(2 * b, a - cc);
    out.set(p, { m, n, cx: n ? mx / k : p.x, cy: n ? my / k : p.y, ux: Math.cos(th), uy: Math.sin(th) });
  }
  return { masks: out, w, h, k };
}
function rsAutoBone() {
  if (!RS.pcs.length) { toast('Chưa có mảnh nào'); return 0; }
  const { masks, w, h, k } = rsMasks();
  const roots = rsRoots(); if (roots.length < 2) { rsGuessRoles(); return 0; }
  const size = r => [r, ...rsDesc(r.id)].reduce((m, q) => m + masks.get(q).n, 0);
  const root = RS.edit && rsPc(RS.edit) ? rsPc(RS.edit) : roots.find(r => r.role === 'torso') || roots.find(r => rsKids(r.id).length && size(r) === Math.max(...roots.map(size))) || roots.slice().sort((a, b) => masks.get(b).n - masks.get(a).n)[0];
  const inTree = new Set([root, ...rsDesc(root.id)]), loose = new Set(roots.filter(r => r !== root)), dist = new Map();
  const distOf = t => { if (!dist.has(t)) dist.set(t, hcDist(masks.get(t).m, w, h)); return dist.get(t); };
  let n = 0;
  while (loose.size) {
    let best = null;
    for (const f of loose) {
      const F = masks.get(f), a = F.m;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < a.length; i++) if (a[i]) { const v = (i % w) * F.ux + ((i / w) | 0) * F.uy; if (v < lo) lo = v; if (v > hi) hi = v; }
      for (const t of inTree) {
        const b = masks.get(t).m, ov = []; let c = 0, sx = 0, sy = 0;
        for (let i = 0; i < a.length; i++) if (a[i] && b[i]) { c++; sx += i % w; sy += (i / w) | 0; ov.push(i); }
        if (!c) continue;
        // where on the piece the overlap sits: a joint is at one END of a piece (top of an arm, bottom of the head); two legs
        // side by side overlap along their middle, which counts for little
        const ox = sx / c, oy = sy / c, mid = (lo + hi) / 2, half = Math.max(1, (hi - lo) / 2);
        let pv = ov.map(i => (i % w) * F.ux + ((i / w) | 0) * F.uy), olo = Math.min(...pv), ohi = Math.max(...pv), jx = ox, jy = oy;
        const end = clamp(Math.abs(ox * F.ux + oy * F.uy - mid) / half, 0, 1);
        if (ohi - olo > half) {   // a long strip (an arm lying along the body): the joint at the strip's upper end
          const T = masks.get(t), tp = T.cx * k * F.ux + T.cy * k * F.uy, upEnd = Math.abs(F.uy) < 0.2 ? (Math.abs(tp - olo) < Math.abs(tp - ohi)) : F.uy > 0;
          const lim = upEnd ? olo + (ohi - olo) * 0.15 : ohi - (ohi - olo) * 0.15; let n2 = 0; jx = 0; jy = 0;
          ov.forEach((i, q) => { if (upEnd ? pv[q] <= lim : pv[q] >= lim) { jx += i % w; jy += (i / w) | 0; n2++; } });
          jx /= n2 || 1; jy /= n2 || 1; pv = null;
        }
        const sc = c * (0.15 + Math.max(end, ohi - olo > half ? 0.6 : 0)) ** 2 * (t === root ? 1.3 : 1);
        if (!best || sc > best.sc) best = { f, t, sc, x: (jx + 0.5) / k, y: (jy + 0.5) / k };
      }
    }
    if (!best) {   // nothing overlaps: the closest pair, joint on the loose piece's pixel nearest to the other one
      for (const f of loose) {
        const a = masks.get(f).m;
        for (const t of inTree) {
          const D = distOf(t); for (let i = 0; i < a.length; i++) if (a[i] && (!best || D[i] < best.d)) best = { f, t, d: D[i], x: (i % w + 0.5) / k, y: (((i / w) | 0) + 0.5) / k, near: 1 };
        }
      }
    }
    if (!best) break;
    const { f, t } = best, l = mApply(mInv(rsA(f)), best.x, best.y);
    f.parent = t.id; f.jx = l.x; f.jy = l.y; loose.delete(f); inTree.add(f); for (const q of rsDesc(f.id)) inTree.add(q); n++;
  }
  rsGuessRoles(masks);
  return n;
}
// head / arms / legs from where the pieces hang on the body (left = left of the screen, like ⚽ Cầu thủ mẫu); only empty roles
function rsGuessRoles(masks) {
  const roots = rsRoots(); if (roots.length !== 1) return;
  masks = masks || rsMasks().masks;
  const root = roots[0], used = new Set(RS.pcs.map(p => p.role).filter(Boolean)), give = (p, r) => { if (p.role || used.has(r)) return; p.role = r; used.add(r); if (/^Mảnh |^[^ ]+ \d+$/.test(p.name)) p.name = PP_ROLES[r]; };
  give(root, 'torso');
  const cs = rsCorners(rsA(root), root.c), top = Math.min(...cs.map(q => q.y)), bot = Math.max(...cs.map(q => q.y)), hh = bot - top || 1, mid = masks.get(root).cx;
  const kids = rsKids(root.id).sort((a, b) => masks.get(b).n - masks.get(a).n);
  for (const c of kids) {
    const J = rsJD(c), C = masks.get(c), side = C.cx < mid ? 'L' : 'R';
    let r = '';
    if (C.cy < top + 0.12 * hh && J.y < top + 0.35 * hh) r = 'head';
    else if (J.y > top + 0.6 * hh && C.cy > J.y) r = 'leg' + side;
    else if (C.n * 1.5 < masks.get(root).n) r = 'arm' + side;
    if (!r) continue; give(c, r);
    const sub = { armL: 'foreL', armR: 'foreR', legL: 'shinL', legR: 'shinR' }[c.role], gk = rsKids(c.id);
    if (sub && gk.length === 1) give(gk[0], sub);
  }
}
/* --- ✓ Xong: bake every piece into a part picture at its place in the frame --- */
function rsBake(c, M) {
  const ident = Math.abs(M[0] - 1) < 1e-6 && Math.abs(M[1]) < 1e-6 && Math.abs(M[2]) < 1e-6 && Math.abs(M[3] - 1) < 1e-6 && Math.abs(M[4] - Math.round(M[4])) < 1e-6 && Math.abs(M[5] - Math.round(M[5])) < 1e-6;
  if (ident) return { c, x: Math.round(M[4]), y: Math.round(M[5]), same: true };
  const cs = rsCorners(M, c), x0 = Math.floor(Math.min(...cs.map(q => q.x))), y0 = Math.floor(Math.min(...cs.map(q => q.y)));
  const x1 = Math.ceil(Math.max(...cs.map(q => q.x))), y1 = Math.ceil(Math.max(...cs.map(q => q.y)));
  const o = makeCanvas(Math.max(1, x1 - x0), Math.max(1, y1 - y0)), x = o.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.setTransform(1, 0, 0, 1, -x0, -y0); x.transform(...M); x.drawImage(c, 0, 0);
  return { c: o, x: x0, y: y0, same: false };
}
function rsTipOf(p, baked, piv) {   // the end of the bone: the child joint, else the drawn point farthest from the joint
  const kids = rsKids(p.id), sub = { armL: 'foreL', armR: 'foreR', legL: 'shinL', legR: 'shinR' }[p.role];
  const kid = kids.find(q => sub && q.role === sub) || (kids.length === 1 ? kids[0] : null);
  if (kid) return rsJD(kid);
  const a = rsAlpha(baked.c), w = baked.c.width, h = baked.c.height; let bd = -1, tip = { x: piv.x, y: piv.y + 1 };
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (a[y * w + x] > 40) { const dd = (x + baked.x - piv.x) ** 2 + (y + baked.y - piv.y) ** 2; if (dd > bd) { bd = dd; tip = { x: x + baked.x, y: y + baked.y }; } }
  return tip;
}
async function rsFinish() {
  if (!RS) return;
  if (!RS.pcs.length) { toast('Chưa có mảnh nào — bấm ＋ Ảnh mảnh'); return; }
  if (RS.edit && !RS.dirty) { rsClose(true); return; }
  if (rsRoots().length > 1) {
    const v = await modal({ title: '🦴 Còn mảnh chưa gắn xương', html: `<p>Có <b>${rsRoots().length - 1} mảnh</b> chưa gắn vào nhân vật. Nhân vật chỉ có 1 mảnh gốc (thường là Thân), mọi mảnh khác phải gắn vào nó hoặc vào mảnh đã gắn.</p>`,
      buttons: [{ label: 'Quay lại gắn', value: null }, { label: '🪄 Tự gắn rồi xong', primary: true, value: 1 }] });
    if (!v) return;
    rsPush(); rsAutoBone(); rsChanged();
  }
  let name = '', kho = true;
  if (!RS.edit) {
    const v = await modal({ title: '✓ Tạo nhân vật', html: `<p><b>${RS.pcs.length} mảnh</b> thành 1 nhân vật có xương, đặt ở frame đang xem. Kéo tay chân để tạo dáng, dùng Dòng layer / Mẫu nhanh như nhân vật đã cắt.</p>
<label class="lbl">Tên nhân vật<br><input id="rsName" maxlength="40" value="Nhân vật ${S.pp ? ppRoots().length + 1 : 1}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"></label>
<label class="lbl" style="display:block;margin-top:10px"><input type="checkbox" id="rsKho" checked> 💾 Lưu luôn vào 🧍 Kho nhân vật (dùng lại ở dự án khác)</label>`,
      onOpen: ov => ov.querySelector('#rsName').addEventListener('keydown', e => e.stopPropagation()),
      buttons: [{ label: 'Quay lại', value: null }, { label: '✓ Tạo nhân vật', primary: true, value: 1, action: () => { name = $('#rsName').value.trim().slice(0, 40); kho = $('#rsKho').checked; } }] });
    if (!v) return;
  }
  const pm = progress('Đang tạo nhân vật…'); await new Promise(r => setTimeout(r, 30));
  try {
    if (playing) stopPlay();
    commitFloating(); histFlush(); const hb = histSnap();
    const order = [...RS.pcs].sort((a, b) => a.z - b.z), baked = new Map();
    for (const p of order) baked.set(p, rsBake(p.c, rsA(p)));
    const pv = p => rsJD(p), mk = p => {
      const b = baked.get(p), piv = pv(p), t = rsTipOf(p, b, piv);
      return { name: p.name || PP_ROLES[p.role] || 'Mảnh', role: p.role || '', parent: p.parent, ox: b.x, oy: b.y, px: piv.x, py: piv.y, tip: { x: t.x, y: t.y }, c: b.c, same: b.same };
    };
    let parts, rootId;
    if (!RS.edit) {
      parts = order.map((p, i) => { const o = mk(p); delete o.same; return { id: p.id, ...o, z: i, hard: 1 }; });
      for (const q of parts) await encodePart(q);
      const root = parts.find(q => !q.parent); if (name) root.lname = name;
      ppPushChar(parts); rootId = root.id;
    } else {
      rootId = RS.edit;
      const old = S.pp.parts.filter(q => (ppCharOf(q) || q.id) === RS.edit), keep = new Set(RS.pcs.map(p => p.id));
      const zs = old.map(q => q.z).sort((a, b) => a - b), z0 = zs[0] || 0, span = (zs[zs.length - 1] || 0) - z0 + 1;
      S.pp.parts = S.pp.parts.filter(q => !old.includes(q) || keep.has(q.id));
      for (let i = 0; i < order.length; i++) {
        const p = order[i], o = mk(p), z = z0 + span * i / order.length, part = S.pp.parts.find(q => q.id === p.id);
        if (part) {
          Object.assign(part, { name: o.name, role: o.role, parent: o.parent, ox: o.ox, oy: o.oy, px: o.px, py: o.py, tip: o.tip, z });
          if (part.c !== o.c) { part.c = o.c; part.png = null; part.alpha = null; part.kit = null; await encodePart(part); }
          if (p.alts && p.alts.length) {
            const A = rsA(p), alts = [];
            for (const a of p.alts) {
              if (!a.c) { alts.push({ ...a }); continue; }
              const b = rsBake(a.c, mMul(A, mT((a.dx || 0) + p.ao.x, (a.dy || 0) + p.ao.y))), na = { ...a, c: b.c, dx: b.x - o.ox, dy: b.y - o.oy };
              if (!b.same) { na.png = null; na.alpha = null; await encodeHolder(na); }
              alts.push(na);
            }
            part.alts = alts;
          }
        } else {
          const q = { id: p.id, name: o.name, role: o.role, parent: o.parent, z, ox: o.ox, oy: o.oy, px: o.px, py: o.py, tip: o.tip, c: o.c, hard: 1 };
          await encodePart(q); S.pp.parts.push(q);
        }
      }
      ppRenormZ();
    }
    const savedParts = RS.edit ? null : S.pp.parts.filter(q => (ppCharOf(q) || q.id) === rootId);
    const wasEdit = !!RS.edit;
    rsClose(true, !wasEdit);
    setTool('puppet'); ppSel = rootId; ppDrag = 'bone';
    ppShowAdded(); lyrSync(true); render();
    const ha = histSnap(), fr = [];
    for (const [g, a] of ha.fm) { const bs = hb.fm.get(g); if (bs !== undefined && bs !== a) fr.push([g, bs, a]); }
    pushEntry({ snap: { before: hb, after: ha, fr }, bytes: 2000 }); histRebase();
    pm.close();
    if (wasEdit) toast('Đã sửa nhân vật: mọi frame giữ dáng cũ với khớp + hình mới. ↶ Hoàn tác để về như trước', 4500);
    else {
      toast(`Đã tạo nhân vật ${savedParts.length} mảnh có xương. 🦴 Kéo tay/chân để xoay quanh khớp, kéo thân để dời cả người`, 5000);
      if (kho) await charLibStore(savedParts.sort((a, b) => a.z - b.z), name || 'Nhân vật');
      await ppAskNew(rootId);
    }
  } catch (e) { pm.close(); console.error(e); toast('Lỗi tạo nhân vật: ' + e.message, 3500); }
}
/* --- open / close; ✏ Sửa nhân vật này = the pieces of a character already in the project, rest pose --- */
async function rsOpen(editRoot) {
  if (RS) return;
  if (playing) stopPlay(); commitFloating();
  RS = { pcs: [], sel: null, mode: 'arrange', tool: 'brush', size: 14, white: true, split: true, kids: true, cut: false, pose: {}, undo: [], redo: [], edit: null, dirty: false, vw: null, pens: false };
  if (editRoot) {
    const root = ppPart(editRoot), rid = root && (ppCharOf(root) || root.id);
    if (!rid) { RS = null; toast('Chạm chọn nhân vật cần sửa trước'); return; }
    RS.edit = rid;
    for (const q of S.pp.parts.filter(p => (ppCharOf(p) || p.id) === rid).sort((a, b) => a.z - b.z)) {
      RS.pcs.push({ id: q.id, name: q.name, role: q.role || '', c: q.c, x: q.ox + q.c.width / 2, y: q.oy + q.c.height / 2, ax: q.c.width / 2, ay: q.c.height / 2, s: 1, r: 0, fl: false,
        parent: q.parent, jx: q.px - q.ox, jy: q.py - q.oy, z: q.z, src: q.id, ao: { x: 0, y: 0 }, alts: q.alts && q.alts.length ? q.alts : null });
    }
    RS.sel = rid;
  } else await rsDraftLoad();
  rsBuild(); rsSync(); rsFit(); rsDraw();
  if (!RS.pcs.length) toast('＋ Ảnh mảnh: chọn ảnh các bộ phận (đầu, thân, tay, chân…) trên nền trắng, chọn nhiều ảnh cùng lúc được', 5000);
}
async function rsClose(done, clearDraft) {
  if (!RS) return;
  if (!done && RS.edit && RS.dirty) {
    const v = await modal({ title: 'Đóng xưởng?', html: '<p>Bỏ các thay đổi của nhân vật này?</p>', buttons: [{ label: 'Ở lại', value: null }, { label: 'Bỏ thay đổi', value: 1, cls: 'danger' }] });
    if (!v) return;
  }
  if (!RS.edit) { if (clearDraft) { RS.pcs = []; } await rsDraftSave(); }
  cancelAnimationFrame(RS.wigF); document.removeEventListener('keydown', rsKey, true); if (RS.ro) RS.ro.disconnect();
  RS.el.remove(); RS = null; requestRender();
}
/* --- draft (new character only): pieces as PNG in IndexedDB, back on the next open --- */
let rsDraftT = null;
function rsDraftSoon() { if (!RS || RS.edit) return; clearTimeout(rsDraftT); rsDraftT = setTimeout(rsDraftSave, 1500); }
async function rsDraftSave() {
  clearTimeout(rsDraftT); rsDraftT = null; if (!RS || RS.edit) return;
  try {
    if (!RS.pcs.length) { await idbPut(RS_KEY, null); return; }
    const pcs = []; for (const p of RS.pcs) { const { c, alts, ...m } = p; pcs.push({ ...m, png: await toBlob(c) }); void alts; }
    await idbPut(RS_KEY, { t: Date.now(), pcs });
  } catch (e) { console.warn('rig-studio draft', e); }
}
async function rsDraftLoad() {
  let d = null; try { d = await idbGet(RS_KEY); } catch (e) { d = null; }
  if (!d || !d.pcs || !d.pcs.length) return;
  for (const m of d.pcs) {
    try { const bmp = await createImageBitmap(m.png), c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); const { png, ...q } = m; void png; RS.pcs.push({ ...q, c, alts: null, src: null }); } catch (e) { console.warn(e); }
  }
  rsN = RS.pcs.length;
  if (RS.pcs.length) toast(`Mở tiếp ${RS.pcs.length} mảnh đang ghép dở. 🗑 Bỏ hết để làm nhân vật khác`, 3500);
}
/* --- screen --- */
const RS_MODES = [['arrange', '✋ Ghép'], ['bone', '🦴 Xương'], ['paint', '✎ Vẽ'], ['pose', '🤸 Thử']];
function rsBuild() {
  const el = document.createElement('div'); el.id = 'rsWrap';
  el.innerHTML = `<div class="rs-top"><b class="rs-title">🦴 Xưởng ghép xương</b>
  <span class="rs-modes">${RS_MODES.map(([k, l]) => `<button class="chip" data-rsm="${k}">${l}</button>`).join('')}</span>
  <span class="rs-gap"></span>
  <button class="chip" id="rsUndo" title="Hoàn tác (trong xưởng)">↶</button><button class="chip" id="rsRedo" title="Làm lại">↷</button>
  <button class="chip" id="rsAdd" title="Nhập ảnh các bộ phận (chọn nhiều ảnh được). Giấy trắng quanh hình tự bỏ, mỗi khúc rời thành 1 mảnh">＋ Ảnh mảnh</button>
  <button class="chip on" id="rsDone">✓ Xong</button><button class="chip" id="rsClose" title="Đóng xưởng (mảnh đang ghép dở vẫn được giữ)">✕</button></div>
<div class="rs-main"><canvas id="rsCv"></canvas><div class="rs-zoom"><button class="chip" data-rsz="-1">−</button><button class="chip" data-rsz="0">⛶</button><button class="chip" data-rsz="1">＋</button></div></div>
<div class="rs-side"><div class="rs-hint" id="rsHint"></div><div class="rs-tools" id="rsTools"></div><div class="rs-props" id="rsProps"></div><div class="rs-strip" id="rsStrip"></div></div>
<input type="file" id="rsFile" accept="image/*" multiple hidden>`;
  document.body.append(el); RS.el = el; RS.cv = el.querySelector('#rsCv');
  el.querySelectorAll('[data-rsm]').forEach(b => b.addEventListener('click', () => rsMode(b.dataset.rsm)));
  el.querySelector('#rsUndo').addEventListener('click', rsUndo); el.querySelector('#rsRedo').addEventListener('click', rsRedo);
  el.querySelector('#rsAdd').addEventListener('click', () => el.querySelector('#rsFile').click());
  el.querySelector('#rsFile').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; rsImportFiles(fs); });
  el.querySelector('#rsDone').addEventListener('click', rsFinish);
  el.querySelector('#rsClose').addEventListener('click', () => rsClose(false));
  el.querySelectorAll('[data-rsz]').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.rsz; if (!k) { RS.zoomed = false; rsFit(); } else rsZoomAt(k > 0 ? 1.25 : 0.8); rsDraw(); }));
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const fs = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type)); if (fs.length) rsImportFiles(fs); });
  const cv = RS.cv;
  cv.addEventListener('pointerdown', rsDown); cv.addEventListener('pointermove', rsMove);
  cv.addEventListener('pointerup', rsUp); cv.addEventListener('pointercancel', rsUp);
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); rsZoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR); rsDraw(); }, { passive: false });
  RS.ro = new ResizeObserver(() => { const r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR)); if (w === cv.width && h === cv.height) return; cv.width = w; cv.height = h; if (!RS.zoomed) rsFit(); rsDraw(); });
  RS.ro.observe(cv);
  document.addEventListener('keydown', rsKey, true);
}
function rsKey(e) {
  if (!RS || document.querySelector('.ov') || typingIn(e)) return;
  const k = e.key.toLowerCase(); e.stopPropagation();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? rsRedo() : rsUndo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); rsRedo(); }
  else if (k === 'escape') { e.preventDefault(); if (RS.cut) { RS.cut = false; rsSync(); rsDraw(); } else rsClose(false); }
  else if ((k === 'delete' || k === 'backspace') && RS.sel) { e.preventDefault(); rsDelete(); }
}
function rsFit() {
  const cv = RS.cv, w = cv.width || 1, h = cv.height || 1, k = Math.min(w / W, h / H) * 0.92;
  RS.vw = [k, 0, 0, k, (w - W * k) / 2, (h - H * k) / 2];
}
function rsZoomAt(f, cx, cy) {
  const v = RS.vw, cv = RS.cv; cx = cx == null ? cv.width / 2 : cx; cy = cy == null ? cv.height / 2 : cy;
  RS.zoomed = true; const k = clamp(v[0] * f, 0.05, 40), g = k / v[0]; RS.vw = [k, 0, 0, k, cx - (cx - v[4]) * g, cy - (cy - v[5]) * g];
}
const rsDoc = e => { const r = RS.cv.getBoundingClientRect(), x = (e.clientX - r.left) * DPR, y = (e.clientY - r.top) * DPR; return { ...mApply(mInv(RS.vw), x, y), sx: x, sy: y, p: e.pressure || 0.5 }; };
function rsKnob(p, M) {   // the turn / resize knob: just outside the top-right corner of the selected piece (screen pixels)
  const cs = rsCorners(mMul(RS.vw, M), p.c), c = cs[1], o = mApply(mMul(RS.vw, M), p.c.width / 2, p.c.height / 2), dx = c.x - o.x, dy = c.y - o.y, l = Math.hypot(dx, dy) || 1, g = 26 * DPR;
  return { x: c.x + dx / l * g, y: c.y + dy / l * g };
}
function rsDraw() {
  if (!RS || !RS.cv.width) return;
  const cv = RS.cv, x = cv.getContext('2d'), V = RS.vw, k = V[0], px = DPR / k, { P, M } = rsMats(), sel = rsPc(RS.sel);
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#2a2b31'; x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(...V); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#eef0f4'; const g = 40; for (let yy = 0; yy < H; yy += g) for (let xx = ((yy / g) % 2) * g; xx < W; xx += g * 2) x.fillRect(xx, yy, g, g);
  const paintFoc = RS.mode === 'paint' && sel;
  for (const p of [...RS.pcs].sort((a, b) => a.z - b.z)) {
    x.save(); x.globalAlpha = paintFoc && p !== sel ? 0.35 : 1; x.transform(...M[p.id]); x.drawImage(p.c, 0, 0); x.restore();
  }
  if (paintFoc) { x.save(); x.transform(...M[sel.id]); x.drawImage(sel.c, 0, 0); x.restore(); }
  x.lineCap = 'round'; x.lineJoin = 'round';
  // bones: parent joint → child joint (leaf: joint → middle of the piece)
  const bones = RS.mode === 'bone' || RS.mode === 'pose', faint = RS.mode === 'arrange';
  if (bones || faint) {
    x.globalAlpha = faint ? 0.45 : 1;
    for (const p of RS.pcs) {
      const a = mApply(P[p.id], ...Object.values(rsJD(p))), kids = rsKids(p.id);
      const ends = kids.length ? kids.map(c => mApply(P[c.id], ...Object.values(rsJD(c)))) : [mApply(M[p.id], p.c.width / 2, p.c.height / 2)];
      if (!p.parent && !kids.length) continue;
      for (const b of ends) { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 8 * px; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.strokeStyle = p.id === RS.sel ? '#ff3b9a' : '#2f7bff'; x.lineWidth = 4 * px; x.stroke(); }
    }
    for (const p of RS.pcs) {
      if (!p.parent && !rsKids(p.id).length) continue;
      const a = mApply(P[p.id], ...Object.values(rsJD(p)));
      x.beginPath(); x.arc(a.x, a.y, (p.parent ? 9 : 12) * px, 0, Math.PI * 2); x.fillStyle = p.id === RS.sel ? '#ff3b9a' : p.parent ? '#2f7bff' : '#ffb21e'; x.fill(); x.lineWidth = 2.5 * px; x.strokeStyle = '#fff'; x.stroke();
    }
    x.globalAlpha = 1;
  }
  if (sel) {   // dashed frame round the selected piece
    const cs = rsCorners(M[sel.id], sel.c); x.setLineDash([8 * px, 6 * px]); x.lineWidth = 2 * px; x.strokeStyle = RS.mode === 'paint' ? '#2f7bff' : '#ff3b9a';
    x.beginPath(); cs.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); x.closePath(); x.stroke(); x.setLineDash([]);
  }
  const a = RS.act;
  if (a && a.k === 'link' && a.cur) {   // 🦴 drag from the child piece to its parent
    x.strokeStyle = '#ff3b9a'; x.lineWidth = 5 * px; x.beginPath(); x.moveTo(a.p0.x, a.p0.y); x.lineTo(a.cur.x, a.cur.y); x.stroke();
    const t = rsHit(a.cur, a.p); if (t) { const cs = rsCorners(M[t.id], t.c); x.lineWidth = 3 * px; x.strokeStyle = '#34c759'; x.beginPath(); cs.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); x.closePath(); x.stroke(); }
    x.beginPath(); x.arc(a.p0.x, a.p0.y, 9 * px, 0, Math.PI * 2); x.fillStyle = '#ff3b9a'; x.fill();
  }
  if (a && a.k === 'lasso' && a.pts.length > 1) { x.strokeStyle = '#ff3b9a'; x.lineWidth = 3 * px; x.setLineDash([10 * px, 6 * px]); x.beginPath(); a.pts.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); x.closePath(); x.stroke(); x.setLineDash([]); }
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (sel && RS.mode === 'arrange' && !RS.cut) { const kb = rsKnob(sel, M[sel.id]); x.beginPath(); x.arc(kb.x, kb.y, 17 * DPR, 0, Math.PI * 2); x.fillStyle = '#ff3b9a'; x.fill(); x.lineWidth = 3 * DPR; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#fff'; x.font = `bold ${18 * DPR}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⟳', kb.x, kb.y + DPR); }
}
/* --- pointer: 1 pen / finger = the mode's job, 2 fingers = zoom + pan (quick 2-finger tap = undo) --- */
function rsDown(e) {
  if (!RS) return; const cv = RS.cv; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* a pointer that is already gone */ }
  RS.pts = RS.pts || new Map(); RS.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.pointerType });
  if (e.pointerType === 'pen') RS.pens = true;
  if (RS.pts.size >= 2) {   // a second finger: zoom / pan; the started job is taken back
    if (RS.act && RS.act.k !== 'pan' && RS.act.k !== 'pinch' && RS.act.snap) { rsPutBack(RS.act.snap); RS.undo.pop(); }
    const [p1, p2] = [...RS.pts.values()];
    RS.act = { k: 'pinch', d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, m0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, v0: RS.vw.slice(), t0: performance.now(), moved: 0 };
    rsDraw(); return;
  }
  const pt = rsDoc(e), { M } = rsMats(), sel = rsPc(RS.sel), touchPan = e.pointerType === 'touch' && RS.pens && RS.mode === 'paint';
  if (touchPan) { RS.act = { k: 'pan', s0: { x: e.clientX, y: e.clientY }, v0: RS.vw.slice() }; return; }
  if (RS.mode === 'arrange') {
    if (RS.cut) { if (!sel) { const h = rsHit(pt); if (h) { RS.sel = h.id; rsSync(); } } RS.act = { k: 'lasso', pts: [pt] }; rsDraw(); return; }
    if (sel) { const kb = rsKnob(sel, M[sel.id]); if (Math.hypot(pt.sx - kb.x, pt.sy - kb.y) < 30 * DPR) { rsPush(); const c = { x: sel.x, y: sel.y }; RS.act = { k: 'knob', p: sel, c, a0: Math.atan2(pt.y - c.y, pt.x - c.x), d0: Math.hypot(pt.x - c.x, pt.y - c.y) || 1, s0: sel.s, r0: sel.r, snap: RS.undo[RS.undo.length - 1], grp: (RS.kids ? rsDesc(sel.id) : []).map(q => [q, q.x, q.y, q.s, q.r]) }; return; } }
    const h = rsHit(pt);
    if (h) { rsPush(); RS.sel = h.id; const grp = [h, ...(RS.kids ? rsDesc(h.id) : [])]; RS.act = { k: 'move', p0: pt, grp: grp.map(q => [q, q.x, q.y]), snap: RS.undo[RS.undo.length - 1], moved: 0 }; rsSync(); rsDraw(); return; }
  } else if (RS.mode === 'bone') {
    const { P } = rsMats();
    let best = null; for (const p of RS.pcs) { if (!p.parent && !rsKids(p.id).length) continue; const j = mApply(mMul(RS.vw, P[p.id]), ...Object.values(rsJD(p))), d = Math.hypot(pt.sx - j.x, pt.sy - j.y); if (d < 24 * DPR && (!best || d < best.d)) best = { p, d }; }
    if (best) { rsPush(); RS.sel = best.p.id; RS.act = { k: 'joint', p: best.p, snap: RS.undo[RS.undo.length - 1], moved: 0 }; rsSync(); rsDraw(); return; }
    const h = rsHit(pt);
    if (h) { RS.sel = h.id; RS.act = { k: 'link', p: h, p0: pt, cur: null }; rsSync(); rsDraw(); return; }
  } else if (RS.mode === 'pose') {
    const h = rsHit(pt);
    if (h) { const { P } = rsMats(), J = mApply(P[h.id], ...Object.values(rsJD(h))); RS.sel = h.id; RS.act = { k: 'rot', p: h, J, a0: Math.atan2(pt.y - J.y, pt.x - J.x), b0: RS.pose[h.id] || 0 }; rsSync(); rsDraw(); return; }
  } else if (RS.mode === 'paint') {
    if (!sel) { const h = rsHit(pt); if (h) { RS.sel = h.id; rsSync(); rsDraw(); toast('Đang vẽ lên ' + h.name, 1800); } return; }
    if (rsPaintStart(sel, pt)) return;
  }
  RS.act = { k: 'pan', s0: { x: e.clientX, y: e.clientY }, v0: RS.vw.slice(), tap: { x: e.clientX, y: e.clientY } };
}
function rsMove(e) {
  if (!RS || !RS.pts || !RS.pts.has(e.pointerId)) return;
  RS.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.pointerType });
  const a = RS.act; if (!a) return;
  if (a.k === 'pinch') {
    if (RS.pts.size < 2) return; const [p1, p2] = [...RS.pts.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y), m = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    a.moved = Math.max(a.moved, Math.abs(d - a.d0), Math.hypot(m.x - a.m0.x, m.y - a.m0.y));
    const r = RS.cv.getBoundingClientRect(), g = d / a.d0, k = clamp(a.v0[0] * g, 0.05, 40), gg = k / a.v0[0], cx = (a.m0.x - r.left) * DPR, cy = (a.m0.y - r.top) * DPR;
    RS.zoomed = true; RS.vw = [k, 0, 0, k, cx - (cx - a.v0[4]) * gg + (m.x - a.m0.x) * DPR, cy - (cy - a.v0[5]) * gg + (m.y - a.m0.y) * DPR]; rsDraw(); return;
  }
  if (a.k === 'pan') { RS.zoomed = true; RS.vw = [a.v0[0], 0, 0, a.v0[3], a.v0[4] + (e.clientX - a.s0.x) * DPR, a.v0[5] + (e.clientY - a.s0.y) * DPR]; rsDraw(); return; }
  const pt = rsDoc(e);
  if (a.k === 'move') { const dx = pt.x - a.p0.x, dy = pt.y - a.p0.y; a.moved = Math.max(a.moved, Math.hypot(pt.sx - a.p0.sx, pt.sy - a.p0.sy)); for (const [q, x0, y0] of a.grp) { q.x = x0 + dx; q.y = y0 + dy; } rsDraw(); return; }
  if (a.k === 'knob') {
    const p = a.p, an = Math.atan2(pt.y - a.c.y, pt.x - a.c.x), d = Math.hypot(pt.x - a.c.x, pt.y - a.c.y); p.s = clamp(a.s0 * d / a.d0, 0.03, 20); p.r = a.r0 + (an - a.a0) / DEG;
    // the attached pieces turn + grow with it round the same centre, so every joint stays on its parent
    const g = p.s / a.s0, dr = p.r - a.r0, co = Math.cos(dr * DEG) * g, si = Math.sin(dr * DEG) * g;
    for (const [q, x0, y0, s0, r0] of a.grp) { const vx = x0 - a.c.x, vy = y0 - a.c.y; q.x = a.c.x + co * vx - si * vy; q.y = a.c.y + si * vx + co * vy; q.s = s0 * g; q.r = r0 + dr; }
    rsDraw(); return;
  }
  if (a.k === 'joint') { const l = mApply(mInv(rsA(a.p)), pt.x, pt.y); a.p.jx = l.x; a.p.jy = l.y; a.moved = 1; rsDraw(); return; }
  if (a.k === 'link') { a.cur = pt; rsDraw(); return; }
  if (a.k === 'rot') { const an = Math.atan2(pt.y - a.J.y, pt.x - a.J.x); RS.pose[a.p.id] = a.b0 + (an - a.a0) / DEG; rsDraw(); return; }
  if (a.k === 'lasso') { const l = a.pts[a.pts.length - 1]; if (Math.hypot(pt.sx - l.sx, pt.sy - l.sy) > 3 * DPR) a.pts.push(pt); rsDraw(); return; }
  if (a.k === 'paint') { rsPaintMove(a, pt); }
}
function rsUp(e) {
  if (!RS || !RS.pts) return; RS.pts.delete(e.pointerId);
  const a = RS.act; if (!a) return;
  if (a.k === 'pinch') { if (RS.pts.size) return; RS.act = null; if (performance.now() - a.t0 < 300 && a.moved < 12) rsUndo(); return; }
  if (RS.pts.size) return;
  RS.act = null; const pt = rsDoc(e);
  if (a.k === 'pan') { if (a.tap && Math.hypot(e.clientX - a.tap.x, e.clientY - a.tap.y) < 8 && RS.mode !== 'paint') { RS.sel = null; rsSync(); } rsDraw(); return; }
  if (a.k === 'move' || a.k === 'joint') { if (!a.moved || (a.k === 'move' && a.moved < 3 * DPR)) { if (a.k === 'move') for (const [q, x0, y0] of a.grp) { q.x = x0; q.y = y0; } RS.undo.pop(); } rsChanged(); return; }
  if (a.k === 'knob') { rsChanged(); return; }
  if (a.k === 'rot') { rsDraw(); return; }
  if (a.k === 'link') {
    const t = a.cur && Math.hypot(pt.sx - a.p0.sx, pt.sy - a.p0.sy) > 14 * DPR ? rsHit(pt, a.p) : null;
    if (t) rsLink(a.p, t, a.p0);
    rsSync(); rsDraw(); return;
  }
  if (a.k === 'lasso') { if (a.pts.length > 4) rsCutLasso(a.pts); else rsDraw(); return; }
  if (a.k === 'paint') rsPaintEnd(a);
}
function rsLink(child, par, at) {
  if (RS.edit && child.id === RS.edit) { toast('Mảnh gốc của nhân vật đang sửa phải là gốc (các frame giữ dáng theo nó)', 3500); return false; }
  if (rsIsDesc(child, par)) { toast('Không gắn vào mảnh con của chính nó được'); return false; }
  rsPush(); child.parent = par.id;
  if (at) { const l = mApply(mInv(rsA(child)), at.x, at.y); child.jx = l.x; child.jy = l.y; }
  RS.sel = child.id; rsChanged();
  toast(`${child.name} gắn vào ${par.name}. Kéo chấm xanh để sửa chỗ khớp`, 2500); return true;
}
/* --- ✂ Khoanh tách: the lassoed part of the selected piece becomes a new piece joined where it was cut --- */
function rsCutLasso(pts) {
  const sel = rsPc(RS.sel); if (!sel) { toast('Chạm chọn mảnh cần tách trước'); rsDraw(); return; }
  const inv = mInv(rsA(sel)), poly = pts.map(q => mApply(inv, q.x, q.y)), w = sel.c.width, h = sel.c.height;
  const A = makeCanvas(w, h), ax = A.getContext('2d'); ax.save(); polyPath(ax, poly); ax.clip(); ax.drawImage(sel.c, 0, 0); ax.restore();
  const B = makeCanvas(w, h), bx = B.getContext('2d'); bx.drawImage(sel.c, 0, 0); bx.save(); bx.globalCompositeOperation = 'destination-out'; polyPath(bx, poly); bx.fill(); bx.restore();
  const aa = rsAlpha(A), ab = rsAlpha(B); let n = 0, m = 0, sx = 0, sy = 0, cnt = 0;
  for (let i = 0; i < aa.length; i++) { if (aa[i] > 30) n++; if (ab[i] > 30) m++; }
  if (n < 30 || m < 30) { toast(n < 30 ? 'Vòng khoanh chưa lấy được hình của mảnh đang chọn' : 'Vòng khoanh lấy cả mảnh — khoanh 1 phần thôi (vd. cẳng tay)', 3000); RS.cut = false; rsSync(); rsDraw(); return; }
  // the joint: middle of where the two halves touch (the cut line)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (aa[i] > 30 && ((x > 0 && ab[i - 1] > 30) || (x < w - 1 && ab[i + 1] > 30) || (y > 0 && ab[i - w] > 30) || (y < h - 1 && ab[i + w] > 30))) { sx += x; sy += y; cnt++; } }
  rsPush();
  const ta = ppPaintTrim(A), tb = ppPaintTrim(B);
  const np = { ...sel, id: newId(), name: sel.name + ' (tách)', role: '', c: ta.c, parent: sel.id, z: sel.z + 0.5, src: null, alts: null, ao: { x: 0, y: 0 } };
  const pc = poly.reduce((o, q) => ({ x: o.x + q.x / poly.length, y: o.y + q.y / poly.length }), { x: 0, y: 0 });
  np.jx = cnt ? sx / cnt : pc.x; np.jy = cnt ? sy / cnt : pc.y; rsShift(np, -ta.x, -ta.y);
  sel.c = tb.c; rsShift(sel, -tb.x, -tb.y);
  RS.pcs.push(np); RS.pcs.sort((a, b) => a.z - b.z).forEach((q, i) => { q.z = i; });
  RS.sel = np.id; RS.cut = false; rsChanged();
  toast('Đã tách thành mảnh mới, gắn vào ' + sel.name + ' ở chỗ cắt', 3000);
}
/* --- ✎ Vẽ on the selected piece: a new canvas with room round it, cropped when the stroke ends --- */
function rsPaintStart(p, pt) {
  const inv = mInv(rsA(p)), l = mApply(inv, pt.x, pt.y), tool = RS.tool;
  if (tool === 'pick') {
    const x = Math.floor(l.x), y = Math.floor(l.y);
    if (x < 0 || y < 0 || x >= p.c.width || y >= p.c.height || rsAlpha(p.c)[y * p.c.width + x] < 20) { toast('Chạm vào chỗ có màu của mảnh'); return true; }
    const d = p.c.getContext('2d').getImageData(x, y, 1, 1).data; setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')); RS.tool = 'brush'; rsSync(); toast('Đã lấy màu', 1500); return true;
  }
  if (tool === 'fill') { const o = ppFillCanvas(p.c, Math.floor(l.x), Math.floor(l.y)); if (o) { rsPush(); p.c = o; addRecentColor(S.color); rsChanged(); } return true; }
  const erase = tool === 'erase', B = brushOf(erase ? 'eraser' : 'brush'), size = RS.size * DPR / RS.vw[0] / p.s;
  rsPush();
  const w0 = p.c.width, h0 = p.c.height, MG = Math.ceil(Math.max(120, size * 3, 0.4 * Math.max(w0, h0)));
  const ww = Math.min(4096, w0 + MG * 2), hh = Math.min(4096, h0 + MG * 2), mx = (ww - w0) >> 1, my = (hh - h0) >> 1;
  const bc = makeCanvas(ww, hh), ink = makeCanvas(ww, hh), out = makeCanvas(ww, hh); bc.getContext('2d').drawImage(p.c, mx, my);
  p.c = out; rsShift(p, mx, my);
  const eng = makeBrushEngine(ink.getContext('2d'), { brush: B, color: S.color, size, pressure: S.pressure, flowK: B.kind === 'dab' && !erase ? Math.max(1, ppPaintOp(false, { kind: 'line' }) / (B.op0 || 1)) : 1, smooth: S.smooth, erase });
  RS.act = { k: 'paint', p, eng, bc, ink, out, erase, op: ppPaintOp(erase, B) };
  const l2 = mApply(mInv(rsA(p)), pt.x, pt.y); eng.add({ x: l2.x, y: l2.y, p: pt.p }, performance.now()); rsPaintCompose(RS.act);
  if (!erase) addRecentColor(S.color);
  return true;
}
function rsPaintCompose(a) {
  const x = a.out.getContext('2d'); x.save(); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.drawImage(a.bc, 0, 0);
  x.globalCompositeOperation = a.erase ? 'destination-out' : 'source-over'; x.globalAlpha = a.op; x.drawImage(a.ink, 0, 0); x.restore();
  rsAlphaC.delete(a.out); rsDraw();
}
function rsPaintMove(a, pt) { const l = mApply(mInv(rsA(a.p)), pt.x, pt.y); a.eng.add({ x: l.x, y: l.y, p: pt.p }, performance.now()); rsPaintCompose(a); }
function rsPaintEnd(a) {
  a.eng.end(); rsPaintCompose(a);
  const t = ppPaintTrim(a.out); a.p.c = t.c; rsShift(a.p, -t.x, -t.y); rsChanged();
}
/* --- buttons on the selected piece --- */
function rsDelete() {
  const p = rsPc(RS.sel); if (!p) return;
  if (RS.edit && p.id === RS.edit) { toast('Không xoá được mảnh gốc của nhân vật đang sửa'); return; }
  rsPush(); for (const k of rsKids(p.id)) { k.parent = p.parent; if (!p.parent) { k.jx = null; k.jy = null; } }
  RS.pcs = RS.pcs.filter(q => q !== p); RS.sel = null; rsChanged();
}
function rsDup() {
  const p = rsPc(RS.sel); if (!p) return; rsPush();
  const c = makeCanvas(p.c.width, p.c.height); c.getContext('2d').drawImage(p.c, 0, 0);
  const q = { ...p, id: newId(), name: p.name + ' 2', role: '', c, x: p.x + 40, y: p.y + 20, parent: null, jx: p.jx, jy: p.jy, z: RS.pcs.reduce((m, o) => Math.max(m, o.z), 0) + 1, src: null, alts: null, ao: { x: 0, y: 0 } };
  RS.pcs.push(q); RS.sel = q.id; rsChanged(); toast('Đã nhân đôi (vd. tay trái → tay phải: ↔ Lật rồi kéo sang bên kia)', 3000);
}
function rsZ(top) {
  const p = rsPc(RS.sel); if (!p) return; rsPush();
  const o = [...RS.pcs].sort((a, b) => a.z - b.z), i = o.indexOf(p); o.splice(i, 1); o.splice(clamp(i + (top ? 1 : -1), 0, o.length), 0, p); o.forEach((q, k) => { q.z = k; }); rsChanged();
}
// the pieces attached to p (☑ kéo cả mảnh đã gắn) follow the change p just had (A0 = its matrix before): turn, size, flip
function rsCarry(p, A0) {
  if (!RS.kids) return;
  const D = mMul(rsA(p), mInv(A0));
  for (const q of rsDesc(p.id)) {
    const c = mApply(D, q.x, q.y), L = mMul(D, mMul(mR(q.r * DEG), mS(q.s * (q.fl ? -1 : 1), q.s)));
    q.x = c.x; q.y = c.y; q.r = Math.atan2(-L[2], L[3]) / DEG; q.s = Math.hypot(L[2], L[3]); q.fl = L[0] * L[3] - L[1] * L[2] < 0;
  }
}
function rsEdit(fn) { const p = rsPc(RS.sel); if (!p) { toast('Chạm chọn một mảnh trước'); return; } rsPush(); fn(p); rsChanged(); }
function rsMode(m) {
  if (!RS) return; RS.mode = m; RS.cut = false; RS.act = null;
  if (m !== 'pose') { cancelAnimationFrame(RS.wigF); RS.wig = false; }
  rsSync(); rsDraw();
}
function rsWiggle() {
  RS.wig = !RS.wig; cancelAnimationFrame(RS.wigF);
  if (!RS.wig) { RS.pose = {}; rsSync(); rsDraw(); return; }
  const t0 = performance.now(), tick = () => {
    if (!RS || !RS.wig) return; const t = (performance.now() - t0) / 1000;
    RS.pcs.forEach((p, i) => { if (p.parent && !(RS.act && RS.act.k === 'rot' && RS.act.p === p)) RS.pose[p.id] = 22 * Math.sin(t * 3.2 + i * 1.3); });
    rsDraw(); RS.wigF = requestAnimationFrame(tick);
  };
  rsSync(); tick();
}
const RS_HINT = {
  arrange: 'Kéo mảnh để ghép (mảnh đã gắn vào nó đi cùng). Nút tròn ⟳ = xoay + phóng to/thu nhỏ. 2 ngón = zoom / dời khung, chạm 2 ngón = hoàn tác.',
  bone: 'Kéo TỪ mảnh con (đặt ngón ở chỗ khớp, vd. vai) SANG mảnh cha (thân) để gắn xương. Kéo chấm xanh để dời khớp. Chấm vàng = mảnh gốc.',
  paint: 'Vẽ lên mảnh đang chọn bằng bút + màu đang chọn (chọn mảnh ở dải dưới). Vẽ ra ngoài mép được, mảnh tự to ra.',
  pose: 'Kéo tay / chân để gập thử quanh khớp (chỉ xem thử, không lưu). Khớp chưa đúng thì sang 🦴 Xương kéo chấm khớp.'
};
function rsSync() {
  if (!RS || !RS.el) return; const el = RS.el, sel = rsPc(RS.sel);
  el.querySelectorAll('[data-rsm]').forEach(b => b.classList.toggle('on', b.dataset.rsm === RS.mode));
  el.querySelector('#rsUndo').disabled = !RS.undo.length; el.querySelector('#rsRedo').disabled = !RS.redo.length;
  el.querySelector('#rsDone').textContent = RS.edit ? '✓ Xong (lưu vào nhân vật)' : '✓ Xong → nhân vật';
  el.querySelector('#rsHint').textContent = RS.cut ? 'Khoanh quanh phần cần tách khỏi mảnh đang chọn (vd. cẳng tay khỏi cánh tay). Esc = thôi.' : RS_HINT[RS.mode];
  const t = el.querySelector('#rsTools'), M = RS.mode;
  let h = '';
  if (M === 'arrange') h = `<button class="chip${RS.cut ? ' on' : ''}" data-rsa="cut" title="Khoanh 1 phần của mảnh đang chọn để tách thành mảnh mới">✂ Khoanh tách</button><label class="lbl"><input type="checkbox" id="rsKids" ${RS.kids ? 'checked' : ''}> kéo cả mảnh đã gắn</label>
    <label class="lbl"><input type="checkbox" id="rsWhite" ${RS.white ? 'checked' : ''}> bỏ giấy trắng</label><label class="lbl"><input type="checkbox" id="rsSplit" ${RS.split ? 'checked' : ''}> mỗi khúc rời = 1 mảnh</label>${RS.edit ? '' : '<button class="chip" data-rsa="clear" title="Bỏ hết mảnh trong xưởng (hoàn tác được)">🗑 Bỏ hết</button>'}`;
  else if (M === 'bone') h = '<button class="chip on" data-rsa="auto" title="Mảnh chưa gắn tự gắn vào mảnh nó chồng lên nhiều nhất, khớp ở giữa chỗ chồng; đoán luôn Đầu / Tay / Chân">🪄 Tự gắn xương</button><button class="chip" data-rsa="unlink">🔓 Bỏ gắn mảnh này</button><button class="chip" data-rsa="unall">Bỏ hết xương</button>';
  else if (M === 'paint') h = ['brush:🖌 Bút', 'erase:⌫ Tẩy', 'fill:🪣 Đổ màu', 'pick:💧 Hút màu'].map(s => { const [k, l] = s.split(':'); return `<button class="chip${RS.tool === k ? ' on' : ''}" data-rst="${k}">${l}</button>`; }).join('') +
    `<label class="lbl rs-col">Màu <input type="color" id="rsCol" value="${/^#[0-9a-f]{6}$/i.test(S.color) ? S.color : '#000000'}"></label><label class="lbl">Cỡ <input type="range" id="rsSize" min="1" max="80" value="${RS.size}"></label>`;
  else h = `<button class="chip${RS.wig ? ' on' : ''}" data-rsa="wig">🔄 Lắc thử mọi khớp</button><button class="chip" data-rsa="rest">↺ Dáng gốc</button>`;
  t.innerHTML = h;
  t.querySelectorAll('[data-rsa]').forEach(b => b.addEventListener('click', () => rsAct(b.dataset.rsa)));
  t.querySelectorAll('[data-rst]').forEach(b => b.addEventListener('click', () => { RS.tool = b.dataset.rst; rsSync(); }));
  const on = (id, ev, fn) => { const x = t.querySelector(id); if (x) x.addEventListener(ev, fn); };
  on('#rsKids', 'change', e => { RS.kids = e.target.checked; }); on('#rsWhite', 'change', e => { RS.white = e.target.checked; }); on('#rsSplit', 'change', e => { RS.split = e.target.checked; });
  on('#rsCol', 'input', e => setColor(e.target.value)); on('#rsSize', 'input', e => { RS.size = +e.target.value; });
  // the selected piece
  const pr = el.querySelector('#rsProps');
  if (!sel) pr.innerHTML = `<span class="lbl">${RS.pcs.length ? 'Chạm 1 mảnh để chọn.' : 'Chưa có mảnh. Bấm <b>＋ Ảnh mảnh</b> (hoặc kéo ảnh vào đây).'}</span>`;
  else {
    const others = RS.pcs.filter(q => q !== sel && !rsIsDesc(sel, q));
    pr.innerHTML = `<div class="rs-row"><b class="rs-name">${escHtml(sel.name)}</b><button class="chip small" data-rsb="name">✎ Tên</button></div>
<div class="rs-row"><label class="lbl">Vai trò <select id="rsRole">${Object.entries(PP_ROLES).map(([k, v]) => `<option value="${k}" ${k === (sel.role || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
<label class="lbl">Gắn vào <select id="rsPar"><option value="">— gốc (không gắn) —</option>${others.map(q => `<option value="${q.id}" ${q.id === sel.parent ? 'selected' : ''}>${escHtml(q.name)}</option>`).join('')}</select></label></div>
<div class="rs-row"><button class="chip" data-rsb="up" title="Lên trước">⏫</button><button class="chip" data-rsb="down" title="Ra sau">⏬</button><button class="chip" data-rsb="flip">↔ Lật</button><button class="chip" data-rsb="rl">⟲</button><button class="chip" data-rsb="rr">⟳</button><button class="chip" data-rsb="sm">−</button><button class="chip" data-rsb="bg">＋</button><button class="chip" data-rsb="dup">⧉</button><button class="chip" data-rsb="del" style="color:var(--danger)">🗑</button></div>`;
    pr.querySelectorAll('[data-rsb]').forEach(b => b.addEventListener('click', () => rsBtn(b.dataset.rsb)));
    pr.querySelector('#rsRole').addEventListener('change', e => rsEdit(p => { p.role = e.target.value; if (p.role && /^Mảnh |^[^ ]+ \d+$/.test(p.name)) p.name = PP_ROLES[p.role]; }));
    pr.querySelector('#rsPar').addEventListener('change', e => {
      const v = e.target.value; if (!v) { if (RS.edit && sel.id !== RS.edit) { toast('Nhân vật đang sửa chỉ có 1 mảnh gốc'); rsSync(); return; } rsEdit(p => { p.parent = null; }); return; }
      const par = rsPc(v), J = rsJD(sel); if (!rsLink(sel, par, sel.jx == null ? null : J)) rsSync();
      else if (sel.jx == null) { const c = rsCorners(rsA(sel), sel.c), top = c.reduce((m, q) => q.y < m.y ? q : m, c[0]); const l = mApply(mInv(rsA(sel)), top.x, top.y); sel.jx = (l.x + sel.c.width / 2) / 2; sel.jy = l.y + 4; rsDraw(); }
    });
  }
  // the strip of pieces (front first)
  const st = el.querySelector('#rsStrip'); st.innerHTML = '';
  for (const p of [...RS.pcs].sort((a, b) => b.z - a.z)) {
    const b = document.createElement('button'); b.className = 'rs-pc' + (p.id === RS.sel ? ' on' : ''); b.title = p.name;
    const c = makeCanvas(56, 56), x = c.getContext('2d'), k = Math.min(52 / p.c.width, 52 / p.c.height); x.drawImage(p.c, (56 - p.c.width * k) / 2, (56 - p.c.height * k) / 2, p.c.width * k, p.c.height * k);
    b.append(c); const s = document.createElement('span'); s.textContent = (p.parent ? '' : '★ ') + p.name; b.append(s);
    b.addEventListener('click', () => { RS.sel = p.id; rsSync(); rsDraw(); });
    st.append(b);
  }
}
async function rsBtn(k) {
  if (k === 'up' || k === 'down') return rsZ(k === 'up');
  if (k === 'dup') return rsDup();
  if (k === 'del') return rsDelete();
  if (k === 'name') {
    const p = rsPc(RS.sel); let v = null;
    await modal({ title: 'Đổi tên mảnh', html: `<input id="rsNm" maxlength="40" value="${escHtml(p.name)}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px">`,
      onOpen: ov => ov.querySelector('#rsNm').addEventListener('keydown', e => e.stopPropagation()),
      buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { v = $('#rsNm').value.trim(); } }] });
    if (v && RS) rsEdit(q => { q.name = v.slice(0, 40); });
    return;
  }
  const f = { flip: p => { p.fl = !p.fl; }, rl: p => { p.r -= 15; }, rr: p => { p.r += 15; }, sm: p => { p.s = Math.max(0.03, p.s / 1.1); }, bg: p => { p.s = Math.min(20, p.s * 1.1); } }[k];
  if (f) rsEdit(p => { const A0 = rsA(p); f(p); rsCarry(p, A0); });
}
function rsAct(k) {
  if (k === 'cut') { if (!RS.sel) { toast('Chạm chọn mảnh cần tách trước'); return; } RS.cut = !RS.cut; rsSync(); rsDraw(); return; }
  if (k === 'clear') { if (!RS.pcs.length) return; rsPush(); RS.pcs = []; RS.sel = null; rsChanged(); toast('Đã bỏ hết mảnh (↶ để lấy lại)'); return; }
  if (k === 'auto') { rsPush(); const n = rsAutoBone(); rsChanged(); toast(n ? `Đã gắn ${n} mảnh. Kiểm tra từng khớp, kéo chấm xanh nếu lệch; sai mảnh cha thì kéo lại từ mảnh con sang mảnh đúng` : 'Mọi mảnh đã gắn rồi (đã đoán vai trò cho mảnh chưa có)', 4500); return; }
  if (k === 'unlink') { const p = rsPc(RS.sel); if (!p || !p.parent) return; if (RS.edit && p.id === RS.edit) return; rsEdit(q => { q.parent = null; }); return; }
  if (k === 'unall') { rsPush(); for (const p of RS.pcs) if (!(RS.edit && p.id === RS.edit)) p.parent = RS.edit || null; rsChanged(); return; }
  if (k === 'wig') { rsWiggle(); return; }
  if (k === 'rest') { RS.wig = false; cancelAnimationFrame(RS.wigF); RS.pose = {}; rsSync(); rsDraw(); }
}
document.querySelectorAll('.rsOpen').forEach(b => b.addEventListener('click', () => rsOpen()));
$('#rsEditBtn').addEventListener('click', () => { if (!S.pp || !ppPart(ppSel)) { toast('Chạm chọn nhân vật cần sửa trước (công cụ Ghép)'); return; } rsOpen(ppSel); });
