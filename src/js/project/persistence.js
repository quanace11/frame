/* ========= Persistence (IndexedDB) ========= */
let dbp = null, saveT = null, saving = false, saveAgain = false, storageOk = true;
function idbOpen() {
  if (!dbp) dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open('frame-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
  return dbp;
}
async function idbPut(k, v) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }
async function idbGet(k) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readonly'); const r = tx.objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function setSaveState(t) { const el = $('#saveState'); el.textContent = t || (storageOk ? '✓ Đã lưu' : '⚠ Chưa lưu được'); el.title = storageOk ? 'Bài được tự lưu trên máy này' : 'Chưa lưu được, app sẽ thử lại. Nên Xuất ZIP để giữ bài'; }
// Big data (frame PNGs, audio, background video) lives in its own keys "blob:<project>:<name>" and is only
// rewritten when it changed. The project record keeps { ref: key } in its place, so an autosave after a
// stroke writes one PNG + a small JSON record instead of the whole project.
let savedBlobs = new Map(), savedBlobsProj = null, saveFails = 0, saveRetryT = null, saveWarned = false;
const blobPrefix = id => 'blob:' + id + ':';
const blobRange = id => IDBKeyRange.bound(blobPrefix(id), blobPrefix(id) + '￿');
function scheduleSave() { histSoon(); clearTimeout(saveT); $('#saveState').textContent = 'Chưa lưu…'; saveT = setTimeout(autoSave, 1500); }
function autoSave() { if (stroke || playing) { saveT = setTimeout(autoSave, 1500); return; } saveT = null; saveProject(); }
async function idbBlobPut(rec, recKey, blobs, pid, gc) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
    for (const [k, v] of blobs) st.put(v, k);
    st.put(rec, recKey);
    if (gc) { const r = st.getAllKeys(blobRange(pid)); r.onsuccess = () => { for (const k of r.result) if (!gc.has(k)) { st.delete(k); savedBlobs.delete(k); } }; }
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort'));
  });
}
async function resolveRef(v) { if (v && typeof v === 'object' && typeof v.ref === 'string') { if (savedBlobs.has(v.ref)) return savedBlobs.get(v.ref); const b = await idbGet(v.ref); if (b) savedBlobs.set(v.ref, b); return b || null; } return v; }
async function resolveProjectRefs(p, pid) {
  savedBlobs = new Map(); savedBlobsProj = pid;
  for (const b of p.bgs || []) b.png = await resolveRef(b.png);
  for (const f of p.frames || []) { f.png = await resolveRef(f.png); f.col = await resolveRef(f.col); }
  if (p.audio) { for (const k of ['music', 'voice']) if (p.audio[k]) p.audio[k].buf = await resolveRef(p.audio[k].buf); for (const v of [...(p.audio.voices || []), ...(p.audio.musics || [])]) v.buf = await resolveRef(v.buf); }
  if (p.bgVideo) { p.bgVideo.buf = await resolveRef(p.bgVideo.buf); for (const v of p.bgVideo.srcs || []) v.buf = await resolveRef(v.buf); }
  return p;
}
async function copyProjectBlobs(fromId, toId, rec) {
  const db = await idbOpen();
  const keys = await new Promise((res, rej) => { const r = db.transaction('kv', 'readonly').objectStore('kv').getAllKeys(blobRange(fromId)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  for (const k of keys) { const v = await idbGet(k); await idbPut(blobPrefix(toId) + k.slice(blobPrefix(fromId).length), v); }
  const fix = o => { if (!o || typeof o !== 'object') return; if (typeof o.ref === 'string' && o.ref.startsWith(blobPrefix(fromId))) o.ref = blobPrefix(toId) + o.ref.slice(blobPrefix(fromId).length); else for (const k in o) if (k !== 'buf' || !(o[k] instanceof ArrayBuffer)) fix(o[k]); };
  fix(rec); return rec;
}
async function deleteProjectBlobs(id) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(blobRange(id)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function saveProject() {
  if (saving) { saveAgain = true; return; }
  saving = true; clearTimeout(saveRetryT); $('#saveState').textContent = 'Đang lưu…';
  try {
    for (const o of [...S.bgs, ...S.frames]) await ensurePng(o);
    if (!curProjId) setCurProj(newId());
    const pid = curProjId;
    if (savedBlobsProj !== pid) { savedBlobs = new Map(); savedBlobsProj = pid; }
    const dirty = [], live = new Set();
    const ref = (name, buf) => { if (!buf) return null; const k = blobPrefix(pid) + name; live.add(k); if (savedBlobs.get(k) !== buf) dirty.push([k, buf]); return { ref: k }; };
    // pieces cut from the same file share one stored blob (named after the first clip that uses it)
    const A = S.audio, bufName = new Map(), aref = (name, buf) => { if (!buf) return null; if (!bufName.has(buf)) bufName.set(buf, name); return ref(bufName.get(buf), buf); };
    const slim = a => a ? { ...a, buf: aref('m:' + (a === A.music ? 'music' : 'voice'), a.buf) } : null;
    const data = {
      v: 2, W, H, cur: S.cur,
      bgs: S.bgs.map(b => ({ id: b.id, png: ref('b:' + b.id, b.png) })),
      name: S.projName || 'Dự án', poses: S.poses || [],
      frames: S.frames.map(f => ({ id: f.id, dur: f.dur, bgId: f.bgId, png: ref('f:' + f.id, f.png), col: ref('c:' + f.id, f.colPng), vec: f.vec, pp: f.pp || {}, ppKey: f.ppKey, ppEase: f.ppEase, texts: f.texts || [], cam: f.cam || null, shake: f.shake || 0, flash: !!f.flash, lip: f.lip || null, scene: f.scene || null, tr: f.tr || null, tre: f.tre || null, ghost: f.ghost || null, bgs: f.bgs || null, sl: f.sl || null, flt: f.flt || null })),
      audio: A ? { ...A, music: slim(A.music), musics: (A.musics || []).map((v, k) => ({ ...v, buf: aref('m:mu' + (v.id || k), v.buf) })), voice: slim(A.voice), voices: (A.voices || []).map((v, k) => ({ ...v, buf: aref('m:v' + (v.id || k), v.buf) })) } : null,
      bgVideo: S.bgVideo ? { ...S.bgVideo, buf: ref('m:video', S.bgVideo.buf), srcs: S.bgVideo.srcs ? S.bgVideo.srcs.map(v => ({ ...v, buf: ref('m:vs' + v.id, v.buf) })) : undefined } : null,
      pp: S.pp ? { parts: S.pp.parts.map(p => ({ ...ppPartMeta(p), png: p.png, alts: (p.alts || []).map(a => ({ png: a.png, dx: a.dx || 0, dy: a.dy || 0 })) })) } : null,
      rig: S.rig || null,
      ref: REF.c && REF.png ? { png: REF.png, cx: REF.cx, cy: REF.cy, scale: REF.scale, rot: REF.rot, opacity: REF.opacity, show: REF.show } : null
    };
    await idbBlobPut(data, 'project:' + pid, dirty, pid, live);
    for (const [k, v] of dirty) savedBlobs.set(k, v);
    try {
      const L = await projIndex(), th = S.frames[0] && S.frames[0].thumb ? S.frames[0].thumb.toDataURL('image/jpeg', 0.7) : '';
      const it = L.find(x => x.id === pid), rec = { id: pid, name: data.name, updated: Date.now(), frames: S.frames.length, thumb: th };
      if (it) Object.assign(it, rec); else L.push(rec); await idbPut('projects', L);
    } catch (e) { console.error(e); }
    storageOk = true; saveFails = 0; saveWarned = false; setSaveState(); syncSoon(SYNC_AFTER_SAVE);
  } catch (e) {
    // never give up for good: a full disk or a busy tab can recover, so retry with a growing delay
    console.error(e); storageOk = false; setSaveState();
    saveFails++; clearTimeout(saveRetryT); saveRetryT = setTimeout(saveProject, Math.min(60000, 3000 * 2 ** (saveFails - 1)));
    if (!saveWarned) { saveWarned = true; toast('⚠ Chưa lưu được vào máy (có thể máy hết dung lượng). App sẽ tự thử lại — nên Xuất ZIP để giữ bài.', 5000); }
  }
  saving = false;
  if (saveAgain) { saveAgain = false; saveProject(); }
}
async function loadProjectData(p) {
  W = p.W; H = p.H; setupWorkCanvases();
  S.bgs = p.bgs.map(b => ({ kind: 'bg', id: b.id, ver: 0, png: b.png || null, pngVer: 0, canvas: null }));
  S.frames = p.frames.map(f => ({ kind: 'char', id: f.id, dur: f.dur, bgId: f.bgId, ver: 0, png: f.png || null, pngVer: 0, canvas: null, col: null, colPng: f.col || null, colVer: 0, colPngVer: 0, thumb: null, play: null, playKey: '', vec: f.vec || [], pp: f.pp || {}, ppKey: f.ppKey, ppEase: f.ppEase, texts: f.texts || [], cam: f.cam || null, shake: f.shake || 0, flash: !!f.flash, lip: f.lip || null, scene: f.scene || undefined, tr: f.tr || undefined, tre: f.tre || undefined, ghost: f.ghost || undefined, bgs: f.bgs || undefined, sl: f.sl || undefined, flt: f.flt || undefined }));
  S.audio = p.audio || null; S.bgVideo = p.bgVideo || null; bgVideoSetup();
  S.projName = p.name || S.projName || 'Dự án'; S.poses = p.poses || [];
  loaded.length = 0; loadedBg.length = 0; undoStack.length = 0; redoStack.length = 0; undoBytes = 0;
  if (S.bgs.length <= MAX_BG) for (const b of S.bgs) await ensureLoaded(b);   // more (e.g. video frames): loaded when shown
  for (const f of S.frames) if (!S.bgs.find(b => b.id === f.bgId)) { const b = newBgObj(); S.bgs.push(b); f.bgId = b.id; }
  S.cur = clamp(p.cur || 0, 0, S.frames.length - 1);
  S.rig = p.rig || null;
  S.pp = null; ppSetup = null; ppSel = null;
  if (p.pp && p.pp.parts) {
    const parts = [];
    const dec = async png => { const bmp = await decodePng(png); const c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close(); return c; };
    for (const q of p.pp.parts) { try { const c = await dec(q.png); const alts = []; for (const a of (q.alts || [])) { try { alts.push({ c: await dec(a.png), png: a.png, dx: a.dx, dy: a.dy }); } catch (e) {} } parts.push({ ...q, c, alts }); } catch (e) { console.error(e); } }
    S.pp = { parts };
  }
  clearRef(true);
  if (p.ref && p.ref.png) {
    try {
      const bmp = await decodePng(p.ref.png); const c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
      Object.assign(REF, { c, png: p.ref.png, cx: p.ref.cx, cy: p.ref.cy, scale: p.ref.scale, rot: p.ref.rot, opacity: p.ref.opacity, show: p.ref.show !== false });
    } catch (e) { console.error(e); }
  }
  updateRefUI();
  resizeView();
  await ensureLoaded(curFrame());
  for (const f of S.frames) await drawThumb(f);
  buildStrip(); await selectFrame(S.cur); updUndoBtns(); histReset();
}
function newProject(w, h) {
  W = w; H = h; setupWorkCanvases();
  S.frames.forEach(freeFrame);
  S.bgs.forEach(b => { if (b.canvas) b.canvas.width = 0; });
  loaded.length = 0; undoStack.length = 0; redoStack.length = 0; undoBytes = 0;
  const b = newBgObj(); S.bgs = [b];
  const f = newFrameObj(b.id); S.frames = [f]; loaded.push(f);
  clearRef(true); updateRefUI(); S.rig = null; S.pp = null; ppSetup = null; ppSel = null; S.audio = null; S.bgVideo = null; bgVideoSetup();
  S.cur = 0; setLayer(S.lineLayer === 'vec' ? 'vec' : 'char'); resizeView(); drawThumb(f); buildStrip(); updUndoBtns(); requestRender(); scheduleSave(); histReset();
}

