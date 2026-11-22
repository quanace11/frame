/* ========= Delete all frames ========= */
// Everything "Xoá hết" removes, so one undo brings it all back.
async function wipeSnap() {
  for (const o of [...S.frames, ...S.bgs]) { if (o.canvas || o.loading) await ensureLoaded(o); await parkObj(o); }
  return { frames: S.frames, bgs: S.bgs, cur: S.cur, pp: S.pp, rig: S.rig, ref: { ...REF }, bgVideo: S.bgVideo };
}
// Store the current state into `into` (parked) and bring back `from`.
async function wipeSwap(from, into) {
  if (playing) stopPlay(); commitFloating(); motionClose(); rigClose();
  Object.assign(into, await wipeSnap());
  ppSetup = null; ppSel = null; ppCutMode = false; ppPatchMode = false; vsel.clear();
  if (S.tool === 'puppet' || S.tool === 'vedit') setTool('brush');
  S.frames = from.frames; S.bgs = from.bgs; S.pp = from.pp; S.rig = from.rig; S.bgVideo = from.bgVideo; bgVideoSetup();
  Object.assign(REF, from.ref); refEdit = false; updateRefUI();
  loaded.length = 0; loadedBg.length = 0; tintCache.clear();
  if (S.bgs.length <= MAX_BG) for (const b of S.bgs) await ensureLoaded(b);
  S.cur = clamp(from.cur, 0, S.frames.length - 1);
  for (const f of S.frames) if (!f.thumb) await drawThumb(f);
  buildStrip(); await selectFrame(S.cur); ppSyncBar(); updUndoBtns(); requestRender(); scheduleSave();
}
async function deleteAllFrames() {
  if (playing) stopPlay();
  const ok = await modal({ title: `Xoá hết ${S.frames.length} frame?`, html: '<p>Xoá sạch: toàn bộ frame (nét, màu, nền), <b>ảnh mờ</b>, <b>các mảnh nhân vật ghép</b> và bộ xương. Chỉ còn 1 frame trống.</p><p>Lỡ tay thì bấm <b>↶ Hoàn tác</b> ngay sau đó để lấy lại tất cả.</p>',
    buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá hết', value: true, cls: 'danger' }] });
  if (!ok) return;
  if (stroke) strokeEnd(); commitFloating(); motionClose(); rigClose();
  const old = await wipeSnap();
  clearRef(true); updateRefUI();
  S.pp = null; ppSetup = null; ppSel = null; ppCutMode = false; ppPatchMode = false; S.rig = null; S.bgVideo = null; bgVideoSetup();
  if (S.tool === 'puppet' || S.tool === 'vedit') setTool('brush');
  // older history points at the removed frames: drop it (only "Xoá hết" itself can be undone)
  undoStack.length = 0; redoStack.length = 0; undoBytes = 0; tintCache.clear();
  const b = newBgObj(); S.bgs = [b];
  const f = newFrameObj(b.id); S.frames = [f]; loaded.length = 0; loaded.push(f); S.cur = 0; vsel.clear();
  pushEntry({ wipe: { old, neu: {} }, t: targetOf(f), bytes: old.frames.reduce((a, g) => a + (g.png ? g.png.byteLength : 0) + (g.colPng ? g.colPng.byteLength : 0), 0) });
  await drawThumb(f); buildStrip(); await selectFrame(0); updUndoBtns(); requestRender(); scheduleSave();
  ppSyncBar(); toast('Đã xoá sạch — lỡ tay thì bấm ↶ Hoàn tác để lấy lại', 3500);
}

