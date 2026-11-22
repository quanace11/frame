/* ===== 🖌 Thay màu: replace one colour (e.g. a red shirt → yellow, black boots → white) keeping the folds and shadows.
   Runs on the device, no AI. Target = the selected cut-out character (all its part pictures) or this frame's drawing
   (Nhân vật + Màu layers). Pixel match by hue + saturation (chromatic source) or lightness (black/white/grey source),
   soft edge; new colour keeps the pixel's lightness relative to the picked colour. ===== */
function rcHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, Math.min(1, s), l];
}
function rcRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function rcHex(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/* weight 0…1 of how much this pixel is "the picked colour" */
function rcWeight(h, s, l, src, tol) {
  const [hs, ss, ls] = src; let d;
  if (ss >= 0.18) {
    if (l < 0.05 || l > 0.97) return 0;
    const dh = Math.abs(((h - hs + 540) % 360) - 180) / tol, lo = ss * 0.5, ds = s < lo ? (lo - s) / lo * 2 : 0;
    d = Math.hypot(dh, ds);
  } else {
    const tl = 0.1 + tol / 220; d = Math.max(Math.abs(l - ls) / tl, s / 0.32);
  }
  return d <= 0.75 ? 1 : d >= 1.15 ? 0 : 1 - (d - 0.75) / 0.4;
}
/* recolour ImageData in place; returns how many pixels changed */
function rcApplyData(img, src, tgtHex, tol) {
  const d = img.data, [ht, st, lt] = rcHsl(...rcHex(tgtHex)), [, ss, ls] = src; let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [h, s, l] = rcHsl(d[i], d[i + 1], d[i + 2]), w = rcWeight(h, s, l, src, tol); if (!w) continue;
    const r = l / Math.max(0.04, ls), nl = lt < 0.15 ? clamp(lt + (l - ls) * 0.5, 0, 1) : clamp(lt * r, 0, 1);
    const ns = ss >= 0.18 ? clamp(st * clamp(s / ss, 0.5, 1.2), 0, 1) : st, [R, G, B] = rcRgb(ht, ns, nl);
    d[i] = d[i] + (R - d[i]) * w; d[i + 1] = d[i + 1] + (G - d[i + 1]) * w; d[i + 2] = d[i + 2] + (B - d[i + 2]) * w; n++;
  }
  return n;
}
function rcCanvas(c, src, tgt, tol) {
  const out = makeCanvas(c.width, c.height), x = out.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height), n = rcApplyData(img, src, tgt, tol); x.putImageData(img, 0, 0); return { c: out, n };
}
/* bounding box [x0, y0, x1, y1] of what is drawn on a canvas (null = empty) */
function rcBox(c) {
  const k = 4, w = Math.ceil(c.width / k), h = Math.ceil(c.height / k), t = makeCanvas(w, h), x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 8) { const xx = i % w, yy = (i / w) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  return x1 < 0 ? null : [Math.max(0, (x0 - 1) * k), Math.max(0, (y0 - 1) * k), Math.min(c.width, (x1 + 2) * k), Math.min(c.height, (y1 + 2) * k)];
}
function rcFrameHas(f) { const c = makeCanvas(W, H), x = c.getContext('2d'); if (f.col) x.drawImage(f.col, 0, 0); x.drawImage(f.canvas, 0, 0); const b = rcBox(c); c.width = 0; return !!b; }
/* the picture the dialog shows: the character's parts at rest, or the frame's Màu + Nhân vật layers; cropped to content */
async function rcComposite(kind) {
  let c;
  if (kind === 'char') {
    const ch = ppSelChar(), parts = S.pp.parts.filter(p => ppCharOf(p) === ch).sort((a, b) => a.z - b.z);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of parts) { x0 = Math.min(x0, p.ox); y0 = Math.min(y0, p.oy); x1 = Math.max(x1, p.ox + p.c.width); y1 = Math.max(y1, p.oy + p.c.height); }
    if (!parts.length) return null;
    c = makeCanvas(Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))); const x = c.getContext('2d');
    for (const p of parts) x.drawImage(p.c, p.ox - x0, p.oy - y0);
  } else {
    const f = curFrame(); await ensureLoaded(f); c = makeCanvas(W, H); const x = c.getContext('2d');
    if (f.col) x.drawImage(f.col, 0, 0); x.drawImage(f.canvas, 0, 0);
    const b = rcBox(c); if (!b) return null;
    const cc = makeCanvas(b[2] - b[0], b[3] - b[1]); cc.getContext('2d').drawImage(c, -b[0], -b[1]); c = cc;
  }
  const k = Math.min(1, 520 / Math.max(c.width, c.height));
  if (k < 1) { const s = makeCanvas(Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k))), x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, s.width, s.height); c = s; }
  return c;
}
/* apply to the real pictures: one undo step for the frame (pixel entries), new part canvases for a character (undo tự động) */
async function recolorApply(kind, src, tgt, tol) {
  if (kind === 'char') {
    const ch = ppSelChar(); let n = 0;
    for (const p of S.pp.parts.filter(q => ppCharOf(q) === ch)) {
      const r = rcCanvas(p.c, src, tgt, tol); if (!r.n) continue;
      p.c = r.c; await encodePart(p); n += r.n;
    }
    if (n) { S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); requestRender(); }
    return n;
  }
  const f = curFrame(); await ensureLoaded(f); const rect = [0, 0, W, H], multi = []; let n = 0;
  for (const col of [false, true]) {
    const c = col ? f.col : f.canvas; if (!c) continue;
    const x = c.getContext('2d', { willReadFrequently: true }), before = x.getImageData(0, 0, W, H), after = x.getImageData(0, 0, W, H), k = rcApplyData(after, src, tgt, tol);
    if (!k) continue; x.putImageData(after, 0, 0); multi.push(pixEntry(f, rect, before, after, col)); n += k; if (col) f.colVer++;
  }
  if (multi.length) { pushEntry(multi.length > 1 ? { multi, t: targetOf(f) } : multi[0]); markEdited(f); requestRender(); }
  return n;
}
const RC_COLS = [['#ffd21f', 'Vàng'], ['#ffffff', 'Trắng'], ['#e53935', 'Đỏ'], ['#1e88e5', 'Xanh dương'], ['#43a047', 'Xanh lá'], ['#212121', 'Đen'], ['#fb8c00', 'Cam'], ['#8e24aa', 'Tím'], ['#87ceeb', 'Xanh nhạt']];
async function recolorDialog() {
  if (playing) stopPlay(); commitFloating();
  const hasChar = !!(S.pp && S.pp.parts.length), f = curFrame(); await ensureLoaded(f); const hasPix = rcFrameHas(f);
  const st = { kind: hasChar && (S.tool === 'puppet' || !hasPix) ? 'char' : 'frame', src: null, srcRgb: null, tgt: lsGet('fs-recolor-tgt') || '#ffd21f', tol: 18, base: null };
  if (!hasChar && !hasPix) { toast('Chưa có hình để đổi màu: nhập ảnh vào frame hoặc tạo nhân vật ghép trước', 4000); return; }
  const html = `
<p style="margin-top:0">1. Chạm vào màu muốn đổi trên hình (vd. áo đỏ). 2. Chọn màu mới. 3. Bấm <b>✓ Đổi màu</b>. Nếp vải, bóng tối vẫn giữ nguyên. Làm tiếp được cho giày, quần…</p>
<div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
  <button class="chip small" data-rck="char" ${hasChar ? '' : 'disabled'}>🧍 Nhân vật / layer đang chọn</button><button class="chip small" data-rck="frame" ${hasPix ? '' : 'disabled'}>🖼 Hình vẽ ở frame này</button></div>
<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">
  <div style="flex:1;min-width:200px;display:flex;justify-content:center;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/20px 20px;border-radius:10px;border:1px solid var(--line);padding:6px">
    <canvas id="rcPv" style="max-width:100%;max-height:46vh;touch-action:none;cursor:crosshair"></canvas></div>
  <div style="flex:1;min-width:200px">
    <div class="set-row"><span>Màu cũ</span><span id="rcSrc" style="width:42px;height:42px;border-radius:10px;border:2px dashed var(--line);display:inline-block"></span></div>
    <div class="lbl" style="font-size:13px;margin:6px 0 4px">Màu mới</div>
    <div id="rcCols" style="display:flex;gap:6px;flex-wrap:wrap">${RC_COLS.map(([c, n]) => `<button data-rcc="${c}" title="${n}" aria-label="${n}" style="width:42px;height:42px;border-radius:50%;border:3px solid var(--line);background:${c};cursor:pointer"></button>`).join('')}
      <input type="color" id="rcPick" title="Màu khác" style="width:42px;height:42px;border:none;background:none;padding:0"></div>
    <div class="set-row" style="margin-top:8px"><span>Độ rộng màu</span><input type="range" id="rcTol" min="8" max="80" step="1" value="${st.tol}" style="flex:1;max-width:170px"></div>
    <p class="lbl" style="font-size:12px;margin:2px 0">Đổi cả chỗ khác màu (vd. da) thì kéo nhỏ lại; còn sót mép áo thì kéo to ra.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn primary" id="rcGo" disabled>✓ Đổi màu</button></div>
  </div>
</div>`;
  return modal({ title: '🖌 Thay màu', html, buttons: [{ label: 'Xong', value: null }], onOpen: ov => {
    ov.querySelector('.dlg').classList.add('wide');
    const q = s => ov.querySelector(s), pv = q('#rcPv'), px = pv.getContext('2d');
    const draw = () => {
      if (!st.base) return; pv.width = st.base.width; pv.height = st.base.height; px.clearRect(0, 0, pv.width, pv.height);
      if (st.src) { const r = rcCanvas(st.base, st.src, st.tgt, st.tol); px.drawImage(r.c, 0, 0); } else px.drawImage(st.base, 0, 0);
    };
    const sync = () => {
      ov.querySelectorAll('[data-rck]').forEach(b => b.classList.toggle('on', b.dataset.rck === st.kind));
      ov.querySelectorAll('[data-rcc]').forEach(b => { b.style.borderColor = b.dataset.rcc === st.tgt ? 'var(--accent)' : 'var(--line)'; });
      q('#rcPick').value = st.tgt; const sw = q('#rcSrc');
      sw.style.background = st.srcRgb ? `rgb(${st.srcRgb.join(',')})` : 'transparent'; sw.style.borderStyle = st.srcRgb ? 'solid' : 'dashed';
      q('#rcGo').disabled = !st.src;
    };
    const load = async () => { st.base = await rcComposite(st.kind); st.src = st.srcRgb = null; draw(); sync(); };
    ov.querySelectorAll('[data-rck]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; st.kind = b.dataset.rck; load(); }));
    ov.querySelectorAll('[data-rcc]').forEach(b => b.addEventListener('click', () => { st.tgt = b.dataset.rcc; lsSet('fs-recolor-tgt', st.tgt); sync(); draw(); }));
    q('#rcPick').addEventListener('input', e => { st.tgt = e.target.value; lsSet('fs-recolor-tgt', st.tgt); sync(); draw(); });
    q('#rcTol').addEventListener('input', e => { st.tol = +e.target.value; draw(); });
    pv.addEventListener('pointerdown', e => {
      if (!st.base) return; e.preventDefault();
      const r = pv.getBoundingClientRect(), cx = Math.round((e.clientX - r.left) / r.width * pv.width), cy = Math.round((e.clientY - r.top) / r.height * pv.height);
      const x0 = clamp(cx - 3, 0, pv.width - 1), y0 = clamp(cy - 3, 0, pv.height - 1), w = Math.min(7, pv.width - x0), h = Math.min(7, pv.height - y0);
      const d = st.base.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      if (!n) { toast('Chỗ này trong suốt: chạm vào phần có màu (vd. áo)'); return; }
      st.srcRgb = [R / n, G / n, B / n].map(Math.round); st.src = rcHsl(...st.srcRgb); sync(); draw();
    });
    q('#rcGo').addEventListener('click', async () => {
      if (!st.src) return; const go = q('#rcGo'); go.disabled = true;
      const n = await recolorApply(st.kind, st.src, st.tgt, st.tol);
      toast(n ? 'Đã đổi màu — chạm màu khác để đổi tiếp (vd. giày), lỡ tay thì ↶ Hoàn tác' : 'Không có chỗ nào trùng màu này — thử kéo Độ rộng màu to ra', 3500);
      await load();
    });
    load();
  } });
}
$('#recolorBtn').addEventListener('click', () => recolorDialog());
