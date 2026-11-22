/* ===== Multi-select frames on the timeline: delete / duplicate / reverse / timing in one go ===== */
var msel = new Set(), mselOn = false, mselLast = -1; // var: buildStrip may run before this section during start-up
function mselSync() {
  msel.forEach(id => { if (!S.frames.some(f => f.id === id)) msel.delete(id); });
  S.frames.forEach(f => f.el && f.el.classList.toggle('msel', msel.has(f.id)));
  $('#mselBar').hidden = !mselOn; $('#tl').classList.toggle('mselmode', mselOn);
  $('#mselBtn').classList.toggle('on', mselOn);
  const n = msel.size, ms = S.frames.filter(f => msel.has(f.id)).reduce((a, f) => a + f.dur, 0);
  $('#mselInfo').textContent = n ? `Đã chọn ${n} frame · ${(ms / 1000).toFixed(1)}s` : 'Chưa chọn frame nào';
  document.querySelectorAll('#mselBar [data-ms=dup],#mselBar [data-ms=del],#mselBar [data-ms=rev],#mselBar [data-ms=play],#mselDur .chip').forEach(b => b.disabled = !n || ((b.dataset.ms === 'rev' || b.dataset.ms === 'play') && n < 2));
}
function mselStart() { if (playing) stopPlay(); commitFloating(); mselOn = true; mselSync(); }
function mselEnd() { mselOn = false; msel.clear(); mselLast = -1; mselSync(); }
function mselTap(i, range) {
  if (!mselOn) { mselStart(); if (!range) msel.add(S.frames[S.cur].id); }
  if (range && mselLast >= 0) { const [a, b] = mselLast < i ? [mselLast, i] : [i, mselLast]; for (let k = a; k <= b; k++) msel.add(S.frames[k].id); }
  else { const id = S.frames[i].id; msel.has(id) ? msel.delete(id) : msel.add(id); }
  mselLast = i; mselSync();
}
function mselLong(i) {
  if (!mselOn) { mselStart(); msel.add(S.frames[i].id); mselLast = i; mselSync(); toast('Đang chọn nhiều frame: chạm để chọn thêm, giữ ngón tay lên frame khác để chọn cả dải', 3500); return; }
  mselTap(i, mselLast >= 0);
}
const mselIdx = () => S.frames.map((f, i) => msel.has(f.id) ? i : -1).filter(i => i >= 0);
async function mselDelete() {
  const idx = mselIdx(); if (!idx.length) return;
  if (idx.length >= S.frames.length) { toast('Phải giữ lại ít nhất 1 frame — bỏ chọn bớt'); return; }
  const pm = idx.length > 8 ? progress('Đang xoá frame…') : null;
  try {
    const list = idx.map(i => ({ f: S.frames[i], i }));
    for (const { f } of list) if (f.canvas) await ensurePng(f);
    const keep = new Set(S.frames.filter(f => !msel.has(f.id)).map(f => f.bgId));
    const bgs = S.bgs.filter(b => !keep.has(b.id)); for (const b of bgs) if (b.canvas) await ensurePng(b);
    const D = { list, bgs, cur0: S.cur };
    mselApplyDel(D, true); pushEntry({ fdel: D, bytes: 0 });
    toast(`Đã xoá ${list.length} frame — bấm Hoàn tác (hoặc chạm 2 ngón) để lấy lại`, 3500);
  } finally { if (pm) pm.close(); }
  msel.clear(); mselSync(); updUndoBtns();
}
// remove (redo) or put back (undo) frames deleted together; frames keep their PNG so they reload lazily
function mselApplyDel(D, remove) {
  if (remove) {
    const ids = new Set(D.list.map(x => x.f.id));
    S.frames = S.frames.filter(f => !ids.has(f.id));
    for (const { f } of D.list) { const li = loaded.indexOf(f); if (li >= 0) loaded.splice(li, 1); if (f.canvas) { f.canvas.width = 0; f.canvas = null; } if (f.col) { f.col.width = 0; f.col = null; } f.thumb = null; }
    const bids = new Set(D.bgs.map(b => b.id)); S.bgs = S.bgs.filter(b => !bids.has(b.id));
    for (const b of D.bgs) if (b.canvas) { b.canvas.width = 0; b.canvas = null; }
    S.cur = clamp(D.list[0].i, 0, S.frames.length - 1);
  } else {
    for (const b of D.bgs) if (!S.bgs.includes(b)) S.bgs.push(b);
    for (const { f, i } of [...D.list].sort((a, b) => a.i - b.i)) S.frames.splice(Math.min(i, S.frames.length), 0, f);
    S.cur = clamp(D.cur0, 0, S.frames.length - 1);
  }
  tintCache.clear(); ppRetween(); buildStrip(); selectFrame(S.cur); scheduleSave(); evictSoon();
}
async function mselDuplicate() {
  const idx = mselIdx(); if (!idx.length) return;
  const at = idx[idx.length - 1] + 1, added = [];
  const pm = idx.length > 8 ? progress('Đang nhân bản…') : null;
  try {
    for (const i of idx) {
      const s0 = S.frames[i]; await ensureLoaded(s0);
      const f = frameCopyOf(s0, true);
      added.push(f); loaded.push(f); await evictSoon();
    }
    await insertFrames(at, added);
  } finally { if (pm) pm.close(); }
  msel.clear(); added.forEach(f => msel.add(f.id));
  tintCache.clear(); ppRetween(); buildStrip(); await selectFrame(at); scheduleSave(); evictSoon(); updUndoBtns(); mselSync();
  toast(`Đã nhân bản ${added.length} frame (đang chọn bản mới — dời, đảo ngược hoặc đổi thời lượng tiếp được)`, 3500);
}
function mselReverse() {
  const idx = mselIdx(); if (idx.length < 2) return;
  const before = S.frames.map(f => f.id), sel = idx.map(i => S.frames[i]).reverse();
  idx.forEach((i, k) => { S.frames[i] = sel[k]; });
  pushEntry({ ford: { before, after: S.frames.map(f => f.id) }, bytes: 0 });
  tintCache.clear(); ppRetween(); buildStrip(); selectFrame(S.cur); scheduleSave(); updUndoBtns(); mselSync();
  toast(`Đã đảo ngược ${idx.length} frame — bấm Phát để xem chạy ngược`);
}
function mselSetDur(sec) {
  const fs = S.frames.filter(f => msel.has(f.id)); if (!fs.length) return;
  fs.forEach(f => f.dur = clamp(Math.round(sec * 1000), 20, 30000)); updateFrameUI(); scheduleSave(); mselSync();
  toast(`${fs.length} frame giờ dài ${sec}s mỗi frame`);
}
$('#mselDur').innerHTML = [0.05, 0.08, 0.1, 0.2, 0.5, 1].map(v => `<button class="chip small" data-msd="${v}">${v}s</button>`).join('');
$('#mselBtn').addEventListener('click', () => mselOn ? mselEnd() : (mselStart(), msel.add(curFrame().id), mselLast = S.cur, mselSync()));
$('#mselBar').addEventListener('click', e => {
  const d = e.target.closest('[data-msd]'); if (d) { mselSetDur(+d.dataset.msd); return; }
  const b = e.target.closest('[data-ms]'); if (!b) return;
  const k = b.dataset.ms;
  if (k === 'all') { S.frames.forEach(f => msel.add(f.id)); mselSync(); }
  else if (k === 'none') { msel.clear(); mselSync(); }
  else if (k === 'dup') mselDuplicate();
  else if (k === 'rev') mselReverse();
  else if (k === 'del') mselDelete();
  else if (k === 'play') { if (playing) stopPlay(); startPlay(); }
  else if (k === 'done') mselEnd();
});

