/* ===== 🥁 music beats (like CapCut's auto beat marks): onset strength → tempo by autocorrelation → best phase → a beat grid.
   Runs once per music file (cached), all local. Yellow ticks on the timeline; frames can be timed to land on the beats. ===== */
const beatCache = new WeakMap();
function beatsFromSamples(d, sr) {
  const hop = Math.round(sr * 0.01), n = Math.floor(d.length / hop); if (n < 200) return null;
  const eL = new Float32Array(n), eH = new Float32Array(n); let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) { let a = 0, b = 0; for (let j = i * hop, e = j + hop; j < e; j++) { const v = d[j]; lp += 0.06 * (v - lp); a += lp * lp; const hp = v - prev; prev = v; b += hp * hp; } eL[i] = Math.log(1 + 1000 * a / hop); eH[i] = Math.log(1 + 1000 * b / hop); }
  const on = new Float32Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, eL[i] - eL[i - 1]) * 1.5 + Math.max(0, eH[i] - eH[i - 1]);
  // remove the slow average so only the hits stay
  const W2 = 25, cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + on[i];
  const o = new Float32Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - W2), b = Math.min(n, i + W2 + 1); o[i] = Math.max(0, on[i] - (cs[b] - cs[a]) / (b - a)); }
  // tempo 70–180 BPM, preferring ~115
  let best = -1, L = 0; const ac = [];
  for (let lag = 33; lag <= 86; lag++) { let sum = 0; for (let i = lag; i < n; i++) sum += o[i] * o[i - lag]; sum /= (n - lag); const bpm = 6000 / lag, wgt = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2)); ac[lag] = sum; if (sum * wgt > best) { best = sum * wgt; L = lag; } }
  if (!L || best <= 0) return null;
  const y0 = ac[L - 1] || ac[L], y2 = ac[L + 1] || ac[L], den = y0 - 2 * ac[L] + y2, P = L + (den ? clamp(0.5 * (y0 - y2) / den, -0.5, 0.5) : 0);
  let bp = 0, bs = -1;
  for (let ph = 0; ph < P; ph += 0.5) { let sc = 0; for (let t = ph; t < n; t += P) { const k = Math.round(t); sc += Math.max(o[k] || 0, 0.7 * (o[k - 1] || 0), 0.7 * (o[k + 1] || 0)); } if (sc > bs) { bs = sc; bp = ph; } }
  const times = []; for (let t = bp; t < n; t += P) times.push(t * hop / sr);
  return { bpm: 60 * sr / (P * hop), period: P * hop / sr, times, dur: d.length / sr };
}
// beats of the first music clip, moved to where that clip sits on the timeline (trimmed parts have no beats)
function musicBeats() {
  const A = S.audio || {}, m = A.music, raw = musicBeatsRaw(); if (!raw) return null;
  const st = clipStart(m, 'music'), off = clipOff(m), len = clipLen(m, 'music', raw.dur) ?? raw.dur;
  if (!st && !off && len >= raw.dur - 1e-3) return raw;
  const times = raw.times.filter(b => b >= off - 1e-4 && b <= off + len + 1e-4).map(b => b - off + st);
  return times.length ? { ...raw, times } : null;
}
function musicBeatsRaw() {
  const A = S.audio || {}, ab = A.music && A.music.buf; if (!ab) return null;
  const c = beatCache.get(ab); if (c) return c.b || null;
  const ent = {}; beatCache.set(ab, ent);
  (async () => {
    try {
      const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 22050, 22050), b = await ac.decodeAudioData(ab.slice(0));
      let d = b.getChannelData(0); if (b.numberOfChannels > 1) { const r = b.getChannelData(1), m = new Float32Array(d.length); for (let i = 0; i < d.length; i++) m[i] = (d[i] + r[i]) / 2; d = m; }
      ent.b = beatsFromSamples(d, b.sampleRate); srcDurCache.set(ab, b.duration);
    } catch (e) { console.error(e); ent.b = null; }
    ent.done = true; waveKey = ''; updateWaves(); beatSync();
  })();
  return null;
}
function beatSync() {
  const el = document.getElementById('beatInfo'); if (!el) return;
  const A = S.audio || {}, bt = A.music ? musicBeats() : null, ent = A.music && beatCache.get(A.music.buf);
  el.textContent = !A.music ? 'thêm nhạc nền trước' : bt ? `${Math.round(bt.bpm)} nhịp/phút` : ent && ent.done ? 'không tìm được nhịp' : 'đang nghe nhạc…';
  $('#beatSnap').disabled = $('#beatFit').disabled = !bt;
}
// beat (or half-beat) times, continued past the end of the song with the same tempo
function beatGrid(bt, half, until) {
  const g = []; for (const t of bt.times) { g.push(t); if (half) g.push(t + bt.period / 2); }
  let t = bt.times[bt.times.length - 1] + bt.period; while (t < until + bt.period * 2) { g.push(t); if (half) g.push(t + bt.period / 2); t += bt.period; }
  return g.sort((a, b) => a - b);
}
// 🎯 make the next frame start on the beat nearest to where it starts now
function beatSnap() {
  const bt = musicBeats(); if (!bt) return; const i = S.cur, f = S.frames[i], T = frameStartTimes();
  const g = beatGrid(bt, false, T[i + 1] + 2).filter(b => b > T[i] + 0.04); if (!g.length) return;
  let e = g[0]; for (const b of g) if (Math.abs(b - T[i + 1]) < Math.abs(e - T[i + 1])) e = b;
  const nd = Math.max(20, Math.round((e - T[i]) * 1000)); if (nd === f.dur) { toast('Frame sau đã vào đúng nhịp', 1500); return; }
  f.dur = nd; updateFrameUI(); scheduleSave(); requestRender(); toast(`Frame ${i + 1} dài ${(nd / 1000).toFixed(2)}s → frame ${i + 2} vào đúng nhịp`, 2200);
}
// 🥁 each frame of the range lasts `per` beats (0.5, 1, 2, 4), starting from the first beat after the range start
async function beatFitDialog() {
  const bt = musicBeats(); if (!bt) return;
  const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : null;
  const a = sel ? sel[0] : S.cur, b = sel ? sel[sel.length - 1] : S.frames.length - 1;
  let per = 1;
  const v = await modal({ title: '🥁 Khớp nhịp nhạc', html: `<p class="lbl">Nhạc ${Math.round(bt.bpm)} nhịp/phút. Frame ${a + 1}–${b + 1} (${sel ? 'các frame đang chọn' : 'từ frame này tới cuối'}): mỗi frame dài đúng</p>
<div class="mrow"><button class="chip small" data-bper="0.5">½ nhịp</button><button class="chip small on" data-bper="1">1 nhịp</button><button class="chip small" data-bper="2">2 nhịp</button><button class="chip small" data-bper="4">4 nhịp</button></div>
<p class="lbl" style="font-size:12px">Hợp với đoạn ghép ảnh, ăn mừng, tư thế đổi theo nhạc. Hoàn tác 1 lần là về như cũ.</p>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '🥁 Khớp', value: 'go', primary: true }],
    onOpen: ov => ov.querySelectorAll('[data-bper]').forEach(x => x.addEventListener('click', () => { ov.querySelectorAll('[data-bper]').forEach(y => y.classList.toggle('on', y === x)); per = +x.dataset.bper; })) });
  if (v !== 'go') return;
  beatFit(a, b, per);
}
function beatFit(a, b, per) {
  const bt = musicBeats(); if (!bt) return 0; const T = frameStartTimes(), half = per < 1, step = half ? 1 : Math.round(per);
  const g = beatGrid(bt, half, T[a] + (b - a + 2) * per * bt.period).filter(t => t > T[a] + 0.03);
  let end = T[a], j = step - 1, c = 0;   // the first frame ends on the first beat(s) after it starts, then every `per` beats
  for (let i = a; i <= b; i++, j += step) { const e = g[j]; if (e == null) break; const f = S.frames[i], nd = Math.max(20, Math.round(e * 1000) - Math.round(end * 1000)); end = e; if (f.dur !== nd) f.dur = nd; c++; }
  updateFrameUI(); scheduleSave(); requestRender(); toast(`🥁 ${c} frame đã khớp nhịp (${per === 0.5 ? '½' : per} nhịp mỗi frame)`, 2200);
  return c;
}
