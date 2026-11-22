/* ===== 👻 afterimage (残影, bóng mờ lướt): f.ghost = {n, c} → faded copies of the character from the n frames before,
   drawn under this frame's character (lines layer, puppet, vector lines), optionally tinted. Stops at a scene start. ===== */
let ghC = null;
function ghostList(f) {
  const g = f.ghost; if (!g || !g.n) return []; const i = S.frames.indexOf(f), out = [];
  for (let k = 1; k <= g.n && i - k >= 0; k++) { if (S.frames[i - k + 1].scene && i - k + 1 > 0) break; out.push([k, S.frames[i - k]]); }
  return out;
}
const ghostKey = i => { const f = S.frames[i]; return f.ghost ? 'g' + f.ghost.n + (f.ghost.c || '') + ghostList(f).map(([, p]) => p.ver).join('.') + ':' : ''; };
async function ghostLoad(f) { for (const [, p] of ghostList(f)) await ensureLoaded(p); }
function drawGhosts(ctx, f, w, h) {
  const L = ghostList(f); if (!L.length) return;
  if (!ghC || ghC.width !== W || ghC.height !== H) ghC = makeCanvas();
  const x = ghC.getContext('2d'), n = f.ghost.n;
  for (const [k, p] of [...L].reverse()) {
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
    if (S.showChar && p.canvas) x.drawImage(p.canvas, 0, 0); else if (!p.canvas) ensureLoaded(p).then(requestRender);
    if (S.pp && S.showPP) drawPuppet(x, p.pp, p.lip);
    if (S.showVec && p.vec && p.vec.length) drawVec(x, p.vec);
    if (f.ghost.c) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.65; x.fillStyle = f.ghost.c; x.fillRect(0, 0, W, H); }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha = 0.55 * (n - k + 1) / n; if (w) ctx.drawImage(ghC, 0, 0, w, h); else ctx.drawImage(ghC, 0, 0); ctx.restore();
  }
}
SETTINGS_KEYS.push('ghOpt'); S.ghOpt = { n: 3, c: '' };
// turn the afterimage on/off for frame i0 and the next cnt-1 frames (or the multi-selected frames); undo = automatic snapshot
function ghostSet(on, idx) {
  for (const i of idx) { const f = S.frames[i]; if (!f) continue; if (on) f.ghost = { n: S.ghOpt.n, c: S.ghOpt.c || undefined }; else delete f.ghost; f.ver++; f.playKey = ''; queueThumbFor(f); }
  scheduleSave(); fxSyncBar(); requestRender();
}
function ghostSync() {
  const f = curFrame(); if (!f || !$('#ghBtn')) return;
  $('#ghBtn').classList.toggle('on', !!f.ghost); $('#ghBtn').textContent = f.ghost ? '👻 Tắt ở frame này' : '👻 Bật ở frame này';
  const n = f.ghost ? f.ghost.n : S.ghOpt.n, c = f.ghost ? f.ghost.c || '' : S.ghOpt.c || '';
  document.querySelectorAll('[data-ghn]').forEach(b => b.classList.toggle('on', +b.dataset.ghn === n));
  document.querySelectorAll('[data-ght]').forEach(b => b.classList.toggle('on', b.dataset.ght === c));
}
