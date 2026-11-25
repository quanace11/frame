/* ===== 🫨 Rung 1 chỗ (jiggle one spot: chest, belly, biceps…) =====
   Khoanh 1 chỗ trên nhân vật/hình (layer) → chỗ đó nảy / rung / lắc / phồng xẹp liên tục, phần còn lại đứng yên, không cần cắt mảnh.
   Stored as an overlay per frame f.lip.jg = {regionId: {p: partId, x, y, rx, ry (ellipse in the part's own coords), k: kind,
   a: strength 0..1, s: beats per second, o: phase 0..1}} — like lip.mv / lip.off, so tweening/lip sync keep it, copied frames keep it,
   undo = 'lipe'. Drawn by warping the part image inside the ellipse with a small triangle mesh (ppPolyDraw); the motion follows
   film TIME (jgClock while playing smoothly / exporting, else the start time of the frame), so it keeps going across frames. */
const JG_KINDS = {
  bounce: ['💪 Nảy', 'Nảy lên xuống như cơ ngực, bụng'],
  pulse: ['💓 Phồng xẹp', 'Phồng to rồi xẹp như gồng cơ tay'],
  shake: ['〰 Rung nhanh', 'Rung lẩy bẩy, nhanh và nhỏ'],
  wobble: ['🍮 Lắc như thạch', 'Lắc qua lại mềm như thạch'],
};
let jgMode = false, jgClock = null, jgOpt = { k: 'bounce', a: 0.5, s: 3, o: 0, fade: false };
try { const o = JSON.parse(localStorage.getItem('fs-jiggle') || 'null'); if (o && typeof o === 'object') jgOpt = { ...jgOpt, ...o }; } catch (e) { /* no storage */ }
const jgSaveOpt = () => { try { localStorage.setItem('fs-jiggle', JSON.stringify(jgOpt)); } catch (e) { /* no storage */ } };
// film time (s) of a drawing: the live clock while playing/exporting, else where its frame starts
function jgTime(lip) {
  if (jgClock != null) return jgClock;
  if (jgMode && !playing) return performance.now() / 1000;   // ⭕ khoanh mode: the spots move live on the canvas
  let i = S.frames.findIndex(f => f.lip === lip); if (i < 0) i = S.cur;
  let t = 0; for (let k = 0; k < i && k < S.frames.length; k++) t += S.frames[k].dur / 1000; return t;
}
// where a point (x, y) of the region goes at phase ph (radians); w = weight 1 in the middle → 0 on the ellipse
function jgMove(r, x, y, ph) {
  const u = (x - r.x) / r.rx, v = (y - r.y) / r.ry, d2 = u * u + v * v; if (d2 >= 1) return { x, y };
  const w = (1 - d2) * (1 - d2), A = clamp(r.a == null ? 0.5 : r.a, 0, 1.5), dx = x - r.x, dy = y - r.y;
  if (r.k === 'pulse') { const k = 1 + A * 0.2 * (0.5 + 0.5 * Math.sin(ph)) * w; return { x: r.x + dx * k, y: r.y + dy * k }; }
  if (r.k === 'shake') return { x: x + A * 0.14 * r.rx * w * Math.sin(ph) * Math.cos(ph * 0.37 + 1), y: y + A * 0.14 * r.ry * w * Math.cos(ph * 1.13) * Math.sin(ph * 0.29 + 2) };
  if (r.k === 'wobble') { const a = A * 0.45 * w * Math.sin(ph), c = Math.cos(a), s = Math.sin(a); return { x: r.x + dx * c - dy * s + A * 0.06 * r.rx * w * Math.sin(ph), y: r.y + dx * s + dy * c }; }
  // bounce: up/down with a little squash and stretch, plus a smaller second bounce (flesh settling)
  const b = Math.sin(ph) + 0.3 * Math.sin(2 * ph + 1), st = A * 0.07 * b * w;
  return { x: r.x + dx * (1 - st), y: y - A * 0.2 * r.ry * b * w + dy * st };
}
const jgCv = new Map();   // part id → reused canvas (drawn into and used straight away)
// the part's picture with every region of it warped; null = nothing to do
function jgWarp(p, im, jg, lip) {
  const regs = []; for (const id in jg) { const r = jg[id]; if (r && r.p === p.id && r.rx > 1 && r.ry > 1 && (r.a == null || r.a > 0)) regs.push(r); }
  if (!regs.length || !im.c) return null;
  const t = jgTime(lip), pad = Math.min(400, Math.ceil(0.3 * Math.max(...regs.map(r => Math.max(r.rx, r.ry)))));
  const w = im.c.width + 2 * pad, h = im.c.height + 2 * pad; if (w * h > 2e7) return null;
  let cv = jgCv.get(p.id); if (!cv) { cv = makeCanvas(w, h); jgCv.set(p.id, cv); } else if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.drawImage(im.c, pad, pad);
  const X0 = im.x - pad, Y0 = im.y - pad, src = { c: im.c, x: im.x, y: im.y }, N = 12;
  x.translate(-X0, -Y0);   // draw in the part's own coordinates
  for (const r of regs) {
    // the box on whole pixels of this canvas (a clear/clip on half pixels leaves a faint line round the spot)
    const ph = 2 * Math.PI * ((r.s || 3) * t + (r.o || 0)), x0 = Math.floor(r.x - r.rx - X0) + X0, y0 = Math.floor(r.y - r.ry - Y0) + Y0;
    const bw = Math.ceil(r.x + r.rx - X0) + X0 - x0, bh = Math.ceil(r.y + r.ry - Y0) + Y0 - y0;
    x.save(); x.beginPath(); x.rect(x0, y0, bw, bh); x.clip(); x.clearRect(x0, y0, bw, bh);
    const G = []; for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const a = { x: x0 + bw * i / N, y: y0 + bh * j / N }; G.push([a, jgMove(r, a.x, a.y, ph)]); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = [G[j * (N + 1) + i], G[j * (N + 1) + i + 1], G[(j + 1) * (N + 1) + i + 1], G[(j + 1) * (N + 1) + i]];
      for (const tr of [[0, 1, 2], [0, 2, 3]]) { const Mx = ppAffine3(tr.map(k => q[k][0]), tr.map(k => q[k][1])); if (Mx) ppPolyDraw(x, Mx, tr.map(k => q[k][0]), src, 1.2); }
    }
    x.restore();
  }
  return { c: cv, x: X0, y: Y0, holder: im.holder, vi: im.vi };
}
// regions on frame f, of the selected character when given
const jgRegs = f => (f && f.lip && f.lip.jg) || {};
function jgEdit(f, fn) {
  const before = f.lip ? JSON.stringify(f.lip) : null, l = { ...(f.lip || {}) }; l.jg = { ...(l.jg || {}) }; fn(l.jg);
  if (!Object.keys(l.jg).length) delete l.jg; const lip = Object.keys(l).length ? l : null, after = lip ? JSON.stringify(lip) : null;
  if (before === after) return null; f.lip = lip; f.ver++; queueThumbFor(f); return { t: targetOf(f), lipe: true, before, after, bytes: 64 };
}
/* --- ⭕ Khoanh chỗ rung: lasso on the canvas (Ghép tool), then the dialog --- */
function jgToggle(on) {
  if (!S.pp || !S.pp.parts.length) { toast('Chưa có nhân vật / hình. Nhập ảnh (thành layer) hoặc cắt nhân vật trước'); return; }
  jgMode = on == null ? !jgMode : on; if (jgMode) { ppPathMode = ppCutMode = ppPatchMode = false; ppPaint = null; }
  jgSync(); if (typeof ppSyncBar === 'function') ppSyncBar(); requestRender();
  if (jgMode) { toast('Khoanh quanh chỗ muốn rung (ngực, bụng, bắp tay…) trên nhân vật', 3500); jgTick(); }
}
function jgSync() {
  const b = document.getElementById('jgBtn'); if (b) { b.textContent = jgMode ? '✕ Thôi khoanh' : '⭕ Khoanh chỗ rung'; b.classList.toggle('on', !jgMode); }
  const n = new Set(); S.frames.forEach(f => { for (const id in jgRegs(f)) n.add(id); });
  const el = document.getElementById('jgInfo'); if (el) el.textContent = n.size ? `đang có ${n.size} chỗ rung` : '';
}
// while khoanh mode is on, the current frame's spots move live so you see what is there
function jgTick() { if (!jgMode) return; if (!playing && Object.keys(jgRegs(curFrame())).length) requestRender(); setTimeout(() => requestAnimationFrame(jgTick), 33); }
// the lasso (world coords) → a region in the coordinates of the part under it
function jgRegionFrom(poly, f) {
  const P = ppPoseFor(f); let cx = 0, cy = 0; poly.forEach(q => { cx += q.x; cy += q.y; }); cx /= poly.length; cy /= poly.length;
  let part = ppHit({ x: cx, y: cy }, P, true);
  if (!part) { const cnt = new Map(); for (const q of poly) { const h = ppHit(q, P, true); if (h) cnt.set(h, (cnt.get(h) || 0) + 1); } let best = 0; for (const [h, c] of cnt) if (c > best) { best = c; part = h; } }
  if (!part) return null;
  const inv = mInv(ppMats(P)[part.id]), lp = poly.map(q => mApply(inv, q.x, q.y));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; lp.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
  // the ellipse goes a bit past the lasso so the edge of the spot moves softly
  return { p: part.id, x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max(6, (x1 - x0) / 2 * 1.15), ry: Math.max(6, (y1 - y0) / 2 * 1.15) };
}
async function jgLassoDone(poly) {
  const f = curFrame(), reg = jgRegionFrom(poly, f);
  if (!reg) { toast('Khoanh trúng vào nhân vật / hình nhé'); return; }
  const v = await jgAsk(reg); if (!v) { requestRender(); return; }
  jgApply(reg, v);
}
function jgAsk(reg) {
  const n = S.frames.length, o = jgOpt, part = ppPart(reg.p);
  const kinds = Object.entries(JG_KINDS).map(([k, [l, t]]) => `<button class="chip small${k === o.k ? ' on' : ''}" data-jgk="${k}" title="${t}">${l}</button>`).join('');
  const inp = 'style="width:72px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:inherit"';
  let out = null;
  return modal({ title: '🫨 Rung chỗ vừa khoanh',
    html: `<p>Chỗ khoanh trên "${part ? lyrName(ppPart(ppCharOf(part) || part.id) || part) : 'mảnh'}" sẽ chuyển động liên tục, phần còn lại đứng yên. Bấm ▶ Phát để xem (bật 🌊 Phát mượt để rung mượt).</p>
      <div class="mrow" style="gap:6px;flex-wrap:wrap">${kinds}</div>
      <div class="mrow" style="gap:8px;align-items:center;margin-top:8px"><span class="lbl">Mạnh</span><input id="jgA" type="range" min="0.1" max="1.5" step="0.05" value="${o.a}" style="flex:1"><span class="lbl" id="jgAV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center"><span class="lbl">Nhanh</span><input id="jgS" type="range" min="0.5" max="12" step="0.5" value="${o.s}" style="flex:1"><span class="lbl" id="jgSV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap"><label class="lbl"><input type="checkbox" id="jgO"${o.o ? ' checked' : ''}> Ngược nhịp (2 bên ngực nảy so le: khoanh bên kia rồi tích ô này)</label></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap"><label class="lbl"><input type="checkbox" id="jgF"${o.fade ? ' checked' : ''}> Tắt dần tới frame cuối</label></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px"><span class="lbl">Từ frame</span><input id="jgFrom" type="number" min="1" max="${n}" value="${S.cur + 1}" ${inp}><span class="lbl">tới</span><input id="jgTo" type="number" min="1" max="${n}" value="${n}" ${inp}><span class="lbl">(trên ${n} frame)</span></div>`,
    onOpen: ov => {
      const lab = () => { ov.querySelector('#jgAV').textContent = Math.round(+ov.querySelector('#jgA').value * 100) + '%'; ov.querySelector('#jgSV').textContent = (+ov.querySelector('#jgS').value) + ' lần/giây'; };
      ov.querySelectorAll('[data-jgk]').forEach(b => b.addEventListener('click', () => { ov.querySelectorAll('[data-jgk]').forEach(x => x.classList.toggle('on', x === b)); }));
      ov.querySelector('#jgA').addEventListener('input', lab); ov.querySelector('#jgS').addEventListener('input', lab); lab();
    },
    buttons: [{ label: 'Huỷ', value: null }, { label: '✓ Rung', value: 1, primary: true, action: () => {
      const q = s => document.querySelector(s), kb = q('[data-jgk].on');
      out = { k: kb ? kb.dataset.jgk : 'bounce', a: +q('#jgA').value, s: +q('#jgS').value, o: q('#jgO').checked ? 0.5 : 0, fade: q('#jgF').checked,
        from: clamp((+q('#jgFrom').value || 1) - 1, 0, n - 1), to: clamp((+q('#jgTo').value || n) - 1, 0, n - 1) };
    } }],
  }).then(v => v ? out : null);
}
// write the region on frames from..to as ONE undo step, then play it once
function jgApply(reg, v) {
  const a = Math.min(v.from, v.to), b = Math.max(v.from, v.to), id = 'jg' + Math.random().toString(36).slice(2, 8), multi = [];
  jgOpt = { k: v.k, a: v.a, s: v.s, o: v.o, fade: v.fade }; jgSaveOpt();
  for (let i = a; i <= b; i++) {
    const amp = v.fade && b > a ? v.a * (1 - (i - a) / (b - a + 1)) : v.a;
    const e = jgEdit(S.frames[i], jg => { jg[id] = { ...reg, k: v.k, a: Math.round(amp * 1000) / 1000, s: v.s, o: v.o }; }); if (e) multi.push(e);
  }
  if (!multi.length) return;
  pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); jgToggle(false); updateFrameUI();
  const secs = S.frames.slice(a, b + 1).reduce((s, f) => s + f.dur, 0) / 1000;
  toast(secs < 0.6 ? `Đã rung ${b - a + 1} frame — đoạn này chỉ ${secs.toFixed(1)} s, kéo dài thời lượng frame để rung lâu hơn` : `🫨 Đã rung ${b - a + 1} frame. Đang phát thử…`, 3500);
  if (playing) stopPlay(); playRangeOnce = [a, Math.min(S.frames.length - 1, b)]; startPlay();
}
// 🗑 Bỏ rung: this frame / every frame (one undo step)
async function jgClear() {
  const all = new Set(), here = Object.keys(jgRegs(curFrame())); S.frames.forEach(f => { for (const id in jgRegs(f)) all.add(id); });
  if (!all.size) { toast('Chưa có chỗ nào rung'); return; }
  const v = await modal({ title: '🗑 Bỏ rung', html: `<p>Frame này có ${here.length} chỗ rung, cả phim có ${all.size}.</p>`,
    buttons: [{ label: 'Huỷ', value: null }, ...(here.length ? [{ label: 'Bỏ chỗ rung của frame này ở mọi frame', value: 'here' }] : []), { label: 'Bỏ hết mọi chỗ rung', value: 'all', primary: true }] });
  if (!v) return; const kill = v === 'all' ? all : new Set(here), multi = [];
  S.frames.forEach(f => { const e = jgEdit(f, jg => { for (const id of kill) delete jg[id]; }); if (e) multi.push(e); });
  if (multi.length) { pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); requestRender(); updateFrameUI(); toast('Đã bỏ rung'); }
  jgSync();
}
{ const b = document.getElementById('jgBtn'); if (b) b.addEventListener('click', () => jgToggle()); }
{ const b = document.getElementById('jgClear'); if (b) b.addEventListener('click', jgClear); }
jgSync();
