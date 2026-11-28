/* ===== 🌄 Nền dài: a background wider than the frame that pans slowly across the frames (walking, driving), with parallax layers =====
   S.panos = [{id, name, w, layers: [{id, name, k, png}]}]: w = width in doc px (height = H), layers back → front. k = how fast the layer
   moves (1 Gần, 0.5 Giữa, 0.2 Xa, 0 Đứng yên = trời). Pano and layer objects are never changed in place: an edit makes new objects
   (a new layer id when the pixels changed), so the automatic undo (histSnap: S.panos) keeps the old ones. Only the PNG is kept on a
   layer; its canvas lives in PN_CV (by layer id) and is decoded again when needed (panoCv / panoReady).
   f.pan = {id, x, lp}: the frame shows the pano with its left edge at x (layer offset = x·k), lp = 🔁 loop (the picture wraps round).
   Drawn under the frame's own Nền layer (which stays drawable: a sign that stays put). f.pan is in H_FKEYS, the 3 save places, lookCopy.
   🌄 dialog (Nền ▾, tab 🌈 Hiệu ứng) sets x on frames a…b by time (panoApply): 🎯 Vừa hết nền or a speed + 🔁 Lặp.
   Editor #pnWrap (looks like 🦴 Xưởng, same CSS): bút / tẩy / đổ màu / hút màu, layers, width, ảnh vào lớp, ▶ Xem thử parallax,
   its own undo (pixel patches + layer-list snapshots; canvases shared with PN_CV are copied before the first change). ===== */
