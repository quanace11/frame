/* ===== 〰 Nét sôi (line boil: nét rung rung kiểu vẽ tay, không phải vẽ lại) =====
   Hoạt hình vẽ tay "sôi" vì mỗi bản vẽ lại hơi lệch. Ở đây app tự làm N bản lệch của hình mỗi layer (mảnh ghép, ảnh nhập, nhân vật cắt)
   bằng một trường nhiễu mượt: nét bị đẩy lệch 1–3 px, hình dáng và khuôn mặt giữ nguyên, không vẽ lại nét nào. Khi phát / xuất video
   app đổi bản theo thời gian phim (vd. 8 lần/giây, 3 bản xoay vòng).
   Cài đặt nằm trên mảnh gốc của layer: p.bo = {a: mạnh 0.2..2, s: lần/giây, n: số bản 2..4, face: 1 = mắt/miệng/đầu rung ít}
   (lưu qua ppPartMeta, undo tự động vì là object mới). Mảnh con theo cài đặt của mảnh gốc.
   Vẽ: drawPuppet gọi boWarp(p, im) khi boTime() != null: lúc 🌊 phát mượt / xuất (boClock do ppLiveOver đặt) hoặc 👀 Xem trên khung.
   Lúc sửa bình thường hình đứng yên (đúng như đã vẽ). Mỗi bản tính 1 lần rồi cache theo canvas của hình (WeakMap). */
