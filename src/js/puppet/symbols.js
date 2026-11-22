/* ===== ⭐ Symbol: a reusable piece of motion of one layer (like a symbol / motion preset in Adobe Animate) =====
   ⭐ Lưu symbol (Dòng layer) keeps the keyframes of the picked layer between 2 frames: the pose of every part at each key,
   the root's move relative to where it starts, and each span's ease. 🎬 Thả symbol plays it on the picked layer from the
   frame being viewed: that layer gets those keyframes (moved to start where it stands now), other layers keep their own
   keys, and frames are added at the end when the film is too short. Parts are matched by id (same layer), then root → root,
   then body role (head, arms…), then their order in the layer — so it works for a picture layer and for a cut-out character.
   Kept in localStorage 'fs-symbols' (small JSON), shared by every project on this device. */
const SYM_KEY = 'fs-symbols';
function symLoad() { try { return JSON.parse(localStorage.getItem(SYM_KEY) || '[]'); } catch (e) { return []; } }
function symStore(L) { try { localStorage.setItem(SYM_KEY, JSON.stringify(L)); return true; } catch (e) { toast('Không lưu được (bộ nhớ trình duyệt đầy?)'); return false; } }
// capture frames a..b of layer rid
function symCapture(rid, a, b, name) {
  const parts = lyrParts(rid), keys = [a];
  for (let i = a + 1; i < b; i++) if (ppLayerKey(S.frames[i], rid)) keys.push(i);
  if (b > a) keys.push(b);
  const r0 = (S.frames[a].pp && S.frames[a].pp[rid]) || {};
  return {
    id: newId(), name, n: b - a + 1, src: rid, roles: parts.map(p => p.role || ''),
    keys: keys.map(i => {
      const f = S.frames[i];
      return { i: i - a, e: ppLayerEase(f, rid), parts: parts.map((p, idx) => {
        const q = f.pp && f.pp[p.id] ? ppClone(f.pp[p.id]) : null;
        if (q && p.id === rid) { q.dx = (q.dx || 0) - (r0.dx || 0); q.dy = (q.dy || 0) - (r0.dy || 0); }
        return { id: p.id, idx, role: p.role || '', root: p.id === rid, q };
      }) };
    })
  };
}
function symTarget(o, rid, parts, same) {
  if (same && parts.some(p => p.id === o.id)) return o.id;
  if (o.root) return rid;
  if (o.role) { const p = parts.find(x => x.role === o.role && x.id !== rid); if (p) return p.id; }
  const p = parts[o.idx]; return p && p.id !== rid ? p.id : null;
}
async function symSave() {
  const rid = lgSelRoot(); if (!rid || !S.pp) { toast('Chạm chọn 1 layer nhân vật/ảnh trước'); return; }
  const keys = []; S.frames.forEach((f, i) => { if (ppLayerKey(f, rid)) keys.push(i); });
  let a = S.cur; for (let k = S.cur; k >= 0; k--) if (ppLayerKey(S.frames[k], rid)) { a = k; break; }
  const b0 = keys.filter(i => i > a).pop(), b = b0 == null ? Math.min(S.frames.length - 1, a + 1) : b0;
  if (S.frames.length < 2) { toast('Cần ít nhất 2 frame có chuyển động'); return; }
  let out = null;
  await modal({ title: '⭐ Lưu symbol', html: `<p class="lbl">Lưu chuyển động của <b>${lyrName(ppPart(rid)).replace(/</g, '&lt;')}</b> để thả lại cho layer khác, ở frame khác hoặc dự án khác.</p>
<input id="symName" placeholder="vd. Vẫy tay, Nhảy lên" style="width:100%;margin:6px 0" maxlength="40">
<div class="set-row"><span>Từ frame</span><input id="symA" type="number" min="1" max="${S.frames.length}" value="${a + 1}" style="width:80px"></div>
<div class="set-row"><span>Tới frame</span><input id="symB" type="number" min="1" max="${S.frames.length}" value="${b + 1}" style="width:80px"></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => {
      const A = clamp((+document.getElementById('symA').value || 1) - 1, 0, S.frames.length - 1), B = clamp((+document.getElementById('symB').value || 1) - 1, 0, S.frames.length - 1);
      if (B <= A) { toast('"Tới frame" phải sau "Từ frame"'); return false; }
      out = { A, B, name: document.getElementById('symName').value.trim() || 'Symbol ' + (symLoad().length + 1) };
    } }] });
  if (!out) return;
  const sym = symCapture(rid, out.A, out.B, out.name.slice(0, 40)), L = symLoad(); L.push(sym);
  if (symStore(L)) toast(`⭐ Đã lưu symbol "${sym.name}" (${sym.n} frame) — chọn layer khác rồi bấm 🎬 Thả symbol`, 3500);
}
// play symbol sym on layer rid from frame at
async function symApply(sym, rid, at) {
  if (!sym || !rid || !S.pp) return;
  if (playing) stopPlay(); commitFloating();
  const need = at + sym.n - S.frames.length;
  if (need > 0) {   // the film is too short: add frames at the end that hold the last frame (other layers keep still there)
    const src = S.frames[S.frames.length - 1]; await ensureLoaded(src);
    const added = []; for (let k = 0; k < need; k++) { const f = frameCopyOf(src, true); f.ppKey = false; delete f.ppK; delete f.ppE; added.push(f); loaded.push(f); }
    await insertFrames(S.frames.length, added); buildStrip(); evictSoon();
  }
  const parts = lyrParts(rid), same = sym.src === rid, f0 = S.frames[at], base = (f0.pp && f0.pp[rid]) || {}, keyAt = new Map(sym.keys.map(k => [k.i, k]));
  const ents = [];
  for (let i = 0; i < sym.n; i++) {
    const g = S.frames[at + i], before = ppState(g), k = keyAt.get(i);
    if (k) {
      const pp = { ...(g.pp || {}) };
      for (const o of k.parts) {
        const t = symTarget(o, rid, parts, same); if (!t) continue;
        if (!o.q) { delete pp[t]; continue; }
        const q = ppClone(o.q); if (o.root) { q.dx = (base.dx || 0) + (q.dx || 0); q.dy = (base.dy || 0) + (q.dy || 0); }
        pp[t] = q;
      }
      g.pp = pp; ppLayerSetKey(g, rid, true); ppLayerSetEase(g, rid, k.e || 'inout');
    } else ppLayerSetKey(g, rid, false);
    ents.push(ppEntry(g, before, ppState(g))); markEdited(g);
  }
  pushEntry({ multi: ents }); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); lgSync(true);
  toast(`🎬 Đã thả "${sym.name}" lên ${lyrName(ppPart(rid))}: frame ${at + 1} → ${at + sym.n}${need > 0 ? ` (thêm ${need} frame)` : ''}`, 3500);
}
function symDialog() {
  const rid = lgSelRoot(); if (!rid || !S.pp) { toast('Chạm chọn 1 layer nhân vật/ảnh để thả symbol lên'); return; }
  const esc = s => String(s).replace(/[<>&"]/g, '');
  const rows = () => { const L = symLoad(); return L.length ? L.map(m => `<div class="set-row symRow"><span><b>${esc(m.name)}</b> <span class="lbl">${m.n} frame · ${m.keys.length} keyframe</span></span><span class="grp"><button class="chip small on" data-symgo="${m.id}">🎬 Thả</button><button class="chip small" data-symdel="${m.id}">🗑</button></span></div>`).join('')
    : '<p class="lbl">Chưa có symbol nào. Làm chuyển động cho 1 layer trên Dòng layer rồi bấm ⭐ Lưu symbol.</p>'; };
  modal({ title: '🎬 Thả symbol', html: `<p class="lbl">Thả lên <b>${esc(lyrName(ppPart(rid)))}</b> bắt đầu từ frame ${S.cur + 1}. Layer khác giữ nguyên.</p><div id="symList">${rows()}</div>`,
    buttons: [{ label: 'Đóng', value: null }], onOpen: (ov, close) => {
      ov.addEventListener('click', e => {
        const go = e.target.closest('[data-symgo]'), del = e.target.closest('[data-symdel]');
        if (go) { const m = symLoad().find(x => x.id === go.dataset.symgo); close(null); symApply(m, rid, S.cur); }
        if (del) { const L = symLoad().filter(x => x.id !== del.dataset.symdel); symStore(L); ov.querySelector('#symList').innerHTML = rows(); }
      });
    } });
}
$('#lgSymSave').addEventListener('click', symSave);
$('#lgSymPut').addEventListener('click', symDialog);
