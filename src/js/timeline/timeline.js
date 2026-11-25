/* ========= Timeline UI ========= */
const strip = $('#strip');
const BG_COLORS = ['#ffb21e', '#4cd964', '#2f7bff', '#ff3b5c', '#b36bff', '#00c7be'];
function buildStrip() {
  strip.innerHTML = '';
  const bgOrder = [];
  S.frames.forEach(f => { if (!bgOrder.includes(f.bgId)) bgOrder.push(f.bgId); });
  S.frames.forEach((f, i) => {
    if (!f.thumb) { drawThumb(f); }
    const el = document.createElement('div'); el.className = 'fr' + (i === S.cur ? ' on' : '');
    el.append(f.thumb);
    const idx = document.createElement('span'); idx.className = 'idx'; idx.textContent = i + 1;
    const dur = document.createElement('span'); dur.className = 'dur'; dur.textContent = fmtDur(f.dur);
    const sh = document.createElement('span'); sh.className = 'shared'; sh.style.background = BG_COLORS[bgOrder.indexOf(f.bgId) % BG_COLORS.length]; sh.title = 'Màu chấm = nhóm nền';
    const wv = document.createElement('canvas'); wv.className = 'wave'; wv.hidden = true;
    el.append(wv, idx, dur, sh);
    if (f.scene && i > 0) { el.classList.add('scst'); const sb = document.createElement('span'); sb.className = 'scb'; sb.textContent = '🎬 ' + f.scene; sb.title = 'Đầu cảnh — Menu → 🎬 Cảnh để dời/nhân bản'; el.append(sb); }
    if (S.pp) { const kk = document.createElement('span'); kk.className = 'key' + (ppIsKey(f) ? '' : ' auto'); kk.textContent = ppIsKey(f) ? '🔑' : '∿'; el.append(kk); }
    el.classList.toggle('msel', !!(msel && msel.has(f.id)));
    el.addEventListener('click', e => { if (el._lp) { el._lp = false; return; } if (playing) stopPlay(); if (mselOn || e.shiftKey || e.ctrlKey || e.metaKey) { mselTap(i, e.shiftKey); return; } selectFrame(i); });
    el.addEventListener('pointerdown', e => frPointerDown(e, el, f));
    el.addEventListener('contextmenu', e => e.preventDefault());
    strip.append(el); f.el = el;
  });
  camBadges(); trBadges();
  const add = document.createElement('button'); add.className = 'addfr'; add.textContent = '+';
  add.style.width = Math.max(Math.round(96 * W / H * (S.tlScale || 1)), 44) + 'px';
  add.title = 'Nhân bản frame hiện tại'; add.addEventListener('click', dupFrame);
  strip.append(add);
  waveKey = ''; updateFrameUI(); if (msel && (mselOn || msel.size)) mselSync();
}
/* ===== drag frames to reorder: hold a frame (or press and drag with a mouse), then drag it left/right.
   Holding without moving still starts multi-select like before. If the held frame is one of several selected frames, all of them move together. */
