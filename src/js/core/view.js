/* ========= View ========= */
const stage = $('#stage'), view = $('#view'), vctx = view.getContext('2d');
let vs = 1, vtx = 0, vty = 0, fitS = 1, rq = false;
const ZOOM_MAX = 48;   // max zoom = 4800% of the fitted view (was 1600%), for fine detail
function resizeView() {
  const r = stage.getBoundingClientRect();
  // the user zoomed/panned: keep that zoom and the point at the centre (the top bar or a panel changing height must not reset it)
  const keep = lastFit && !viewIsFitted() ? scrToDoc(view.width / 2, view.height / 2) : null;
  view.width = Math.max(1, Math.round(r.width * DPR)); view.height = Math.max(1, Math.round(r.height * DPR));
  view.style.width = r.width + 'px'; view.style.height = r.height + 'px';
  if (keep) { setViewAnchor(keep.x, keep.y, view.width / 2, view.height / 2); requestRender(); } else fitView();
}
let vr = 0;   // view rotation (radians)
const viewMat = () => { const c = Math.cos(vr) * vs, s2 = Math.sin(vr) * vs; return [c, s2, -s2, c, vtx, vty]; };
function scrToDocWith(px, py, s0, r0, tx, ty) { const dx = px - tx, dy = py - ty, c = Math.cos(r0), s2 = Math.sin(r0); return { x: (c * dx + s2 * dy) / s0, y: (-s2 * dx + c * dy) / s0 }; }
const scrToDoc = (px, py) => scrToDocWith(px, py, vs, vr, vtx, vty);
function setViewAnchor(dx, dy, px, py) { const c = Math.cos(vr) * vs, s2 = Math.sin(vr) * vs; vtx = px - (c * dx - s2 * dy); vty = py - (s2 * dx + c * dy); }
function fitView(resetRot) {
  if (resetRot) vr = 0;
  const m = 18 * DPR, ac = Math.abs(Math.cos(vr)), as = Math.abs(Math.sin(vr)), bw = ac * W + as * H, bh = as * W + ac * H, band = freeBand();
  fitS = Math.min((band.w - 2 * m) / bw, (band.h - 2 * m) / bh);
  if (!(fitS > 0)) fitS = 0.1;
  vs = fitS; setViewAnchor(W / 2, H / 2, band.x + band.w / 2, band.y + band.h / 2);
  lastFit = [vs, vtx, vty, vr];
  requestRender();
}
// Floating panels (Ghép, Chữ & FX, xương, chuyển động) sit over the bottom of the stage and the vector bar over the top.
// "Vừa khung" fits the frame into the part they leave free, and while the view is still the fitted one it refits by itself
// whenever a panel opens, closes, folds or changes height, so the character's legs are never hidden behind a panel.
// On a wide landscape screen the Ghép panel docks on the right (like the Properties panel of Animate) and the 🗂 Layer
// panel on the left (body.dock): then the frame is fitted into the column between them.
const FIT_BOTTOM = ['#ppbar', '#fxbar', '#rigbar', '#motionbar', '#flipNav'], FIT_TOP = ['#vecbar'], FIT_SIDE = ['#ppbar', '#lyrPanel'];
let lastFit = null, refitT = null;
function freeBand() {
  const sr = stage.getBoundingClientRect(); let top = 0, bot = 0, lft = 0, rgt = 0;
  const vis = sel => { const el = document.querySelector(sel); if (!el || el.hidden || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 ? r : null; };
  const side = r => r.width < sr.width * 0.36 && (r.height > sr.height * 0.5 || document.body.classList.contains('dock'));
  for (const sel of FIT_SIDE) {
    const r = vis(sel); if (!r || !side(r)) continue;
    if (r.left > sr.left + sr.width * 0.5) rgt = Math.max(rgt, sr.right - r.left + 4); else if (r.right < sr.left + sr.width * 0.5) lft = Math.max(lft, r.right - sr.left + 4);
  }
  if (sr.width - lft - rgt < sr.width * 0.35) lft = rgt = 0;
  for (const sel of FIT_BOTTOM) { const r = vis(sel); if (r && !side(r) && r.top > sr.top + sr.height * 0.25) bot = Math.max(bot, sr.bottom - r.top + 4); }
  for (const sel of FIT_TOP) { const r = vis(sel); if (r && r.bottom < sr.top + sr.height * 0.5) top = Math.max(top, r.bottom - sr.top + 4); }
  const minH = sr.height * 0.42;   // never shrink the drawing below this; past it the panel may overlap a little
  if (sr.height - top - bot < minH) { const k = Math.max(0, sr.height - minH) / Math.max(1, top + bot); top *= k; bot *= k; }
  return { x: lft * DPR, w: Math.max(1, (sr.width - lft - rgt) * DPR), y: top * DPR, h: Math.max(1, (sr.height - top - bot) * DPR) };
}
const viewIsFitted = () => lastFit && Math.abs(lastFit[0] - vs) < 1e-6 && Math.abs(lastFit[1] - vtx) < 0.5 && Math.abs(lastFit[2] - vty) < 0.5 && lastFit[3] === vr;
function refitSoon() { clearTimeout(refitT); refitT = setTimeout(() => { if (viewIsFitted() && !playing) fitView(); }, 60); }
{
  const ro = new ResizeObserver(refitSoon), mo = new MutationObserver(refitSoon);
  for (const sel of [...new Set([...FIT_BOTTOM, ...FIT_TOP, ...FIT_SIDE])]) { const el = document.querySelector(sel); if (el) { ro.observe(el); mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] }); } }
}
function rotateView90() { vr = (Math.round(vr / (Math.PI / 2)) + 1) % 4 * (Math.PI / 2); fitView(); toast('Xoay khung ' + Math.round(vr / DEG) + '° — bấm Vừa khung để thẳng lại', 1800); }
function requestRender() { if (!rq) { rq = true; requestAnimationFrame(render); } }

