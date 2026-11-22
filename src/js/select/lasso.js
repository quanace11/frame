/* ========= Lasso / floating selection ========= */
let lasso = null, floating = null;
function polyPath(ctx, poly) { ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y); for (const p of poly) ctx.lineTo(p.x, p.y); ctx.closePath(); }
/* ===== what Chọn vùng takes (S.selMode, nút ở thanh trên khi đang Chọn vùng) =====
   'pic'   👤 Cả hình vẽ: nét pixel + màu + nét vector của frame (như trước)
   'part'  🧩 Từng mảng: chỉ những mảng màu nằm gần trọn (≥ 75%) trong vòng khoanh, kèm nét viền sát chúng
           → khoanh quanh cái đầu chỉ lấy tóc + mặt, không lấy TV hay áo dù vòng khoanh chạm vào
   'layer' 📄 Chỉ 1 lớp: chỉ lớp đang chọn (Nhân vật / Màu / Nét / Nền)
   'all'   🔲 Tất cả + nền: như 👤 và cả hình trong lớp Nền */
const SEL_MODES = { pic: '👤 Cả hình vẽ', part: '🧩 Từng mảng', warp: '🫳 Kéo uốn', layer: '📄 Chỉ 1 lớp', all: '🔲 Tất cả + nền' };
const SEL_HINTS = {
  pic: 'Lấy nét vẽ + màu + nét vector trong vòng khoanh (không lấy nền)',
  part: 'Chỉ lấy mảng nằm gọn trong vòng (vd. tóc, mặt). Mảng lòi ra ngoài nhiều (TV, áo, nền) được để lại',
  layer: 'Chỉ lấy lớp đang chọn bên dưới, các lớp khác đứng yên',
  all: 'Lấy mọi thứ trong vòng, kể cả hình ở lớp Nền',
  warp: 'Khoanh chỗ muốn sửa rồi kéo: trong vòng đi theo, viền quanh giãn mềm, xa thì đứng yên. Nét + màu uốn cùng nhau'
};
function selMode() { return SEL_MODES[S.selMode] ? S.selMode : 'pic'; }
function setSelMode(m) {
  if (!SEL_MODES[m]) return;
  if (floating) commitFloating();
  S.selMode = m; saveSettings(); warpSel = null; requestRender();
  if (m !== 'layer' && (S.layer === 'vec' || S.layer === 'col')) setLayer('char');
  syncLassoBar(); toast(SEL_MODES[m] + ': ' + SEL_HINTS[m], 3500);
}
function syncLassoBar() {
  const bar = $('#lassobar'); if (!bar) return;
  bar.hidden = S.tool !== 'lasso' || !!floating;
  const m = selMode();
  bar.querySelectorAll('[data-selm]').forEach(b => b.classList.toggle('on', b.dataset.selm === m));
  $('#lassoLayers').hidden = m !== 'layer'; $('#lassoSoft').hidden = m !== 'warp';
  bar.querySelectorAll('[data-wsoft]').forEach(b => b.classList.toggle('on', +b.dataset.wsoft === (S.warpSoft || 2)));
  bar.querySelectorAll('[data-sell]').forEach(b => b.classList.toggle('on', b.dataset.sell === S.layer));
  $('#lassoHint').textContent = SEL_HINTS[m];
}
// cut the masked part out of a layer canvas: returns the piece (rect-sized), leaves a hole in the layer
function cutPiece(cv, rect, mc) {
  const [bx, by, bw, bh] = rect, pc = makeCanvas(bw, bh), x = pc.getContext('2d');
  x.drawImage(cv, -bx, -by); x.globalCompositeOperation = 'destination-in'; x.drawImage(mc, 0, 0);
  const lx = cv.getContext('2d'); lx.save(); lx.globalCompositeOperation = 'destination-out'; lx.drawImage(mc, bx, by); lx.restore();
  return pc;
}
/* 🧩 Từng mảng: split what the layers show into patches of (almost) the same colour; keep the patches that lie ≥ 75 %
   inside the loop, plus dark line pixels and soft edges right next to them (inside the loop).
   Returns { rect, mc } (mask canvas over rect) or null */
