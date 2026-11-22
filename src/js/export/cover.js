/* ===== 📸 Shorts cover image (thumbnail): a frame + a big title, saved as PNG at full size ===== */
const coverOpt = { text: '', style: 'yellow', pos: 'top', size: 1, dim: true, fi: null };
function drawCoverText(ctx, o) {
  const lines = String(o.text || '').toUpperCase().split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const font = s => `${s}px Bangers, 'Impact', 'Arial Black', sans-serif`;
  let s = Math.min(W, H) * 0.2 * (o.size || 1); ctx.font = font(s);
  const wmax = Math.max(...lines.map(l => ctx.measureText(l).width)); if (wmax > W * 0.9) s *= W * 0.9 / wmax;
  s = Math.max(20, s); ctx.font = font(s);
  const lh = s * 1.08, bh = lh * lines.length, cy = o.pos === 'mid' ? H * 0.5 : o.pos === 'bot' ? H * 0.72 : H * 0.2;
  if (o.dim) { const g = ctx.createLinearGradient(0, cy - bh, 0, cy + bh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - bh, W, bh * 2); }
  ctx.translate(W / 2, cy); ctx.rotate(-3 * DEG);
  lines.forEach((l, i) => {
    const y = (i - (lines.length - 1) / 2) * lh, w = ctx.measureText(l).width;
    if (o.style === 'band') { ctx.fillStyle = i % 2 ? '#111' : '#e0141e'; ctx.fillRect(-w / 2 - s * 0.25, y - lh / 2 + s * 0.04, w + s * 0.5, lh - s * 0.08); ctx.fillStyle = '#fff'; ctx.fillText(l, 0, y + s * 0.04); return; }
    ctx.lineWidth = s * 0.22; ctx.strokeStyle = o.style === 'white' ? '#e0141e' : '#111'; ctx.strokeText(l, 0, y);
    ctx.lineWidth = s * 0.1; ctx.strokeStyle = '#111'; if (o.style === 'white') ctx.strokeText(l, 0, y);
    ctx.fillStyle = o.style === 'white' ? '#fff' : i % 2 ? '#fff' : '#ffe14d'; ctx.fillText(l, 0, y);
  });
  ctx.restore();
}
async function coverDialog() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  try { await document.fonts.load('100px Bangers'); } catch (e) {}
  if (coverOpt.fi == null || coverOpt.fi >= S.frames.length) coverOpt.fi = S.cur;
  if (!coverOpt.text) { const t = S.frames.flatMap(f => f.texts || []).find(t => t.str); coverOpt.text = t ? t.str.slice(0, 40) : (S.projName && S.projName !== 'Dự án' ? S.projName : ''); }
  const full = makeCanvas(), base = makeCanvas(), fx = full.getContext('2d'); let ready = false;
  const pw = W > H ? 360 : 220, ph = Math.round(pw * H / W);
  const B = (k, v, l) => `<button class="chip small${coverOpt[k] === v ? ' on' : ''}" data-cv="${k}" data-v="${v}">${l}</button>`;
  const html = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start"><canvas id="cvPrev" width="${pw * 2}" height="${ph * 2}" style="width:${pw}px;height:${ph}px;border-radius:10px;background:#222;flex:none"></canvas>
