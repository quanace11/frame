/* ===== on-canvas frame flipper: ◀ n/N ▶ ＋ near the drawing; hold an arrow to peek at the neighbour frame like flipping paper ===== */
var flipPeek = null;
function flipHold(btn, onTap, onHold, onRelease) {
  let t = null, held = false;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); if (btn.disabled) return; held = false; try { btn.setPointerCapture(e.pointerId); } catch (_) {} clearTimeout(t); t = setTimeout(() => { held = true; onHold(); }, 320); });
  const up = () => { clearTimeout(t); if (held) { held = false; onRelease && onRelease(); } else if (t) onTap(); t = null; };
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', () => { clearTimeout(t); t = null; if (held) { held = false; onRelease && onRelease(); } });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
async function flipPeekStart(d) {
  const j = S.cur + d; if (j < 0 || j >= S.frames.length || playing) return;
  flipPeek = { back: S.cur }; $('#flipNav').classList.add('peek'); $('#fnLbl').textContent = `👁 ${j + 1}`;
  await selectFrame(j);
}
async function flipPeekEnd() {
  const p = flipPeek; if (!p) return; flipPeek = null; $('#flipNav').classList.remove('peek');
  await selectFrame(p.back); updateFrameUI();
}
async function flipNewFrame() {
  await addFrame();
  if (!S.onion) { S.onion = true; updateToggles(); saveSettings(); requestRender(); toast('Đã bật Onion: thấy mờ frame trước để vẽ theo', 2500); }
}
flipHold($('#fnPrev'), () => { if (playing) stopPlay(); selectFrame(S.cur - 1); }, () => flipPeekStart(-1), flipPeekEnd);
flipHold($('#fnNext'), () => { if (playing) stopPlay(); selectFrame(S.cur + 1); }, () => flipPeekStart(1), flipPeekEnd);
{ const b = $('#fnAdd'); let t = null, long = false;
  b.addEventListener('pointerdown', e => { e.preventDefault(); long = false; clearTimeout(t); t = setTimeout(() => { long = true; dupFrame(); toast('Đã nhân bản frame này — sửa tiếp chỗ cần cử động', 2500); }, 550); });
  b.addEventListener('pointerup', () => { clearTimeout(t); if (!long) flipNewFrame(); });
  b.addEventListener('pointercancel', () => clearTimeout(t)); b.addEventListener('contextmenu', e => e.preventDefault()); }
