/* ===== 🧩 Kho bộ phận: a library of body-part pictures, one folder per kind (đầu, thân, tay trái/phải, chân trái/phải) =====
   For people who make parts with AI and cut them: save each picture once (a head with every expression, straight / leaning
   torsos, fists / open hands / holding hands, legs in different directions), then build a frame by picking.
   - Save: 💾 the selected piece (a head takes its loose eyes/mouth into the picture) or 💾 every piece of the character;
     ＋ Ảnh in a folder = a picture with one or more parts on white paper (each loose shape = one item, joints guessed for
     parts drawn hanging down; ✏ moves them).
   - Use: the selected character's part of that kind gets the item as one of its pictures (alts, like 🔄 hình của mảnh) and
     shows it on this frame (or the frames picked): it stays the same part, so bones, tweens, 🫠 Uốn mềm, 🫨 Rung, 〰 đường đi
     keep working. The item is fitted onto the part: joint on the part's joint, turned along the bone, sized to match.
     A torso / upper arm / thigh item also knows where its children hang (a = {childRole: point}); the picture then moves those
     joints while it shows (alt.j, read by ppMats), so a leaning torso carries the head and arms with it.
   - 🧍 Ghép nhân vật từ kho: pick one item per part and the pieces are put together on the joints into a new character.
   IndexedDB: "part-lib" = [{id, g, role, name, t, thumb: Blob}] (newest first), "part:<id>" = {png, w, h, j, t, a, s}
   (points in the item's own pixels; j = joint to the parent, t = far end (hand, foot) or null, s = size tweak). --- */
