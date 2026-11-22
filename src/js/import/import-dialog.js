/* ========= Import dialog ========= */
function openImport(bmp) {
  commitFloating(); setRefEdit(false);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const src = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  src.getContext('2d').drawImage(bmp, 0, 0, src.width, src.height); bmp.close && bmp.close();
  const srcImg = src.getContext('2d').getImageData(0, 0, src.width, src.height);
  let vImgCache = null;
  const vImg = () => { // smaller copy for vector tracing (keeps stroke count sane)
    if (vImgCache) return vImgCache;
    const k2 = Math.min(1, 1200 / Math.max(src.width, src.height));
    if (k2 === 1) return (vImgCache = srcImg);
    const c = makeCanvas(Math.round(src.width * k2), Math.round(src.height * k2)), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    return (vImgCache = x.getImageData(0, 0, c.width, c.height));
  };
  const resampleA = (a, w0, h0, w1, h1) => { const o = new Float32Array(w1 * h1); for (let y = 0; y < h1; y++) for (let x = 0; x < w1; x++) o[y * w1 + x] = a[Math.min(h0 - 1, Math.floor(y * h0 / h1)) * w0 + Math.min(w0 - 1, Math.floor(x * w0 / w1))]; return o; };
  const st = { mode: 'ref', lineKind: 'ink', lineOut: 'vec', vecRes: null, cutMethod: 'ai', edge: 60, tol: 60, detail: 55, thick: 0, onlyChar: false, lineColor: '#111111', aiA: null, result: null, busy: false,
    colA: null, slits: true, flat: flatBorder(srcImg), split: { sens: 55, flat: true, view: 'both', out: 'float', res: null }, ppClean: false,
    cari: { style: 'flat', head: 1.6, body: 0.75, bulge: 0.3, neck: 0, detail: 50, outline: 5 }, cariOut: 'float', cariC: null,
    ed: null, edV: 0, edUndo: [], edRedo: [], tool: null, bsz: 40, vz: 1, vx: 0, vy: 0 };   // hand fixes on the cut-out mask: ed[i] -100 (erase) .. +100 (keep)
  const html = `
<div class="imp-tabs">
  <button class="chip" data-mode="ref">Ảnh mờ để đồ theo</button>
  <button class="chip" data-mode="cut">Tách nhân vật</button>
  <button class="chip" data-mode="line">Chuyển thành nét vẽ</button>
  <button class="chip" data-mode="split" style="border-color:#34c759">🎨 Tách nét + màu</button>
  <button class="chip" data-mode="raw">Chèn nguyên ảnh</button>
  <button class="chip" data-mode="pp" style="border-color:#ff3b9a">🧩 Nhân vật ghép (cắt mảnh)</button>
  <button class="chip" data-mode="cari" style="border-color:#ffb020">🤪 Biếm hoạ</button>
</div>
<label class="lbl imp-layer" id="impLayerRow"><input type="checkbox" id="impLayerChk"> 🗂 <b>Đưa vào layer riêng</b> (như Adobe Animate: kéo trước/sau nhân vật khác, phóng to bằng 8 chấm, dời qua từng frame)</label>
<div class="imp-wrap">
  <div class="imp-left">
    <div class="imp-prev" id="impPrev"><canvas id="impCv"></canvas><div class="imp-cur" id="impCur" hidden></div><div class="imp-busy" id="impBusy" hidden></div></div>
    <div class="imp-tools" id="impTools" hidden></div>
  </div>
  <div class="imp-ctrl" id="impCtrl"></div>
</div>`;
  let pv, busyEl, ctrl;
  const flatNote = () => (st.flat && st.cutMethod === 'color' ? '<p class="imp-note">✨ Ảnh nền trơn: đã tự chọn <b>Theo màu nền</b> để giữ đúng khe giữa tay và người.</p>' : '')
    + (st.cutMethod === 'color' ? `<div class="row"><span>Xoá khe nền kín (giữa tay và người)</span><input type="checkbox" class="switch" id="iSlits" ${st.slits ? 'checked' : ''}></div>` : '');
  const ctrls = {
    ref: () => `<p class="imp-note">Ảnh hiện mờ <b>dưới</b> các lớp để bạn vẽ đồ theo. Không xuất ra video. Chỉnh vị trí, cỡ, độ mờ sau khi bấm Dùng.</p>`,
    pp: () => `
<div class="row"><span>Xoá nền</span><span>
  <button class="chip small ${st.cutMethod === 'ai' ? 'on' : ''}" data-cm="ai">AI tự động</button>
  <button class="chip small ${st.cutMethod === 'color' ? 'on' : ''}" data-cm="color">Theo màu nền</button>
  <button class="chip small ${st.cutMethod === 'none' ? 'on' : ''}" data-cm="none">Ảnh đã tách nền</button></span></div>${flatNote()}
${st.cutMethod === 'ai' ? `<div class="row"><span>Viền mềm ↔ sắc</span><input type="range" id="iEdge" min="0" max="100" value="${st.edge}"></div>` : st.cutMethod === 'color' ? `<div class="row"><span>Độ rộng màu nền</span><input type="range" id="iTol" min="5" max="200" value="${st.tol}"></div>` : ''}
<div class="row"><span>🎨 Làm sạch: nét rõ + màu phẳng</span><input type="checkbox" class="switch" id="iPPClean" ${st.ppClean ? 'checked' : ''}></div>
${st.ppClean ? `<div class="row"><span>Nhận nét (ít ↔ nhiều)</span><input type="range" id="iSSens" min="0" max="100" value="${st.split.sens}"></div>` : ''}
<p class="imp-note">Dùng ảnh nhân vật <b>đứng thẳng, thấy rõ tay chân</b> (ảnh AI tạo rất hợp). Bước sau: kéo các khớp cho đúng → app cắt thành Đầu, Thân, Tay, Chân → bạn tự xoay từng mảnh quanh khớp, có Frame giữa và mẫu Đi/Chạy/Vẫy… Ảnh giữ nguyên màu, không bị méo.</p>`,
    cari: () => {
      const c = st.cari, sl = (id, label, min, max, v) => `<div class="row"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" value="${v}"></div>`;
      return `
<div class="row"><span>Tách người</span><span>
  <button class="chip small ${st.cutMethod === 'ai' ? 'on' : ''}" data-cm="ai">AI tự động</button>
  <button class="chip small ${st.cutMethod === 'color' ? 'on' : ''}" data-cm="color">Theo màu nền</button></span></div>
${flatNote()}${st.cutMethod === 'color' ? sl('iTol', 'Độ rộng màu nền', 5, 200, st.tol) : ''}
<div class="row"><span>Kiểu vẽ</span><span>
  <button class="chip small ${c.style === 'orig' ? 'on' : ''}" data-cs="orig">Giữ màu gốc</button>
  <button class="chip small ${c.style === 'flat' ? 'on' : ''}" data-cs="flat">Màu phẳng</button>
  <button class="chip small ${c.style === 'soft' ? 'on' : ''}" data-cs="soft">Mềm mại</button>
  <button class="chip small ${c.style === 'bw' ? 'on' : ''}" data-cs="bw">Đen trắng</button></span></div>
${sl('iCHead', 'Đầu to', 100, 220, Math.round(c.head * 100))}
${sl('iCBody', 'Cỡ thân', 50, 100, Math.round(c.body * 100))}
${sl('iCBulge', 'Phồng giữa mặt', 0, 70, Math.round(c.bulge * 100))}
${sl('iCNeck', 'Vị trí cổ (cao ↔ thấp)', -30, 30, c.neck)}
${c.style === 'orig' ? '' : sl('iCDetail', 'Nét bên trong', 0, 100, c.detail)}
${sl('iCOut', 'Viền ngoài', 0, 12, c.outline)}
<div class="row"><span>Đưa vào</span><span>
  <button class="chip small ${st.cariOut === 'float' ? 'on' : ''}" data-co="float">Vùng chọn (kéo đặt)</button>
  <button class="chip small ${st.cariOut === 'pp' ? 'on' : ''}" data-co="pp">🧩 Nhân vật ghép (làm động)</button></span></div>
<p class="imp-note">Hợp nhất với ảnh <b>1 người</b>, thấy rõ đầu và vai. App tự tách người, tìm cổ, phóng to đầu, thu nhỏ thân, phồng giữa mặt. Ảnh chụp thì tô lại kiểu hoạt hình; tranh vẽ sẵn thì <b>Giữ màu gốc</b>. Tất cả chạy ngay trên máy, không gửi ảnh đi đâu. Đầu bị cắt lệch thì chỉnh <b>Vị trí cổ</b>.</p>`;
    },
    split: () => {
      const sp = st.split, ch = (k, v, label) => `<button class="chip small ${sp[k] === v ? 'on' : ''}" data-sp="${k}:${v}">${label}</button>`;
      return `
<div class="row"><span>Xoá nền</span><span>
  <button class="chip small ${st.cutMethod === 'ai' ? 'on' : ''}" data-cm="ai">AI tự động</button>
  <button class="chip small ${st.cutMethod === 'color' ? 'on' : ''}" data-cm="color">Theo màu nền</button>
  <button class="chip small ${st.cutMethod === 'none' ? 'on' : ''}" data-cm="none">Giữ nền</button></span></div>${flatNote()}
${st.cutMethod === 'color' ? `<div class="row"><span>Độ rộng màu nền</span><input type="range" id="iTol" min="5" max="200" value="${st.tol}"></div>` : ''}
<div class="row"><span>Nhận nét (ít ↔ nhiều)</span><input type="range" id="iSSens" min="0" max="100" value="${sp.sens}"></div>
<div class="row"><span>Màu</span><span>${ch('flat', true, 'Màu phẳng (như đổ màu)')}${ch('flat', false, 'Giữ sắc độ gốc')}</span></div>
<div class="row"><span>Xem thử</span><span>${ch('view', 'both', 'Cả hai')}${ch('view', 'line', 'Chỉ nét')}${ch('view', 'col', 'Chỉ màu')}</span></div>
<div class="row"><span>Đưa vào</span><span>${ch('out', 'float', 'Nét + lớp Màu (kéo đặt)')}${ch('out', 'pp', '🧩 Nhân vật ghép')}</span></div>
<p class="imp-note" id="iSplitInfo"></p>
<p class="imp-note">App tự tách <b>nét viền tối</b> vào lớp <b>Nhân vật</b>, còn <b>màu gốc</b> của từng vùng vào lớp <b>Màu</b> bên dưới, tô lấn dưới nét. Tẩy hay vẽ lại nét thì màu vẫn còn nguyên, không bị hở. Hợp với tranh hoạt hình, ảnh 🤖 AI nhân vật. Nét bị thiếu thì kéo <b>Nhận nét</b> lên, nhận nhầm mảng tối thì kéo xuống.</p>`;
    },
    raw: () => `<p class="imp-note">Chèn ảnh vào lớp đang chọn (<b>${S.layer === 'bg' ? 'Nền' : 'Nhân vật'}</b>), rồi kéo, chỉnh cỡ/xoay.</p>`,
    cut: () => `
<div class="row"><span>Cách tách</span><span>
  <button class="chip small ${st.cutMethod === 'ai' ? 'on' : ''}" data-cm="ai">AI tự động</button>
  <button class="chip small ${st.cutMethod === 'color' ? 'on' : ''}" data-cm="color">Theo màu nền</button></span></div>${flatNote()}
${st.cutMethod === 'ai'
  ? `<div class="row"><span>Viền mềm ↔ sắc</span><input type="range" id="iEdge" min="0" max="100" value="${st.edge}"></div>
     <p class="imp-note">AI chạy ngay trên máy (lần đầu tải mô hình ~20 MB). Hợp với ảnh chụp người, vật thể rõ.</p>`
  : `<div class="row"><span>Độ rộng màu nền</span><input type="range" id="iTol" min="5" max="200" value="${st.tol}"></div>
     <p class="imp-note">Xoá vùng màu nối liền với mép ảnh. Hợp với tranh hoạt hình nền trơn.</p>`}
<p class="imp-note">Kết quả chèn vào lớp <b>${S.layer === 'bg' ? 'Nền' : 'Nhân vật'}</b> như vùng chọn để kéo đặt. Phần sót dùng Tẩy để sửa.</p>`,
    line: () => `
<div class="row"><span>Kết quả</span><span>
  <button class="chip small ${st.lineOut === 'vec' ? 'on' : ''}" data-lo="vec">Nét vector (sửa được)</button>
  <button class="chip small ${st.lineOut === 'px' ? 'on' : ''}" data-lo="px">Ảnh nét (pixel)</button></span></div>
<div class="row"><span>Loại ảnh</span><span>
  <button class="chip small ${st.lineKind === 'ink' ? 'on' : ''}" data-lk="ink">Tranh có viền</button>
  <button class="chip small ${st.lineKind === 'photo' ? 'on' : ''}" data-lk="photo">Ảnh chụp</button></span></div>
<div class="row"><span>Chi tiết</span><input type="range" id="iDetail" min="0" max="100" value="${st.detail}"></div>
${st.lineOut === 'px' ? `<div class="row"><span>Độ dày nét</span><input type="range" id="iThick" min="0" max="3" value="${st.thick}"></div>` : ''}
<div class="row"><span>Chỉ lấy nét trong nhân vật (AI)</span><input type="checkbox" class="switch" id="iOnly" ${st.onlyChar ? 'checked' : ''}></div>
<div class="row"><span>Màu nét</span><input type="color" id="iColor" value="${st.lineColor}"></div>
${st.lineOut === 'vec'
  ? `<p class="imp-note" id="iVecInfo"></p><p class="imp-note"><b>Nét vector</b> vào lớp <b>Nét</b>: chạm chọn từng nét, kéo chấm để uốn tư thế, đổi dày/màu, xoá nét thừa. Tô màu ở lớp Nhân vật, thùng sơn tự chặn theo nét. Ít nét thì dễ sửa hơn: kéo Chi tiết xuống thấp.</p>`
  : `<p class="imp-note">Tạo ảnh nét viền trên nền trong suốt (pixel), sửa bằng Tẩy/Bút.</p>`}`
  };
  const setBusy = t => { busyEl.hidden = !t; busyEl.textContent = t || ''; st.busy = !!t; };
  const showCanvas = c => { pv.width = c.width; pv.height = c.height; const x = pv.getContext('2d'); x.clearRect(0, 0, pv.width, pv.height); x.drawImage(c, 0, 0); };
  const withAlpha = (a, rgb) => {
    const out = makeCanvas(src.width, src.height), x = out.getContext('2d'), im = x.createImageData(src.width, src.height), d = im.data, s = srcImg.data;
    for (let i = 0; i < a.length; i++) { const j = i * 4; if (rgb) { d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; } else { d[j] = s[j]; d[j + 1] = s[j + 1]; d[j + 2] = s[j + 2]; } d[j + 3] = Math.round(a[i] * (rgb ? 255 : s[j + 3])); }
    x.putImageData(im, 0, 0); return out;
  };
  async function ensureAi() {
    if (st.aiA) return st.aiA;
    setBusy('Đang chạy AI tách nền…\n(lần đầu cần tải mô hình)');
    if (!st.aiP) st.aiP = aiMask(src).finally(() => { st.aiP = null; });   // one run shared by every caller
    try { st.aiA = await st.aiP; } finally { setBusy(null); }
    return st.aiA;
  }
  /** plain-background cut: flood the background colour from the edges, then let the AI decide which closed-in
   *  background-coloured areas are really background (gap between arm and body) and which belong to the figure (white logo, eyes) */
  async function colorCut() {
    if (st.colA && st.colA.tol === st.tol && st.colA.slits === st.slits) return st.colA.a;
    setBusy('Đang xử lý…'); await new Promise(r => setTimeout(r, 20));
    const holes = [], a = colorBgAlpha(srcImg, st.tol, holes); setBusy(null);
    if (holes.length) {
      let m = null; try { m = await ensureAi(); } catch (e) { console.warn('AI không chạy, giữ các vùng kín', e); }
      if (m) {
        let cut = 0;
        const sw = src.width;
        for (const comp of holes) {
          let sum = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
          for (const i of comp) { sum += m[i]; const x = i % sw, y = (i / sw) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          const len = Math.max(x1 - x0, y1 - y0) + 1, thick = comp.length / len, mean = sum / comp.length;
          const slit = st.slits && len / thick > 8 && len > src.height * 0.08;   // long thin gap (arm held close to the body): the AI blurs these, so trust it less
          if (mean < 0.4 || (slit && mean < 0.98)) { for (const i of comp) a[i] = 0; cut++; }
        }
        if (cut) { const b = boxBlur(a, src.width, src.height, 1); for (let i = 0; i < a.length; i++) a[i] = Math.min(a[i], b[i] * 1.5); }
      }
    }
    st.colA = { tol: st.tol, slits: st.slits, a }; return a;
  }
  if (st.flat) { st.cutMethod = 'color'; st.cari.style = 'orig'; st.cari.outline = 0; }   // a drawing already has its own outline   // drawn character on a plain background: colour flood keeps arm/leg gaps clean
  let seq = 0;
  async function recompute() {
    const my = ++seq;
    try {
      if (st.mode === 'ref' || st.mode === 'raw') { st.result = src; showCanvas(src); return; }
      if (st.mode === 'pp' && st.ppClean) {
        const a = edApply(st.cutMethod === 'none' ? null : st.cutMethod === 'ai' ? sharpenMask(await ensureAi(), st.edge) : await colorCut());
        if (my !== seq) return;
        setBusy('Đang tách nét và màu…'); await new Promise(r => setTimeout(r, 20));
        const r = splitLineColor(srcImg, a, st.split.sens, true); setBusy(null);
        if (my !== seq) return;
        r.col.getContext('2d').drawImage(r.line, 0, 0); st.result = r.col; showCanvas(r.col); return;
      }
      if (st.mode === 'pp' && st.cutMethod === 'none') { st.result = st.ed ? withAlpha(edApply(null, true)) : src; showCanvas(st.result); return; }
      if (st.mode === 'cut' || st.mode === 'pp') {
        let a;
        if (st.cutMethod === 'ai') a = sharpenMask(await ensureAi(), st.edge);
        else a = await colorCut();
        if (my !== seq) return;
        st.result = withAlpha(edApply(a)); showCanvas(st.result); return;
      }
      if (st.mode === 'split') {
        const sp = st.split;
        const a = edApply(st.cutMethod === 'none' ? null : st.cutMethod === 'ai' ? sharpenMask(await ensureAi(), 70) : await colorCut());
        if (my !== seq) return;
        setBusy('Đang tách nét và màu…'); await new Promise(r => setTimeout(r, 20));
        const r = splitLineColor(srcImg, a, sp.sens, sp.flat); setBusy(null);
        if (my !== seq) return;
        sp.res = r;
        const both = makeCanvas(src.width, src.height), bx = both.getContext('2d'); bx.drawImage(r.col, 0, 0); bx.drawImage(r.line, 0, 0);
        st.result = both;
        const v = makeCanvas(src.width, src.height), vx = v.getContext('2d');   // preview on a light checker so empty areas show
        for (let y = 0; y < v.height; y += 16) for (let x = 0; x < v.width; x += 16) { vx.fillStyle = ((x + y) / 16) % 2 ? '#e9e9ee' : '#fff'; vx.fillRect(x, y, 16, 16); }
        vx.drawImage(sp.view === 'line' ? r.line : sp.view === 'col' ? r.col : both, 0, 0); showCanvas(v);
        const info = ctrl.querySelector('#iSplitInfo');
        if (info) info.textContent = r.nLine < 50 ? '⚠ Gần như không thấy nét viền — kéo Nhận nét lên, hoặc ảnh này không có viền tối' : '✓ Đã tách: nét viền + màu từng vùng';
        return;
      }
      if (st.mode === 'cari') {
        const C = st.cariC || (st.cariC = {}), aKey = st.cutMethod + (st.cutMethod === 'color' ? st.tol + '|' + st.slits : '') + '|' + st.edV;
        if (C.aKey !== aKey) {
          let a;
          if (st.cutMethod === 'ai') a = sharpenMask(await ensureAi(), 70);
          else a = await colorCut();
          if (my !== seq) return;
          a = edApply(a);
          const k = Math.min(1, 800 / Math.max(src.width, src.height)), ww = Math.round(src.width * k), hh = Math.round(src.height * k);
          const wc = makeCanvas(ww, hh), wx = wc.getContext('2d'); wx.imageSmoothingQuality = 'high'; wx.drawImage(src, 0, 0, ww, hh);
          Object.assign(C, { aKey, img: wx.getImageData(0, 0, ww, hh), a: k === 1 ? a : resampleA(a, src.width, src.height, ww, hh), toonKey: null });
          C.head = cariFindHead(C.a, ww, hh);
          if (!C.head) toast('Không thấy người rõ trong ảnh — thử ảnh khác hoặc đổi cách tách', 3500);
        }
        const tKey = st.cari.style + '|' + st.cari.detail;
        if (C.toonKey !== tKey) {
          setBusy('Đang vẽ biếm hoạ…'); await new Promise(r => setTimeout(r, 20));
          C.toon = cariToon(C.img, C.a, st.cari.style, st.cari.detail); C.toonKey = tKey; setBusy(null);
          if (my !== seq) return;
        }
        st.result = cariCompose(C.toon, C.head, st.cari); showCanvas(st.result); return;
      }
      if (st.mode === 'line') {
        setBusy(st.lineOut === 'vec' ? 'Đang dò nét…' : 'Đang tạo nét…'); await new Promise(r => setTimeout(r, 20));
        const useImg = st.lineOut === 'vec' ? vImg() : srcImg;
        let a = st.lineKind === 'ink'
          ? (st.lineOut === 'vec' ? inkAlpha(useImg, st.detail) : maxFilter(inkAlpha(useImg, st.detail), useImg.width, useImg.height, +st.thick))
          : lineArtAlpha(useImg, st.detail, st.lineOut === 'vec' ? 0 : +st.thick, st.lineOut === 'vec');
        setBusy(null);
        if (st.onlyChar) {
          let m = maxFilter(sharpenMask(await ensureAi(), 70), src.width, src.height, 2);
          if (useImg !== srcImg) m = resampleA(m, src.width, src.height, useImg.width, useImg.height);
          for (let i = 0; i < a.length; i++) a[i] *= m[i];
        }
        if (my !== seq) return;
        if (st.lineOut === 'vec') {
          setBusy('Đang dò nét…'); await new Promise(r => setTimeout(r, 20));
          const strokes = vectorizeAlpha(a, useImg.width, useImg.height);
          setBusy(null); if (my !== seq) return;
          st.vecRes = { strokes, w: useImg.width, h: useImg.height };
          const c = makeCanvas(useImg.width, useImg.height), x = c.getContext('2d');
          x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          drawVec(x, strokes.map(q => ({ c: st.lineColor, w: q.w, pts: q.pts })));
          st.result = c; showCanvas(c);
          const info = ctrl.querySelector('#iVecInfo'); if (info) info.textContent = `${strokes.length} nét` + (strokes.length > 1500 ? ' — khá nhiều, nên giảm Chi tiết' : '');
        } else { st.result = withAlpha(a, hexToRgb(st.lineColor)); showCanvas(st.result); }
      }
    } catch (e) {
      console.error(e); setBusy(null);
      if ((st.mode === 'cut' || st.mode === 'cari' || st.mode === 'split' || st.mode === 'pp') && st.cutMethod === 'ai') { st.cutMethod = 'color'; renderCtrl(); toast('AI không chạy được trên trình duyệt này — chuyển sang tách theo màu nền', 3500); recompute(); }
      else if (st.onlyChar) { st.onlyChar = false; renderCtrl(); toast('AI không chạy được — lấy nét toàn ảnh', 3000); recompute(); }
      else toast('Lỗi xử lý ảnh: ' + e.message, 3000);
    }
  }
  let rT; const later = () => { clearTimeout(rT); rT = setTimeout(recompute, 150); };
  /* ----- hand fixes on the cut-out: 🧽 Xoá / 🖌 Lấy lại brush, undo/redo, pinch-zoom + pan on the preview ----- */
  const ED_MODES = { cut: 1, pp: 1, split: 1, cari: 1 };
  const nPx = src.width * src.height;
  /** auto mask a (or null = keep the picture's own alpha) + hand fixes. Never changes a (it may be cached). */
  function edApply(a, base1) {
    if (!st.ed) return a;
    const e = st.ed, o = new Float32Array(nPx), sd = srcImg.data;
    for (let i = 0; i < nPx; i++) {
      const b = a ? a[i] : base1 ? 1 : sd[i * 4 + 3] / 255, v = e[i];
      o[i] = v > 0 ? b + (1 - b) * v / 100 : v < 0 ? b * (1 + v / 100) : b;
    }
    return o;
  }
  const edSnap = () => (st.ed ? st.ed.slice() : null);
  function edPush() { st.edUndo.push(edSnap()); if (st.edUndo.length > 40) st.edUndo.shift(); st.edRedo.length = 0; }
  function edChanged() { st.edV++; if (st.cariC) st.cariC.aKey = null; renderTools(); recompute(); }
  function edUndo(redo) {
    const from = redo ? st.edRedo : st.edUndo, to = redo ? st.edUndo : st.edRedo;
    if (!from.length) return;
    to.push(edSnap()); st.ed = from.pop(); edChanged();
    toast(redo ? 'Làm lại' : 'Hoàn tác', 900);
  }
  /** one soft round dab at image point (x, y), radius r (image px) */
  function edDab(x, y, r, target) {
    const e = st.ed || (st.ed = new Int8Array(nPx)), w = src.width, h = src.height, r0 = r * 0.65;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r)), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx - x, yy - y); if (d > r) continue;
      const f = d <= r0 ? 1 : (r - d) / (r - r0), i = yy * w + xx, v = e[i];
      e[i] = Math.round(v + (target - v) * f);
    }
  }
  let prevEl, curEl, toolsEl;
  const ptrs = new Map(); let stroke = null, gest = null, penSeen = false;
  function viewApply() {
    if (st.vz <= 1.001) { st.vz = 1; st.vx = 0; st.vy = 0; }
    pv.style.transform = st.vz === 1 ? '' : `translate(${st.vx}px,${st.vy}px) scale(${st.vz})`;
    const zl = toolsEl && toolsEl.querySelector('#iZl'); if (zl) zl.textContent = Math.round(st.vz * 100) + '%';
  }
  /** zoom by k keeping the screen point (cx, cy) still */
  function zoomAt(cx, cy, k) {
    const r = pv.getBoundingClientRect(), lx = r.left - st.vx, ly = r.top - st.vy, z1 = clamp(st.vz * k, 1, 16);
    const qx = (cx - lx - st.vx) / st.vz, qy = (cy - ly - st.vy) / st.vz;
    st.vx = cx - lx - z1 * qx; st.vy = cy - ly - z1 * qy; st.vz = z1; viewApply();
  }
  function zoomCenter(k) { const r = prevEl.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, k); }
  const toImg = (cx, cy) => { const r = pv.getBoundingClientRect(); return { x: (cx - r.left) * pv.width / r.width, y: (cy - r.top) * pv.height / r.height, k: pv.width / r.width }; };
  function showCur(e) {
    if (!st.tool || !ED_MODES[st.mode] || e.pointerType === 'touch') { curEl.hidden = true; return; }
    const r = prevEl.getBoundingClientRect(); curEl.hidden = false;
    curEl.style.left = (e.clientX - r.left) + 'px'; curEl.style.top = (e.clientY - r.top) + 'px';
    curEl.style.width = curEl.style.height = st.bsz + 'px';
    curEl.style.borderColor = st.tool === 'erase' ? '#ff3b30' : '#34c759';
  }
  function strokeTo(cx, cy) {
    const p = toImg(cx, cy), r = Math.max(1, st.bsz / 2 * p.k), target = stroke.tool === 'erase' ? -100 : 100;
    const x = pv.getContext('2d'), last = stroke.last || p, d = Math.hypot(p.x - last.x, p.y - last.y), n = Math.max(1, Math.ceil(d / (r * 0.3)));
    for (let s = stroke.last ? 1 : 0; s <= n; s++) {
      const qx = last.x + (p.x - last.x) * s / n, qy = last.y + (p.y - last.y) * s / n;
      edDab(qx, qy, r, target);
      x.save(); x.beginPath(); x.arc(qx, qy, r, 0, Math.PI * 2);   // quick preview until the real cut is redone on lift
      if (stroke.tool === 'keep' && pv.width === src.width) { x.clip(); x.drawImage(src, 0, 0); x.fillStyle = 'rgba(52,199,89,.22)'; x.fill(); }
      else { x.fillStyle = stroke.tool === 'erase' ? 'rgba(255,59,48,.5)' : 'rgba(52,199,89,.5)'; x.fill(); }
      x.restore();
    }
    stroke.last = p; stroke.moved = true;
  }
  function strokeCancel() { if (!stroke) return; st.ed = stroke.before; st.edUndo.pop(); stroke = null; recompute(); }
  function strokeEnd() { if (!stroke) return; stroke = null; edChanged(); }
  function gestInfo() { const [a, b] = [...ptrs.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; }
  function wirePreview() {
    prevEl.addEventListener('pointerdown', e => {
      if (!ED_MODES[st.mode]) return;
      if (e.pointerType === 'pen') penSeen = true;
      try { prevEl.setPointerCapture(e.pointerId); } catch (er) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType });
      e.preventDefault();
      if (ptrs.size === 2) {
        if (stroke) { if (performance.now() - stroke.t0 < 300) strokeCancel(); else strokeEnd(); }
        gest = Object.assign(gestInfo(), { t0: performance.now(), moved: 0, tap: [...ptrs.values()].every(p => p.type === 'touch') });
        return;
      }
      if (ptrs.size > 2) { gest = null; return; }
      const brush = st.tool && !(e.pointerType === 'touch' && penSeen) && e.button !== 1 && e.button !== 2;
      if (brush) { edPush(); stroke = { tool: st.tool, before: st.edUndo[st.edUndo.length - 1], t0: performance.now(), last: null }; strokeTo(e.clientX, e.clientY); }
      else gest = { pan: true, x: e.clientX, y: e.clientY };
    });
    prevEl.addEventListener('pointermove', e => {
      showCur(e);
      const p = ptrs.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (stroke && ptrs.size === 1) { strokeTo(e.clientX, e.clientY); return; }
      if (gest && gest.pan && ptrs.size === 1) { if (st.vz > 1) { st.vx += e.clientX - gest.x; st.vy += e.clientY - gest.y; viewApply(); } gest.x = e.clientX; gest.y = e.clientY; return; }
      if (gest && ptrs.size === 2) {
        const g = gestInfo();
        zoomAt(gest.mx, gest.my, g.d / gest.d);
        if (st.vz > 1) { st.vx += g.mx - gest.mx; st.vy += g.my - gest.my; viewApply(); }
        gest.moved += Math.abs(g.d - gest.d) + Math.abs(g.mx - gest.mx) + Math.abs(g.my - gest.my);
        Object.assign(gest, g);
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (stroke && !ptrs.size) strokeEnd();
      if (gest && gest.tap && ptrs.size === 1) {   // two-finger tap = undo (like the main canvas)
        if (gest.moved < 14 && performance.now() - gest.t0 < 350) edUndo(false);
        gest.tap = false;
      }
      if (!ptrs.size) gest = null;
      else if (ptrs.size === 1 && gest && !gest.pan) { const q = [...ptrs.values()][0]; gest = { pan: true, x: q.x, y: q.y }; }
    };
    prevEl.addEventListener('pointerup', up); prevEl.addEventListener('pointercancel', up);
    prevEl.addEventListener('pointerleave', () => { curEl.hidden = true; });
    prevEl.addEventListener('wheel', e => { if (!ED_MODES[st.mode]) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  function renderTools() {
    if (!toolsEl) return;
    const on = !!ED_MODES[st.mode];
    toolsEl.hidden = !on; prevEl.classList.toggle('brush', on && !!st.tool);
    if (!on) { if (st.vz !== 1) { st.vz = 1; viewApply(); } return; }
    const t = k => `<button class="chip ${st.tool === k ? 'on' : ''}" data-et="${k}"`;
    toolsEl.innerHTML = `
<span class="grp">${t('')} title="Không vẽ: kéo 1 ngón để dời ảnh">✋</button>${t('erase')} title="Xoá phần thừa">🧽 Xoá</button>${t('keep')} title="Lấy lại phần bị xoá nhầm">🖌 Lấy lại</button></span>
<span class="grp"><button class="chip" id="iEdU" title="Hoàn tác (chạm 2 ngón)" ${st.edUndo.length ? '' : 'disabled'}>↶</button><button class="chip" id="iEdR" title="Làm lại" ${st.edRedo.length ? '' : 'disabled'}>↷</button></span>
<span class="grp"><span class="imp-note">Cỡ cọ</span><button class="chip" id="iBm">−</button><input type="range" id="iBsz" min="4" max="160" value="${st.bsz}"><button class="chip" id="iBp">+</button><span class="bsz" id="iBv">${st.bsz}</span></span>
<span class="grp"><button class="chip" id="iZo" title="Thu nhỏ">🔍−</button><span class="bsz" id="iZl">${Math.round(st.vz * 100)}%</span><button class="chip" id="iZi" title="Phóng to">🔍+</button><button class="chip" id="iZf" title="Vừa khung">⤢</button></span>
${st.ed ? '<button class="chip" id="iEdClr" title="Bỏ hết chỗ đã sửa tay">Bỏ hết sửa</button>' : ''}
<p class="imp-note" style="flex-basis:100%;margin:0">AI tự xoá nhầm? Chọn <b>🖌 Lấy lại</b> rồi tô lên chỗ đó, còn sót nền thì dùng <b>🧽 Xoá</b>. Chụm/mở <b>2 ngón</b> để phóng to, kéo 2 ngón để dời ảnh, <b>chạm 2 ngón</b> = hoàn tác.</p>`;
    toolsEl.querySelectorAll('[data-et]').forEach(b => b.addEventListener('click', () => { st.tool = b.dataset.et || null; renderTools(); }));
    const q = id => toolsEl.querySelector(id);
    q('#iEdU').addEventListener('click', () => edUndo(false));
    q('#iEdR').addEventListener('click', () => edUndo(true));
    const setB = v => { st.bsz = clamp(Math.round(v), 4, 160); q('#iBsz').value = st.bsz; q('#iBv').textContent = st.bsz; };
    q('#iBsz').addEventListener('input', e => setB(+e.target.value));
    q('#iBm').addEventListener('click', () => setB(st.bsz / 1.25));
    q('#iBp').addEventListener('click', () => setB(st.bsz * 1.25));
    q('#iZo').addEventListener('click', () => zoomCenter(1 / 1.5));
    q('#iZi').addEventListener('click', () => zoomCenter(1.5));
    q('#iZf').addEventListener('click', () => { st.vz = 1; viewApply(); });
    const clr = q('#iEdClr'); if (clr) clr.addEventListener('click', () => { edPush(); st.ed = null; edChanged(); });
  }
  function renderCtrl() {
    renderTools();
    ctrl.innerHTML = ctrls[st.mode]();
    document.querySelectorAll('.imp-tabs .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
    ctrl.querySelectorAll('[data-lk]').forEach(b => b.addEventListener('click', () => { st.lineKind = b.dataset.lk; renderCtrl(); recompute(); }));
    ctrl.querySelectorAll('[data-lo]').forEach(b => b.addEventListener('click', () => { st.lineOut = b.dataset.lo; renderCtrl(); recompute(); }));
    ctrl.querySelectorAll('[data-cm]').forEach(b => b.addEventListener('click', () => { st.cutMethod = b.dataset.cm; renderCtrl(); recompute(); }));
    ctrl.querySelectorAll('[data-cs]').forEach(b => b.addEventListener('click', () => { st.cari.style = b.dataset.cs; renderCtrl(); recompute(); }));
    ctrl.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { const [k, v] = b.dataset.sp.split(':'); st.split[k] = v === 'true' ? true : v === 'false' ? false : v; renderCtrl(); if (k !== 'out') recompute(); }));
    ctrl.querySelectorAll('[data-co]').forEach(b => b.addEventListener('click', () => { st.cariOut = b.dataset.co; renderCtrl(); }));
    const on = (id, ev, fn) => { const el = ctrl.querySelector(id); if (el) el.addEventListener(ev, fn); };
    on('#iEdge', 'input', e => { st.edge = +e.target.value; later(); });
    on('#iTol', 'input', e => { st.tol = +e.target.value; later(); });
    on('#iSlits', 'change', e => { st.slits = e.target.checked; recompute(); });
    on('#iDetail', 'input', e => { st.detail = +e.target.value; later(); });
    on('#iThick', 'input', e => { st.thick = +e.target.value; later(); });
    on('#iSSens', 'input', e => { st.split.sens = +e.target.value; later(); });
    on('#iPPClean', 'change', e => { st.ppClean = e.target.checked; renderCtrl(); recompute(); });
    on('#iOnly', 'change', e => { st.onlyChar = e.target.checked; recompute(); });
    on('#iColor', 'input', e => { st.lineColor = e.target.value; later(); });
    const cs = (id, key, div) => on(id, 'input', e => { st.cari[key] = +e.target.value / div; later(); });
    cs('#iCHead', 'head', 100); cs('#iCBody', 'body', 100); cs('#iCBulge', 'bulge', 100); cs('#iCNeck', 'neck', 1); cs('#iCDetail', 'detail', 1); cs('#iCOut', 'outline', 1);
  }
  modal({ title: 'Nhập ảnh', html, dismissable: false,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Dùng', primary: true, action: async () => {
      if (st.busy || !st.result) { toast('Đợi xử lý xong'); return false; }
      if (st.mode === 'ref') { await setRef(src); return; }
      if (st.mode === 'pp' || (st.mode === 'cari' && st.cariOut === 'pp') || (st.mode === 'split' && st.split.out === 'pp')) { ppStartSetup(st.result); return; }
      const asLayer = S.impLayer && !(st.mode === 'line' && st.lineOut === 'vec');
      if (asLayer) {
        if (st.mode === 'split') { if (!st.split.res) { toast('Đợi xử lý xong'); return false; } await imgToLayer(st.split.res.line, st.split.res.col); return; }
        await imgToLayer(st.result); return;
      }
      if (st.mode === 'split') {
        if (!st.split.res) { toast('Đợi xử lý xong'); return false; }
        floatFromImage(st.split.res.line, st.split.res.col);
        toast('Nét vào lớp Nhân vật, màu vào lớp Màu. Kéo để đặt, chỉnh Cỡ/Xoay rồi bấm Xong', 3500); return;
      }
      if (st.mode === 'line' && st.lineOut === 'vec') {
        if (!st.vecRes || !st.vecRes.strokes.length) { toast('Chưa có nét nào — tăng Chi tiết'); return false; }
        placeVectors(st.vecRes.strokes, st.vecRes.w, st.vecRes.h, st.lineColor); return;
      }
      floatFromImage(st.result);
      toast('Kéo bằng bút để đặt, chỉnh Cỡ/Xoay rồi bấm Xong', 3000);
    } }],
    onOpen: ov => {
      ov.querySelector('.dlg').classList.add('wide');
      pv = ov.querySelector('#impCv'); busyEl = ov.querySelector('#impBusy'); ctrl = ov.querySelector('#impCtrl');
      prevEl = ov.querySelector('#impPrev'); curEl = ov.querySelector('#impCur'); toolsEl = ov.querySelector('#impTools'); wirePreview();
      busyEl.style.whiteSpace = 'pre-line';
      const lc = ov.querySelector('#impLayerChk'), lrow = ov.querySelector('#impLayerRow'), lsync = () => { lrow.hidden = st.mode === 'ref' || st.mode === 'pp' || (st.mode === 'cari' && st.cariOut === 'pp') || (st.mode === 'split' && st.split.out === 'pp') || (st.mode === 'line' && st.lineOut === 'vec'); };
      lc.checked = !!S.impLayer; lc.addEventListener('change', () => { S.impLayer = lc.checked; saveSettings(); });
      ov.querySelector('#impCtrl').addEventListener('click', () => setTimeout(lsync, 0)); lsync();
      ov.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { setTimeout(lsync, 0); st.mode = b.dataset.mode; st.result = null; renderCtrl(); recompute(); }));   // switching while busy is fine: the older run sees a newer seq and stops
      if (wizImport) { wizImport = false; st.mode = 'pp'; }
      renderCtrl(); recompute();
    } });
}
$('#zipFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const ok = await modal({ title: 'Mở dự án từ ZIP?', html: '<p>Dự án hiện tại sẽ bị thay thế. Hãy xuất ZIP trước nếu muốn giữ.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Mở', value: true, primary: true }] });
  if (ok) importZip(f);
});


