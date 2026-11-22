/* ========= Keyframes for the puppet ========= */
const EASE = {
  linear: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inout: t => t * t * (3 - 2 * t),
  back: t => { const c1 = 1.70158, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; },
  bounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; },
  hold: t => 0
};
const EASE_LABEL = { inout: 'Mượt (chậm–nhanh–chậm)', linear: 'Đều', out: 'Chậm dần', in: 'Nhanh dần', back: 'Vượt đà rồi về', bounce: 'Nảy', hold: 'Giữ nguyên rồi nhảy' };
const ppIsKey = f => f.ppKey !== false;
const ppState = f => ({ pp: ppClone(f.pp), k: ppIsKey(f), e: f.ppEase || 'inout' });
function ppSetState(f, st) { if (!st) return; if (st.pp !== undefined && 'k' in st) { f.pp = ppClone(st.pp); f.ppKey = st.k; f.ppEase = st.e; } else f.pp = ppClone(st); }
function ppRetween() {
  if (!S.pp) return;
  const keys = []; S.frames.forEach((f, i) => { if (ppIsKey(f)) keys.push(i); });
  if (!keys.length) return;
  const changed = [];
  const setPP = (f, pp) => { if (JSON.stringify(pp) !== JSON.stringify(f.pp || {})) { f.pp = pp; f.ver++; changed.push(f); } };
  for (let i = 0; i < keys[0]; i++) setPP(S.frames[i], ppClone(S.frames[keys[0]].pp));
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k], b = keys[k + 1], A = S.frames[a], B = S.frames[b], ez = EASE[A.ppEase || 'inout'] || EASE.inout;
    for (let i = a + 1; i < b; i++) setPP(S.frames[i], ppLerpPose(A.pp, B.pp, ez((i - a) / (b - a))));
  }
  for (let i = keys[keys.length - 1] + 1; i < S.frames.length; i++) setPP(S.frames[i], ppClone(S.frames[keys[keys.length - 1]].pp));
  changed.forEach(f => queueThumbFor(f)); if (changed.length) { scheduleSave(); requestRender(); }
}
function ppKeyEdit(fn) { const f = curFrame(), before = ppState(f); fn(f); pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); }

