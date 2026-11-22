/* ========= AI character generator: photo → cartoon character (Google Gemini, the user's own key) ========= */
// The key is typed by the user and kept ONLY in this device's localStorage (never in projects, ZIPs or the repo).
const AI_KEY_LS = 'fs-gemini-key', AI_MODEL_LS = 'fs-gemini-model', AI_PROMPT_LS = 'fs-ai-prompt', AI_LIB_KEY = 'ai-chars', AI_REF_KEY = 'ai-style-ref';
const AI_DEFAULT_MODEL = 'gemini-2.5-flash-image';
const AI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const AI_DEFAULT_PROMPT = 'Redraw the person in photo 2 in the exact style of image 1: thin dark-brown outline, flat colors with soft shading, big head, long thin neck, skinny body and limbs, big round eyes, full body, standing, white background. Keep their hair, face shape and outfit.';
// always added: no logos (trademark risk) + a pose that the quick-make cutter handles well
const AI_FIXED_PROMPT = 'Do not draw any logos, team crests, brand marks, sponsor text or numbers on the clothes; keep the clothing plain. Face the viewer, arms hanging slightly away from the body so every limb is clearly separated. Draw only this one character, no other objects, no text.';
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
const aiKey = () => lsGet(AI_KEY_LS).trim();
const aiModel = () => lsGet(AI_MODEL_LS).trim() || AI_DEFAULT_MODEL;
const aiPrompt = () => lsGet(AI_PROMPT_LS).trim() || AI_DEFAULT_PROMPT;
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Built-in style reference, drawn in code (an original character, no real person): thin dark-brown outline,
// flat colours + soft shading, big head, long thin neck, skinny limbs, big round eyes, white background.
function aiStyleRefCanvas() {
  const c = makeCanvas(600, 900), x = c.getContext('2d'), OL = '#4a2a16';
  x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 900); x.lineJoin = x.lineCap = 'round';
  const part = (build, fill, shade = 0.16) => {
    const p = new Path2D(); build(p);
    x.fillStyle = fill; x.fill(p);
    const b = { x0: 0, x1: 600 }; x.save(); x.clip(p);       // soft shading: darker towards the right side
    const g = x.createLinearGradient(b.x0, 0, b.x1, 0); g.addColorStop(0.45, 'rgba(70,35,10,0)'); g.addColorStop(0.75, `rgba(70,35,10,${shade})`);
    x.fillStyle = g; x.fillRect(0, 0, 600, 900); x.restore();
    x.strokeStyle = OL; x.lineWidth = 3.5; x.stroke(p);
  };
  const limb = (p, ax, ay, bx, by, w) => { const a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    p.moveTo(ax + nx, ay + ny); p.lineTo(bx + nx, by + ny); p.arc(bx, by, w / 2, a + Math.PI / 2, a - Math.PI / 2, true); p.lineTo(ax - nx, ay - ny); p.arc(ax, ay, w / 2, a - Math.PI / 2, a + Math.PI / 2, true); p.closePath(); };
  const SKIN = '#f2c49b', SHIRT = '#3fa7d6', SHORTS = '#2f3e66', SHOE = '#e0533d', HAIR = '#5a3420';
  // legs + socks + shoes
  for (const [ax, bx] of [[272, 262], [328, 338]]) {
    part(p => limb(p, ax, 690, bx, 800, 20), SKIN);
    part(p => limb(p, bx, 792, bx, 832, 22), '#ffffff', 0.1);
    part(p => p.ellipse(bx + (bx < 300 ? -10 : 10), 846, 34, 16, 0, 0, Math.PI * 2), SHOE);
  }
  // arms (hang a little away from the body) + hands
  part(p => limb(p, 228, 500, 186, 676, 22), SKIN); part(p => p.arc(182, 690, 19, 0, Math.PI * 2), SKIN);
  part(p => limb(p, 372, 500, 414, 676, 22), SKIN); part(p => p.arc(418, 690, 19, 0, Math.PI * 2), SKIN);
  // shorts
  part(p => { p.moveTo(244, 625); p.lineTo(356, 625); p.lineTo(368, 702); p.lineTo(306, 706); p.lineTo(300, 676); p.lineTo(294, 706); p.lineTo(232, 702); p.closePath(); }, SHORTS);
  // t-shirt with short sleeves
  part(p => { p.moveTo(262, 470); p.quadraticCurveTo(300, 488, 338, 470); p.lineTo(384, 490); p.lineTo(404, 548); p.lineTo(372, 560); p.lineTo(360, 532);
    p.lineTo(358, 640); p.lineTo(242, 640); p.lineTo(240, 532); p.lineTo(228, 560); p.lineTo(196, 548); p.lineTo(216, 490); p.closePath(); }, SHIRT);
  // long thin neck
  part(p => { p.moveTo(287, 380); p.lineTo(313, 380); p.lineTo(315, 476); p.quadraticCurveTo(300, 484, 285, 476); p.closePath(); }, SKIN, 0.22);
  // ears, head, hair
  part(p => p.ellipse(150, 250, 26, 36, 0, 0, Math.PI * 2), SKIN); part(p => p.ellipse(450, 250, 26, 36, 0, 0, Math.PI * 2), SKIN);
  part(p => p.ellipse(300, 235, 150, 160, 0, 0, Math.PI * 2), SKIN);
  part(p => { p.moveTo(148, 230); p.bezierCurveTo(130, 90, 230, 50, 300, 58); p.bezierCurveTo(390, 52, 470, 100, 452, 232);
    p.quadraticCurveTo(440, 170, 400, 150); p.quadraticCurveTo(360, 185, 300, 160); p.quadraticCurveTo(250, 190, 205, 150); p.quadraticCurveTo(165, 175, 148, 230); p.closePath(); }, HAIR, 0.2);
  // big round eyes with highlights
  for (const ex of [245, 355]) {
    part(p => p.arc(ex, 255, 40, 0, Math.PI * 2), '#ffffff', 0.06);
    x.fillStyle = '#3a2214'; x.beginPath(); x.arc(ex + 4, 260, 21, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(ex - 4, 250, 8, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(ex + 12, 270, 3.5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.arc(ex, 255, 52, Math.PI * 1.22, Math.PI * 1.7); x.stroke();   // eyebrow
  }
  // nose, smile, cheeks
  x.strokeStyle = OL; x.lineWidth = 3.5; x.beginPath(); x.moveTo(300, 290); x.quadraticCurveTo(290, 315, 306, 318); x.stroke();
  part(p => { p.moveTo(262, 340); p.quadraticCurveTo(300, 380, 338, 340); p.quadraticCurveTo(300, 352, 262, 340); p.closePath(); }, '#b8433a', 0.05);
  x.fillStyle = 'rgba(240,120,110,.35)'; for (const cx of [205, 395]) { x.beginPath(); x.ellipse(cx, 318, 24, 13, 0, 0, Math.PI * 2); x.fill(); }
  return c;
}

const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const canvasBlob = (c, type = 'image/png', q) => new Promise(res => c.toBlob(res, type, q));
async function aiPrepImage(src, max = 1024) {   // src: Blob or canvas → {mime, data(base64)}, downscaled to keep the request small
  let bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = makeCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k))), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return { mime: 'image/jpeg', data: await blobToB64(await canvasBlob(c, 'image/jpeg', 0.9)) };
}

