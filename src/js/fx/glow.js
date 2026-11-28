/* ===== ✨ Lóe sáng ở cửa (tab 🌈 Hiệu ứng): a dazzling light from a door / tunnel / any opening =====
   f.gl = {id, x, y, w, h, sh, c, s, k, ray, fl, z, fi, fo}: the opening (doc pixels; sh = door 🚪 / arch ⌒ / round ◯) glows white-hot,
   with a soft bloom, light rays and (door/arch) light spilling on the floor. Frames next to each other with the same gl.id are one run:
   the light fades in over fi seconds from the run start and out over fo seconds before its end (in film time). k = steady 🔆 /
   burst ✨ (a strong flash at full light that washes the whole picture, then calms down) / pulse 💓. z = 'back': drawn right over
   the background, UNDER the colour / character layers / cut-out characters, so a character walking out stays in front of the light
   (glows only around it, the 🔵 lens flare streak too); z = 'top': over everything. The whole-picture flash ✨ always goes on top.
   In the automatic undo (H_FKEYS), the 3 save places and lookCopy. Back light is in the play cache (lookKey), per frame. ===== */
const GL_SHAPES = { door: ['🚪', 'Cửa'], arch: ['⌒', 'Đường hầm'], round: ['◯', 'Tròn'] };
const GL_COLS = { white: ['⚪', 'Trắng', [255, 250, 235]], warm: ['🌅', 'Ấm', [255, 205, 120]], cold: ['🧊', 'Lạnh', [170, 215, 255]], gold: ['🟡', 'Vàng', [255, 225, 70]] };
const GL_KINDS = { burst: ['✨', 'Lóe rồi dịu', 'Mở ra là lóe trắng cả màn hình rồi dịu xuống'], steady: ['🔆', 'Sáng đều', 'Sáng đều, hơi lung linh'], pulse: ['💓', 'Nhấp nháy', 'Sáng lên tối xuống như nhịp thở'] };
const GL_POW = [[0.7, 'Nhẹ'], [1, 'Vừa'], [1.4, 'Mạnh']];
const GL_FADES = [[0, 'Không'], [0.4, 'Nhanh'], [1.2, 'Chậm']];
SETTINGS_KEYS.push('glOpt'); S.glOpt = { sh: 'arch', c: 'white', s: 1, k: 'burst', ray: 1, fl: 1, z: 'back', fi: 0.4, fo: 0.4 };
let glPick = false;   // ⬚ Khoanh chỗ sáng: the next drag on the frame marks the opening
const glOn = () => S.tool === 'fx' && TABS.fx === 'look' && !panelHidden.fx;
// the run of frames around i that share this light: [a, b]
function glRun(i) {
  const f = S.frames[i]; if (!f || !f.gl) return null; const id = f.gl.id; let a = i, b = i;
  while (a > 0 && S.frames[a - 1].gl && S.frames[a - 1].gl.id === id) a--;
  while (b < S.frames.length - 1 && S.frames[b + 1].gl && S.frames[b + 1].gl.id === id) b++;
  return [a, b];
}
const glSm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// how bright the light is at time tIn inside frame i: {a: light 0..~1.6, w: whole-picture flash 0..1, t: seconds since the run started}
function glLevel(i, tIn) {
  const f = S.frames[i], g = f && f.gl; if (!g) return { a: 0, w: 0, t: 0 };
  const [a0, b0] = glRun(i), st = frameStartTimes(), t = st[i] - st[a0] + (tIn || 0), T = st[b0 + 1] - st[a0];
  const fi = Math.min(g.fi || 0, T / 2), fo = Math.min(g.fo || 0, T / 2);
  let a = Math.min(fi > 0 ? glSm(t / fi) : 1, fo > 0 ? glSm((T - t) / fo) : 1), w = 0;
  if (g.k === 'burst') { const q = Math.exp(-Math.pow((t - fi) / 0.22, 2)); a *= 1 + 0.6 * q; w = 0.6 * q * glSm((T - t) / 0.15); }
  else if (g.k === 'pulse') a *= 0.72 + 0.28 * Math.cos(t * Math.PI * 2 * 1.1);
  else a *= 1 + 0.05 * Math.sin(t * 13);
  return { a: a * (g.s || 1), w, t };
}
function glPath(ctx, g) {
  const { x, y, w, h } = g; ctx.beginPath();
  if (g.sh === 'round') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (g.sh === 'arch') { const r = Math.min(w / 2, h); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.ellipse(x + w / 2, y + r, w / 2, r, 0, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  else ctx.rect(x, y, w, h);
}
const glCentre = g => ({ x: g.x + g.w / 2, y: g.y + g.h * (g.sh === 'round' ? 0.5 : 0.55) });
// the light itself: bloom, rays, floor spill and the white-hot opening
function glLight(ctx, g, A, t) {
  if (A <= 0.003) return;
  const [r, gg, b] = (GL_COLS[g.c] || GL_COLS.white)[2], rgba = a => `rgba(${r},${gg},${b},${clamp(a, 0, 1).toFixed(3)})`, s = g.s || 1;
  const { x: cx, y: cy } = glCentre(g), R = Math.max(g.w, g.h) * (0.9 + 0.5 * s);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  // light rays: wedges out of the opening, each shimmering at its own pace
  if (g.ray) {
    const rnd = slRand(String(g.id).split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)), n = 18, L = R * 2.6;
    const grd = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, L); grd.addColorStop(0, rgba(0.55 * A)); grd.addColorStop(0.45, rgba(0.18 * A)); grd.addColorStop(1, rgba(0));
    ctx.fillStyle = grd;
    for (let m = 0; m < n; m++) {
      const an = (m + rnd()) / n * Math.PI * 2 + 0.05 * Math.sin(t * 0.7), wd = (0.25 + rnd() * 0.5) * Math.PI / n, k = 0.55 + rnd() * 0.45, ph = rnd() * 6.3;
      ctx.globalAlpha = clamp((0.45 + 0.55 * Math.abs(Math.sin(t * (1.3 + rnd()) + ph))) * k, 0, 1);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an - wd) * L * k, cy + Math.sin(an - wd) * L * k); ctx.lineTo(cx + Math.cos(an + wd) * L * k, cy + Math.sin(an + wd) * L * k); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // soft bloom around the opening
  const bl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5); bl.addColorStop(0, rgba(0.9 * A)); bl.addColorStop(0.3, rgba(0.45 * A)); bl.addColorStop(0.65, rgba(0.14 * A)); bl.addColorStop(1, rgba(0));
  ctx.fillStyle = bl; ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
  // light spilling on the floor in front of a door / tunnel
  if (g.sh !== 'round') {
    const y0 = g.y + g.h, d = g.h * 0.6, sp = ctx.createLinearGradient(0, y0, 0, y0 + d); sp.addColorStop(0, rgba(0.7 * A)); sp.addColorStop(1, rgba(0));
    ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(g.x, y0); ctx.lineTo(g.x + g.w, y0); ctx.lineTo(g.x + g.w * 1.9, y0 + d); ctx.lineTo(g.x - g.w * 0.9, y0 + d); ctx.closePath(); ctx.fill();
  }
  // the opening: white-hot in the middle, light colour at the edges
  ctx.globalCompositeOperation = 'source-over';
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(g.w, g.h) * 0.75); core.addColorStop(0, `rgba(255,255,255,${clamp(A * 1.1, 0, 1).toFixed(3)})`); core.addColorStop(0.55, rgba(0.95 * A)); core.addColorStop(1, rgba(0.75 * A));
  glPath(ctx, g); ctx.fillStyle = core; ctx.fill();
  ctx.restore();
}
// 🔵 lens flare: a long bright streak through the light + a star glint
function glFlare(ctx, g, A) {
  if (!g.fl || A <= 0.01) return;
  const { x: cx, y: cy } = glCentre(g), u = W / 1080;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const hs = ctx.createLinearGradient(cx - W * 0.7, 0, cx + W * 0.7, 0); hs.addColorStop(0, 'rgba(160,200,255,0)'); hs.addColorStop(0.5, `rgba(255,255,255,${clamp(0.85 * A, 0, 1).toFixed(3)})`); hs.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.fillStyle = hs; ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.7, 7 * u * (0.6 + 0.4 * A), 0, 0, Math.PI * 2); ctx.fill();
  // a 4-point star glint on the light (thin, so a character in front still reads)
  const L = Math.max(g.w, g.h) * 0.9, th = 5 * u;
  for (const [ang, len] of [[0, 1], [Math.PI / 2, 0.75]]) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); const sg = ctx.createLinearGradient(-L * len, 0, L * len, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${clamp(0.8 * A, 0, 1).toFixed(3)})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-L * len, 0); ctx.lineTo(0, -th); ctx.lineTo(L * len, 0); ctx.lineTo(0, th); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
