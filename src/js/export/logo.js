/* ===== 🏷 Logo kênh (đóng logo lên video khi xuất) =====
   Bấm 🎬 Xuất video → hộp thoại hỏi trước: tải ảnh logo (1 lần, dùng chung mọi dự án), bật/tắt, cỡ, độ rõ, góc → 🎬 Xuất.
   Logo vẽ trên cùng (trên chữ, chuyển cảnh, chớp) trong drawFrameFx, nên có trong video, GIF, ảnh bìa và lúc ▶ Phát (xem trước),
   nhưng không có trên khung đang sửa. Lưu ở localStorage 'fs-logo' = {src: dataURL đã bỏ nền trắng, raw: dataURL ảnh gốc,
   keep: giữ nền, on, s: cỡ, o: độ rõ, c: góc}. Không lưu vào dự án/ZIP. */
const LOGO_SIZES = { s: ['Nhỏ', 0.14], m: ['Vừa', 0.2], l: ['To', 0.28] };
const LOGO_CORNERS = { tr: '↗ Trên phải', tl: '↖ Trên trái', br: '↘ Dưới phải', bl: '↙ Dưới trái' };
let vxLogo = { src: null, raw: null, keep: false, on: false, s: 'm', o: 1, c: 'tr' };
try { const o = JSON.parse(localStorage.getItem('fs-logo') || 'null'); if (o && typeof o === 'object') vxLogo = { ...vxLogo, ...o }; } catch (e) { /* no storage */ }
const logoSave = () => { try { localStorage.setItem('fs-logo', JSON.stringify(vxLogo)); return true; } catch (e) { toast('Không lưu được logo (ảnh quá lớn?)'); return false; } };
let logoImg = null, logoImgSrc = null;
function logoPic() {   // the logo as a loaded <img>, or null
  const src = vxLogo.keep ? vxLogo.raw : vxLogo.src; if (!src) return null;
  if (logoImgSrc !== src) { logoImgSrc = src; logoImg = new Image(); logoImg.onload = () => requestRender(); logoImg.src = src; }
  return logoImg.complete && logoImg.naturalWidth ? logoImg : null;
}
// where the logo goes on a W×H picture
function logoBox(im) {
  const w = W * (LOGO_SIZES[vxLogo.s] || LOGO_SIZES.m)[1], h = w * im.naturalHeight / im.naturalWidth, m = Math.round(W * 0.035);
  const c = vxLogo.c || 'tr', x = c[1] === 'l' ? m : W - m - w, y = c[0] === 't' ? m : H - m - h - Math.round(H * 0.06);   // bottom: above the Shorts caption area
  return { x, y, w, h };
}
function drawLogo(ctx) {
  if (!vxLogo.on) return; const im = logoPic(); if (!im) return; const b = logoBox(im);
  ctx.save(); ctx.globalAlpha = clamp(vxLogo.o == null ? 1 : vxLogo.o, 0.2, 1);
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, b.x, b.y, b.w, b.h); ctx.restore();
}
// a picked file → {raw, src}: at most 600 px, src = white paper around the logo made transparent, both trimmed to the logo
async function logoFromFile(file) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { toast('Không đọc được ảnh'); return null; }
  const k0 = Math.min(1, 600 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k0)), h = Math.max(1, Math.round(bmp.height * k0));
  const c = makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  const raw = c.toDataURL('image/png'), img = x.getImageData(0, 0, w, h), d = img.data; let opaque = 0;
  for (const i of [0, w - 1, (h - 1) * w, h * w - 1]) if (d[i * 4 + 3] > 250) opaque++;
  if (opaque >= 3) { const fig = aiWhiteMask(img); for (let i = 0; i < w * h; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * fig[i]); x.putImageData(img, 0, 0); }
  const B = kitOpaqueBox(c), o = makeCanvas(B.w, B.h); o.getContext('2d').drawImage(c, B.x, B.y, B.w, B.h, 0, 0, B.w, B.h);
  return { raw, src: o.toDataURL('image/png') };
}
// wait until the logo picture is loaded (before exporting, so the first frames have it)
async function logoReady() { if (!vxLogo.on || !(vxLogo.keep ? vxLogo.raw : vxLogo.src)) return; logoPic(); for (let k = 0; k < 40 && !logoPic(); k++) await new Promise(r => setTimeout(r, 25)); }
async function logoSetFile(file) { const r = await logoFromFile(file); if (!r) return false; const old = { ...vxLogo }; vxLogo = { ...vxLogo, ...r, on: true }; if (!logoSave()) { vxLogo = old; return false; } await logoReady(); requestRender(); return true; }
// 🎬 Xuất video: ask about the logo first, then export
async function exportVideoAsk() {
  if (playing) stopPlay();
  const chips = (attr, obj, cur) => Object.entries(obj).map(([k, v]) => `<button class="chip small${k === cur ? ' on' : ''}" data-${attr}="${k}">${Array.isArray(v) ? v[0] : v}</button>`).join('');
  const html = () => {
    const src = vxLogo.keep ? vxLogo.raw : vxLogo.src;
    return `<div class="mrow" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="width:96px;height:96px;border-radius:10px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#3a3a3a 0 25%,#2a2a2a 0 50%) 0 0/16px 16px">${src ? `<img src="${src}" style="max-width:88px;max-height:88px">` : '<span class="lbl">Chưa có logo</span>'}</div>
      <div style="display:flex;flex-direction:column;gap:6px"><button class="chip small on" id="logoPick">📁 ${src ? 'Đổi logo…' : 'Tải logo lên…'}</button>${src ? '<button class="chip small" id="logoDel">🗑 Bỏ logo</button>' : ''}</div></div>
      ${src ? `<label class="lbl" style="display:flex;gap:8px;align-items:center;min-height:42px"><input type="checkbox" id="logoOn"${vxLogo.on ? ' checked' : ''}> 🏷 Gắn logo vào video</label>
      <div class="mrow" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="lbl">Góc</span>${chips('logoc', LOGO_CORNERS, vxLogo.c || 'tr')}</div>
      <div class="mrow" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="lbl">Cỡ</span>${chips('logos', LOGO_SIZES, vxLogo.s)}<span class="lbl" style="margin-left:8px">Độ rõ</span>${chips('logoo', { 1: 'Rõ', 0.75: 'Hơi mờ', 0.5: 'Mờ' }, String(vxLogo.o))}</div>
      <label class="lbl" style="display:flex;gap:8px;align-items:center;min-height:42px"><input type="checkbox" id="logoKeep"${vxLogo.keep ? ' checked' : ''}> Giữ nền của ảnh (không tự bỏ nền trắng)</label>` : '<p class="lbl">Logo dùng chung cho mọi dự án, chỉ cần tải 1 lần. Ảnh PNG nền trong là đẹp nhất; nền trắng sẽ được tự bỏ.</p>'}`;
  };
  const v = await modal({ title: '🎬 Xuất video', html: `<div id="logoBody" style="display:flex;flex-direction:column;gap:8px;width:100%">${html()}</div>`,
    onOpen: ov => {
      const body = ov.querySelector('#logoBody');
      const wire = () => {
        const set = (k, val) => { vxLogo[k] = val; logoSave(); requestRender(); body.innerHTML = html(); wire(); };
        const p = body.querySelector('#logoPick'); if (p) p.addEventListener('click', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { if (i.files[0] && await logoSetFile(i.files[0])) { body.innerHTML = html(); wire(); } }; i.click(); });
        const d = body.querySelector('#logoDel'); if (d) d.addEventListener('click', () => { vxLogo = { ...vxLogo, src: null, raw: null, on: false }; logoSave(); requestRender(); body.innerHTML = html(); wire(); });
        const on = body.querySelector('#logoOn'); if (on) on.addEventListener('change', () => set('on', on.checked));
        const kp = body.querySelector('#logoKeep'); if (kp) kp.addEventListener('change', () => set('keep', kp.checked));
        body.querySelectorAll('[data-logoc]').forEach(b => b.addEventListener('click', () => set('c', b.dataset.logoc)));
        body.querySelectorAll('[data-logos]').forEach(b => b.addEventListener('click', () => set('s', b.dataset.logos)));
        body.querySelectorAll('[data-logoo]').forEach(b => b.addEventListener('click', () => set('o', +b.dataset.logoo)));
      };
      wire();
    },
    buttons: [{ label: 'Huỷ', value: null }, { label: '🎬 Xuất video', value: 1, primary: true }] });
  if (v) { await logoReady(); exportVideo(); }
}
logoPic();   // start loading the saved logo
