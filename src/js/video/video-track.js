/* ========= Video background ========= */
const bgVid = { el: null, url: null, ready: false, fit: '' };
/* ===== 🎞 Video track (ghép theo video): the whole video stays a video. S.bgVideo.track = 1 → S.bgVideo.srcs = the files
   [{id, name, type, buf, dur, w, h}], S.bgVideo.clips = pieces played one after another from 0 s (like the main track of a
   video editor): {id, s: src id, off: seconds skipped in the file, len: seconds played, vol (tiếng, 0 = tắt), fit: 'cover'|'contain'}.
   Edited on the 🎞 Video row of the 🎚 timeline (kéo giữa = đổi chỗ, kéo mép = cắt bớt, ✂ cắt, 🔗 nối, ⧉, 🗑). One hidden <video>
   per file (vt.els), always muted: the sound of each piece is scheduled by scheduleAudio like a music clip, so it stays in sync
   and ⚡ fast export can mix it offline. Frames are drawn on top; the last frame is stretched to the end of the video
   (vtFitFrames). Edits only change S.bgVideo + frame durations → automatic undo (vidCopy in the snapshot). ===== */
const vt = { els: new Map(), playClip: null, pre: null, th: new Map() };
const vtOn = () => !!(S.bgVideo && S.bgVideo.track && S.bgVideo.clips);
const vtSrc = id => S.bgVideo && (S.bgVideo.srcs || []).find(s => s.id === id);
function vidCopy(V) { return V ? { ...V, srcs: V.srcs ? V.srcs.map(s => ({ ...s })) : V.srcs, clips: V.clips ? V.clips.map(c => ({ ...c })) : V.clips } : null; }
function vtLen(c) { const s = vtSrc(c.s), sd = s && s.dur ? s.dur : Infinity; return Math.max(0.05, Math.min(c.len ?? sd, sd - (c.off || 0))); }
function vtList() { if (!vtOn()) return []; let st = 0; return S.bgVideo.clips.map((c, k) => { const o = { c, k, st, len: vtLen(c) }; st += o.len; return o; }); }
function vtEnd() { const L = vtList(); return L.length ? L[L.length - 1].st + L[L.length - 1].len : 0; }
function vtAt(t) { for (const o of vtList()) if (t >= o.st - 1e-6 && t < o.st + o.len - 1e-6) return { ...o, src: (o.c.off || 0) + Math.max(0, t - o.st) }; return null; }
const vtHasAudio = () => vtOn() && S.bgVideo.clips.some(c => (c.vol ?? 1) > 0.001);
function vtMakeEl(src) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
  v.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  const e = { el: v, url: URL.createObjectURL(new Blob([src.buf], { type: src.type || 'video/mp4' })), ready: false, buf: src.buf };
  v.addEventListener('loadeddata', () => { e.ready = true; bgVid.ready = true; if (!src.dur && isFinite(v.duration)) src.dur = v.duration; bgVideoSync(true); });
  v.addEventListener('seeked', () => requestRender());
  v.addEventListener('error', () => toast('Không mở được video "' + String(src.name).slice(0, 30) + '" (thử MP4)', 3500));
  v.addEventListener('loadedmetadata', () => { if (v.readyState < 2) v.play().then(() => v.pause()).catch(() => {}); }, { once: true });
  v.src = e.url; document.body.append(v); return e;
}
function vtSetupEls() {
  const want = new Map((vtOn() ? S.bgVideo.srcs : []).filter(s => s.buf).map(s => [s.id, s]));
  for (const [id, e] of vt.els) if (!want.has(id) || want.get(id).buf !== e.buf) { e.el.pause(); e.el.remove(); URL.revokeObjectURL(e.url); vt.els.delete(id); }
  for (const [id, s] of want) if (!vt.els.has(id)) vt.els.set(id, vtMakeEl(s));
  bgVid.ready = [...vt.els.values()].some(e => e.ready);
}
// choose the <video> for the piece at timeline time t (null = no video there)
function vtUse(at) {
  const e = at && vt.els.get(at.c.s);
  if (!e || !e.ready) { bgVid.el = null; return null; }
  bgVid.el = e.el; bgVid.fit = at.c.fit || ''; return e;
}
function vtShowAt(t, force) {
  const e = vtUse(vtAt(t)); if (!e) { requestRender(); return; }
  const at = vtAt(t); if (force || Math.abs(e.el.currentTime - at.src) > 0.03) { try { e.el.currentTime = at.src; } catch (err) {} }
  requestRender();
}
// while playing (and real-time export): keep the right file playing at the right place
function vtPlayTick(t, rate = 1) {
  const prev = bgVid.el, at = vtAt(t), e = vtUse(at);
  if (prev && prev !== bgVid.el) prev.pause();
  if (!e) { vt.playClip = null; return; }
  const v = e.el, drift = Math.abs(v.currentTime - at.src);
  if (drift > (vt.playClip === at.c.id ? 0.35 : 0.08)) { try { v.currentTime = at.src; } catch (err) {} }
  vt.playClip = at.c.id;
  if (v.playbackRate !== rate) v.playbackRate = rate;
  if (v.paused) v.play().catch(() => {});
  // the next piece comes from another file: have it waiting at its first picture
  const L = vtList(), nx = L[at.k + 1];
  if (nx && nx.c.s !== at.c.s && nx.st - t < 1.2 && vt.pre !== nx.c.id) { const ne = vt.els.get(nx.c.s); if (ne && ne.ready) { try { ne.el.currentTime = nx.c.off || 0; } catch (err) {} } vt.pre = nx.c.id; }
}
function vtPauseAll() { for (const e of vt.els.values()) { try { e.el.pause(); e.el.playbackRate = 1; } catch (err) {} } vt.playClip = null; vt.pre = null; }
// exact picture for export: seek and wait
async function vtSeekAt(t) {
  const at = vtAt(t), e = vtUse(at); if (!e) return null;
  if (!e.el.paused) e.el.pause();
  if (Math.abs(e.el.currentTime - at.src) > 0.004) await vfSeek(e.el, at.src);
  return e.el;
}
// the film is at least as long as the video: the last frame is stretched (or shortened) to end with the video
function vtFitFrames() {
  if (!vtOn() || !S.frames.length) return;
  const T = frameStartTimes(), n = S.frames.length, end = vtEnd(), last = S.frames[n - 1];
  if (end > T[n - 1] + 0.05) { const d = Math.round((end - T[n - 1]) * 1000); if (Math.abs(d - last.dur) > 1) { last.dur = d; updateFrameUI(); } }
}
// little pictures along the clip on the timeline: one file → one hidden <video> that seeks through it once
function vtThumbs(src) {
  let e = vt.th.get(src.id); if (e && e.buf === src.buf) return e;
  e = { buf: src.buf, step: 1, pics: [] }; vt.th.set(src.id, e);
  (async () => {
    let v, url;
    try {
      url = URL.createObjectURL(new Blob([src.buf], { type: src.type || 'video/mp4' })); v = await vfOpenVideo(url);
      const dur = v.duration || src.dur || 1; e.step = Math.max(0.5, dur / 80);
      const th = ATL_LANE - 8, tw = Math.max(16, Math.round(th * (v.videoWidth || 16) / (v.videoHeight || 9)));
      for (let t = 0, k = 0; t < dur; t += e.step, k++) {
        if (vt.th.get(src.id) !== e) break;
        await vfSeek(v, Math.min(dur - 0.02, t + 0.01));
        const c = makeCanvas(tw * 2, th * 2); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); e.pics[k] = c;
        if (k % 4 === 0) atlDraw();
      }
      atlDraw();
    } catch (err) { console.error(err); }
    if (v) { v.removeAttribute('src'); v.load(); v.remove(); } if (url) URL.revokeObjectURL(url);
  })();
  return e;
}
// 🎞 add a video file as one piece at the end of the video row
async function vtAddFile(file) {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating(); histFlush();
  if (file.size > 300e6) { toast('Video quá lớn (tối đa 300 MB) — hãy cắt ngắn hoặc giảm chất lượng', 4000); return; }
  const pm = progress('Đang nạp video…'); let buf, v, url;
  try {
    buf = await file.arrayBuffer(); url = URL.createObjectURL(new Blob([buf], { type: file.type || 'video/mp4' }));
    v = await vfOpenVideo(url);
  } catch (e) { pm.close(); if (url) URL.revokeObjectURL(url); toast('Không mở được video này (thử file MP4)', 4000); return; }
  const dur = v.duration || 0, vw = v.videoWidth, vh = v.videoHeight; v.remove(); URL.revokeObjectURL(url); pm.close();
  if (!(dur > 0)) { toast('Video không có độ dài — thử file khác', 4000); return; }
  vtToTrack();
  const V = S.bgVideo, src = { id: newId(), name: file.name.slice(0, 60), type: file.type || 'video/mp4', buf, dur, w: vw, h: vh };
  V.srcs.push(src);
  const c = { id: newId(), s: src.id, off: 0, len: Math.round(dur * 1000) / 1000, fit: (vw > vh) === (W > H) ? 'cover' : 'contain' };
  V.clips.push(c); if (!V.name) V.name = src.name;
  vtAfterEdit(); markAllFrames(); atlSel = c.id; if (!atlOpen()) atlShow(true); else atlDraw();
  toast('🎞 Đã thêm video vào dòng Video. Kéo giữa = đổi chỗ, kéo mép = cắt bớt, ✂ Cắt tại vạch đỏ. Vẽ, nhân vật, chữ nằm trên video', 6000);
}
// an older single background video (loops under the frames) → the video row
function vtToTrack() {
  if (vtOn()) return;
  const O = S.bgVideo;
  S.bgVideo = { track: 1, name: O ? O.name : '', srcs: [], clips: [] };
  if (O && O.buf) {
    const d = bgVid.el && isFinite(bgVid.el.duration) ? bgVid.el.duration : null, src = { id: newId(), name: O.name, type: O.type, buf: O.buf, dur: d };
    S.bgVideo.srcs.push(src);
    S.bgVideo.clips.push({ id: newId(), s: src.id, off: O.offset || 0, len: d ? Math.max(0.1, d - (O.offset || 0)) : 10, vol: O.audio ? (O.vol ?? 0.7) : 0, fit: 'cover' });
  }
}
// after a change on the video row: drop files nothing uses, stretch the film, update the players + save (= one undo step)
function vtAfterEdit() {
  const V = S.bgVideo; if (!V || !V.track) return;
  if (!V.clips.length) { S.bgVideo = null; bgVideoSetup(); markAllFrames(); scheduleSave(); return; }
  const used = new Set(V.clips.map(c => c.s)); V.srcs = V.srcs.filter(s => used.has(s.id));
  vtFitFrames(); bgVideoSetup(); bgVideoSync(true); scheduleSave();
}
// ✂ cut the frame being shown at the red playhead: the part after it becomes a new empty frame (to draw something else there)
async function vtFrameAtPh() {
  const T = frameStartTimes(), i = S.cur, ph = atlPh(T), a = T[i], b = T[i + 1];
  if (ph < a + 0.04 || ph > b - 0.04) { toast('Đặt vạch đỏ vào giữa frame đang xem (chạm chỗ trống trên dòng thời gian) rồi bấm lại', 3000); return; }
  if (stroke) strokeEnd(); commitFloating(); histFlush();
  const f = S.frames[i], g = newFrameObj(f.bgId);
  g.dur = Math.round((b - ph) * 1000); f.dur = Math.round((ph - a) * 1000);
  g.pp = ppClone(f.pp); g.lip = lipCopy(f); g.ppKey = false;
  S.frames.splice(i + 1, 0, g); loaded.push(g); evictSoon();
  buildStrip(); await selectFrame(i + 1); atl.ph = ph; ppRetween && ppRetween(); scheduleSave(); atlDraw();
  toast(`➕ Frame ${i + 2} bắt đầu ở ${ph.toFixed(2)}s — vẽ ở đây chỉ hiện từ chỗ này`, 3000);
}
function bgVideoSetup() {
  if (bgVid.el && ![...vt.els.values()].some(e => e.el === bgVid.el)) { bgVid.el.pause(); bgVid.el.remove(); }
  if (bgVid.url) URL.revokeObjectURL(bgVid.url);
  bgVid.el = null; bgVid.url = null; bgVid.ready = false; bgVid.fit = '';
  vtSetupEls();
  if (vtOn()) { requestRender(); updateBgVideoBtn(); return; }
  if (!S.bgVideo || !S.bgVideo.buf) { requestRender(); updateBgVideoBtn(); return; }
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.loop = true;
  v.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  bgVid.url = URL.createObjectURL(new Blob([S.bgVideo.buf], { type: S.bgVideo.type || 'video/mp4' })); v.src = bgVid.url;
  v.addEventListener('loadeddata', () => { bgVid.ready = true; bgVideoSync(true); });
  v.addEventListener('seeked', () => requestRender());
  v.addEventListener('error', () => { toast('Không mở được video nền này (thử MP4)', 3500); });
  document.body.append(v); bgVid.el = v; updateBgVideoBtn();
}
function bgVideoTimeAt(i) { const T = frameStartTimes(), d = bgVid.el && bgVid.el.duration || 1; return ((T[i] || 0) + (S.bgVideo.offset || 0)) % d; }
function bgVideoSync(force) {
  if (!S.bgVideo || !bgVid.ready || playing) return;
  if (vtOn()) { vtShowAt(atlPh(), force); return; }
  const t = bgVideoTimeAt(S.cur); if (force || Math.abs(bgVid.el.currentTime - t) > 0.03) { try { bgVid.el.currentTime = t; } catch (e) {} }
}
// cover = fill the frame (crop), contain = whole picture with black bars (video row pieces can choose)
function drawVideoCover(ctx, v, fit) {
  if (!v || !v.videoWidth) return;
  const cont = (fit || (vtOn() ? bgVid.fit : '')) === 'contain';
  const k = (cont ? Math.min : Math.max)(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
  if (cont) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
}
function updateBgVideoBtn() { const b = document.getElementById('bgVidBtn'); if (b) { b.classList.toggle('on', !!S.bgVideo); b.textContent = S.bgVideo ? '🎞 Nền video ✓' : '🎞 Nền video'; } const m = document.getElementById('bgMenuBtn'); if (m) m.textContent = S.bgVideo ? '🖼 Nền: video ▾' : '🖼 Nền ▾'; }
async function bgVideoDialog() {
  if (vtOn()) { atlShow(true); toast('Video nằm ở dòng 🎞 Video trên dòng thời gian: cắt, nối, đổi chỗ ở đó', 3000); return; }
  if (!S.bgVideo) { $('#vtFile').click(); return; }
  const V = S.bgVideo, dur = bgVid.el && bgVid.el.duration ? bgVid.el.duration.toFixed(1) + 's' : '';
  await modal({ title: '🎞 Nền video', html: `<p>${V.name.replace(/</g, '&lt;')} ${dur}</p>
    <div class="set-row"><span>Bắt đầu video từ giây</span><input type="number" id="bvOff" min="0" step="0.1" value="${V.offset || 0}"></div>
    <div class="set-row"><span>Dùng tiếng của video khi phát/xuất</span><input type="checkbox" class="switch" id="bvAud" ${V.audio ? 'checked' : ''}></div>
    <div class="set-row"><span>Âm lượng tiếng video</span><input type="range" id="bvVol" min="0" max="100" value="${Math.round((V.vol ?? 0.7) * 100)}"></div>
    <p class="lbl" style="font-size:12px">Video nằm dưới lớp Nền. Phần nào của lớp Nền còn trống (trong suốt) thì thấy video. Video tự lặp nếu ngắn hơn hoạt hình. Bấm <b>✂ Cắt ghép như video</b> để đưa video lên dòng 🎞 Video: cắt, nối nhiều đoạn, đổi chỗ.</p>`,
    buttons: [{ label: 'Xoá nền video', value: 'del', cls: 'danger' }, { label: 'Đổi video', value: 'change' }, { label: '✂ Cắt ghép như video', value: 'track' }, { label: 'Xong', value: 'ok', primary: true }],
    onOpen: ov => {
      ov.querySelector('#bvOff').addEventListener('change', e => { V.offset = Math.max(0, +e.target.value || 0); bgVideoSync(true); scheduleSave(); });
      ov.querySelector('#bvAud').addEventListener('change', e => { V.audio = e.target.checked; scheduleSave(); });
      ov.querySelector('#bvVol').addEventListener('input', e => { V.vol = e.target.value / 100; scheduleSave(); });
    } }).then(v => {
      if (v === 'del') { S.bgVideo = null; bgVideoSetup(); markAllFrames(); scheduleSave(); }
      else if (v === 'change') $('#bgVidFile').click();
      else if (v === 'track') { vtToTrack(); bgVideoSetup(); vtAfterEdit(); atlShow(true); }
    });
}
function markAllFrames() { S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); requestRender(); }
