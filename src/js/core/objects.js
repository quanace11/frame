/* ========= Objects (frames + backgrounds), lazy loading ========= */
function newBgObj() { return { kind: 'bg', id: newId(), ver: 0, png: null, pngVer: 0, canvas: makeCanvas() }; }
function newFrameObj(bgId) { return { kind: 'char', id: newId(), dur: Math.round(S.defaultDur * 1000), bgId, ver: 0, png: null, pngVer: 0, canvas: makeCanvas(), col: null, colPng: null, colVer: 0, colPngVer: 0, thumb: null, play: null, playKey: '', vec: [] }; }
const loaded = [];            // LRU of loaded frames
// backgrounds loaded lazily (e.g. one per video frame, see 🎬 Video → frame) are tracked and freed the same way
const loadedBg = [], MAX_BG = 6;
function touchBg(b) { const i = loadedBg.indexOf(b); if (i >= 0) loadedBg.splice(i, 1); loadedBg.push(b); }
const MAX_LOADED = (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 8 : 14;
function touchLRU(f) { const i = loaded.indexOf(f); if (i >= 0) loaded.splice(i, 1); loaded.push(f); }
function toBlob(c) { return new Promise(r => c.toBlob(r, 'image/png')); }
async function ensurePng(o) {
  if (o.canvas && o.pngVer !== o.ver) { const v = o.ver; const b = await toBlob(o.canvas); if (b) { o.png = await b.arrayBuffer(); o.pngVer = v; } }
  if (o.col && o.colPngVer !== o.colVer) { const v = o.colVer; const b = await toBlob(o.col); if (b) { o.colPng = await b.arrayBuffer(); o.colPngVer = v; } }
}
const pngDirty = o => o.pngVer !== o.ver || (o.col && o.colPngVer !== o.colVer);
async function decodePng(buf) { return await createImageBitmap(new Blob([buf], { type: 'image/png' })); }
function ensureLoaded(o) {
  if (o.canvas) { if (o.kind === 'char') touchLRU(o); else if (loadedBg.includes(o)) touchBg(o); return Promise.resolve(o.canvas); }
  if (o.loading) return o.loading;
  // a frame with nothing saved yet (no png, e.g. a 🎬 video frame never drawn on) runs this without any await: it finishes
  // before the assignment below, so `o.loading` must not keep that settled promise — after the frame is freed again it
  // would be returned forever and the frame never got a canvas back (the pen stopped drawing on it until F5)
  const p = (async () => {
    const c = makeCanvas();
    if (o.png) { try { const bmp = await decodePng(o.png); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close(); } catch (e) { console.error(e); } }
    if (o.colPng && !o.col) { try { const bmp = await decodePng(o.colPng), cc = makeCanvas(); cc.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close(); o.col = cc; } catch (e) { console.error(e); } }
    o.canvas = c; o.loading = null;
    if (o.kind === 'char') { touchLRU(o); evictSoon(); } else { touchBg(o); evictSoon(); }
    return c;
  })();
  o.loading = o.canvas ? null : p;
  return p;
}
let evicting = false;
async function evictSoon() {
  if (evicting) return; evicting = true;
  try {
    let guard = 0;
    while (loaded.length > MAX_LOADED && guard++ < 50) {
      const keep = new Set([S.cur - 1, S.cur, S.cur + 1].map(i => S.frames[i]).filter(Boolean));
      const victim = loaded.find(f => !keep.has(f) && !(floating && floating.t.id === f.id) && !(stroke && stroke.t.id === f.id));
      if (!victim) break;
      await ensurePng(victim);
      const keep2 = new Set([S.cur - 1, S.cur, S.cur + 1].map(i => S.frames[i]).filter(Boolean));
      const i = loaded.indexOf(victim);
      if (i < 0) continue;
      if (keep2.has(victim) || pngDirty(victim)) { touchLRU(victim); continue; }
      loaded.splice(i, 1);
      freeFrame(victim); victim.canvas = null;
    }
    const keepB = () => new Set([S.cur - 1, S.cur, S.cur + 1].map(i => S.frames[i]).filter(Boolean).map(f => f.bgId));
    while (loadedBg.length > MAX_BG && guard++ < 120) {
      const victim = loadedBg.find(b => !keepB().has(b.id) && !(stroke && stroke.t.id === b.id));
      if (!victim) break;
      await ensurePng(victim);
      const i = loadedBg.indexOf(victim);
      if (i < 0) continue;
      if (!victim.canvas) { loadedBg.splice(i, 1); continue; }
      if (keepB().has(victim.id) || pngDirty(victim) || (stroke && stroke.t.id === victim.id)) { touchBg(victim); continue; }
      loadedBg.splice(i, 1); victim.canvas.width = 0; victim.canvas = null;
    }
  } finally { evicting = false; }
}