// behind the character layers (drawFrameBase / play cache / editing screen). w, h = size of a scaled cache canvas
function drawGlowBack(ctx, f, i, w, h, tIn) {
  const g = f && f.gl; if (!g || g.z === 'top') return;
  const L = glLevel(i, tIn || 0); if (L.a <= 0.003) return;
  ctx.save(); if (w) ctx.scale(w / W, h / H); glLight(ctx, g, L.a, L.t); glFlare(ctx, g, Math.min(1.2, L.a)); ctx.restore();
}
// on top of everything (inside the camera, so the light stays on the door when the camera moves)
function drawGlowTop(ctx, f, i, tIn) {
  const g = f && f.gl; if (!g) return;
  const L = glLevel(i, tIn || 0);
  if (g.z === 'top') { glLight(ctx, g, L.a, L.t); glFlare(ctx, g, Math.min(1.2, L.a)); }
  if (L.w > 0.01) { const [r, gg, b] = (GL_COLS[g.c] || GL_COLS.white)[2]; ctx.save(); ctx.fillStyle = `rgba(${Math.round((r + 255 * 2) / 3)},${Math.round((gg + 255 * 2) / 3)},${Math.round((b + 255 * 2) / 3)},${L.w.toFixed(3)})`; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }
}
// editing screen: the light shown as at full strength (no whole-picture flash); the lens flare only while tab Hiệu ứng is open
function glEditTop(c, f) { const g = f.gl, A = g.s || 1; if (g.z === 'top') { glLight(c, g, A, 0); if (glOn()) glFlare(c, g, A); } }
function glEditBack(c, f) { const g = f.gl, A = g.s || 1; if (g.z === 'top') return; glLight(c, g, A, 0); if (glOn()) glFlare(c, g, A); }
const glKey = i => { const f = S.frames[i]; if (!f.gl || f.gl.z === 'top') return ''; return 'g' + JSON.stringify(f.gl) + glLevel(i, 0).a.toFixed(3); };
// apply the light (opening + current options) to frames: the frames of the run of the current frame, or `idx`
function glSetFrames(idx, g) {
  for (const i of idx) { const f = S.frames[i]; if (g) f.gl = { ...g }; else delete f.gl; f.ver++; f.playKey = ''; queueThumbFor(f); }
  scheduleSave(); glSync(); requestRender();
}
const glRunIdx = () => { const r = glRun(S.cur); if (!r) return []; const out = []; for (let i = r[0]; i <= r[1]; i++) out.push(i); return out; };
function glFromOpt(box, id) { const o = S.glOpt; return { id: id || newId(), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h), sh: o.sh, c: o.c, s: o.s, k: o.k, ray: o.ray, fl: o.fl, z: o.z, fi: o.fi, fo: o.fo }; }
// a new opening marked on the frame: the run of this frame gets the new box; no light yet → the N frames from here (Áp cho)
function glMark(box) {
  const f = curFrame(); glPick = false;
  if (f.gl) { const idx = glRunIdx(); glSetFrames(idx, { ...f.gl, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) }); toast(`✨ Đã dời chỗ sáng ở ${idx.length} frame`, 2000); return; }
  const idx = lkIdx(); glSetFrames(idx, glFromOpt(box));
  toast(`✨ Lóe sáng ở ${idx.length} frame (frame ${idx[0] + 1}–${idx[idx.length - 1] + 1}) — bấm ▶ Xem thử. Kéo khung vàng để dời, kéo chấm góc để to/nhỏ`, 4000);
}
// change one option: saved for next time + applied to the light of this frame's run
function glOption(k, v) {
  S.glOpt = { ...S.glOpt, [k]: v }; saveSettings();
  const f = curFrame(); if (f && f.gl) glSetFrames(glRunIdx(), { ...f.gl, [k]: v }); else glSync();
}
// ✓ Áp cho N frame: the light of this frame (same id = one run, one fade) on the N frames from here / the selected frames
function glApplyN() {
  const f = curFrame(); if (!f.gl) { glPick = true; glSync(); toast('Kéo một khung quanh cửa / miệng đường hầm trên hình trước', 3000); return; }
  const idx = lkIdx(), run = glRunIdx(); glSetFrames([...new Set([...run, ...idx])], { ...f.gl });
  toast(`✨ Lóe sáng ở frame ${Math.min(idx[0], run[0]) + 1}–${Math.max(idx[idx.length - 1], run[run.length - 1]) + 1}`, 2400);
}
function glOff() { const idx = glRunIdx(); if (!idx.length) return; glSetFrames(idx, null); toast(`Đã tắt lóe sáng ở ${idx.length} frame`, 2000); }
// editing on the frame (tab Hiệu ứng): which handle of the opening box is under p
function glHit(f, p) {
  const g = f && f.gl; if (!g || !glOn()) return null; const tol = 30 * DPR / vs;
  const c = [[0, 0], [1, 0], [0, 1], [1, 1]].findIndex(([sx, sy]) => Math.hypot(p.x - (g.x + sx * g.w), p.y - (g.y + sy * g.h)) <= tol);
  if (c >= 0) return { k: 'size', c };
  if (p.x > g.x && p.x < g.x + g.w && p.y > g.y && p.y < g.y + g.h) return { k: 'move' };
  return null;
}
function glStart(p, base) {
  const f = curFrame();
  if (glPick) { action = { ...base, kind: 'gldraw', p0: p, r: null }; requestRender(); return true; }
  const h = glHit(f, p); if (!h) return false;
  action = { ...base, kind: 'gl' + h.k, c: h.c, p0: p, g0: { ...f.gl }, idx: glRunIdx() }; return true;
}
function glMove(p) {
  const a = action;
  if (a.kind === 'gldraw') { a.r = { x: Math.min(a.p0.x, p.x), y: Math.min(a.p0.y, p.y), w: Math.abs(p.x - a.p0.x), h: Math.abs(p.y - a.p0.y) }; requestRender(); return; }
  const g0 = a.g0, dx = p.x - a.p0.x, dy = p.y - a.p0.y; let { x, y, w, h } = g0;
  if (a.kind === 'glmove') { x += dx; y += dy; }
  else { const sx = a.c & 1, sy = a.c >> 1, X = sx ? x + w + dx : x + dx, Y = sy ? y + h + dy : y + dy, ox = sx ? x : x + w, oy = sy ? y : y + h;
    x = Math.min(X, ox); y = Math.min(Y, oy); w = Math.max(12, Math.abs(X - ox)); h = Math.max(12, Math.abs(Y - oy)); }
  const box = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  for (const i of a.idx) { const f = S.frames[i]; f.gl = { ...f.gl, ...box }; f.playKey = ''; }
  requestRender();
}
function glEnd() {
  const a = action; action = null;
  if (a.kind === 'gldraw') { const r = a.r; if (!r || Math.max(r.w, r.h) < 20) toast('Kéo một khung quanh cửa / miệng đường hầm (chỗ phát sáng)', 2600); else glMark(r); glSync(); requestRender(); return; }
  for (const i of a.idx) { const f = S.frames[i]; f.ver++; queueThumbFor(f); }
  scheduleSave(); requestRender();
}
// the opening box with its corner handles on the editing screen
function renderGlowBox(c, f, px) {
  if (!glOn()) return;
  if (action && action.kind === 'gldraw' && action.r) { const r = action.r; c.save(); c.setLineDash([10 * px, 6 * px]); c.lineWidth = 2.5 * px; c.strokeStyle = '#ff3b9a'; c.strokeRect(r.x, r.y, r.w, r.h); c.restore(); return; }
  const g = f.gl; if (!g || glPick) return;
  c.save(); c.setLineDash([12 * px, 8 * px]); c.lineWidth = 2.5 * px; c.strokeStyle = '#ffb21e'; glPath(c, g); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#ffb21e'; c.strokeStyle = '#111'; c.lineWidth = 2 * px;
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { c.beginPath(); c.arc(g.x + sx * g.w, g.y + sy * g.h, 10 * px, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
}
function glSync() {
  if (!$('#glStat')) return;
  const f = curFrame(), g = f && f.gl, o = g || S.glOpt;
  const on = (sel, key, val) => document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', String(b.dataset[key]) === String(val)));
  on('[data-glsh]', 'glsh', o.sh); on('[data-glc]', 'glc', o.c); on('[data-glk]', 'glk', o.k); on('[data-gls]', 'gls', o.s); on('[data-glfi]', 'glfi', o.fi); on('[data-glz]', 'glz', o.z);
  $('#glRay').classList.toggle('on', !!o.ray); $('#glFl').classList.toggle('on', !!o.fl); $('#glPick').classList.toggle('on', glPick);
  const r = g && glRun(S.cur);
  $('#glStat').textContent = glPick ? '👉 Kéo một khung quanh cửa / miệng đường hầm trên hình' : r ? `✨ Lóe sáng ở frame ${r[0] + 1}–${r[1] + 1} · kéo khung vàng để dời, chấm góc để to/nhỏ` : 'Chưa có lóe sáng ở frame này: bấm ⬚ Khoanh chỗ sáng rồi kéo khung quanh cửa';
}
function glAbort() {
  const a = action; if (!a || !a.kind.startsWith('gl')) return;
  if (a.g0) for (const i of a.idx) { const f = S.frames[i]; f.gl = { ...f.gl, x: a.g0.x, y: a.g0.y, w: a.g0.w, h: a.g0.h }; f.playKey = ''; }
  requestRender();
}
// wiring of the ✨ rows in tab 🌈 Hiệu ứng
$('#glShB').innerHTML = Object.entries(GL_SHAPES).map(([k, d]) => `<button class="chip small" data-glsh="${k}">${d[0]} ${d[1]}</button>`).join('');
$('#glCB').innerHTML = Object.entries(GL_COLS).map(([k, d]) => `<button class="chip small" data-glc="${k}">${d[0]} ${d[1]}</button>`).join('');
$('#glKB').innerHTML = Object.entries(GL_KINDS).map(([k, d]) => `<button class="chip small" data-glk="${k}" title="${d[2]}">${d[0]} ${d[1]}</button>`).join('');
$('#glSB').innerHTML = GL_POW.map(([v, l]) => `<button class="chip small" data-gls="${v}">${l}</button>`).join('');
$('#glFB').innerHTML = GL_FADES.map(([v, l]) => `<button class="chip small" data-glfi="${v}">${l}</button>`).join('');
$('#fxbar').addEventListener('click', e => {
  const b = e.target.closest('[data-glsh],[data-glc],[data-glk],[data-gls],[data-glfi],[data-glz]'); if (!b) return; const d = b.dataset;
  if (d.glsh) glOption('sh', d.glsh); else if (d.glc) glOption('c', d.glc); else if (d.glk) glOption('k', d.glk);
  else if (d.gls) glOption('s', +d.gls); else if (d.glz) glOption('z', d.glz);
  else if (d.glfi !== undefined) { const v = +d.glfi; S.glOpt = { ...S.glOpt, fi: v, fo: v }; saveSettings(); const f = curFrame(); if (f.gl) glSetFrames(glRunIdx(), { ...f.gl, fi: v, fo: v }); else glSync(); }
});
$('#glPick').addEventListener('click', () => { glPick = !glPick; glSync(); requestRender(); if (glPick) toast('Kéo một khung quanh cửa / miệng đường hầm trên hình', 2600); });
$('#glRay').addEventListener('click', () => { const f = curFrame(); glOption('ray', (f.gl || S.glOpt).ray ? 0 : 1); });
$('#glFl').addEventListener('click', () => { const f = curFrame(); glOption('fl', (f.gl || S.glOpt).fl ? 0 : 1); });
$('#glApply').addEventListener('click', glApplyN);
$('#glOffB').addEventListener('click', glOff);
