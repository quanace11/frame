/* ===== 📮 Gửi / nhận nhân vật và ảnh giữa tablet và máy tính =====
   Tablet: vẽ / nhập ảnh → ✂ cắt → 🔧 khớp → 🦴 dáng → ✎ vẽ lại → 📤 Gửi. Máy tính nhận → thành layer / ảnh vào frame / kho.
   File nhân vật = 1 ảnh PNG (hình nhân vật theo dáng đang có, cắt sát) + chunk riêng 'fsCh' = 'FSC1' + deflate(JSON
   {fschar:1, name, w, h, t, from, root, parts: [{…ppPartMeta, png: base64, alts: [{png, dx, dy}]}], pose: {partId: tư thế},
   flat: {x, y}}) (fscPack / fscRead). Là ảnh nên Android cho chia sẻ (Quick Share, Zalo dạng file, Drive) và xem trước được;
   bị nén mất chunk (gửi dạng ảnh) thì vẫn nhập được như ảnh thường.
   📮 Hộp thư: thư mục hop-thu/ trên nhánh riêng `hop-thu` của repo ☁ (không đụng nhánh main nên không làm ☁ đồng bộ dự án
   chạy lại). Gửi = 1 lần PUT contents (mboxSend). Máy kia hỏi danh sách mỗi MBOX_POLL_MS bằng If-None-Match (304 không tốn
   lượt GitHub, mboxPoll), có thư mới thì hiện #mboxBanner. Tên file: <thời gian>_<mã máy>_<loại máy>_<tên>. Nhận xong thì xoá. */