let frDrag = null;
function frPointerDown(e, el, f) {
  if (e.button > 0 || frDrag) return;
  clearTimeout(el._lpT);
  const x0 = e.clientX, y0 = e.clientY, mouse = e.pointerType === 'mouse', pid = e.pointerId;
  const st = { el, f, x0, y0, armed: mouse, held: false, active: false, pid };
  frDrag = st;
  el._lpT = setTimeout(() => { if (frDrag !== st) return; st.armed = true; st.held = true; el.classList.add('lift'); try { navigator.vibrate && navigator.vibrate(15); } catch (_) { } }, 480);
  const move = ev => {
    if (ev.pointerId !== pid) return;
    const d = Math.hypot(ev.clientX - x0, ev.clientY - y0);
    if (!st.armed) { if (d > 10) end(ev, true); return; }
    if (!st.active && d > (mouse ? 8 : 6)) frDragStart(st);
    if (st.active) { ev.preventDefault(); frDragMove(st, ev.clientX, ev.clientY); }
  };
  const end = (ev, quiet) => {
    if (ev && ev.pointerId !== pid) return;
    clearTimeout(el._lpT); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel);
    el.classList.remove('lift'); if (frDrag === st) frDrag = null;
    if (quiet) return;
    if (st.active) { el._lp = true; frDragDrop(st); }
    else if (st.held) { el._lp = true; mselLong(S.frames.indexOf(f)); }
  };
  const cancel = ev => { if (st.active) frDragCleanup(st); end(ev, true); };
  window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel);
}
// while a frame is held, stop the strip from scrolling under the finger
strip.addEventListener('touchmove', e => { if (frDrag && frDrag.armed && e.cancelable) e.preventDefault(); }, { passive: false });
function frDragStart(st) {
  if (playing) stopPlay(); commitFloating();
  st.active = true;
  st.moving = msel && msel.size > 1 && msel.has(st.f.id) ? S.frames.filter(g => msel.has(g.id)) : [st.f];
  const ghost = document.createElement('div'); ghost.className = 'frghost';
  const src = st.f.thumb, gc = document.createElement('canvas'); gc.width = src.width; gc.height = src.height; gc.getContext('2d').drawImage(src, 0, 0);
  const r = st.el.getBoundingClientRect(); gc.style.width = r.width + 'px'; gc.style.height = r.height + 'px'; ghost.append(gc);
  if (st.moving.length > 1) { const b = document.createElement('span'); b.className = 'cnt'; b.textContent = st.moving.length; ghost.append(b); }
  document.body.append(ghost); st.ghost = ghost; st.gw = r.width; st.gh = r.height;
  const mk = document.createElement('div'); mk.className = 'frdrop'; document.body.append(mk); st.mark = mk;
  st.moving.forEach(g => g.el && g.el.classList.add('dragging'));
  st.scrollB = strip.style.scrollBehavior; strip.style.scrollBehavior = 'auto';
  const tick = () => { if (!st.active) return; const sr = strip.getBoundingClientRect(), edge = 48; let v = 0;
    if (st.cx < sr.left + edge) v = -Math.ceil((sr.left + edge - st.cx) / 4); else if (st.cx > sr.right - edge) v = Math.ceil((st.cx - sr.right + edge) / 4);
    if (v) { strip.scrollLeft += v; frDragMove(st, st.cx, st.cy); } st.raf = requestAnimationFrame(tick); };
  st.raf = requestAnimationFrame(tick);
}
function frDragMove(st, x, y) {
  st.cx = x; st.cy = y;
  st.ghost.style.left = (x - st.gw / 2) + 'px'; st.ghost.style.top = (y - st.gh * 0.75) + 'px';
  // insertion point = before the first frame whose middle is right of the finger
  let k = S.frames.length;
  for (let i = 0; i < S.frames.length; i++) { const e2 = S.frames[i].el; if (!e2) continue; const r = e2.getBoundingClientRect(); if (x < r.left + r.width / 2) { k = i; break; } }
  st.at = k;
  const sr = strip.getBoundingClientRect(), ref = S.frames[Math.min(k, S.frames.length - 1)].el.getBoundingClientRect();
  const mx = k < S.frames.length ? ref.left - 5 : ref.right + 3;
  st.mark.style.left = clamp(mx, sr.left, sr.right - 4) + 'px'; st.mark.style.top = ref.top + 'px'; st.mark.style.height = ref.height + 'px';
}
function frDragCleanup(st) {
  st.active = false; cancelAnimationFrame(st.raf);
  if (st.ghost) st.ghost.remove(); if (st.mark) st.mark.remove();
  (st.moving || []).forEach(g => g.el && g.el.classList.remove('dragging'));
  strip.style.scrollBehavior = st.scrollB || '';
}
// move `moving` frames so they sit together just before position `at` (0..n) of the current list; undo = one step
function moveFramesTo(moving, at) {
  const set = new Set(moving), before = S.frames.map(g => g.id), cur = curFrame();
  const left = S.frames.slice(0, at).filter(g => !set.has(g)), right = S.frames.slice(at).filter(g => !set.has(g));
  const order = [...left, ...moving, ...right];
  if (order.every((g, i) => g === S.frames[i])) return false;
  S.frames = order;
  pushEntry({ ford: { before, after: S.frames.map(g => g.id) }, bytes: 0 });
  S.cur = Math.max(0, S.frames.indexOf(moving.includes(cur) ? cur : moving[0]));
  tintCache.clear(); ppRetween(); buildStrip(); selectFrame(S.cur); scheduleSave(); updUndoBtns();
  return true;
}
function frDragDrop(st) {
  const at = st.at == null ? S.frames.indexOf(st.f) : st.at, moving = st.moving;
  frDragCleanup(st);
  const from = S.frames.indexOf(moving[0]) + 1;
  if (moveFramesTo(moving, at)) toast(moving.length > 1 ? `Đã dời ${moving.length} frame tới vị trí ${S.frames.indexOf(moving[0]) + 1} — hoàn tác để trả lại` : `Đã dời frame ${from} → ${S.frames.indexOf(moving[0]) + 1}`, 2200);
}
function fmtDur(ms) { const s = ms / 1000; return (s >= 1 ? s.toFixed(s % 1 ? 1 : 0) : s.toFixed(2).replace(/0$/, '')) + 's'; }
function updateFrameUI() {
  const f = curFrame(); if (!f) return;
  S.frames.forEach((g, i) => { if (g.el) { g.el.classList.toggle('on', i === S.cur); g.el.querySelector('.dur').textContent = fmtDur(g.dur); const kk = g.el.querySelector('.key'); if (kk) { kk.className = 'key' + (ppIsKey(g) ? '' : ' auto'); kk.textContent = ppIsKey(g) ? '🔑' : '∿'; } } });
  if (document.activeElement !== $('#durIn')) $('#durIn').value = (f.dur / 1000).toFixed(2);
  document.querySelectorAll('#durChips .chip').forEach(ch => ch.classList.toggle('on', Math.abs(+ch.dataset.s * 1000 - f.dur) < 1));
  const total = S.frames.reduce((a, g) => a + g.dur, 0);
  $('#totalLbl').textContent = `${S.frames.length} frame · ${(total / 1000).toFixed(1)}s`;
  if (typeof ppScopeSync === 'function') ppScopeSync();   // 🔗 Sửa cả nhóm row: only with 2+ frames
  $('#dockTlLbl').textContent = `Frame ${S.cur + 1}/${S.frames.length}`;
  if (!flipPeek) { $('#fnLbl').textContent = `${S.cur + 1}/${S.frames.length}`; $('#fnPrev').disabled = S.cur === 0; $('#fnNext').disabled = S.cur === S.frames.length - 1; }
  const shared = S.frames.filter(g => g.bgId === f.bgId).length;
  $('#bgInfo').textContent = shared > 1 ? `Nền dùng chung ${shared} frame` : 'Nền riêng';
  updateWaves(); scrubDraw(); expSync(); lgSync();
  $('#moveL').disabled = S.cur === 0; $('#moveR').disabled = S.cur === S.frames.length - 1;
  const el = f.el; if (el) { const r = el.getBoundingClientRect(), sr = strip.getBoundingClientRect(); if (r.left < sr.left || r.right > sr.right) strip.scrollLeft += r.left - sr.left - sr.width / 2 + r.width / 2; }
}
async function selectFrame(i) {
  if (i < 0 || i >= S.frames.length) return;
  if (stroke) strokeEnd();
  commitFloating();
  motionClose(); rigClose(); S.cur = i; vsel.clear(); updVecBar();
  const f = curFrame();
  await ensureLoaded(f); const fb = bgOf(f); if (fb) await ensureLoaded(fb);
  [S.frames[i - 1], S.frames[i + 1]].forEach(n => { if (!n) return; ensureLoaded(n).then(requestRender); const nb = bgOf(n); if (nb) ensureLoaded(nb); });
  updateFrameUI(); ppSyncBar(); fxSel = null; fxSyncBar(); bgVideoSync(); requestRender();
}
async function addFrame() {
  if (playing) stopPlay(); commitFloating();
  const src = curFrame(), f = newFrameObj(src.bgId);
  // + Frame trống = nothing drawn AND no character: the characters keep their pose/place (an in-between of the frames
  // around it, so tweens on both sides don't change) but are hidden on this frame only (🙈, f.lip.off)
  if (S.pp && S.pp.parts.length) {
    f.pp = ppClone(src.pp); f.ppKey = false; f.lip = lipCopy(src) || {};
    delete f.lip.m; delete f.lip.pid; delete f.lip.lv; delete f.lip.eb;
    f.lip.off = {}; for (const r of ppRoots()) f.lip.off[r.id] = 1;
  }
  S.frames.splice(S.cur + 1, 0, f); loaded.push(f);
  if (f.pp) ppRetween();
  await drawThumb(f); buildStrip(); await selectFrame(S.cur + 1); scheduleSave(); evictSoon();
  if (f.lip && f.lip.off) toast('+ Frame trống: nhân vật được ẩn ở frame này. Muốn hiện lại: Ghép → chạm chọn trên Dòng layer → 👁 Hiện ở frame này', 3200);
}
// f.lip = mouth/eye pictures + 〰 Đường đi offsets (lip.mv): a copied frame must keep them, else the character jumps back to where it started
function lipCopy(f) { return f && f.lip ? JSON.parse(JSON.stringify(f.lip)) : null; }
const jcopy = o => o == null ? o : JSON.parse(JSON.stringify(o));
// the 🌈 look of a frame (👻 ghost, 🏃 scrolling bg, 💨 speed lines, film colour) goes on in frames made from it
function lookCopy(f, src) { for (const k of ['ghost', 'bgs', 'bgb', 'sl', 'flt']) if (src && src[k] != null) f[k] = jcopy(src[k]); }
// ONE place that copies a frame (Nhân bản frame, Lặp đoạn, Chọn nhiều → Nhân bản, 📺 Phát lại): picture, colour, vector
// lines, pose, mouth/eyes + 〰 path (lip), texts and the 🌈 look (👻 ghost, 🏃 scrolling bg, 💨 speed lines, film colour).
// run = copying a whole run of frames: also its keyframes, camera keys, shake and flash (one copied frame alone must
// not restart a camera move). Never copies scene starts / transitions: those belong to the joins between frames.
// s0 must be loaded (await ensureLoaded(s0)).
function frameCopyOf(s0, run) {
  const f = newFrameObj(s0.bgId); f.dur = s0.dur;
  f.canvas.getContext('2d').drawImage(s0.canvas, 0, 0); copyCol(f, s0); f.ver = 1; f.pngVer = 0;
  f.vec = cloneVec(s0.vec); f.pp = ppClone(s0.pp); f.lip = lipCopy(s0); f.texts = jcopy(s0.texts || []);
  lookCopy(f, s0);
  if (run) { f.ppKey = s0.ppKey; if (s0.ppK) f.ppK = { ...s0.ppK }; if (s0.ppE) f.ppE = { ...s0.ppE }; f.ppEase = s0.ppEase; f.cam = s0.cam ? { ...s0.cam } : null; f.shake = s0.shake || 0; f.flash = !!s0.flash; }
  return f;
}
// put new frames in at index `at` as ONE undo step (after the frame before them), with their thumbnails
async function insertFrames(at, added) {
  const f0 = S.frames[at - 1]; S.frames.splice(at, 0, ...added);
  pushEntry({ t: targetOf(f0), add: { frames: added, index: at, dur0: f0.dur, dur1: f0.dur }, bytes: 0 });
  for (const f of added) await drawThumb(f);
}
async function dupFrame() {
  if (playing) stopPlay(); commitFloating();
  const src = curFrame(); await ensureLoaded(src);
  const f = frameCopyOf(src);
  S.frames.splice(S.cur + 1, 0, f); loaded.push(f);
  await drawThumb(f); buildStrip(); await selectFrame(S.cur + 1); scheduleSave(); evictSoon();
}
// repeat frames a..b (0-based) after b: 'loop' = a..b again, 'pingpong' = b-1..a (there and back); undo = one step
async function repeatRange(a, b, times, mode) {
  if (playing) stopPlay(); commitFloating();
  const src = S.frames.slice(a, b + 1); if (!src.length) return 0;
  let seq = [];
  for (let k = 0; k < times; k++) seq = seq.concat(mode === 'pingpong' ? (k % 2 === 0 ? src.slice(0, -1).reverse() : src.slice(1)) : src);
  if (!seq.length) return 0;
  const pm = progress('Đang lặp đoạn…'), added = [];
  try {
    for (let k = 0; k < seq.length; k++) {
      const s0 = seq[k]; await ensureLoaded(s0);
      const f = frameCopyOf(s0, true);
      added.push(f); loaded.push(f);
      if (k % 10 === 9) { pm.set(`Đang lặp đoạn ${k + 1}/${seq.length}…`); await new Promise(r => setTimeout(r, 0)); await evictSoon(); }
    }
    await insertFrames(b + 1, added);
  } finally { pm.close(); }
  tintCache.clear(); ppRetween(); buildStrip(); await selectFrame(b + 1); scheduleSave(); evictSoon(); updUndoBtns();
  return added.length;
}
async function repeatRangeDialog() {
  const n = S.frames.length, num = (id, v, mx) => `<input type="number" id="${id}" min="1" max="${mx}" value="${v}" style="width:72px">`;
  if (n < 2) { toast('Cần ít nhất 2 frame để lặp đoạn — vẽ thêm frame trước'); return; }
  let el = {};
  const v = await modal({ title: '🔁 Lặp đoạn frame', html: `<p class="lbl">Vẽ một chu kỳ (vd. 1 bước đi, 1 lần chớp mắt) rồi lặp lại, không cần vẽ lại. Frame mới được thêm ngay sau đoạn.</p>
<div class="set-row"><span>Từ frame</span>${num('lrA', Math.max(1, S.cur), n)}</div>
<div class="set-row"><span>Đến frame</span>${num('lrB', S.cur + 1, n)}</div>
<div class="set-row"><span>Số lần thêm</span>${num('lrN', 2, 50)}</div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '↔ Đi rồi về', value: 'pingpong' }, { label: '🔁 Lặp lại', value: 'loop', primary: true }],
    onOpen: ov => { ov.querySelectorAll('input').forEach(i => { el[i.id] = i; i.addEventListener('keydown', e => e.stopPropagation()); }); } });
  if (!v) return;
  let a = clamp((parseInt(el.lrA.value) || 1) - 1, 0, n - 1), b = clamp((parseInt(el.lrB.value) || 1) - 1, 0, n - 1); if (a > b) [a, b] = [b, a];
  const times = clamp(parseInt(el.lrN.value) || 1, 1, 50);
  if (v === 'pingpong' && b - a < 1) { toast('Đi rồi về cần đoạn ít nhất 2 frame'); return; }
  if ((b - a + 1) * times > 600) { toast('Nhiều quá (tối đa 600 frame mỗi lần)'); return; }
  const c = await repeatRange(a, b, times, v);
  toast(`Đã thêm ${c} frame sau frame ${b + 1} — hoàn tác 1 lần để bỏ`, 3000);
}
// Park a frame/background out of the project but keep it restorable for undo: PNG in memory, canvas freed.
async function parkObj(o) {
  await ensurePng(o);
  if (o.canvas) { o.canvas.width = 0; o.canvas = null; }
  if (o.col) { o.col.width = 0; o.col = null; }
  if (o.play) { o.play.width = 0; o.play = null; o.playKey = ''; }
  const li = loaded.indexOf(o); if (li >= 0) loaded.splice(li, 1);
}
// Take frame i out of the film (undoable). Returns { f, index, bg } where bg is set if its background was only used by it.
async function removeFrameAt(i) {
  const f = S.frames[i];
  const bg = S.frames.filter(g => g.bgId === f.bgId).length === 1 ? bgOf(f) : null;
  await parkObj(f);
  if (bg) await parkObj(bg);
  S.frames.splice(i, 1);
  if (bg) S.bgs = S.bgs.filter(b => b !== bg);
  return { f, index: i, bg };
}
async function delFrame() {
  if (playing) stopPlay();
  if (S.frames.length === 1) { toast('Không xoá được frame cuối cùng'); return; }
  if (stroke) strokeEnd(); commitFloating(); motionClose(); rigClose();
  const n = S.cur + 1, D = await removeFrameAt(S.cur);
  pushEntry({ del: D, t: targetOf(D.f), bytes: (D.f.png ? D.f.png.byteLength : 0) + (D.f.colPng ? D.f.colPng.byteLength : 0) + (D.bg && D.bg.png ? D.bg.png.byteLength : 0) });
  S.cur = Math.min(S.cur, S.frames.length - 1);
  ppRetween(); buildStrip(); await selectFrame(S.cur); scheduleSave();
  toast(`Đã xoá frame ${n} — bấm ↶ Hoàn tác để lấy lại`, 2500);
}
function moveFrame(d) {
  const j = S.cur + d; if (j < 0 || j >= S.frames.length) return;
  commitFloating();
  [S.frames[S.cur], S.frames[j]] = [S.frames[j], S.frames[S.cur]]; S.cur = j;
  tintCache.clear(); ppRetween(); buildStrip(); selectFrame(j); scheduleSave();
}
function gcBgs() {
  const used = new Set(S.frames.map(f => f.bgId));
  S.bgs = S.bgs.filter(b => used.has(b.id));   // removed backgrounds keep their canvas: ↶ can bring them back
}
async function newBg(copy) {
  if (playing) stopPlay(); commitFloating();
  const f = curFrame(), old = bgOf(f);
  const shared = S.frames.filter(g => g.bgId === f.bgId).length;
  if (copy && shared < 2) { toast('Nền này đã là nền riêng của frame'); return; }
  const b = newBgObj();
  if (copy && old && old.canvas) { b.canvas.getContext('2d').drawImage(old.canvas, 0, 0); b.ver = 1; }
  S.bgs.push(b); f.bgId = b.id; gcBgs();
  await drawThumb(f); buildStrip(); setLayer('bg'); requestRender(); scheduleSave();
  toast(copy ? 'Đã tách nền — sửa nền chỉ ảnh hưởng frame này' : 'Frame này có nền trống mới (lớp Nền đang chọn)');
}
function setDur(ms, all) {
  ms = clamp(Math.round(ms), 20, 30000);
  if (all) S.frames.forEach(f => f.dur = ms); else curFrame().dur = ms;
  updateFrameUI(); scheduleSave();
}

