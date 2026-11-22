/* ========= Reference (tracing) image ========= */
const REF = { c: null, png: null, cx: 0, cy: 0, scale: 1, rot: 0, opacity: 0.35, show: true };
let refEdit = false;
function clearRef(silent) { REF.c = null; REF.png = null; refEdit = false; $('#refbar').hidden = true; if (!silent) { updateRefUI(); requestRender(); scheduleSave(); } }
function updateRefUI() {
  $('#refGrp').hidden = !REF.c;
  $('#layerRef').classList.toggle('on', refEdit);
  $('#layerRef').classList.toggle('hidden', !REF.show);
  $('#refEye').textContent = REF.show ? '👁' : '🚫';
}
function refFit() { if (!REF.c) return; REF.scale = Math.min(W / REF.c.width, H / REF.c.height); REF.cx = W / 2; REF.cy = H / 2; REF.rot = 0; syncRefBar(); requestRender(); }
function syncRefBar() {
  $('#refScale').value = Math.round(REF.scale * 100); $('#refScaleVal').textContent = Math.round(REF.scale * 100) + '%';
  $('#refRot').value = Math.round(REF.rot * 180 / Math.PI); $('#refOp').value = Math.round(REF.opacity * 100);
}
function setRefEdit(on) {
  if (on && !REF.c) return;
  if (on) { commitFloating(); if (stroke) strokeEnd(); }
  refEdit = on; $('#refbar').hidden = !on; if (on) syncRefBar();
  updateRefUI(); requestRender(); if (!on) scheduleSave();
}
async function setRef(canvas) {
  const k = Math.min(1, 2400 / Math.max(canvas.width, canvas.height));
  const c = makeCanvas(Math.round(canvas.width * k), Math.round(canvas.height * k));
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  REF.c = c; REF.show = true; REF.opacity = 0.35;
  REF.png = await (await toBlob(c)).arrayBuffer();
  refFit(); setRefEdit(true); scheduleSave();
  toast('Ảnh mờ đã đặt — kéo/chỉnh rồi bấm Xong, sau đó vẽ đè lên', 3000);
}
$('#refEditBtn').addEventListener('click', () => setRefEdit(!refEdit));
$('#refEye').addEventListener('click', () => { REF.show = !REF.show; updateRefUI(); requestRender(); scheduleSave(); });
$('#refScale').addEventListener('input', e => { REF.scale = e.target.value / 100; $('#refScaleVal').textContent = e.target.value + '%'; requestRender(); });
$('#refRot').addEventListener('input', e => { REF.rot = e.target.value * Math.PI / 180; requestRender(); });
$('#refOp').addEventListener('input', e => { REF.opacity = e.target.value / 100; requestRender(); });
$('#refFit').addEventListener('click', refFit);
$('#refDone').addEventListener('click', () => setRefEdit(false));
$('#refRemove').addEventListener('click', () => clearRef(false));

