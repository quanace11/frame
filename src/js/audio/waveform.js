/* ===== voice / music waveform under the frame thumbnails: time poses to the words without guessing ===== */
const peakCache = new WeakMap(); let waveKey = '';
const PEAK_HZ = 100;
function audioPeaks(ab) {
  if (!ab) return null;
  const c = peakCache.get(ab); if (c) return c.peaks || null;
  const ent = {}; peakCache.set(ab, ent);
  (async () => {
    try {
      const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100), b = await ac.decodeAudioData(ab.slice(0));
      srcDurCache.set(ab, b.duration); ent.peaks = peaksOf(b); waveKey = ''; updateWaves(); atlDraw();
    } catch (e) { ent.peaks = null; }
  })();
  return null;
}
function peaksOf(b) {
  const n = Math.ceil(b.duration * PEAK_HZ), out = new Float32Array(n), step = b.sampleRate / PEAK_HZ, chs = [];
  for (let k = 0; k < b.numberOfChannels; k++) chs.push(b.getChannelData(k));
  let mx = 1e-6;
  for (let i = 0; i < n; i++) { let m = 0; const a0 = Math.floor(i * step), a1 = Math.min(b.length, Math.floor((i + 1) * step)); for (const d of chs) for (let j = a0; j < a1; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; } out[i] = m; if (m > mx) mx = m; }
  for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i] / mx * 1.15);
  return out;
}
const sfxPeakC = {};
function sfxPeaks(kind) { if (kind in sfxPeakC) return sfxPeakC[kind]; sfxPeakC[kind] = null; if (SFX[kind]) sfxBuffer(kind).then(b => { sfxPeakC[kind] = peaksOf(b); atlDraw(); }).catch(() => {}); return null; }
function updateWaves() {
  const A = S.audio || {}, T = frameStartTimes(), VCOL = ['#ffb21e', '#5be37d', '#ff7ad9', '#7fd8ff'];
  // every music / voice clip that has its waveform ready: timeline start, file offset, length
  const lay = [];
  musicClips().forEach(c => { const pk = audioPeaks(c.buf); if (pk) lay.push({ pk, st: clipStart(c, 'music', T), off: clipOff(c), len: clipLen(c, 'music') ?? pk.length / PEAK_HZ, col: 'rgba(120,190,255,.6)', v: false }); });
  voiceClips().forEach((c, k) => { const pk = audioPeaks(c.buf); if (pk) lay.push({ pk, st: clipStart(c, 'voice', T), off: clipOff(c), len: clipLen(c, 'voice') ?? pk.length / PEAK_HZ, col: VCOL[k % VCOL.length], v: true }); });
  const any = lay.length > 0, vStarts = new Set();
  for (const l of lay) if (l.v) { let i = 0; while (i < S.frames.length - 1 && T[i + 1] <= l.st + 1e-6) i++; vStarts.add(i); }
  const sfxAt = new Set((A.sfx || []).map(x => x.frameId));
  const bt = A.music ? musicBeats() : null;
  const key = lay.map(l => [l.col, l.st, l.off, l.len].join(':')).join(';') + (bt ? 'b' + bt.times.length + ':' + (bt.times[0] || 0) : '') + '|' + [...sfxAt].join(',') + '|' + S.frames.map(f => f.dur).join(',') + '|' + S.frames.length;
  if (key === waveKey) return; waveKey = key;
  S.frames.forEach((f, i) => {
    const el = f.el; if (!el) return;
    const cv = el.querySelector('.wave'); if (!cv) return;
    let sb = el.querySelector('.sfxb'); if (sfxAt.has(f.id)) { if (!sb) { sb = document.createElement('span'); sb.className = 'sfxb'; sb.textContent = '🔊'; el.append(sb); } } else if (sb) sb.remove();
    el.classList.toggle('hasw', any);
    if (!any) { cv.hidden = true; return; }
    const w = f.thumb ? f.thumb.width : 54, h = 18; cv.hidden = false;
    if (cv.width !== w * 2) { cv.width = w * 2; cv.height = h * 2; }
    const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, w, h);
    const t0 = T[i], t1 = T[i + 1];
    for (const l of lay) {
      if (t1 <= l.st || t0 >= l.st + l.len) continue;
      x.fillStyle = l.col; const pk = l.pk;
      for (let px = 0; px < w; px++) {
        const ta = t0 + (t1 - t0) * px / w, tb = t0 + (t1 - t0) * (px + 1) / w; if (tb <= l.st || ta >= l.st + l.len) continue;
        const a = Math.floor((ta - l.st + l.off) * PEAK_HZ), b = Math.max(a + 1, Math.floor((tb - l.st + l.off) * PEAK_HZ));
        let m = 0; for (let j = Math.max(0, a); j < Math.min(pk.length, b); j++) if (pk[j] > m) m = pk[j];
        if (m > 0.01) { const hh = Math.max(1, m * (h - 2)); x.fillRect(px, (h - hh) / 2, 1, hh); }
      }
    }
    if (vStarts.has(i)) { x.fillStyle = '#ff3b9a'; x.fillRect(0, 0, 2, h); }
    if (bt) { x.fillStyle = '#ffd23f'; for (const b of bt.times) { if (b < t0 - 1e-4) continue; if (b >= t1 - 1e-4) break; const px = Math.round((b - t0) / (t1 - t0) * w); x.fillRect(Math.min(w - 2, px), 0, 2, h); } }
  });
  atlDraw();
}

