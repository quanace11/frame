/* ===== Animate-style timeline tools: frame rate + "hold" (exposure), scrub bar, play speed, ✨ inbetweens (tween) =====
   Durations stay in ms per frame (f.dur); S.fps only gives the step for − / + so frames can be held "on 1s, 2s, 3s" like in pro animation apps. */
SETTINGS_KEYS.push('fps'); S.fps = 12;
const FPS_LIST = [6, 8, 12, 15, 24, 30];
const fpsMs = () => 1000 / (S.fps || 12);
const expOf = f => Math.max(1, Math.round(f.dur / fpsMs()));
function expSync() {
  const f = curFrame(), l = document.getElementById('expLbl'); if (!f || !l) return;
  const n = f.dur / fpsMs(), exact = Math.abs(n - Math.round(n)) < 0.05;
  l.textContent = `${exact ? '' : '≈'}${Math.max(1, Math.round(n))} khung · ${S.fps}fps`;
  document.getElementById('expMinus').disabled = Math.round(n) <= 1 && exact;
}
function expStep(d) {
  const f = curFrame(); if (!f) return;
  const n = Math.max(1, Math.round(f.dur / fpsMs()) + d);
  setDur(n * fpsMs()); toast(`Frame ${S.cur + 1} giữ ${n} khung (${fmtDur(f.dur)})`, 1200);
}
async function fpsDialog() {
  const v = await modal({ title: '🎞 Số khung hình / giây (fps)', html: `<p class="lbl">Hoạt hình thường vẽ ở 12 hoặc 24 fps. Nút − / + cạnh thời lượng sẽ thêm hoặc bớt đúng 1 khung theo số này (frame giữ 2 khung = "vẽ đôi", chuyển động kiểu hoạt hình).</p>
<div class="set-row"><span>fps</span><span class="grp">${FPS_LIST.map(n => `<button class="chip small ${S.fps === n ? 'on' : ''}" data-fps="${n}">${n}</button>`).join('')}</span></div>
<p class="lbl">“Làm tròn” đổi thời lượng mọi frame về số khung gần nhất (vd. 0.1s ở 12fps → 1 khung = 0.083s).</p>`,
    buttons: [{ label: 'Làm tròn mọi frame', value: 'snap' }, { label: 'Xong', value: 'ok', primary: true }],
    onOpen: ov => ov.querySelectorAll('[data-fps]').forEach(b => b.addEventListener('click', () => { S.fps = +b.dataset.fps; saveSettings(); ov.querySelectorAll('[data-fps]').forEach(x => x.classList.toggle('on', x === b)); expSync(); })) });
  if (v === 'snap') { S.frames.forEach(f => f.dur = clamp(Math.round(expOf(f) * fpsMs()), 20, 30000)); updateFrameUI(); scheduleSave(); toast(`Đã làm tròn ${S.frames.length} frame theo ${S.fps}fps — hoàn tác được`, 2500); }
}
$('#expMinus').addEventListener('click', () => expStep(-1));
$('#expPlus').addEventListener('click', () => expStep(1));
$('#expLbl').addEventListener('click', fpsDialog);
// play speed: 1× → ½× → ¼×
function speedSync() { const b = document.getElementById('speedBtn'); b.textContent = playSpeed === 1 ? '1×' : playSpeed === 0.5 ? '½×' : '¼×'; b.classList.toggle('on', playSpeed !== 1); }
$('#speedBtn').addEventListener('click', () => { const was = playing; if (was) stopPlay(); playSpeed = playSpeed === 1 ? 0.5 : playSpeed === 0.5 ? 0.25 : 1; speedSync(); if (was) startPlay(); else toast(playSpeed === 1 ? 'Phát đúng tốc độ' : `Phát chậm ${playSpeed === 0.5 ? '½' : '¼'}× để soi chuyển động (video xuất ra vẫn đúng tốc độ)`, 2000); });

