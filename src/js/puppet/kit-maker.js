/* ===== 👕 Áo đấu (Kit maker): one shirt template, many teams =====
   A kit = colour slots (body / trim / collar, + shorts / socks), sleeve style, pattern, the user's own logo pictures pinned to the chest
   (x/y 0..1 in the shirt box, s = width), a typed number (style, colour, chest / back / both) and a name on the back.
   • ⚽ Cầu thủ mẫu (torso.kit.gen): the shirt is redrawn from code (kitParts) with 4 views as picture variants of the torso
     (Trước, 3/4, Nghiêng, Sau); 👕 Góc áo on tab Tạo dáng picks the view of this frame (+ the back of the drawn head on Sau).
   • A character the user drew / cut: each slot recolours one colour of the shirt pieces (torso + arms, legs if asked), keeping
     folds and shadows (the brightness ratio to the slot colour is kept: kitRecolor); logos + number are drawn on the torso, clipped
     to the picture. The piece's picture before the first kit stays in p.kit.base (data URL, saved by ppPartMeta), so the next kit
     starts again from the original instead of piling up.
   No real club badge or brand logo ships with the app: logos are the user's own pictures.
   Saved kits: IndexedDB "kit-lib" = [{id, name, t, o}] (every project on this device). Undo: automatic snapshot (new canvases). ===== */
