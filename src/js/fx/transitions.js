/* ===== 🎞 Transitions (chuyển cảnh): fade, crossfade, TV turning off, wipe, push, zoom blur, glitch, iris =====
   f.tr = {k, d, snd} = transition at the cut BEFORE frame f (into f; on frame 1 = film start),
   f.tre = the same at the cut AFTER frame f (on the last frame = film end). Both are in the automatic undo (H_FKEYS).
   Time-based: a transition can span many short frames. side 'both' straddles the cut, 'out' ends on it, 'in' starts on it.
   e ∈ [-1, 1] = where we are (negative = before the cut). Drawn by drawFrameFx, so playback, video and GIF all show it. */
const TR_KINDS = {
  dip: { label: 'Mờ qua đen', ic: '🌑', side: 'both', d: 0.8, tip: 'Hình tối dần thành màn đen rồi sáng dần ra cảnh sau (fade kiểu phim)' },
  white: { label: 'Mờ qua trắng', ic: '⚪', side: 'both', d: 0.8, tip: 'Hình sáng loá thành màn trắng rồi hiện ra cảnh sau (hồi tưởng, giấc mơ)' },
  cross: { label: 'Hoà cảnh', ic: '🔀', side: 'both', d: 0.8, tip: 'Cảnh trước mờ dần, cảnh sau hiện dần đè lên (crossfade)', two: true },
  tvoff: { label: 'Tắt màn hình', ic: '📺', side: 'out', d: 0.7, sfx: 'tvoff', tip: 'Như TV đời cũ bị tắt: hình co lại thành 1 vạch sáng, rồi 1 chấm, rồi tối hẳn + tiếng tách' },
  tvon: { label: 'Bật màn hình', ic: '📺', side: 'in', d: 0.6, sfx: 'tvon', tip: 'Ngược lại: 1 chấm sáng loé ra thành vạch rồi mở thành hình' },
  wipe: { label: 'Lau ngang', ic: '➡', side: 'both', d: 0.6, sfx: 'whoosh', tip: 'Cảnh sau quét từ trái sang phải đè lên cảnh trước', two: true },
  push: { label: 'Đẩy sang', ic: '⬅', side: 'both', d: 0.5, sfx: 'whoosh', tip: 'Cảnh sau đẩy cảnh trước trượt ra khỏi màn hình', two: true },
  zoom: { label: 'Phóng mờ', ic: '🌀', side: 'both', d: 0.5, sfx: 'whoosh', tip: 'Lao vút vào giữa hình, mờ nhoè, rồi bung ra cảnh sau' },
  glitch: { label: 'Nhiễu glitch', ic: '📼', side: 'both', d: 0.5, sfx: 'glitch', tip: 'Hình giật, xé ngang, lệch màu như băng hỏng rồi sang cảnh sau' },
  iris: { label: 'Khép tròn', ic: '⚫', side: 'both', d: 1, tip: 'Vòng tròn khép lại thành màn đen rồi mở ra cảnh sau (kiểu phim hoạt hình cũ)' }
};
SETTINGS_KEYS.push('trOpt');
S.trOpt = { at: 'out', snd: true };
let trSkip = false, trSrc = null;   // trSkip: still pictures (PNG, cover) skip transitions; trSrc(j) → {img, live} base of another frame
// every transition in the film with its time window
function trList(T) {
  const n = S.frames.length, out = []; T = T || frameStartTimes();
  const add = (c, tr) => {
    const K = TR_KINDS[tr.k]; if (!K) return; const d = clamp(+tr.d || K.d, 0.1, 5), Tc = T[c];
    let side = K.side; if (side === 'both' && c === 0) side = 'in'; if (side === 'both' && c === n) side = 'out';
    if ((side === 'out' && c === 0) || (side === 'in' && c === n)) return;
    const t0 = side === 'in' ? Tc : side === 'out' ? Tc - d : Tc - d / 2, t1 = side === 'in' ? Tc + d : side === 'out' ? Tc : Tc + d / 2;
    out.push({ c, k: tr.k, d, side, Tc, t0, t1, snd: tr.snd !== false, two: !!K.two && c > 0 && c < n });
  };
  for (let c = 0; c <= n; c++) { const a = S.frames[c] && S.frames[c].tr, b = c > 0 && S.frames[c - 1].tre; if (a) add(c, a); if (b && !(a && a.k === b.k)) add(c, b); }
  return out;
}
const trE = (x, t) => clamp(x.side === 'both' ? (t - x.Tc) / (x.d / 2) : (t - x.Tc) / x.d, -1, 1);
// frames whose picture a two-picture transition needs at time t (besides the current one)
function trOthers(t, T) { return trList(T).filter(x => x.two && t >= x.t0 && t < x.t1).map(x => t < x.Tc ? x.c : x.c - 1); }
const trCanvas = [null, null, null, null];
function trBuf(k, w, h) { let c = trCanvas[k]; if (!c) c = trCanvas[k] = makeCanvas(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h); x.setTransform(w / W, 0, 0, h / H, 0, 0); return c; }
const trRand = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// draws one transition at e from picture `cur` (and `oth` = the other side) into ctx (document coordinates)
function trDraw(ctx, x, e, cur, oth, t) {
  const k = x.k, a = Math.abs(e), sm = EASE.inout, A = e < 0 ? cur : oth, B = e < 0 ? oth : cur, m = sm((e + 1) / 2);
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if ((k === 'cross' || k === 'wipe' || k === 'push') && (!x.two || !oth)) { ctx.drawImage(cur, 0, 0, W, H); ctx.fillStyle = `rgba(0,0,0,${1 - sm(a)})`; ctx.fillRect(0, 0, W, H); }
  else if (k === 'dip' || k === 'white') { ctx.drawImage(cur, 0, 0, W, H); ctx.fillStyle = k === 'dip' ? `rgba(0,0,0,${1 - sm(a)})` : `rgba(255,255,255,${1 - sm(a)})`; ctx.fillRect(0, 0, W, H); }
  else if (k === 'cross') { ctx.drawImage(A, 0, 0, W, H); ctx.globalAlpha = m; ctx.drawImage(B, 0, 0, W, H); }
  else if (k === 'wipe') {
    const xw = m * W * 1.1 - W * 0.05; ctx.drawImage(A, 0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, xw), H); ctx.clip(); ctx.drawImage(B, 0, 0, W, H); ctx.restore();
    const g = ctx.createLinearGradient(xw - W * 0.04, 0, xw + W * 0.02, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(xw - W * 0.04, 0, W * 0.06, H);
  } else if (k === 'push') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(A, -m * W, 0, W, H); ctx.drawImage(B, (1 - m) * W, 0, W, H); }
  else if (k === 'zoom') {
    const p = Math.pow(1 - a, 2), s = 1 + 1.4 * p; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { const si = s * (1 + i * 0.05 * p); ctx.globalAlpha = i ? 0.28 * p : 1; ctx.drawImage(cur, W / 2 - W * si / 2, H / 2 - H * si / 2, W * si, H * si); }
    ctx.globalAlpha = 1; ctx.fillStyle = `rgba(255,255,255,${0.55 * p})`; ctx.fillRect(0, 0, W, H);
  } else if (k === 'glitch') {
    const g = Math.pow(1 - a, 1.5), fr = Math.floor(t * 24), img = x.two && oth && a < 0.35 && trRand(fr + 7) < 0.45 ? oth : cur;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
    const bands = 6 + Math.floor(g * 12);
    for (let i = 0; i < bands; i++) {
      if (trRand(fr * 31 + i) > 0.25 + g * 0.7) continue;
      const y = trRand(fr * 17 + i * 3) * H, h = H * (0.01 + trRand(fr + i * 9) * 0.08 * (0.3 + g)), dx = (trRand(fr * 5 + i) - 0.5) * W * 0.35 * g;
      const sy = y * img.height / H, sh = Math.max(1, h * img.height / H);
      ctx.drawImage(img, 0, sy, img.width, sh, dx, y, W, h);
    }
    if (g > 0.12) {   // colour split: red channel shifted one way, green+blue the other
      const off = W * 0.02 * g * (trRand(fr) < 0.5 ? 1 : -1), rc = trBuf(3, img.width, img.height), rx = rc.getContext('2d');
      rx.drawImage(img, 0, 0, W, H); rx.globalCompositeOperation = 'multiply'; rx.fillStyle = '#f00'; rx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#0ff'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(rc, off, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.18 * g;
    for (let yy = 0; yy < H; yy += H / 160) { ctx.fillStyle = trRand(fr + yy) < 0.5 ? '#000' : '#fff'; ctx.fillRect(0, yy, W, H / 400); }
  } else if (k === 'iris') {
    const R = Math.hypot(W, H) / 2 * sm(a), cx = W / 2, cy = H / 2; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (R > 0.5) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(cur, 0, 0, W, H); ctx.restore(); }
  } else if (k === 'tvoff' || k === 'tvon') trTv(ctx, cur, k === 'tvoff' ? 1 + e : 1 - e);
  ctx.restore();
}
// old CRT TV switching off, q = 0 (picture) → 1 (dark): squash to a bright line, the line shrinks to a dot, the dot fades
function trTv(ctx, img, q) {
  q = clamp(q, 0, 1); const u = Math.min(W, H) / 1080; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (q < 0.5) {
    const p = q / 0.5, sy = Math.max(0.004, 1 - EASE.in(p) * 0.996), sx = 1 + 0.06 * p, w = W * sx, h = H * sy;
    ctx.drawImage(img, W / 2 - w / 2, H / 2 - h / 2, w, h);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, p * 1.3)})`; ctx.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
    ctx.shadowColor = 'rgba(200,230,255,.9)'; ctx.shadowBlur = 30 * u * p; ctx.fillStyle = `rgba(255,255,255,${p * 0.6})`; ctx.fillRect(W / 2 - w / 2, H / 2 - Math.max(h, 4 * u) / 2, w, Math.max(h, 4 * u));
  } else if (q < 0.82) {
    const p = (q - 0.5) / 0.32, w = Math.max(8 * u, W * 1.06 * (1 - EASE.in(p))), h = Math.max(2, 5 * u * (1 - p * 0.4));
    ctx.shadowColor = 'rgba(190,225,255,1)'; ctx.shadowBlur = 26 * u; ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
  } else {
    const p = (q - 0.82) / 0.18, r = 7 * u * (1 - p * 0.6);
    ctx.globalAlpha = 1 - EASE.in(p); ctx.shadowColor = 'rgba(190,225,255,1)'; ctx.shadowBlur = 24 * u; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}
// exports: keep the base picture of the other frame a two-picture transition needs (built on demand, at most a few)
function trSrcCache(live) {
  const m = new Map();
  return {
    async prep(t, T) {
      const need = trOthers(t, T);
      for (const [j, c] of m) if (!need.includes(j)) { c.width = 0; m.delete(j); }
      for (const j of need) if (!m.has(j)) { const f = S.frames[j]; await ghostLoad(f); await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg); const c = makeCanvas(); drawFrameBase(c.getContext('2d'), f, bg, live); m.set(j, c); }
      trSrc = j => m.has(j) ? { img: m.get(j), live } : null;
    },
    done() { for (const c of m.values()) c.width = 0; m.clear(); trSrc = null; }
  };
}
const playTrSrc = j => S.frames[j] && S.frames[j].play ? { img: S.frames[j].play, live: ppSmoothOn() } : null;
// renders frame i at time t with its transitions: the plain frame goes into a buffer, each active transition reworks it
function trRender(ctx, i, baseImg, tsec, tInFrame, vid, over, T) {
  const t = T[i] + (tInFrame || 0), act = trList(T).filter(x => t >= x.t0 && t < x.t1);
  if (!act.length) return false;
  const m = ctx.getTransform(), k = clamp(Math.hypot(m.a, m.b), 0.25, 1), bw = Math.max(2, Math.round(W * k)), bh = Math.max(2, Math.round(H * k));
  let cur = trBuf(0, bw, bh); drawFrameFx0(cur.getContext('2d'), i, baseImg, tsec, tInFrame, vid, over);
  act.forEach((x, n) => {
    const e = trE(x, t); let oth = null;
    if (x.two && trSrc) {
      const j = t < x.Tc ? x.c : x.c - 1, src = trSrc(j);
      if (src && src.img) { const tj = j === x.c ? 0 : S.frames[j].dur / 1000 - 1e-3; oth = trBuf(1, bw, bh); drawFrameFx0(oth.getContext('2d'), j, src.img, T[j] + tj, tj, vid, src.live ? ppLiveOver(j, tj, false) : null); }
    }
    if (n === act.length - 1) { trDraw(ctx, x, e, cur, oth, t); return; }
    const nx = trBuf(2, bw, bh); trDraw(nx.getContext('2d'), x, e, cur, oth, t);
    const keep = trCanvas[0]; trCanvas[0] = nx; trCanvas[2] = keep; cur = nx;
  });
  return true;
}
/* --- GIF / PNG export (no sound): sticker loops, previews, frames for other editors --- */
// median-cut palette (≤256 colours) on a 15-bit histogram; cartoons have flat colours so no dithering
function gifPalette(d) {
  const hist = new Uint32Array(32768);
  for (let i = 0; i < d.length; i += 4) hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
  const bins = []; for (let k = 0; k < 32768; k++) if (hist[k]) bins.push(k);
  const ch = (k, c) => c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31;
  const mk = list => { let lo = [31, 31, 31], hi = [0, 0, 0], n = 0; for (const k of list) { for (let c = 0; c < 3; c++) { const v = ch(k, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } n += hist[k]; } return { list, lo, hi, n }; };
  const boxes = [mk(bins)];
  while (boxes.length < 256) {
    let bi = -1, bs = 0;
    boxes.forEach((b, i) => { if (b.list.length < 2) return; const r = Math.max(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]); const sc = r * Math.sqrt(b.n); if (sc > bs) { bs = sc; bi = i; } });
    if (bi < 0) break;
    const b = boxes[bi], r = [0, 1, 2].map(c => b.hi[c] - b.lo[c]), c = r.indexOf(Math.max(...r));
    b.list.sort((x, y) => ch(x, c) - ch(y, c));
    let acc = 0, cut = 1; for (let i = 0; i < b.list.length - 1; i++) { acc += hist[b.list[i]]; if (acc >= b.n / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, mk(b.list.slice(0, cut)), mk(b.list.slice(cut)));
  }
  const pal = new Uint8Array(768), lut = new Uint8Array(32768);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0; for (const k of b.list) { const w = hist[k]; r += ((k >> 10) * 8 + 4) * w; g += (((k >> 5) & 31) * 8 + 4) * w; bl += ((k & 31) * 8 + 4) * w; }
    pal[i * 3] = Math.round(r / b.n); pal[i * 3 + 1] = Math.round(g / b.n); pal[i * 3 + 2] = Math.round(bl / b.n);
    for (const k of b.list) lut[k] = i;
  });
  return { pal, lut };
}
function gifLzw(idx, out) {
  const MIN = 8, CLEAR = 256, EOI = 257, table = new Int16Array(4096 * 256).fill(-1);
  let size = MIN + 1, next = EOI + 1, cur = 0, nb = 0, blk = [];
  const flush = () => { if (blk.length) { out.push(new Uint8Array([blk.length, ...blk])); blk = []; } };
  const emit = c => { cur |= c << nb; nb += size; while (nb >= 8) { blk.push(cur & 255); cur >>>= 8; nb -= 8; if (blk.length === 255) flush(); } };
  out.push(new Uint8Array([MIN]));
  emit(CLEAR); let pre = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = pre * 256 + k, v = table[key];
    if (v >= 0) { pre = v; continue; }
    emit(pre);
    if (next === 4096) { emit(CLEAR); table.fill(-1); next = EOI + 1; size = MIN + 1; }
    else { if (next >= (1 << size)) size++; table[key] = next++; }
    pre = k;
  }
  emit(pre); emit(EOI); if (nb > 0) { blk.push(cur & 255); if (blk.length === 255) flush(); }
  flush(); out.push(new Uint8Array([0]));
}
function gifEncoder(w, h) {
  const out = [], u16 = v => [v & 255, (v >> 8) & 255];
  out.push(new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0)).concat(u16(w), u16(h), [0, 0, 0])));
  out.push(new Uint8Array([0x21, 0xFF, 11, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0]));   // loop forever
  let tWant = 0, tOut = 0;   // GIF delays are whole 1/100 s: carry the rounding over so 12/24 fps GIFs keep the real total time (and stay in sync)
  return {
    add(d, delayCs) {
      tWant += delayCs; const cs = Math.max(2, Math.round(tWant - tOut)); tOut += cs;
      const { pal, lut } = gifPalette(d), n = w * h, idx = new Uint8Array(n);
      for (let i = 0, j = 0; i < n; i++, j += 4) idx[i] = lut[((d[j] >> 3) << 10) | ((d[j + 1] >> 3) << 5) | (d[j + 2] >> 3)];
      out.push(new Uint8Array([0x21, 0xF9, 4, 0x04, ...u16(cs), 0, 0]));
      out.push(new Uint8Array([0x2C, 0, 0, 0, 0, ...u16(w), ...u16(h), 0x87]), pal);
      gifLzw(idx, out);
    },
    finish() { out.push(new Uint8Array([0x3B])); return new Blob(out, { type: 'image/gif' }); }
  };
}
// one finished frame (background, colour, lines, puppet, vector, camera, texts, flash) drawn into ctx at W×H
async function renderFinalFrame(ctx, i, base, tIn = 0, withTr = false) {
  const f = S.frames[i]; await ghostLoad(f); await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const bx = base.getContext('2d'); drawFrameBase(bx, f, bg);
  if (vtOn()) await vtSeekAt(frameStartTimes()[i] + tIn);
  else if (S.bgVideo && bgVid.ready) { const v = bgVid.el; try { v.currentTime = bgVideoTimeAt(i); await new Promise(r => { v.onseeked = r; setTimeout(r, 600); }); } catch (e) {} }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore();
  trSkip = !withTr; try { drawFrameFx(ctx, i, base, frameStartTimes()[i] + tIn, tIn); } finally { trSkip = false; }
}
async function exportImagesDialog() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  const n = S.frames.length, secs = (frameStartTimes()[n]).toFixed(1);
  const v = await modal({ title: '🖼 Xuất GIF / ảnh PNG', html: `<p class="lbl">Không có tiếng. Có chữ, camera, hiệu ứng như video. ${n} frame · ${secs}s.</p>
