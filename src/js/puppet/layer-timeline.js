/* ===== 🗂 Dòng layer: timeline rows = layers × frames (like the timeline of Adobe Animate) =====
   One row per character / picture layer (front first) + one row for the hand-drawn layers. Each cell is one frame:
   ● = keyframe of that layer (pose set by hand), coloured band + arrow = the app tweens it between keyframes,
   empty = the layer is hidden on that frame. Tap a cell = go to that frame and pick that layer.
   Buttons act on the picked layer at the frame being viewed:
   ✂ Tách = make a keyframe here (split the tween in two), 🔗 Nối = remove this keyframe (the two tweens join into one),
   ＋ Frame = insert a tween frame after this one (the move gets longer), − Frame = remove this frame. */
SETTINGS_KEYS.push('lgOpen'); S.lgOpen = false;
var LG = { cw: 32, rh: 34, sig: '' };
const lgRows = () => [...lyrOrder().map(r => ({ id: r.id, name: lyrName(r), pp: true, r })), { id: 'draw', name: '✏️ Vẽ tay', pp: false }];
function lgSelRoot() { const s = ppPart(ppSel); return s ? (ppCharOf(s) || s.id) : null; }
function lgHiddenAt(f, rid) { const q = f.pp && f.pp[rid]; return !!(q && q.h); }
function lgSync(force) {
  const box = $('#lg'), btn = $('#lgBtn'); if (!box) return;
  if (btn) btn.classList.toggle('on', !!S.lgOpen);
  box.hidden = !S.lgOpen; if (!S.lgOpen) return;
  const rows = lgRows(), sel = lgSelRoot();
  const sig = JSON.stringify([rows.map(r => [r.id, r.name, r.r && r.r.lh]), S.frames.length, S.cur, sel, S.frames.map(f => [f.ppKey, f.ppK, rows.map(r => r.pp && lgHiddenAt(f, r.id))])]);
  if (!force && sig === LG.sig) return; LG.sig = sig;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('#lgNames').innerHTML = rows.map(r => `<div class="lgn${r.id === sel ? ' on' : ''}${r.r && r.r.lh ? ' off' : ''}" data-lgr="${r.id}">${r.pp ? (lyrParts(r.id).length > 1 ? '🧍 ' : '🖼 ') : ''}${esc(r.name)}</div>`).join('');
  lgDraw(rows, sel);
  const has = !!sel && S.pp; ['#lgSplit', '#lgJoin'].forEach(id => { $(id).disabled = !has; });
  const f = curFrame(), k = has && ppLayerKey(f, sel);
  $('#lgSplit').classList.toggle('on', !!k);
  $('#lgInfo').textContent = has ? `${lyrName(ppPart(sel))} · frame ${S.cur + 1}: ${k ? '🔑 keyframe' : '∿ tự chuyển'}` : 'Chạm 1 dòng layer để chọn';
}
function lgDraw(rows, sel) {
  const cv = $('#lgCv'), n = S.frames.length, cw = LG.cw, rh = LG.rh, w = Math.max(1, n * cw), h = rows.length * rh;
  const d = window.devicePixelRatio || 1; cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.body), acc = css.getPropertyValue('--accent').trim() || '#ffb21e';
  rows.forEach((r, ri) => {
    const y = ri * rh;
    x.fillStyle = r.id === sel ? 'rgba(255,178,30,.12)' : ri % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)'; x.fillRect(0, y, w, rh);
    if (!r.pp) { for (let i = 0; i < n; i++) { x.fillStyle = '#8a8f99'; x.beginPath(); x.arc(i * cw + cw / 2, y + rh / 2, 3.5, 0, 7); x.fill(); } return; }
    const keys = []; for (let i = 0; i < n; i++) if (ppLayerKey(S.frames[i], r.id)) keys.push(i);
    // tween bands between keyframes (violet, like a classic tween), with an arrow
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k], b = keys[k + 1]; if (b - a < 2) continue;
      const x0 = a * cw + cw / 2, x1 = b * cw + cw / 2;
      x.fillStyle = 'rgba(140,110,255,.35)'; x.fillRect(x0, y + 7, x1 - x0, rh - 14);
      x.strokeStyle = '#b9a8ff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0 + 8, y + rh / 2); x.lineTo(x1 - 8, y + rh / 2); x.lineTo(x1 - 13, y + rh / 2 - 4); x.moveTo(x1 - 8, y + rh / 2); x.lineTo(x1 - 13, y + rh / 2 + 4); x.stroke();
    }
    for (let i = 0; i < n; i++) {
      const f = S.frames[i], cx = i * cw + cw / 2, cy = y + rh / 2;
      if (lgHiddenAt(f, r.id) || (r.r && r.r.lh)) { x.strokeStyle = '#555b66'; x.lineWidth = 1; x.strokeRect(i * cw + 6, y + 9, cw - 12, rh - 18); continue; }
      if (ppLayerKey(f, r.id)) { x.fillStyle = r.id === sel ? acc : '#e8e8ee'; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1.5; x.stroke(); }
      else if (!keys.length || i > keys[keys.length - 1] || i < keys[0]) { x.fillStyle = '#9aa0aa'; x.fillRect(cx - 5, cy - 1, 10, 2); }
    }
  });
  // cell lines + the frame being viewed (playhead)
  x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1; for (let i = 1; i < n; i++) { x.beginPath(); x.moveTo(i * cw + 0.5, 0); x.lineTo(i * cw + 0.5, h); x.stroke(); }
  x.strokeStyle = '#ff3b30'; x.lineWidth = 2; x.strokeRect(S.cur * cw + 1, 1, cw - 2, h - 2);
  const sc = $('#lgScroll'), cx0 = S.cur * cw; if (cx0 < sc.scrollLeft || cx0 + cw > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, cx0 - sc.clientWidth / 2);
}
async function lgPick(i, rid) {
  if (playing) stopPlay();
  if (i !== S.cur && i >= 0 && i < S.frames.length) await selectFrame(i);
  if (rid && rid !== 'draw') lyrSelect(rid);
  else if (rid === 'draw') { if (S.tool === 'puppet' || S.tool === 'fx' || S.tool === 'vedit') setTool('brush'); if (S.layer !== 'char' && S.layer !== 'vec') setLayer(S.lineLayer || 'char'); }
  lgSync(true);
}
// ✂ Tách = keyframe here; 🔗 Nối = no keyframe here (the tweens on both sides join)
function lgSetKey(on) {
  const rid = lgSelRoot(), f = curFrame(); if (!rid || !S.pp) { toast('Chạm chọn 1 layer nhân vật/ảnh trước'); return; }
  if (!on) {
    const keys = S.frames.filter(g => ppLayerKey(g, rid));
    if (!ppLayerKey(f, rid)) { toast('Frame này đã là frame tự chuyển (không phải keyframe)'); return; }
    if (keys.length < 2) { toast('Layer cần ít nhất 1 keyframe — không nối được nữa'); return; }
  } else if (ppLayerKey(f, rid)) { toast('Frame này đã là keyframe của layer'); return; }
  const before = ppState(f);
  ppLayerSetKey(f, rid, on); pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); lgSync(true);
  toast(on ? '✂ Đã tách: frame này thành keyframe của layer — kéo nhân vật để đặt dáng mới' : '🔗 Đã nối: app tự chuyển động qua frame này từ keyframe trước tới keyframe sau', 3000);
}
// ＋ Frame: a frame after this one that tweens (every layer) — the move between the keyframes gets one frame longer
async function lgAddFrame() {
  if (playing) stopPlay(); commitFloating();
  const src = curFrame(); await ensureLoaded(src);
  const f = frameCopyOf(src); f.ppKey = false; delete f.ppK; loaded.push(f);
  await insertFrames(S.cur + 1, [f]); ppRetween(); buildStrip(); await selectFrame(S.cur + 1); scheduleSave(); evictSoon(); lgSync(true);
  toast('＋ Đã thêm 1 frame tự chuyển: chuyển động dài thêm 1 frame', 2200);
}
function lgWire() {
  $('#lgBtn').addEventListener('click', () => { S.lgOpen = !S.lgOpen; saveSettings(); lgSync(true); refitSoon(); });
  $('#lgSplit').addEventListener('click', () => lgSetKey(true));
  $('#lgJoin').addEventListener('click', () => lgSetKey(false));
  $('#lgAdd').addEventListener('click', lgAddFrame);
  $('#lgDel').addEventListener('click', () => delFrame());
  $('#lgNames').addEventListener('click', e => { const r = e.target.closest('[data-lgr]'); if (r) lgPick(S.cur, r.dataset.lgr); });
  $('#lgCv').addEventListener('click', e => {
    const b = e.target.getBoundingClientRect(), i = Math.floor((e.clientX - b.left) / LG.cw), ri = Math.floor((e.clientY - b.top) / LG.rh), rows = lgRows();
    if (rows[ri]) lgPick(clamp(i, 0, S.frames.length - 1), rows[ri].id);
  });
}
lgWire();
