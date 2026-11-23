/* ========= Undo ========= */
const undoStack = [], redoStack = [];
// deep history: up to 400 steps; memory cap depends on the device (pixel steps only store the changed rectangle)
const UNDO_MAX = 400, UNDO_BYTES = (navigator.deviceMemory || 4) >= 8 ? 450e6 : (navigator.deviceMemory || 4) >= 4 ? 280e6 : 160e6;
let undoBytes = 0;
function vecBytes(v) { let n = 0; for (const st of v) n += st.pts.length * 24 + 64; return n; }
function pushEntry(e) {
  if (!histPushing && histT && !histCovered && histBase && !histLight(e)) { clearTimeout(histT); histCheck(true); }   // a light change made just before this pixel / line step becomes its own step first
  e.bytes = e.bytes != null && !e.multi ? e.bytes : e.add ? 0 : e.ppose ? 200 : e.multi ? e.multi.reduce((a, x) => a + (x.bytes || 0), 0) : e.vec ? vecBytes(e.before) + vecBytes(e.after) : e.before.data.length + e.after.data.length;
  undoStack.push(e); undoBytes += e.bytes;
  for (const x of redoStack) undoBytes -= x.bytes; redoStack.length = 0;
  while (undoStack.length > 1 && (undoStack.length > UNDO_MAX || undoBytes > UNDO_BYTES)) undoBytes -= undoStack.shift().bytes;
  if (!histPushing) histCover(e);
  updUndoBtns();
}
function pixEntry(o, rect, before, after, col) { const e = { t: targetOf(o), rect, before, after }; if (col) e.col = true; e.bytes = before.data.length + after.data.length; return e; }
function vecEntry(f, before, after) { const e = { t: targetOf(f), vec: true, before, after }; e.bytes = vecBytes(before) + vecBytes(after); return e; }
function pushUndo(o, rect, before, after) { pushEntry(pixEntry(o, rect, before, after)); }
function pushVecUndo(f, before) { pushEntry(vecEntry(f, before, cloneVec(f.vec))); }
function updUndoBtns() { $('#undoBtn').disabled = !undoStack.length && !floating; $('#redoBtn').disabled = !redoStack.length; }
async function applyEntry(e, key) {
  if (e.fdel) { mselApplyDel(e.fdel, key === 'after'); return null; }
  if (e.ford) { const by = new Map(S.frames.map(f => [f.id, f])); const ids = e.ford[key]; if (ids.length === S.frames.length && ids.every(id => by.has(id))) S.frames = ids.map(id => by.get(id)); tintCache.clear(); ppRetween(); buildStrip(); scheduleSave(); return null; }
  if (e.add) {
    const f0 = objByTarget(e.t), A = e.add;
    if (key === 'before') {
      const ids = new Set(A.frames.map(f => f.id));
      S.frames = S.frames.filter(f => !ids.has(f.id));
      for (const f of A.frames) { const li = loaded.indexOf(f); if (li >= 0) loaded.splice(li, 1); }
      if (f0) f0.dur = A.dur0;
    } else {
      const at = f0 ? S.frames.indexOf(f0) + 1 : Math.min(A.index, S.frames.length);
      S.frames.splice(at, 0, ...A.frames); for (const f of A.frames) if (f.canvas) loaded.push(f);
      if (f0) f0.dur = A.dur1;
    }
    S.cur = clamp(f0 ? S.frames.indexOf(f0) : S.cur, 0, S.frames.length - 1);
    tintCache.clear(); ppRetween(); buildStrip(); scheduleSave(); evictSoon();
    return f0;
  }
  if (e.del) {
    const D = e.del;
    if (key === 'before') {
      if (D.bg && !S.bgs.includes(D.bg)) { S.bgs.push(D.bg); await ensureLoaded(D.bg); }
      S.frames.splice(Math.min(D.index, S.frames.length), 0, D.f); S.cur = S.frames.indexOf(D.f);
    } else {
      const i = S.frames.indexOf(D.f); if (i < 0 || S.frames.length < 2) return null;
      await removeFrameAt(i); S.cur = Math.min(i, S.frames.length - 1);
    }
    tintCache.clear(); ppRetween(); buildStrip(); await selectFrame(S.cur); scheduleSave();
    return null;
  }
  if (e.snap) { await histApply(e.snap, key); return null; }
  if (e.sfxadd) {
    S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || [];
    const ids = new Set(e.sfxadd.map(x => x.id)); S.audio.sfx = S.audio.sfx.filter(x => !ids.has(x.id));
    if (key === 'after') S.audio.sfx.push(...e.sfxadd);
    fxSyncBar(); updateWaves(); scheduleSave(); return null;
  }
  if (e.wipe) { await wipeSwap(e.wipe[key === 'before' ? 'old' : 'neu'], e.wipe[key === 'before' ? 'neu' : 'old']); return null; }
  if (e.multi) { let o = null; const list = key === 'before' ? [...e.multi].reverse() : e.multi; for (const x of list) o = (await applyEntry(x, key)) || o; return o; }
  if (e.partpix) { ppPaintApply(e, key); return null; }
  const o = objByTarget(e.t); if (!o) return null;
  if (e.fxe) { fxSetState(o, e[key]); o.ver++; fxSyncBar(); requestRender(); return o; }
  if (e.lipe) { o.lip = e[key] ? JSON.parse(e[key]) : null; o.ver++; queueThumbFor(o); scheduleSave(); requestRender(); if (typeof ppBlinkInfo === 'function') ppBlinkInfo(); return o; }
  if (e.ppose) { ppSetState(o, e[key]); markEdited(o); ppRetween(); ppSyncBar(); updateFrameUI(); return o; }
  if (e.vec) { o.vec = cloneVec(e[key]); vsel.clear(); updVecBar(); }
  else { await ensureLoaded(o); const cv = e.col ? colOf(o, true) : o.canvas; if (e.col) o.colVer++; cv.getContext('2d').putImageData(e[key], e.rect[0], e.rect[1]); }
  markEdited(o); return o;
}
const entryAlive = e => e.partpix ? !!ppPart(e.pid) : e.add || e.fdel || e.ford || e.del || e.wipe || e.sfxadd || e.snap ? true : e.multi ? e.multi.some(entryAlive) : !!objByTarget(e.t);
async function applyHistory(from, to, key) {
  if (stroke || action) return;
  if (ppSetup && ppSetup.stage === 'paint') { ppLabHistory(key === 'before'); return; }
  if (floating) { cancelFloating(); updUndoBtns(); return; }
  histFlush();
  let e;
  while ((e = from.pop())) { if (entryAlive(e)) break; undoBytes -= e.bytes; }
  if (!e) { toast(key === 'before' ? 'Không còn gì để hoàn tác' : 'Không còn gì để làm lại'); updUndoBtns(); return; }
  const o = await applyEntry(e, key);
  to.push(e); histRebase();
  if (o && o.kind === 'char' && o !== curFrame()) await selectFrame(S.frames.indexOf(o));
  else if (o && o.kind === 'bg' && bgOf(curFrame()) !== o) { const i = S.frames.findIndex(f => f.bgId === o.id); if (i >= 0) await selectFrame(i); }
  toast(key === 'before' ? 'Hoàn tác' : 'Làm lại', 700);
  updUndoBtns(); requestRender();
}
const undo = () => applyHistory(undoStack, redoStack, 'before');
const redo = () => applyHistory(redoStack, undoStack, 'after');

