/* ========= Edits, thumbnails, save scheduling ========= */
function markEdited(o) { o.ver++; queueThumbFor(o); scheduleSave(); updUndoBtns(); }
const thumbQ = new Set(); let thumbT = null;
function queueThumbFor(o) {
  if (o.kind === 'char') thumbQ.add(o); else S.frames.forEach(f => { if (f.bgId === o.id) thumbQ.add(f); });
  clearTimeout(thumbT); thumbT = setTimeout(flushThumbs, 250);
}
// a frame queued here may have left the film meanwhile (deleted, or another project opened: its canvas is freed)
async function flushThumbs() { const list = [...thumbQ]; thumbQ.clear(); for (const f of list) if (S.frames.includes(f)) await drawThumb(f); }
// thumbnails are drawn at a higher resolution when the frame bar is made bigger (steps of 0.5 so dragging does not redraw every frame)
function thumbSize() { const th = Math.round(96 * Math.min(2.5, Math.max(1, Math.ceil((S.tlScale || 1) * 2 - 1e-6) / 2))); return [Math.round(th * W / H), th]; }
async function drawThumb(f) {
  if (!f.thumb) { const [tw, th] = thumbSize(); f.thumb = makeCanvas(tw, th); }
  const t = f.thumb, x = t.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height);
  const bg = bgOf(f);
  if (bg && bg.canvas) x.drawImage(bg.canvas, 0, 0, t.width, t.height);
  else if (bg && bg.png) { try { const b = await decodePng(bg.png); x.drawImage(b, 0, 0, t.width, t.height); b.close && b.close(); } catch (e) {} }
  if (f.canvas) { drawCol(x, f, t.width, t.height); x.drawImage(f.canvas, 0, 0, t.width, t.height); }
  else for (const buf of [S.showCol && f.colPng, f.png]) if (buf) { try { const b = await decodePng(buf); x.drawImage(b, 0, 0, t.width, t.height); b.close && b.close(); } catch (e) {} }
  if (S.pp && S.showPP) { x.save(); x.scale(t.width / W, t.height / H); drawPuppet(x, f.pp, f.lip); x.restore(); }
  if (f.vec && f.vec.length) { x.save(); x.scale(t.width / W, t.height / H); drawVec(x, f.vec); x.restore(); }
}