const FSC_TYPE = 'fsCh', MBOX_BRANCH = 'hop-thu', MBOX_DIR = 'hop-thu', MBOX_POLL_MS = 5000;
const MBOX_DEV_LS = 'fs-dev-id', MBOX_ON_LS = 'fs-mbox', GON_LS = 'fs-gon';
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = u8 => u8.length > 8 && PNG_SIG.every((b, i) => u8[i] === b);
const b64u8 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function fscZip(u8, inflate) {
  if (typeof CompressionStream === 'undefined') return null;
  const st = new Blob([u8]).stream().pipeThrough(inflate ? new DecompressionStream('deflate') : new CompressionStream('deflate'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
// put / find the private chunk just before IEND
function pngAddChunk(png, type, data) {
  let end = png.length - 12;
  for (let o = 8; o + 8 <= png.length;) { const n = (png[o] << 24 | png[o + 1] << 16 | png[o + 2] << 8 | png[o + 3]) >>> 0; if (String.fromCharCode(...png.subarray(o + 4, o + 8)) === 'IEND') { end = o; break; } o += 12 + n; }
  const td = new Uint8Array(4 + data.length); td.set(strU8(type)); td.set(data, 4);
  const ch = new Uint8Array(12 + data.length), dv = new DataView(ch.buffer);
  dv.setUint32(0, data.length); ch.set(td, 4); dv.setUint32(8 + data.length, crc32(td));
  const out = new Uint8Array(png.length + ch.length); out.set(png.subarray(0, end)); out.set(ch, end); out.set(png.subarray(end), end + ch.length);
  return out;
}
function pngChunk(png, type) {
  for (let o = 8; o + 12 <= png.length;) {
    const n = (png[o] << 24 | png[o + 1] << 16 | png[o + 2] << 8 | png[o + 3]) >>> 0;
    if (String.fromCharCode(...png.subarray(o + 4, o + 8)) === type) return png.subarray(o + 8, o + 8 + n);
    o += 12 + n;
  }
  return null;
}
async function fscRead(u8) {
  if (!isPng(u8)) return null;
  const d = pngChunk(u8, FSC_TYPE); if (!d || d.length < 4) return null;
  const tag = String.fromCharCode(...d.subarray(0, 4));
  try {
    const body = tag === 'FSC1' ? await fscZip(d.subarray(4), true) : tag === 'FSC0' ? d.subarray(4) : null; if (!body) return null;
    const j = JSON.parse(new TextDecoder().decode(body));
    return j && j.fschar && Array.isArray(j.parts) && j.parts.length ? j : null;
  } catch (e) { return null; }
}
const mboxSlug = s => String(s || 'Nhân vật').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';   // keeps Vietnamese letters
const mboxDev = () => { let d = lsGet(MBOX_DEV_LS); if (!d) { d = Math.random().toString(36).slice(2, 8); lsSet(MBOX_DEV_LS, d); } return d; };
const mboxKind = () => matchMedia('(pointer:coarse)').matches ? 'tablet' : 'may-tinh';
const MBOX_KIND_VN = { tablet: 'tablet', 'may-tinh': 'máy tính' };

/* ---- 📤 đóng gói nhân vật đang chọn ---- */
function fscCharRoot() {
  if (!S.pp || !S.pp.parts.length) return null;
  const rid = ppSelChar(); return rid ? ppPart(rid) : null;
}
async function fscPack(root, name) {
  const f = curFrame(); await ensureLoaded(f);
  const parts = charParts(root), ids = new Set(parts.map(q => q.id));
  for (const q of parts) { if (!q.png) await encodePart(q); for (const a of (q.alts || [])) if (!a.png) await encodeHolder(a); }
  const P = ppPoseFor0(f) || {}, pose = {};
  for (const q of parts) if (P[q.id]) { const o = { ...P[q.id] }; delete o.h; pose[q.id] = o; }
  // the character alone, in the pose it has on this frame, cut tight
  const c = makeCanvas(), x = c.getContext('2d');
  ppOnlyRoot = root.id; try { drawPuppet(x, P, f.lip); } finally { ppOnlyRoot = null; }
  const a = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let xx = 0, i = y * W * 4 + 3; xx < W; xx++, i += 4) if (a[i] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 4; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const flat = makeCanvas(x1 - x0 + 1, y1 - y0 + 1); flat.getContext('2d').drawImage(c, -x0, -y0); c.width = 0;
  const b64 = v => u8b64(asU8(v));
  const j = { fschar: 1, name, w: W, h: H, t: Date.now(), from: mboxKind(), root: root.id, pose, flat: { x: x0, y: y0 },
    parts: parts.map(q => ({ ...ppPartMeta(q), name: charBaseName(q.name), parent: ids.has(q.parent) ? q.parent : null, png: b64(q.png),
      alts: (q.alts || []).map(al => ({ png: b64(al.png), dx: al.dx || 0, dy: al.dy || 0 })) })) };
  const body = strU8(JSON.stringify(j)), z = await fscZip(body, false);
  const data = new Uint8Array(4 + (z || body).length); data.set(strU8(z ? 'FSC1' : 'FSC0')); data.set(z || body, 4);
  const png = new Uint8Array(await (await toBlob(flat)).arrayBuffer());
  return { u8: pngAddChunk(png, FSC_TYPE, data), flat, n: parts.length };
}
async function fscShareFile(u8, filename) {   // Android / iPad: share sheet (Quick Share, Zalo, Drive…); otherwise download
  const file = new File([u8], filename, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) { await navigator.share({ files: [file], title: filename }); return true; } }
  catch (e) { if (e && e.name === 'AbortError') return false; }
  return deliverFile(new Blob([u8], { type: 'image/png' }), filename);
}
async function fscSendDialog() {
  if (HC || ppSetup) { toast('Đang cắt nhân vật — bấm ✓ Xong cắt trước rồi gửi'); return; }
  commitFloating();
  const root = fscCharRoot(); if (!root) { toast('Chưa có nhân vật ghép để gửi. Vẽ hoặc nhập ảnh rồi ✂ cắt từng bộ phận trước', 3500); return; }
  const nm0 = charBaseName(root.lname || root.name);
  const pk = await fscPack(root, /^(Thân|Đầu|Hình \d+|Cả ảnh)?$/.test(nm0) ? 'Nhân vật' : nm0);
  if (!pk) { toast('Nhân vật đang ẩn ở frame này — chuyển tới frame có nhân vật rồi gửi', 3000); return; }
  const url = URL.createObjectURL(new Blob([pk.u8], { type: 'image/png' })), cfg = syncCfg();
  const inp = 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px';
  let name = '';
  const v = await modal({ title: '📤 Gửi nhân vật',
    html: `<div style="display:flex;gap:12px;align-items:flex-start"><img alt="" src="${url}" style="width:96px;height:128px;object-fit:contain;background:#fff;border-radius:10px;flex:none">
      <div style="flex:1"><p style="margin-top:0">${pk.n} mảnh, khớp, điểm xoay và dáng đang có. Máy kia nhận rồi chọn thêm thành layer hoặc ảnh vào frame.</p>
      <label class="lbl">Tên<br><input id="fscName" maxlength="40" value="${escHtml(pk.n ? (/^(Thân|Đầu|Hình \d+|Cả ảnh)?$/.test(nm0) ? 'Nhân vật' : nm0) : '')}" style="${inp}"></label></div></div>
      ${cfg ? '' : '<p class="lbl" style="margin-bottom:0">📮 Hộp thư cần nối ☁ (Menu → ☁ Làm tiếp trên máy khác) trên cả 2 máy. Chưa nối thì dùng 📤 Chia sẻ / lưu file.</p>'}`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '📤 Chia sẻ / lưu file', value: 'file', action: () => { name = $('#fscName').value.trim(); } },
      ...(cfg ? [{ label: '📮 Gửi vào Hộp thư', value: 'mbox', primary: true, action: () => { name = $('#fscName').value.trim(); } }] : [])] });
  URL.revokeObjectURL(url);
  if (!v) return;
  name = name || 'Nhân vật';
  const out = name === pk.name ? pk : (await fscPack(root, name)) || pk;
  if (v === 'file') { await fscShareFile(out.u8, mboxSlug(name) + '.fschar.png'); return; }
  const pm = progress('Đang gửi vào 📮 Hộp thư…');
  try { await mboxSend(out.u8, mboxSlug(name) + '.fschar.png'); pm.close(); toast(`📮 Đã gửi "${name}" — máy kia sẽ thấy sau vài giây`, 3500); }
  catch (e) { pm.close(); toast('Chưa gửi được: ' + e.message, 4500); }
}

