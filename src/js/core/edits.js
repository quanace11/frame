/* ========= Edits, thumbnails, save scheduling ========= */
function markEdited(o) { o.ver++; queueThumbFor(o); scheduleSave(); updUndoBtns(); }
const thumbQ = new Set(); let thumbT = null;
function queueThumbFor(o) {
  if (o.kind === 'char') thumbQ.add(o); else S.frames.forEach(f => { if (f.bgId === o.id) thumbQ.add(f); });
  clearTimeout(thumbT); thumbT = setTimeout(flushThumbs, 250);
}
async function flushThumbs() { const list = [...thumbQ]; thumbQ.clear(); for (const f of list) await drawThumb(f); }
function thumbSize() { const th = 96; return [Math.round(th * W / H), th]; }
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

