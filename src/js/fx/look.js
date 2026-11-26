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
  const P = pzOpt();
  document.querySelectorAll('[data-pzn]').forEach(b => b.classList.toggle('on', +b.dataset.pzn === (f.pz ? f.pz.n : P.pn)));
  document.querySelectorAll('[data-pzd]').forEach(b => b.classList.toggle('on', +b.dataset.pzd === P.pd));
  if ($('#pzOn')) { $('#pzOn').classList.toggle('on', !!f.pz); $('#pzG').checked = !!P.pg; $('#pzS').checked = !!P.ps; }
  document.querySelectorAll('[data-rps]').forEach(b => b.classList.toggle('on', +b.dataset.rps === S.lookOpt.rs));
  const on = [f.bgs && `🏃 nền chạy ${BGS_DIRS[f.bgs.d][3].toLowerCase()}`, f.sl && `${SL_KINDS[f.sl.k][0]} đường ${SL_KINDS[f.sl.k][1].toLowerCase()}`, f.flt && `${FLT_KINDS[f.flt][0]} ${FLT_KINDS[f.flt][1].toLowerCase()}`, f.pz && '📸 paparazzi'].filter(Boolean);
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
/* 📸 Paparazzi (như phóng viên chụp ảnh): f.pz = {n, g, snd, s}. n = flashes per second, g = the character's face lights up white with
   each flash, snd = a camera shutter "tách" per flash, s = random seed (the same for the whole run, so a copy looks the same).
   Each frame makes its own flashes at random times + places (pzEvents; a flash lives PZ_LIFE s, so one fired near the end of the
   frame before still fades on this one): a bright core, a soft halo and a 4-ray star, added with 'lighter'. The face glow is drawn
   inside the camera (it sits on the head of every cut-out character, or on the top of the drawing found when the effect was set: pz.h).
   Moves in time while playing / exporting; on the edit screen (tab open), PNG and cover: one still moment with the flashes at full light.
   In the automatic undo (H_FKEYS), the 3 save places and frame copies (lookCopy). Sounds: scheduleAudio. GIF: pzWins. ===== */
