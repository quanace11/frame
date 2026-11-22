/* ===== 🎬 Video → frame (rotoscope): split a clip into frames. Each frame gets the video picture in its OWN Nền layer
   (JPEG bytes kept in bg.png, canvas loaded only when shown and freed again: loadedBg / MAX_BG), so you draw over it in
   the Nhân vật / Nét layers. The clip's sound can come along as a sound clip that starts at the first new frame.
   One undo step (automatic undo: frame list, backgrounds and sounds are in the snapshot). ===== */
const VF = { fps: 12, fit: '', fade: 0, audio: true, max: 300 };
$('#vidFramesBtn').addEventListener('click', () => $('#vidFramesFile').click());
$('#vidFramesFile').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; if (file) vidAddChoose(file); });
$('#vtFile').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; if (file) vtAddFile(file); });
// 🎬 Thêm video: keep it a video (fast: cut / join like a video editor, draw on top) or split it into frames (rotoscope)
async function vidAddChoose(file) {
  const m = await modal({ title: '🎬 Thêm video', html: `<p class="lbl" style="margin-top:0">${file.name.replace(/</g, '&lt;').slice(0, 60)}</p>
    <div class="set-row"><span><b>🎞 Ghép theo video</b> (nhanh)<br><span class="lbl" style="font-size:12px">Giữ nguyên cả video trên dòng 🎞 Video: cắt, cắt bớt, nối, đổi chỗ như phần mềm dựng phim. Vẽ, nhân vật, chữ, nhạc nằm trên video.</span></span></div>
    <div class="set-row"><span><b>🖼 Ghép theo frame</b><br><span class="lbl" style="font-size:12px">Mỗi khung của video thành 1 frame để vẽ đè lên từng khung (đồ theo chuyển động thật). Chậm hơn, nhiều frame.</span></span></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '🖼 Theo frame', value: 'fr' }, { label: '🎞 Theo video', value: 'vt', primary: true }] });
  if (m === 'vt') vtAddFile(file); else if (m === 'fr') vidFramesDialog(file);
}
function vfOpenVideo(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
    const to = setTimeout(() => rej(new Error('timeout')), 20000);
    v.addEventListener('loadeddata', async () => {
      clearTimeout(to);
      // some recordings (webm from phones) report Infinity until you seek far away
      if (!isFinite(v.duration)) { await vfSeek(v, 1e7); await vfSeek(v, 0); }
      res(v);
    }, { once: true });
    v.addEventListener('error', () => { clearTimeout(to); rej(new Error('decode')); }, { once: true });
    // iPad Safari may only fetch metadata: a short muted play makes it decode a picture
    v.addEventListener('loadedmetadata', () => { if (v.readyState < 2) v.play().then(() => v.pause()).catch(() => {}); }, { once: true });
    document.body.append(v); v.src = url;
  });
}
function vfSeek(v, t) {
  return new Promise(r => {
    let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); r(); };
    v.addEventListener('seeked', fin); setTimeout(fin, 4000);
    try { v.currentTime = t; } catch (e) { fin(); }
  });
}
function vfDraw(ctx, v, fit, fade) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const vw = v.videoWidth, vh = v.videoHeight; if (!vw || !vh) return;
  const k = (fit === 'contain' ? Math.min : Math.max)(W / vw, H / vh), w = vw * k, h = vh * k;
  ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
  if (fade > 0) { ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.fillRect(0, 0, W, H); }
}
// a = start s, b = end s → frame times (middle of each frame, never past the end)
function vfTimes(a, b, fps) { const n = Math.max(1, Math.floor((b - a) * fps + 1e-6)); return Array.from({ length: n }, (_, k) => a + (k + 0.5) / fps); }
// frame k lasts so that the sum stays on the video clock (sound in sync): 12 fps → 83, 84, 83 ms…
const vfDur = (k, fps) => Math.round((k + 1) * 1000 / fps) - Math.round(k * 1000 / fps);
function vfWav(ab, a, b) {
  const sr = ab.sampleRate, ch = Math.min(2, ab.numberOfChannels), s0 = clamp(Math.floor(a * sr), 0, ab.length), s1 = clamp(Math.ceil(b * sr), s0, ab.length), n = s1 - s0;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2)), str = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const d = []; for (let c = 0; c < ch; c++) d.push(ab.getChannelData(c));
  let o = 44; for (let i = s0; i < s1; i++) for (let c = 0; c < ch; c++) { const x = clamp(d[c][i], -1, 1); out.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
  return out.buffer;
}
const vfBlank = f => S.frames.length === 1 && !f.png && !f.ver && !(f.vec && f.vec.length) && !(f.texts && f.texts.length) && !(f.pp && Object.keys(f.pp).length) && (() => { const b = bgOf(f); return !b || (!b.png && !b.ver); })();
async function vidFramesDialog(file) {
  if (playing) stopPlay();
  const url = URL.createObjectURL(file); let v;
  try { v = await vfOpenVideo(url); } catch (e) { URL.revokeObjectURL(url); toast('Không mở được video này (thử file MP4)', 4000); return; }
  const dur = v.duration || 0; v.remove();
  if (!(dur > 0)) { URL.revokeObjectURL(url); toast('Video không có độ dài — thử file khác', 4000); return; }
  const st = { a: 0, b: Math.min(dur, 10), fps: VF.fps, fit: VF.fit || (v.videoWidth > v.videoHeight ? 'contain' : 'cover'), fade: VF.fade, audio: VF.audio };
  const chips = (k, list) => list.map(([val, lbl]) => `<button class="chip small" data-vf${k}="${val}">${lbl}</button>`).join('');
  const fr = n => n.toFixed(1).replace('.', ',');
  const go = await modal({ title: '🎬 Thêm video thành frame', html: `<p class="lbl" style="margin-top:0">${file.name.replace(/</g, '&lt;').slice(0, 60)} · ${fr(dur)} giây</p>
    <video id="vfV" playsinline muted controls preload="auto" style="width:100%;max-height:34vh;background:#000;border-radius:8px;display:block"></video>
    <div class="set-row"><span>Từ giây</span><span class="grp"><input type="number" id="vfA" min="0" step="0.1" style="width:76px"><button class="chip small" id="vfAHere" title="Lấy chỗ video đang dừng">⏱ Chỗ đang xem</button></span></div>
    <div class="set-row"><span>Tới giây</span><span class="grp"><input type="number" id="vfB" min="0" step="0.1" style="width:76px"><button class="chip small" id="vfBHere" title="Lấy chỗ video đang dừng">⏱ Chỗ đang xem</button></span></div>
    <div class="set-row"><span>Số khung mỗi giây</span><span class="grp">${chips('fps', [[6, '6'], [8, '8'], [12, '12'], [15, '15'], [24, '24']])}</span></div>
    <div class="set-row"><span>Khung hình</span><span class="grp">${chips('fit', [['cover', 'Lấp đầy'], ['contain', 'Vừa khung']])}</span></div>
    <div class="set-row"><span>Làm nhạt để đồ theo</span><span class="grp"><input type="range" id="vfFade" min="0" max="80" step="5" style="width:120px"><span id="vfFadeV" class="lbl"></span></span></div>
    <div class="set-row"><span>🔊 Giữ tiếng của video</span><input type="checkbox" class="switch" id="vfAud"></div>
    <p class="lbl" id="vfInfo" style="font-weight:600"></p>
    <p class="lbl" style="font-size:12px">Mỗi khung của video thành 1 frame, hình nằm ở lớp <b>Nền</b> riêng của frame đó. Vẽ đè lên ở lớp Nhân vật / Nét để đồ theo chuyển động thật. Ít khung mỗi giây (8–12) thì ít frame phải vẽ hơn, kiểu hoạt hình hơn.</p>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '🎬 Tách thành frame', primary: true, action: () => { if (vfTimes(st.a, st.b, st.fps).length > VF.max || st.b - st.a < 0.05) { toast(st.b - st.a < 0.05 ? 'Chọn đoạn dài hơn' : `Nhiều quá (tối đa ${VF.max} frame) — chọn đoạn ngắn hơn hoặc ít khung mỗi giây hơn`, 3500); return false; } }, value: 'go' }],
    onOpen: ov => {
      const pv = ov.querySelector('#vfV'), A = ov.querySelector('#vfA'), B = ov.querySelector('#vfB');
      pv.src = url;
      const sync = () => {
        A.value = st.a.toFixed(1); B.value = st.b.toFixed(1);
        ov.querySelectorAll('[data-vffps]').forEach(b => b.classList.toggle('on', +b.dataset.vffps === st.fps));
        ov.querySelectorAll('[data-vffit]').forEach(b => b.classList.toggle('on', b.dataset.vffit === st.fit));
        ov.querySelector('#vfFade').value = Math.round(st.fade * 100); ov.querySelector('#vfFadeV').textContent = Math.round(st.fade * 100) + '%';
        ov.querySelector('#vfAud').checked = st.audio;
        const n = vfTimes(st.a, st.b, st.fps).length, rep = vfBlank(curFrame());
        ov.querySelector('#vfInfo').textContent = n > VF.max ? `→ ${n} frame: nhiều quá (tối đa ${VF.max}). Chọn đoạn ngắn hơn hoặc ít khung mỗi giây hơn.`
          : `→ ${n} frame · ${fr(st.b - st.a)} giây · ${rep ? 'thay frame trống hiện có' : `thêm vào sau frame ${S.cur + 1}`}`;
      };
      const setA = t => { st.a = clamp(+t || 0, 0, Math.max(0, dur - 0.1)); if (st.b <= st.a) st.b = Math.min(dur, st.a + 1); sync(); };
      const setB = t => { st.b = clamp(+t || 0, 0, dur); if (st.b <= st.a) st.a = Math.max(0, st.b - 1); sync(); };
      A.addEventListener('change', () => { setA(A.value); try { pv.currentTime = st.a; } catch (e) {} });
      B.addEventListener('change', () => { setB(B.value); try { pv.currentTime = st.b; } catch (e) {} });
      ov.querySelector('#vfAHere').addEventListener('click', () => setA(pv.currentTime));
      ov.querySelector('#vfBHere').addEventListener('click', () => setB(pv.currentTime));
      ov.querySelectorAll('[data-vffps]').forEach(b => b.addEventListener('click', () => { st.fps = +b.dataset.vffps; sync(); }));
      ov.querySelectorAll('[data-vffit]').forEach(b => b.addEventListener('click', () => { st.fit = b.dataset.vffit; sync(); }));
      ov.querySelector('#vfFade').addEventListener('input', e => { st.fade = e.target.value / 100; sync(); });
      ov.querySelector('#vfAud').addEventListener('change', e => { st.audio = e.target.checked; });
      sync();
    } });
  document.querySelectorAll('#vfV').forEach(x => { x.pause(); x.removeAttribute('src'); x.load(); });
  if (go !== 'go') { URL.revokeObjectURL(url); return; }
  Object.assign(VF, { fps: st.fps, fit: st.fit, fade: st.fade, audio: st.audio });
  try { await vidFramesMake(file, url, st); } finally { URL.revokeObjectURL(url); }
}
async function vidFramesMake(file, url, o) {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating(); histFlush();
  const times = vfTimes(o.a, o.b, o.fps), n = Math.min(times.length, VF.max);
  let cancelled = false;
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = '<div class="dlg" style="max-width:340px;text-align:center"><h3>Đang tách video…</h3><div class="body" id="vfMsg">Mở video…</div><div class="btns" style="justify-content:center"><button class="btn" id="vfCancel">Huỷ</button></div></div>';
  document.body.append(ov); ov.querySelector('#vfCancel').addEventListener('click', () => { cancelled = true; });
  const msg = t => { ov.querySelector('#vfMsg').textContent = t; };
  let v = null;
  try {
    v = await vfOpenVideo(url);
    const big = makeCanvas(), bx = big.getContext('2d'), [tw, th] = thumbSize(), frames = [], bgs = [];
    for (let k = 0; k < n; k++) {
      if (cancelled) throw new Error('cancel');
      msg(`Frame ${k + 1}/${n}`);
      await vfSeek(v, Math.min(times[k], v.duration - 0.01));
      vfDraw(bx, v, o.fit, o.fade);
      const blob = await new Promise(r => big.toBlob(r, 'image/jpeg', 0.86));
      const b = { kind: 'bg', id: newId(), ver: 0, png: await blob.arrayBuffer(), pngVer: 0, canvas: null };
      const f = newFrameObj(b.id); f.canvas.width = 0; f.canvas = null; f.dur = vfDur(k, o.fps);
      f.thumb = makeCanvas(tw, th); f.thumb.getContext('2d').drawImage(big, 0, 0, tw, th);
      bgs.push(b); frames.push(f);
    }
    let clip = null;
    if (o.audio) {
      msg('Lấy tiếng của video…');
      try {
        if (file.size > 200e6) throw new Error('big');
        const ac = new OfflineAudioContext(1, 44100, 44100), ab = await ac.decodeAudioData(await file.arrayBuffer());
        const t1 = o.a + frames.reduce((s, f) => s + f.dur, 0) / 1000;
        if (ab.duration > o.a + 0.05) clip = { id: newId(), name: ('Tiếng video ' + file.name).slice(0, 60), buf: vfWav(ab, o.a, Math.min(t1, ab.duration)), vol: 1, frameId: frames[0].id };
      } catch (e) { console.warn('video audio', e); }
    }
    if (cancelled) throw new Error('cancel');
    // put them in: replace the one empty frame of a new project, else insert after the current frame
    const cur = curFrame(), replace = vfBlank(cur), at = replace ? 0 : S.cur + 1;
    S.bgs.push(...bgs);
    if (replace) { S.frames = frames; const li = loaded.indexOf(cur); if (li >= 0) loaded.splice(li, 1); gcBgs(); }
    else S.frames.splice(at, 0, ...frames);
    if (clip) { S.audio = S.audio || {}; if (!S.audio.voice) S.audio.voice = clip; else (S.audio.voices = S.audio.voices || []).push(clip); waveKey = ''; updateWaves(); fxSyncBar(); }
    ov.remove();
    tintCache.clear(); ppRetween(); buildStrip(); await selectFrame(at); updateFrameUI(); scheduleSave(); requestRender();
    toast(`🎬 Đã thêm ${n} frame từ video${clip ? ' + tiếng' : o.audio ? ' (video không có tiếng)' : ''}. Hình ở lớp Nền — vẽ đè lên ở lớp Nhân vật / Nét. ↶ để bỏ`, 5000);
    return n;
  } catch (e) {
    ov.remove();
    if (e.message === 'cancel') toast('Đã huỷ tách video'); else { console.error(e); toast('Không tách được video này (thử file MP4)', 4000); }
    return 0;
  } finally { if (v) { v.removeAttribute('src'); v.load(); v.remove(); } }
}
