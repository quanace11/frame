/* ========= Brush size circle ========= */
// A round ring that shows how thick the line (or the eraser) really is, at the current zoom:
// - pen hover / mouse move over the canvas with Bút or Tẩy: the ring follows the tip (pen hover works on Apple Pencil, S Pen);
// - while erasing: the ring follows the tip, so you see what will be erased;
// - while changing the size (− +, slider, quick sizes): a filled preview dot in the middle of the canvas + the number.
// Pure DOM (#brushCur, pointer-events: none), never drawn into the picture or the export.
let bcHoverOn = false, bcPrevT = 0;
function bcTool() { return S.tool === 'brush' || S.tool === 'eraser' || (S.tool === 'puppet' && (ppPaint === 'brush' || ppPaint === 'erase')); }
// diameter of the real line in screen CSS px (at full pressure)
function bcDia() {
  const vecL = S.layer === 'vec' && S.tool !== 'puppet';
  let d = bsz();
  if (vecL && S.tool === 'eraser') d = Math.max(d, 12 * DPR / vs);
  else if (!vecL) d *= brushOf(isErasing() ? 'eraser' : 'brush').sizeK || 1;
  return d * vs / DPR;
}
function bcEl() {
  let el = document.getElementById('brushCur');
  if (!el) { el = document.createElement('div'); el.id = 'brushCur'; el.hidden = true; el.innerHTML = '<b></b>'; document.body.append(el); }
  return el;
}
function bcPlace(el, x, y) {
  const d = Math.max(3, bcDia());
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = el.style.height = d + 'px';
  el.classList.toggle('er', isErasing()); el.hidden = false;
}
function bcHide() { const el = document.getElementById('brushCur'); if (el && !el.classList.contains('prev')) el.hidden = true; bcHoverOn = false; }
function bcAt(e) {
  if (!bcTool() || floating) { bcHide(); return; }
  const el = bcEl(); if (el.classList.contains('prev')) { el.classList.remove('prev'); el.style.background = ''; }
  bcPlace(el, e.clientX, e.clientY); bcHoverOn = true;
}
// big preview in the middle of the canvas while the size is being changed
function bcPreview() {
  if (!bcTool()) return;
  const el = bcEl(), r = view.getBoundingClientRect(), b = freeBand();
  el.classList.add('prev');
  el.style.background = isErasing() ? '' : hexA(S.color, Math.max(0.35, curOp()));
  el.querySelector('b').textContent = (isErasing() ? 'Cỡ tẩy ' : 'Cỡ bút ') + curSize();
  bcPlace(el, r.left + (b.x + b.w / 2) / DPR, r.top + (b.y + b.h / 2) / DPR);
  const t = bcPrevT = performance.now();
  setTimeout(() => { if (bcPrevT !== t) return; el.classList.remove('prev'); el.style.background = ''; el.hidden = true; }, 1100);
}
view.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  if (e.buttons) { if (isErasing() && action) bcAt(e); else bcHide(); return; }   // drawing: the line shows its width, the eraser does not
  bcAt(e);
});
view.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !(S.fingerDraw && isErasing())) return; if (isErasing()) bcAt(e); else bcHide(); });
view.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && S.fingerDraw && isErasing() && action && action.id === e.pointerId) bcAt(e); });
['pointerleave', 'pointerup', 'pointercancel'].forEach(n => view.addEventListener(n, e => { if (n !== 'pointerup' || e.pointerType === 'touch') bcHide(); }));
view.addEventListener('wheel', () => { if (bcHoverOn) bcHide(); }, { passive: true });