/* --- scrub bar: one coloured block per frame (width = how long it shows); drag along it to flip through frames --- */
let scrubBusy = false;
function scrubDraw() {
  const cv = document.getElementById('scrub'); if (!cv || !S.frames || !S.frames.length) return;
  const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight), d = DPR || 1;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
  const T = frameStartTimes(), tot = T[T.length - 1] || 1, cur = playing ? playIdx : S.cur, rg = playing ? playRange : playRangeGet();
  x.fillStyle = '#1b1d24'; x.fillRect(0, 0, w, h);
  S.frames.forEach((f, i) => {
    const a = T[i] / tot * w, b = T[i + 1] / tot * w;
    x.fillStyle = i === cur ? '#ffb21e' : rg && i >= rg[0] && i <= rg[1] ? (i % 2 ? '#3d5a8a' : '#4a6aa0') : (i % 2 ? '#2c2f3a' : '#353946');
    x.fillRect(a, 4, Math.max(1, b - a - (b - a > 3 ? 1 : 0)), h - 8);
  });
  // a tick every second
  x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '10px system-ui,sans-serif'; x.textBaseline = 'top';
  for (let s = 1; s < tot; s++) { const px = s / tot * w; x.fillRect(px, 0, 1, 5); if (tot < 40 || s % 5 === 0) x.fillText(s + 's', px + 2, 0); }
  const ph = (T[cur] + (T[cur + 1] - T[cur]) / 2) / tot * w;
  x.fillStyle = '#fff'; x.fillRect(ph - 1, 0, 2, h);
  const lbl = `${cur + 1}/${S.frames.length} · ${T[cur].toFixed(2)}s / ${tot.toFixed(1)}s`;
  x.font = 'bold 11px system-ui,sans-serif'; x.textBaseline = 'middle'; const tw = x.measureText(lbl).width;
  x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(w - tw - 10, 5, tw + 8, h - 10); x.fillStyle = '#fff'; x.fillText(lbl, w - tw - 6, h / 2);
  if (!playing) atlDraw();
}
function scrubIndexAt(clientX) {
  const cv = document.getElementById('scrub'), r = cv.getBoundingClientRect(), T = frameStartTimes(), tot = T[T.length - 1] || 1;
  const t = clamp((clientX - r.left) / r.width, 0, 0.99999) * tot;
  let i = 0; while (i < S.frames.length - 1 && T[i + 1] <= t) i++; return i;
}
{ const cv = document.getElementById('scrub'); let pid = null, want = -1;
  const go = async () => { if (scrubBusy) return; scrubBusy = true; try { while (want >= 0 && want !== S.cur) { const i = want; await selectFrame(i); } } finally { scrubBusy = false; } };
  cv.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); if (playing) stopPlay(); pid = e.pointerId; try { cv.setPointerCapture(pid); } catch (_) {} want = scrubIndexAt(e.clientX); go(); });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; want = scrubIndexAt(e.clientX); go(); });
  const up = e => { if (e.pointerId === pid) { pid = null; want = -1; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  new ResizeObserver(() => scrubDraw()).observe(cv); }

/* --- ✨ inbetweens: frames between the current frame (A) and the next one (B).
   Vector strokes with the same id in A and B (made by "Nhân bản frame" then moving points) are blended point by point;
   puppet poses tween through the normal keyframe system (new frames are auto, not 🔑); pixels are held (A in the first half, B after). --- */
function ibResample(pts, n) {
  if (pts.length === n) return pts.map(q => ({ x: q.x, y: q.y }));
  if (pts.length < 2) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const tot = L[L.length - 1] || 1, out = []; let j = 0;
  for (let k = 0; k < n; k++) { const s = tot * k / (n - 1); while (j < pts.length - 2 && L[j + 1] < s) j++; const u = L[j + 1] > L[j] ? (s - L[j]) / (L[j + 1] - L[j]) : 0; out.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * u, y: pts[j].y + (pts[j + 1].y - pts[j].y) * u }); }
  return out;
}
function ibLerpCol(a, b, t) {
  const h = /^#([0-9a-f]{6})$/i; if (!h.test(a || '') || !h.test(b || '') || a === b) return t < 0.5 ? a : b;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}
/* stroke pairs A → B: same id first (Nhân bản frame), then ✨ auto-match for strokes drawn again on the key frame:
   cost = how far the stroke moved + how different its shape is (both centred) + length + colour + drawing order; cheapest first.
   Open strokes may be drawn the other way round (rev); a closed loop (head, ball) may start somewhere else (rot). */
function ibFeat(st, k, n) {
  const R = ibResample(st.pts, 24); let cx = 0, cy = 0; for (const q of R) { cx += q.x; cy += q.y; } cx /= R.length; cy /= R.length;
  let len = 0; for (let i = 1; i < st.pts.length; i++) len += Math.hypot(st.pts[i].x - st.pts[i - 1].x, st.pts[i].y - st.pts[i - 1].y);
  const p0 = st.pts[0], p1 = st.pts[st.pts.length - 1];
  return { st, R, cx, cy, len, ord: n > 1 ? k / (n - 1) : 0, closed: st.pts.length > 4 && Math.hypot(p1.x - p0.x, p1.y - p0.y) < Math.max(10, len * 0.12) };
}
function ibShape(fa, fb) {   // mean distance of the centred shapes, best of both directions
  let f = 0, r = 0; const n = fa.R.length;
  for (let k = 0; k < n; k++) { const a = fa.R[k], b = fb.R[k], c = fb.R[n - 1 - k];
    f += Math.hypot(a.x - fa.cx - (b.x - fb.cx), a.y - fa.cy - (b.y - fb.cy)); r += Math.hypot(a.x - fa.cx - (c.x - fb.cx), a.y - fa.cy - (c.y - fb.cy)); }
  return Math.min(f, r) / n;
}
function ibPairs(va, vb) {
  va = va || []; vb = vb || [];
  const ids = new Map(vb.map(st => [st.id, st])), out = [], usedB = new Set(), restA = [];
  for (const sa of va) { const sb = ids.get(sa.id); if (sb && !usedB.has(sb)) { usedB.add(sb); out.push({ sa, sb }); } else if (sa.pts.length) restA.push(sa); }
  const restB = vb.filter(st => !usedB.has(st) && st.pts.length);
  if (restA.length && restB.length && restA.length * restB.length <= 40000) {
    const D = Math.hypot(W, H), FA = restA.map((st, k) => ibFeat(st, k, restA.length)), FB = restB.map((st, k) => ibFeat(st, k, restB.length)), C = [];
    for (const fa of FA) for (const fb of FB) {
      const c = Math.hypot(fa.cx - fb.cx, fa.cy - fb.cy) + ibShape(fa, fb) + 0.5 * Math.abs(fa.len - fb.len) + (fa.st.c !== fb.st.c ? 0.06 * D : 0) + 0.12 * D * Math.abs(fa.ord - fb.ord) + (fa.closed !== fb.closed ? 0.05 * D : 0);
      if (c < 0.3 * D) C.push({ c, fa, fb });
    }
    C.sort((x, y) => x.c - y.c);
    const ua = new Set(), ub = new Set();
    for (const { fa, fb } of C) {
      if (ua.has(fa) || ub.has(fb)) continue; ua.add(fa); ub.add(fb);
      const pr = { sa: fa.st, sb: fb.st, auto: true }, A = fa.st.pts, B = fb.st.pts;
      if (fa.closed && fb.closed) {   // loops: pick the start point + direction on B that lines up best with A
        const n = 48, RA = ibResample(A, n), dx = fb.cx - fa.cx, dy = fb.cy - fa.cy; let best = Infinity;
        for (const rev of [false, true]) { const RB = ibResample(rev ? B.slice().reverse() : B, n);
          for (let o = 0; o < n; o++) { let s = 0; for (let k = 0; k < n; k++) { const q = RB[(k + o) % n]; s += Math.hypot(RA[k].x + dx - q.x, RA[k].y + dy - q.y); } if (s < best) { best = s; pr.rev = rev; pr.rot = o / n; } } }
      } else pr.rev = Math.hypot(A[0].x - B[B.length - 1].x, A[0].y - B[B.length - 1].y) + Math.hypot(A[A.length - 1].x - B[0].x, A[A.length - 1].y - B[0].y)
        < Math.hypot(A[0].x - B[0].x, A[0].y - B[0].y) + Math.hypot(A[A.length - 1].x - B[B.length - 1].x, A[A.length - 1].y - B[B.length - 1].y);
      out.push(pr);
    }
  }
  const pa = new Set(out.map(p => p.sa)), pb = new Set(out.map(p => p.sb));
  return { pairs: out, onlyA: va.filter(st => !pa.has(st)), onlyB: vb.filter(st => !pb.has(st)), auto: out.filter(p => p.auto).length };
}
function ibVec(va, vb, t, P) {
  P = P || ibPairs(va, vb); const out = [], copy = s => ({ id: s.id, c: s.c, w: s.w, a: s.a, pts: s.pts.map(q => ({ x: q.x, y: q.y })) });
  const order = new Map((va || []).map((s, k) => [s, k]));
  const items = P.pairs.slice().sort((x, y) => order.get(x.sa) - order.get(y.sa));
  for (const { sa, sb, rev, rot } of items) {
    const n = Math.max(sa.pts.length, sb.pts.length, rot != null ? 48 : 2), A = ibResample(sa.pts, n);
    let B = ibResample(rev ? sb.pts.slice().reverse() : sb.pts, n);
    if (rot) { const o = Math.round(rot * n) % n, L = B.slice(0, n - 1); B = Array.from({ length: n }, (_, k) => L[(k + o) % (n - 1)]); }   // closed loop: last point = first
    const st = { id: sa.id, c: ibLerpCol(sa.c, sb.c, t), w: sa.w + (sb.w - sa.w) * t, pts: A.map((q, k) => ({ x: q.x + (B[k].x - q.x) * t, y: q.y + (B[k].y - q.y) * t })) };
    if (sa.a != null || sb.a != null) st.a = (sa.a ?? 1) + ((sb.a ?? 1) - (sa.a ?? 1)) * t;
    out.push(st);
  }
  if (t < 0.5) for (const sa of P.onlyA) out.push(copy(sa)); else for (const sb of P.onlyB) out.push(copy(sb));
  return out;
}
// pix: ✏️ pen lines on the Nhân vật layer move too: both key frames are traced into strokes (in memory), paired like vector
// strokes, and every in-between is drawn back as pixels, so the frames stay normal pen drawings
async function inbetween(n, ease, pix) {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating(); motionClose(); rigClose();
  const ia = S.cur, A = S.frames[ia], B = S.frames[ia + 1]; if (!A || !B) return 0;
  await ensureLoaded(A); await ensureLoaded(B);
  const ez = EASE[ease] || EASE.linear, added = [], P = ibPairs(A.vec, B.vec);
  let PX = null;
  if (pix) { const pm = progress('Đang dò nét bút của 2 frame…'); await new Promise(r => setTimeout(r, 30));
    try { const SA = pixelsToStrokes(A.canvas), SB = pixelsToStrokes(B.canvas); if (SA.length && SB.length) PX = { SA, SB, P: ibPairs(SA, SB) }; } finally { pm.close(); } }
  for (let k = 1; k <= n; k++) {
    const t = ez(k / (n + 1)), src = t < 0.5 ? A : B;
    const f = newFrameObj(A.bgId); f.dur = A.dur;
    if (PX) drawVec(f.canvas.getContext('2d'), ibVec(PX.SA, PX.SB, t, PX.P)); else f.canvas.getContext('2d').drawImage(src.canvas, 0, 0);
    copyCol(f, src); f.ver = 1; f.pngVer = 0;
    f.vec = ibVec(A.vec, B.vec, t, P);
    f.pp = ppClone(A.pp); if (S.pp) { f.ppKey = false; }
    f.lip = lipCopy(A);
    if (A.lip && A.lip.mv && B.lip && B.lip.mv) for (const id in f.lip.mv) { const q = B.lip.mv[id]; if (q) { const p = f.lip.mv[id]; p.x += (q.x - p.x) * t; p.y += (q.y - p.y) * t; } }   // 〰 Đường đi: in-between frames move along too
    f.texts = JSON.parse(JSON.stringify(A.texts || [])); lookCopy(f, A);
    added.push(f); loaded.push(f);
  }
  if (S.pp && ppIsKey(A)) A.ppEase = ease;
  S.frames.splice(ia + 1, 0, ...added);
  pushEntry({ t: targetOf(A), add: { frames: added, index: ia + 1, dur0: A.dur, dur1: A.dur }, bytes: 0 });
  tintCache.clear(); ppRetween();
  for (const f of added) await drawThumb(f);
  buildStrip(); await selectFrame(ia); scheduleSave(); evictSoon(); updUndoBtns();
  return added.length;
}
async function inbetweenDialog() {
  const A = curFrame(), B = S.frames[S.cur + 1];
  if (!B) { toast('Cần có frame sau: chọn frame đầu của chuyển động (frame sau là điểm đến)', 3500); return; }
  await ensureLoaded(A); await ensureLoaded(B);
  const P = ibPairs(A.vec, B.vec), sh = P.pairs.length, pp = !!S.pp;
  const inked = f => { const d = f.canvas.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 90) return true; return false; };
  const pxOk = inked(A) && inked(B);
  if (!sh && !pp && !pxOk) { toast('Chưa có gì để nội suy: vẽ dáng đầu ở frame này và dáng cuối ở frame sau (bút thường hoặc Nét vector) rồi bấm ✨ Vẽ giữa ở frame đầu', 6000); return; }
  let el = {};
  const ez = [['linear', 'Đều'], ['out', 'Chậm dần'], ['in', 'Nhanh dần'], ['inout', 'Chậm–nhanh–chậm']];
  let ease = 'inout';
  const v = await modal({ title: '✨ Vẽ giữa (tween)', html: `<p class="lbl">Tự tạo các frame chuyển tiếp từ frame ${S.cur + 1} tới frame ${S.cur + 2}.${sh ? ` ${sh} nét vector sẽ chuyển dần hình dạng${P.auto ? ` (${P.auto} nét vẽ lại được tự ghép đôi theo chỗ và hình dạng)` : ''}.` : ''}${P.onlyA.length + P.onlyB.length ? ` ${P.onlyA.length + P.onlyB.length} nét không tìm được cặp thì hiện/ẩn ở giữa.` : ''}${pp ? ' Nhân vật ghép chuyển dáng giữa 2 frame 🔑.' : ''} Màu (lớp Màu) được giữ nguyên.</p>
${pxOk ? `<label class="set-row"><span>✏️ Nét bút thường (lớp Nhân vật) cũng chuyển dần: app tự dò nét 2 frame rồi vẽ dáng ở giữa. Hợp với nét viền đơn, mảng tô to thì giữ nguyên.</span><input type="checkbox" id="ibPix" ${sh || pp ? '' : 'checked'}></label>` : ''}
<div class="set-row"><span>Số frame giữa</span><input type="number" id="ibN" min="1" max="24" value="3" style="width:72px"></div>
<div class="set-row"><span>Nhịp</span><span class="grp">${ez.map(([k, l]) => `<button class="chip small ${k === ease ? 'on' : ''}" data-ibe="${k}">${l}</button>`).join('')}</span></div>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '✨ Tạo frame giữa', value: 'go', primary: true }],
    onOpen: ov => { ov.querySelectorAll('input').forEach(i => { el[i.id] = i; i.addEventListener('keydown', e => e.stopPropagation()); });
      ov.querySelectorAll('[data-ibe]').forEach(b => b.addEventListener('click', () => { ease = b.dataset.ibe; ov.querySelectorAll('[data-ibe]').forEach(x => x.classList.toggle('on', x === b)); })); } });
  if (!v) return;
  const n = clamp(parseInt(el.ibN.value) || 3, 1, 24);
  const c = await inbetween(n, ease, !!(el.ibPix && el.ibPix.checked));
  if (c) toast(`Đã chèn ${c} frame giữa — bấm Phát để xem, hoàn tác 1 lần để bỏ`, 3000);
}
$('#ibBtn').addEventListener('click', inbetweenDialog);
// keyboard, like desktop animation apps: , . = previous/next frame, F5 = hold 1 more khung (Shift: 1 less), F6 = keyframe (copy), F7 = blank keyframe, Enter = play
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.ov')) return;
  const k = e.key;
  if (k === ',' || k === '<') { e.preventDefault(); if (playing) stopPlay(); selectFrame(S.cur - 1); }
  else if (k === '.' || k === '>') { e.preventDefault(); if (playing) stopPlay(); selectFrame(S.cur + 1); }
  else if (k === 'F5') { e.preventDefault(); expStep(e.shiftKey ? -1 : 1); }
  else if (k === 'F6') { e.preventDefault(); dupFrame(); }
  else if (k === 'F7') { e.preventDefault(); addFrame(); }
  else if (k === 'Enter' && !floating && !e.target.closest('button')) { e.preventDefault(); startPlay(); }
});

