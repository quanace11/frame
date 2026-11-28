/* ========= Playback ========= */
let playIdx = 0, playTimer = null, playT0 = 0, playFT0 = 0, playAC = null, playStopAudio = () => {};
// preview speed (1, 0.5, 0.25: slow motion to check the movement) and play range ([a, b] from the multi-selected frames, or null = whole film)
var playSpeed = 1, playRange = null;
const pNow = () => performance.now() * playSpeed;   // virtual clock: all playback times are measured on it, so slow motion keeps everything in step
function playRangeGet() { if (!msel || msel.size < 2) return null; const idx = S.frames.map((f, i) => msel.has(f.id) ? i : -1).filter(i => i >= 0); return idx.length >= 2 ? [idx[0], idx[idx.length - 1]] : null; }
// voice clips: S.audio.voice is the first one (older projects have only that), S.audio.voices the extra ones (2 players can talk)
const voiceClips = () => { const A = S.audio || {}; return [A.voice, ...(A.voices || [])].filter(Boolean); };
const voiceStart = c => clipFrame(c, 'voice');
// music clips: S.audio.music is the first one (older projects: the only one, starting at 0 s), S.audio.musics the pieces made by ✂ Cắt / ⧉
const musicClips = () => { const A = S.audio || {}; return [A.music, ...(A.musics || [])].filter(Boolean); };
const hasAudio = () => !!(S.audio && (musicClips().length || voiceClips().length || (S.audio.sfx || []).length)) || vtHasAudio();
/* --- where a sound clip sits in time (🎚 audio timeline). Each clip is pinned to a frame (voice/sfx: frameId, music: fa; music without
   fa starts at 0 s like before) + dt seconds after that frame starts, so it follows the frame when earlier frames get longer/shorter.
   off = seconds skipped at the start of the file (trim), len = seconds played (missing = to the end of the file). --- */