/* ---- 📥 nhận: file nhân vật hoặc ảnh thường ---- */
async function fscReceive(u8, name, opt = {}) {
  if (HC || ppSetup) { toast('Đang cắt nhân vật — xong bước cắt rồi mở'); return false; }
  if (playing) stopPlay();
  const j = await fscRead(u8);
  if (j) return fscCharDialog(j, u8, opt);
  let bmp; try { bmp = await createImageBitmap(new Blob([u8])); } catch (e) { toast('Không đọc được file này (chỉ nhận ảnh hoặc file nhân vật .fschar.png)', 3500); return false; }
  if (/\.fschar\.png$/i.test(name || '')) toast('File này mất dữ liệu nhân vật (bị nén khi gửi dạng ảnh) — chỉ nhập được như ảnh. Lần sau gửi bằng 📮 Hộp thư, Quick Share hoặc gửi dạng file', 6000);
  return fscImageDialog(bmp, name, opt);
}
const frameNumHtml = id => `<label class="lbl">Frame số <input type="number" id="${id}" min="1" max="${S.frames.length}" value="${S.cur + 1}" style="width:70px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"> / ${S.frames.length}</label>`;
const frameNumGet = id => clamp((+($('#' + id) || {}).value || S.cur + 1) - 1, 0, S.frames.length - 1);
async function fscCharDialog(j, u8, opt) {
  const url = URL.createObjectURL(new Blob([u8], { type: 'image/png' }));
  const sel = 'padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:15px';
  let at = S.cur, show = 'from', lyr = 'char';
  const read = () => { at = frameNumGet('fscAt'); show = $('#fscShow').value; lyr = $('#fscLyr').value; };
  const v = await modal({ title: `📮 Nhân vật "${j.name || 'Nhân vật'}"`,
    html: `<div style="display:flex;gap:12px;align-items:flex-start"><img alt="" src="${url}" style="width:110px;height:150px;object-fit:contain;background:#fff;border-radius:10px;flex:none">
      <div style="flex:1;display:flex;flex-direction:column;gap:10px"><span class="lbl">${j.parts.length} mảnh · gửi từ ${MBOX_KIND_VN[j.from] || 'máy khác'}</span>
      ${frameNumHtml('fscAt')}
      <label class="lbl">🧍 Layer hiện ở <select id="fscShow" style="${sel}"><option value="from">từ frame này trở đi</option><option value="all">mọi frame</option><option value="only">chỉ frame này</option></select></label>
      <label class="lbl">🖼 Ảnh đặt vào lớp <select id="fscLyr" style="${sel}"><option value="char">Nhân vật</option><option value="bg">Nền</option></select></label></div></div>
      <p class="lbl" style="margin-bottom:0"><b>Thành layer</b>: còn xương, tạo dáng tiếp được. <b>Thành ảnh</b>: hình phẳng theo dáng đã tạo, kéo/đổi cỡ rồi bấm Xong.</p>`,
    buttons: [{ label: opt.mailbox ? 'Để sau' : 'Huỷ', value: null }, ...(opt.mailbox ? [{ label: '🗑 Bỏ', value: 'drop', cls: 'danger' }] : []),
      { label: '💾 Lưu vào kho', value: 'kho', action: read }, { label: '🖼 Thành ảnh', value: 'img', action: read }, { label: '🧍 Thành layer', value: 'layer', primary: true, action: read }] });
  URL.revokeObjectURL(url);
  if (!v) return false;
  if (v === 'drop') return true;
  const rec = { w: j.w, h: j.h, parts: j.parts.map(q => ({ ...q, png: b64u8(q.png), alts: (q.alts || []).map(a => ({ png: b64u8(a.png), dx: a.dx || 0, dy: a.dy || 0 })) })) };
  if (v === 'kho') return fscToKho(rec, j.name || 'Nhân vật', u8);
  if (at !== S.cur) await selectFrame(at);
  if (v === 'img') {
    let bmp; try { bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' })); } catch (e) { toast('Không đọc được hình nhân vật'); return false; }
    const sx = j.w && j.w !== W ? (W - j.w) / 2 : 0, sy = j.h && j.h !== H ? H - j.h : 0, fl = j.flat || { x: (W - bmp.width) / 2, y: (H - bmp.height) / 2 };
    setLayer(lyr); floatFromImage(bmp);
    if (floating) { Object.assign(floating, { cx: fl.x + sx + bmp.width / 2, cy: fl.y + sy + bmp.height / 2, scale: 1, rot: 0 }); floatXbSync(); requestRender(); }
    toast(`🖼 Đã đặt "${j.name}" vào frame ${S.cur + 1} — kéo để dời, 8 chấm để đổi cỡ, rồi bấm Xong`, 4500);
    return true;
  }
  const idMap = await charAddRec(rec); if (!idMap) return false;
  // the pose made on the tablet, on the frames where the new layer shows
  for (let i = 0; i < S.frames.length; i++) {
    if (show !== 'all' && i < S.cur) continue;
    const f = S.frames[i]; f.pp = f.pp || {};
    for (const q of j.parts) { const nid = idMap[q.id]; if (nid) f.pp[nid] = { ...(j.pose && j.pose[q.id] || {}) }; }
  }
  const rid = idMap[j.root] || idMap[(j.parts.find(q => !q.parent) || j.parts[0]).id];
  if (rid) ppSel = rid;
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); requestRender();
  if (show === 'only' && rid && S.frames.length > 1) ppShowRange(rid, 'only');
  return true;
}
async function fscToKho(rec, name, u8) {
  try {
    const id = 'ch' + Date.now().toString(36);
    await idbPut('char:' + id, rec);
    const L = await charLib(); L.unshift({ id, name, t: Date.now(), n: rec.parts.length, thumb: new Blob([u8], { type: 'image/png' }) });
    for (const old of L.splice(CHAR_LIB_MAX)) { try { await idbDel('char:' + old.id); } catch (e) {} }
    await idbPut(CHAR_LIB_KEY, L);
  } catch (e) { toast('Chưa lưu được vào kho (bộ nhớ máy đầy?)'); return false; }
  toast(`💾 Đã lưu "${name}" vào 🧍 Kho nhân vật`, 3000);
  return true;
}
async function fscImageDialog(bmp, name, opt) {
  const c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0);
  const url = URL.createObjectURL(await toBlob(c)); c.width = 0;
  const sel = 'padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:15px';
  let at = S.cur, lyr = 'char';
  const read = () => { at = frameNumGet('fsiAt'); lyr = $('#fsiLyr').value; };
  const v = await modal({ title: '📮 Ảnh' + (name ? ` "${name.replace(/^\d+_\w+_[\w-]+_/, '')}"` : ''),
    html: `<div style="display:flex;gap:12px;align-items:flex-start"><img alt="" src="${url}" style="width:110px;height:150px;object-fit:contain;background:#fff;border-radius:10px;flex:none">
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">${frameNumHtml('fsiAt')}
      <label class="lbl">Đặt vào lớp <select id="fsiLyr" style="${sel}"><option value="char">Nhân vật</option><option value="bg">Nền</option></select></label>
      <span class="lbl"><b>✂ Cắt nhân vật</b>: mở Nhập ảnh (tách nền, nhân vật ghép, ✂ tự cắt từng phần).</span></div></div>`,
    buttons: [{ label: opt.mailbox ? 'Để sau' : 'Huỷ', value: null }, ...(opt.mailbox ? [{ label: '🗑 Bỏ', value: 'drop', cls: 'danger' }] : []),
      { label: '🖼 Đặt vào frame', value: 'img', action: read }, { label: '✂ Cắt nhân vật', value: 'cut', primary: true, action: read }] });
  URL.revokeObjectURL(url);
  if (!v) { bmp.close && bmp.close(); return false; }
  if (v === 'drop') { bmp.close && bmp.close(); return true; }
  if (at !== S.cur) await selectFrame(at);
  if (v === 'cut') { openImport(bmp); return true; }
  setLayer(lyr); floatFromImage(bmp); toast('🖼 Kéo để dời, 8 chấm để đổi cỡ, rồi bấm Xong', 3500);
  return true;
}
function fscPickFiles() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.png,.fschar'; inp.multiple = true;
  inp.onchange = async () => { for (const file of inp.files || []) await fscReceive(new Uint8Array(await file.arrayBuffer()), file.name); };
  inp.click();
}
// kéo thả file nhân vật / ảnh vào cửa sổ (máy tính)
window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', async e => {
  const files = e.dataTransfer && [...e.dataTransfer.files]; if (!files || !files.length) return;
  e.preventDefault();
  for (const file of files) await fscReceive(new Uint8Array(await file.arrayBuffer()), file.name);
});