/* ===== Undo for everything else (automatic) =====
   Every change that is saved calls scheduleSave(). Shortly after, the light project state (frame timing/order, backgrounds,
   puppet parts, poses, keyframes, text/camera/effects, sounds, rig, tracing image, video background…) is compared with
   the last known state. If it changed and no dedicated undo step was pushed for it, one "snapshot" step is pushed.
   Pixels and vector lines keep their own (cheaper) undo steps; this only stores the light state + object references. */
let histBase = null, histCovered = false, histPushing = false, histT = null;
const histTok = new WeakMap(); let histTokN = 0;
const histId = o => { if (!histTok.has(o)) histTok.set(o, ++histTokN); return '#' + histTok.get(o); };
const histBig = x => x && typeof x === 'object' && (x instanceof ArrayBuffer || ArrayBuffer.isView(x) || typeof x.getContext === 'function' || (typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap) || (typeof ImageData !== 'undefined' && x instanceof ImageData));
const histJSON = v => JSON.stringify(v, (k, x) => histBig(x) ? histId(x) : x);
const H_FKEYS = ['dur', 'bgId', 'pp', 'ppKey', 'ppK', 'ppE', 'ppEase', 'texts', 'cam', 'shake', 'flash', 'lip', 'scene', 'tr', 'tre', 'ghost', 'bgs', 'sl', 'flt'];
const histFrameStr = f => JSON.stringify(H_FKEYS.map(k => f[k] === undefined ? null : f[k]));
const histPartCopy = p => ({ ...p, alts: (p.alts || []).map(a => ({ ...a })) });
const audioCopy = A => A ? { ...A, music: A.music ? { ...A.music } : A.music, musics: (A.musics || []).map(x => ({ ...x })), voice: A.voice ? { ...A.voice } : A.voice, voices: (A.voices || []).map(x => ({ ...x })), sfx: (A.sfx || []).map(x => ({ ...x })) } : null;
function histSnap() {
  const A = S.audio;
  const g = {
    frames: S.frames.slice(), bgs: S.bgs.slice(), cur: S.cur,
    pp: S.pp ? { parts: S.pp.parts.slice(), meta: S.pp.parts.map(histPartCopy) } : null,
    rig: S.rig ? JSON.stringify(S.rig) : null,
    audio: audioCopy(A),
    bgVideo: vidCopy(S.bgVideo), ref: { ...REF }, poses: (S.poses || []).slice()
  };
  g.sig = histJSON([g.frames.map(f => f.id), g.bgs.map(b => b.id), g.pp && g.pp.meta, g.rig, g.audio, g.bgVideo, g.ref, g.poses]);
  g.fm = new Map(g.frames.map(f => [f, histFrameStr(f)]));
  return g;
}
function histRebase() { clearTimeout(histT); histT = null; histBase = histSnap(); histCovered = false; }
const histReset = histRebase;
function histSoon() { clearTimeout(histT); histT = setTimeout(histCheck, 400); }
// long jobs (progress window, a drag, a pending stroke) finish first, so one action = one step
const histBusy = () => !!(stroke || action || atlDrag || document.querySelector('.ov'));
function histCheck(force) {
  histT = null;
  if (!histBase) { histRebase(); return; }
  if (!force && histBusy()) { histT = setTimeout(histCheck, 400); return; }
  const now = histSnap();
  if (histCovered) { histBase = now; histCovered = false; return; }
  const fr = [];
  for (const [f, a] of now.fm) { const b = histBase.fm.get(f); if (b !== undefined && b !== a) fr.push([f, b, a]); }
  if (now.sig !== histBase.sig || fr.length) {
    let bytes = 2000; for (const [, b, a] of fr) bytes += b.length + a.length;
    histPushing = true; pushEntry({ snap: { before: histBase, after: now, fr }, bytes }); histPushing = false;
  }
  histBase = now;
}
// A dedicated undo step was pushed: its own light changes (frames added…) must not become a 2nd step, so they are "covered" —
// but only for a moment. Before, the cover lasted until the next check (400 ms after the LAST save), so a quick next action
// (draw a line, then tap Nhân bản frame / + giữ khung right away) was swallowed: it could not be undone and undo reverted the line instead.
const histLight = e => !!(e.add || e.del || e.ford || e.fdel || e.wipe || e.snap || e.sfxadd || e.ppose || e.fxe || e.lipe || e.partpix || (e.multi && e.multi.some(histLight)));
let histCoverT = null;
function histCover(e) {
  histCovered = true; clearTimeout(histCoverT); histCoverT = setTimeout(histCoverEnd, 150);
}
function histCoverEnd() {
  histCoverT = null; if (!histCovered) return;
  if (histBusy()) { histCoverT = setTimeout(histCoverEnd, 150); return; }
  histBase = histSnap(); histCovered = false;
}
// record a pending change right away (before undo/redo runs)
function histFlush() { if (!histT) return; clearTimeout(histT); histT = null; if (!stroke && !action) histCheck(); }
async function histApply(sn, key) {
  const G = sn[key], beforeKey = key === 'before';
  if (playing) stopPlay(); commitFloating(); motionClose(); rigClose();
  const vidChanged = !!(S.bgVideo && S.bgVideo.track) || !!(G.bgVideo && G.bgVideo.track) || (S.bgVideo && S.bgVideo.buf) !== (G.bgVideo && G.bgVideo.buf);
  S.frames = G.frames.slice(); S.bgs = G.bgs.slice();
  for (let i = loaded.length - 1; i >= 0; i--) if (!S.frames.includes(loaded[i])) loaded.splice(i, 1);
  for (const f of S.frames) if (f.canvas && !loaded.includes(f)) loaded.push(f);
  for (const b of S.bgs) if (b.canvas && !b.canvas.width) b.canvas = null;   // loaded again when needed (selectFrame below)
  for (const [f, b, a] of sn.fr) { const v = JSON.parse(beforeKey ? b : a); H_FKEYS.forEach((k, i) => { f[k] = v[i] === null ? undefined : v[i]; }); f.ver++; queueThumbFor(f); }
  const ppWas = histJSON(S.pp && S.pp.parts.map(histPartCopy));
  if (!G.pp) S.pp = null;
  else {
    S.pp = S.pp || { parts: [] }; S.pp.parts = G.pp.parts.slice();
    G.pp.meta.forEach((m, i) => { const p = G.pp.parts[i]; for (const k of Object.keys(p)) if (!(k in m)) delete p[k]; Object.assign(p, histPartCopy(m)); });
  }
  if (ppSel && !ppPart(ppSel)) ppSel = null;
  if (ppWas !== histJSON(S.pp && S.pp.parts.map(histPartCopy))) S.frames.forEach(f => { f.ver++; queueThumbFor(f); });
  S.rig = G.rig ? JSON.parse(G.rig) : null;
  S.audio = audioCopy(G.audio); atlSel = null;
  S.bgVideo = vidCopy(G.bgVideo); if (vidChanged) bgVideoSetup();
  Object.assign(REF, G.ref); updateRefUI();
  S.poses = G.poses.slice();
  S.cur = clamp(S.frames.includes(G.frames[G.cur]) ? S.frames.indexOf(G.frames[G.cur]) : G.cur, 0, S.frames.length - 1);
  tintCache.clear(); buildStrip(); await selectFrame(S.cur); ppSyncBar(); fxSyncBar(); updateWaves(); requestRender(); scheduleSave();
}