<div class="set-row"><span>GIF động — cỡ chiều ngang</span><span class="grp"><button class="chip small" data-gw="320">320</button><button class="chip small on" data-gw="480">480</button><button class="chip small" data-gw="720">720</button></span></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '📸 Ảnh bìa chữ to', value: 'cover' }, { label: '🖼 Ảnh frame này (PNG)', value: 'one' }, { label: '🗂 Mọi frame (ZIP PNG)', value: 'seq' }, { label: '🎞 GIF động', value: 'gif', primary: true }],
    onOpen: ov => ov.querySelectorAll('[data-gw]').forEach(b => b.addEventListener('click', () => { ov.querySelectorAll('[data-gw]').forEach(x => x.classList.toggle('on', x === b)); exportGifW = +b.dataset.gw; })) });
  if (v) await fontsReady();
  if (v === 'gif') return exportGif(exportGifW);
  if (v === 'seq') return exportPngSeq();
  if (v === 'one') return exportPngOne();
  if (v === 'cover') return coverDialog();
}
let exportGifW = 480, exportBusy = false;
async function exportGif(gw) {
  if (exportBusy) return; exportBusy = true;
  const k = Math.min(1, gw / W), w = Math.round(W * k) & ~1, h = Math.round(H * k) & ~1;
  const big = makeCanvas(), bctx = big.getContext('2d'), base = makeCanvas(), small = makeCanvas(w, h), sx = small.getContext('2d', { willReadFrequently: true });
  const enc = gifEncoder(w, h), pm = progress('Đang tạo GIF…'), T = frameStartTimes(), trs = trList(T), txw = [...txWins(T), ...camWins(T)], ts = trSrcCache(false);
  try {
    for (let i = 0; i < S.frames.length; i++) {
      pm.set(`Đang tạo GIF ${i + 1}/${S.frames.length}…`); await new Promise(r => setTimeout(r, 0));
      // inside a transition the frame is split into 1/20 s pictures so the fade / TV-off moves in the GIF too
      const a = T[i], b = T[i + 1], pts = new Set([a]);
      for (const x of [...trs, ...txw]) { const u0 = Math.max(a, x.t0), u1 = Math.min(b, x.t1); if (u1 <= u0) continue; for (let u = u0; u < u1 - 1e-4; u += x.step || 0.05) pts.add(+u.toFixed(4)); if (u1 < b - 1e-4) pts.add(+u1.toFixed(4)); }
      const arr = [...pts].sort((p, q) => p - q).filter((u, k, l) => k === 0 || u - l[k - 1] > 0.009);
      for (let k = 0; k < arr.length; k++) {
        const u = arr[k], nx = k + 1 < arr.length ? arr[k + 1] : b;
        if (trs.length) await ts.prep(u, T);
        await renderFinalFrame(bctx, i, base, u - a, true);
        sx.imageSmoothingQuality = 'high'; sx.drawImage(big, 0, 0, w, h);
        enc.add(sx.getImageData(0, 0, w, h).data, (nx - u) * 100);
      }
      evictSoon();
    }
    const blob = enc.finish(); pm.close();
    await deliverFile(blob, `frame-studio-${stamp()}.gif`);
    toast(`GIF ${w}×${h} · ${(blob.size / 1e6).toFixed(1)} MB`, 3000);
  } catch (e) { pm.close(); console.error(e); toast('Không tạo được GIF: ' + e.message, 4000); }
  finally { ts.done(); big.width = base.width = small.width = 0; exportBusy = false; }
}
// comic text uses the embedded Bangers font: wait for it before drawing frames to export
const fontsReady = () => Promise.all([document.fonts && document.fonts.load ? document.fonts.load('100px Bangers').catch(() => {}) : null, panoReady()]);   // + 🌄 Nền dài pictures decoded
// PNG bytes kept in memory before one ZIP is made: past this, the ZIP is split into parts so a long film doesn't crash the tablet
let PNG_ZIP_PART = (navigator.deviceMemory || 4) >= 8 ? 400e6 : 150e6;
async function exportPngSeq() {
  if (exportBusy) return; exportBusy = true;
  const big = makeCanvas(), bctx = big.getContext('2d'), base = makeCanvas(), n = S.frames.length, enc = new TextEncoder(), st = stamp();
  let files = [], bytes = 0, part = 0, pm = progress('Đang xuất ảnh…');
  const flush = async last => {
    part++; const blob = makeZip(files); files = []; bytes = 0; pm.close(); pm = null;
    const name = last && part === 1 ? `frame-studio-png-${st}.zip` : `frame-studio-png-${st}-phan${part}.zip`;
    if (part > 1 || !last) {   // a tap gives the save/share sheet the user gesture it needs after a long export
      const go = await modal({ title: '🗂 Xuất ảnh PNG', html: `<p>Đã xong <b>phần ${part}</b>${last ? ' (phần cuối)' : ''}. Phim dài nên ảnh được chia thành nhiều file ZIP cho máy không bị đầy bộ nhớ.</p>`,
        buttons: [{ label: 'Dừng', value: false }, { label: `💾 Lưu phần ${part}`, value: true, primary: true }] });
      if (!go) return false;
    }
    await deliverFile(blob, name); if (!last) pm = progress('Đang xuất ảnh…'); return true;
  };
  try {
    let list = 'frame\tthoi_luong_ms\n';
    for (let i = 0; i < n; i++) {
      pm.set(`Đang xuất ảnh ${i + 1}/${n}…`); await new Promise(r => setTimeout(r, 0));
      await renderFinalFrame(bctx, i, base);
      const name = `frame_${String(i + 1).padStart(4, '0')}.png`, data = new Uint8Array(await (await toBlob(big)).arrayBuffer());
      files.push({ name, data }); bytes += data.length; list += `${name}\t${S.frames[i].dur}\n`;
      evictSoon();
      if (bytes >= PNG_ZIP_PART && i < n - 1 && !(await flush(false))) return;
    }
    files.push({ name: 'thoi-luong.txt', data: enc.encode(list) });
    await flush(true);
  } catch (e) { if (pm) pm.close(); console.error(e); toast('Không xuất được: ' + e.message, 4000); }
  finally { files = []; big.width = base.width = 0; exportBusy = false; }
}
async function exportPngOne() {
  if (exportBusy) return; exportBusy = true;
  const big = makeCanvas(), base = makeCanvas();
  try {
    await renderFinalFrame(big.getContext('2d'), S.cur, base);
    await deliverFile(await toBlob(big), `frame-${S.cur + 1}-${stamp()}.png`);
  } catch (e) { console.error(e); toast('Không xuất được: ' + e.message, 4000); }
  finally { big.width = base.width = 0; exportBusy = false; }
}