/* ---- 📮 Hộp thư (GitHub, nhánh hop-thu) ---- */
const mboxOn = () => lsGet(MBOX_ON_LS) !== 'off';
let mboxReady = '', mboxEtag = '', mboxItems = [], mboxBusy = false;
const mboxSeen = new Set();
const mboxPath = p => '/contents/' + p.split('/').map(encodeURIComponent).join('/');
async function mboxEnsure(cfg) {
  if (mboxReady === cfg.repo) return;
  try { await gh(cfg, '/git/ref/heads/' + MBOX_BRANCH); mboxReady = cfg.repo; return; } catch (e) { if (e.status !== 404) throw e; }
  let sha = null;
  try { sha = (await gh(cfg, '/git/ref/heads/main')).object.sha; } catch (e) { if (e.status !== 404 && e.status !== 409) throw e; }
  if (!sha) {   // empty repo: the first file makes the default branch
    const r = await gh(cfg, mboxPath(MBOX_DIR + '/.keep'), { method: 'PUT', body: { message: '📮 hộp thư', content: btoa('hop thu') } });
    sha = r && r.commit && r.commit.sha;
  }
  try {
    await gh(cfg, '/git/refs', { method: 'POST', body: { ref: 'refs/heads/' + MBOX_BRANCH, sha } });
    // a file that always stays: the folder never answers 404, so checking an empty box is a free 304
    await gh(cfg, mboxPath(MBOX_DIR + '/.keep'), { method: 'PUT', body: { message: '📮 hộp thư', content: btoa('hop thu'), branch: MBOX_BRANCH } }).catch(() => {});
  } catch (e) { if (e.status !== 422) throw e; }   // made by the other device meanwhile
  mboxReady = cfg.repo;
}
async function mboxSend(u8, fname) {
  const cfg = syncCfg(); if (!cfg) throw new Error('chưa nối ☁ (Menu → ☁ Làm tiếp trên máy khác)');
  await mboxEnsure(cfg);
  const path = `${MBOX_DIR}/${Date.now()}_${mboxDev()}_${mboxKind()}_${mboxSlug(fname)}`;
  for (let k = 0; ; k++) {
    try { await gh(cfg, mboxPath(path), { method: 'PUT', body: { message: '📮 ' + fname, content: u8b64(u8), branch: MBOX_BRANCH } }); return; }
    catch (e) { if (e.status !== 409 || k >= 2) throw e; await new Promise(r => setTimeout(r, 700)); }   // 2 devices wrote at once
  }
}
function mboxParse(it) {
  const m = /^(\d+)_([a-z0-9]+)_([a-z-]+?)_(.+)$/.exec(it.name.normalize('NFC')); if (!m) return null;
  return { path: it.path, sha: it.sha, size: it.size, name: it.name, t: +m[1], dev: m[2], kind: m[3], title: m[4].replace(/\.fschar\.png$/i, '').replace(/[-_]+/g, ' '), char: /\.fschar\.png$/i.test(m[4]) };
}
async function mboxPoll(force) {
  const cfg = syncCfg();
  if (!cfg || !mboxOn() || (!force && document.hidden) || navigator.onLine === false || mboxBusy) return;
  try {
    const r = await fetch(`${SYNC_API}/repos/${cfg.repo}${mboxPath(MBOX_DIR)}?ref=${MBOX_BRANCH}`, { cache: 'no-store',
      headers: { Authorization: 'Bearer ' + cfg.tok, Accept: 'application/vnd.github+json', ...(mboxEtag && !force ? { 'If-None-Match': mboxEtag } : {}) } });
    if (r.status === 304) return;
    mboxEtag = r.headers.get('etag') || '';
    if (r.status === 404) { mboxItems = []; mboxSync(); return; }
    if (!r.ok) return;
    const L = await r.json(), me = mboxDev();
    mboxItems = (Array.isArray(L) ? L : []).filter(it => it.type === 'file').map(mboxParse).filter(it => it && it.dev !== me).sort((a, b) => a.t - b.t);
    mboxSync();
  } catch (e) { /* offline: next time */ }
}
setInterval(mboxPoll, MBOX_POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) mboxPoll(); });
setTimeout(() => mboxPoll(), 2500);
function mboxSync() {
  const n = mboxItems.length, b = $('#mailBadge');
  if (b) { b.textContent = n; b.hidden = !n; }
  const fresh = mboxItems.filter(it => !mboxSeen.has(it.path));
  const ban = $('#mboxBanner');
  if (!fresh.length || document.querySelector('.ov')) { if (!n) ban.hidden = true; return; }
  const it = fresh[fresh.length - 1];
  $('#mboxBanTxt').textContent = `📮 ${it.char ? 'Nhân vật' : 'Ảnh'} "${it.title}" từ ${MBOX_KIND_VN[it.kind] || 'máy khác'}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`;
  ban.hidden = false; ban.dataset.path = it.path;
}
async function mboxOpen(it) {
  const cfg = syncCfg(); if (!cfg || mboxBusy) return;
  mboxSeen.add(it.path); $('#mboxBanner').hidden = true;
  mboxBusy = true; const pm = progress('Đang lấy từ 📮 Hộp thư…'); let u8 = null;
  try { u8 = await gh(cfg, '/git/blobs/' + it.sha, { raw: true }); } catch (e) { toast('Chưa lấy được: ' + e.message, 4000); }
  finally { pm.close(); mboxBusy = false; }
  if (!u8) return;
  if (await fscReceive(u8, it.name, { mailbox: true })) await mboxDelete(it);
}
async function mboxDelete(it) {
  const cfg = syncCfg(); if (!cfg) return;
  try { await gh(cfg, mboxPath(it.path), { method: 'DELETE', body: { message: '📮 đã nhận ' + it.title, sha: it.sha, branch: MBOX_BRANCH } }); }
  catch (e) { if (e.status !== 404 && e.status !== 409 && e.status !== 422) toast('Chưa xoá được thư cũ: ' + e.message, 3000); }
  mboxItems = mboxItems.filter(x => x.path !== it.path); mboxSeen.add(it.path); mboxSync();
}
$('#mboxOpen').addEventListener('click', () => { const it = mboxItems.find(x => x.path === $('#mboxBanner').dataset.path); if (it) mboxOpen(it); });
$('#mboxLater').addEventListener('click', () => { mboxItems.forEach(it => mboxSeen.add(it.path)); $('#mboxBanner').hidden = true; });
async function mboxSendImages() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...(inp.files || [])]; if (!files.length) return;
    const pm = progress('Đang gửi ảnh vào 📮 Hộp thư…');
    try { for (const file of files) { if (file.size > 30e6) { toast(file.name + ': quá lớn (tối đa 30 MB)'); continue; } await mboxSend(new Uint8Array(await file.arrayBuffer()), file.name); } pm.close(); toast(`📮 Đã gửi ${files.length} ảnh — máy kia sẽ thấy sau vài giây`, 3000); }
    catch (e) { pm.close(); toast('Chưa gửi được: ' + e.message, 4500); }
  };
  inp.click();
}
async function mboxDialog() {
  const cfg = syncCfg();
  await mboxPoll(true);
  const row = it => `<div class="mrow" style="gap:8px;align-items:center"><span style="flex:1">${it.char ? '🧍' : '🖼'} <b>${escHtml(it.title)}</b> <span class="lbl">từ ${MBOX_KIND_VN[it.kind] || 'máy khác'} · ${new Date(it.t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span></span><button class="btn primary" data-mo="${escHtml(it.path)}">Mở</button><button class="btn" data-md="${escHtml(it.path)}" title="Bỏ thư này">🗑</button></div>`;
  modal({ title: '📮 Hộp thư: gửi / nhận nhân vật, ảnh',
    html: `${cfg ? '' : '<p>📮 Hộp thư dùng chung repo GitHub của ☁. Nối ☁ trên cả 2 máy trước (dán cùng mã phiên <code>FS1-…</code>). Chưa nối thì vẫn gửi được bằng file: 📤 Chia sẻ / lưu file → máy kia 📥 Nhập file (hoặc kéo thả vào cửa sổ).</p><div class="mrow"><button class="btn" id="mbSync">☁ Nối máy này</button></div>'}
      <div id="mbList" style="display:flex;flex-direction:column;gap:6px;margin:8px 0">${cfg ? (mboxItems.length ? mboxItems.map(row).join('') : '<span class="lbl">Hộp thư trống.</span>') : ''}</div>
      <div class="mrow" style="flex-wrap:wrap;gap:6px"><button class="btn primary" id="mbSendChar">📤 Gửi nhân vật đang chọn</button>${cfg ? '<button class="btn" id="mbSendImg">🖼 Gửi ảnh sang máy kia</button>' : ''}<button class="btn" id="mbImport">📥 Nhập file từ máy này</button></div>
      ${cfg ? `<label class="set-row"><span>Nhận thư trên máy này</span><input type="checkbox" id="mbOn" ${mboxOn() ? 'checked' : ''}></label>
      <label class="set-row"><span title="Máy chỉ dùng để cắt nhân vật thì tắt cho nhanh: chỉ gửi/nhận qua Hộp thư, không gửi cả dự án">☁ Tự đồng bộ cả dự án trên máy này</span><input type="checkbox" id="mbAuto" ${syncAuto() ? 'checked' : ''}></label>` : ''}`,
    buttons: [{ label: 'Đóng', value: null }],
    onOpen: (ov, close) => {
      const q = s => ov.querySelector(s);
      ov.querySelectorAll('[data-mo]').forEach(b => b.addEventListener('click', () => { const it = mboxItems.find(x => x.path === b.dataset.mo); close(null); if (it) mboxOpen(it); }));
      ov.querySelectorAll('[data-md]').forEach(b => b.addEventListener('click', async () => { const it = mboxItems.find(x => x.path === b.dataset.md); if (!it) return; b.closest('.mrow').remove(); await mboxDelete(it); }));
      q('#mbSendChar').addEventListener('click', () => { close(null); fscSendDialog(); });
      q('#mbImport').addEventListener('click', () => { close(null); fscPickFiles(); });
      q('#mbSendImg') && q('#mbSendImg').addEventListener('click', () => { close(null); mboxSendImages(); });
      q('#mbSync') && q('#mbSync').addEventListener('click', () => { close(null); syncDialog(); });
      q('#mbOn') && q('#mbOn').addEventListener('change', e => { lsSet(MBOX_ON_LS, e.target.checked ? '' : 'off'); if (e.target.checked) mboxPoll(true); else { mboxItems = []; mboxSync(); } });
      q('#mbAuto') && q('#mbAuto').addEventListener('change', e => { lsSet(SYNC_AUTO_LS, e.target.checked ? '' : 'off'); toast(e.target.checked ? '☁ Máy này tự đồng bộ cả dự án' : '☁ Máy này không tự gửi cả dự án nữa — chỉ dùng Hộp thư', 3000); });
    } });
}