function partMask(poly, srcs) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of poly) { a[0] = Math.min(a[0], p.x); a[1] = Math.min(a[1], p.y); a[2] = Math.max(a[2], p.x); a[3] = Math.max(a[3], p.y); }
  const pad = Math.round(Math.max(a[2] - a[0], a[3] - a[1]) * 0.5) + 8;
  const win = rectFromBox(a, pad); if (!win) return null;
  const [wx, wy, ww, wh] = win, n = ww * wh;
  const cc = makeCanvas(ww, wh), cx = cc.getContext('2d', { willReadFrequently: true });
  cx.save(); cx.translate(-wx, -wy); for (const s of srcs) s(cx); cx.restore();
  const d = cx.getImageData(0, 0, ww, wh).data;
  cx.clearRect(0, 0, ww, wh); cx.save(); cx.translate(-wx, -wy); polyPath(cx, poly); cx.fillStyle = '#000'; cx.fill(); cx.restore();
  const pd = cx.getImageData(0, 0, ww, wh).data, inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) inside[i] = pd[i * 4 + 3] > 127 ? 1 : 0;
  const solid = i => d[i * 4 + 3] >= 40;
  const near = (i, j) => { const p = i * 4, q = j * 4; return Math.abs(d[p] - d[q]) + Math.abs(d[p + 1] - d[q + 1]) + Math.abs(d[p + 2] - d[q + 2]) <= 42; };
  // window edges that are not the frame's edge: a patch reaching them is far bigger than the loop
  const openL = wx > 0, openT = wy > 0, openR = wx + ww < W, openB = wy + wh < H;
  const lab = new Int32Array(n), sel = new Uint8Array(n), stack = new Int32Array(n), members = new Int32Array(n);
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (lab[s] || !inside[s] || !solid(s)) continue;
    next++; let sp = 0, m = 0, cin = 0, edge = false; stack[sp++] = s; lab[s] = next;
    while (sp) {
      const i = stack[--sp]; members[m++] = i; cin += inside[i];
      const x = i % ww, y = (i / ww) | 0;
      if ((x === 0 && openL) || (y === 0 && openT) || (x === ww - 1 && openR) || (y === wh - 1 && openB)) edge = true;
      if (x > 0) { const j = i - 1; if (!lab[j] && solid(j) && near(i, j)) { lab[j] = next; stack[sp++] = j; } }
      if (x < ww - 1) { const j = i + 1; if (!lab[j] && solid(j) && near(i, j)) { lab[j] = next; stack[sp++] = j; } }
      if (y > 0) { const j = i - ww; if (!lab[j] && solid(j) && near(i, j)) { lab[j] = next; stack[sp++] = j; } }
      if (y < wh - 1) { const j = i + ww; if (!lab[j] && solid(j) && near(i, j)) { lab[j] = next; stack[sp++] = j; } }
    }
    if (!edge && cin >= m * 0.75) for (let k = 0; k < m; k++) sel[members[k]] = 1;
  }
  // grow into outlines (dark, up to 4 px) and soft anti-aliased edges (up to 2 px), only inside the loop
  const dist = new Uint8Array(n).fill(255); let q = [];
  for (let i = 0; i < n; i++) if (sel[i]) { dist[i] = 0; q.push(i); }
  if (!q.length) return null;
  for (let r = 1; r <= 4 && q.length; r++) {
    const nq = [];
    for (const i of q) {
      const x = i % ww;
      for (const j of [x > 0 ? i - 1 : -1, x < ww - 1 ? i + 1 : -1, i - ww, i + ww]) {
        if (j < 0 || j >= n || dist[j] !== 255 || !inside[j]) continue;
        const p = j * 4, al = d[p + 3]; if (!al) continue;
        const dark = al >= 40 && d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11 < 110;
        if (!(dark || (r <= 2 && al < 200))) continue;
        dist[j] = r; sel[j] = 1; nq.push(j);
      }
    }
    q = nq;
  }
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) if (sel[i]) { const x = i % ww, y = (i / ww) | 0; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  const rect = [wx + b[0], wy + b[1], b[2] - b[0] + 1, b[3] - b[1] + 1];
  const mc = makeCanvas(rect[2], rect[3]), mx = mc.getContext('2d'), img = mx.createImageData(rect[2], rect[3]), o = img.data;
  for (let y = 0; y < rect[3]; y++) for (let x = 0; x < rect[2]; x++) if (sel[(y + b[1]) * ww + x + b[0]]) o[(y * rect[2] + x) * 4 + 3] = 255;
  mx.putImageData(img, 0, 0);
  return { rect, mc };
}