let boClock = null, boPrev = false;
let boOpt = { a: 0.8, s: 8, n: 3, face: 1 };
try { const o = JSON.parse(localStorage.getItem('fs-boil') || 'null'); if (o && typeof o === 'object') boOpt = { ...boOpt, ...o }; } catch (e) { /* no storage */ }
const boSaveOpt = () => { try { localStorage.setItem('fs-boil', JSON.stringify(boOpt)); } catch (e) { /* no storage */ } };
const BO_FACE = { head: 0.45, eyes: 0.25, mouth: 0.3 };   // 🙂 Giữ mặt: these roles boil less
// film time now, or null = draw the picture still
function boTime() { if (boClock != null) return boClock; if (boPrev && !playing) return performance.now() / 1000; return null; }
const boFrameT0 = i => { let t = 0; for (let k = 0; k < i && k < S.frames.length; k++) t += S.frames[k].dur / 1000; return t; };
const boAny = () => !!(S.pp && S.pp.parts.some(p => p.bo));
function boCfgOf(p) { const r = ppPart(ppCharOf(p) || p.id) || p; return r.bo || null; }
// smooth value noise in -1..1
function boHash(i, j, s) { let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1; }
function boNoise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = boHash(i, j, s), b = boHash(i + 1, j, s), c = boHash(i, j + 1, s), d = boHash(i + 1, j + 1, s);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
const boSeedOf = id => { let h = 7; for (const ch of String(id)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return h; };
// one boiled copy of a picture: every pixel is taken from a little way off, along a smooth noise field (2 sizes of wobble)
function boMake(src, amp, seed) {
  const w0 = src.width, h0 = src.height, pad = Math.ceil(amp * 1.3) + 1, w = w0 + 2 * pad, h = h0 + 2 * pad;
  if (!w0 || !h0 || w * h > 8e6) return null;
  const sd = src.getContext('2d').getImageData(0, 0, w0, h0).data, out = makeCanvas(w, h), ox = out.getContext('2d'), od = ox.createImageData(w, h), o = od.data;
  const k = Math.max(0.5, W / 1080), L1 = 1 / (34 * k), L2 = 1 / (11 * k), G = 3, gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2;
  // the field on a coarse grid (every 3 px), interpolated per pixel
  const DX = new Float32Array(gw * gh), DY = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = gx * G, y = gy * G, n = gy * gw + gx;
    DX[n] = amp * (0.8 * boNoise(x * L1, y * L1, seed) + 0.35 * boNoise(x * L2, y * L2, seed + 11));
    DY[n] = amp * (0.8 * boNoise(x * L1, y * L1, seed + 23) + 0.35 * boNoise(x * L2, y * L2, seed + 37));
  }
  for (let y = 0; y < h; y++) {
    const gy = y / G, gj = Math.floor(gy), fy = gy - gj;
    for (let x = 0; x < w; x++) {
      const gx = x / G, gi = Math.floor(gx), fx = gx - gi, n = gj * gw + gi;
      const dx = (DX[n] * (1 - fx) + DX[n + 1] * fx) * (1 - fy) + (DX[n + gw] * (1 - fx) + DX[n + gw + 1] * fx) * fy;
      const dy = (DY[n] * (1 - fx) + DY[n + 1] * fx) * (1 - fy) + (DY[n + gw] * (1 - fx) + DY[n + gw + 1] * fx) * fy;
      const sx = x - pad + dx, sy = y - pad + dy, x0 = Math.floor(sx), y0 = Math.floor(sy), ax = sx - x0, ay = sy - y0;
      if (x0 < -1 || y0 < -1 || x0 >= w0 || y0 >= h0) continue;
      // bilinear with premultiplied alpha (no dark fringe at the edge of the picture)
      let r = 0, g = 0, b = 0, al = 0;
      for (let c = 0; c < 4; c++) {
        const xx = x0 + (c & 1), yy = y0 + (c >> 1); if (xx < 0 || yy < 0 || xx >= w0 || yy >= h0) continue;
        const wt = ((c & 1) ? ax : 1 - ax) * ((c >> 1) ? ay : 1 - ay), i = (yy * w0 + xx) * 4, A = sd[i + 3] * wt;
        if (!A) continue; r += sd[i] * A; g += sd[i + 1] * A; b += sd[i + 2] * A; al += A;
      }
      if (al < 0.5) continue; const q = (y * w + x) * 4; o[q] = r / al; o[q + 1] = g / al; o[q + 2] = b / al; o[q + 3] = al;
    }
  }
  ox.putImageData(od, 0, 0); return { c: out, pad };
}
const boCache = new WeakMap();   // picture canvas → {key, v: [boiled copies]}
// the picture of part p for this moment of the film; null = draw it as it is
function boWarp(p, im) {
  const t = boTime(); if (t == null || !im || !im.c) return null;
  const cfg = boCfgOf(p); if (!cfg || !(cfg.a > 0)) return null;
  const n = clamp(Math.round(cfg.n || 3), 2, 4), vi = Math.floor(t * (cfg.s || 8) + 1e-6) % n;
  const amp = clamp(cfg.a, 0.1, 3) * 2 * Math.max(0.5, W / 1080) * (cfg.face && BO_FACE[p.role] ? BO_FACE[p.role] : 1);
  const key = amp.toFixed(3) + '|' + n; let e = boCache.get(im.c);
  if (!e || e.key !== key) { e = { key, v: [] }; boCache.set(im.c, e); }
  if (e.v[vi] === undefined) e.v[vi] = boMake(im.c, amp, boSeedOf(p.id) + vi * 101 + (im.vi || 0) * 7) || null;
  const b = e.v[vi]; if (!b) return null;
  return { c: b.c, x: im.x - b.pad, y: im.y - b.pad, holder: im.holder, vi: im.vi };
}
/* --- the dialog: which layers boil, how strong, how fast --- */
function boSync() {
  const roots = lyrRoots(), on = roots.filter(r => r.bo), el = document.getElementById('boInfo');
  if (el) el.textContent = on.length ? `đang sôi ${on.length}/${roots.length} layer` : '';
  const b = document.getElementById('boPrevBtn'); if (b) { b.textContent = boPrev ? '✕ Thôi xem' : '👀 Xem trên khung'; b.classList.toggle('on', boPrev); }
}
function boTick() { if (!boPrev) return; if (!playing) requestRender(); setTimeout(() => requestAnimationFrame(boTick), 1000 / 24); }
function boPreview(on) {
  boPrev = on == null ? !boPrev : on; boSync(); requestRender();
  if (boPrev) { if (!boAny()) toast('Chưa có layer nào bật nét sôi. Bấm 〰 Nét sôi… trước'); boTick(); }
}
async function boDialog() {
  const roots = lyrRoots(); if (!roots.length) { toast('Chưa có nhân vật / hình. Nhập ảnh (thành layer) hoặc cắt nhân vật trước'); return; }
  const selRoot = ppSel && ppPart(ppSel) ? ppCharOf(ppPart(ppSel)) : null, cur = (roots.find(r => r.bo) || {}).bo, o = { ...boOpt, ...(cur || {}) };
  const anyOn = roots.some(r => r.bo);
  const list = roots.map(r => `<label class="lbl" style="display:flex;gap:8px;align-items:center;min-height:40px"><input type="checkbox" data-bor="${r.id}"${r.bo || (!anyOn && (!selRoot || r.id === selRoot)) ? ' checked' : ''}> ${String(lyrName(r)).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</label>`).join('');
  const sel = (id, opts, v) => `<select id="${id}" class="chip small">${opts.map(([k, l]) => `<option value="${k}"${+k === +v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  let out = null;
  const v = await modal({ title: '〰 Nét sôi (rung rung kiểu vẽ tay)',
    html: `<p>App tự làm vài bản <b>hơi lệch</b> của hình rồi đổi qua lại khi phát / xuất video, như vẽ tay lại từng bản. <b>Không phải vẽ lại nét nào</b>, mặt và dáng giữ nguyên. Lúc sửa thì hình đứng yên; bấm 👀 Xem trên khung hoặc ▶ Phát để xem.</p>
      <div style="max-height:30vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:4px 10px;margin:6px 0">${list}</div>
      <div class="mrow" style="gap:8px;align-items:center"><span class="lbl">Mạnh</span><input id="boA" type="range" min="0.2" max="2" step="0.1" value="${o.a}" style="flex:1"><span class="lbl" id="boAV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap"><span class="lbl">Đổi bản</span>${sel('boS', [[6, '6 lần/giây (chậm, mộc)'], [8, '8 lần/giây (hay dùng)'], [12, '12 lần/giây (nhanh, run)']], o.s)}
        <span class="lbl">Số bản</span>${sel('boN', [[2, '2'], [3, '3'], [4, '4']], o.n)}</div>
      <label class="lbl" style="display:flex;gap:8px;align-items:center;min-height:40px"><input type="checkbox" id="boF"${o.face ? ' checked' : ''}> 🙂 Giữ mặt: đầu, mắt, miệng rung ít hơn (khi nhân vật đã cắt mảnh)</label>`,
    onOpen: ov => { const lab = () => { ov.querySelector('#boAV').textContent = Math.round(+ov.querySelector('#boA').value * 100) + '%'; }; ov.querySelector('#boA').addEventListener('input', lab); lab(); },
    buttons: [{ label: 'Huỷ', value: null }, ...(anyOn ? [{ label: 'Tắt hết', value: 'off' }] : []), { label: '✓ Áp', value: 'on', primary: true, action: () => {
      const q = s => document.querySelector(s);
      out = { ids: [...document.querySelectorAll('[data-bor]')].filter(c => c.checked).map(c => c.dataset.bor), a: +q('#boA').value, s: +q('#boS').value, n: +q('#boN').value, face: q('#boF').checked ? 1 : 0 };
    } }],
  });
  if (!v) return;
  if (v === 'off') { boSet([], null); toast('Đã tắt nét sôi'); return; }
  if (!out || !out.ids.length) { toast('Chưa chọn layer nào'); return; }
  boOpt = { a: out.a, s: out.s, n: out.n, face: out.face }; boSaveOpt();
  boSet(out.ids, boOpt);
  toast(`〰 Nét sôi cho ${out.ids.length} layer. Đang phát thử…`, 3000);
  if (!ppSmoothOn()) toast('Bật 🌊 Phát mượt để nét sôi chạy cả khi frame đứng lâu', 4000);
  if (playing) stopPlay(); startPlay();
}
// set the boil of these layers (others off); new objects so the automatic undo sees the change
function boSet(ids, cfg) {
  const on = new Set(ids); for (const r of lyrRoots()) { const nb = on.has(r.id) && cfg ? { ...cfg } : null; if (JSON.stringify(r.bo || null) !== JSON.stringify(nb)) r.bo = nb; }
  scheduleSave(); requestRender(); boSync();
}
{ const b = document.getElementById('boBtn'); if (b) b.addEventListener('click', boDialog); }
{ const b = document.getElementById('boPrevBtn'); if (b) b.addEventListener('click', () => boPreview()); }
boSync();