/* ---- 📱 Chế độ gọn cho tablet: chỉ vẽ, nhập ảnh, cắt nhân vật, khớp, dáng, vẽ lại mảnh, gửi ---- */
const GON_HIDE_TOOLS = ['lasso', 'vedit', 'fx'];
function gonSet(on) {
  document.body.classList.toggle('gon', on); lsSet(GON_LS, on ? '1' : '');
  if (on) {
    if (GON_HIDE_TOOLS.includes(S.tool)) setTool('brush');
    if (TABS.pp === 'frames') openTab('pp', 'pose');
    if (S.layer === 'bg') setLayer('char');
  }
  setTimeout(() => fitView(), 80);
}
async function gonDialog() {
  const on = document.body.classList.contains('gon');
  const v = await modal({ title: '📱 Chế độ gọn cho tablet',
    html: `<p>Chỉ hiện những gì cần để <b>vẽ và cắt nhân vật</b>: bút, tẩy, đổ màu, hút màu, nhập ảnh, 🧩 Ghép (✂ cắt từng bộ phận, 🔧 sửa khớp, 🦴 tạo dáng, ✎ vẽ lại mảnh), hoàn tác, và nút <b>📤 Gửi</b> / <b>📮 Hộp thư</b> ở thanh bên trái.</p>
      <p>Ẩn dòng frame, chữ & FX, camera, layer, nền, AI. Bài vẽ không mất gì, tắt chế độ gọn là thấy lại đủ.</p>`,
    buttons: [{ label: 'Đóng', value: null }, { label: on ? 'Tắt chế độ gọn' : '📱 Bật chế độ gọn', value: on ? 'off' : 'on', primary: true }] });
  if (v) gonSet(v === 'on');
}
$('#sendBtn').addEventListener('click', fscSendDialog);
$('#mailBtn').addEventListener('click', mboxDialog);
$('#gonExit').addEventListener('click', () => gonSet(false));
$('#ppSendBtn').addEventListener('click', fscSendDialog);
if (lsGet(GON_LS)) document.body.classList.add('gon');
