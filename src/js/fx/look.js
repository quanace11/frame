/* ===== 🌈 Look tab (tab Hiệu ứng trong Chữ & FX): 🏃 scrolling background, 💨 speed / focus lines, 🎨 film colour, 📺 slow-motion replay =====
   f.bgs = {d, v}: the background slides in direction d (l/r/u/d) at v frame-widths per second, counted in time from the first frame of the
   run (frames next to each other with bgs, same background, same scene) → a character can run in place while the field rushes past.
   The picture is tiled mirrored (every second copy flipped), so any background joins without a seam.
   f.sl = {k, c}: k 'h'/'v' = speed lines behind the character (new random streaks each frame, so they flicker like in anime),
   'focus' = manga focus lines (集中線) from the edges toward the middle, on top, shimmering ~12×/s. c = colour.
   f.flt = film colour over the picture (not over texts): bw, old, night, rage, cold, dream, replay. Uses blend modes (no ctx.filter: iPad).
   All three are in the automatic undo (H_FKEYS) and the 3 save places. Shown on screen while editing: background + speed lines always,
   focus lines + colour only while this tab is open (so drawing colours stay true). ===== */
const BGS_DIRS = { l: [-1, 0, '◀', 'Sang trái'], r: [1, 0, '▶', 'Sang phải'], u: [0, -1, '▲', 'Lên trên'], d: [0, 1, '▼', 'Xuống dưới'] };
const BGS_SPEEDS = [[0.35, 'Chậm'], [0.8, 'Vừa'], [1.6, 'Nhanh']];
const SL_KINDS = { h: ['💨', 'Ngang', 'Vệt gió ngang sau nhân vật: chạy, lướt, sút mạnh'], v: ['↕', 'Dọc', 'Vệt dọc: rơi xuống, bật nhảy lên'], focus: ['💥', 'Tập trung', 'Tia truyện tranh từ mép vào giữa (集中線): khoảnh khắc sốc, quyết định, ghi bàn'] };
const FLT_KINDS = { bw: ['⚫', 'Đen trắng', 'Hồi tưởng, kỷ niệm'], old: ['🟤', 'Phim cũ', 'Màu nâu ngả vàng như phim xưa'], night: ['🌙', 'Ban đêm', 'Tối và xanh như đêm'], rage: ['🔥', 'Giận đỏ', 'Đỏ rực, tối ở mép: tức điên'], cold: ['❄', 'Lạnh / sợ', 'Xanh lạnh: sợ hãi, buồn'], dream: ['💭', 'Mơ', 'Sáng mờ ở mép như giấc mơ'], replay: ['📺', 'Phát lại', 'Nhạt màu, tối ở mép (dùng cho phát lại chậm)'] };
SETTINGS_KEYS.push('lookOpt'); S.lookOpt = { v: 0.8, c: '#ffffff', n: 8, rs: 2, rn: 8 };
function bgsOff(i) {   // [x, y] shift of the background on frame i (doc pixels), null = not sliding
  const f = S.frames[i]; if (!f || !f.bgs || S.bgVideo) return null;
  let ox = 0, oy = 0;
  for (let j = i - 1; j >= 0; j--) {
    const g = S.frames[j]; if (!g.bgs || g.bgId !== f.bgId || S.frames[j + 1].scene) break;
    const D = BGS_DIRS[g.bgs.d] || BGS_DIRS.l, dist = (g.bgs.v || 0.8) * W * g.dur / 1000; ox += D[0] * dist; oy += D[1] * dist;
  }
  return [Math.round(ox), Math.round(oy)];
}
const lookKey = i => { const f = S.frames[i], o = bgsOff(i); return (o ? 'b' + o.join(',') : '') + (f.sl && f.sl.k !== 'focus' ? 's' + f.sl.k + f.sl.c : '') + ':'; };
function drawBgImg(ctx, i, img, w, h) {
  const o = bgsOff(i); if (!o || (!o[0] && !o[1])) { if (w) ctx.drawImage(img, 0, 0, w, h); else ctx.drawImage(img, 0, 0); return; }
  const tw = w || W, th = h || H, ox = o[0] * tw / W, oy = o[1] * th / H, kx0 = Math.floor(-ox / tw), ky0 = Math.floor(-oy / th);
  for (let kx = kx0; kx <= kx0 + 1; kx++) for (let ky = ky0; ky <= ky0 + 1; ky++) {
    const x0 = kx * tw + ox, y0 = ky * th + oy; if (x0 >= tw || y0 >= th || x0 + tw <= 0 || y0 + th <= 0) continue;
    const fx = kx & 1, fy = ky & 1;
    ctx.save(); ctx.translate(x0 + (fx ? tw : 0), y0 + (fy ? th : 0)); ctx.scale(fx ? -1 : 1, fy ? -1 : 1); ctx.drawImage(img, 0, 0, tw + 0.5, th + 0.5); ctx.restore();
  }
}
function slRand(seed) { let s = ((seed | 0) * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function drawSpeedLines(ctx, f, i, w, h) {
  const sl = f && f.sl; if (!sl || (sl.k !== 'h' && sl.k !== 'v')) return;
  const R = slRand(i * 7919 + 13), vert = sl.k === 'v', L = vert ? H : W, A = vert ? W : H;
  ctx.save(); if (w) ctx.scale(w / W, h / H); ctx.fillStyle = sl.c || '#fff';
  for (let m = 0; m < 28; m++) {
    const a = R() * A, len = L * (0.25 + R() * 0.6), s0 = R() * (L + len) - len, t = (2 + R() * R() * 16) * W / 1080;
    ctx.globalAlpha = 0.3 + R() * 0.55; ctx.beginPath();
    if (!vert) { ctx.moveTo(s0, a); ctx.quadraticCurveTo(s0 + len / 2, a - t, s0 + len, a); ctx.quadraticCurveTo(s0 + len / 2, a + t, s0, a); }
    else { ctx.moveTo(a, s0); ctx.quadraticCurveTo(a - t, s0 + len / 2, a, s0 + len); ctx.quadraticCurveTo(a + t, s0 + len / 2, a, s0); }
    ctx.fill();
  }
  ctx.restore();
}
function drawFocusLines(ctx, f, i, tIn) {
  const sl = f && f.sl; if (!sl || sl.k !== 'focus') return;
  const R = slRand(i * 104729 + Math.floor((tIn || 0) * 12) * 31 + 7), cx = W / 2, cy = H * 0.46, rO = Math.hypot(W, H) * 0.75, n = 96;
  ctx.save(); ctx.fillStyle = sl.c || '#111';
  for (let m = 0; m < n; m++) {
    const an = (m + R() * 0.9) / n * Math.PI * 2, wd = (0.12 + R() * 0.55) * Math.PI / n, k = 0.62 + R() * 0.38;
    const ix = cx + Math.cos(an) * W * 0.36 * k, iy = cy + Math.sin(an) * H * 0.27 * k;
    ctx.globalAlpha = 0.6 + R() * 0.4; ctx.beginPath(); ctx.moveTo(ix, iy);
    ctx.lineTo(cx + Math.cos(an - wd) * rO, cy + Math.sin(an - wd) * rO); ctx.lineTo(cx + Math.cos(an + wd) * rO, cy + Math.sin(an + wd) * rO); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawFilter(ctx, f) {
  const k = f && f.flt; if (!k || !FLT_KINDS[k]) return;
  ctx.save();
  const fill = (op, col, a) => { ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); };
  const vig = (col, a) => { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  if (k === 'bw') { fill('saturation', '#808080', 1); vig('#000', 0.35); }
  else if (k === 'old') { fill('saturation', '#808080', 1); fill('color', '#b08850', 0.55); vig('#2a1a08', 0.6); }
  else if (k === 'night') { fill('multiply', '#4a5c98', 1); vig('#000', 0.5); }
  else if (k === 'rage') { fill('multiply', '#ff7a66', 0.85); vig('#7a0000', 0.75); }
  else if (k === 'cold') { fill('color', '#4a90ff', 0.45); vig('#001030', 0.45); }
  else if (k === 'dream') { fill('screen', '#ffd6f0', 0.3); vig('#fff', 0.65); }
  else if (k === 'replay') { fill('saturation', '#808080', 0.6); vig('#000', 0.5); }
  ctx.restore();
}
const lkIdx = () => { const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : []; if (sel.length) return sel; const n = clamp(S.lookOpt.n | 0, 1, 300), out = []; for (let i = S.cur; i < Math.min(S.frames.length, S.cur + n); i++) out.push(i); return out; };
// set (or clear with val = null) one look key on the frames; undo = automatic snapshot
function lookSet(key, val, what) {
  const idx = lkIdx();
  for (const i of idx) { const f = S.frames[i]; if (val) f[key] = { ...val }; else delete f[key]; if (key === 'flt' && val) f.flt = val.k; f.ver++; f.playKey = ''; queueThumbFor(f); }
  if (key === 'bgs') S.frames.forEach(f => { f.playKey = ''; });   // later frames' shift depends on these
  scheduleSave(); lookSync(); requestRender();
  toast(val ? `${what} ở ${idx.length} frame (frame ${idx[0] + 1}–${idx[idx.length - 1] + 1}) — bấm ▶ Xem thử` : `Đã tắt ${what} ở ${idx.length} frame`, 2600);
}
function lookSync() {
  const f = curFrame(); if (!f || !$('#lkStat')) return;
  document.querySelectorAll('[data-bgsd]').forEach(b => b.classList.toggle('on', !!f.bgs && f.bgs.d === b.dataset.bgsd));
  const v = f.bgs ? f.bgs.v : S.lookOpt.v; document.querySelectorAll('[data-bgsv]').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.bgsv - v) < 1e-6));
  document.querySelectorAll('[data-slk]').forEach(b => b.classList.toggle('on', !!f.sl && f.sl.k === b.dataset.slk));
  const c = f.sl ? f.sl.c : S.lookOpt.c; document.querySelectorAll('[data-slc]').forEach(b => b.classList.toggle('on', b.dataset.slc === c));
  document.querySelectorAll('[data-flt]').forEach(b => b.classList.toggle('on', f.flt === b.dataset.flt));
  document.querySelectorAll('[data-rps]').forEach(b => b.classList.toggle('on', +b.dataset.rps === S.lookOpt.rs));
  const on = [f.bgs && `🏃 nền chạy ${BGS_DIRS[f.bgs.d][3].toLowerCase()}`, f.sl && `${SL_KINDS[f.sl.k][0]} đường ${SL_KINDS[f.sl.k][1].toLowerCase()}`, f.flt && `${FLT_KINDS[f.flt][0]} ${FLT_KINDS[f.flt][1].toLowerCase()}`].filter(Boolean);
  const sel = msel && msel.size > 1;
  $('#lkStat').textContent = `Frame ${S.cur + 1}: ${on.length ? on.join(', ') : 'chưa có hiệu ứng'} · Bấm nút = áp cho ${sel ? msel.size + ' frame đang chọn' : S.lookOpt.n + ' frame từ frame này'}`;
}
/* 📺 slow-motion replay (như phát lại bàn thắng trên TV): copies of the last N frames (or the multi-selected ones) are put right after them,
   each 2× / 3× longer, faded colour + dark edges, a "● PHÁT LẠI" label and a glitch cut into it. One undo step. */
async function replayMake() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : [];
  let a, b;
  if (sel.length) { a = sel[0]; b = sel[sel.length - 1]; }
  else { b = S.cur; a = b; const n = clamp(S.lookOpt.rn | 0, 2, 120); while (a > 0 && b - a + 1 < n && !S.frames[a].scene) a--; }
  if (b - a < 1) { toast('Cần ít nhất 2 frame — đứng ở frame cuối của pha bóng (vd. lúc bóng vào lưới) rồi bấm lại', 3500); return; }
  const slow = S.lookOpt.rs || 2, lid = newId(), added = [];
  const pm = b - a > 8 ? progress('Đang tạo phát lại…') : null;
  try {
    for (let i = a; i <= b; i++) {
      const s0 = S.frames[i]; await ensureLoaded(s0);
      const f = frameCopyOf(s0, true); f.dur = clamp(Math.round(s0.dur * slow), 20, 30000);
      f.flt = 'replay';
      f.texts.push({ id: lid, str: '● PHÁT LẠI', x: W * 0.5, y: H * 0.15, size: Math.round(W * 0.07), color: '#ffffff', style: 'caption', rot: 0, an: 'pop', lp: 'pulse' });
      if (i === a) { f.tr = { k: 'glitch', d: TR_KINDS.glitch.d, snd: true }; if (!f.cam) { const c0 = camAt(a); f.cam = { z: c0.z, x: c0.x, y: c0.y, tr: 'cut' }; } }   // start from the camera the action started with
      added.push(f); loaded.push(f); await evictSoon();
    }
    await insertFrames(b + 1, added);
  } finally { if (pm) pm.close(); }
  msel.clear(); tintCache.clear(); ppRetween(); buildStrip(); await selectFrame(b + 1); scheduleSave(); evictSoon(); updUndoBtns(); mselSync(); fxSyncBar();
  toast(`📺 Đã thêm phát lại chậm ${slow}× (${added.length} frame, sau frame ${b + 1}) — bấm ▶ Xem thử, ↶ để bỏ`, 4000);
}
/* --- final frame composition (used by playback & video export) --- */
function drawFrameBase(ctx, f, bg, live) {
  if (S.bgVideo) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  const fi = S.frames.indexOf(f);
  if (bg && bg.canvas && S.showBg) drawBgImg(ctx, fi, bg.canvas);
  drawSpeedLines(ctx, f, fi);
  drawCol(ctx, f); drawGhosts(ctx, f);
  if (f.canvas && S.showChar) ctx.drawImage(f.canvas, 0, 0);
  if (live) return;   // puppet + lines are drawn per video frame (smooth motion)
  if (S.pp && S.showPP) drawPuppet(ctx, f.pp, f.lip);
  if (S.showVec) drawVec(ctx, f.vec);
}
// what goes over the cached frame picture when the puppet moves smoothly: the in-between pose, then the vector lines
const ppLiveOver = (i, tIn, wrap) => ctx => { const f = S.frames[i]; jgClock = (f.lip && f.lip.jg) ? jgTime(f.lip) + tIn : null; boClock = boAny() ? boFrameT0(i) + tIn : null; try { drawPuppet(ctx, ppPoseAt(i, tIn, wrap), ppLipAt(i, tIn)); } finally { jgClock = null; boClock = null; } if (S.showVec && f.vec && f.vec.length) drawVec(ctx, f.vec); };
function drawFrameFx(ctx, i, baseImg, tsec, tInFrame, vid, over) {
  if (!trSkip && S.frames.some(f => f.tr || f.tre) && trRender(ctx, i, baseImg, tsec, tInFrame, vid, over, frameStartTimes())) return;
  drawFrameFx0(ctx, i, baseImg, tsec, tInFrame, vid, over);
}
function drawFrameFx0(ctx, i, baseImg, tsec, tInFrame, vid, over) {
  const f = S.frames[i], cam = camAt(i, tInFrame || 0), cf = camFx(i, tInFrame || 0);
  ctx.save(); camApply(ctx, { z: cam.z, x: cam.x + cf.ox, y: cam.y + cf.oy }, (f.shake || 0) + cf.sh, tsec, i);
  if (S.bgVideo) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); if (S.showBg) drawVideoCover(ctx, vid || bgVid.el); }
  ctx.drawImage(baseImg, 0, 0, W, H); if (over) over(ctx); ctx.restore();
  drawFocusLines(ctx, f, i, tInFrame); drawFilter(ctx, f);
  drawTexts(ctx, f, null, i, tInFrame);
  if (f.flash) { const a = Math.max(0, 0.9 * (1 - tInFrame / Math.max(0.05, f.dur / 1000))); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H); }
}