const KIT_LIB_KEY = 'kit-lib', KIT_LIB_MAX = 40;
const KIT_FIELDS = ['c', 'pat', 'body', 'trim', 'collar', 'shorts', 'socks', 'sleeve', 'num', 'numStyle', 'numC', 'numPos', 'pname', 'logos'];
const KIT_SLEEVES = { cuff: 'Viền tay', line: '1 sọc dọc tay', twin: '2 sọc dọc tay', none: 'Trơn' };
const KIT_NUMST = { block: 'Khối', comic: 'Truyện tranh', outline: 'Viền rỗng', '': 'Đơn giản' };
const KIT_NUMPOS = { front: 'Ngực', back: 'Lưng', both: 'Cả hai' };
const KIT_SPOTS = { cl: ['Ngực trái', .68, .22, .16], cr: ['Ngực phải', .32, .22, .16], cc: ['Giữa ngực', .5, .42, .44], bl: ['Bụng', .5, .66, .3] };
const KIT_SWATCH = ['#ffffff', '#1a1a1a', '#e53935', '#b71c1c', '#f06292', '#8e24aa', '#1e88e5', '#1a237e', '#81d4fa', '#43a047', '#1b5e20', '#fdd835', '#fb8c00', '#9e9e9e', '#c9a227'];
const kitPickFields = o => { const r = {}; for (const k of KIT_FIELDS) if (o[k] !== undefined) r[k] = k === 'logos' ? (o.logos || []).map(l => ({ ...l })) : o[k]; return r; };
const kitHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
async function kitLib() { try { return (await idbGet(KIT_LIB_KEY)) || []; } catch (e) { return []; } }
async function kitLibSave(name, o) {
  const rec = { id: 'kit' + Date.now().toString(36), name: String(name || 'Bộ áo').slice(0, 30), t: Date.now(), o: kitPickFields(o) };
  const L = await kitLib(); L.unshift(rec); await idbPut(KIT_LIB_KEY, L.slice(0, KIT_LIB_MAX)); return rec;
}
async function kitLibDel(id) { const L = (await kitLib()).filter(r => r.id !== id); await idbPut(KIT_LIB_KEY, L); }
// a small shirt icon for the saved-kit chips
function kitIcon(o, s = 34) {
  const c = makeCanvas(s, s), x = c.getContext('2d'), K = kitCols(o), k = s / 34;
  const path = () => { x.beginPath(); x.moveTo(12 * k, 3 * k); x.lineTo(3 * k, 9 * k); x.lineTo(6 * k, 15 * k); x.lineTo(9 * k, 13 * k); x.lineTo(9 * k, 31 * k); x.lineTo(25 * k, 31 * k); x.lineTo(25 * k, 13 * k); x.lineTo(28 * k, 15 * k); x.lineTo(31 * k, 9 * k); x.lineTo(22 * k, 3 * k); x.quadraticCurveTo(17 * k, 8 * k, 12 * k, 3 * k); x.closePath(); };
  path(); x.save(); x.clip(); kitFill(x, o, 0, 0, s, s, false); x.restore(); path(); x.strokeStyle = KIT_INK; x.lineWidth = 1.4 * k; x.stroke();
  x.beginPath(); x.moveTo(12 * k, 3 * k); x.quadraticCurveTo(17 * k, 8 * k, 22 * k, 3 * k); x.strokeStyle = K.collar; x.lineWidth = 2.4 * k; x.stroke();
  const n = kitNumStr(o); if (n) { x.font = `900 ${Math.round(10 * k)}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = o.numC || K.trim; x.fillText(n, 17 * k, 20 * k); }
  return c;
}
/* --- which character, which pieces --- */
function kitTarget() {
  if (!S.pp || !S.pp.parts.length) return null;
  const sel = ppPart(ppSel), rid = sel ? ppCharOf(sel) : (ppRoots()[0] || {}).id; return rid ? ppPart(rid) : null;
}
function kitHolder(root) { return charParts(root).find(p => p.role === 'torso') || root; }
const kitIsGen = root => { const h = kitHolder(root); return !!(h && h.kit && h.kit.gen && h.kit.o); };
const KIT_SHIRT_ROLES = /^(torso|arm[LR]|fore[LR])$/, KIT_LEG_ROLES = /^(leg[LR])$/;
function kitUserParts(root, legs) {
  return charParts(root).filter(p => p === kitHolder(root) || KIT_SHIRT_ROLES.test(p.role || '') || (legs && KIT_LEG_ROLES.test(p.role || '')) || (p.kit && p.kit.base));
}
function kitCopy(c) { const d = makeCanvas(c.width, c.height); d.getContext('2d').drawImage(c, 0, 0); return d; }
function kitFit(c, w, h) { if (c.width === w && c.height === h) return c; const d = makeCanvas(w, h), x = d.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h); return d; }
async function kitBaseOf(p) {
  if (p.kitBase) return p.kitBase;
  if (p.kit && p.kit.base) { try { const im = new Image(); im.src = p.kit.base; await im.decode(); const c = makeCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c; } catch (e) {} }
  return p.c;
}
function kitOpaqueBox(c) {
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/* --- recolour: a pixel belongs to a slot when it has the slot colour's hue/chroma (r:g:b ratio) at any brightness from deep shadow to a
   little brighter; it becomes the new colour × the same brightness ratio, so folds, shadows and soft edges stay. Dark ink fades out. --- */
function kitSameCol(a, b, tol = 1) {
  const sa = a[0] + a[1] + a[2] + 1, sb = b[0] + b[1] + b[2] + 1, dc = Math.abs(a[0] / sa - b[0] / sb) + Math.abs(a[1] / sa - b[1] / sb) + Math.abs(a[2] / sa - b[2] / sb);
  const k = sa / sb; return dc < .06 * tol && k > .55 && k < 1.6;
}
function kitRecolor(src, slots, tol = 1) {
  const c = kitCopy(src); if (!slots.length) return c;
  const x = c.getContext('2d', { willReadFrequently: true }), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  const T = slots.map(s => { const [r, g, b] = s.from, sum = r + g + b + 1; return { f: s.from, t: s.to, ss: r * r + g * g + b * b + 1, cr: r / sum, cg: g / sum, cb: b / sum }; });
  const lo = .055 * tol, hi = .1 * tol;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], sum = r + g + b + 1; let best = null, bw = 0, bk = 1;
    for (const s of T) {
      const k = (r * s.f[0] + g * s.f[1] + b * s.f[2]) / s.ss; if (k < .22 || k > 1.3) continue;
      const dc = Math.abs(r / sum - s.cr) + Math.abs(g / sum - s.cg) + Math.abs(b / sum - s.cb);
      let w = dc <= lo ? 1 : dc >= hi ? 0 : (hi - dc) / (hi - lo); if (k < .4) w *= (k - .22) / .18;
      if (w > bw) { bw = w; best = s; bk = k; }
    }
    if (!best) continue;
    for (let j = 0; j < 3; j++) { const t = best.t[j], n = bk <= 1 ? t * bk : t + (255 - t) * Math.min(1, (bk - 1) * 2.5); d[i + j] = Math.round(d[i + j] + (n - d[i + j]) * bw); }
  }
  x.putImageData(img, 0, 0); return c;
}
// the main colours of the shirt pieces (most used first; shades of one colour count as one)
function kitDetect(canvases) {
  const H = new Map();
  for (const c of canvases) {
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, step = Math.max(1, Math.floor(n / 60000));
    for (let p = 0; p < n; p += step) { const i = p * 4; if (d[i + 3] < 220) continue; const r = d[i], g = d[i + 1], b = d[i + 2]; if (r + g + b < 150) continue;
      const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4); let e = H.get(key); if (!e) H.set(key, e = [0, 0, 0, 0]); e[0]++; e[1] += r; e[2] += g; e[3] += b; }
  }
  const out = [];
  for (const e of [...H.values()].sort((a, b) => b[0] - a[0])) { const col = [e[1] / e[0], e[2] / e[0], e[3] / e[0]], m = out.find(o => kitSameCol(o.c, col)); if (m) m.n += e[0]; else if (out.length < 10) out.push({ c: col, n: e[0] }); }
  return out.sort((a, b) => b.n - a.n).filter(o => o.n > 20).slice(0, 6).map(o => kitHex(o.c));
}
function kitUserSlots(k, from) { const to = [k.body, k.trim, k.collar]; return from.map((f, i) => f && to[i] && f !== to[i] ? { from: hexToRgb(f), to: hexToRgb(to[i]) } : null).filter(Boolean); }
function kitUserDecals(c, k) { const x = c.getContext('2d'); x.save(); x.globalCompositeOperation = 'source-atop'; kitDecals(x, k, kitOpaqueBox(c), 'front'); x.restore(); return c; }
/* --- put a kit on a character (one undo step: automatic snapshot) --- */
async function kitApplyGen(root, k) {
  const h = kitHolder(root), o = { ...h.kit.o, ...kitPickFields(k) }; await kitLogosReady(o);
  const byRole = Object.fromEntries(kitParts(o).map(g => [g.role, g]));
  for (const p of charParts(root)) {
    const g = byRole[p.role]; if (!g || !p.kit || !p.kit.gen) continue;
    if (p.role === 'head') { if (!(p.alts && p.alts.length)) { p.alts = g.alts.map(a => ({ c: kitFit(a.c, p.c.width, p.c.height), dx: 0, dy: 0 })); for (const a of p.alts) await encodeHolder(a); } continue; }
    if (!/^(torso|arm[LR]|leg[LR]|shin[LR])$/.test(p.role)) continue;
    const w = p.c.width, hh = p.c.height; p.c = kitFit(g.c, w, hh); p.alts = (g.alts || []).map(a => ({ c: kitFit(a.c, w, hh), dx: 0, dy: 0 }));
    p.kit = p === h ? { gen: 1, o: kitPickAll(o) } : { gen: 1 };
    await encodePart(p); for (const a of p.alts) await encodeHolder(a);
  }
}
async function kitApplyUser(root, k, U) {
  await kitLogosReady(k);
  const h = kitHolder(root), slots = kitUserSlots(k, U.from);
  for (const p of kitUserParts(root, U.legs)) {
    const base = await kitBaseOf(p), use = p === h || KIT_SHIRT_ROLES.test(p.role || '') || (U.legs && KIT_LEG_ROLES.test(p.role || ''));
    let c = use ? kitRecolor(base, slots, U.tol) : kitCopy(base); if (p === h) c = kitUserDecals(c, k);
    const b64 = p.kit && p.kit.base ? p.kit.base : base.toDataURL('image/png');
    p.kitBase = base; p.kit = p === h ? { base: b64, o: kitPickFields(k), from: U.from.slice(), tol: U.tol, legs: !!U.legs } : { base: b64 };
    p.c = c; await encodePart(p);
  }
}
async function kitApply(root, k, U) {
  if (playing) stopPlay(); commitFloating(); histFlush();
  if (kitIsGen(root)) await kitApplyGen(root, k); else await kitApplyUser(root, k, U);
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); ppSyncBar(); scheduleSave(); requestRender();
}
/* --- 👕 Góc áo: the view of the drawn player on this frame (torso picture 0..3, the head turns its back on Sau) --- */
function kitViewPart() { const r = kitTarget(); return r && kitIsGen(r) ? kitHolder(r) : null; }
function kitSetView(v) {
  const t = kitViewPart(); if (!t) { toast('Chọn cầu thủ mẫu (⚽) trước'); return; }
  const f = curFrame(), before = ppState(f), head = charParts(t).find(p => p.role === 'head' && p.kit && p.kit.gen && p.alts && p.alts.length);
  const q = ppQ(f, t.id); if (v) q.v = v; else delete q.v;
  if (head) { const hq = ppQ(f, head.id); if (v === 3) hq.v = 1; else delete hq.v; }
  ppMarkKey(f, t.id); pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender();
}
function kitViewSync() {
  const row = $('#kitViewRow'); if (!row) return; const t = kitViewPart(); row.hidden = !t; if (!t) return;
  const f = curFrame(), q = f && f.pp && f.pp[t.id], v = (q && q.v) || 0;
  row.querySelectorAll('[data-kv]').forEach(b => b.classList.toggle('on', +b.dataset.kv === v));
}
/* --- the dialog --- */
async function kitLogoFromFile(file) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { toast('Không đọc được ảnh'); return null; }
  const k0 = Math.min(1, 240 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k0)), h = Math.max(1, Math.round(bmp.height * k0));
  const c = makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  const img = x.getImageData(0, 0, w, h), d = img.data; let opaque = 0;
  for (const i of [0, w - 1, (h - 1) * w, h * w - 1]) if (d[i * 4 + 3] > 250) opaque++;
  if (opaque >= 3) { const fig = aiWhiteMask(img); for (let i = 0; i < w * h; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * fig[i]); x.putImageData(img, 0, 0); }   // white paper around the logo → transparent
  const B = kitOpaqueBox(c), o = makeCanvas(B.w, B.h); o.getContext('2d').drawImage(c, B.x, B.y, B.w, B.h, 0, 0, B.w, B.h);
  return o.toDataURL('image/png');
}
async function kitMaker(root, start) {
  root = root === undefined ? kitTarget() : root;
  const gen = !root || kitIsGen(root), h = root ? kitHolder(root) : null;
  const base0 = gen ? (h ? h.kit.o : (start || kitOpt)) : null, o = kitPickFields(gen ? base0 : ((h.kit && h.kit.o) || {}));   // base0: skin, hair… of the drawn player
  const L = kitLayout(), sb = kitShirtBox(L), tb = kitTorsoBox(L);
  const U = { from: [], tol: 1, legs: false }, bases = new Map();
  if (!gen) {
    for (const p of kitUserParts(root, true)) bases.set(p, await kitBaseOf(p));
    const shirt = [...bases.keys()].filter(p => p === h || KIT_SHIRT_ROLES.test(p.role || '')).map(p => bases.get(p));
    U.cands = kitDetect(shirt);
    if (h.kit && h.kit.from) { U.from = h.kit.from.slice(); U.tol = h.kit.tol || 1; U.legs = !!h.kit.legs; } else U.from = U.cands.slice(0, 3);
    while (U.from.length < 3) U.from.push('');
    ['body', 'trim', 'collar'].forEach((s, i) => { if (!o[s]) o[s] = U.from[i] || '#ffffff'; });
  } else { const K = kitCols(o); for (const s of ['body', 'trim', 'collar', 'shorts', 'socks']) o[s] = o[s] || K[s]; }
  o.logos = o.logos || [];
  await kitLogosReady(o);
  let view = 'front', slot = 'body', sel = o.logos.length ? 0 : -1, lib = await kitLib();
  const slotNames = gen ? { body: 'Thân áo', trim: 'Sọc / viền', collar: 'Cổ áo', shorts: 'Quần', socks: 'Tất', numC: 'Số & tên' } : { body: 'Màu 1', trim: 'Màu 2', collar: 'Màu 3', numC: 'Số' };
  const chip = (attr, v, on, html, extra = '') => `<button class="chip small ${on ? 'on' : ''}" data-${attr}="${v}" ${extra}>${html}</button>`;
  const dot = c => `<span class="kmDot" style="background:${c || 'transparent'}"></span>`;
  const html = `<div class="km">
    <div class="kmLeft"><canvas id="kmPrev" width="520" height="600"></canvas><div id="kmFull"></div>
      ${gen ? `<div class="kmViews">${KIT_VIEWS.map(([v, n]) => chip('kmv', v, v === 'front', n)).join('')}</div>` : ''}
      <p class="lbl kmHint">Kéo logo trên hình để dời. Chạm chỗ khác = đưa logo đang chọn tới đó.</p></div>
    <div class="kmRight">
      <div><span class="lbl"><b>Bộ áo đã lưu</b> (chạm để dùng):</span><div id="kmLib" class="kmLib"></div></div>
      <div><span class="lbl"><b>Màu</b> — chọn ô rồi chạm màu:</span><div class="kmSlots">${Object.entries(slotNames).map(([k, n]) => `<button class="chip small kmSlot" data-kms="${k}">${dot()} ${n}</button>`).join('')}</div>
        <div class="kmSw">${KIT_SWATCH.map(c => `<button class="kmSwb" data-kmc="${c}" style="background:${c}" title="${c}"></button>`).join('')}<input type="color" id="kmCustom" title="Màu khác"></div></div>
      ${gen ? `<div><span class="lbl"><b>Kiểu áo</b></span><br>${Object.entries(KIT_PATS).map(([k, v]) => chip('kmp', k, (o.pat || 'plain') === k, v)).join('')}</div>
      <div><span class="lbl"><b>Tay áo</b> (sọc chạy dọc theo tay, cong theo khi gập tay)</span><br>${Object.entries(KIT_SLEEVES).map(([k, v]) => chip('kmsl', k, (o.sleeve || 'cuff') === k, v)).join('')}</div>`
      : `<div class="kmFrom"><span class="lbl">Màu đang có trên áo (chạm ô để đổi màu gốc của ô đó):</span><div id="kmFrom"></div>
        <label class="lbl">Độ nhạy màu <input type="range" id="kmTol" min="0.5" max="2" step="0.1" value="${U.tol}" style="vertical-align:middle;width:120px"></label>
        <label class="lbl"><input type="checkbox" id="kmLegs" ${U.legs ? 'checked' : ''}> Đổi cả màu quần (đùi)</label></div>`}
      <div><span class="lbl"><b>Số áo</b></span> <input id="kmNum" type="text" inputmode="numeric" maxlength="2" value="${kitNumStr(o)}" class="kmIn" style="width:64px">
        ${gen ? `<span class="lbl">Tên sau lưng</span> <input id="kmName" type="text" maxlength="14" value="${escHtml(o.pname || '')}" class="kmIn" style="width:130px">` : ''}<br>
        <span class="lbl">Kiểu số</span> ${Object.entries(KIT_NUMST).map(([k, v]) => chip('kmns', k, (o.numStyle || '') === k, v)).join('')}<br>
        ${gen ? `<span class="lbl">In ở</span> ${Object.entries(KIT_NUMPOS).map(([k, v]) => chip('kmnp', k, (o.numPos || 'front') === k, v)).join('')}` : ''}</div>
      <div><span class="lbl"><b>Logo / nhà tài trợ</b> (ảnh của bạn, dán lên ngực, đi theo thân)</span><br>
        <button class="chip small on" id="kmAddLogo">＋ Thêm logo</button><span id="kmLogos"></span><br>
        <span id="kmLogoTools">${Object.entries(KIT_SPOTS).map(([k, v]) => chip('kmspot', k, false, v[0])).join('')}<button class="chip small" data-kmz="-1">− Nhỏ</button><button class="chip small" data-kmz="1">＋ To</button><button class="chip small" id="kmDelLogo">🗑 Bỏ</button></span></div>
      <div><button class="chip small" id="kmSave">💾 Lưu bộ áo này</button> <span class="lbl">${gen ? '' : 'Nhân vật tự vẽ: chỉ mặt trước (số in ở ngực).'}</span></div>
    </div></div>`;
  let ov = null, raf = 0, fullT = 0;
  const torsoView = () => {
    if (gen) return { c: kitTorsoCanvas(o, L, view, KIT_SKIN[base0.skin] || KIT_SKIN[1]), B: { x: sb.x - tb[0], y: sb.y - tb[1], w: sb.w, h: sb.h } };
    const base = bases.get(h), c = kitRecolor(base, kitUserSlots(o, U.from), U.tol), B = kitOpaqueBox(base); kitUserDecals(c, o); return { c, B };
  };
  let cur = null;
  const draw = () => {
    raf = 0; const cv = ov.querySelector('#kmPrev'), x = cv.getContext('2d'); cur = torsoView(); const c = cur.c, k = Math.min(cv.width / c.width, cv.height / c.height);
    cur.k = k; cur.ox = (cv.width - c.width * k) / 2; cur.oy = (cv.height - c.height * k) / 2;
    x.clearRect(0, 0, cv.width, cv.height); x.drawImage(c, cur.ox, cur.oy, c.width * k, c.height * k);
    if (view === 'front' && sel >= 0 && o.logos[sel]) { const r = logoRect(sel); if (r) { x.strokeStyle = '#ff4081'; x.lineWidth = 3; x.setLineDash([8, 6]); x.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); x.setLineDash([]); } }
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); clearTimeout(fullT); fullT = setTimeout(drawFull, 200); };
  const drawFull = () => {
    const box = ov && ov.querySelector('#kmFull'); if (!box) return; let parts;
    if (gen) parts = kitParts({ ...base0, ...o }).sort((a, b) => a.z - b.z);
    else { const slots = kitUserSlots(o, U.from); parts = charParts(root).map(p => { const b = bases.get(p); if (!b) return p; const use = p === h || KIT_SHIRT_ROLES.test(p.role || '') || (U.legs && KIT_LEG_ROLES.test(p.role || '')); let c = use ? kitRecolor(b, slots, U.tol) : b; if (p === h) c = kitUserDecals(c === b ? kitCopy(b) : c, o); return { ...p, c }; }); }
    const t = charThumb(parts, 240); t.style.cssText = 'width:120px;height:120px'; box.innerHTML = ''; box.append(t);
  };
  const logoRect = i => { const l = o.logos[i], im = l && kitImg(l.src); if (!im || !cur) return null; const B = cur.B, w = l.s * B.w, hh = w * im.naturalHeight / im.naturalWidth; return { x: cur.ox + (B.x + l.x * B.w - w / 2) * cur.k, y: cur.oy + (B.y + l.y * B.h - hh / 2) * cur.k, w: w * cur.k, h: hh * cur.k }; };
  const syncUI = () => {
    ov.querySelectorAll('[data-kms]').forEach(b => { b.classList.toggle('on', b.dataset.kms === slot); b.querySelector('.kmDot').style.background = o[b.dataset.kms] || kitCols(o).trim; });
    const lg = ov.querySelector('#kmLogos'); lg.innerHTML = ''; o.logos.forEach((l, i) => { const b = document.createElement('button'); b.className = 'chip small kmLogo' + (i === sel ? ' on' : ''); b.innerHTML = `<img src="${l.src}" alt="">`; b.addEventListener('click', () => { sel = i; syncUI(); redraw(); }); lg.append(b); });
    ov.querySelector('#kmLogoTools').hidden = sel < 0;
    const fr = ov.querySelector('#kmFrom'); if (fr) { fr.innerHTML = ['body', 'trim', 'collar'].map((s, i) => `<button class="chip small" data-kmf="${i}">${slotNames[s]}: ${dot(U.from[i])} ${U.from[i] ? '→ ' + dot(o[s]) : 'không đổi'}</button>`).join(' ');
      fr.querySelectorAll('[data-kmf]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.kmf, opts = [...U.cands, ''], j = (opts.indexOf(U.from[i]) + 1) % opts.length; U.from[i] = opts[j]; syncUI(); redraw(); })); }
    const lb = ov.querySelector('#kmLib'); lb.innerHTML = ''; if (!lib.length) lb.innerHTML = '<span class="lbl">Chưa có. Làm xong bấm 💾 Lưu bộ áo này.</span>';
    for (const r of lib) { const b = document.createElement('span'); b.className = 'chip small kmKit'; b.append(kitIcon(r.o)); const t = document.createElement('span'); t.textContent = r.name; b.append(t); const d = document.createElement('button'); d.className = 'kmDel'; d.textContent = '✕'; d.title = 'Xoá bộ áo này';
      d.addEventListener('click', async e => { e.stopPropagation(); await kitLibDel(r.id); lib = await kitLib(); syncUI(); }); b.append(d);
      b.addEventListener('click', async () => { kitLoad(r.o); await kitLogosReady(o); sel = o.logos.length ? 0 : -1; syncAll(); redraw(); }); lb.append(b); }
  };
  const syncAll = () => {
    ov.querySelectorAll('[data-kmp]').forEach(b => b.classList.toggle('on', b.dataset.kmp === (o.pat || 'plain')));
    ov.querySelectorAll('[data-kmsl]').forEach(b => b.classList.toggle('on', b.dataset.kmsl === (o.sleeve || 'cuff')));
    ov.querySelectorAll('[data-kmns]').forEach(b => b.classList.toggle('on', b.dataset.kmns === (o.numStyle || '')));
    ov.querySelectorAll('[data-kmnp]').forEach(b => b.classList.toggle('on', b.dataset.kmnp === (o.numPos || 'front')));
    ov.querySelector('#kmNum').value = kitNumStr(o); const nm = ov.querySelector('#kmName'); if (nm) nm.value = o.pname || ''; syncUI();
  };
  // a saved kit on this character: its colours go into the slots (for a drawn character: the slots' NEW colours)
  const kitLoad = r => { for (const k of KIT_FIELDS) delete o[k]; Object.assign(o, kitPickFields(r)); o.logos = o.logos || []; const K = kitCols(o); for (const s of ['body', 'trim', 'collar', 'shorts', 'socks']) o[s] = o[s] || K[s]; };
  const setCol = c => { o[slot] = c; syncUI(); redraw(); };
  const onOpen = m => {
    ov = m; ov.querySelector('.dlg').classList.add('kmDlg');
    ov.querySelectorAll('[data-kms]').forEach(b => b.addEventListener('click', () => { slot = b.dataset.kms; syncUI(); }));
    ov.querySelectorAll('[data-kmc]').forEach(b => b.addEventListener('click', () => setCol(b.dataset.kmc)));
    ov.querySelector('#kmCustom').addEventListener('input', e => setCol(e.target.value));
    const grp = (attr, set) => ov.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => { set(b.dataset[attr]); ov.querySelectorAll(`[data-${attr}]`).forEach(y => y.classList.toggle('on', y === b)); redraw(); }));
    grp('kmp', v => o.pat = v); grp('kmsl', v => o.sleeve = v); grp('kmns', v => { o.numStyle = v; kitLogosReady(o).then(redraw); }); grp('kmnp', v => o.numPos = v); grp('kmv', v => view = v);
    ov.querySelector('#kmNum').addEventListener('input', e => { o.num = e.target.value.replace(/\D/g, '').slice(0, 2); redraw(); });
    const nm = ov.querySelector('#kmName'); if (nm) nm.addEventListener('input', e => { o.pname = e.target.value; kitLogosReady(o).then(redraw); });
    const tol = ov.querySelector('#kmTol'); if (tol) tol.addEventListener('input', e => { U.tol = +e.target.value; redraw(); });
    const legs = ov.querySelector('#kmLegs'); if (legs) legs.addEventListener('change', e => { U.legs = e.target.checked; redraw(); });
    ov.querySelector('#kmAddLogo').addEventListener('click', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { if (i.files[0]) kitAddLogo(i.files[0]); }; i.click(); });
    ov.querySelectorAll('[data-kmspot]').forEach(b => b.addEventListener('click', () => { const l = o.logos[sel]; if (!l) return; const s = KIT_SPOTS[b.dataset.kmspot]; l.x = s[1]; l.y = s[2]; l.s = s[3]; redraw(); }));
    ov.querySelectorAll('[data-kmz]').forEach(b => b.addEventListener('click', () => { const l = o.logos[sel]; if (!l) return; l.s = Math.max(.05, Math.min(.9, l.s * (+b.dataset.kmz > 0 ? 1.15 : 1 / 1.15))); redraw(); }));
    ov.querySelector('#kmDelLogo').addEventListener('click', () => { if (sel < 0) return; o.logos.splice(sel, 1); sel = o.logos.length ? 0 : -1; syncUI(); redraw(); });
    ov.querySelector('#kmSave').addEventListener('click', async () => {
      const name = await kitAskName(); if (!name) return;
      try { await kitLibSave(name, o); lib = await kitLib(); syncUI(); toast(`Đã lưu bộ áo "${name}" — lần sau chạm là mặc cho nhân vật khác`, 3000); } catch (e) { toast('Chưa lưu được (bộ nhớ máy đầy?)'); }
    });
    // drag a logo on the picture (front view)
    const cv = ov.querySelector('#kmPrev'); let drag = null;
    const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
    cv.addEventListener('pointerdown', e => {
      if (view !== 'front' || !cur) return; const p = at(e); let hit = -1;
      for (const i of [sel, ...o.logos.map((_, j) => j).reverse()]) { const r = i >= 0 && logoRect(i); if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { hit = i; break; } }
      if (hit < 0 && sel >= 0) { const l = o.logos[sel], B = cur.B; l.x = ((p.x - cur.ox) / cur.k - B.x) / B.w; l.y = ((p.y - cur.oy) / cur.k - B.y) / B.h; hit = sel; }
      if (hit < 0) return; sel = hit; const l = o.logos[sel]; drag = { p, x: l.x, y: l.y }; cv.setPointerCapture(e.pointerId); syncUI(); redraw();
    });
    cv.addEventListener('pointermove', e => { if (!drag) return; const p = at(e), l = o.logos[sel], B = cur.B; l.x = Math.max(0, Math.min(1, drag.x + (p.x - drag.p.x) / cur.k / B.w)); l.y = Math.max(0, Math.min(1, drag.y + (p.y - drag.p.y) / cur.k / B.h)); redraw(); });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    syncAll(); draw(); drawFull();
  };
  const kitAddLogo = async file => {
    const src = await kitLogoFromFile(file); if (!src) return;
    const spot = KIT_SPOTS[['cl', 'cr', 'cc', 'bl'][Math.min(3, o.logos.length)]];
    o.logos.push({ src, x: spot[1], y: spot[2], s: spot[3] }); sel = o.logos.length - 1; await kitLogosReady(o); view = 'front';
    ov.querySelectorAll('[data-kmv]').forEach(b => b.classList.toggle('on', b.dataset.kmv === 'front')); syncUI(); redraw();
  };
  kitMakerApi = { o, U, addLogo: f => kitAddLogo(f), load: r => { kitLoad(r); return kitLogosReady(o).then(() => { syncAll(); redraw(); }); } };
  const v = await modal({ title: '👕 Áo đấu', html, onOpen, buttons: [{ label: 'Huỷ', value: null }, { label: root ? '✓ Mặc cho nhân vật' : '＋ Thêm cầu thủ mặc áo này', value: 'ok', primary: true }] });
  kitMakerApi = null; cancelAnimationFrame(raf); clearTimeout(fullT);
  if (v !== 'ok') return false;
  if (!root) { kitOpt = { ...base0, ...kitPickFields(o) }; try { localStorage.setItem('fs-kit', JSON.stringify(kitOpt)); } catch (e) {} const ps = await kitAdd(kitOpt); await ppAskNew(ps && ps[0] && ppCharOf(ps[0])); return true; }
  await kitApply(root, o, U);
  toast('Đã mặc áo mới — lỡ tay thì ↶ Hoàn tác' + (gen ? '. Đổi góc áo (Trước / 3/4 / Nghiêng / Sau) ở tab Tạo dáng' : ''), 4000);
  return true;
}
let kitMakerApi = null;   // the open dialog (tests, file drop)
async function kitAskName() {
  let name = null;
  const v = await modal({ title: '💾 Lưu bộ áo', html: `<label class="lbl">Tên bộ áo (vd. Đội đỏ sân nhà)<br><input id="kmKitName" maxlength="30" value="Bộ áo ${(await kitLib()).length + 1}" class="kmIn" style="width:100%;box-sizing:border-box"></label>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '💾 Lưu', primary: true, value: true, action: () => { name = $('#kmKitName').value.trim() || 'Bộ áo'; } }] });
  return v ? name : null;
}
$('#kitMakerBtn').addEventListener('click', () => kitMaker());
$('#kitMakerBtn0').addEventListener('click', () => kitMaker(null));
$('#kitViewMaker').addEventListener('click', () => kitMaker());
document.querySelectorAll('[data-kv]').forEach(b => b.addEventListener('click', () => kitSetView(+b.dataset.kv)));
// paste a picture (computer) while 👕 Áo đấu is open = add it as a logo
document.addEventListener('paste', e => {
  if (!kitMakerApi) return; const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(q => /^image\//.test(q.type));
  if (f) { e.preventDefault(); e.stopPropagation(); kitMakerApi.addLogo(f); }
}, true);