// Turn any Gemini failure into a clear Vietnamese message.
function aiErrMsg(status, j) {
  const e = (j && j.error) || {}, msg = String(e.message || ''), st = String(e.status || ''),
    reasons = (e.details || []).map(d => d && d.reason).filter(Boolean).join(' ');
  const err = m => Object.assign(new Error(m), { aiStatus: status, raw: msg });
  if (/API_KEY_INVALID|API key not valid|API_KEY_/i.test(reasons + ' ' + msg)) return err('🔑 Key Gemini không đúng. Mở 🔑 Key Gemini, dán lại key (lấy ở aistudio.google.com/apikey) rồi thử lại.');
  if (status === 429 || st === 'RESOURCE_EXHAUSTED') return err('⏳ Hết lượt dùng (quota) của key này. Chờ một lúc (thường 1 phút, hoặc sang ngày mới) rồi thử lại. Nếu luôn báo lỗi này: model tạo ảnh có thể cần bật thanh toán (billing) trong Google AI Studio.');
  if (status === 401 || status === 403 || st === 'PERMISSION_DENIED' || st === 'UNAUTHENTICATED') return err('🔒 Key này không được dùng Gemini API (chưa bật API, bị giới hạn, hoặc khu vực chưa hỗ trợ). Kiểm tra key trong Google AI Studio.');
  if (status === 404 || st === 'NOT_FOUND') return err(`❓ Không tìm thấy model "${aiModel()}". Mở 🔑 Key Gemini và đổi tên model (mặc định: ${AI_DEFAULT_MODEL}).`);
  if (status >= 500 || st === 'UNAVAILABLE') return err('🌧 Máy chủ Google đang bận. Thử lại sau ít phút.');
  if (status === 400) return err('⚠️ Google không nhận yêu cầu: ' + (msg || 'ảnh hoặc câu lệnh không hợp lệ') + '. Thử ảnh khác (JPG/PNG).');
  return err(`⚠️ Lỗi từ Google (${status || 'không rõ'}): ${msg || 'không có chi tiết'}`);
}

