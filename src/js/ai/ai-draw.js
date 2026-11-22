/* ========= 🪄 AI vẽ đẹp: one tap with Gemini (the user's own key) =========
   ✨ clean a rough sketch into finished line + colour art (same pose and place), 🎨 colour line art, 🎞 draw the in-between frame
   between this frame and the next. The answer goes back through the line/colour split (nét → lớp Nhân vật, màu → lớp Màu) as a
   floating picture over the whole frame, so Xong puts it down (one undo step) and Huỷ brings the old drawing back. */
const AI_FX_LS = 'fs-ai-fx';
const AI_FX = {
  clean: { lbl: '✨ Làm đẹp nét phác', tip: 'Vẽ phác nhanh, AI vẽ lại thành nét sạch + tô màu, giữ đúng dáng và chỗ đứng.' },
  color: { lbl: '🎨 Tô màu', tip: 'Giữ nguyên nét của bạn, AI chỉ tô màu vào lớp Màu (nét cũ không đổi).' },
  ib: { lbl: '🎞 Vẽ frame giữa', tip: 'AI vẽ dáng ở giữa frame này và frame sau, thêm thành frame mới chen vào giữa.' }
};
const AI_NO_LOGO = 'Do not draw any logos, team crests, brand marks, sponsor text, letters or numbers.';
function aiFxPrompt(mode, withRef, note) {
  const same = 'Keep EXACTLY the same canvas framing, pose, positions, sizes and proportions, so the result lines up when placed over the original.';
  let p;
  if (mode === 'color') p = 'Image 1 is black line art: one frame of a 2D cartoon animation. Colour it: keep every line exactly where it is with the same thickness, do not move, add or remove any line. Fill each closed area with a flat colour plus soft simple shading. ' + same + ' Plain pure white background.';
  else if (mode === 'ib') p = 'Image 1 and image 2 are two key frames of the same 2D cartoon animation, on the same canvas. Draw the ONE in-between frame exactly halfway between them: the same character with the same design, style, colours, line weight and size; the pose and position halfway from image 1 to image 2, moving along natural arcs. Keep the same canvas framing as the key frames. Plain pure white background.';
  else p = 'Image 1 is a rough sketch: one frame of a 2D cartoon animation. Redraw it as clean, finished cartoon art: smooth confident dark outlines, flat colours with soft simple shading, tidy shapes. ' + same + ' Plain pure white background, do not add a scene or other objects.';
  if (withRef && mode !== 'ib') p += ' Use the drawing style of image 2 (style reference: line colour and weight, colouring, shading), but not its character or pose.';
  if (note) p += ' What is drawn: ' + note + '.';
  return p + ' ' + AI_NO_LOGO + ' Draw no text.';
}
// a frame as the AI should see it: colour + character pixels + cut-out character + vector lines on white (no background layer)
async function aiFrameShot(f) {
  await ensureLoaded(f);
  const c = makeCanvas(W, H), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  if (f.col) x.drawImage(f.col, 0, 0);
  if (f.canvas) x.drawImage(f.canvas, 0, 0);
  if (S.pp) drawPuppet(x, f.pp, f.lip);
  drawVec(x, f.vec);
  return c;
}
function aiFrameEmpty(f) {
  if ((f.vec || []).length || (S.pp && S.pp.parts.length)) return false;
  for (const cv of [f.canvas, f.col]) if (cv) { const d = cv.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) return false; }
  return true;
}
const aiAspect = () => { const r = W / H; return r < 0.7 ? '9:16' : r < 0.9 ? '3:4' : r < 1.15 ? '1:1' : r < 1.5 ? '4:3' : '16:9'; };
// the white paper around the drawing → transparent (flood from the edges, so white eyes/teeth inside the drawing stay)
function aiWhiteMask(img) {
  const w = img.width, h = img.height, d = img.data, n = w * h, fig = new Float32Array(n).fill(1), seen = new Uint8Array(n), st = [];
  const paper = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 26; };
  const push = i => { if (!seen[i] && paper(i)) { seen[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w; fig[i] = 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w); }
  return fig;
}
async function aiSplitResult(blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), c = makeCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k))), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
  const img = x.getImageData(0, 0, c.width, c.height);
  return splitLineColor(img, aiWhiteMask(img), 55, true);
}
// put the AI picture over the whole frame as a floating picture (Xong = one undo step, Huỷ = as before)
function aiPlace(res, mode, replace) {
  const empty = makeCanvas(res.line.width, res.line.height);
  floatFromImage(mode === 'color' ? empty : res.line, res.col);
  const fl = floating; if (!fl) return false;
  fl.scale = Math.min(W / fl.c.width, H / fl.c.height); fl.cx = W / 2; fl.cy = H / 2;
  if (replace && mode === 'clean') {   // the rough sketch goes away under the clean picture (Huỷ / ↶ bring it back)
    const o = fl.o; o.canvas.getContext('2d').clearRect(0, 0, W, H);
    if (o.col) { o.col.getContext('2d').clearRect(0, 0, W, H); o.colVer++; }
    if ((o.vec || []).length) { fl.vecBefore = cloneVec(o.vec); o.vec = []; }
    fl.dirty = [0, 0, W, H]; o.ver++;
  }
  showSelbar(); requestRender(); return true;
}
async function aiFxDialog() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  const st = { mode: AI_FX[lsGet(AI_FX_LS)] ? lsGet(AI_FX_LS) : 'clean', ctl: null, result: null, res: null, resMode: '', ia: S.cur, urls: [], useRef: true, replace: true };
  let refBlob = null; try { refBlob = (await idbGet(AI_REF_KEY)) || null; } catch (e) {}
  const url = b => { const u = URL.createObjectURL(b); st.urls.push(u); return u; };
  const box = 'width:100%;max-width:170px;aspect-ratio:' + W + '/' + H + ';border-radius:10px;border:1px solid var(--line);background:#fff;object-fit:contain;display:block';
  const html = `
<p style="margin-top:0">Vẽ phác thật nhanh, để AI làm phần tốn công. Kết quả đặt vào frame thành <b>hình nổi</b>: nét vào lớp <b>Nhân vật</b>, màu vào lớp <b>Màu</b>. Bấm <b>Xong</b> để giữ, <b>Huỷ</b> để bỏ.</p>
<div class="chips" id="axModes" style="display:flex;gap:6px;flex-wrap:wrap">${Object.keys(AI_FX).map(k => `<button class="chip" data-ax="${k}">${AI_FX[k].lbl}</button>`).join('')}</div>
<p class="lbl" id="axTip" style="font-size:13px;margin:6px 0"></p>
<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">
  <div style="flex:1;min-width:120px"><div class="lbl" style="font-size:13px;margin-bottom:4px" id="axSrcLbl">Gửi đi</div><div style="display:flex;gap:6px"><img id="axSrcA" alt="" style="${box}"><img id="axSrcB" alt="" style="${box}" hidden></div></div>
  <div style="flex:1;min-width:120px"><div class="lbl" style="font-size:13px;margin-bottom:4px">Kết quả</div><div style="position:relative;max-width:170px"><img id="axRes" alt="" style="${box}"><div id="axBusy" class="lbl" hidden style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,.55);color:#fff;border-radius:10px;padding:8px;font-size:13px"></div></div></div>
</div>
<div class="set-row"><span>Mô tả thêm (không bắt buộc)</span><input id="axNote" type="text" spellcheck="false" placeholder="VD: cầu thủ đang sút bóng" style="flex:1;max-width:260px;min-height:42px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:15px"></div>
<label class="set-row" id="axRefRow"><span>Vẽ theo ảnh mẫu phong cách (như 🤖 AI nhân vật)</span><input type="checkbox" id="axRef" checked></label>
<label class="set-row" id="axRepRow"><span>Thay nét phác cũ bằng hình mới</span><input type="checkbox" id="axRep" checked></label>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" id="axGo">✨ Cho AI vẽ</button><button class="btn" id="axPut" disabled style="border-color:#ff3b9a">📥 Đặt vào frame</button><button class="btn" id="axImp" disabled title="Mở trong Nhập ảnh để tách nền, tách nét + màu, cắt mảnh…">✂ Mở trong Nhập ảnh</button></div>
<div id="axErr" role="alert" style="display:none;margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,84,104,.14);border:1px solid var(--danger);font-size:14px;line-height:1.4"></div>
<div class="set-row" style="margin-top:6px"><span id="axKeyState" class="lbl" style="font-size:13px"></span><button class="btn" id="axKeyBtn">🔑 Key Gemini</button></div>
<p class="lbl" style="font-size:12px;margin:4px 0 0">Hình của frame được gửi tới Google Gemini bằng key của bạn. AI không bao giờ giống 100%: kéo, đổi cỡ hình nổi cho khớp rồi bấm Xong, hoặc bấm Vẽ lại.</p>`;
  return modal({ title: '🪄 AI vẽ đẹp', html, buttons: [{ label: 'Đóng', value: null }], dismissable: false, onOpen: (ov, close) => {
    ov.querySelector('.dlg').classList.add('wide');
    const q = s => ov.querySelector(s), errBox = q('#axErr');
    const showErr = m => { errBox.textContent = m || ''; errBox.style.display = m ? 'block' : 'none'; };
    const keyState = () => { q('#axKeyState').textContent = aiKey() ? '🔑 Đã có key trên máy này ✓' : '🔑 Chưa có key Gemini — bấm nút bên phải để dán key'; };
    const shots = {};
    const shot = async i => shots[i] || (shots[i] = await aiFrameShot(S.frames[i]));
    const sync = async () => {
      ov.querySelectorAll('[data-ax]').forEach(b => b.classList.toggle('on', b.dataset.ax === st.mode));
      q('#axTip').textContent = AI_FX[st.mode].tip;
      q('#axRefRow').hidden = st.mode === 'ib'; q('#axRepRow').hidden = st.mode !== 'clean';
      const ib = st.mode === 'ib', B = S.frames[st.ia + 1];
      q('#axSrcLbl').textContent = ib ? `Frame ${st.ia + 1} → frame ${st.ia + 2}` : `Frame ${st.ia + 1}`;
      q('#axSrcA').src = (await shot(st.ia)).toDataURL('image/jpeg', 0.8);
      q('#axSrcB').hidden = !ib || !B; if (ib && B) q('#axSrcB').src = (await shot(st.ia + 1)).toDataURL('image/jpeg', 0.8);
      q('#axGo').textContent = st.result && st.resMode === st.mode ? '🔁 Vẽ lại' : '✨ Cho AI vẽ';
      q('#axPut').disabled = q('#axImp').disabled = !(st.result && st.resMode === st.mode);
    };
    ov.querySelectorAll('[data-ax]').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.ax; lsSet(AI_FX_LS, st.mode === 'clean' ? '' : st.mode); showErr(''); sync(); }));
    q('#axNote').addEventListener('keydown', e => e.stopPropagation());
    q('#axKeyBtn').addEventListener('click', async () => { ov.style.display = 'none'; await aiKeyDialog(); ov.style.display = ''; keyState(); });
    const busy = t => { const b = q('#axBusy'); b.hidden = !t; b.textContent = t || ''; };
    q('#axGo').addEventListener('click', async () => {
      if (st.ctl) { st.ctl.abort(); return; }
      showErr('');
      if (!aiKey()) { showErr('🔑 Chưa có key Gemini. Bấm 🔑 Key Gemini để dán key của bạn.'); return; }
      const mode = st.mode, A = S.frames[st.ia], B = S.frames[st.ia + 1];
      if (mode === 'ib' && !B) { showErr('🎞 Cần có frame sau: chọn frame dáng đầu (frame sau là dáng cuối) rồi mở lại.'); return; }
      await ensureLoaded(A); if (B) await ensureLoaded(B);
      if (aiFrameEmpty(A) || (mode === 'ib' && aiFrameEmpty(B))) { showErr('✏️ Frame còn trống: vẽ phác nhân vật trước (lớp Nhân vật, Màu hoặc Nét vector).'); return; }
      st.ctl = new AbortController(); const timer = setTimeout(() => st.ctl && st.ctl.abort('timeout'), 120000);
      q('#axGo').textContent = '✕ Huỷ'; busy('🎨 AI đang vẽ… (thường 10–40 giây)');
      try {
        const useRef = mode !== 'ib' && q('#axRef').checked, note = q('#axNote').value.trim().slice(0, 200);
        const images = [await aiPrepImage(await shot(st.ia), 1024)];
        if (mode === 'ib') images.push(await aiPrepImage(await shot(st.ia + 1), 1024));
        else if (useRef) images.push(await aiPrepImage(refBlob || aiStyleRefCanvas(), 768));
        const labels = mode === 'ib' ? ['Image 1 (first key frame):', 'Image 2 (last key frame):'] : ['Image 1 (' + (mode === 'color' ? 'line art' : 'rough sketch') + '):', 'Image 2 (style reference):'];
        const blob = await geminiGenerate({ key: aiKey(), model: aiModel(), prompt: aiFxPrompt(mode, useRef, note), images: images.map((img, k) => ({ label: labels[k], img })), aspect: aiAspect(), signal: st.ctl.signal });
        busy('Đang tách nét và màu…');
        st.res = await aiSplitResult(blob); st.result = blob; st.resMode = mode; q('#axRes').src = url(blob);
        toast('Xong! Bấm 📥 Đặt vào frame', 2500);
      } catch (e) {
        if (e.name === 'AbortError' || (st.ctl && st.ctl.signal.aborted)) showErr(st.ctl && st.ctl.signal.reason === 'timeout' ? '⌛ AI trả lời quá lâu (2 phút). Thử lại nhé.' : 'Đã huỷ.');
        else { console.warn('AI fx:', e.aiStatus, e.raw || e); showErr(e.message); }
      } finally { clearTimeout(timer); st.ctl = null; busy(''); sync(); }
    });
    q('#axPut').addEventListener('click', async () => {
      if (!st.res) return;
      const mode = st.resMode, replace = q('#axRep').checked; close(null);
      if (mode === 'ib') {   // a new frame between A and B, then the in-between picture floats on it
        const A = S.frames[st.ia]; await ensureLoaded(A);
        const f = newFrameObj(A.bgId); f.dur = A.dur; f.pp = ppClone(A.pp); if (S.pp) f.ppKey = false; f.lip = lipCopy(A); f.texts = JSON.parse(JSON.stringify(A.texts || [])); lookCopy(f, A);
        loaded.push(f); S.frames.splice(st.ia + 1, 0, f);
        pushEntry({ t: targetOf(A), add: { frames: [f], index: st.ia + 1, dur0: A.dur, dur1: A.dur }, bytes: 0 });
        tintCache.clear(); if (S.pp) ppRetween(); await drawThumb(f); buildStrip(); await selectFrame(st.ia + 1); scheduleSave(); updUndoBtns();
      } else if (S.cur !== st.ia) await selectFrame(st.ia);
      if (aiPlace(st.res, mode, replace)) toast(mode === 'ib' ? `Đã thêm frame ${st.ia + 2} (frame giữa). Kéo cho khớp rồi bấm Xong` : 'Kéo, đổi cỡ cho khớp rồi bấm Xong để giữ, Huỷ để bỏ', 3500);
    });
    q('#axImp').addEventListener('click', async () => { if (!st.result) return; const b = st.result; close(null); let bmp; try { bmp = await createImageBitmap(b); } catch (e) { toast('Không đọc được hình'); return; } openImport(bmp); });
    keyState(); sync();
    const mo = new MutationObserver(() => { if (!ov.isConnected) { mo.disconnect(); if (st.ctl) st.ctl.abort(); st.urls.forEach(u => URL.revokeObjectURL(u)); } });
    mo.observe(document.body, { childList: true });
  } });
}

