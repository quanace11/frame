/* ===== 🎚 audio timeline (dòng âm thanh, like a video editor): every music / voice / sound-effect clip as a block on its track,
   with its waveform. Drag the middle = move in time, drag an edge = trim, ✂ split at the red playhead, 🔗 join, 🗑 delete, ⧉ copy.
   Edits change the clip's timing fields (fa/frameId + dt, off, len) in place and call scheduleSave(), so the automatic undo
   records one step per drag / button. Playback, lip sync and video export all read the same fields (scheduleAudio, clipStart…). ===== */
var atlDrag = null, atlSel = null, atlLay = null, atlRaf = 0;
const atl = { pps: 0, x0: 0, ph: null, snap: true, pinch: null, ptrs: new Map() };
const ATL_RUL = 24, ATL_LANE = 36, ATL_PAD = 8;
const ATL_TRK = [['video', '🎞 Video'], ['music', '🎵 Nhạc'], ['voice', '🎤 Giọng'], ['sfx', '🔊 Tiếng động']];
const ATL_VCOL = ['#ffb21e', '#5be37d', '#ff7ad9', '#7fd8ff'];
const atlOpen = () => { const el = document.getElementById('atl'); return !!(el && !el.hidden); };
const atlX = t => ATL_PAD + (t - atl.x0) * atl.pps;
const atlT = x => (x - ATL_PAD) / atl.pps + atl.x0;
function atlClips() {
  const A = S.audio || {}, T = frameStartTimes(), out = [], vb = new Map();
  musicClips().forEach(c => out.push({ c, kind: 'music', name: c.name || 'Nhạc', col: '#4aa3ff' }));
  voiceClips().forEach(c => { if (!vb.has(c.buf)) vb.set(c.buf, ATL_VCOL[vb.size % ATL_VCOL.length]); out.push({ c, kind: 'voice', name: c.name || 'Giọng', col: vb.get(c.buf) }); });
  (A.sfx || []).forEach(x => out.push({ c: x, kind: 'sfx', name: (SFX[x.kind] || {}).label || x.kind, col: '#b48cff' }));
  const clips = [];
  for (const v of vtList()) { const src = vtSrc(v.c.s) || {}; clips.push({ c: v.c, kind: 'video', name: (v.c.vol ?? 1) > 0.001 ? src.name || 'Video' : '🔇 ' + (src.name || 'Video'), col: '#ff8a3d', st: v.st, len: v.len, off: v.c.off || 0, sd: src.dur || null, src }); }
  for (const o of out) {
    if (!o.c.id) o.c.id = newId();
    o.st = clipStart(o.c, o.kind, T); if (o.st == null) continue;
    const L = clipLen(o.c, o.kind); o.load = L == null; o.len = L ?? 1; o.sd = clipSrcDur(o.c, o.kind); o.off = clipOff(o.c);
    clips.push(o);
  }
  // lanes: clips that overlap in time on the same track go on separate rows
  const rows = []; let y = ATL_RUL;
  for (const [k, label] of ATL_TRK) {
    const cs = clips.filter(o => o.kind === k).sort((a, b) => a.st - b.st), ends = [];
    for (const o of cs) { let l = ends.findIndex(e => e <= o.st + 1e-3); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = o.st + o.len; o.lane = l; }
    const n = Math.max(1, ends.length); cs.forEach(o => { o.y = y + o.lane * ATL_LANE; });
    rows.push({ k, label, y, n }); y += n * ATL_LANE;
  }
  return { clips, rows, h: y + 2, T };
}
const atlFind = id => atlLay && atlLay.clips.find(o => o.c.id === id);
// where the red playhead is: while playing = the play time, else the tapped time (if it is inside the frame being shown) or the frame start
function atlPh(T) {
  T = T || frameStartTimes();
  if (playing) return clamp((pNow() - playT0) / 1000, 0, T[T.length - 1]);
  const a = T[S.cur], b = T[S.cur + 1]; return atl.ph != null && atl.ph >= a - 1e-6 && atl.ph < b ? atl.ph : a;
}
function atlFit() {
  const cv = document.getElementById('atlCv'), w = Math.max(100, cv.clientWidth || 600), L = atlLay || atlClips();
  const end = Math.max(L.T[L.T.length - 1], ...L.clips.map(o => o.st + o.len), 1);
  atl.pps = clamp((w - ATL_PAD * 2) / end, 4, 600); atl.x0 = 0;
}
function atlDraw() {
  if (!atlOpen()) return;
  const cv = document.getElementById('atlCv'), L = atlLay = atlClips();
  if (!atl.pps) atlFit();
  if (cv.style.height !== L.h + 'px') cv.style.height = L.h + 'px';
  const w = Math.max(10, cv.clientWidth), h = L.h, d = DPR || 1;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const x = cv.getContext('2d'), T = L.T, n = S.frames.length, tot = T[n], ph = atlPh(T);
  if (playing) { const px = atlX(ph); if (px > w * 0.85 || px < 0) atl.x0 = Math.max(0, ph - (w * 0.15) / atl.pps); }
  const X = atlX, t0 = atlT(0), t1 = atlT(w);
  x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h); x.fillStyle = '#15171d'; x.fillRect(0, 0, w, h);
  // rows
  L.rows.forEach((r, k) => { x.fillStyle = k % 2 ? '#1a1d25' : '#1e212a'; x.fillRect(0, r.y, w, r.n * ATL_LANE); });
  // ruler: one block per frame (orange = frame being shown) + seconds
  const cur = playing ? playIdx : S.cur;
  for (let i = 0; i < n; i++) {
    if (T[i + 1] < t0 || T[i] > t1) continue;
    const a = X(T[i]), b = X(T[i + 1]);
    x.fillStyle = i === cur ? '#ffb21e' : i % 2 ? '#2c2f3a' : '#363a47'; x.fillRect(a, 2, Math.max(1, b - a - 1), 12);
    if (b - a > 16) { x.fillStyle = i === cur ? '#000' : '#aeb3c2'; x.font = '9px system-ui,sans-serif'; x.textBaseline = 'middle'; x.fillText(String(i + 1), a + 3, 8.5); }
    if (b - a > 3) { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(a, ATL_RUL, 1, h - ATL_RUL); }
  }
  x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '9px system-ui,sans-serif'; x.textBaseline = 'top';
  const stepS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60].find(s => s * atl.pps >= 46) || 60;
  for (let s = Math.max(0, Math.floor(t0 / stepS) * stepS); s <= t1; s += stepS) { const px = X(s); x.fillRect(px, 14, 1, 5); x.fillText((Math.round(s * 100) / 100) + 's', px + 2, 14); }
  const bt = (S.audio && S.audio.music) ? musicBeats() : null;
  if (bt) { x.fillStyle = '#ffd23f'; for (const b of bt.times) { if (b < t0 || b > t1) continue; x.fillRect(X(b) - 0.5, ATL_RUL - 4, 1.5, 4); } }
  // film end
  x.fillStyle = 'rgba(255,255,255,.35)'; for (let y = ATL_RUL; y < h; y += 6) x.fillRect(X(tot), y, 1, 3);
  // clips
  const vdrag = atlDrag && atlDrag.moved && atlDrag.mode === 'm' && atlDrag.o.kind === 'video' ? atlDrag : null;
  for (const o of L.clips) {
    const st = vdrag && vdrag.o.c === o.c ? vdrag.vx : o.st, a = X(st), b = X(st + o.len); if (b < -2 || a > w + 2) continue;
    const y = o.y + 3, hh = ATL_LANE - 6, sel = o.c.id === atlSel;
    x.save(); x.beginPath(); x.roundRect ? x.roundRect(a, y, Math.max(3, b - a), hh, 6) : x.rect(a, y, Math.max(3, b - a), hh); x.clip();
    x.fillStyle = o.col + '40'; x.fillRect(a, y, b - a, hh);
    if (o.kind === 'video') {   // little pictures of the piece, as in a video editor
      const th = vtThumbs(o.src), tw = th.pics.find(Boolean) ? th.pics.find(Boolean).width / 2 : hh * 1.6;
      for (let px = a; px < b; px += tw) {
        if (px + tw < 0 || px > w) continue; const st = o.off + atlT(px) - atlT(a), pic = th.pics[Math.min(th.pics.length - 1, Math.floor(st / th.step))] || th.pics[Math.floor(st / th.step)];
        if (pic) x.drawImage(pic, px, y, tw, hh); else { x.fillStyle = '#00000030'; x.fillRect(px, y, tw - 1, hh); }
      }
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(a, y, b - a, 15);
    }
    const pk = o.kind === 'video' ? null : o.kind === 'sfx' ? sfxPeaks(o.c.kind) : audioPeaks(o.c.buf);
    if (pk) {
      x.fillStyle = o.col + 'cc'; const pa = Math.max(0, Math.floor(a)), pb = Math.min(w, Math.ceil(b)), mid = y + hh / 2 + 4;
      for (let px = pa; px < pb; px++) {
        const sa = atlT(px) - o.st + o.off, sb = atlT(px + 1) - o.st + o.off;
        let m = 0; for (let j = Math.max(0, Math.floor(sa * PEAK_HZ)), je = Math.min(pk.length, Math.max(j + 1, Math.floor(sb * PEAK_HZ))); j < je; j++) if (pk[j] > m) m = pk[j];
        if (m > 0.02) { const v = Math.max(1, m * (hh - 14) / 2); x.fillRect(px, mid - v, 1, v * 2); }
      }
    }
    x.fillStyle = '#fff'; x.font = 'bold 10px system-ui,sans-serif'; x.textBaseline = 'top';
    x.fillText((o.load ? '⏳ ' : '') + String(o.name).slice(0, 40), Math.max(a, 0) + 5, y + 3);
    x.restore();
    x.lineWidth = sel ? 2 : 1; x.strokeStyle = sel ? '#fff' : o.col; x.beginPath(); x.roundRect ? x.roundRect(a + 0.5, y + 0.5, Math.max(3, b - a) - 1, hh - 1, 6) : x.rect(a + 0.5, y + 0.5, b - a - 1, hh - 1); x.stroke();
    if (sel) { x.fillStyle = '#fff'; for (const ex of [a + 1, b - 7]) { x.beginPath(); x.roundRect ? x.roundRect(ex, y + 4, 6, hh - 8, 3) : x.rect(ex, y + 4, 6, hh - 8); x.fill(); } x.fillStyle = '#15171d'; x.fillRect(a + 3.5, y + hh / 2 - 5, 1, 10); x.fillRect(b - 4.5, y + hh / 2 - 5, 1, 10); }
  }
  // track names (stay at the left edge)
  x.font = '10px system-ui,sans-serif'; x.textBaseline = 'bottom';
  for (const r of L.rows) { const tw = x.measureText(r.label).width; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, r.y + r.n * ATL_LANE - 14, tw + 8, 14); x.fillStyle = '#c9cede'; x.fillText(r.label, 4, r.y + r.n * ATL_LANE - 2); }
  // red playhead
  const pxh = X(ph); x.fillStyle = '#ff3b4f'; x.fillRect(pxh - 1, 0, 2, h); x.beginPath(); x.moveTo(pxh - 6, 0); x.lineTo(pxh + 6, 0); x.lineTo(pxh, 7); x.fill();
  if (playing && !atlRaf) atlRaf = requestAnimationFrame(() => { atlRaf = 0; if (playing) atlDraw(); });
  atlSync();
}
function atlSync() {
  const o = atlSel && atlFind(atlSel), ph = atlPh();
  for (const id of ['atlJoin', 'atlDup', 'atlHere', 'atlDel', 'atlVol']) document.getElementById(id).disabled = !o;
  document.getElementById('atlSplit').disabled = !(atlLay && atlLay.clips.some(c => c.st + 0.02 < ph && c.st + c.len - 0.02 > ph));
  document.getElementById('atlSnap').classList.toggle('on', atl.snap);
  const v = o ? o.c.vol ?? (o.kind === 'music' ? 0.6 : o.kind === 'sfx' ? 0.9 : 1) : 1, isV = !!(o && o.kind === 'video');
  for (const id of ['atlVFit', 'atlVMute']) document.getElementById(id).hidden = !isV;
  if (isV) { document.getElementById('atlVFit').textContent = o.c.fit === 'contain' ? '⬛ Vừa khung' : '🔳 Lấp đầy'; document.getElementById('atlVMute').textContent = (o.c.vol ?? 1) > 0.001 ? '🔊 Có tiếng' : '🔇 Tắt tiếng'; }
  document.getElementById('atlFrHere').disabled = !vtOn();
  document.getElementById('atlVol').value = Math.round(v * 100); document.getElementById('atlVolVal').textContent = o ? Math.round(v * 100) + '%' : '';
  document.getElementById('atlInfo').textContent = o ? `${String(o.name).slice(0, 24)} · ${o.st.toFixed(2)}s → ${(o.st + o.len).toFixed(2)}s (${o.len.toFixed(2)}s)` : atlLay && atlLay.clips.length ? 'Chạm 1 đoạn để chọn · kéo giữa = dời (video: đổi chỗ) · kéo mép = cắt bớt · chạm chỗ trống = đặt vạch đỏ' : 'Chưa có gì: ＋ Video để cắt ghép video, ＋ Nhạc, ＋ Giọng, hoặc gắn tiếng động ở tab Âm thanh';
}
function atlShow(on) {
  const el = document.getElementById('atl'); el.hidden = !on; S.atlOpen = !!on; saveSettings();
  document.getElementById('atlBtn').classList.toggle('on', !!on);
  if (on) { atl.pps = 0; atlDraw(); }
}
// snap a time to frame starts, the playhead, beats and the edges of other clips (within 10 px)
function atlSnapT(t, self) {
  if (!atl.snap || !atlLay) return { t, d: Infinity };
  const lim = 10 / atl.pps, c = [0, atlPh(atlLay.T), ...atlLay.T];
  for (const o of atlLay.clips) if (o.c !== self) c.push(o.st, o.st + o.len);
  const bt = S.audio && S.audio.music ? musicBeats() : null; if (bt) c.push(...bt.times);
  let best = t, bd = lim; for (const v of c) { const dd = Math.abs(v - t); if (dd < bd) { bd = dd; best = v; } }
  return { t: best, d: bd < lim ? bd : Infinity };
}
function atlHit(px, py) {
  if (!atlLay) return null; let best = null;
  for (const o of atlLay.clips) {
    if (py < o.y + 1 || py > o.y + ATL_LANE - 1) continue;
    const a = atlX(o.st), b = atlX(o.st + o.len); if (px < a - 12 || px > b + 12) continue;
    const dist = px < a ? a - px : px > b ? px - b : 0, sc = dist - (o.c.id === atlSel ? 5 : 0);
    if (!best || sc < best.sc) best = { o, sc, a, b };
  }
  if (!best) return null;
  const { o, a, b } = best, edge = Math.min(18, Math.max(8, (b - a) / 3));
  return { o, mode: px < a + edge ? 'l' : px > b - edge ? 'r' : 'm' };
}
function atlDragMove(dx) {
  const g = atlDrag, o = g.o, c = o.c, T = atlLay.T, dt = dx / atl.pps;
  if (g.mode === 'pan') { atl.x0 = Math.max(-0.2, g.xs0 - dt); return; }
  if (o.kind === 'video') { vtDragMove(g, c, dt); return; }
  if (g.mode === 'm') {
    let t = Math.max(0, g.st0 + dt); const s1 = atlSnapT(t, c), s2 = atlSnapT(t + g.len0, c);
    if (s1.d <= s2.d && s1.d < Infinity) t = s1.t; else if (s2.d < Infinity) t = s2.t - g.len0;
    clipSetStart(c, o.kind, Math.max(0, t), T);
  } else if (g.mode === 'l') {
    let ns = atlSnapT(g.st0 + dt, c).t; if (atlSnapT(g.st0 + dt, c).d === Infinity) ns = g.st0 + dt;
    ns = clamp(ns, Math.max(0, g.st0 - g.off0), g.st0 + g.len0 - 0.05); const k = ns - g.st0;
    const off = Math.round((g.off0 + k) * 1000) / 1000; if (off > 1e-3) c.off = off; else delete c.off;
    c.len = Math.round((g.len0 - k) * 1000) / 1000; clipSetStart(c, o.kind, ns, T);
  } else {
    const s = atlSnapT(g.st0 + g.len0 + dt, c); let ne = s.d < Infinity ? s.t : g.st0 + g.len0 + dt;
    const maxLen = g.sd != null ? g.sd - g.off0 : Infinity; ne = clamp(ne, g.st0 + 0.05, g.st0 + maxLen);
    const len = Math.round((ne - g.st0) * 1000) / 1000; if (len >= maxLen - 1e-3) delete c.len; else c.len = len;
  }
}
// 🎞 video row: the pieces always follow each other (no gaps), so dragging the middle changes the order and an edge trims
function vtDragMove(g, c, dt) {
  const arr = S.bgVideo.clips;
  if (g.mode === 'm') {
    g.vx = Math.max(0, g.st0 + dt); const mid = g.vx + g.len0 / 2;
    let st = 0, idx = 0; for (const p of arr) { if (p === c) continue; const l = vtLen(p); if (st + l / 2 < mid) idx++; st += l; }
    const k = arr.indexOf(c); if (k !== idx) { arr.splice(k, 1); arr.splice(idx, 0, c); g.reord = true; }
  } else if (g.mode === 'l') {
    const off = clamp(g.off0 + dt, 0, g.off0 + g.len0 - 0.1);
    c.off = Math.round(off * 1000) / 1000; c.len = Math.round((g.len0 - (off - g.off0)) * 1000) / 1000;
  } else {
    const s = atlSnapT(g.st0 + g.len0 + dt, c); let ne = s.d < Infinity ? s.t : g.st0 + g.len0 + dt;
    const maxLen = g.sd != null ? g.sd - g.off0 : Infinity; ne = clamp(ne, g.st0 + 0.1, g.st0 + maxLen);
    c.len = Math.round((ne - g.st0) * 1000) / 1000;
  }
  vtFitFrames();
}
function atlChanged(msg) { if (vtOn()) vtAfterEdit(); waveKey = ''; updateWaves(); fxSyncBar(); scheduleSave(); atlDraw(); if (msg) toast(msg, 2200); }
{ const cv = document.getElementById('atlCv');
  const loc = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    atl.ptrs.set(e.pointerId, e.clientX);
    if (atl.ptrs.size === 2) {   // 2 fingers: zoom (pinch) — the 1-finger drag stops where it is
      if (atlDrag && atlDrag.moved && atlDrag.mode !== 'pan') atlChanged(); atlDrag = null;
      const [p1, p2] = [...atl.ptrs.values()], r = cv.getBoundingClientRect();
      atl.pinch = { d0: Math.max(10, Math.abs(p1 - p2)), pps0: atl.pps, tm: atlT((p1 + p2) / 2 - r.left) }; return;
    }
    if (atl.ptrs.size > 2) return;
    if (playing) stopPlay();
    const [px, py] = loc(e), hit = py > ATL_RUL ? atlHit(px, py) : null;
    if (hit) {
      atlSel = hit.o.c.id;
      atlDrag = { o: hit.o, mode: hit.mode, x0: e.clientX, st0: hit.o.st, off0: hit.o.off, len0: hit.o.len, sd: hit.o.sd, moved: false };
      if (hit.o.load && hit.mode !== 'm') atlDrag.mode = 'm';   // can't trim until the file is read
    } else atlDrag = { mode: 'pan', x0: e.clientX, xs0: atl.x0, px, moved: false };
    atlDraw();
  });
  cv.addEventListener('pointermove', e => {
    if (!atl.ptrs.has(e.pointerId)) return; atl.ptrs.set(e.pointerId, e.clientX);
    if (atl.pinch && atl.ptrs.size >= 2) { const [p1, p2] = [...atl.ptrs.values()], r = cv.getBoundingClientRect(), mx = (p1 + p2) / 2 - r.left; atl.pps = clamp(atl.pinch.pps0 * Math.max(10, Math.abs(p1 - p2)) / atl.pinch.d0, 4, 800); atl.x0 = Math.max(-0.2, atl.pinch.tm - (mx - ATL_PAD) / atl.pps); atlDraw(); return; }
    const g = atlDrag; if (!g) return; const dx = e.clientX - g.x0;
    if (!g.moved && Math.abs(dx) < 6) return; g.moved = true; atlDragMove(dx); atlDraw();
  });
  const up = e => {
    if (!atl.ptrs.has(e.pointerId)) return; atl.ptrs.delete(e.pointerId);
    if (atl.pinch) { if (atl.ptrs.size < 2) atl.pinch = null; return; }
    const g = atlDrag; atlDrag = null; if (!g) return;
    if (g.mode === 'pan' && !g.moved) {   // tap on an empty spot / the ruler: put the playhead there and show that frame
      const T = frameStartTimes(), t = clamp(atlT(g.px), 0, Math.max(0, T[T.length - 1] - 1e-3)); let i = 0; while (i < S.frames.length - 1 && T[i + 1] <= t) i++;
      atl.ph = t; atlSel = null; if (i !== S.cur) selectFrame(i).then(() => { bgVideoSync(true); atlDraw(); }); else { bgVideoSync(true); atlDraw(); } return;
    }
    if (g.mode !== 'pan' && g.moved) atlChanged(); else atlDraw();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) { const tm = atlT(mx); atl.pps = clamp(atl.pps * Math.exp(-e.deltaY * 0.01), 4, 800); atl.x0 = Math.max(-0.2, tm - (mx - ATL_PAD) / atl.pps); }
    else atl.x0 = Math.max(-0.2, atl.x0 + (e.deltaX || e.deltaY) / atl.pps);
    atlDraw(); }, { passive: false });
  new ResizeObserver(() => atlDraw()).observe(cv); }