// One call to Gemini. Image 1 = style reference, photo 2 = the person. Returns a PNG/JPEG Blob.
// images: [{label, img}] in place of refImg/photoImg (🪄 AI vẽ đẹp); aspect = the picture shape to ask for
async function geminiGenerate({ key, model, prompt, refImg, photoImg, images, aspect = '3:4', signal, fetchFn = fetch }) {
  const imgs = images || [{ label: 'Image 1 (style reference):', img: refImg }, { label: 'Photo 2 (the person to redraw):', img: photoImg }];
  const mk = withCfg => ({
    contents: [{ role: 'user', parts: [
      ...imgs.flatMap(e => [{ text: e.label }, { inline_data: { mime_type: e.img.mime, data: e.img.data } }]),
      { text: prompt } ] }],
    generationConfig: Object.assign({ responseModalities: ['TEXT', 'IMAGE'] }, withCfg ? { imageConfig: { aspectRatio: aspect } } : {})
  });
  const call = async withCfg => {
    let r;
    try { r = await fetchFn(AI_ENDPOINT + encodeURIComponent(model) + ':generateContent', { method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(mk(withCfg)) }); }
    catch (e) { if ((signal && signal.aborted) || e.name === 'AbortError') throw e; throw Object.assign(new Error('📶 Không kết nối được Google. Kiểm tra mạng (cần có Internet để dùng AI) rồi thử lại.'), { aiStatus: 0 }); }
    let j = null; try { j = await r.json(); } catch (e) {}
    return { r, j };
  };
  let { r, j } = await call(true);
  // older image models may not know imageConfig → try once more without it
  if (r.status === 400 && /imageConfig|aspect_?ratio|image_config/i.test(JSON.stringify(j || {}))) ({ r, j } = await call(false));
  if (!r.ok) throw aiErrMsg(r.status, j);
  const pf = j && j.promptFeedback, cand = (j && j.candidates || [])[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const img = parts.map(p => p.inlineData || p.inline_data).find(d => d && d.data);
  if (img) { const bin = atob(img.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: img.mimeType || img.mime_type || 'image/png' }); }
  const why = (pf && pf.blockReason) || (cand && cand.finishReason) || '';
  if (/SAFETY|PROHIBITED|BLOCK|RECITATION|SPII/i.test(why)) throw Object.assign(new Error('🚫 AI từ chối vẽ ảnh này (lý do an toàn nội dung: ' + why + '). Thử một ảnh khác: một người, mặc đồ bình thường, rõ mặt.'), { aiStatus: 200 });
  const said = parts.map(p => p.text).filter(Boolean).join(' ').slice(0, 200);
  throw Object.assign(new Error('🤔 AI không trả về hình' + (said ? ': “' + said + '”' : '') + '. Bấm Tạo lại để thử lần nữa.'), { aiStatus: 200 });
}

// library of generated characters (IndexedDB, this device only)
async function aiLib() { try { return (await idbGet(AI_LIB_KEY)) || []; } catch (e) { return []; } }
async function aiLibAdd(blob) { const L = await aiLib(); L.unshift({ id: 'ai' + Date.now().toString(36), t: Date.now(), png: blob }); L.length = Math.min(L.length, 40); await idbPut(AI_LIB_KEY, L); return L[0]; }
async function aiLibDel(id) { await idbPut(AI_LIB_KEY, (await aiLib()).filter(e => e.id !== id)); }
async function aiQuickCut(blob) {   // hand the character to the quick-make cutter (Nhân vật ghép)
  let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { toast('Không đọc được hình'); return; }
  if (playing) stopPlay(); wizImport = true; openImport(bmp);
}