const PN_CV = new Map(), PN_LOADING = new Map();
const PN_KS = [[0, '⏸ Đứng yên'], [0.2, '🏔 Xa'], [0.5, '🌳 Giữa'], [1, '🏠 Gần']];
const PN_SPEEDS = [[0.15, '🐢 Chậm'], [0.3, '🚶 Vừa'], [0.6, '🏃 Nhanh']];   // frame widths per second
const PN_UNDO = 60, PN_UNDO_BYTES = 160e6;
const panoMaxW = () => Math.max(W * 2, Math.min(W * 8, Math.floor(16e6 / H)));   // iPad canvas area limit
SETTINGS_KEYS.push('panoOpt'); S.panoOpt = { dir: 1, sp: 'fit', lp: false };
S.panos = [];
const panoById = id => (S.panos || []).find(p => p.id === id) || null;
const panoOf = f => f && f.pan ? panoById(f.pan.id) : null;
const panoKOf = L => L.k == null ? 1 : L.k;
// the canvas of a layer; not decoded yet → starts decoding (screen + thumbnails refresh when done) and returns null
function panoCv(L) {
  const c = PN_CV.get(L.id); if (c) return c;
  if (L.png && !PN_LOADING.has(L.id)) {
    PN_LOADING.set(L.id, (async () => {
      try { const b = await decodePng(L.png); const cv = makeCanvas(b.width, b.height); cv.getContext('2d').drawImage(b, 0, 0); if (b.close) b.close(); PN_CV.set(L.id, cv); }
      catch (e) { console.error(e); }
      finally { PN_LOADING.delete(L.id); }
      panoRefresh(null, true);
    })());
  }
  return null;
}
async function panoReady() { for (const P of S.panos || []) for (const L of P.layers) panoCv(L); await Promise.all([...PN_LOADING.values()]); }
// canvases no pano uses any more are freed (undo decodes them again from the PNG kept on the old layer object)
function panoGc() { const ids = new Set(); for (const P of S.panos || []) for (const L of P.layers) ids.add(L.id); for (const [id, c] of PN_CV) if (!ids.has(id)) { if (!PE || !PE.layers.some(l => l.c === c)) c.width = 0; PN_CV.delete(id); } }
// frames showing pano `id` (null = any) are redrawn: thumbnail, play cache, screen
function panoRefresh(id, quiet) {
  for (const f of S.frames) if (f.pan && (!id || f.pan.id === id)) { f.playKey = ''; queueThumbFor(f); }
  requestRender(); if (!quiet) lookSync();
}
const panoKey = f => { const P = panoOf(f); return P ? 'n' + f.pan.x + (f.pan.lp ? 'l' : '') + P.w + P.layers.map(l => l.id + '.' + panoKOf(l) + (PN_CV.has(l.id) ? '' : '?')).join(',') : ''; };
// draws frame f's view of its pano (w × h = size of the target, default W × H)
function drawPano(ctx, f, w, h) {
  const P = panoOf(f); if (!P) return;
  const sx = (w || W) / W, sy = (h || H) / H, pw = P.w;
  for (const L of P.layers) {
    const c = panoCv(L); if (!c || !c.width) continue;
    let ox = f.pan.x * panoKOf(L);
    if (f.pan.lp) {
      ox = ((ox % pw) + pw) % pw; const a = Math.min(W, pw - ox);
      ctx.drawImage(c, ox, 0, a, H, 0, 0, a * sx + (a < W ? 0.5 : 0), H * sy);
      if (a < W) ctx.drawImage(c, 0, 0, W - a, H, a * sx, 0, (W - a) * sx, H * sy);
    } else { ox = clamp(ox, 0, Math.max(0, pw - W)); ctx.drawImage(c, ox, 0, Math.min(W, pw), H, 0, 0, Math.min(W, pw) * sx, H * sy); }
  }
}
// the whole pano (all layers, no parallax) into a small canvas: list thumbnails, editor layer buttons
function panoThumb(P, th, onlyL) {
  const k = th / H, c = makeCanvas(Math.max(1, Math.round(P.w * k)), th), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  for (const L of onlyL ? [onlyL] : P.layers) { const cv = L.c || panoCv(L); if (cv && cv.width) x.drawImage(cv, 0, 0, c.width, c.height); }
  return c;
}
/* --- put the pano on frames a…b: x follows time, so a long frame moves the picture further --- */
function panoApply(id, a, b, o) {
  const P = panoById(id); if (!P) return 0;
  const span = Math.max(0, P.w - W), dir = o.dir < 0 ? -1 : 1, fit = o.sp === 'fit', v = fit ? 0 : +o.sp || 0.3, lp = !fit && !!o.lp;
  let T = 0; for (let i = a; i < b; i++) T += S.frames[i].dur;
  let x0 = dir > 0 ? 0 : span;
  const g = S.frames[a - 1];   // speed mode right after frames with the same pano: carry on from where they stopped
  if (!fit && g && g.pan && g.pan.id === id) x0 = g.pan.x + dir * v * W * g.dur / 1000;
  let t = 0, end = -1;
  for (let i = a; i <= b; i++) {
    const f = S.frames[i];
    let x = fit ? (T ? (dir > 0 ? span * t / T : span * (1 - t / T)) : x0) : x0 + dir * v * W * t / 1000;
    if (!lp) { if (end < 0 && i > a && (x <= 0 || x >= span) && !fit) end = i; x = clamp(x, 0, span); }
    f.pan = { id, x: Math.round(x * 10) / 10 }; if (lp) f.pan.lp = 1;
    t += f.dur;
  }
  scheduleSave(); panoRefresh(id);
  return end;
}
function panoClearFrames(a, b) { for (let i = a; i <= b; i++) delete S.frames[i].pan; scheduleSave(); panoRefresh(null); }
function panoRange() {
  const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : [];
  if (sel.length) return [sel[0], sel[sel.length - 1]];
  let b = S.cur; while (b + 1 < S.frames.length && !S.frames[b + 1].scene) b++;   // to the end of this scene
  return [S.cur, b];
}
/* --- 🌄 dialog: pick a pano, frames, direction, speed, loop --- */
async function panoDialog(selId) {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  if (!S.panos.length) {
    const v = await modal({ title: '🌄 Nền dài chạy dần', html: `<p>Nền dài = nền <b>rộng hơn khung</b> (vd. cả con phố, cả sân bóng). Qua các frame, khung nhìn trượt dần trên nền: nhân vật đi tại chỗ mà như đang đi qua phố.</p>
<p class="lbl">Có thể có nhiều lớp: núi xa chạy chậm, cây giữa chạy vừa, nhà gần chạy nhanh (parallax) cho cảnh có chiều sâu.</p>`,
      buttons: [{ label: 'Huỷ', value: null }, { label: '🖼 Từ ảnh ngang', value: 'img' }, { label: '✎ Vẽ nền dài', value: 'draw', primary: true }] });
    if (v === 'draw') panoEdit(null); else if (v === 'img') panoPickImage(null);
    return;
  }
  const O = { ...S.panoOpt }; let sel = panoById(selId) ? selId : (panoOf(curFrame()) || S.panos[S.panos.length - 1]).id;
  let [a, b] = panoRange();
  const chips = (key, list) => list.map(([v, l]) => `<button class="chip small" data-pn${key}="${v}">${l}</button>`).join('');
  const html = `<div class="lbl" style="margin-bottom:4px">Chọn nền dài:</div><div id="pnList" style="display:flex;flex-direction:column;gap:6px;max-height:34vh;overflow:auto"></div>
<div class="set-row" style="flex-wrap:wrap;gap:6px"><button class="chip small" id="pnEditB">✎ Sửa / vẽ thêm</button><button class="chip small" id="pnNewB">＋ Vẽ nền mới</button><button class="chip small" id="pnImgB">🖼 Từ ảnh</button><button class="chip small" id="pnDelB" style="color:var(--danger)">🗑 Xoá nền này</button></div>
<div class="set-row" style="flex-wrap:wrap;gap:6px"><span>Frame</span><input type="number" id="pnA" min="1" style="width:60px"> <span>tới</span> <input type="number" id="pnB" min="1" style="width:60px"></div>
<div class="set-row" style="flex-wrap:wrap;gap:6px"><span>Nhân vật đi</span>${chips('d', [[1, '▶ Sang phải'], [-1, '◀ Sang trái']])}</div>
<div class="set-row" style="flex-wrap:wrap;gap:6px"><span>Tốc độ</span>${chips('s', [['fit', '🎯 Vừa hết nền'], ...PN_SPEEDS])}</div>
<label class="set-row" id="pnLpRow"><span>🔁 Lặp lại: hết nền thì nối lại từ đầu (đi mãi không hết)</span><input type="checkbox" id="pnLp"></label>
<p class="lbl" id="pnInfo" style="color:#ffb21e"></p>`;
  let act = null;
  const v = await modal({ title: '🌄 Nền dài chạy dần', html,
    buttons: [{ label: 'Đóng', value: null }, { label: '🚫 Bỏ ở các frame này', value: 'off' }, { label: '✓ Áp cho các frame này', value: 'go', primary: true }],
    onOpen: (ov, close) => {
      const q = s => ov.querySelector(s), inA = q('#pnA'), inB = q('#pnB'), n = S.frames.length;
      inA.max = inB.max = n; inA.value = a + 1; inB.value = b + 1;
      [inA, inB].forEach(el => { el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('input', () => { a = clamp((+inA.value || 1) - 1, 0, n - 1); b = clamp((+inB.value || 1) - 1, 0, n - 1); sync(); }); });
      const list = q('#pnList');
      const build = () => {
        list.innerHTML = '';
        for (const P of S.panos) {
          const r = document.createElement('button'); r.className = 'chip'; r.dataset.pnid = P.id;
          r.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:flex-start;min-height:56px;padding:4px 8px';
          const t = panoThumb(P, 48); t.style.cssText = 'height:48px;max-width:220px;border-radius:6px;object-fit:cover';
          const used = S.frames.filter(f => f.pan && f.pan.id === P.id).length, s = document.createElement('span');
          s.textContent = `${P.name} · dài ${(P.w / W).toFixed(1)} khung · ${P.layers.length} lớp${used ? ` · ${used} frame` : ''}`;
          r.append(t, s); r.addEventListener('click', () => { sel = P.id; sync(); }); list.append(r);
        }
      };
      const sync = () => {
        list.querySelectorAll('[data-pnid]').forEach(x => x.classList.toggle('on', x.dataset.pnid === sel));
        ov.querySelectorAll('[data-pnd]').forEach(x => x.classList.toggle('on', +x.dataset.pnd === O.dir));
        ov.querySelectorAll('[data-pns]').forEach(x => x.classList.toggle('on', String(x.dataset.pns) === String(O.sp)));
        q('#pnLp').checked = !!O.lp; q('#pnLpRow').style.opacity = O.sp === 'fit' ? 0.45 : 1; q('#pnLp').disabled = O.sp === 'fit';
        const P = panoById(sel), lo = Math.min(a, b), hi = Math.max(a, b); let T = 0; for (let i = lo; i <= hi; i++) T += S.frames[i].dur;
        const go = P ? (P.w - W) / W : 0, secs = O.sp === 'fit' ? 0 : go / (+O.sp || 0.3);
        q('#pnInfo').textContent = !P ? '' : O.sp === 'fit' ? `${hi - lo + 1} frame (${(T / 1000).toFixed(1)} giây): đi từ ${O.dir > 0 ? 'đầu trái' : 'đầu phải'} tới hết nền.`
          : `${hi - lo + 1} frame (${(T / 1000).toFixed(1)} giây). Đi hết nền mất ${secs.toFixed(1)} giây${O.lp ? ', rồi lặp lại.' : T / 1000 > secs + 0.05 ? ': hết nền thì nền đứng yên (bật 🔁 Lặp lại để đi tiếp).' : '.'}`;
      };
      ov.querySelectorAll('[data-pnd]').forEach(x => x.addEventListener('click', () => { O.dir = +x.dataset.pnd; sync(); }));
      ov.querySelectorAll('[data-pns]').forEach(x => x.addEventListener('click', () => { O.sp = x.dataset.pns === 'fit' ? 'fit' : +x.dataset.pns; sync(); }));
      q('#pnLp').addEventListener('change', e => { O.lp = e.target.checked; sync(); });
      q('#pnEditB').addEventListener('click', () => { act = 'edit'; close(null); });
      q('#pnNewB').addEventListener('click', () => { act = 'new'; close(null); });
      q('#pnImgB').addEventListener('click', () => { act = 'img'; close(null); });
      q('#pnDelB').addEventListener('click', () => { act = 'del'; close(null); });
      build(); sync();
    } });
  S.panoOpt = O; saveSettings();
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (act === 'edit') return panoEdit(panoById(sel));
  if (act === 'new') return panoEdit(null);
  if (act === 'img') return panoPickImage(null);
  if (act === 'del') {
    const P = panoById(sel); if (!P) return;
    const ok = await modal({ title: '🗑 Xoá nền dài?', html: `<p>Xoá "${escHtml(P.name)}" khỏi dự án (các frame đang dùng sẽ không còn nền này). Bấm ↶ để lấy lại.</p>`, buttons: [{ label: 'Huỷ', value: null }, { label: 'Xoá', value: 1, cls: 'danger' }] });
    if (!ok) return;
    S.frames.forEach(f => { if (f.pan && f.pan.id === P.id) delete f.pan; }); S.panos = S.panos.filter(p => p !== P); panoGc(); scheduleSave(); panoRefresh(null);
    toast('Đã xoá nền dài (↶ để lấy lại)'); return;
  }
  if (v === 'off') { panoClearFrames(lo, hi); toast(`Đã bỏ nền dài ở frame ${lo + 1}–${hi + 1}`); return; }
  if (v !== 'go') return;
  if (O.sp === 'fit' && hi === lo) { toast('🎯 Vừa hết nền cần ít nhất 2 frame. Thêm frame (vd. ＋ 1 giây ở 🗂 Dòng layer, hoặc 🚶 Đi) rồi bấm lại', 4500); return; }
  const end = panoApply(sel, lo, hi, O);
  toast(`🌄 Nền dài chạy ở frame ${lo + 1}–${hi + 1}${end > 0 ? ` (hết nền ở frame ${end + 1})` : ''}. Bấm ▶ để xem`, 4000);
}
// 🖼 Từ ảnh: a wide picture becomes a new pano (or a layer of the one being edited)
function panoPickImage(into) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    try { const bmp = await createImageBitmap(file); if (into) panoAddImage(bmp, file.name); else await panoEdit(null, bmp); if (bmp.close) bmp.close(); }
    catch (e) { console.error(e); toast('Không mở được ảnh: ' + e.message, 3000); }
  });
  inp.click();
}