const PL_KEY = 'part-lib', PL_MAX = 400;
const PL_GROUPS = [
  { g: 'head', icon: '🙂', name: 'Đầu', roles: ['head'] },
  { g: 'torso', icon: '👕', name: 'Thân', roles: ['torso'] },
  { g: 'armL', icon: '💪', name: 'Tay trái', roles: ['foreL', 'armL'] },
  { g: 'armR', icon: '💪', name: 'Tay phải', roles: ['foreR', 'armR'] },
  { g: 'legL', icon: '🦵', name: 'Chân trái', roles: ['shinL', 'legL'] },
  { g: 'legR', icon: '🦵', name: 'Chân phải', roles: ['shinR', 'legR'] },
];
const PL_ROLE_NAME = { head: 'Đầu', torso: 'Thân', foreL: 'Bàn tay + cẳng tay', armL: 'Tay trên (vai → khuỷu)', foreR: 'Bàn tay + cẳng tay', armR: 'Tay trên (vai → khuỷu)', shinL: 'Ống chân + bàn chân', legL: 'Đùi (hông → gối)', shinR: 'Ống chân + bàn chân', legR: 'Đùi (hông → gối)' };
const PL_CHILD = { armL: 'foreL', armR: 'foreR', legL: 'shinL', legR: 'shinR' };   // the joint at the end of an upper limb
const PL_SIDE = { L: 'R', R: 'L' };
const plGroupOf = role => PL_GROUPS.find(G => G.roles.includes(role));
const PL = { list: null, urls: new Map(), recs: new Map(), ver: 0, g: 'head', hideFace: true, stripKey: '', vw: '' };
// góc nhìn of an item (list entry .vw): '' = any; PL.vw = the view shown (and given to new items)
const PL_VIEWS = { '': 'Mọi góc', front: 'Thẳng', q34: '3/4', side: 'Nghiêng' };
const plVwOk = e => !PL.vw || !e.vw || e.vw === PL.vw;
const plVwChips = attr => Object.entries(PL_VIEWS).map(([k, v]) => `<button class="chip small${PL.vw === k ? ' on' : ''}" data-${attr}="${k}">${v}</button>`).join('');
async function plList() { if (!PL.list) { try { PL.list = (await idbGet(PL_KEY)) || []; } catch (e) { PL.list = []; } } return PL.list; }
async function plPutList(L) { PL.list = L; PL.ver++; await idbPut(PL_KEY, L); }
function plUrl(e) { let u = PL.urls.get(e.id); if (!u && e.thumb) { u = URL.createObjectURL(e.thumb); PL.urls.set(e.id, u); } return u || ''; }
function plThumb(c, size = 112) {
  const t = makeCanvas(size, size), x = t.getContext('2d'), k = Math.min((size - 6) / c.width, (size - 6) / c.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(c, (size - c.width * k) / 2, (size - c.height * k) / 2, c.width * k, c.height * k); return t;
}
async function plLoad(id) {
  if (PL.recs.has(id)) return PL.recs.get(id);
  let r = null; try { r = await idbGet('part:' + id); } catch (e) {}
  if (!r || !r.png) return null;
  const bmp = await decodePng(r.png), c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
  const e = (await plList()).find(x => x.id === id), rec = { ...r, c, id, role: e ? e.role : r.role, name: e ? e.name : '' };
  PL.recs.set(id, rec); return rec;
}
// store one picture as an item of the library; returns its id
async function plStore(c, o) {
  const id = 'bp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const png = await (await toBlob(c)).arrayBuffer(), thumb = await toBlob(plThumb(c));
  const rec = { png, w: c.width, h: c.height, j: o.j, t: o.t || null, a: o.a || null, s: o.s || 1, role: o.role };
  await idbPut('part:' + id, rec);
  const L = [...await plList()]; L.unshift({ id, g: plGroupOf(o.role).g, role: o.role, name: o.name || PL_ROLE_NAME[o.role], t: Date.now(), thumb, vw: o.vw != null ? o.vw : PL.vw });
  for (const old of L.splice(PL_MAX)) { try { await idbDel('part:' + old.id); } catch (e) {} }
  await plPutList(L); return id;
}
async function plRemove(id) {
  await plPutList((await plList()).filter(x => x.id !== id)); PL.recs.delete(id);
  const u = PL.urls.get(id); if (u) { URL.revokeObjectURL(u); PL.urls.delete(id); }
  try { await idbDel('part:' + id); } catch (e) {}
}
// rewrite the points / size / name / kind of an item
async function plUpdate(id, ch) {
  const r = await idbGet('part:' + id); if (!r) return;
  const nr = { ...r, ...ch }; delete nr.name; delete nr.vw; await idbPut('part:' + id, nr); PL.recs.delete(id);
  const L = (await plList()).map(x => x.id === id ? { ...x, role: ch.role || x.role, g: plGroupOf(ch.role || x.role).g, name: ch.name != null ? ch.name : x.name, vw: ch.vw != null ? ch.vw : x.vw } : x);
  await plPutList(L);
}
/* --- a piece of the project → an item: its picture on this frame (a head with its loose eyes / mouth drawn in), joint, far
   end and the joints of the pieces hung on it, all in the picture's own pixels --- */
function plFromPart(p, f) {
  const pose = ppPoseFor(f), M = ppMats(pose), q = pose[p.id], im = ppImg(p, q);
  const face = p.role === 'head' ? S.pp.parts.filter(c => c.parent === p.id && (c.role === 'eyes' || c.role === 'mouth') && !(pose[c.id] && pose[c.id].h) && !(im.holder && im.holder.hk)) : [];
  const Mi = mInv(M[p.id]), draws = [{ c: im.c, m: mT(im.x, im.y) }];
  for (const c of face.sort((a, b) => a.z - b.z)) { const ci = ppImg(c, pose[c.id]); draws.push({ c: ci.c, m: mMul(mMul(Mi, M[c.id]), mT(ci.x, ci.y)), z: c.z > p.z }); }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of draws) for (const k of rsCorners(d.m, d.c)) { x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y); x1 = Math.max(x1, k.x); y1 = Math.max(y1, k.y); }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const c = makeCanvas(Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))), cx = c.getContext('2d');
  draws.filter(d => !d.z).concat(draws.filter(d => d.z)).forEach(d => { cx.setTransform(1, 0, 0, 1, -x0, -y0); cx.transform(...d.m); cx.drawImage(d.c, 0, 0); });
  const loc = (x, y) => ({ x: x - x0, y: y - y0 }), a = {};
  for (const k of S.pp.parts.filter(k2 => k2.parent === p.id && k2.role && k2.role !== 'eyes' && k2.role !== 'mouth')) { const jo = ppAltJoint(p, pose, k.role) || { x: 0, y: 0 }; a[k.role] = loc(k.px + jo.x, k.py + jo.y); }
  return { c, role: p.role, j: loc(p.px, p.py), t: p.tip ? loc(p.tip.x, p.tip.y) : null, a: Object.keys(a).length ? a : null };
}
const plSel = () => { const p = S.pp && ppPart(ppSel); return p && plGroupOf(p.role) ? p : null; };
async function plSavePart() {
  const p = S.pp && ppPart(ppSel); if (!p) { toast('Chạm chọn 1 mảnh (đầu, thân, tay, chân) trước'); return; }
  if (!plGroupOf(p.role)) { toast('Mảnh này chưa có vai trò Đầu / Thân / Tay / Chân — đặt vai trò ở tab 🧩 Mảnh & hình rồi lưu'); return; }
  const G = plGroupOf(p.role); let name = null;
  const ok = await modal({ title: `💾 Lưu vào 🧩 Kho bộ phận › ${G.icon} ${G.name}`, html: `<p>Lưu hình <b>${escHtml(PL_ROLE_NAME[p.role])}</b> đang hiện ở frame này${p.role === 'head' ? ' (gồm cả mắt, miệng rời)' : ''}, cùng khớp. Sau đó chạm hình trong kho là đổi được ở frame nào cũng được.</p><label class="lbl">Tên (vd. Cười to, Nắm đấm, Thân nghiêng)<br><input id="plName" maxlength="40" value="${escHtml(PL_ROLE_NAME[p.role])}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"></label>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '💾 Lưu', primary: true, value: true, action: () => { name = $('#plName').value.trim(); } }] });
  if (!ok) return;
  const it = plFromPart(p, curFrame());
  try { await plStore(it.c, { ...it, name }); } catch (e) { console.error(e); toast('Chưa lưu được (bộ nhớ máy đầy?)'); return; }
  PL.g = G.g; plStripSync(true); toast(`Đã lưu vào 🧩 Kho bộ phận › ${G.name}`, 3000);
}
// every head / torso / arm / leg piece of the selected character, one item each
async function plSaveChar() {
  const sel = S.pp && ppPart(ppSel); if (!sel) { toast('Chạm chọn nhân vật cần lưu'); return 0; }
  const parts = charParts(sel).filter(p => plGroupOf(p.role)); if (!parts.length) { toast('Nhân vật này chưa có mảnh nào mang vai trò Đầu / Thân / Tay / Chân'); return 0; }
  const nm = charBaseName((ppPart(ppCharOf(sel)) || sel).lname || '') || 'Nhân vật', f = curFrame();
  try { for (const p of parts) { const it = plFromPart(p, f); await plStore(it.c, { ...it, name: nm + ' · ' + PL_ROLE_NAME[p.role] }); } }
  catch (e) { console.error(e); toast('Chưa lưu được (bộ nhớ máy đầy?)'); return 0; }
  plStripSync(true); toast(`Đã lưu ${parts.length} bộ phận vào 🧩 Kho bộ phận (mỗi loại 1 thư mục)`, 3500);
  return parts.length;
}
/* --- a picture from AI → items: white paper off, every loose shape one item, joints guessed for a part drawn upright
   (head: neck at the bottom; torso: neck on top, shoulders, hips; arm / leg hanging down: joint on top, end at the bottom) --- */
function plGuess(c, role) {
  const w = c.width, h = c.height, al = rsAlpha(c);
  const midAt = fy => { const y = clamp(Math.round(fy * (h - 1)), 0, h - 1); let s = 0, n = 0; for (let x = 0; x < w; x++) if (al[y * w + x] > 40) { s += x; n++; } return { x: n ? s / n : w / 2, y }; };
  if (role === 'head') return { j: midAt(0.93), t: null, a: null };
  if (role === 'torso' && (PL.vw === 'side' || PL.vw === 'q34')) { const sd = PL.vw === 'side'; return { j: { x: w / 2, y: h * 0.82 }, t: null, a: { head: midAt(0.03), armL: { x: w * (sd ? 0.45 : 0.3), y: h * 0.14 }, armR: { x: w * (sd ? 0.55 : 0.75), y: h * 0.14 }, legL: { x: w * (sd ? 0.45 : 0.38), y: h * 0.9 }, legR: { x: w * (sd ? 0.55 : 0.64), y: h * 0.9 } } }; }
  if (role === 'torso') return { j: { x: w / 2, y: h * 0.82 }, t: null, a: { head: midAt(0.03), armL: { x: w * 0.14, y: h * 0.13 }, armR: { x: w * 0.86, y: h * 0.13 }, legL: { x: w * 0.3, y: h * 0.9 }, legR: { x: w * 0.7, y: h * 0.9 } } };
  const top = midAt(0.07), bot = midAt(0.93);
  if (PL_CHILD[role]) return { j: top, t: null, a: { [PL_CHILD[role]]: bot } };
  return { j: top, t: bot, a: null };
}
async function plImportFiles(files, role) {
  const pm = progress('Đang tách bộ phận…'); let n = 0, first = null;
  try {
    for (const file of files) {
      let bmp; try { bmp = await createImageBitmap(file); } catch (e) { toast('Không đọc được ảnh ' + file.name); continue; }
      const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const src = makeCanvas(w, h), sx = src.getContext('2d'); sx.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
      const id = sx.getImageData(0, 0, w, h), d = id.data;
      if (![0, w - 1, (h - 1) * w, h * w - 1].some(i => d[i * 4 + 3] < 250)) rsCutPaper(id);
      const { blobs } = rsBlobs(id), total = blobs.reduce((m, q) => m + q.n, 0); if (!total) continue;
      sx.putImageData(id, 0, 0);
      const keep = blobs.filter(q => q.n >= Math.max(80, total * 0.01)).sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0]);
      for (const q of keep) {
        const [bx0, by0, bx1, by1] = q.b, c = makeCanvas(bx1 - bx0 + 3, by1 - by0 + 3);
        c.getContext('2d').drawImage(src, bx0 - 1, by0 - 1, c.width, c.height, 0, 0, c.width, c.height);
        const g = plGuess(c, role); pm.set(`Đang lưu bộ phận ${++n}…`);
        const pid = await plStore(c, { ...g, role, name: PL_ROLE_NAME[role] + ' ' + n }); if (!first) first = pid;
      }
    }
  } catch (e) { console.error(e); toast('Chưa lưu được (bộ nhớ máy đầy?)'); } finally { pm.close(); }
  if (n) toast(`Đã thêm ${n} bộ phận. Chấm hồng = khớp: bấm ✏ trên hình để chỉnh nếu lệch`, 4000);
  plStripSync(true); return first;
}
function plPickFiles(role) {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.addEventListener('change', async () => { const fs = [...inp.files]; res(fs.length ? await plImportFiles(fs, role) : null); });
    inp.click();
  });
}
/* --- ✏ item editor: drag the joint dots onto the right spots, name, kind, size --- */
async function plEdit(id) {
  const rec = await plLoad(id); if (!rec) return false;
  const G = plGroupOf(rec.role), ent = (await plList()).find(x => x.id === id) || {}, st = { vw: ent.vw || '', role: rec.role, j: { ...rec.j }, t: rec.t ? { ...rec.t } : null, a: rec.a ? JSON.parse(JSON.stringify(rec.a)) : null, s: rec.s || 1 };
  const dots = () => {
    const o = [{ k: 'j', p: st.j, col: '#ff3b9a', lab: st.role === 'head' ? 'Cổ' : st.role === 'torso' ? 'Xoay' : 'Khớp' }];
    if (st.t) o.push({ k: 't', p: st.t, col: '#2f7bff', lab: /^fore/.test(st.role) ? 'Tay' : 'Chân' });
    if (st.a) for (const r in st.a) o.push({ k: 'a:' + r, p: st.a[r], col: '#ffb21e', lab: { head: 'Cổ', armL: 'Vai T', armR: 'Vai P', legL: 'Hông T', legR: 'Hông P', foreL: 'Khuỷu', foreR: 'Khuỷu', shinL: 'Gối', shinR: 'Gối' }[r] || r });
    return o;
  };
  let name = rec.name;
  const v = await modal({ title: `✏ ${G.icon} ${G.name}: chỉnh khớp`, html: `<p style="margin-top:0">Kéo chấm vào đúng chỗ: <b style="color:#ff3b9a">hồng</b> = chỗ nối vào thân (cổ / vai / hông) hoặc điểm xoay, <b style="color:#ffb21e">vàng</b> = chỗ nối mảnh con, <b style="color:#2f7bff">xanh</b> = đầu ngón tay / mũi chân.</p>
<canvas id="plEdCv" style="width:100%;max-height:52vh;background:#fff repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:10px;touch-action:none;display:block"></canvas>
<div class="mrow" style="margin-top:8px">${G.roles.length > 1 ? G.roles.map(r => `<button class="chip small" data-plr="${r}">${PL_ROLE_NAME[r]}</button>`).join('') : ''}<span class="lbl">Cỡ khi ghép</span><button class="chip small" data-pls="-1">−</button><span class="lbl" id="plSz"></span><button class="chip small" data-pls="1">＋</button></div>
<div class="mrow"><span class="lbl">Góc nhìn</span>${Object.entries(PL_VIEWS).map(([k, v]) => `<button class="chip small" data-plv="${k}">${v}</button>`).join('')}</div>
<label class="lbl">Tên<br><input id="plEdName" maxlength="40" value="${escHtml(name)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"></label>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '✓ Lưu', primary: true, value: true, action: () => { name = $('#plEdName').value.trim() || name; } }],
    onOpen: ov => {
      const cv = ov.querySelector('#plEdCv'), c = rec.c, pad = 24, k = Math.min(1, 900 / Math.max(c.width, c.height));
      cv.width = Math.round(c.width * k + pad * 2); cv.height = Math.round(c.height * k + pad * 2);
      const toCv = p => ({ x: pad + p.x * k, y: pad + p.y * k }), fromEv = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * cv.width / r.width - pad) / k, y: ((e.clientY - r.top) * cv.height / r.height - pad) / k }; };
      const draw = () => {
        const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(c, pad, pad, c.width * k, c.height * k);
        const L = dots(), u = cv.width / Math.max(1, cv.getBoundingClientRect().width || cv.width);
        x.lineWidth = 3 * u; x.strokeStyle = 'rgba(255,59,154,.7)';
        for (const d of L) if (d.k !== 'j') { const a = toCv(st.j), b = toCv(d.p); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
        x.font = `bold ${13 * u}px system-ui`; x.textAlign = 'center';
        for (const d of L) { const p = toCv(d.p); x.beginPath(); x.arc(p.x, p.y, 9 * u, 0, Math.PI * 2); x.fillStyle = d.col; x.fill(); x.lineWidth = 2.5 * u; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#111'; x.fillText(d.lab, p.x, p.y - 13 * u); }
        ov.querySelector('#plSz').textContent = Math.round(st.s * 100) + '%';
        ov.querySelectorAll('[data-plr]').forEach(b => b.classList.toggle('on', b.dataset.plr === st.role));
        ov.querySelectorAll('[data-plv]').forEach(b => b.classList.toggle('on', b.dataset.plv === st.vw));
      };
      let drag = null;
      cv.addEventListener('pointerdown', e => {
        const p = fromEv(e), L = dots(), rr = 22 / k / Math.max(0.3, cv.getBoundingClientRect().width / cv.width);
        let best = null, bd = rr; for (const d of L) { const dd = Math.hypot(d.p.x - p.x, d.p.y - p.y); if (dd < bd) { bd = dd; best = d; } }
        if (best) { drag = best; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
      });
      cv.addEventListener('pointermove', e => { if (!drag) return; const p = fromEv(e); drag.p.x = clamp(p.x, -pad / k, c.width + pad / k); drag.p.y = clamp(p.y, -pad / k, c.height + pad / k); draw(); });
      const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      ov.querySelectorAll('[data-plr]').forEach(b => b.addEventListener('click', () => {
        const r = b.dataset.plr; if (r === st.role) return; st.role = r;
        if (PL_CHILD[r]) { st.a = { [PL_CHILD[r]]: st.t || (st.a && Object.values(st.a)[0]) || { x: c.width / 2, y: c.height * 0.93 } }; st.t = null; }
        else { st.t = (st.a && Object.values(st.a)[0]) || st.t || { x: c.width / 2, y: c.height * 0.93 }; st.a = null; }
        draw();
      }));
      ov.querySelectorAll('[data-plv]').forEach(b => b.addEventListener('click', () => { st.vw = b.dataset.plv; draw(); }));
      ov.querySelectorAll('[data-pls]').forEach(b => b.addEventListener('click', () => { st.s = clamp(Math.round((st.s + 0.05 * +b.dataset.pls) * 100) / 100, 0.3, 3); draw(); }));
      requestAnimationFrame(draw);
    } });
  if (!v) return false;
  await plUpdate(id, { role: st.role, j: st.j, t: st.t, a: st.a, s: st.s, name, vw: st.vw });
  plStripSync(true); return true;
}
// ↔ the same picture for the other side (an AI arm made once serves both arms)
async function plMirror(id) {
  const rec = await plLoad(id); if (!rec) return;
  const w = rec.c.width, c = makeCanvas(w, rec.c.height), x = c.getContext('2d'); x.translate(w, 0); x.scale(-1, 1); x.drawImage(rec.c, 0, 0);
  const fx = p => p && { x: w - p.x, y: p.y }, sw = r => r.replace(/[LR]$/, m => PL_SIDE[m]);
  const a = rec.a ? Object.fromEntries(Object.entries(rec.a).map(([r, p]) => [sw(r), fx(p)])) : null, role = sw(rec.role);
  await plStore(c, { role, j: fx(rec.j), t: fx(rec.t), a, s: rec.s, vw: ((await plList()).find(x => x.id === id) || {}).vw || '', name: rec.name.replace(/ \(lật\)$/, '') + ' (lật)' });
  PL.g = plGroupOf(role).g; toast(`Đã chép sang ${plGroupOf(role).name}`);
}
/* --- fitting an item onto a part of the character --- */
// how thick the picture is across the bone near the joint (stays the same whether the hand is a fist or open)
function plThick(c, j, dir) {
  const w = c.width, h = c.height, al = rsAlpha(c), L = Math.hypot(dir.x, dir.y); if (L < 4) return 0;
  const ux = dir.x / L, uy = dir.y / L, out = [];
  const on = (x, y) => { const X = Math.round(x), Y = Math.round(y); return X >= 0 && Y >= 0 && X < w && Y < h && al[Y * w + X] > 40; };
  for (const f of [0.18, 0.26, 0.34, 0.42]) {
    const cx = j.x + ux * L * f, cy = j.y + uy * L * f; if (!on(cx, cy)) continue;
    let a = 0, b = 0; while (a < L && on(cx - uy * a, cy + ux * a)) a++; while (b < L && on(cx + uy * b, cy - ux * b)) b++;
    out.push(a + b);
  }
  out.sort((p, q) => p - q); return out.length ? out[out.length >> 1] : 0;
}
function plWidth(c) { const w = c.width, h = c.height, al = rsAlpha(c); let x0 = w, x1 = -1; for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x++) if (al[y * w + x] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; } return Math.max(1, x1 - x0 + 1); }
// the matrix item pixels → the part's rest coordinates
function plFitMat(P, rec) {
  const kids = S.pp.parts.filter(k => k.parent === P.id && k.role), limb = !/^(head|torso)$/.test(P.role);
  const pairs = [];   // [item point, rest point]
  if (P.role !== 'torso') pairs.push([rec.j, { x: P.px, y: P.py }]);
  if (rec.a) for (const r in rec.a) { const k = kids.find(q => q.role === r); if (k) pairs.push([rec.a[r], { x: k.px, y: k.py }]); }
  if (pairs.length >= 2) {   // least squares: joints onto joints (limbs may turn, head / torso stay upright)
    const n = pairs.length, pm = { x: 0, y: 0 }, qm = { x: 0, y: 0 };
    for (const [p, q] of pairs) { pm.x += p.x / n; pm.y += p.y / n; qm.x += q.x / n; qm.y += q.y / n; }
    let a = 0, b = 0, d = 0; for (const [p, q] of pairs) { const px = p.x - pm.x, py = p.y - pm.y, qx = q.x - qm.x, qy = q.y - qm.y; a += px * qx + py * qy; b += px * qy - py * qx; d += px * px + py * py; }
    if (d > 4) {
      let ang = limb ? Math.atan2(b, a) : 0; const sc = clamp((limb ? Math.hypot(a, b) : a) / d, 0.2, 5); if (!limb) ang = 0;
      return mMul(mMul(mMul(mT(qm.x, qm.y), mR(ang)), mS(sc, sc)), mT(-pm.x, -pm.y));
    }
  }
  // one joint: turn along the bone (limbs), size from the thickness near the joint (limbs) or the width (head, torso)
  let ang = 0, sc = 1;
  const kid = kids.find(k => k.role === PL_CHILD[P.role]) || kids.find(k => k.role !== 'eyes' && k.role !== 'mouth');
  const tdir = P.tip ? { x: P.tip.x - P.px, y: P.tip.y - P.py } : kid ? { x: kid.px - P.px, y: kid.py - P.py } : null;
  const ie = rec.t || (rec.a && Object.values(rec.a)[0]), idir = ie ? { x: ie.x - rec.j.x, y: ie.y - rec.j.y } : null;
  if (limb && tdir && idir && Math.hypot(tdir.x, tdir.y) > 4 && Math.hypot(idir.x, idir.y) > 4) {
    ang = Math.atan2(tdir.y, tdir.x) - Math.atan2(idir.y, idir.x);
    const ti = plThick(P.c, { x: P.px - P.ox, y: P.py - P.oy }, tdir), ii = plThick(rec.c, rec.j, idir);
    sc = ti && ii ? ti / ii : Math.hypot(tdir.x, tdir.y) / Math.hypot(idir.x, idir.y);
  } else sc = plWidth(P.c) / plWidth(rec.c);
  sc = clamp(sc * (rec.s || 1), 0.2, 5);
  const anchor = P.role === 'torso' ? { x: P.ox + P.c.width / 2, y: P.oy + P.c.height / 2 } : { x: P.px, y: P.py };
  const from = P.role === 'torso' ? { x: rec.c.width / 2, y: rec.c.height / 2 } : rec.j;
  return mMul(mMul(mMul(mT(anchor.x, anchor.y), mR(ang)), mS(sc, sc)), mT(-from.x, -from.y));
}
// draw picture c through matrix A into a new canvas that just holds it → {c, x, y}
function plBake(c, A) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of rsCorners(A, c)) { x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y); x1 = Math.max(x1, k.x); y1 = Math.max(y1, k.y); }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const o = makeCanvas(Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))), x = o.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.setTransform(1, 0, 0, 1, -x0, -y0); x.transform(...A); x.drawImage(c, 0, 0);
  return { c: o, x: x0, y: y0 };
}
async function plMakeAlt(P, rec) {
  const A = plFitMat(P, rec), b = plBake(rec.c, A), alt = { c: b.c, dx: b.x - P.ox, dy: b.y - P.oy, lib: rec.id };
  if (rec.a) { const j = {}; for (const k of S.pp.parts.filter(q => q.parent === P.id && q.role && rec.a[q.role])) { const p = mApply(A, rec.a[k.role].x, rec.a[k.role].y), d = { x: p.x - k.px, y: p.y - k.py }; if (Math.hypot(d.x, d.y) > 0.5) j[k.role] = { x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10 }; } if (Object.keys(j).length) alt.j = j; }
  if (P.role === 'head' && PL.hideFace && S.pp.parts.some(q => q.parent === P.id && (q.role === 'eyes' || q.role === 'mouth'))) alt.hk = 1;
  await encodeHolder(alt); return alt;
}
// the piece of the selected character this item goes on (same kind; a fist for a character whose arm is one piece goes on the arm)
function plTarget(role) {
  const sel = S.pp && ppPart(ppSel); if (!sel) return null;
  const ch = ppCharOf(sel), mine = S.pp.parts.filter(q => ppCharOf(q) === ch);
  return mine.find(q => q.role === role) || mine.find(q => plGroupOf(q.role) === plGroupOf(role) && !mine.some(k => k.parent === q.id && plGroupOf(k.role) === plGroupOf(role))) || null;
}
// which frames: the frames ☑ picked, else this frame ('one'), this one and the keyframes after ('after') or every keyframe ('all')
function plFrames(scope, rid) {
  if (mselOn && msel.size) return [...msel].map(id => S.frames.findIndex(f => f.id === id)).filter(i => i >= 0);
  if (scope === 'one') return [S.cur];
  return S.frames.map((f, i) => i).filter(i => i === S.cur || ((scope === 'all' || i > S.cur) && ppLayerKey(S.frames[i], rid)));
}
// show library item `id` on the selected character's matching part, on the frames of `scope` (one undo step)
async function plApply(id, scope = 'one') {
  const rec = await plLoad(id); if (!rec) { toast('Không đọc được bộ phận này'); return false; }
  const P = plTarget(rec.role); if (!P) { toast(S.pp && ppPart(ppSel) ? `Nhân vật này chưa có mảnh ${PL_ROLE_NAME[rec.role]} — đặt vai trò cho mảnh ở tab 🧩 Mảnh & hình` : 'Chạm chọn nhân vật trước'); return false; }
  const rid = ppCharOf(P) || P.id, fr = plFrames(scope, rid);
  await ppSnapStep(async () => {
    let vi = (P.alts || []).findIndex(a => a.lib === id);
    if (vi < 0) { const alt = await plMakeAlt(P, rec); P.alts = [...(P.alts || []), alt]; vi = P.alts.length - 1; }
    for (const i of fr) { const f = S.frames[i]; ppQ(f, P.id).v = vi + 1; if (i === S.cur || (mselOn && msel.size)) ppMarkKey(f, P.id); markEdited(f); }
  });
  ppSel = P.id; ppSyncBar(); return true;
}
async function plBack(scope = 'one') {   // ↺ the part's own picture again
  const P = S.pp && ppPart(ppSel); if (!P) return;
  const fr = plFrames(scope, ppCharOf(P) || P.id);
  await ppSnapStep(() => { for (const i of fr) { const f = S.frames[i], q = f.pp && f.pp[P.id]; if (q && q.v) delete q.v; if (i === S.cur) ppMarkKey(f, P.id); markEdited(f); } });
}
/* --- quick strip (tab 🤸 Tạo dáng): the selected part's folder, one tap = this frame --- */
async function plStripSync(force) {
  const row = $('#plRow'); if (!row) return;
  const P = S.pp && ppPart(ppSel), G = P && plGroupOf(P.role), f = curFrame(), q = P && f.pp && f.pp[P.id];
  const cur = P && q && q.v && P.alts && P.alts[q.v - 1] ? P.alts[q.v - 1].lib : '';
  const key = [P ? P.id : '', G ? G.g : '', cur, PL.ver, mselOn && msel.size, PL.vw].join('|');
  if (!force && key === PL.stripKey) return; PL.stripKey = key;
  const el = $('#plStrip'); if (!el) return;
  row.hidden = !G;   // only for a head / torso / arm / leg (keeps the panel short on a tablet held upright)
  if (!G) { el.innerHTML = ''; return; }
  const L = (await plList()).filter(e => e.g === G.g && plVwOk(e)); if (PL.stripKey !== key) return;
  const vb = `<button class="chip small" data-plvw="1" title="Góc nhìn: chạm để đổi (Mọi góc / Thẳng / 3/4 / Nghiêng)">👁 ${PL_VIEWS[PL.vw]}</button>`;
  const wireVw = () => el.querySelector('[data-plvw]').addEventListener('click', () => { const ks = Object.keys(PL_VIEWS); PL.vw = ks[(ks.indexOf(PL.vw) + 1) % ks.length]; plStripSync(); });
  if (!L.length) { el.innerHTML = vb + `<span class="lbl">${G.icon} ${G.name}${PL.vw ? ' · ' + PL_VIEWS[PL.vw] : ''}: chưa có hình. Bấm 🧩 Kho bộ phận → ＋ Ảnh hoặc 💾 Lưu mảnh này</span>`; wireVw(); return; }
  el.innerHTML = vb + `<button class="chip small plIt${cur ? '' : ' on'}" data-plback="1" title="Hình gốc của mảnh">↺</button>` + L.map(e => `<button class="chip small plIt${e.id === cur ? ' on' : ''}" data-plid="${e.id}" title="${escHtml(e.name)}"><img alt="" src="${plUrl(e)}"></button>`).join('');
  el.querySelectorAll('[data-plid]').forEach(b => b.addEventListener('click', () => plApply(b.dataset.plid, 'one')));
  el.querySelector('[data-plback]').addEventListener('click', () => plBack('one')); wireVw();
}
/* --- the library dialog: a tab per folder --- */
async function plDialog(g) {
  if (ppSetup) { toast('Đang cắt nhân vật — xong bước cắt rồi mở kho'); return; }
  const selP = S.pp && ppPart(ppSel); PL.g = g || (selP && plGroupOf(selP.role) ? plGroupOf(selP.role).g : PL.g);
  let scope = 'one';
  await modal({ title: '🧩 Kho bộ phận', html: `<p style="margin-top:0">Mỗi loại 1 thư mục. Chạm 1 hình = gắn vào nhân vật đang chọn, đúng khớp (vẫn cử động, uốn mềm, rung, đi theo đường như cũ). <b>📍</b> = gắn lên thân bạn tự vẽ: chạm chỗ cổ / vai / gối trên khung. Kho dùng chung mọi dự án trên máy này.</p>
<div class="mrow" id="plTabs">${PL_GROUPS.map(G => `<button class="chip small" data-plg="${G.g}">${G.icon} ${G.name} <span class="plN" data-pln="${G.g}"></span></button>`).join('')}</div>
<div class="mrow" id="plVwRow"><span class="lbl" title="Nhân vật nhìn thẳng, 3/4 hay nghiêng: mỗi góc 1 bộ hình. Hình mới thêm / lưu nhận góc đang chọn"><b>Góc nhìn:</b></span>${plVwChips('plvf')}</div>
<div class="mrow"><span class="lbl">Đổi ở:</span><button class="chip small" data-plsc="one">Frame này</button><button class="chip small" data-plsc="after">Từ đây về sau</button><button class="chip small" data-plsc="all">Mọi frame</button><label class="lbl" title="Hình đầu từ AI đã có mặt: giấu mắt, miệng rời của nhân vật khi dùng hình này"><input type="checkbox" id="plHideFace"> Đầu mới: giấu mắt/miệng rời</label></div>
<div class="mrow"><button class="chip small on" id="plAdd">＋ Ảnh (tách từng bộ phận)</button><button class="chip small" id="plSaveOne">💾 Lưu mảnh đang chọn</button><button class="chip small" id="plSaveAll">💾 Lưu cả nhân vật (chia vào các thư mục)</button><button class="chip small on" id="plBuildBtn">🧍 Ghép nhân vật từ kho</button></div>
<div id="plGrid" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"></div>`, buttons: [{ label: 'Đóng', value: null }], onOpen: (ov, close) => {
    ov.querySelector('.dlg').classList.add('wide');
    const q = s => ov.querySelector(s), hideOv = v => { ov.style.display = v ? 'none' : ''; };
    const sync = () => {
      ov.querySelectorAll('[data-plg]').forEach(b => b.classList.toggle('on', b.dataset.plg === PL.g));
      ov.querySelectorAll('[data-plsc]').forEach(b => b.classList.toggle('on', b.dataset.plsc === scope));
      q('#plHideFace').checked = PL.hideFace; q('#plSaveOne').disabled = !plSel(); q('#plSaveAll').disabled = !(S.pp && ppPart(ppSel));
    };
    const show = async () => {
      sync(); const all = await plList(), G = PL_GROUPS.find(x => x.g === PL.g), el = q('#plGrid'), L = all.filter(e => e.g === PL.g && plVwOk(e));
      ov.querySelectorAll('[data-plvf]').forEach(b => b.classList.toggle('on', b.dataset.plvf === PL.vw));
      ov.querySelectorAll('[data-pln]').forEach(s => { const n = all.filter(e => e.g === s.dataset.pln && plVwOk(e)).length; s.textContent = n ? '(' + n + ')' : ''; });
      el.innerHTML = L.length ? '' : `<span class="lbl" style="font-size:14px">${G.icon} ${G.name}: chưa có hình. Bấm ＋ Ảnh để thêm ảnh AI (nền trắng, mỗi bộ phận rời nhau, vẽ đứng thẳng / buông xuôi), hoặc chọn 1 mảnh của nhân vật rồi 💾 Lưu.</span>`;
      for (const e of L) {
        const d = document.createElement('div'); d.className = 'pl-item'; d.dataset.id = e.id;
        d.style.cssText = 'display:flex;flex-direction:column;gap:4px;align-items:center;width:112px';
        d.innerHTML = `<button class="btn" data-a="use" title="Gắn vào nhân vật đang chọn" style="padding:4px;width:112px;height:112px;background:#fff;border-radius:10px"><img alt="" src="${plUrl(e)}" style="width:100%;height:100%;object-fit:contain"></button><div class="lbl" style="font-size:12px;text-align:center;word-break:break-word">${escHtml(e.name)}</div><div style="display:flex;gap:4px"><button class="btn" data-a="pin" title="📍 Gắn lên hình bạn tự vẽ: chạm vào chỗ cổ / vai / khuỷu / gối trên khung" style="min-width:36px;padding:6px">📍</button><button class="btn" data-a="ed" title="Chỉnh khớp, tên, cỡ" style="min-width:36px;padding:6px">✏</button><button class="btn" data-a="mir" title="Chép lật sang bên kia" style="min-width:36px;padding:6px">↔</button><button class="btn" data-a="del" title="Xoá khỏi kho" style="min-width:36px;padding:6px;color:var(--danger)">🗑</button></div>`;
        d.querySelector('[data-a=use]').addEventListener('click', async () => { if (!S.pp || !ppPart(ppSel)) { toast('Chạm chọn nhân vật trước (đóng kho, chạm nhân vật)'); return; } close(null); await plApply(e.id, scope); });
        d.querySelector('[data-a=pin]').addEventListener('click', () => { close(null); plPinBegin(e.id); });
        d.querySelector('[data-a=ed]').addEventListener('click', async () => { hideOv(1); await plEdit(e.id); hideOv(0); show(); });
        d.querySelector('[data-a=mir]').addEventListener('click', async () => { await plMirror(e.id); show(); });
        d.querySelector('[data-a=del]').addEventListener('click', async () => {
          hideOv(1); const ok = await modal({ title: `Xoá "${e.name}" khỏi kho?`, html: '<p>Frame đã dùng hình này vẫn giữ nguyên.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá', value: true, cls: 'danger' }] }); hideOv(0);
          if (ok) { await plRemove(e.id); show(); }
        });
        el.append(d);
      }
    };
    ov.querySelectorAll('[data-plg]').forEach(b => b.addEventListener('click', () => { PL.g = b.dataset.plg; show(); }));
    ov.querySelectorAll('[data-plvf]').forEach(b => b.addEventListener('click', () => { PL.vw = b.dataset.plvf; show(); plStripSync(); }));
    ov.querySelectorAll('[data-plsc]').forEach(b => b.addEventListener('click', () => { scope = b.dataset.plsc; sync(); }));
    q('#plHideFace').addEventListener('change', e => { PL.hideFace = e.target.checked; });
    q('#plAdd').addEventListener('click', async () => {
      const G = PL_GROUPS.find(x => x.g === PL.g); let role = G.roles[0];
      if (G.roles.length > 1) {
        hideOv(1);
        role = await modal({ title: `＋ ${G.icon} ${G.name}: ảnh này là phần nào?`, html: '<p>Mỗi hình rời trên ảnh thành 1 bộ phận. Vẽ buông xuôi (vai/hông ở trên) thì app tự đặt khớp đúng.</p>', buttons: [{ label: 'Huỷ', value: null }, ...G.roles.map(r => ({ label: PL_ROLE_NAME[r], value: r, primary: r === G.roles[0] }))] });
        hideOv(0); if (!role) return;
      }
      await plPickFiles(role); show();
    });
    q('#plSaveOne').addEventListener('click', async () => { hideOv(1); await plSavePart(); hideOv(0); show(); });
    q('#plSaveAll').addEventListener('click', async () => { await plSaveChar(); show(); });
    q('#plBuildBtn').addEventListener('click', async () => { close(null); await plBuildDialog(); });
    show();
  } });
}
/* --- 🧍 Ghép nhân vật từ kho: one item per part, put together on their joints --- */
const PL_BUILD = ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'];
const PL_PARENT = { head: 'torso', armL: 'torso', armR: 'torso', legL: 'torso', legR: 'torso', foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR' };
async function plBuildDialog() {
  if (ppSetup) return;
  const all = await plList(), pick = {};
  for (const r of PL_BUILD) { const e = all.find(x => x.role === r); pick[r] = e ? e.id : ''; }
  if (!pick.torso) { toast('Kho chưa có 👕 Thân — thêm ít nhất 1 hình thân trước'); return; }
  const v = await modal({ title: '🧍 Ghép nhân vật từ kho', html: `<p style="margin-top:0">Chọn 1 hình cho mỗi phần (bỏ trống = không có). Các mảnh tự gắn vào đúng khớp, thành nhân vật có xương. Sau đó chạm từng phần để đổi hình khác trong kho ở frame nào cũng được.</p><div id="plBuild"></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '✓ Ghép', primary: true, value: true }], onOpen: ov => {
      ov.querySelector('.dlg').classList.add('wide');
      const el = ov.querySelector('#plBuild');
      const draw = () => {
        el.innerHTML = PL_BUILD.map(r => { const L = all.filter(x => x.role === r), G = plGroupOf(r);
          return `<div class="mrow" style="flex-wrap:nowrap;overflow-x:auto"><span class="lbl" style="min-width:120px"><b>${G.icon} ${G.roles.length > 1 ? G.name + ' · ' : ''}${PL_ROLE_NAME[r]}</b></span>${r === 'torso' ? '' : `<button class="chip small${pick[r] ? '' : ' on'}" data-bp="${r}" data-id="">—</button>`}${L.map(e => `<button class="chip small plIt${pick[r] === e.id ? ' on' : ''}" data-bp="${r}" data-id="${e.id}" title="${escHtml(e.name)}"><img alt="" src="${plUrl(e)}"></button>`).join('') || '<span class="lbl">chưa có</span>'}</div>`; }).join('');
        el.querySelectorAll('[data-bp]').forEach(b => b.addEventListener('click', () => { pick[b.dataset.bp] = b.dataset.id; draw(); }));
      };
      draw();
    } });
  if (!v) return;
  await plBuild(pick);
}
async function plBuild(pick) {
  if (playing) stopPlay();
  const recs = {}; for (const r of PL_BUILD) if (pick[r]) { const rec = await plLoad(pick[r]); if (rec) recs[r] = rec; }
  if (!recs.torso) { toast('Cần 1 hình thân'); return null; }
  const g = 0.27 * H / recs.torso.c.height, made = {}, parts = [];
  const place = (r, at) => {   // item r with its joint (torso: middle) on point `at`
    const rec = recs[r], s = g * (rec.s || 1), from = r === 'torso' ? { x: rec.c.width / 2, y: rec.c.height / 2 } : rec.j;
    const A = mMul(mMul(mT(at.x, at.y), mS(s, s)), mT(-from.x, -from.y)), b = plBake(rec.c, A), w = p => mApply(A, p.x, p.y);
    const a = {}; if (rec.a) for (const k in rec.a) a[k] = w(rec.a[k]);
    const tip = rec.t ? w(rec.t) : PL_CHILD[r] && a[PL_CHILD[r]] ? a[PL_CHILD[r]] : null;
    const jp = w(rec.j);
    made[r] = { a, tip, box: b, A };
    parts.push({ id: newId(), name: PP_ROLES[r], role: r, parent: null, z: HC_Z[r] || 7, ox: b.x, oy: b.y, px: jp.x, py: jp.y, tip, c: b.c, alts: [], hard: 1, plr: r });
  };
  place('torso', { x: W / 2, y: H * 0.42 });
  const T = made.torso, tb = T.box;
  const guess = { head: { x: tb.x + tb.c.width / 2, y: tb.y }, armL: { x: tb.x + tb.c.width * 0.12, y: tb.y + tb.c.height * 0.12 }, armR: { x: tb.x + tb.c.width * 0.88, y: tb.y + tb.c.height * 0.12 }, legL: { x: tb.x + tb.c.width * 0.3, y: tb.y + tb.c.height * 0.92 }, legR: { x: tb.x + tb.c.width * 0.7, y: tb.y + tb.c.height * 0.92 } };
  for (const r of PL_BUILD.slice(1)) {
    if (!recs[r]) continue;
    let par = PL_PARENT[r]; if (!made[par]) par = 'torso';   // a hand with no upper arm hangs on the shoulder
    const at = made[par].a[r] || (par === 'torso' ? T.a[r] || T.a[PL_PARENT[r]] || guess[r] || guess[PL_PARENT[r]] : made[par].tip) || guess[PL_PARENT[r]] || guess[r];
    place(r, at); parts[parts.length - 1].parent = par;
  }
  const byR = {}; parts.forEach(p => byR[p.plr] = p);
  for (const p of parts) { p.parent = p.parent ? byR[p.parent].id : null; delete p.plr; }
  // stand on the ground: the lowest pixel near the bottom of the frame
  const low = Math.max(...parts.map(p => p.oy + p.c.height)), dy = Math.round(H * 0.95 - low);
  if (dy) for (const p of parts) { p.oy += dy; p.py += dy; if (p.tip) p.tip = { x: p.tip.x, y: p.tip.y + dy }; }
  for (const p of parts) await encodePart(p);
  const root = byR.torso, n = S.pp ? S.pp.parts.filter(q => !q.parent).length : 0;
  root.lname = 'Nhân vật kho' + (n ? ' ' + (n + 1) : '');
  ppPushChar(parts); ppSel = root.id; ppDrag = 'bone';
  ppShowAdded();
  toast('Đã ghép nhân vật — 🦴 kéo tay chân để tạo dáng, chạm 1 phần rồi chọn hình ở hàng 🧩 Đổi nhanh', 4500);
  await ppAskNew(root.id);
  return root.id;
}
$('#plOpen').addEventListener('click', () => plDialog());
$('#plOpen2').addEventListener('click', () => plDialog());
$('#plOpen0').addEventListener('click', () => plDialog());
$('#plSave').addEventListener('click', plSavePart);

/* --- 📍 Gắn lên hình vẽ tay: the torso is drawn by hand on each frame, only the hard parts (head, arms, lower legs) come from
   the library. Tap the neck / shoulder / knee on the drawing = the item's joint lands there. The pinned pieces hang on an
   invisible root ("Bộ phận gắn", pinr: 1): ⬚ Cả nhóm moves them together, 🦴 turns each round its joint, 🧩 Đổi nhanh swaps
   the picture per frame. Sizes: a standard height per kind (PL_STD × frame height) × the item's own size (✏ Cỡ). --- */
let plPin = null;
const PL_STD = { head: 0.15, torso: 0.27, armL: 0.13, armR: 0.13, foreL: 0.15, foreR: 0.15, legL: 0.14, legR: 0.14, shinL: 0.2, shinR: 0.2 };
function plPinBegin(id) {
  if (ppSetup) return;
  plPin = { id }; setTool('puppet'); ppCutMode = ppPathMode = false; ppPaint = null; ppSyncBar(); requestRender();
  plLoad(id).then(rec => { if (rec && plPin && plPin.id === id) toast(`📍 Chạm vào chỗ ${{ head: 'cổ', torso: 'giữa thân' }[rec.role] || (/^(arm|leg)/.test(rec.role) ? (/^arm/.test(rec.role) ? 'vai' : 'hông') : (/^fore/.test(rec.role) ? 'khuỷu tay' : 'đầu gối'))} trên hình bạn vẽ`, 4000); });
}
// the group of pinned pieces to add to: the selected character if it is one, else the newest one shown on this frame
function plPinRoot() {
  const sel = S.pp && ppPart(ppSel), r = sel && ppPart(ppCharOf(sel) || sel.id);
  if (r && r.pinr) return r;
  const f = curFrame(), rs = S.pp ? S.pp.parts.filter(p => p.pinr && !p.parent && !ppOffAt(f, p.id)) : [];
  return rs.length ? rs[rs.length - 1] : null;
}
async function plPinAt(pt) {
  const pin = plPin; plPin = null; if (!pin) return null;
  const rec = await plLoad(pin.id); if (!rec) { toast('Không đọc được bộ phận này'); return null; }
  let made = null;
  await ppSnapStep(async () => {
    let root = plPinRoot();
    // the drag box of the group follows its pieces; the root itself is an invisible dot at the first tap
    const local = root ? mApply(mInv(ppMats(ppPoseFor(curFrame()))[root.id]), pt.x, pt.y) : pt;
    const g = PL_STD[rec.role] * H / Math.max(1, rec.c.height) * (rec.s || 1);
    const A = mMul(mMul(mT(local.x, local.y), mS(g, g)), mT(-rec.j.x, -rec.j.y)), b = plBake(rec.c, A);
    const end = rec.t || (rec.a && Object.values(rec.a)[0]), tip = end ? mApply(A, end.x, end.y) : null;
    const part = { id: newId(), name: PP_ROLES[rec.role] + ' (kho)', role: rec.role, parent: null, z: HC_Z[rec.role] || 7, ox: b.x, oy: b.y, px: local.x, py: local.y, tip, c: b.c, alts: [], hard: 1 };
    await encodePart(part);
    if (!root) {
      const c = makeCanvas(1, 1); root = { id: newId(), name: 'Thân vẽ tay', role: '', parent: null, z: 0, ox: pt.x, oy: pt.y, px: pt.x, py: pt.y, tip: null, c, alts: [], hard: 1, pinr: 1, lname: 'Bộ phận gắn' };
      await encodePart(root); part.parent = root.id; ppPushChar([root, part]);
    } else {
      // a hand / lower leg tapped near the end of an upper arm / thigh of the group hangs on it, the rest on the root
      const mine = S.pp.parts.filter(q => ppCharOf(q) === root.id), up = { foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR' }[rec.role];
      const par = up && mine.find(q => q.role === up && q.tip && Math.hypot(q.tip.x - local.x, q.tip.y - local.y) < 0.05 * H);
      part.parent = par ? par.id : root.id;
      const old = mine.find(q => q.role === rec.role);
      if (old) {   // the same kind again: on THIS frame only, its joint goes to the tap and it shows this picture (other frames keep theirs)
        const f = curFrame(), pose = ppPoseFor(f), M = ppMats(pose), par = ppPart(old.parent), jo = (par && ppAltJoint(par, pose, old.role)) || { x: 0, y: 0 };
        const l = par ? mApply(mInv(M[par.id]), pt.x, pt.y) : pt, q = ppQ(f, old.id);
        q.dx = l.x - old.px - jo.x; q.dy = l.y - old.py - jo.y;
        let vi = (old.alts || []).findIndex(a => a.lib === rec.id);
        if (vi < 0) { const alt = await plMakeAlt(old, rec); old.alts = [...(old.alts || []), alt]; vi = old.alts.length - 1; }
        q.v = vi + 1; ppMarkKey(f, old.id); markEdited(f); made = old.id; ppSel = old.id; ppDrag = 'bone'; return;
      }
      const hz = q => HC_Z[q.role] || 7, kids = mine.filter(q => q !== root && q !== old), below = kids.filter(q => hz(q) <= hz(part));   // keep the head in front, lower legs behind
      part.z = below.length ? Math.max(...below.map(q => q.z)) + 0.5 : kids.length ? Math.min(...kids.map(q => q.z)) - 0.5 : root.z + 0.5;
      S.pp.parts.push(part); ppRenormZ();
    }
    made = part.id; ppSel = part.id; ppDrag = 'bone';
  });
  ppShowAdded();
  toast('Đã gắn — 🦴 kéo để xoay quanh khớp, ⬚ Cả nhóm để dời cả bộ. Frame khác: chạm mảnh rồi kéo Dời / 🧩 Đổi nhanh', 4500);
  return made;
}