// the arrays a clip lives in
function atlList(kind, create) { S.audio = S.audio || {}; const A = S.audio; if (kind === 'sfx') return A.sfx = A.sfx || []; if (kind === 'voice') return A.voices = A.voices || []; return A.musics = A.musics || []; }
function atlRemove(o) {
  if (o.kind === 'video') { const arr = S.bgVideo.clips; arr.splice(arr.indexOf(o.c), 1); return; }
  const A = S.audio; if (!A) return;
  if (o.kind === 'voice') { voiceDel(voiceClips().indexOf(o.c)); return; }
  if (o.kind === 'music') { if (A.music === o.c) A.music = (A.musics || []).shift() || null; else A.musics = (A.musics || []).filter(x => x !== o.c); return; }
  A.sfx = (A.sfx || []).filter(x => x !== o.c);
}
// ✂ split at the playhead: the clip keeps the part before, a new clip (same file, later offset) plays the rest
function atlSplit() {
  const ph = atlPh(), sel = atlSel && atlFind(atlSel), spans = o => o.st + 0.02 < ph && o.st + o.len - 0.02 > ph;
  const list = sel && spans(sel) ? [sel] : (atlLay ? atlLay.clips.filter(spans) : []);
  if (!list.length) { toast('Đặt vạch đỏ nằm giữa 1 đoạn âm thanh rồi bấm ✂ Cắt', 2200); return; }
  const T = frameStartTimes(); let last = null;
  for (const o of list) {
    const k = ph - o.st, b = { ...o.c, id: newId() };
    if (o.kind === 'video') { b.off = Math.round((o.off + k) * 1000) / 1000; b.len = Math.round((o.len - k) * 1000) / 1000; o.c.len = Math.round(k * 1000) / 1000; const arr = S.bgVideo.clips; arr.splice(arr.indexOf(o.c) + 1, 0, b); last = b; continue; }
    b.off = Math.round((o.off + k) * 1000) / 1000; if (o.c.len != null) b.len = Math.round((o.len - k) * 1000) / 1000; else delete b.len;
    o.c.len = Math.round(k * 1000) / 1000; clipSetStart(b, o.kind, ph, T);
    atlList(o.kind).push(b); last = b;
  }
  atlSel = last.id; atlChanged(`✂ Đã cắt ${list.length > 1 ? list.length + ' đoạn' : 'làm 2'} tại ${ph.toFixed(2)}s`);
}
// 🔗 join with the next clip on the same track: two pieces of the same file that touch → one clip again; otherwise pull the next one up to touch
function atlJoin() {
  const o = atlSel && atlFind(atlSel); if (!o) return; const end = o.st + o.len;
  if (o.kind === 'video') {
    const arr = S.bgVideo.clips, nc = arr[arr.indexOf(o.c) + 1];
    if (!nc) { toast('Không có đoạn video nào phía sau để nối', 2000); return; }
    if (nc.s === o.c.s && Math.abs((nc.off || 0) - (o.off + o.len)) < 0.05 && (nc.fit || '') === (o.c.fit || '')) { o.c.len = Math.round((o.len + vtLen(nc)) * 1000) / 1000; arr.splice(arr.indexOf(nc), 1); atlChanged('🔗 Đã gộp 2 mảnh video thành 1'); }
    else toast('Các đoạn video luôn nối liền nhau rồi. 🔗 chỉ gộp được 2 mảnh cắt ra từ cùng 1 video, nằm liền nhau', 3200);
    return;
  }
  const nx = atlLay.clips.filter(p => p !== o && p.kind === o.kind && p.st >= end - 0.05).sort((a, b) => a.st - b.st)[0];
  if (!nx) { toast('Không có đoạn nào phía sau trên dòng này để nối', 2000); return; }
  const same = o.kind === 'sfx' ? o.c.kind === nx.c.kind : o.c.buf === nx.c.buf;
  if (same && Math.abs(nx.st - end) < 0.03 && Math.abs(nx.off - (o.off + o.len)) < 0.03) {
    if (nx.c.len == null) delete o.c.len; else o.c.len = Math.round((o.len + nx.len) * 1000) / 1000;
    if (o.kind === 'voice' && nx.c.mouth && !o.c.mouth) o.c.mouth = nx.c.mouth;
    atlRemove(nx); atlChanged('🔗 Đã gộp 2 mảnh thành 1 đoạn'); return;
  }
  clipSetStart(nx.c, nx.kind, end); atlChanged(same ? '🔗 Đã kéo đoạn sau sát vào (bấm 🔗 lần nữa để gộp nếu là 2 mảnh liền nhau)' : '🔗 Đã kéo đoạn sau sát vào đoạn này');
}
function atlDup() {
  const o = atlSel && atlFind(atlSel); if (!o) return; const b = { ...o.c, id: newId() };
  if (o.kind === 'video') { const arr = S.bgVideo.clips; arr.splice(arr.indexOf(o.c) + 1, 0, b); atlSel = b.id; atlChanged('⧉ Đã nhân bản đoạn video, đặt ngay sau'); return; }
  clipSetStart(b, o.kind, o.st + o.len); atlList(o.kind).push(b); atlSel = b.id; atlChanged('⧉ Đã nhân bản, đặt ngay sau');
}
$('#atlBtn').addEventListener('click', () => atlShow(!atlOpen()));
$('#atlSplit').addEventListener('click', atlSplit);
$('#atlJoin').addEventListener('click', atlJoin);
$('#atlDup').addEventListener('click', atlDup);
$('#atlHere').addEventListener('click', () => { const o = atlSel && atlFind(atlSel); if (!o) return; if (o.kind === 'video') { toast('Đoạn video nối liền nhau: kéo đoạn để đổi chỗ', 2200); return; } clipSetStart(o.c, o.kind, atlPh()); atlChanged(); });
$('#atlDel').addEventListener('click', () => { const o = atlSel && atlFind(atlSel); if (!o) return; atlRemove(o); atlSel = null; atlChanged('🗑 Đã xoá đoạn (↶ để lấy lại)'); });
$('#atlVol').addEventListener('input', e => { const o = atlSel && atlFind(atlSel); if (!o) return; o.c.vol = e.target.value / 100; $('#atlVolVal').textContent = e.target.value + '%'; });
$('#atlVol').addEventListener('change', () => { if (atlSel) { scheduleSave(); fxSyncBar(); } });
$('#atlSnap').addEventListener('click', () => { atl.snap = !atl.snap; atlSync(); });
$('#atlZi').addEventListener('click', () => { const tm = atlPh(); atl.pps = clamp(atl.pps * 1.6, 4, 800); atl.x0 = Math.max(-0.2, tm - ($('#atlCv').clientWidth / 2) / atl.pps); atlDraw(); });
$('#atlZo').addEventListener('click', () => { const tm = atlPh(); atl.pps = clamp(atl.pps / 1.6, 4, 800); atl.x0 = Math.max(-0.2, tm - ($('#atlCv').clientWidth / 2) / atl.pps); atlDraw(); });
$('#atlFit').addEventListener('click', () => { atlFit(); atlDraw(); });
$('#atlAddMusic').addEventListener('click', () => $('#musicFile').click());
$('#atlAddVideo').addEventListener('click', () => $('#vtFile').click());
$('#atlFrHere').addEventListener('click', vtFrameAtPh);
$('#atlVFit').addEventListener('click', () => { const o = atlSel && atlFind(atlSel); if (!o || o.kind !== 'video') return; o.c.fit = o.c.fit === 'contain' ? 'cover' : 'contain'; atlChanged(o.c.fit === 'contain' ? 'Vừa khung: thấy cả hình (viền đen)' : 'Lấp đầy khung (cắt bớt 2 bên)'); });
$('#atlVMute').addEventListener('click', () => { const o = atlSel && atlFind(atlSel); if (!o || o.kind !== 'video') return; o.c.vol = (o.c.vol ?? 1) > 0.001 ? 0 : 1; atlChanged(o.c.vol ? '🔊 Bật tiếng đoạn video' : '🔇 Tắt tiếng đoạn video'); });
$('#atlAddVoice').addEventListener('click', () => $('#voiceFile').click());
$('#fxAtl').addEventListener('click', () => atlShow(true));