/* ===== editor ===== */
let PE = null;
let pnUid = 0;
const pnLayer = (name, k, c, lid) => ({ uid: ++pnUid, lid: lid || null, name, k, c });
const pnSel = () => PE.layers[PE.sel] || null;
async function panoEdit(P, img) {
  if (PE) return;
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating(); histFlush();
  if (P) await panoReady();
  PE = { src: P || null, name: P ? P.name : 'Nền dài ' + (S.panos.length + 1), w: P ? P.w : W * 3, layers: [], sel: 0, tool: 'brush', size: 24, white: true,
    undo: [], redo: [], ub: 0, vw: null, prev: false, act: null, pens: false, dirty: false };
  if (P) PE.layers = P.layers.map(L => pnLayer(L.name, panoKOf(L), panoCv(L) || makeCanvas(P.w, H), L.id));
  if (img) {
    const k = H / img.height, iw = Math.round(img.width * k), w = clamp(Math.max(iw, Math.round(W * 1.5)), W, panoMaxW());
    PE.w = w; const c = makeCanvas(w, H); c.getContext('2d').drawImage(img, 0, 0, Math.min(iw, w), H);
    PE.layers.push(pnLayer('Lớp 1', 1, c));
    if (iw < W * 1.4) toast('Ảnh này hẹp — nền dài đẹp nhất là ảnh ngang rất dài (vd. 3 lần bề ngang khung). Vẫn vẽ thêm được', 4500);
    if (iw > w) toast('Ảnh quá dài nên đã cắt bớt bên phải (máy tablet giới hạn cỡ ảnh)', 4000);
  }
  if (!PE.layers.length) PE.layers.push(pnLayer('Lớp 1', 1, makeCanvas(PE.w, H)));
  PE.sel = PE.layers.length - 1;
  pnBuild(); pnSync(); pnFit(); pnDraw();
  if (!P && !img) toast('Vẽ cả con phố / cả sân lên nền dài này. Kéo bằng 2 ngón (hoặc ✋) để xem phần bên phải', 5000);
}
async function pnClose(done) {
  if (!PE) return;
  if (!done && PE.dirty) {
    const v = await modal({ title: 'Đóng nền dài?', html: '<p>Bỏ các thay đổi vừa vẽ?</p>', buttons: [{ label: 'Ở lại', value: null }, { label: 'Bỏ thay đổi', value: 1, cls: 'danger' }] });
    if (!v || !PE) return;
  }
  cancelAnimationFrame(PE.prevF); document.removeEventListener('keydown', pnKey, true); if (PE.ro) PE.ro.disconnect();
  PE.el.remove(); PE = null; panoGc(); requestRender();
}
async function pnFinish() {
  if (!PE) return;
  const pm = progress('Đang lưu nền dài…');
  try {
    const old = PE.src, layers = [];
    for (const l of PE.layers) {
      const same = old && l.lid && PN_CV.get(l.lid) === l.c && l.c.width === PE.w;
      if (same) { layers.push({ ...old.layers.find(L => L.id === l.lid), name: l.name, k: l.k }); continue; }
      const id = newId(), png = await (await toBlob(l.c)).arrayBuffer(); PN_CV.set(id, l.c); layers.push({ id, name: l.name, k: l.k, png });
    }
    const P = { id: old ? old.id : newId(), name: PE.name, w: PE.w, layers };
    S.panos = old ? S.panos.map(p => p === old ? P : p) : [...S.panos, P];
    pm.close(); await pnClose(true); scheduleSave(); histFlush(); panoRefresh(P.id);   // its own undo step, before the apply dialog
    if (!old) panoDialog(P.id); else toast('Đã lưu nền dài (↶ để quay lại bản cũ)', 2500);
  } catch (e) { pm.close(); console.error(e); toast('Không lưu được: ' + e.message, 4000); }
}
/* --- editor undo: {px: uid, x, y, before, after} pixel patches, {ls: layers list} snapshots (canvases are replaced, never changed) --- */
const pnSnapL = () => ({ ls: PE.layers.map(l => ({ ...l })), w: PE.w, sel: PE.sel });
function pnPush(e) {
  e.bytes = e.px ? e.before.data.length + e.after.data.length : 2000;
  PE.undo.push(e); PE.ub += e.bytes; PE.redo.length = 0; PE.dirty = true;
  while (PE.undo.length > 1 && (PE.undo.length > PN_UNDO || PE.ub > PN_UNDO_BYTES)) PE.ub -= PE.undo.shift().bytes;
}
function pnApplyE(e, key) {
  if (e.px) { const l = PE.layers.find(q => q.uid === e.px); if (l) l.c.getContext('2d').putImageData(e[key], e.x, e.y); return null; }
  const cur = pnSnapL(); PE.layers = e.ls.map(l => ({ ...l })); PE.w = e.w; PE.sel = clamp(e.sel, 0, PE.layers.length - 1); return { ...e, ls: cur.ls, w: cur.w, sel: cur.sel };
}
function pnHist(from, to, key) {
  const e = from.pop(); if (!e) { toast(key === 'before' ? 'Không còn gì để hoàn tác' : 'Không còn gì để làm lại'); return; }
  const back = pnApplyE(e, key); to.push(back || e); PE.dirty = true; pnSync(); pnDraw();
}
const pnUndo = () => pnHist(PE.undo, PE.redo, 'before'), pnRedo = () => pnHist(PE.redo, PE.undo, 'after');
// a layer canvas still shared with the saved pano is copied before its first change
function pnOwn(l) { if (l.lid && PN_CV.get(l.lid) === l.c) { const c = makeCanvas(l.c.width, l.c.height); c.getContext('2d').drawImage(l.c, 0, 0); l.c = c; } return l.c; }
/* --- UI --- */
const PN_TOOLS = [['brush', '🖌 Bút'], ['erase', '⌫ Tẩy'], ['fill', '🪣 Đổ màu'], ['pick', '💧 Hút màu'], ['hand', '✋ Kéo xem']];
function pnBuild() {
  const el = document.createElement('div'); el.id = 'pnWrap';
  el.innerHTML = `<div class="rs-top"><b class="rs-title">🌄 Nền dài</b>
  <span class="rs-modes">${PN_TOOLS.map(([k, l]) => `<button class="chip" data-pnt="${k}">${l}</button>`).join('')}</span>
  <span class="rs-gap"></span>
  <button class="chip" id="pnUndo" title="Hoàn tác (trong nền dài)">↶</button><button class="chip" id="pnRedo" title="Làm lại">↷</button>
  <button class="chip" id="pnPrev" title="Xem thử khung hình trượt trên nền (các lớp chạy nhanh chậm khác nhau)">▶ Xem thử</button>
  <button class="chip on" id="pnDone">✓ Xong</button><button class="chip" id="pnX" title="Đóng, không lưu">✕</button></div>
<div class="rs-main"><canvas id="pnCv"></canvas><div class="rs-zoom"><button class="chip" data-pnz="-1">−</button><button class="chip" data-pnz="0">⛶</button><button class="chip" data-pnz="1">＋</button></div></div>
<div class="rs-side"><div class="rs-hint" id="pnHint"></div><div class="rs-tools" id="pnTools"></div><div class="rs-props" id="pnProps"></div><div class="rs-strip" id="pnStrip"></div></div>`;
  document.body.append(el); PE.el = el; PE.cv = el.querySelector('#pnCv');
  el.querySelectorAll('[data-pnt]').forEach(b => b.addEventListener('click', () => { PE.tool = b.dataset.pnt; pnSync(); }));
  el.querySelector('#pnUndo').addEventListener('click', pnUndo); el.querySelector('#pnRedo').addEventListener('click', pnRedo);
  el.querySelector('#pnPrev').addEventListener('click', pnPreview);
  el.querySelector('#pnDone').addEventListener('click', pnFinish); el.querySelector('#pnX').addEventListener('click', () => pnClose(false));
  el.querySelectorAll('[data-pnz]').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.pnz; if (!k) pnFit(); else pnZoomAt(k > 0 ? 1.25 : 0.8); pnDraw(); }));
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (f) { const b = await createImageBitmap(f); panoAddImage(b, f.name); if (b.close) b.close(); } });
  const cv = PE.cv;
  cv.addEventListener('pointerdown', pnDown); cv.addEventListener('pointermove', pnMove);
  cv.addEventListener('pointerup', pnUp); cv.addEventListener('pointercancel', pnUp);
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2 && !e.shiftKey) pnZoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR); else PE.vw[4] -= (e.deltaX || e.deltaY) * DPR; pnDraw(); }, { passive: false });
  PE.ro = new ResizeObserver(() => { const r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR)); if (w === cv.width && h === cv.height) return; cv.width = w; cv.height = h; if (!PE.zoomed) pnFit(); pnDraw(); });
  PE.ro.observe(cv);
  document.addEventListener('keydown', pnKey, true);
}
function pnKey(e) {
  if (!PE || document.querySelector('.ov') || typingIn(e)) return;
  const k = e.key.toLowerCase(); e.stopPropagation();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? pnRedo() : pnUndo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); pnRedo(); }
  else if (k === 'escape') { e.preventDefault(); if (PE.prev) pnPreview(); else pnClose(false); }
}
const PN_HINT = { brush: 'Vẽ lên lớp đang chọn. 2 ngón = phóng to / kéo xem, chạm 2 ngón = hoàn tác. Đường đứt = chỗ nối từng khung.', erase: 'Tẩy trên lớp đang chọn (lớp trước tẩy đi thì thấy lớp sau).', fill: 'Chạm vào 1 vùng để đổ màu (vùng trống cũng đổ được, vd. cả bầu trời).', pick: 'Chạm để lấy màu.', hand: 'Kéo để xem chỗ khác trên nền dài.' };
function pnSync() {
  if (!PE || !PE.el) return; const el = PE.el, L = pnSel();
  el.querySelectorAll('[data-pnt]').forEach(b => b.classList.toggle('on', b.dataset.pnt === PE.tool && !PE.prev));
  el.querySelector('#pnUndo').disabled = !PE.undo.length; el.querySelector('#pnRedo').disabled = !PE.redo.length;
  el.querySelector('#pnPrev').classList.toggle('on', PE.prev); el.querySelector('#pnPrev').textContent = PE.prev ? '⏹ Thôi xem' : '▶ Xem thử';
  el.querySelector('#pnHint').textContent = PE.prev ? 'Đang xem thử: khung 9:16 trượt qua nền, lớp xa chạy chậm, lớp gần chạy nhanh.' : PN_HINT[PE.tool];
  const fav = favList().slice(0, 14).map(c => `<button class="chip small" data-pnc="${c}" style="background:${c};min-width:34px" title="${c}"></button>`).join('');
  el.querySelector('#pnTools').innerHTML = `<label class="lbl rs-col">Màu <input type="color" id="pnCol" value="${/^#[0-9a-f]{6}$/i.test(S.color) ? S.color : '#000000'}"></label>${fav}
    <label class="lbl">Cỡ <input type="range" id="pnSize" min="2" max="240" value="${PE.size}"></label><span class="lbl" id="pnSzL">${PE.size}</span>`;
  const t = el.querySelector('#pnTools');
  t.querySelector('#pnCol').addEventListener('input', e => { setColor(e.target.value); });
  t.querySelectorAll('[data-pnc]').forEach(b => b.addEventListener('click', () => { setColor(b.dataset.pnc); if (PE.tool !== 'fill') PE.tool = 'brush'; pnSync(); }));
  t.querySelector('#pnSize').addEventListener('input', e => { PE.size = +e.target.value; t.querySelector('#pnSzL').textContent = PE.size; });
  const pr = el.querySelector('#pnProps'), mw = panoMaxW();
  const ws = [1.5, 2, 3, 4, 5, 6, 8].filter(k => W * k <= mw);
  pr.innerHTML = `<div class="rs-row"><b class="rs-name">${escHtml(PE.name)}</b><button class="chip small" data-pnb="name">✎ Tên</button></div>
<div class="rs-row"><span class="lbl">Dài</span>${ws.map(k => `<button class="chip small${Math.abs(PE.w - W * k) < 2 ? ' on' : ''}" data-pnw="${k}">${String(k).replace('.', ',')} khung</button>`).join('')}</div>
${L ? `<div class="rs-row"><span class="lbl">Lớp <b>${escHtml(L.name)}</b> chạy</span>${PN_KS.map(([k, l]) => `<button class="chip small${Math.abs(L.k - k) < 1e-6 ? ' on' : ''}" data-pnk="${k}">${l}</button>`).join('')}</div>
<div class="rs-row"><button class="chip" data-pnb="up" title="Lên trước">⏫</button><button class="chip" data-pnb="down" title="Ra sau">⏬</button><button class="chip" data-pnb="lname">✎ Tên lớp</button><button class="chip" data-pnb="del" style="color:var(--danger)">🗑 Lớp</button></div>` : ''}
<div class="rs-row"><button class="chip" data-pnb="add" title="Thêm lớp trong suốt ở trước (vd. cây, nhà gần)">＋ Lớp mới</button><button class="chip" data-pnb="img" title="Đặt ảnh vào lớp đang chọn, cao bằng khung">🖼 Ảnh vào lớp này</button>
<label class="lbl"><input type="checkbox" id="pnWhite" ${PE.white ? 'checked' : ''}> bỏ giấy trắng</label></div>`;
  pr.querySelectorAll('[data-pnb]').forEach(b => b.addEventListener('click', () => pnBtn(b.dataset.pnb)));
  pr.querySelectorAll('[data-pnw]').forEach(b => b.addEventListener('click', () => pnSetW(Math.round(W * +b.dataset.pnw))));
  pr.querySelectorAll('[data-pnk]').forEach(b => b.addEventListener('click', () => { pnPush(pnSnapL()); pnSel().k = +b.dataset.pnk; PE.layers[PE.sel] = { ...pnSel() }; pnSync(); }));
  pr.querySelector('#pnWhite').addEventListener('change', e => { PE.white = e.target.checked; });
  const st = el.querySelector('#pnStrip'); st.innerHTML = '';
  [...PE.layers].map((l, i) => [l, i]).reverse().forEach(([l, i]) => {
    const b = document.createElement('button'); b.className = 'rs-pc' + (i === PE.sel ? ' on' : ''); b.style.width = '120px';
    const c = panoThumb({ w: PE.w, layers: [] }, 40, l); c.style.cssText = 'width:110px;height:40px;object-fit:cover'; b.append(c);
    const s = document.createElement('span'); s.textContent = `${l.name} · ${(PN_KS.find(q => Math.abs(q[0] - l.k) < 1e-6) || [0, l.k + '×'])[1]}`; s.style.maxWidth = '112px'; b.append(s);
    b.addEventListener('click', () => { PE.sel = i; pnSync(); pnDraw(); }); st.append(b);
  });
}
async function pnAskName(title, v0) {
  let v = null;
  await modal({ title, html: `<input id="pnNm" maxlength="40" value="${escHtml(v0)}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px">`,
    onOpen: ov => ov.querySelector('#pnNm').addEventListener('keydown', e => e.stopPropagation()),
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { v = $('#pnNm').value.trim(); } }] });
  return v ? v.slice(0, 40) : null;
}
async function pnBtn(k) {
  if (!PE) return; const L = pnSel();
  if (k === 'name') { const v = await pnAskName('Tên nền dài', PE.name); if (v && PE) { PE.name = v; PE.dirty = true; pnSync(); } return; }
  if (k === 'lname' && L) { const v = await pnAskName('Tên lớp', L.name); if (v && PE) { pnPush(pnSnapL()); PE.layers[PE.sel] = { ...L, name: v }; pnSync(); } return; }
  if (k === 'add') {
    if (PE.layers.length >= 5) { toast('Tối đa 5 lớp (để máy không hết bộ nhớ)'); return; }
    pnPush(pnSnapL()); const n = PE.layers.length + 1; PE.layers.push(pnLayer('Lớp ' + n, 1, makeCanvas(PE.w, H))); PE.sel = PE.layers.length - 1;
    // the layers behind move slower: give the back ones a parallax speed if they were all 1
    if (PE.layers.length === 2 && PE.layers[0].k === 1) PE.layers[0] = { ...PE.layers[0], k: 0.5 };
    pnSync(); pnDraw(); toast('Lớp mới trong suốt ở trước. Lớp sau đã chạy chậm hơn (🌳 Giữa) cho có chiều sâu, đổi được ở hàng "chạy"', 4000); return;
  }
  if (k === 'img') { panoPickImage(true); return; }
  if (!L) return;
  if (k === 'up' || k === 'down') { const j = PE.sel + (k === 'up' ? 1 : -1); if (j < 0 || j >= PE.layers.length) return; pnPush(pnSnapL()); const a = PE.layers; [a[PE.sel], a[j]] = [a[j], a[PE.sel]]; PE.sel = j; pnSync(); pnDraw(); return; }
  if (k === 'del') { if (PE.layers.length < 2) { toast('Nền dài cần ít nhất 1 lớp'); return; } pnPush(pnSnapL()); PE.layers.splice(PE.sel, 1); PE.sel = clamp(PE.sel - 1, 0, PE.layers.length - 1); pnSync(); pnDraw(); toast('Đã bỏ lớp (↶ để lấy lại)'); }
}
// width: longer = picture kept on the left, room added on the right; shorter = cut on the right
function pnSetW(w) {
  if (!PE || w === PE.w) return;
  pnPush(pnSnapL());
  PE.layers = PE.layers.map(l => { const c = makeCanvas(w, H); c.getContext('2d').drawImage(l.c, 0, 0); return { ...l, c }; });
  PE.w = w; pnSync(); if (!PE.zoomed) pnFit(); pnDraw();
}
function panoAddImage(img, name) {
  if (!PE) return; const L = pnSel(); if (!L) return;
  const k = H / img.height, iw = Math.round(img.width * k), x0 = PE.layers.indexOf(L) > 0 || pnHasInk(L.c) ? Math.max(0, Math.round(-PE.vw[4] / PE.vw[0])) : 0;
  pnPush(pnSnapL());
  let w = PE.w; if (x0 + iw > w) w = Math.min(panoMaxW(), x0 + iw);
  const src = makeCanvas(iw, H), sx = src.getContext('2d'); sx.drawImage(img, 0, 0, iw, H);
  if (PE.white) { const id = sx.getImageData(0, 0, iw, H); rsCutPaper(id); sx.putImageData(id, 0, 0); }
  PE.layers = PE.layers.map(l => { const c = makeCanvas(w, H), x = c.getContext('2d'); x.drawImage(l.c, 0, 0); if (l === L) x.drawImage(src, x0, 0); return { ...l, c }; });
  PE.w = w; src.width = 0; pnSync(); pnDraw();
  toast(`Đã đặt ảnh${name ? ' ' + name : ''} vào ${L.name}`, 2500);
}
function pnHasInk(c) { const s = makeCanvas(64, 16), x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 64, 16); const d = x.getImageData(0, 0, 64, 16).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true; return false; }
/* --- view --- */
function pnFit() {
  const cv = PE.cv, w = cv.width || 1, h = cv.height || 1, k = Math.min(h / H * 0.9, (w - 32 * DPR) / (PE.w + W * 0.7));   // the whole pano + the loop join
  PE.zoomed = false; PE.vw = [k, 0, 0, k, 16 * DPR, (h - H * k) / 2];
}
function pnZoomAt(f, cx, cy) {
  const v = PE.vw, cv = PE.cv; cx = cx == null ? cv.width / 2 : cx; cy = cy == null ? cv.height / 2 : cy;
  PE.zoomed = true; const k = clamp(v[0] * f, 0.03, 30), g = k / v[0]; PE.vw = [k, 0, 0, k, cx - (cx - v[4]) * g, cy - (cy - v[5]) * g];
}
const pnDoc = e => { const r = PE.cv.getBoundingClientRect(), x = (e.clientX - r.left) * DPR, y = (e.clientY - r.top) * DPR; return { ...mApply(mInv(PE.vw), x, y), sx: x, sy: y, p: e.pressure || 0.5 }; };
function pnDraw() {
  if (!PE || !PE.cv.width) return;
  const cv = PE.cv, x = cv.getContext('2d'), V = PE.vw, px = DPR / V[0], w = PE.w;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#2a2b31'; x.fillRect(0, 0, cv.width, cv.height);
  if (PE.prev) { pnDrawPrev(x); return; }
  x.setTransform(...V); x.fillStyle = '#fff'; x.fillRect(0, 0, w, H);
  for (const l of PE.layers) x.drawImage(l.c, 0, 0);
  // where the picture joins its start again when 🔁 Lặp lại is on: a faded copy of the left end after the right end
  x.save(); x.globalAlpha = 0.3; x.fillStyle = '#fff'; x.fillRect(w, 0, W * 0.6, H); for (const l of PE.layers) x.drawImage(l.c, 0, 0, W * 0.6, H, w, 0, W * 0.6, H); x.restore();
  x.lineWidth = 2 * px; x.setLineDash([10 * px, 8 * px]); x.strokeStyle = 'rgba(47,123,255,.75)';
  for (let k = W; k < w; k += W) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); }
  x.setLineDash([]); x.strokeStyle = '#ff3b9a'; x.lineWidth = 3 * px; x.strokeRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2 * px; x.strokeRect(0, 0, w, H);
  x.fillStyle = '#ff3b9a'; x.font = `bold ${15 * px}px system-ui`; x.textBaseline = 'top'; x.fillText('Khung đầu', 8 * px, 8 * px);
  x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText('↻ đầu nền (khi lặp)', w + 8 * px, 8 * px);
  x.setTransform(1, 0, 0, 1, 0, 0);
}
/* --- ▶ Xem thử: the 9:16 window slides back and forth, layers at their own speed --- */
function pnPreview() {
  if (!PE) return; PE.prev = !PE.prev; cancelAnimationFrame(PE.prevF);
  if (PE.prev) { PE.t0 = performance.now(); const tick = () => { if (!PE || !PE.prev) return; pnDraw(); PE.prevF = requestAnimationFrame(tick); }; tick(); }
  pnSync(); pnDraw();
}
function pnDrawPrev(x) {
  const cv = PE.cv, span = Math.max(1, PE.w - W), dur = span / W / 0.3, t = (performance.now() - PE.t0) / 1000, u = (t % (dur * 2)) / dur, ox = (u <= 1 ? u : 2 - u) * span;
  const k = Math.min(cv.height * 0.94 / H, cv.width * 0.94 / W), x0 = (cv.width - W * k) / 2, y0 = (cv.height - H * k) / 2;
  x.save(); x.translate(x0, y0); x.scale(k, k); x.beginPath(); x.rect(0, 0, W, H); x.clip(); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  for (const l of PE.layers) { const o = clamp(ox * l.k, 0, span); x.drawImage(l.c, o, 0, W, H, 0, 0, W, H); }
  x.restore();
}
/* --- pointer: pen / finger = tool, 2 fingers = zoom + pan (quick 2-finger tap = undo), touch while a pen is used = pan --- */
function pnDown(e) {
  if (!PE) return; const cv = PE.cv; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* a pointer that is already gone */ }
  PE.pts = PE.pts || new Map(); PE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.pointerType === 'pen') PE.pens = true;
  if (PE.pts.size >= 2) {
    if (PE.act && PE.act.k === 'paint') pnPaintCancel(PE.act);
    const [p1, p2] = [...PE.pts.values()];
    PE.act = { k: 'pinch', d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, m0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, v0: PE.vw.slice(), t0: performance.now(), moved: 0 };
    return;
  }
  const pt = pnDoc(e), L = pnSel();
  const out = pt.x < 0 || pt.x > PE.w || pt.y < 0 || pt.y > H;
  if (PE.prev || PE.tool === 'hand' || (e.pointerType === 'touch' && PE.pens) || !L || out) {
    PE.act = { k: 'pan', s0: { x: e.clientX, y: e.clientY }, v0: PE.vw.slice() }; return;
  }
  if (PE.tool === 'pick') { pnPick(pt); return; }
  if (PE.tool === 'fill') { pnFill(L, pt); return; }
  pnPaintStart(L, pt);
}
function pnMove(e) {
  if (!PE || !PE.pts || !PE.pts.has(e.pointerId)) return;
  PE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const a = PE.act; if (!a) return;
  if (a.k === 'pinch') {
    if (PE.pts.size < 2) return; const [p1, p2] = [...PE.pts.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y), m = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    a.moved = Math.max(a.moved, Math.abs(d - a.d0), Math.hypot(m.x - a.m0.x, m.y - a.m0.y));
    const r = PE.cv.getBoundingClientRect(), k = clamp(a.v0[0] * d / a.d0, 0.03, 30), g = k / a.v0[0], cx = (a.m0.x - r.left) * DPR, cy = (a.m0.y - r.top) * DPR;
    PE.zoomed = true; PE.vw = [k, 0, 0, k, cx - (cx - a.v0[4]) * g + (m.x - a.m0.x) * DPR, cy - (cy - a.v0[5]) * g + (m.y - a.m0.y) * DPR]; pnDraw(); return;
  }
  if (a.k === 'pan') { PE.zoomed = true; PE.vw = [a.v0[0], 0, 0, a.v0[3], a.v0[4] + (e.clientX - a.s0.x) * DPR, a.v0[5] + (e.clientY - a.s0.y) * DPR]; pnDraw(); return; }
  if (a.k === 'paint') { const pt = pnDoc(e); a.eng.add({ x: pt.x, y: pt.y, p: pt.p }, performance.now()); pnCompose(a); pnDraw(); }
}
function pnUp(e) {
  if (!PE || !PE.pts) return; PE.pts.delete(e.pointerId);
  const a = PE.act; if (!a) return;
  if (a.k === 'pinch') { if (PE.pts.size) return; PE.act = null; if (performance.now() - a.t0 < 300 && a.moved < 12) pnUndo(); return; }
  if (PE.pts.size) return;
  PE.act = null;
  if (a.k === 'paint') pnPaintEnd(a);
}
/* --- painting: ink on its own canvas, laid over a copy of the layer in the changed rectangle only --- */
function pnPaintStart(L, pt) {
  const c = pnOwn(L), w = c.width, erase = PE.tool === 'erase', B = brushOf(erase ? 'eraser' : 'brush');
  if (!PE.ink || PE.ink.width !== w) { PE.ink = makeCanvas(w, H); PE.bc = makeCanvas(w, H); }
  const ix = PE.ink.getContext('2d'); ix.setTransform(1, 0, 0, 1, 0, 0); ix.globalAlpha = 1; ix.globalCompositeOperation = 'source-over'; ix.clearRect(0, 0, w, H);
  const bx = PE.bc.getContext('2d'); bx.globalCompositeOperation = 'copy'; bx.drawImage(c, 0, 0); bx.globalCompositeOperation = 'source-over';
  const R = [Infinity, Infinity, -Infinity, -Infinity];
  const dirty = (x, y, r) => { R[0] = Math.min(R[0], x - r); R[1] = Math.min(R[1], y - r); R[2] = Math.max(R[2], x + r); R[3] = Math.max(R[3], y + r); };
  const eng = makeBrushEngine(ix, { brush: B, color: S.color, size: PE.size, pressure: S.pressure, flowK: B.kind === 'dab' && !erase ? Math.max(1, ppPaintOp(false, { kind: 'line' }) / (B.op0 || 1)) : 1, smooth: S.smooth, erase, dirty });
  PE.act = { k: 'paint', L, c, eng, R, erase, op: ppPaintOp(erase, B), done: [0, 0, 0, 0] };
  eng.add({ x: pt.x, y: pt.y, p: pt.p }, performance.now()); pnCompose(PE.act); pnDraw();
  if (!erase) addRecentColor(S.color);
}
function pnRect(R, w) { const x0 = clamp(Math.floor(R[0]) - 2, 0, w), y0 = clamp(Math.floor(R[1]) - 2, 0, H), x1 = clamp(Math.ceil(R[2]) + 2, 0, w), y1 = clamp(Math.ceil(R[3]) + 2, 0, H); return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null; }
function pnCompose(a) {
  const r = pnRect(a.R, a.c.width); if (!r) return; const x = a.c.getContext('2d');
  x.save(); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.beginPath(); x.rect(...r); x.clip(); x.drawImage(PE.bc, 0, 0);
  x.globalCompositeOperation = a.erase ? 'destination-out' : 'source-over'; x.globalAlpha = a.op; x.drawImage(PE.ink, 0, 0); x.restore();
}
function pnPaintEnd(a) {
  a.eng.end(); pnCompose(a);
  const r = pnRect(a.R, a.c.width); if (!r) return;
  const before = PE.bc.getContext('2d').getImageData(...r), after = a.c.getContext('2d').getImageData(...r);
  pnPush({ px: a.L.uid, x: r[0], y: r[1], before, after }); pnSync(); pnDraw();
}
function pnPaintCancel(a) { const r = pnRect(a.R, a.c.width); if (r) { const x = a.c.getContext('2d'); x.save(); x.globalCompositeOperation = 'copy'; x.beginPath(); x.rect(...r); x.clip(); x.drawImage(PE.bc, 0, 0); x.restore(); } PE.act = null; pnDraw(); }
function pnPick(pt) {
  const X = Math.floor(pt.x), Y = Math.floor(pt.y); if (X < 0 || Y < 0 || X >= PE.w || Y >= H) return;
  for (const l of [...PE.layers].reverse()) {
    const d = l.c.getContext('2d').getImageData(X, Y, 1, 1).data;
    if (d[3] > 20) { setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')); PE.tool = 'brush'; pnSync(); toast('Đã lấy màu', 1200); return; }
  }
  setColor('#ffffff'); PE.tool = 'brush'; pnSync(); toast('Chỗ này trống: lấy màu trắng', 1500);
}
// flood fill on the layer (empty areas too, e.g. the whole sky); a new canvas → one undo step
function pnFill(L, pt) {
  const c = L.c, w = c.width, X = Math.floor(pt.x), Y = Math.floor(pt.y); if (X < 0 || Y < 0 || X >= w || Y >= H) return;
  const id = c.getContext('2d').getImageData(0, 0, w, H), d = id.data, i0 = (Y * w + X) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3], hole = a0 < 40;
  const same = k => hole ? d[k * 4 + 3] < 40 : d[k * 4 + 3] >= 40 && Math.abs(d[k * 4] - r0) <= 48 && Math.abs(d[k * 4 + 1] - g0) <= 48 && Math.abs(d[k * 4 + 2] - b0) <= 48;
  const m = new Uint8Array(w * H), st = [Y * w + X]; m[st[0]] = 1;
  while (st.length) {
    const j = st.pop(), xx = j % w;
    if (xx > 0 && !m[j - 1] && same(j - 1)) { m[j - 1] = 1; st.push(j - 1); }
    if (xx < w - 1 && !m[j + 1] && same(j + 1)) { m[j + 1] = 1; st.push(j + 1); }
    if (j >= w && !m[j - w] && same(j - w)) { m[j - w] = 1; st.push(j - w); }
    if (j < w * H - w && !m[j + w] && same(j + w)) { m[j + w] = 1; st.push(j + w); }
  }
  const [R, G, Bc] = hexToRgb(S.color);
  for (let j = 0; j < w * H; j++) {
    if (m[j]) { d[j * 4] = R; d[j * 4 + 1] = G; d[j * 4 + 2] = Bc; d[j * 4 + 3] = 255; continue; }
    // the soft edge of a line next to the filled area is laid over the new colour, so no light ring stays
    if (d[j * 4 + 3] < 255 && ((j % w > 0 && m[j - 1]) || (j % w < w - 1 && m[j + 1]) || (j >= w && m[j - w]) || (j < w * H - w && m[j + w]))) {
      const s = d[j * 4 + 3] / 255; d[j * 4] = d[j * 4] * s + R * (1 - s); d[j * 4 + 1] = d[j * 4 + 1] * s + G * (1 - s); d[j * 4 + 2] = d[j * 4 + 2] * s + Bc * (1 - s); d[j * 4 + 3] = 255;
    }
  }
  pnPush(pnSnapL());
  const o = makeCanvas(w, H); o.getContext('2d').putImageData(id, 0, 0); PE.layers[PE.sel] = { ...L, c: o };
  addRecentColor(S.color); pnSync(); pnDraw();
}