<div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px">
<textarea id="cvTxt" rows="2" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:18px" placeholder="Chữ thật to, vd. CÚ SÚT LỖI!">${coverOpt.text.replace(/</g, '&lt;')}</textarea>
<div class="mrow"><span class="lbl">Frame</span><button class="chip small" id="cvPrevF">◀</button><span class="lbl" id="cvF"></span><button class="chip small" id="cvNextF">▶</button></div>
<div class="mrow" style="flex-wrap:wrap">${B('style', 'yellow', 'Vàng viền đen')}${B('style', 'white', 'Trắng viền đỏ')}${B('style', 'band', 'Dải màu')}</div>
<div class="mrow" style="flex-wrap:wrap"><span class="lbl">Chỗ</span>${B('pos', 'top', 'Trên')}${B('pos', 'mid', 'Giữa')}${B('pos', 'bot', 'Dưới')}</div>
<div class="mrow"><span class="lbl">Cỡ</span><input type="range" id="cvSize" min="0.4" max="1.6" step="0.05" value="${coverOpt.size}"><label class="lbl"><input type="checkbox" id="cvDim" ${coverOpt.dim ? 'checked' : ''}> làm tối sau chữ</label></div>
<p class="lbl" style="font-size:12px">Ảnh bìa ${W}×${H}. Trên YouTube Shorts: chọn ảnh này khi tải video lên (hoặc dùng làm frame đầu).</p></div></div>`;
  let act = null;
  await modal({ title: '📸 Ảnh bìa Shorts', html, buttons: [{ label: 'Đóng', value: null }, { label: '＋ Thêm làm frame đầu', action: () => { act = 'frame'; } }, { label: '💾 Lưu ảnh bìa (PNG)', primary: true, action: () => { act = 'save'; } }],
    onOpen: ov => {
      const pv = ov.querySelector('#cvPrev'), px = pv.getContext('2d');
      const paint = () => { px.setTransform(1, 0, 0, 1, 0, 0); px.clearRect(0, 0, pv.width, pv.height); if (!ready) return; px.drawImage(full, 0, 0, pv.width, pv.height); px.setTransform(pv.width / W, 0, 0, pv.height / H, 0, 0); drawCoverText(px, coverOpt); };
      const load = async () => { ready = false; ov.querySelector('#cvF').textContent = `${coverOpt.fi + 1}/${S.frames.length}`; await renderFinalFrame(fx, coverOpt.fi, base); ready = true; paint(); };
      ov.querySelector('#cvTxt').addEventListener('input', e => { coverOpt.text = e.target.value.slice(0, 80); paint(); });
      ov.querySelector('#cvSize').addEventListener('input', e => { coverOpt.size = +e.target.value; paint(); });
      ov.querySelector('#cvDim').addEventListener('change', e => { coverOpt.dim = e.target.checked; paint(); });
      ov.querySelectorAll('[data-cv]').forEach(b => b.addEventListener('click', () => { coverOpt[b.dataset.cv] = b.dataset.v; ov.querySelectorAll(`[data-cv="${b.dataset.cv}"]`).forEach(x => x.classList.toggle('on', x === b)); paint(); }));
      ov.querySelector('#cvPrevF').addEventListener('click', () => { coverOpt.fi = (coverOpt.fi - 1 + S.frames.length) % S.frames.length; load(); });
      ov.querySelector('#cvNextF').addEventListener('click', () => { coverOpt.fi = (coverOpt.fi + 1) % S.frames.length; load(); });
      load();
    } });
  if (act) {
    if (!ready) await renderFinalFrame(fx, coverOpt.fi, base);
    drawCoverText(fx, coverOpt);
    if (act === 'save') await deliverFile(await toBlob(full), `bia-${(S.projName || 'video').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'video'}-${stamp()}.png`);
    else await coverAsFrame(full);
  }
  full.width = base.width = 0;
}
// the cover as a short first frame (0.5 s) so the video opens on it (pixels in the character layer of a new frame)
async function coverAsFrame(img) {
  const f0 = S.frames[0], f = newFrameObj(f0.bgId); f.dur = 500;
  f.canvas.getContext('2d').drawImage(img, 0, 0); f.ver = 1;
  S.frames.unshift(f); loaded.push(f);   // frame order is in the automatic undo snapshot → one undo step removes it
  await drawThumb(f); buildStrip(); await selectFrame(0); scheduleSave(); toast('Đã thêm ảnh bìa làm frame đầu (0,5 giây)');
}
/* --- video export (MediaRecorder, real time) --- */
async function exportVideo() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) { toast('Trình duyệt này không quay video được — dùng Xuất ZIP', 4000); return; }
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t)); if (!mime) { toast('Không có định dạng video hỗ trợ'); return; }
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  try { await document.fonts.load('100px Bangers'); } catch (e) {}
  let cancelled = false;
  const ov = document.createElement('div'); ov.className = 'ov'; ov.innerHTML = '<div class="dlg" style="max-width:360px;text-align:center"><h3>Đang xuất video…</h3><div class="body" id="vxMsg">Chuẩn bị frame…</div><div class="btns" style="justify-content:center"><button class="btn" id="vxCancel">Huỷ</button></div></div>';
  document.body.append(ov); const msg = t => ov.querySelector('#vxMsg').textContent = t; ov.querySelector('#vxCancel').onclick = () => { cancelled = true; };
  const doneDlg = async (blob, ext, total, fast) => {
    S.exported = true;
    await modal({ title: 'Video đã xong 🎉', html: `<p>${total.toFixed(1)} giây · ${(blob.size / 1048576).toFixed(1)} MB · ${ext.toUpperCase()}${fast ? ' · ⚡ xuất nhanh' : ''}</p>${ext === 'webm' ? '<p class="lbl" style="font-size:12px">Trình duyệt này chỉ quay được WebM. YouTube/TikTok đều nhận WebM; nếu cần MP4 hãy gửi file cho Claude chuyển.</p>' : ''}`,
      buttons: [{ label: 'Đóng', value: null }, { label: 'Lưu video', primary: true, action: async () => { await deliverFile(blob, `${(S.projName || 'video').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'video'}-${stamp()}.${ext}`); } }] });
  };
  if ((!S.bgVideo || vtOn()) && S.fastVideo !== false) {
    try {
      const fb = await exportVideoFast(msg, () => cancelled);
      if (fb) { ov.remove(); await doneDlg(fb, 'mp4', frameStartTimes()[S.frames.length], true); return; }
    } catch (e) { if (e.message === 'cancel') { ov.remove(); toast('Đã huỷ xuất video'); return; } console.error(e); msg('Xuất nhanh lỗi, chuyển sang quay thường…'); }
  }
  try {
    const blobs = [], live = ppSmoothOn();
    const tmp = makeCanvas(), tx = tmp.getContext('2d');
    for (let i = 0; i < S.frames.length; i++) {
      if (cancelled) throw new Error('cancel');
      msg(`Chuẩn bị frame ${i + 1}/${S.frames.length}`); const f = S.frames[i]; await ghostLoad(f); await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
      drawFrameBase(tx, f, bg, live); evictSoon(); blobs.push(await new Promise(r => tmp.toBlob(r, S.bgVideo ? 'image/png' : 'image/jpeg', 0.93)));
    }
    tmp.width = 0;
    const out = makeCanvas(), ox = out.getContext('2d'), stream = out.captureStream(30);
    const ac = new (window.AudioContext || window.webkitAudioContext)(), dest = ac.createMediaStreamDestination();
    const T = frameStartTimes(), total = T[T.length - 1];
    let vid = null;
    if (S.bgVideo && !vtOn()) {
      vid = document.createElement('video'); vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.loop = true; vid.muted = !S.bgVideo.audio; vid.src = bgVid.url || URL.createObjectURL(new Blob([S.bgVideo.buf], { type: S.bgVideo.type || 'video/mp4' }));
      vid.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.append(vid);
      await new Promise(r => { if (vid.readyState >= 2) r(); else { vid.onloadeddata = r; vid.onerror = r; } });
      try { vid.currentTime = (S.bgVideo.offset || 0) % (vid.duration || 1); } catch (e) {}
      await new Promise(r => { vid.onseeked = r; setTimeout(r, 800); });
    }
    const hasAudio = !!(S.audio && (musicClips().length || voiceClips().length || (S.audio.sfx || []).length)) || !!(vid && S.bgVideo.audio) || vtHasAudio();
    if (vid && S.bgVideo.audio) { try { const src = ac.createMediaElementSource(vid), g = ac.createGain(); g.gain.value = S.bgVideo.vol ?? 0.7; src.connect(g).connect(dest); } catch (e) { console.error(e); } }
    if (hasAudio) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }), chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => rec.onstop = r);
    const rts = trSrcCache(live); await rts.prep(0, T);
    let bmp = await createImageBitmap(blobs[0]), bmpI = 0, nextP = blobs[1] ? createImageBitmap(blobs[1]) : null;
    drawFrameFx(ox, 0, bmp, 0, 0, vid, live ? ppLiveOver(0, 0, false) : null);
    if (vid) { try { await vid.play(); } catch (e) {} }
    if (vtOn()) { await vtSeekAt(0); vtPlayTick(0); }
    rec.start(250); let stopAudio = () => {}; if (hasAudio) stopAudio = await scheduleAudio(ac, dest, 0, total);
    const t0 = performance.now();
    await new Promise(resolve => {
      const tick = async () => {
        if (cancelled) { resolve(); return; }
        const t = (performance.now() - t0) / 1000;
        if (t >= total + 0.15) { resolve(); return; }
        let i = T.findIndex((v, k) => k < S.frames.length && t < T[k + 1]); if (i < 0) i = S.frames.length - 1;
        if (i !== bmpI) { bmp.close && bmp.close(); bmp = nextP && i === bmpI + 1 ? await nextP : await createImageBitmap(blobs[i]); bmpI = i; nextP = blobs[i + 1] ? createImageBitmap(blobs[i + 1]) : null; }
        await rts.prep(t, T); if (vtOn()) vtPlayTick(t); drawFrameFx(ox, i, bmp, t, t - T[i], vid, live ? ppLiveOver(i, t - T[i], false) : null);
        msg(`Đang quay ${t.toFixed(1)} / ${total.toFixed(1)} giây`);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    rts.done(); rec.stop(); stopAudio(); if (vid) { vid.pause(); vid.remove(); } if (vtOn()) { vtPauseAll(); bgVideoSync(true); } await done; ac.close(); stream.getTracks().forEach(t => t.stop()); out.width = 0;
    ov.remove();
    if (cancelled) { toast('Đã huỷ xuất video'); return; }
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    await doneDlg(blob, ext, total, false);
  } catch (e) { ov.remove(); if (e.message !== 'cancel') { console.error(e); toast('Lỗi xuất video: ' + e.message, 4000); } else toast('Đã huỷ'); }
}