function clipFrame(c, kind) { const id = kind === 'music' ? c.fa : c.frameId; if (!id) return 0; const i = S.frames.findIndex(f => f.id === id); return i < 0 ? (kind === 'sfx' ? -1 : 0) : i; }
function clipStart(c, kind, T) { const i = clipFrame(c, kind); if (i < 0) return null; T = T || frameStartTimes(); return Math.max(0, (T[i] || 0) + (c.dt || 0)); }
function clipSetStart(c, kind, t, T) {
  T = T || frameStartTimes(); t = Math.max(0, t); let i = 0; while (i < S.frames.length - 1 && T[i + 1] <= t + 1e-6) i++;
  if (kind === 'music') c.fa = S.frames[i].id; else c.frameId = S.frames[i].id;
  const dt = Math.round((t - T[i]) * 1000) / 1000; if (Math.abs(dt) < 1e-3) delete c.dt; else c.dt = dt;
}
const clipOff = c => c.off || 0;
const srcDurCache = new WeakMap();
function clipSrcDur(c, kind) { if (kind === 'sfx') return SFX[c.kind] ? SFX[c.kind].dur : null; if (!c.buf) return null; const d = srcDurCache.get(c.buf); if (d == null) audioPeaks(c.buf); return d ?? null; }
// seconds this clip plays (null while the file is still being read)
function clipLen(c, kind, srcDur) { const sd = srcDur ?? clipSrcDur(c, kind); if (sd == null) return c.len ?? null; const rest = Math.max(0, sd - clipOff(c)); return c.len != null ? Math.min(c.len, rest) : rest; }
async function playAudioFrom(i) { playStopAudio(); playStopAudio = () => {}; if (!hasAudio() || playSpeed !== 1) return; try { if (!playAC) playAC = new (window.AudioContext || window.webkitAudioContext)(); const T = frameStartTimes(); playStopAudio = await scheduleAudio(playAC, playAC.destination, T[i], playRange ? T[playRange[1] + 1] : T[T.length - 1]); } catch (e) { console.error(e); } }
// Playback renders every frame to a small canvas first. Keep that cache inside a memory budget (lower
// resolution for long films) and free it a while after playback stops, so RAM doesn't grow forever.
const PLAY_BUDGET = (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 120 : 260) * 1e6;
let playFreeT = null;
function freePlayCache(except) { for (const f of S.frames) if (f.play && f !== except) { f.play.width = 0; f.play.height = 0; f.play = null; f.playKey = ''; } }
// play cache as sharp as the frame on screen (a 900 px cap made playback look blurry on 2× tablet screens); memory budget still wins
function playCacheSize(n) { let ph = Math.min(H, Math.max(320, Math.round(H * vs))); const perPx = 4 * n * W / H; if (ph * ph * perPx > PLAY_BUDGET) ph = Math.max(200, Math.floor(Math.sqrt(PLAY_BUDGET / perPx))); return ph; }
async function buildPlayCache() {
  clearTimeout(playFreeT); await panoReady();
  const ph = playCacheSize(S.frames.length), k = ph / H, pw = Math.round(W * k);
  for (let i = 0; i < S.frames.length; i++) {
    const f = S.frames[i], bg = bgOf(f);
    const live = ppSmoothOn(), key = ghostKey(i) + lookKey(i) + f.ver + ':' + (bg ? bg.id + '.' + bg.ver : '') + ':' + pw + ':' + (S.bgVideo ? 'v' : '') + (live ? 's' : '');
    if (f.play && f.playKey === key) continue;
    await ghostLoad(f); await ensureLoaded(f); if (bg) await ensureLoaded(bg);
    if (!f.play) f.play = makeCanvas(pw, ph); else { f.play.width = pw; f.play.height = ph; }
    const x = f.play.getContext('2d');
    if (S.bgVideo) x.clearRect(0, 0, pw, ph); else { x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph); }
    if (S.showBg) drawPano(x, f, pw, ph);
    if (bg && bg.canvas) drawBgImg(x, i, bg.canvas, pw, ph);
    drawSpeedLines(x, f, i, pw, ph); drawGlowBack(x, f, i, pw, ph);
    drawCol(x, f, pw, ph); drawGhosts(x, f, pw, ph); if (f.canvas) x.drawImage(f.canvas, 0, 0, pw, ph);
    if (!live && S.pp && S.showPP) { x.save(); x.scale(pw / W, ph / H); drawPuppet(x, f.pp, f.lip); x.restore(); }
    if (!live && f.vec && f.vec.length) { x.save(); x.scale(pw / W, ph / H); drawVec(x, f.vec); x.restore(); }
    f.playKey = key;
  }
}
async function startPlay() {
  if (playing) { stopPlay(); return; }
  if (stroke) strokeEnd(); commitFloating(); motionClose(); rigClose();
  $('#saveState').textContent = 'Đang chuẩn bị phát…';
  await buildPlayCache(); setSaveState();
  playing = true; playRange = playRangeOnce || playRangeGet(); playRangeOnce = null; trSrc = playTrSrc;
  playIdx = playRange && (S.cur < playRange[0] || S.cur > playRange[1]) ? playRange[0] : S.cur;
  playT0 = pNow() - frameStartTimes()[playIdx] * 1000; playAudioFrom(playIdx);
  if (playRange) toast(`Phát đoạn frame ${playRange[0] + 1}–${playRange[1] + 1}` + (S.loop ? ' (lặp)' : ''), 1600);
  if (playSpeed !== 1) toast(`Phát chậm ${playSpeed === 0.5 ? '½' : '¼'}× (tắt tiếng) — bấm 1× để về tốc độ thật`, 2200);
  if (vtOn()) vtPlayTick(frameStartTimes()[playIdx], playSpeed);
  else if (S.bgVideo && bgVid.ready) { const v = bgVid.el; try { v.currentTime = bgVideoTimeAt(playIdx); v.playbackRate = playSpeed; } catch (e) {} v.muted = !S.bgVideo.audio || playSpeed !== 1; v.volume = S.bgVideo.vol ?? 0.7; v.play().catch(() => {}); }
  $('#playBtn span').textContent = 'Dừng'; $('#playHint').hidden = false; $('#app').classList.add('playing');
  step();
}
function step() {
  if (!playing) return;
  const f = S.frames[playIdx]; playCanvas = f.play; playFT0 = pNow();
  S.frames.forEach((g, i) => g.el && g.el.classList.toggle('playing', i === playIdx));
  requestRender(); scrubDraw();
  playTimer = setTimeout(() => {
    playIdx++;
    const a = playRange ? playRange[0] : 0, last = playRange ? Math.min(playRange[1], S.frames.length - 1) : S.frames.length - 1;
    if (playIdx > last) { if (S.loop) { playIdx = a; playT0 = pNow() - frameStartTimes()[a] * 1000; playAudioFrom(a); if (S.bgVideo && bgVid.ready && !vtOn()) { try { bgVid.el.currentTime = bgVideoTimeAt(a); } catch (e) {} } } else { stopPlay(); return; } }
    step();
  }, f.dur / playSpeed);
}
function stopPlay() {
  playing = false; trSrc = null; playRange = null; clearTimeout(playTimer); playCanvas = null; if (vtOn()) { vtPauseAll(); setTimeout(() => bgVideoSync(true), 0); } else if (bgVid.el) { try { bgVid.el.playbackRate = 1; } catch (e) {} bgVid.el.pause(); bgVid.el.muted = true; setTimeout(() => bgVideoSync(true), 0); } playStopAudio(); playStopAudio = () => {}; if (playAC) { try { playAC.close(); } catch (e) {} playAC = null; }
  clearTimeout(playFreeT); playFreeT = setTimeout(() => { if (!playing) freePlayCache(); }, 45000);
  $('#playBtn span').textContent = 'Phát'; $('#playHint').hidden = true; $('#app').classList.remove('playing');
  S.frames.forEach(g => g.el && g.el.classList.remove('playing'));
  requestRender(); scrubDraw();
}