function aiKeyDialog() {
  return modal({ title: '🔑 Key Gemini (AI tạo nhân vật)', html: `
<p style="margin-top:0">Dán key Gemini API của bạn. Lấy miễn phí ở <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--accent)">aistudio.google.com/apikey</a>.</p>
<p class="lbl" style="font-size:13px">🔒 Key chỉ lưu trên máy này (trong trình duyệt). Không nằm trong dự án, file ZIP hay video xuất ra. Đừng gửi key cho ai.</p>
<div style="display:flex;gap:6px;align-items:center"><input id="aiKeyIn" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${escHtml(aiKey())}" style="flex:1;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"><button class="btn" id="aiKeyEye" style="min-width:44px">👁</button></div>
<div class="set-row"><span>Model tạo ảnh</span><input id="aiModelIn" type="text" spellcheck="false" value="${escHtml(aiModel())}" style="width:230px;min-height:40px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text)"></div>
<p class="lbl" style="font-size:12px;margin:0">Để trống ô model = dùng mặc định <b>${AI_DEFAULT_MODEL}</b>.</p>
<div class="lbl" id="aiKeyMsg" style="font-size:13px;min-height:20px;margin-top:8px"></div>`,
    buttons: [{ label: 'Xoá key', value: 'del', cls: 'danger', action: () => { lsSet(AI_KEY_LS, ''); toast('Đã xoá key khỏi máy này'); } },
      { label: 'Kiểm tra key', value: null, action: async () => {
        const ov = document.querySelector('#aiKeyIn').closest('.ov'), m = ov.querySelector('#aiKeyMsg'), k = ov.querySelector('#aiKeyIn').value.trim(), md = ov.querySelector('#aiModelIn').value.trim() || AI_DEFAULT_MODEL;
        if (!k) { m.textContent = 'Chưa dán key.'; return false; }
        m.textContent = 'Đang kiểm tra…';
        try { const r = await fetch(AI_ENDPOINT + encodeURIComponent(md), { headers: { 'x-goog-api-key': k } }); let j = null; try { j = await r.json(); } catch (e) {}
          m.textContent = r.ok ? '✅ Key dùng được với model ' + md + '.' : aiErrMsg(r.status, j).message; }
        catch (e) { m.textContent = '📶 Không kết nối được Google. Kiểm tra mạng.'; }
        return false; } },
      { label: 'Lưu', value: 'save', primary: true, action: () => {
        const ov = document.querySelector('#aiKeyIn').closest('.ov');
        lsSet(AI_KEY_LS, ov.querySelector('#aiKeyIn').value.trim()); const md = ov.querySelector('#aiModelIn').value.trim(); lsSet(AI_MODEL_LS, md === AI_DEFAULT_MODEL ? '' : md);
        toast(aiKey() ? 'Đã lưu key trên máy này' : 'Chưa có key'); } }],
    onOpen: ov => { ov.querySelector('#aiKeyEye').addEventListener('click', () => { const i = ov.querySelector('#aiKeyIn'); i.type = i.type === 'password' ? 'text' : 'password'; }); }
  });
}