const PZ_LIFE = 0.16, PZ_DENS = [[6, 'Ít'], [12, 'Vừa'], [22, 'Nhiều']], PZ_SECS = [1, 2, 3, 5];
const pzOpt = () => ({ pn: 12, pg: 1, ps: 1, pd: 2, ...S.lookOpt });   // saved settings from before this effect have no p* keys
function pzEvents(i) {   // [{t, x, y, s, r}] the flashes fired during frame i (t = seconds into the frame)
  const f = S.frames[i]; if (!f || !f.pz) return [];
  const R = slRand(((f.pz.s || 1) * 31 + i * 7919) | 0), d = f.dur / 1000, c = (f.pz.n || 12) * d, m = Math.floor(c) + (R() < c % 1 ? 1 : 0), out = [];
  for (let k = 0; k < Math.min(m, 400); k++) {
    const far = R() < 0.45;   // far cameras: small, near the top of the crowd; near ones: big, low and at the sides
    out.push({ t: R() * d, x: W * (0.02 + R() * 0.96), y: H * (far ? 0.22 + R() * 0.3 : 0.5 + R() * 0.48), s: far ? 0.35 + R() * 0.35 : 0.75 + R() * 0.65, r: R() * Math.PI / 2 });
  }
  return out;
}
const pzLight = u => u < 0 || u > 1 ? 0 : u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 2);
// the flashes lit at tIn on frame i, with their light 0..1 (tIn = null: a still picture, the frame's flashes all at full light)
function pzLit(i, tIn) {
  const f = S.frames[i]; if (!f || !f.pz) return [];
  if (tIn == null) return pzEvents(i).slice(0, Math.max(4, Math.round((f.pz.n || 12) / 2))).map(e => ({ ...e, k: 1 }));
  const out = [];
  for (const e of pzEvents(i)) { const k = pzLight((tIn - e.t) / PZ_LIFE); if (k > 0.01) out.push({ ...e, k }); }
  const g = S.frames[i - 1];
  if (g && g.pz && !f.scene) for (const e of pzEvents(i - 1)) { const k = pzLight((tIn + g.dur / 1000 - e.t) / PZ_LIFE); if (k > 0.01) out.push({ ...e, k }); }
  return out;
}
function drawPapFlash(ctx, i, tIn) {   // the star-bursts + a light white lift of the whole picture (over the camera, under texts)
  const L = pzLit(i, tIn); if (!L.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const u = W / 1080; let sum = 0;
  for (const e of L) {
    const r = 26 * u * e.s, k = e.k; sum += k * e.s;
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 4.5);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * k})`); g.addColorStop(0.18, `rgba(235,245,255,${0.55 * k})`); g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r * 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${k})`;
    for (let a = 0; a < 4; a++) {   // 4-ray star: two long rays, two short diagonal ones
      const an = e.r + a * Math.PI / 4, len = r * (a % 2 ? 2.6 : 6) * (0.6 + 0.4 * k), wd = r * 0.16;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(an); ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, -wd); ctx.lineTo(len, 0); ctx.lineTo(0, wd); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.55, 0, 7); ctx.fill();
  }
  if (tIn != null) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,255,255,${Math.min(0.28, sum * 0.07)})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function pzHeads(f) {   // [{x, y, r}] the faces to light up (doc pixels)
  const out = [];
  if (S.pp && S.pp.parts.length && S.showPP) {
    let pose = f.pp || {}; if (f.lip && f.lip.mv) pose = ppApplyMv(pose, f.lip.mv); if (f.lip && f.lip.off) pose = ppApplyOff(pose, f.lip.off);
    const M = ppMats(pose), off = lyrOff('lh');
    for (const p of S.pp.parts) {
      if (p.role !== 'head' || !p.c || (pose[p.id] && pose[p.id].h) || (off && off.has(p.id))) continue;
      const c = mApply(M[p.id], p.ox + p.c.width / 2, p.oy + p.c.height / 2), m = M[p.id], sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      out.push({ x: c.x, y: c.y, r: Math.max(p.c.width, p.c.height) * sc * 0.5 });
    }
  }
  if (!out.length && f.pz && f.pz.h) out.push({ x: f.pz.h[0], y: f.pz.h[1], r: f.pz.h[2] });
  return out;
}
function drawPapGlow(ctx, i, tIn) {   // the white glow on the face(s), inside the camera
  const f = S.frames[i]; if (!f || !f.pz || !f.pz.g) return;
  const L = pzLit(i, tIn); if (!L.length) return;
  const k = Math.min(1, Math.max(...L.map(e => e.k * Math.min(1, e.s)))) * (tIn == null ? 0.6 : 1); if (k < 0.02) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const h of pzHeads(f)) {
    const R = h.r * 1.7, g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, R);
    g.addColorStop(0, `rgba(255,255,255,${0.7 * k})`); g.addColorStop(0.5, `rgba(255,255,250,${0.35 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function pzWins(T) { const out = []; S.frames.forEach((f, i) => { if (f.pz) out.push({ t0: T[i], t1: T[i + 1], step: 0.04 }); }); return out; }
// the frames the effect goes on: the multi-selected ones, or from this frame for S.lookOpt.pd seconds (the last frame is made longer when the film ends first)
function pzIdx() {
  const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : [];
  if (sel.length) return { idx: sel, grow: 0 };
  const want = pzOpt().pd * 1000, idx = []; let t = 0, i = S.cur;
  while (i < S.frames.length && t < want - 1) { idx.push(i); t += S.frames[i].dur; i++; }
  return { idx, grow: Math.max(0, Math.round(want - t)) };
}
async function pzSet(on) {
  if (playing) stopPlay();
  const { idx, grow } = on ? pzIdx() : { idx: lkIdx(), grow: 0 };
  if (!on) {   // switch off on the whole run around this frame (or the selected frames)
    const sel = msel && msel.size > 1; let run = idx;
    if (!sel) { let a = S.cur, b = S.cur; while (a > 0 && S.frames[a - 1].pz) a--; while (b + 1 < S.frames.length && S.frames[b + 1].pz) b++; run = []; for (let i = a; i <= b; i++) run.push(i); }
    for (const i of run) { const f = S.frames[i]; delete f.pz; f.ver++; f.playKey = ''; queueThumbFor(f); }
    scheduleSave(); lookSync(); requestRender(); toast('Đã tắt 📸 Paparazzi', 2000); return;
  }
  const P = pzOpt(), seed = (Math.random() * 1e6) | 0, o = { n: P.pn, g: P.pg ? 1 : 0, snd: P.ps ? 1 : 0, s: seed };
  if (grow) { const L = S.frames[idx[idx.length - 1]]; L.dur = clamp(L.dur + grow, 20, 30000); }
  for (const i of idx) {
    const f = S.frames[i], val = { ...o };
    if (!(S.pp && S.pp.parts.some(p => p.role === 'head'))) { const b = await camSubject(f); if (b) { const r = Math.min(b.x1 - b.x0, (b.y1 - b.y0) * 0.3) * 0.5; val.h = [Math.round(b.hx), Math.round(b.y0 + r), Math.round(r)]; } }
    f.pz = val; f.ver++; f.playKey = ''; queueThumbFor(f);
  }
  scheduleSave(); lookSync(); requestRender();
  const secs = idx.reduce((a, i) => a + S.frames[i].dur, 0) / 1000;
  toast(`📸 Paparazzi ở ${idx.length} frame (${secs.toFixed(1)} giây)${grow ? ', frame cuối được kéo dài' : ''} — bấm ▶ Xem thử`, 3000);
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
const ppLiveOver = (i, tIn, wrap) => ctx => { const f = S.frames[i]; jgClock = (f.lip && f.lip.jg) ? jgTime(f.lip) + tIn : null; try { drawPuppet(ctx, ppPoseAt(i, tIn, wrap), ppLipAt(i, tIn)); } finally { jgClock = null; } if (S.showVec && f.vec && f.vec.length) drawVec(ctx, f.vec); };
function drawFrameFx(ctx, i, baseImg, tsec, tInFrame, vid, over) {
  if (!trSkip && S.frames.some(f => f.tr || f.tre) && trRender(ctx, i, baseImg, tsec, tInFrame, vid, over, frameStartTimes())) return;
  drawFrameFx0(ctx, i, baseImg, tsec, tInFrame, vid, over);
}
function drawFrameFx0(ctx, i, baseImg, tsec, tInFrame, vid, over) {
  const f = S.frames[i], cam = camAt(i, tInFrame || 0), cf = camFx(i, tInFrame || 0);
  ctx.save(); camApply(ctx, { z: cam.z, x: cam.x + cf.ox, y: cam.y + cf.oy }, (f.shake || 0) + cf.sh, tsec, i);
  if (S.bgVideo) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); if (S.showBg) drawVideoCover(ctx, vid || bgVid.el); }
  ctx.drawImage(baseImg, 0, 0, W, H); if (over) over(ctx);
  const pzt = f.pz ? (trSkip ? null : tInFrame || 0) : null; if (f.pz) drawPapGlow(ctx, i, pzt);
  ctx.restore();
  drawFocusLines(ctx, f, i, tInFrame); drawFilter(ctx, f); if (f.pz) drawPapFlash(ctx, i, pzt);
  drawTexts(ctx, f, null, i, tInFrame);
  if (f.flash) { const a = Math.max(0, 0.9 * (1 - tInFrame / Math.max(0.05, f.dur / 1000))); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H); }
}
