/* ===== 🗂 Dòng layer: timeline rows = layers × frames (like the timeline of Adobe Animate) =====
   One row per character / picture layer (front first) + one row for the hand-drawn layers. Each cell is one frame:
   ● = keyframe of that layer (pose set by hand), coloured band + arrow = the app tweens it between keyframes,
   empty = the layer is hidden on that frame. Tap a cell = go to that frame and pick that layer.
   Buttons act on the picked layer at the frame being viewed:
   ✂ Tách = make a keyframe here (split the tween in two), 🔗 Nối = remove this keyframe (the two tweens join into one),
   ＋ Frame = insert a tween frame after this one (the move gets longer), − Frame = remove this frame. */
SETTINGS_KEYS.push('lgOpen'); S.lgOpen = false;
var LG = { cw: 32, rh: 34, hd: 18, sig: '', drag: null };   // hd = frame-number ruler on top of the cells
const lgRows = () => [...lyrOrder().map(r => ({ id: r.id, name: lyrName(r), pp: true, r })), ...lgTxRows(), { id: 'draw', name: '✏️ Vẽ tay', pp: false }, { id: 'bg', name: '🖼 Nền', pp: false, bg: true }];
// 🔤 one row per text (by id, in the order they first show up): each run of frames holding it is one bar,
// drag its end (or its first cell) to make the text stay on more / fewer frames, like the 🖼 Nền row
function lgTxRows() {
  const seen = new Map();
  S.frames.forEach(f => (f.texts || []).forEach(t => { if (!seen.has(t.id)) seen.set(t.id, t.str); }));
  return [...seen].map(([id, str]) => { const s1 = String(str || '').replace(/\s+/g, ' ').trim(); return { id: 'tx:' + id, tx: id, name: '🔤 ' + (s1.length > 12 ? s1.slice(0, 11) + '…' : s1 || 'Chữ'), pp: false }; });
}
function lgTxSpans(id) {
  const out = []; S.frames.forEach((f, i) => { if (!(f.texts || []).some(t => t.id === id)) return; const L = out[out.length - 1]; if (L && L.b === i - 1) L.b = i; else out.push({ a: i, b: i }); });
  return out;
}
const lgTxSpanAt = (id, i) => lgTxSpans(id).find(s => s.a <= i && i <= s.b);
// the bar's end (side 'b') or start (side 'a') goes to frame j: frames added get a copy of the text at that edge, frames let go lose it
function lgTxStretch(id, sp, side, j) {
  if (playing) stopPlay();
  const n = S.frames.length; j = side === 'b' ? clamp(j, sp.a, n - 1) : clamp(j, 0, sp.b);
  const edge = side === 'b' ? sp.b : sp.a; if (j === edge) { lgSync(true); return; }
  const src = (S.frames[edge].texts || []).find(t => t.id === id); if (!src) return;
  const put = i => { const g = S.frames[i]; g.texts = (g.texts || []).filter(t => t.id !== id); g.texts.push(JSON.parse(JSON.stringify(src))); g.ver++; queueThumbFor(g); };
  const drop = i => { const g = S.frames[i]; g.texts = (g.texts || []).filter(t => t.id !== id); g.ver++; queueThumbFor(g); };
  if (side === 'b') { if (j > sp.b) for (let i = sp.b + 1; i <= j; i++) put(i); else for (let i = j + 1; i <= sp.b; i++) drop(i); }
  else { if (j < sp.a) for (let i = j; i < sp.a; i++) put(i); else for (let i = sp.a; i < j; i++) drop(i); }
  scheduleSave(); requestRender(); if (S.tool === 'fx') fxSyncBar(); lgSync(true);
  const r = lgTxSpanAt(id, side === 'b' ? sp.a : sp.b); toast(r ? `🔤 Chữ hiện ở frame ${r.a + 1} → ${r.b + 1}` : '🔤 Đã bỏ chữ ở các frame này', 2200);
}
// 🖼 Nền row: frames that share one background form a span (frame 1–5 = Nền 1, 6–10 = Nền 2…); drag its end to stretch / shrink it
function lgBgSpans() {
  const out = [], no = new Map(); let k = 0;
  S.frames.forEach((f, i) => { const last = out[out.length - 1]; if (last && last.bgId === f.bgId) last.b = i; else { if (!no.has(f.bgId)) no.set(f.bgId, ++k); out.push({ bgId: f.bgId, a: i, b: i, no: no.get(f.bgId) }); } });
  return out;
}
const lgBgSpanAt = i => lgBgSpans().find(s => s.a <= i && i <= s.b);
async function lgBgRefresh(msg) {
  gcBgs(); tintCache.clear(); S.frames.forEach(f => queueThumbFor(f)); buildStrip(); await selectFrame(S.cur); scheduleSave(); requestRender(); lgSync(true); if (msg) toast(msg, 2600);
}
// the span's last frame goes to frame j: longer = the next frames take this background, shorter = the frames let go take
// the background that comes after (or a new empty one at the end of the film)
async function lgBgStretch(sp, j) {
  if (playing) stopPlay(); commitFloating();
  j = clamp(j, sp.a, S.frames.length - 1); if (j === sp.b) { lgSync(true); return; }
  if (j > sp.b) for (let i = sp.b + 1; i <= j; i++) S.frames[i].bgId = sp.bgId;
  else {
    const nx = S.frames[sp.b + 1]; let id = nx && nx.bgId;
    if (!id) { const nb = newBgObj(); S.bgs.push(nb); id = nb.id; }
    for (let i = j + 1; i <= sp.b; i++) S.frames[i].bgId = id;
  }
  await lgBgRefresh(`🖼 Nền ${sp.no}: frame ${sp.a + 1} → ${j + 1}`);
}
// 🖼 Nền mới từ đây: a new empty background from this frame to the end of the span it is in (the frames before keep theirs)
async function lgBgNewFrom() {
  if (playing) stopPlay(); commitFloating();
  const sp = lgBgSpanAt(S.cur); if (!sp) return;
  const nb = newBgObj(); S.bgs.push(nb);
  for (let i = S.cur; i <= sp.b; i++) S.frames[i].bgId = nb.id;
  setLayer('bg'); if (S.tool === 'puppet' || S.tool === 'fx' || S.tool === 'vedit') setTool('brush');
  await lgBgRefresh(`🖼 Nền mới cho frame ${S.cur + 1} → ${sp.b + 1} (lớp Nền đang chọn: vẽ, đổ màu hoặc Nền ▾ → Ảnh làm nền)`);
}
// ＋ 1 giây: tween frames after this one, as many as fit in 1 second at this frame's timing
async function lgAddSecond() {
  if (playing) stopPlay(); commitFloating();
  const src = curFrame(); await ensureLoaded(src);
  const n = clamp(Math.round(1000 / (src.dur || 100)), 1, 60), added = [];
  for (let k = 0; k < n; k++) { const f = frameCopyOf(src); f.ppKey = false; delete f.ppK; delete f.ppE; added.push(f); loaded.push(f); }
  await insertFrames(S.cur + 1, added); ppRetween(); buildStrip(); scheduleSave(); evictSoon(); lgSync(true);
  toast(`＋ Thêm ${n} frame (1 giây). Tới frame cuối, chỉnh dáng = keyframe mới, app tự chuyển ở giữa`, 3000);
}
function lgSelRoot() { const s = ppPart(ppSel); return s ? (ppCharOf(s) || s.id) : null; }
function lgHiddenAt(f, rid) { const q = f.pp && f.pp[rid]; return !!(q && q.h) || ppOffAt(f, rid); }
function lgSync(force) {
  const box = $('#lg'), btn = $('#lgBtn'); if (!box) return;
  if (btn) btn.classList.toggle('on', !!S.lgOpen);
  box.hidden = !S.lgOpen; if (!S.lgOpen) return;
  const rows = lgRows(), sel = lgSelRoot();
  const sig = JSON.stringify([rows.map(r => [r.id, r.name, r.r && r.r.lh]), S.frames.length, S.cur, sel, fxSel, S.frames.map(f => [f.ppKey, f.ppK, f.ppE, f.ppEase, f.bgId, f.dur, (f.texts || []).map(t => t.id).join(), rows.map(r => r.pp && lgHiddenAt(f, r.id))])]);
  if (!force && sig === LG.sig) return; LG.sig = sig;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('#lgNames').innerHTML = '<div class="lgnHd">frame</div>' + rows.map(r => `<div class="lgn${r.id === sel ? ' on' : ''}${r.r && r.r.lh ? ' off' : ''}" data-lgr="${r.id}">${r.pp ? (lyrParts(r.id).length > 1 ? '🧍 ' : '🖼 ') : ''}${esc(r.name)}</div>`).join('');
  lgDraw(rows, sel);
  const has = !!sel && S.pp; ['#lgSplit', '#lgJoin', '#lgShow'].forEach(id => { $(id).disabled = !has; });
  const f = curFrame(), k = has && ppLayerKey(f, sel);
  $('#lgSplit').classList.toggle('on', !!k);
  const seg = has && lgSegAt(sel, S.cur), es = $('#lgEase');
  es.innerHTML = Object.entries(EASE_LABEL).map(([k2, v]) => `<option value="${k2}">${v}</option>`).join('');
  es.disabled = !seg; $('#lgEaseRow').classList.toggle('off', !seg); if (seg) es.value = ppLayerEase(S.frames[seg[0]], sel);
  $('#lgOnion').classList.toggle('on', !!(S.onion && S.onionLayer)); $('#lgOnion').disabled = !has;
  $('#lgSymSave').disabled = !has; $('#lgSymPut').disabled = !has;
  { const off = has && ppOffAt(f, sel), b = $('#lgOff'); b.disabled = !has; b.textContent = off ? '👁 Hiện' : '🙈 Ẩn'; b.title = off ? 'Hiện lại layer đang chọn ở frame này' : 'Ẩn layer đang chọn CHỈ ở frame đang xem, các frame khác vẫn giữ'; b.classList.toggle('on', !!off); }
  $('#lgCopy').disabled = !has; $('#lgPaste').disabled = !has || !LG.clip;
  $('#lgInfo').textContent = has ? `${lyrName(ppPart(sel))} · frame ${S.cur + 1}: ${k ? '🔑 keyframe' : '∿ tự chuyển'}` : 'Chạm 1 dòng layer để chọn · kéo ● để dời keyframe';
}
function lgDraw(rows, sel) {
  const cv = $('#lgCv'), n = S.frames.length, cw = LG.cw, rh = LG.rh, hd = LG.hd, w = Math.max(1, n * cw), h = hd + rows.length * rh;
  const d = window.devicePixelRatio || 1; cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.body), acc = css.getPropertyValue('--accent').trim() || '#ffb21e';
  // frame numbers (1, 5, 10… like Animate, every one when there are few) — tap one = go to that frame
  x.font = '10px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < n; i++) { const no = i + 1; if (n > 12 && no !== 1 && no % 5) continue; x.fillStyle = i === S.cur ? '#ff6b61' : '#8a8f99'; x.fillText(String(no), i * cw + cw / 2, hd / 2 + 1); }
  // whole seconds of film time (frames keep their own length): a yellow tick + "1s", "2s"… where that second starts
  { let t = 0, s = 1; x.textAlign = 'left'; for (let i = 0; i < n; i++) { const d = S.frames[i].dur || 100; while (t + d > s * 1000) { const sx = i * cw + cw * (s * 1000 - t) / d; x.fillStyle = '#ffd60a'; x.fillRect(sx, 0, 1.5, hd); x.fillStyle = '#1b1d22'; x.fillRect(sx + 2, 1, 16, 10); x.fillStyle = '#ffd60a'; x.font = '9px system-ui,sans-serif'; x.fillText(s + 's', sx + 3, 6.5); s++; } t += d; } x.textAlign = 'center'; x.font = '10px system-ui,sans-serif'; }
  rows.forEach((r, ri) => {
    const y = hd + ri * rh;
    x.fillStyle = r.id === sel ? 'rgba(255,178,30,.12)' : ri % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)'; x.fillRect(0, y, w, rh);
    if (r.bg) {
      const dg = LG.drag && LG.drag.bg && LG.drag.moved ? LG.drag : null;
      lgBgSpans().forEach(s => {
        let b = s.b; if (dg && dg.bg.a === s.a) b = clamp(s.b + dg.j - dg.i, s.a, n - 1);
        const x0 = s.a * cw + 3, x1 = (b + 1) * cw - 3, hue = (s.no * 67 + 160) % 360;
        x.fillStyle = `hsla(${hue},55%,45%,.55)`; x.fillRect(x0, y + 6, x1 - x0, rh - 12);
        x.fillStyle = '#fff'; x.fillRect(x1 - 4, y + 9, 2, rh - 18);   // the end grip: drag to stretch / shrink
        if (x1 - x0 > 34) { x.font = '10px system-ui,sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('Nền ' + s.no, x0 + 5, y + rh / 2 + 1); }
      });
      return;
    }
    if (r.tx) {
      const dg = LG.drag && LG.drag.tx && LG.drag.moved && LG.drag.rid === r.id ? LG.drag : null;
      lgTxSpans(r.tx).forEach(s => {
        let a = s.a, b = s.b; if (dg && dg.tx.a === s.a) { if (dg.side === 'b') b = clamp(s.b + dg.j - dg.i, s.a, n - 1); else a = clamp(s.a + dg.j - dg.i, 0, s.b); }
        const x0 = a * cw + 3, x1 = (b + 1) * cw - 3;
        x.fillStyle = r.tx === fxSel ? 'rgba(255,200,40,.75)' : 'rgba(230,170,40,.5)'; x.fillRect(x0, y + 6, x1 - x0, rh - 12);
        x.fillStyle = '#fff'; x.fillRect(x0 + 2, y + 9, 2, rh - 18); x.fillRect(x1 - 4, y + 9, 2, rh - 18);   // grips: drag to stretch / shrink
        if (x1 - x0 > 40) { x.font = '10px system-ui,sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#1b1d22'; x.fillText(`${a + 1}→${b + 1}`, x0 + 7, y + rh / 2 + 1); }
      });
      return;
    }
    if (!r.pp) { for (let i = 0; i < n; i++) { x.fillStyle = '#8a8f99'; x.beginPath(); x.arc(i * cw + cw / 2, y + rh / 2, 3.5, 0, 7); x.fill(); } return; }
    const keys = []; for (let i = 0; i < n; i++) if (ppLayerKey(S.frames[i], r.id)) keys.push(i);
    // tween bands between keyframes (violet, like a classic tween), with an arrow
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k], b = keys[k + 1]; if (b - a < 2) continue;
      const x0 = a * cw + cw / 2, x1 = b * cw + cw / 2;
      x.fillStyle = 'rgba(140,110,255,.35)'; x.fillRect(x0, y + 7, x1 - x0, rh - 14);
      x.strokeStyle = '#b9a8ff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0 + 8, y + rh / 2); x.lineTo(x1 - 8, y + rh / 2); x.lineTo(x1 - 13, y + rh / 2 - 4); x.moveTo(x1 - 8, y + rh / 2); x.lineTo(x1 - 13, y + rh / 2 + 4); x.stroke();
      const el = x1 - x0 > 76 && EASE_SHORT[ppLayerEase(S.frames[a], r.id)];
      if (el) { x.font = '10px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText(el).width + 10, mx = (x0 + x1) / 2; x.fillStyle = '#2a2350'; x.fillRect(mx - tw / 2, y + rh / 2 - 7, tw, 14); x.fillStyle = '#d9d0ff'; x.fillText(el, mx, y + rh / 2 + 1); }
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
  // a keyframe being dragged: hollow dot where it was, full dot where it would land
  const dg = LG.drag; if (dg && dg.key && dg.j !== dg.i) {
    const y = hd + dg.ri * rh + rh / 2, ok = lgCanMove(dg.rid, dg.i, dg.j);
    x.setLineDash([3, 3]); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.arc(dg.i * cw + cw / 2, y, 6, 0, 7); x.stroke(); x.setLineDash([]);
    x.fillStyle = ok ? acc : '#ff3b30'; x.beginPath(); x.arc(dg.j * cw + cw / 2, y, 8, 0, 7); x.fill(); x.strokeStyle = '#111'; x.stroke();
  }
  const sc = $('#lgScroll'), cx0 = S.cur * cw; if (cx0 < sc.scrollLeft || cx0 + cw > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, cx0 - sc.clientWidth / 2);
}
async function lgPick(i, rid) {
  if (playing) stopPlay();
  if (i !== S.cur && i >= 0 && i < S.frames.length) await selectFrame(i);
  if (rid && rid.startsWith('tx:')) {
    const id = rid.slice(3); setTool('fx'); openTab('fx', 'text');
    if ((curFrame().texts || []).some(t => t.id === id)) fxSel = id;
    fxSyncBar(); requestRender();
    const sp = lgTxSpanAt(id, S.cur); toast(sp ? `🔤 Chữ ở frame ${sp.a + 1} → ${sp.b + 1} · kéo 2 đầu thanh vàng để kéo dài / rút ngắn` : 'Frame này chưa có chữ này · kéo đầu thanh vàng tới đây để chữ hiện ở đây', 2600);
  }
  else if (rid && rid !== 'draw' && rid !== 'bg') lyrSelect(rid);
  else if (rid === 'bg') { if (S.tool === 'puppet' || S.tool === 'fx' || S.tool === 'vedit') setTool('brush'); setLayer('bg'); const sp = lgBgSpanAt(S.cur); if (sp) toast(`🖼 Nền ${sp.no}: frame ${sp.a + 1} → ${sp.b + 1} · kéo cuối thanh nền để kéo dài / rút ngắn`, 2400); }
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
// the tween span of layer rid that frame i is in (or starts at): [key before, next key], null if it holds still there
const EASE_SHORT = { inout: 'mượt', linear: 'đều', out: 'chậm dần', in: 'nhanh dần', back: 'vượt đà', bounce: 'nảy', hold: 'giữ rồi nhảy' };
function lgSegAt(rid, i) {
  let a = -1; for (let k = i; k >= 0; k--) if (ppLayerKey(S.frames[k], rid)) { a = k; break; }
  if (a < 0) return null; for (let k = a + 1; k < S.frames.length; k++) if (ppLayerKey(S.frames[k], rid)) return k - a > 1 ? [a, k] : null;
  return null;
}
function lgSetEase(e) {
  const rid = lgSelRoot(), seg = rid && lgSegAt(rid, S.cur); if (!seg) return;
  const A = S.frames[seg[0]], before = ppState(A); ppLayerSetEase(A, rid, e);
  pushEntry(ppEntry(A, before, ppState(A))); markEdited(A); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); lgSync(true);
  toast(`Đoạn frame ${seg[0] + 1} → ${seg[1] + 1}: ${EASE_LABEL[e]}`, 1800);
}
// ⧉ / 📋: copy the picked layer's pose on this frame, paste it on another frame (as a keyframe) — same layer by part,
// another layer by body role (head, arms…) with the root taking the root's place
function lgCopy() {
  const rid = lgSelRoot(), f = curFrame(); if (!rid) return;
  const parts = lyrParts(rid);
  LG.clip = { rid, items: parts.map(p => ({ id: p.id, role: p.role || '', root: p.id === rid, q: f.pp && f.pp[p.id] ? ppClone(f.pp[p.id]) : null })) };   // q null = the part at rest
  lgSync(true); toast(`⧉ Đã chép dáng của ${lyrName(ppPart(rid))} ở frame ${S.cur + 1} — tới frame khác rồi bấm 📋 Dán dáng`, 2600);
}
function lgPaste() {
  const rid = lgSelRoot(), f = curFrame(), c = LG.clip; if (!rid || !c) return;
  const parts = lyrParts(rid), same = c.rid === rid, before = ppState(f), pp = { ...(f.pp || {}) }; let n = 0;
  for (const o of c.items) {
    const t = same ? ppPart(o.id) : o.root ? ppPart(rid) : o.role && parts.find(p => p.role === o.role && p.id !== rid);
    if (!t || !parts.includes(t)) continue; if (o.q) pp[t.id] = ppClone(o.q); else delete pp[t.id]; n++;
  }
  if (!n) { toast('Layer này không có mảnh hợp với dáng đã chép'); return; }
  f.pp = pp; ppMarkKey(f, rid); pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); lgSync(true);
  toast(`📋 Đã dán dáng vào frame ${S.cur + 1} (keyframe)`, 2000);
}
// drag ● → another frame: the layer's pose + keyframe move there (its tween gets shorter / longer), the old frame tweens
const lgCanMove = (rid, i, j) => !!S.pp && i !== j && j >= 0 && j < S.frames.length && ppLayerKey(S.frames[i], rid) && !ppLayerKey(S.frames[j], rid);
async function lgMoveKey(rid, i, j) {
  if (!lgCanMove(rid, i, j)) { toast('Frame đó đã là keyframe của layer này'); lgSync(true); return; }
  if (playing) stopPlay();
  const A = S.frames[i], B = S.frames[j], bA = ppState(A), bB = ppState(B), ids = lyrParts(rid).map(p => p.id);
  const pp = { ...(B.pp || {}) }; for (const id of ids) { if (A.pp && A.pp[id]) pp[id] = ppClone(A.pp[id]); else delete pp[id]; }
  B.pp = pp; ppLayerSetKey(B, rid, true); ppLayerSetKey(A, rid, false);
  pushEntry({ multi: [ppEntry(A, bA, ppState(A)), ppEntry(B, bB, ppState(B))] });
  markEdited(A); markEdited(B); ppRetween();
  lyrSelect(rid); await selectFrame(j); ppSyncBar(); updateFrameUI(); requestRender(); lgSync(true);
  toast(`↔ Đã dời keyframe từ frame ${i + 1} sang frame ${j + 1}`, 2000);
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
  // the layer rows take over from the frame pictures (like Animate's timeline): opening them folds the picture strip away
  // to give the drawing room, closing brings it back if it was folded here
  $('#lgBtn').addEventListener('click', () => {
    S.lgOpen = !S.lgOpen; saveSettings();
    const tlc = $('#tl').classList.contains('collapsed');
    if (S.lgOpen && !tlc) { $('#tlCollapse').click(); LG.foldedTl = true; toast('Đã thu dòng hình frame cho khung vẽ rộng hơn — bấm ▴ Hiện dòng frame để mở lại', 2600); }
    else if (!S.lgOpen && LG.foldedTl) { if (tlc) $('#tlCollapse').click(); LG.foldedTl = false; }
    lgSync(true); refitSoon();
  });
  $('#lgSplit').addEventListener('click', () => lgSetKey(true));
  $('#lgJoin').addEventListener('click', () => lgSetKey(false));
  $('#lgAdd').addEventListener('click', lgAddFrame);
  $('#lgAddSec').addEventListener('click', lgAddSecond);
  $('#lgBgNew').addEventListener('click', lgBgNewFrom);
  $('#lgEase').addEventListener('change', e => lgSetEase(e.target.value));
  $('#lgOnion').addEventListener('click', () => {
    const on = !(S.onion && S.onionLayer); S.onionLayer = on; if (on) S.onion = true;
    if (!lgSelRoot() || S.tool !== 'puppet') { const r = lyrOrder()[0]; if (r) lyrSelect(r.id); }
    tintCache.clear(); updateToggles(); saveSettings(); requestRender(); lgSync(true);
    toast(on ? '🧅 Onion chỉ hiện layer đang chọn ở frame trước/sau' : '🧅 Onion hiện cả frame như cũ', 2000);
  });
  $('#lgOff').addEventListener('click', () => ppOffToggle(lgSelRoot()));
  $('#lgShow').addEventListener('click', () => ppShowAsk(lgSelRoot()));
  $('#lgCopy').addEventListener('click', lgCopy); $('#lgPaste').addEventListener('click', lgPaste);
  $('#lgDel').addEventListener('click', () => delFrame());
  $('#lgNames').addEventListener('click', e => { const r = e.target.closest('[data-lgr]'); if (r) lgPick(S.cur, r.dataset.lgr); });
  // cells: tap = go to that frame + pick that layer; drag a ● along its row = move that keyframe (retime the move);
  // drag anywhere else = scroll the cells sideways (the canvas takes all touches so a drag never turns into a page scroll)
  const cv = $('#lgCv'), sc = $('#lgScroll');
  const cell = e => { const b = cv.getBoundingClientRect(); return { i: clamp(Math.floor((e.clientX - b.left) / LG.cw), 0, S.frames.length - 1), ri: Math.floor((e.clientY - b.top - LG.hd) / LG.rh) }; };
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const c = cell(e), r = lgRows()[c.ri], key = !!(r && r.pp && S.pp && ppLayerKey(S.frames[c.i], r.id));
    LG.drag = { id: e.pointerId, x0: e.clientX, s0: sc.scrollLeft, i: c.i, j: c.i, ri: c.ri, rid: r && r.id, key, moved: false, bg: r && r.bg ? lgBgSpanAt(c.i) : null, tx: null };
    if (r && r.tx) {
      // grab inside a bar: its first cell moves the start, the rest moves the end; one cell past an end grabs that end too
      const sps = lgTxSpans(r.tx), sp = sps.find(s => s.a <= c.i && c.i <= s.b) || sps.find(s => s.b === c.i - 1) || sps.find(s => s.a === c.i + 1);
      if (sp) { LG.drag.tx = sp; LG.drag.side = c.i < sp.a || (c.i === sp.a && sp.a !== sp.b) ? 'a' : 'b'; LG.drag.i = c.i < sp.a ? sp.a : c.i > sp.b ? sp.b : c.i; LG.drag.j = LG.drag.i; }
    }
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', e => {
    const d = LG.drag; if (!d || d.id !== e.pointerId) return;
    if (Math.abs(e.clientX - d.x0) > 6) d.moved = true; if (!d.moved) return;
    if (d.key || d.bg || d.tx) { const j = cell(e).i; if (j !== d.j) { d.j = j; lgDraw(lgRows(), lgSelRoot()); } }
    else sc.scrollLeft = d.s0 - (e.clientX - d.x0);
  });
  const up = e => {
    const d = LG.drag; if (!d || d.id !== e.pointerId) return; LG.drag = null;
    if (e.type === 'pointercancel') { lgSync(true); return; }
    if (!d.moved) { const rows = lgRows(); if (d.ri < 0) lgPick(d.i, null); else if (rows[d.ri]) lgPick(d.i, rows[d.ri].id); return; }
    if (d.bg) { lgBgStretch(d.bg, d.bg.b + (d.j - d.i)); return; }
    if (d.tx) { const e0 = d.side === 'b' ? d.tx.b : d.tx.a; lgTxStretch(d.rid.slice(3), d.tx, d.side, e0 + (d.j - d.i)); return; }
    if (d.key && d.j !== d.i) lgMoveKey(d.rid, d.i, d.j); else lgSync(true);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
lgWire();