async function aiCharDialog() {
  if (playing) stopPlay();
  const st = { photo: null, photoUrl: '', refBlob: null, refUrl: '', ctl: null, result: null, resultUrl: '', urls: [] };
  try { st.refBlob = (await idbGet(AI_REF_KEY)) || null; } catch (e) {}
  const url = b => { const u = URL.createObjectURL(b); st.urls.push(u); return u; };
  const builtinRefUrl = aiStyleRefCanvas().toDataURL('image/png');
  const box = 'width:110px;height:140px;border-radius:10px;border:1px dashed var(--line);background:#fff;object-fit:contain;display:block';
  const html = `
<p style="margin-top:0">Chọn ảnh chụp 1 người → AI vẽ lại thành nhân vật hoạt hình (đầu to, cổ dài, tay chân mảnh, mắt tròn) → lưu vào <b>Nhân vật AI</b> bên dưới → bấm <b>✂ Cắt mảnh</b> để làm động.</p>
<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
  <div><div class="lbl" style="font-size:13px;margin-bottom:4px">1. Ảnh người thật</div><img id="aiPhotoPv" alt="" style="${box}"><button class="btn primary" id="aiPhotoBtn" style="margin-top:6px;width:110px">📷 Chọn ảnh</button></div>
  <div><div class="lbl" style="font-size:13px;margin-bottom:4px">2. Ảnh mẫu phong cách</div><img id="aiRefPv" alt="" style="${box}"><div style="display:flex;gap:4px;margin-top:6px"><button class="btn" id="aiRefBtn" title="Dùng ảnh mẫu của bạn" style="min-width:52px">🖼 Đổi</button><button class="btn" id="aiRefReset" title="Dùng ảnh mẫu có sẵn của app" style="min-width:52px">↺</button></div></div>
  <div style="flex:1;min-width:220px"><div class="lbl" style="font-size:13px;margin-bottom:4px">3. Kết quả</div><div style="position:relative"><img id="aiResPv" alt="" style="${box};width:100%;max-width:240px;height:240px"><div id="aiBusy" class="lbl" hidden style="position:absolute;inset:0;max-width:240px;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,.55);color:#fff;border-radius:10px;padding:8px;font-size:13px"></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" id="aiGoBtn">✨ Tạo nhân vật</button><button class="btn" id="aiCutBtn" disabled style="border-color:#ff3b9a">✂ Cắt mảnh</button></div></div>
</div>
<div id="aiErr" role="alert" style="display:none;margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,84,104,.14);border:1px solid var(--danger);font-size:14px;line-height:1.4"></div>
<details style="margin-top:10px"><summary class="lbl" style="cursor:pointer;min-height:32px">✏️ Câu lệnh gửi AI (tiếng Anh, sửa được)</summary>
  <textarea id="aiPromptIn" rows="4" style="width:100%;box-sizing:border-box;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:14px">${escHtml(aiPrompt())}</textarea>
  <p class="lbl" style="font-size:12px;margin:4px 0">Luôn thêm: không vẽ logo/chữ trên áo (tránh vi phạm thương hiệu), tay hơi dang để dễ cắt mảnh. <button class="btn" id="aiPromptReset" style="min-height:32px;padding:2px 8px">↺ Câu mặc định</button></p></details>
<div class="set-row" style="margin-top:6px"><span id="aiKeyState" class="lbl" style="font-size:13px"></span><button class="btn" id="aiKeyBtn">🔑 Key Gemini</button></div>
<p class="lbl" style="font-size:12px;margin:4px 0 0">Ảnh được gửi tới Google Gemini bằng key của bạn để vẽ lại. Chỉ dùng ảnh của bạn hoặc của người đã đồng ý.</p>
<h4 style="margin:12px 0 6px">🗂 Nhân vật AI đã tạo</h4><div id="aiLib" style="display:flex;gap:8px;flex-wrap:wrap"></div>`;
  modal({ title: '🤖 AI tạo nhân vật từ ảnh', html, buttons: [{ label: 'Đóng', value: null }], dismissable: false, onOpen: (ov, close) => {
    ov.querySelector('.dlg').classList.add('wide');
    const q = s => ov.querySelector(s), errBox = q('#aiErr');
    const showErr = m => { errBox.textContent = m || ''; errBox.style.display = m ? 'block' : 'none'; };
    const keyState = () => { q('#aiKeyState').textContent = aiKey() ? '🔑 Đã có key trên máy này ✓' : '🔑 Chưa có key Gemini — bấm nút bên phải để dán key'; };
    const refShow = () => { q('#aiRefPv').src = st.refBlob ? url(st.refBlob) : builtinRefUrl; q('#aiRefReset').disabled = !st.refBlob; };
    const pick = () => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0] || null); i.click(); });
    const libShow = async () => {
      const L = await aiLib(), el = q('#aiLib'); el.innerHTML = '';
      if (!L.length) { el.innerHTML = '<span class="lbl" style="font-size:13px">Chưa có nhân vật nào.</span>'; return; }
      for (const e of L) {
        const d = document.createElement('div'); d.className = 'ai-item'; d.dataset.id = e.id;
        d.style.cssText = 'display:flex;flex-direction:column;gap:4px;align-items:center';
        d.innerHTML = `<img alt="" src="${url(e.png)}" style="width:84px;height:112px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)"><div style="display:flex;gap:4px"><button class="btn" data-a="cut" title="Cắt mảnh để làm động" style="min-width:44px">✂</button><button class="btn" data-a="del" title="Xoá" style="min-width:44px;color:var(--danger)">🗑</button></div>`;
        d.querySelector('[data-a=cut]').addEventListener('click', () => { close(null); aiQuickCut(e.png); });
        d.querySelector('[data-a=del]').addEventListener('click', async () => { await aiLibDel(e.id); libShow(); });
        el.append(d);
      }
    };
    keyState(); refShow(); libShow();
    q('#aiPhotoBtn').addEventListener('click', async () => { const f = await pick(); if (!f) return; st.photo = f; q('#aiPhotoPv').src = url(f); showErr(''); });
    q('#aiRefBtn').addEventListener('click', async () => { const f = await pick(); if (!f) return; st.refBlob = f; try { await idbPut(AI_REF_KEY, f); } catch (e) {} refShow(); toast('Đã dùng ảnh mẫu của bạn'); });
    q('#aiRefReset').addEventListener('click', async () => { st.refBlob = null; try { await idbDel(AI_REF_KEY); } catch (e) {} refShow(); toast('Dùng lại ảnh mẫu có sẵn'); });
    q('#aiPromptReset').addEventListener('click', () => { q('#aiPromptIn').value = AI_DEFAULT_PROMPT; lsSet(AI_PROMPT_LS, ''); });
    q('#aiPromptIn').addEventListener('change', e => { const v = e.target.value.trim(); lsSet(AI_PROMPT_LS, v && v !== AI_DEFAULT_PROMPT ? v : ''); });
    q('#aiKeyBtn').addEventListener('click', async () => { ov.style.display = 'none'; await aiKeyDialog(); ov.style.display = ''; keyState(); });
    q('#aiCutBtn').addEventListener('click', () => { if (!st.result) return; close(null); aiQuickCut(st.result); });
    const busy = t => { const b = q('#aiBusy'); b.hidden = !t; b.textContent = t || ''; };
    q('#aiGoBtn').addEventListener('click', async () => {
      const go = q('#aiGoBtn');
      if (st.ctl) { st.ctl.abort(); return; }              // second tap = cancel
      showErr('');
      if (!aiKey()) { showErr('🔑 Chưa có key Gemini. Bấm 🔑 Key Gemini để dán key của bạn.'); return; }
      if (!st.photo) { showErr('📷 Chọn ảnh người thật trước (bước 1).'); return; }
      st.ctl = new AbortController(); const timer = setTimeout(() => st.ctl && st.ctl.abort('timeout'), 120000);
      go.textContent = '✕ Huỷ'; busy('🎨 AI đang vẽ… (thường 10–40 giây)');
      try {
        const refImg = await aiPrepImage(st.refBlob || aiStyleRefCanvas(), 768), photoImg = await aiPrepImage(st.photo, 1024);
        const prompt = (q('#aiPromptIn').value.trim() || AI_DEFAULT_PROMPT) + ' ' + AI_FIXED_PROMPT;
        const blob = await geminiGenerate({ key: aiKey(), model: aiModel(), prompt, refImg, photoImg, signal: st.ctl.signal });
        st.result = blob; q('#aiResPv').src = url(blob); q('#aiCutBtn').disabled = false;
        await aiLibAdd(blob); libShow(); go.textContent = '🔁 Tạo lại';
        toast('Xong! Đã lưu vào Nhân vật AI. Bấm ✂ Cắt mảnh để làm động', 3500);
      } catch (e) {
        go.textContent = st.result ? '🔁 Tạo lại' : '✨ Tạo nhân vật';
        if (e.name === 'AbortError' || (st.ctl && st.ctl.signal.aborted)) showErr(st.ctl && st.ctl.signal.reason === 'timeout' ? '⌛ AI trả lời quá lâu (2 phút). Thử lại nhé.' : 'Đã huỷ.');
        else { console.warn('AI character:', e.aiStatus, e.raw || e); showErr(e.message); }
      } finally { clearTimeout(timer); st.ctl = null; busy(''); }
    });
    // free object URLs when the dialog goes away
    const mo = new MutationObserver(() => { if (!ov.isConnected) { mo.disconnect(); if (st.ctl) st.ctl.abort(); st.urls.forEach(u => URL.revokeObjectURL(u)); } });
    mo.observe(document.body, { childList: true });
  } });
}

