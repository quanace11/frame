/* ========= Toolbar wiring ========= */
function setTool(t) {
  // Chọn vùng always lifts the whole drawing under the loop: pixel lines + colour + vector lines (it used to jump to Sửa nét on lớp Nét)
  if (t === 'lasso' && selMode() !== 'layer' && (S.layer === 'vec' || S.layer === 'col')) { setLayer('char'); toast('Chọn vùng lấy cả nét vẽ, màu và nét vector bên trong vùng khoanh (đổi kiểu chọn ở thanh trên)', 2500); }
  if (t === 'pick' && S.tool !== 'pick') pickBack = S.tool;
  if (t !== 'pick') pickFav = null;
  motionClose(); rigClose();
  if (t !== 'lasso' && floating) commitFloating();
  S.tool = t;
  if (t === 'vedit' && S.layer !== 'vec') setLayer('vec');
  if (t !== 'vedit') { vsel.clear(); }
  else { const f = curFrame(); if (f && !f.vec.length && charHasPixels(f)) toast('Nét ở frame này là pixel (lớp Nhân vật). Chạm vào nét để chuyển thành nét sửa được.', 4000); }
  if (t !== 'puppet') { ppSetup = null; ppCutMode = false; ppPatchMode = false; ppPaint = null; if (HC) { HC = null; lasso = null; } }
  $('#layerPP').classList.toggle('on', t === 'puppet');
  if (t !== 'fx') { fxCamPick = false; ballMode = null; gagMode = null; ballSyncBar(); }
  updVecBar(); ppSyncBar(); fxSyncBar(); updPanelPill(); updBrushBtn(); syncSizeOp(); requestRender();
  document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  document.body.dataset.tool = t; syncLassoBar(); hcSync();
  $('#dropBtn').hidden = !(t === 'fill' || t === 'pick'); $('#dropBtn').classList.toggle('on', t === 'pick'); dropBtnLabel();
}
function setLayer(l) {
  if (floating) commitFloating();
  S.layer = l;
  if ((l === 'vec' || l === 'char') && S.lineLayer !== l) { S.lineLayer = l; saveSettings(); }   // remembered: drawing on Nét keeps lines editable next time too
  $('#layerBg').classList.toggle('on', l === 'bg'); $('#layerCol').classList.toggle('on', l === 'col'); $('#layerChar').classList.toggle('on', l === 'char'); $('#layerVec').classList.toggle('on', l === 'vec');
  if (l !== 'vec' && S.tool === 'vedit') setTool('brush');
  syncLassoBar(); lyrSync();
}
function setColor(c) {
  c = (normHex(c) || '#111111'); S.color = c; $('#curColor').style.background = c;
  document.querySelectorAll('#palette .sw').forEach(s => s.classList.toggle('on', s.dataset.c.toLowerCase() === c.toLowerCase()));
  saveSettings();
}
function updateToggles() {
  $('#onionBtn').classList.toggle('on', S.onion); $('#safeBtn').classList.toggle('on', !!S.safe);
  $('#pressBtn').classList.toggle('on', S.pressure); $('#snapBtn').classList.toggle('on', S.snap);
  $('#loopBtn').classList.toggle('on', S.loop);
  $('#layerBg').classList.toggle('hidden', !S.showBg); $('#layerChar').classList.toggle('hidden', !S.showChar); $('#layerCol').classList.toggle('hidden', !S.showCol); $('[data-eye=col]').textContent = S.showCol ? '👁' : '🚫'; $('#layerVec').classList.toggle('hidden', !S.showVec);
  $('[data-eye=bg]').textContent = S.showBg ? '👁' : '🚫'; $('[data-eye=char]').textContent = S.showChar ? '👁' : '🚫'; $('[data-eye=vec]').textContent = S.showVec ? '👁' : '🚫'; $('[data-eye=pp]').textContent = S.showPP ? '👁' : '🚫'; $('#layerPP').classList.toggle('hidden', !S.showPP);
  lyrSync();
}
document.querySelectorAll('.tool[data-tool]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.tool; if (t === S.tool && t in panelHidden) { panelHidden[t] ? showPanel() : hidePanel(t); return; } setTool(t); }));
document.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
document.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.eye; if (k === 'bg') S.showBg = !S.showBg; else if (k === 'vec') S.showVec = !S.showVec; else if (k === 'pp') S.showPP = !S.showPP; else if (k === 'col') { S.showCol = !S.showCol; } else S.showChar = !S.showChar; updateToggles(); requestRender();
}));
wireSizeOp($('#top')); document.querySelectorAll('#top .stpv').forEach(b => b.addEventListener('click', () => sizeOpPop(b)));
$('#pressBtn').addEventListener('click', () => { S.pressure = !S.pressure; updateToggles(); saveSettings(); });
$('#snapBtn').addEventListener('click', () => { S.snap = !S.snap; snapField = null; updateToggles(); saveSettings(); toast(S.snap ? `Hút nét: BẬT (bán kính ${S.snapR}px — chỉnh trong Menu)` : 'Hút nét: TẮT'); });
let onionLP = null, onionLPFired = false;
$('#onionBtn').addEventListener('pointerdown', () => { onionLPFired = false; clearTimeout(onionLP); onionLP = setTimeout(() => { onionLPFired = true; onionDialog(); }, 550); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(t => $('#onionBtn').addEventListener(t, () => clearTimeout(onionLP)));
$('#onionBtn').addEventListener('contextmenu', e => { e.preventDefault(); if (!onionLPFired) { onionLPFired = true; onionDialog(); } });
let onionHint = false;
$('#onionBtn').addEventListener('click', () => { if (onionLPFired) { onionLPFired = false; return; } S.onion = !S.onion; updateToggles(); saveSettings(); requestRender(); if (S.onion && !onionHint) { onionHint = true; toast('Giữ nút Onion để chọn số frame trước/sau', 2200); } });
$('#loopBtn').addEventListener('click', () => { S.loop = !S.loop; updateToggles(); saveSettings(); });
$('#fitBtn').addEventListener('click', () => fitView(true));
// − 100% + on the canvas: zoom the view about the middle of the stage (2 fingers still work)
function zoomStep(k) {
  const r = view.getBoundingClientRect(), mx = r.width / 2 * DPR, my = r.height / 2 * DPR, d = scrToDoc(mx, my);
  vs = clamp(vs * k, fitS * 0.25, fitS * ZOOM_MAX); setViewAnchor(d.x, d.y, mx, my); requestRender();
}
$('#zoomIn').addEventListener('click', () => zoomStep(1.25));
$('#zoomOut').addEventListener('click', () => zoomStep(0.8));
$('#zoomLbl').addEventListener('click', () => fitView(true));
// 🎥 Camera straight from the tool rail (it used to hide in Chữ & FX → Camera)
$('#camToolBtn').addEventListener('click', () => { setTool('fx'); openTab('fx', 'cam'); if (panelHidden.fx) showPanel(); fxSyncBar(); requestRender(); toast('Kéo khung camera để chọn chỗ quay, kéo chấm góc để phóng to/thu nhỏ, rồi chọn kiểu đổi cảnh', 3500); });
$('#rotBtn').addEventListener('click', rotateView90);
$('#undoBtn').addEventListener('click', undo);
$('#dropBtn').addEventListener('click', () => setTool(S.tool === 'pick' ? (pickBack && pickBack !== 'pick' ? pickBack : 'fill') : 'pick'));
$('#redoBtn').addEventListener('click', redo);
$('#playBtn').addEventListener('click', startPlay);
$('#addBtn').addEventListener('click', addFrame);
$('#dupBtn').addEventListener('click', dupFrame);
$('#loopRangeBtn').addEventListener('click', repeatRangeDialog);
$('#delBtn').addEventListener('click', delFrame);
$('#delAllBtn').addEventListener('click', deleteAllFrames);
$('#videoBtn').addEventListener('click', exportVideo);
$('#gifBtn').addEventListener('click', exportImagesDialog);
$('#fxExport').addEventListener('click', exportVideo);
$('#fxMini').addEventListener('click', () => { const b = $('#fxbar'); b.classList.toggle('mini'); $('#fxMini').textContent = b.classList.contains('mini') ? '▴ Mở rộng' : '▾ Thu gọn'; });
$('#fxQuickSub').addEventListener('click', quickSubtitles);
$('#fxAddTxt').addEventListener('click', fxAddText);
document.querySelectorAll('[data-fxs]').forEach(b => b.addEventListener('click', () => { const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel); if (t) fxEdit(() => { t.style = b.dataset.fxs; }); else { fxNewStyle = b.dataset.fxs; fxSyncBar(); } }));
$('#fxEditTxt').addEventListener('click', async () => { const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel); if (!t) return; const v = await fxAskText(t.str); if (v) fxEdit(() => { t.str = v; }); });
let fxSlBefore = null;
const fxSl = (id, fn) => { $(id).addEventListener('input', e => { const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel); if (!t) return; if (!fxSlBefore) fxSlBefore = fxState(f); fn(t, +e.target.value); requestRender(); }); $(id).addEventListener('change', () => { if (!fxSlBefore) return; const f = curFrame(); pushEntry({ t: targetOf(f), fxe: true, before: fxSlBefore, after: fxState(f), bytes: 400 }); fxSlBefore = null; f.ver++; scheduleSave(); }); };
fxSl('#fxSize', (t, v) => t.size = v); fxSl('#fxRot', (t, v) => t.rot = v);
$('#fxColorTxt').addEventListener('click', () => { const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel); if (t) fxEdit(() => { t.color = S.color; }); });
$('#fxDelTxt').addEventListener('click', () => fxEdit(f => { f.texts = (f.texts || []).filter(x => x.id !== fxSel); fxSel = null; }));
$('#fxKeep').addEventListener('click', () => { const f = curFrame(), t = (f.texts || []).find(x => x.id === fxSel); if (!t) return; const n = clamp(+$('#fxKeepN').value || 1, 1, 500); let c = 0; for (let i = S.cur + 1; i <= Math.min(S.frames.length - 1, S.cur + n); i++) { const g = S.frames[i]; g.texts = (g.texts || []).filter(x => x.id !== t.id); g.texts.push({ ...t }); g.ver++; c++; } scheduleSave(); toast(`Đã chép chữ sang ${c} frame sau`); });
$('#fxZoom').addEventListener('change', e => fxEdit(f => { const c0 = camEditBox(S.cur); camSetBox(f, { z: e.target.value / 100, x: c0.x, y: c0.y }); }));
$('#fxZoom').addEventListener('input', e => { $('#fxZoomVal').textContent = e.target.value + '%'; });
$('#fxPick').addEventListener('click', () => { fxCamPick = !fxCamPick; camPresetMode = null; fxSyncBar(); if (fxCamPick) toast('Chạm lên chỗ muốn camera nhìn vào (vd. mặt nhân vật)', 3000); });
$('#fxCamKey').addEventListener('click', () => fxEdit(f => { if (f.cam) f.cam = null; else camKeySet(f, camAt(S.cur)); }));
document.querySelectorAll('[data-camtr]').forEach(b => b.addEventListener('click', () => {
  S.camTr = b.dataset.camtr; saveSettings();
  const f = curFrame();
  if (f.cam) fxEdit(fr => { fr.cam = { ...fr.cam, tr: S.camTr }; if (S.camTr === 'smooth') fr.cam.d = fr.cam.d || S.camD; else { delete fr.cam.d; delete fr.cam.s; delete fr.cam.e; delete fr.cam.k; } });
  else fxSyncBar();
  toast(S.camTr === 'cut' ? '✂ Cắt cảnh: tới frame này hình đổi ngay sang khung camera mới' : `〰 Đẩy mượt: từ frame này camera từ từ tiến tới khung mới trong ${S.camD} giây`, 3500);
}));
$('#camD').addEventListener('input', e => { $('#camDVal').textContent = (+e.target.value).toFixed(1) + 's'; });
$('#camD').addEventListener('change', e => { S.camD = +e.target.value; saveSettings(); const f = curFrame(); if (f.cam && f.cam.tr === 'smooth') fxEdit(fr => { fr.cam = { ...fr.cam, d: S.camD }; }); else fxSyncBar(); });
$('#camWide').addEventListener('click', () => { fxEdit(f => camKeySet(f, { z: 1, x: W / 2, y: H / 2 }, 'cut')); toast('↩ Từ frame này về toàn cảnh (thấy hết khung)', 2500); });
// one-tap shots: pick the kind, then tap what to look at (the TV, a face…). Film zoom techniques, each one camera key on
// this frame (time-based, so it works inside one long frame too), one undo step (with its sound when 🔊 is on).
let camPresetMode = null;
const camNextKeyTime = i => { const T = frameStartTimes(), n = S.frames.length; let e = i + 1; while (e < n && !S.frames[e].cam) e++; return T[e] - T[i]; };
const CAM_FX = {
  cut: { label: '🔍 Cận cảnh', hint: 'cắt thẳng sang cận cảnh' },
  push: { label: '🎬 Đẩy vào từ từ', hint: 'camera từ từ đẩy vào' },
  pull: { label: '🔙 Kéo ra', tip: 'Pull-out / reveal: bắt đầu sát chỗ chạm rồi từ từ lùi ra cho thấy cả cảnh (bất ngờ, cô đơn, kết cảnh)', hint: 'bắt đầu sát chỗ đó rồi lùi ra' },
  crash: { label: '⚡ Zoom giật', tip: 'Crash zoom: lao vút vào chỗ chạm trong ¼ giây, vượt đà rồi khựng + rung (sốc, phát hiện, hài)', hint: 'lao vút vào', sfx: 'whoosh' },
  steps: { label: '🥁 Zoom 3 nhịp', tip: 'Dramatic zoom: giật vào 3 lần, mỗi lần gần hơn (kịch tính kiểu "tèn tèn TEN")', hint: 'giật vào 3 nhịp', sfx: 'drum' },
  kb: { label: '🖼 Lia + zoom chậm', tip: 'Ken Burns: vừa lia vừa zoom thật chậm và đều suốt đoạn, tới chỗ chạm (cảnh tĩnh, ảnh, kể chuyện)', hint: 'vừa lia vừa zoom chậm tới đó' },
  pan: { label: '↔ Lia máy', tip: 'Pan: giữ nguyên độ zoom, camera lia sang chỗ chạm (theo nhân vật, chuyển sự chú ý)', hint: 'lia sang đó' }
};
function camPreset(kind) { camPresetMode = camPresetMode === kind ? null : kind; fxCamPick = false; fxSyncBar(); if (camPresetMode) toast(`Chạm lên chỗ muốn người xem chú ý (vd. cái TV, mặt nhân vật): ${CAM_FX[kind].hint}`, 3500); }
function camShotKey(f, key, sfx) {   // f.cam = key, one undo step (+ its sound effect)
  const before = fxState(f); f.cam = key; const e = { t: targetOf(f), fxe: true, before, after: fxState(f), bytes: 400 };
  S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || [];
  if (sfx && SFX[sfx] && $('#camSnd').checked && !S.audio.sfx.some(x => x.frameId === f.id && x.kind === sfx)) {
    const add = [{ id: newId(), frameId: f.id, kind: sfx, vol: 0.9 }]; S.audio.sfx.push(...add); pushEntry({ multi: [e, { t: e.t, sfxadd: add, bytes: 200 }], t: e.t });
  } else pushEntry(e);
  f.ver++; queueThumbFor(f); scheduleSave(); fxSyncBar(); requestRender();
}
function camPresetApply(p) {
  const kind = camPresetMode, f = curFrame(); camPresetMode = null;
  // start from the shot coming in from earlier frames (not this frame's old key), so trying presets again doesn't stack
  const old = f.cam; f.cam = null; const prev = camAt(S.cur), c0 = prev; f.cam = old;
  const Z = z => clamp(z, 1, CAM_ZMAX), at = z => camClamp({ z: Z(z), x: p.x, y: p.y });
  const mirror = z => camClamp({ z: Z(z), x: W / 2 + (W / 2 - p.x) * 0.7, y: H / 2 + (H / 2 - p.y) * 0.5 });
  let key, msg;
  if (kind === 'cut' || kind === 'push') {
    key = { ...at(Math.max(2, c0.z * 1.5)), tr: kind === 'push' ? 'smooth' : 'cut' }; if (kind === 'push') { key.d = S.camD; key.k = 'push'; }
    msg = kind === 'push' ? `🎬 Từ frame này camera từ từ đẩy vào trong ${key.d} giây.` : '✂ Tới frame này cắt sang cận cảnh.';
  } else if (kind === 'pull') {
    const end = c0.z > 1.05 ? camClamp(c0) : { z: 1, x: W / 2, y: H / 2 };
    key = { ...end, tr: 'smooth', d: Math.max(2, S.camD), s: at(Math.max(2.5, end.z * 2)), k: 'pull' }; msg = `🔙 Bắt đầu sát chỗ chạm rồi lùi ra trong ${key.d} giây.`;
  } else if (kind === 'crash') {
    key = { ...at(Math.max(3, c0.z * 2)), tr: 'smooth', d: 0.25, e: 'crash', hit: 18, k: 'crash' }; msg = '⚡ Zoom giật: lao vào trong ¼ giây rồi rung.';
  } else if (kind === 'steps') {
    key = { ...at(Math.max(3, c0.z * 2.5)), tr: 'smooth', d: 0.9, e: 'steps', hit: 10, k: 'steps' }; if (prev.z <= 1.05) key.s = { z: 1, x: W / 2, y: H / 2 }; msg = '🥁 Zoom 3 nhịp: giật vào 3 lần, mỗi lần gần hơn.';
  } else if (kind === 'kb') {
    const z1 = Math.max(1.35, c0.z * 1.25), d = clamp(Math.round(camNextKeyTime(S.cur) * 10) / 10, 1.5, 12);
    key = { ...at(z1), tr: 'smooth', d, e: 'linear', s: mirror(Math.max(1.1, z1 * 0.8)), k: 'kb' }; msg = `🖼 Lia + zoom chậm đều trong ${d} giây.`;
  } else if (kind === 'pan') {
    const z = Math.max(1.6, c0.z);
    key = { ...at(z), tr: 'smooth', d: Math.max(1.2, S.camD), s: prev.z > 1.05 ? camClamp({ z, x: prev.x, y: prev.y }) : mirror(z), k: 'pan' }; msg = `↔ Lia sang chỗ chạm trong ${key.d} giây.`;
  } else return;
  camSide = 'end'; camShotKey(f, key, CAM_FX[kind].sfx);
  toast(msg + ' Kéo khung/góc khung để chỉnh, ▶ Xem thử để xem.', 4000);
}
// 🧍 shot sizes (film framing) around the character, or the drawing when there is no cut-out character
const CAM_SHOTS = {
  wide: { label: 'Toàn cảnh', tip: 'Thấy hết khung hình (wide shot)' },
  full: { label: 'Toàn thân', tip: 'Cả người từ đầu tới chân (full shot)', a: -0.06, b: 1.06 },
  med: { label: 'Trung cảnh', tip: 'Từ thắt lưng trở lên (medium shot)', a: -0.05, b: 0.55 },
  close: { label: 'Cận cảnh', tip: 'Đầu và vai (close-up)', a: -0.03, b: 0.3 },
  ecu: { label: 'Đặc tả', tip: 'Sát mặt / đôi mắt (extreme close-up)', a: 0.05, b: 0.2 }
};
async function camSubject(f) {   // {x0, y0, x1, y1, hx}: what is on the frame, hx = middle of its top part (the head)
  await ensureLoaded(f);
  const k = 0.25, w = Math.ceil(W * k), h = Math.ceil(H * k), cv = makeCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true }); x.scale(k, k);
  const hasPP = S.pp && S.pp.parts.length && S.showPP;
  if (hasPP) drawPuppet(x, f.pp, f.lip);
  else { if (f.col && S.showCol) x.drawImage(f.col, 0, 0); if (f.canvas) x.drawImage(f.canvas, 0, 0); if (f.vec && S.showVec) drawVec(x, f.vec); }
  const d = x.getImageData(0, 0, w, h).data; cv.width = 0; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 30) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < 0) return null;
  let sx = 0, sn = 0; const top = y0 + Math.max(1, (y1 - y0) * 0.18);
  for (let yy = y0; yy <= top; yy++) for (let xx = x0; xx <= x1; xx++) if (d[(yy * w + xx) * 4 + 3] > 30) { sx += xx; sn++; }
  return { x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k, hx: (sn ? sx / sn : (x0 + x1) / 2) / k };
}
async function camShotApply(kind) {
  const f = curFrame(), K = CAM_SHOTS[kind]; let c;
  if (kind === 'wide') c = { z: 1, x: W / 2, y: H / 2 };
  else {
    const b = await camSubject(f); if (!b) { toast('Frame này chưa có nhân vật hay hình nào để lấy khung'); return; }
    const bh = b.y1 - b.y0, ya = b.y0 + bh * K.a, yb = b.y0 + bh * K.b, hgt = yb - ya;
    if (kind === 'full') { const r = camFromRect(b.x0 - (b.x1 - b.x0) * 0.08, ya, b.x1 + (b.x1 - b.x0) * 0.08, yb); c = r; }
    else { const wd = hgt * W / H; c = camFromRect(b.hx - wd / 2, ya, b.hx + wd / 2, yb); }
  }
  fxEdit(fr => camSetBox(fr, c));
  toast(`🧍 ${K.label}${camSide === 'start' && camCanStart(f) ? ' (khung đầu)' : ''}. Kéo khung/góc khung để chỉnh thêm.`, 2500);
}
$('#camFxBtns').innerHTML = Object.entries(CAM_FX).filter(([k]) => k !== 'cut' && k !== 'push').map(([k, v]) => `<button class="chip small" data-camfx="${k}" title="${v.tip}">${v.label}</button>`).join('');
$('#camShotBtns').innerHTML = Object.entries(CAM_SHOTS).map(([k, v]) => `<button class="chip small" data-camshot="${k}" title="${v.tip}">${v.label}</button>`).join('');
$('#camEase').innerHTML = Object.entries(CAM_EASE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#camPushIn').addEventListener('click', () => camPreset('push'));
$('#camCutIn').addEventListener('click', () => camPreset('cut'));
document.querySelectorAll('[data-camfx]').forEach(b => b.addEventListener('click', () => camPreset(b.dataset.camfx)));
document.querySelectorAll('[data-camshot]').forEach(b => b.addEventListener('click', () => camShotApply(b.dataset.camshot)));
document.querySelectorAll('[data-camside]').forEach(b => b.addEventListener('click', () => { camSide = b.dataset.camside; fxSyncBar(); requestRender(); }));
$('#camSwap').addEventListener('click', () => { const f = curFrame(); if (!camCanStart(f)) return; const a = camAt(S.cur, 0), e = camPlain(f.cam); fxEdit(fr => { fr.cam = { ...fr.cam, ...camClamp(a), s: camClamp(e) }; }); toast('⇄ Đã đảo chiều: khung đầu ⇄ khung cuối', 2000); });
$('#camEase').addEventListener('change', e => { const f = curFrame(); if (!camCanStart(f)) return; fxEdit(fr => { fr.cam = { ...fr.cam, e: e.target.value }; if (e.target.value === 'inout') delete fr.cam.e; }); });
const camEnsureKey = fr => { if (!fr.cam) camKeySet(fr, camAt(S.cur)); };
$('#camHit').addEventListener('click', () => fxEdit(fr => { camEnsureKey(fr); fr.cam = { ...fr.cam }; if (fr.cam.hit) delete fr.cam.hit; else fr.cam.hit = 16; }));
$('#camHand').addEventListener('click', () => fxEdit(fr => {
  camEnsureKey(fr); fr.cam = { ...fr.cam };
  if (fr.cam.hh) delete fr.cam.hh; else { fr.cam.hh = 1; if (fr.cam.z < 1.08) Object.assign(fr.cam, camClamp({ z: 1.1, x: fr.cam.x, y: fr.cam.y })); toast('📷 Camera hơi lắc như quay cầm tay (zoom nhẹ 110% để không lộ mép)', 3000); }
}));
$('#camPrev').addEventListener('click', () => {
  if (playing) stopPlay(); const n = S.frames.length; let e = S.cur + 1; while (e < n && !S.frames[e].cam) e++;
  playRangeOnce = [S.cur, Math.min(n - 1, Math.max(S.cur + 1, e))]; startPlay();
});
$('#fxShake').addEventListener('change', e => fxEdit(f => { f.shake = +e.target.value; }));
$('#fxFlash').addEventListener('click', () => fxEdit(f => { f.flash = !f.flash; }));
$('#txIn').addEventListener('change', e => txSetAnim('an', e.target.value));
$('#txLp').addEventListener('change', e => txSetAnim('lp', e.target.value));
$('#txOut').addEventListener('change', e => txSetAnim('ao', e.target.value));
$('#txPrev').addEventListener('click', txPreview);
$('#beatSnap').addEventListener('click', beatSnap);
$('#beatFit').addEventListener('click', beatFitDialog);
const ghIdx = () => { const sel = msel && msel.size > 1 ? S.frames.map((g, i) => msel.has(g.id) ? i : -1).filter(i => i >= 0) : []; return sel.length ? sel : [S.cur]; };
// 🌈 Look tab wiring
$('#lkBgsD').innerHTML = Object.entries(BGS_DIRS).map(([k, d]) => `<button class="chip small" data-bgsd="${k}" title="Nền trôi ${d[3].toLowerCase()} (nhân vật như chạy ${k === 'l' ? 'sang phải' : k === 'r' ? 'sang trái' : k === 'u' ? 'xuống / rơi' : 'lên / bay lên'})">${d[2]} ${d[3]}</button>`).join('');
$('#lkBgsV').innerHTML = BGS_SPEEDS.map(([v, l]) => `<button class="chip small" data-bgsv="${v}">${l}</button>`).join('');
$('#lkSlK').innerHTML = Object.entries(SL_KINDS).map(([k, d]) => `<button class="chip small" data-slk="${k}" title="${d[2]}">${d[0]} ${d[1]}</button>`).join('');
$('#lkFlt').innerHTML = Object.entries(FLT_KINDS).map(([k, d]) => `<button class="chip small" data-flt="${k}" title="${d[2]}">${d[0]} ${d[1]}</button>`).join('');
$('#lkN').value = S.lookOpt.n; $('#rpN').value = S.lookOpt.rn;
$('#lkN').addEventListener('change', () => { S.lookOpt = { ...S.lookOpt, n: clamp(+$('#lkN').value || 1, 1, 300) }; saveSettings(); lookSync(); });
$('#rpN').addEventListener('change', () => { S.lookOpt = { ...S.lookOpt, rn: clamp(+$('#rpN').value || 8, 2, 120) }; saveSettings(); });
$('#fxbar').addEventListener('click', e => {
  const b = e.target.closest('[data-bgsd],[data-bgsv],[data-slk],[data-slc],[data-flt],[data-rps]'); if (!b) return;
  const f = curFrame(), d = b.dataset;
  if (d.bgsd !== undefined) lookSet('bgs', d.bgsd ? { d: d.bgsd, v: S.lookOpt.v } : null, '🏃 Nền chạy');
  else if (d.bgsv !== undefined) { S.lookOpt = { ...S.lookOpt, v: +d.bgsv }; saveSettings(); if (f.bgs) lookSet('bgs', { d: f.bgs.d, v: +d.bgsv }, '🏃 Nền chạy'); else lookSync(); }
  else if (d.slk !== undefined) lookSet('sl', d.slk ? { k: d.slk, c: d.slk === 'focus' && S.lookOpt.c === '#ffffff' && !f.sl ? '#111111' : S.lookOpt.c } : null, '💨 Đường tốc độ');
  else if (d.slc !== undefined) { S.lookOpt = { ...S.lookOpt, c: d.slc }; saveSettings(); if (f.sl) lookSet('sl', { k: f.sl.k, c: d.slc }, '💨 Đường tốc độ'); else lookSync(); }
  else if (d.flt !== undefined) lookSet('flt', d.flt ? { k: d.flt } : null, '🎨 Màu phim');
  else if (d.rps !== undefined) { S.lookOpt = { ...S.lookOpt, rs: +d.rps }; saveSettings(); lookSync(); }
});
$('#pzN').innerHTML = PZ_DENS.map(([v, l]) => `<button class="chip small" data-pzn="${v}" title="Khoảng ${v} lần chớp mỗi giây">${l}</button>`).join('');
$('#pzD').innerHTML = PZ_SECS.map(v => `<button class="chip small" data-pzd="${v}" title="Chớp trong ${v} giây từ frame này">${v} giây</button>`).join('');
$('#pzOn').addEventListener('click', () => pzSet(true));
$('#pzOff').addEventListener('click', () => pzSet(false));
$('#pzN').addEventListener('click', e => {
  const b = e.target.closest('[data-pzn]'); if (!b) return; const n = +b.dataset.pzn; S.lookOpt = { ...S.lookOpt, pn: n }; saveSettings();
  const f = curFrame(); if (f.pz) { let a = S.cur, z = S.cur; while (a > 0 && S.frames[a - 1].pz) a--; while (z + 1 < S.frames.length && S.frames[z + 1].pz) z++; for (let i = a; i <= z; i++) { const g = S.frames[i]; g.pz = { ...g.pz, n }; g.ver++; g.playKey = ''; } scheduleSave(); requestRender(); }
  lookSync();
});
$('#pzD').addEventListener('click', e => { const b = e.target.closest('[data-pzd]'); if (!b) return; S.lookOpt = { ...S.lookOpt, pd: +b.dataset.pzd }; saveSettings(); lookSync(); });
$('#pzG').addEventListener('change', e => { S.lookOpt = { ...S.lookOpt, pg: e.target.checked ? 1 : 0 }; saveSettings(); });
$('#pzS').addEventListener('change', e => { S.lookOpt = { ...S.lookOpt, ps: e.target.checked ? 1 : 0 }; saveSettings(); });
$('#rpGo').addEventListener('click', replayMake);
$('#lkPrev').addEventListener('click', () => { if (playing) stopPlay(); startPlay(); });
$('#ghBtn').addEventListener('click', () => { const on = !curFrame().ghost, idx = ghIdx(); ghostSet(on, idx); toast(on ? `👻 Bóng mờ lướt ở ${idx.length} frame — thấy rõ khi nhân vật di chuyển nhanh` : 'Đã tắt bóng mờ', 2200); });
$('#ghNext').addEventListener('click', () => { const n = clamp(+$('#ghNextN').value || 1, 1, 60), idx = []; for (let i = S.cur; i < Math.min(S.frames.length, S.cur + n); i++) idx.push(i); ghostSet(true, idx); toast(`👻 Bóng mờ lướt ở frame ${S.cur + 1}–${idx[idx.length - 1] + 1}`, 2000); });
document.querySelectorAll('[data-ghn]').forEach(b => b.addEventListener('click', () => { S.ghOpt = { ...S.ghOpt, n: +b.dataset.ghn }; saveSettings(); if (curFrame().ghost) ghostSet(true, ghIdx()); else ghostSync(); }));
document.querySelectorAll('[data-ght]').forEach(b => b.addEventListener('click', () => { S.ghOpt = { ...S.ghOpt, c: b.dataset.ght }; saveSettings(); if (curFrame().ghost) ghostSet(true, ghIdx()); else ghostSync(); }));
Object.entries(SFX).forEach(([k, v]) => { const b = document.createElement('button'); b.className = 'chip small'; b.textContent = '🔊 ' + v.label; b.addEventListener('click', () => { sfxPreview(k); S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || []; S.audio.sfx.push({ id: newId(), frameId: curFrame().id, kind: k, vol: 0.9 }); fxSyncBar(); scheduleSave(); toast(`Đã gắn "${v.label}" vào frame ${S.cur + 1}`); }); $('#fxSfx').append(b); });
/* 🎞 Chuyển cảnh tab */
// the transition the tab edits right now: on the current frame, before it (⏮) or after it (⏭)
const trKey = () => S.trOpt.at === 'in' ? 'tr' : 'tre';
function trDesc(f, key, i) {
  const x = f[key], K = x && TR_KINDS[x.k]; if (!K) return '';
  const last = i === S.frames.length - 1, where = key === 'tr' ? (i === 0 ? 'mở đầu phim' : `giữa frame ${i} và ${i + 1}`) : (last ? 'kết thúc phim' : `giữa frame ${i + 1} và ${i + 2}`);
  return `${K.ic} ${K.label} ${(+x.d || K.d).toFixed(1)}s, ${where}`;
}
function trSyncBar() {
  if (!$('#trKinds')) return; const f = curFrame(); if (!f) return; const key = trKey(), x = f[key];
  document.querySelectorAll('[data-trat]').forEach(b => b.classList.toggle('on', b.dataset.trat === S.trOpt.at));
  document.querySelectorAll('[data-trk]').forEach(b => b.classList.toggle('on', !!x && x.k === b.dataset.trk));
  const d = x ? +x.d || TR_KINDS[x.k].d : 0.8; $('#trD').value = d; $('#trDVal').textContent = x ? d.toFixed(1) + 's' : ''; $('#trD').disabled = !x;
  $('#trSnd').classList.toggle('on', x ? x.snd !== false : S.trOpt.snd !== false);
  $('#trDel').disabled = !x; $('#trPrev').disabled = !x;
  const parts = [trDesc(f, 'tr', S.cur), trDesc(f, 'tre', S.cur)].filter(Boolean);
  const n = S.frames.length, i = S.cur;
  $('#trStat').textContent = parts.length ? 'Đã có: ' + parts.join(' · ') : `Chưa có chuyển cảnh ở frame ${i + 1}. Chọn chỗ đặt (${S.trOpt.at === 'in' ? (i === 0 ? 'mở đầu phim' : `giữa frame ${i} và ${i + 1}`) : (i === n - 1 ? 'kết thúc phim' : `giữa frame ${i + 1} và ${i + 2}`)}) rồi chạm 1 kiểu.`;
}
// ◧ marks on the strip: left edge = transition into the frame, right edge = out of it
function trBadges() {
  S.frames.forEach(g => {
    if (!g.el) return; g.el.querySelectorAll('.trb').forEach(b => b.remove());
    [['tr', 'in'], ['tre', 'out']].forEach(([key, cls]) => { const x = g[key], K = x && TR_KINDS[x.k]; if (!K) return; const b = document.createElement('span'); b.className = 'trb ' + cls; b.textContent = K.ic; b.title = K.label; g.el.append(b); });
  });
}
function trSet(kind) {
  const f = curFrame(), key = trKey(), K = TR_KINDS[kind], i = S.cur, n = S.frames.length;
  if (K.side === 'out' && key === 'tr' && i === 0) { toast('Đầu phim chưa có gì để tắt — chọn "Sau frame này ⏭"', 3500); return; }
  if (K.side === 'in' && key === 'tre' && i === n - 1) { toast('Cuối phim không còn gì để bật lên — chọn "⏮ Đầu frame này"', 3500); return; }
  f[key] = { k: kind, d: K.d, snd: S.trOpt.snd !== false };   // each kind starts at its own natural length; the slider changes it after
  if (K.sfx && f[key].snd) sfxPreview(K.sfx);
  scheduleSave(); fxSyncBar(); requestRender();
  toast(`${K.ic} Đã thêm ${K.label} (${trDesc(f, key, i).split(', ').pop()}) — bấm ▶ Xem thử`, 3000);
}
function trInit() {
  const box = $('#trKinds'); if (!box) return;
  Object.entries(TR_KINDS).forEach(([k, K]) => { const b = document.createElement('button'); b.className = 'chip small'; b.dataset.trk = k; b.textContent = K.ic + ' ' + K.label; b.title = K.tip; b.addEventListener('click', () => trSet(k)); box.append(b); });
  document.querySelectorAll('[data-trat]').forEach(b => b.addEventListener('click', () => { S.trOpt.at = b.dataset.trat; saveSettings(); trSyncBar(); }));
  $('#trD').addEventListener('input', e => { $('#trDVal').textContent = (+e.target.value).toFixed(1) + 's'; });
  $('#trD').addEventListener('change', e => { const d = +e.target.value, f = curFrame(), key = trKey(); if (f[key]) { f[key] = { ...f[key], d }; scheduleSave(); } fxSyncBar(); });
  $('#trSnd').addEventListener('click', () => { const f = curFrame(), key = trKey(); if (f[key]) { f[key] = { ...f[key], snd: f[key].snd === false }; S.trOpt.snd = f[key].snd; scheduleSave(); } else S.trOpt.snd = S.trOpt.snd === false; saveSettings(); fxSyncBar(); });
  $('#trDel').addEventListener('click', () => { const f = curFrame(), key = trKey(); if (!f[key]) return; f[key] = undefined; delete f[key]; scheduleSave(); fxSyncBar(); requestRender(); toast('Đã bỏ chuyển cảnh — hoàn tác nếu bấm nhầm'); });
  $('#trPrev').addEventListener('click', trPreview);
}
// play from a little before the transition to a little after it
async function trPreview() {
  const f = curFrame(), x = trList().find(y => (trKey() === 'tr' ? y.c === S.cur : y.c === S.cur + 1) && y.k === (f[trKey()] || {}).k); if (!x) return;
  if (playing) stopPlay();
  const T = frameStartTimes(), t = Math.max(0, x.t0 - 0.4); let i = T.findIndex((v, k) => k < S.frames.length && t < T[k + 1]); if (i < 0) i = 0;
  const back = S.cur; await selectFrame(i); await startPlay();
  const end = x.t1 + 0.5 - T[i], my = ++trPrevTok;
  setTimeout(() => { if (playing && my === trPrevTok) { stopPlay(); selectFrame(back); } }, end * 1000 / playSpeed);
}
let trPrevTok = 0;
trInit();
const pickAudio = (input, key) => { input.addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; if (file.size > 40e6) { toast('File quá lớn (tối đa 40 MB)'); return; } const buf = await file.arrayBuffer(); try { const ac = new OfflineAudioContext(1, 44100, 44100); await ac.decodeAudioData(buf.slice(0)); } catch (err) { toast('Không đọc được file âm thanh này'); return; } S.audio = S.audio || {}; const clip = { name: file.name.slice(0, 60), buf, vol: key === 'music' ? 0.6 : 1, frameId: curFrame().id }; if (key === 'voice') voiceAdd(clip); else { clip.id = newId(); delete clip.frameId; if (!S.audio.music) S.audio.music = clip; else { clip.fa = curFrame().id; (S.audio.musics = S.audio.musics || []).push(clip); } } waveKey = ''; updateWaves(); fxSyncBar(); scheduleSave(); if (!atlOpen()) atlShow(true); toast(key === 'music' ? (musicClips().length > 1 ? `Đã thêm nhạc ${musicClips().length}, bắt đầu ở frame ${S.cur + 1}: phát cùng lúc với nhạc cũ` : 'Đã thêm nhạc nền — bấm Phát để nghe') : `Đã thêm giọng ${voiceClips().length} — bấm 🗣 Tự nhép miệng theo giọng`, 3500); }); };
pickAudio($('#musicFile'), 'music'); pickAudio($('#voiceFile'), 'voice');
$('#fxMusicPick').addEventListener('click', () => $('#musicFile').click());
$('#fxVoicePick').addEventListener('click', () => $('#voiceFile').click());
$('#fxMusicDel').addEventListener('click', () => { if (S.audio) { S.audio.music = null; S.audio.musics = []; atlSel = null; fxSyncBar(); scheduleSave(); } });
$('#fxMusicVol').addEventListener('change', e => { if (S.audio && S.audio.music) { S.audio.music.vol = e.target.value / 100; scheduleSave(); } });
$('#fxLip').addEventListener('click', fxLipSync);
$('#moveL').addEventListener('click', () => moveFrame(-1));
$('#moveR').addEventListener('click', () => moveFrame(1));
$('#newBgBtn').addEventListener('click', () => newBg(false));
$('#splitBgBtn').addEventListener('click', () => newBg(true));
$('#durIn').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) setDur(v * 1000); });
[0.08, 0.1, 0.2, 0.5, 1, 2, 3].forEach(s => {
  const b = document.createElement('button'); b.className = 'chip small'; b.dataset.s = s; b.textContent = s + 's';
  b.addEventListener('click', () => setDur(s * 1000)); $('#durChips').append(b);
});
$('#durAllBtn').addEventListener('click', () => { setDur(curFrame().dur, true); toast('Đã áp ' + fmtDur(curFrame().dur) + ' cho mọi frame'); });
// selection bar
$('#selScale').addEventListener('input', e => { if (!floating) return; floating.scale = e.target.value / 100; $('#selScaleVal').textContent = e.target.value + '%'; requestRender(); });
$('#selRot').addEventListener('input', e => { if (!floating) return; floating.rot = e.target.value * Math.PI / 180; $('#selRotVal').textContent = e.target.value + '°'; requestRender(); });
$('#selFlip').addEventListener('click', () => { if (floating) { floating.flip *= -1; requestRender(); } });
$('#selCover').addEventListener('click', floatCover);
$('#selStamp').addEventListener('click', stampFloating);
$('#selCopy').addEventListener('click', copyFloating);
$('#pasteBtn').addEventListener('click', pasteDialog);
$('#selVec').addEventListener('click', () => convertPixelsToVector(true));
$('#selDelete').addEventListener('click', () => { if (floating) { floating.c = null; floating.cc = null; floating.bc = null; commitFloating(); toast('Đã xoá vùng chọn'); } });
$('#selCancel').addEventListener('click', () => { cancelFloating(); updUndoBtns(); });
$('#selDone').addEventListener('click', commitFloating);
$('#lassobar').addEventListener('click', e => {
  const m = e.target.closest('[data-selm]'); if (m) { setSelMode(m.dataset.selm); return; }
  const ws = e.target.closest('[data-wsoft]'); if (ws) { S.warpSoft = +ws.dataset.wsoft; saveSettings(); if (warpSel) warpSel = warpBuild(warpSel.poly, warpSel.f); syncLassoBar(); requestRender(); toast('Viền giãn: ' + WARP_SOFT_N[S.warpSoft]); return; }
  const l = e.target.closest('[data-sell]'); if (l) { setLayer(l.dataset.sell); if (S.tool !== 'lasso') setTool('lasso'); syncLassoBar(); }
});
$('#selPlace').addEventListener('click', e => { const b = e.target.closest('[data-fpl]'); if (b) setFloatPlace(b.dataset.fpl); });
$('#selPart').addEventListener('click', () => floatToPart());
$('#selTw').addEventListener('click', twStart);
$('#twCancel').addEventListener('click', twStop);
$('#twGo').addEventListener('click', twMake);
$('#twN').addEventListener('input', requestRender); $('#twN').addEventListener('keydown', e => e.stopPropagation());
document.querySelectorAll('[data-twp]').forEach(b => b.addEventListener('click', () => { TW.path = b.dataset.twp; twSync(); requestRender(); }));
document.querySelectorAll('[data-twe]').forEach(b => b.addEventListener('click', () => { TW.ease = b.dataset.twe; twSync(); requestRender(); }));
// keyboard (for desktop testing / keyboard covers)
document.addEventListener('keydown', e => {
  if (typingIn(e)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey) return;
  const map = { b: 'brush', e: 'eraser', g: 'fill', l: 'lasso', i: 'pick', v: 'vedit', p: 'puppet', t: 'fx' };
  if ((k === 'delete' || k === 'backspace') && vsel.size) { vecDelete(); return; }
  if (map[k]) setTool(map[k]);
  else if (k === 'arrowleft') selectFrame(S.cur - 1);
  else if (k === 'arrowright') selectFrame(S.cur + 1);
  else if (k === ' ') { e.preventDefault(); startPlay(); }
  else if (k === 'enter' && floating) commitFloating();
  else if (k === 'escape' && rig) rigClose();
  else if (k === 'escape' && motion) motionClose();
  else if (k === 'escape' && floating) cancelFloating();
  else if (k === 'o') $('#onionBtn').click();
  else if (k === 'z') cycleSafe();
  else if (k === 'f') setFocus(!S.focus);
  else if (k === 'r') rotateView90();
});

