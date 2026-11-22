/* ========= Keyframes for the puppet ========= */
const EASE = {
  linear: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inout: t => t * t * (3 - 2 * t),
  back: t => { const c1 = 1.70158, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; },
  bounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; },
  hold: t => 0
};
const EASE_LABEL = { inout: 'Mượt (chậm–nhanh–chậm)', linear: 'Đều', out: 'Chậm dần', in: 'Nhanh dần', back: 'Vượt đà rồi về', bounce: 'Nảy', hold: 'Giữ nguyên rồi nhảy' };
const ppIsKey = f => f.ppKey !== false;
const ppState = f => ({ pp: ppClone(f.pp), k: ppIsKey(f), e: f.ppEase || 'inout', K: f.ppK ? { ...f.ppK } : null, E: f.ppE ? { ...f.ppE } : null });
function ppSetState(f, st) { if (!st) return; if (st.pp !== undefined && 'k' in st) { f.pp = ppClone(st.pp); f.ppKey = st.k; f.ppEase = st.e; if ('K' in st) { if (st.K) f.ppK = { ...st.K }; else delete f.ppK; } if ('E' in st) { if (st.E) f.ppE = { ...st.E }; else delete f.ppE; } } else f.pp = ppClone(st); }
/* --- keyframes per layer (like each layer's own keyframes in Animate): f.ppK = { rootId: true | false } overrides the
   frame's own 🔑 (f.ppKey) for one character / picture layer. Missing = follow the frame, so old projects behave as before. --- */
const ppLayerKey = (f, rid) => f.ppK && rid in f.ppK ? !!f.ppK[rid] : ppIsKey(f);
function ppLayerSetKey(f, rid, on) {
  const k = { ...(f.ppK || {}) }; if (on === ppIsKey(f)) delete k[rid]; else k[rid] = !!on;
  if (Object.keys(k).length) f.ppK = k; else delete f.ppK;
}
// a pose was edited on frame f: that piece's layer becomes a keyframe here (other layers keep tweening through this frame)
function ppMarkKey(f, pid) {
  const p = pid && ppPart(pid), rid = p ? (ppCharOf(p) || p.id) : null;
  if (!rid || ppIsKey(f)) { f.ppKey = true; if (rid && f.ppK && f.ppK[rid] === false) ppLayerSetKey(f, rid, true); return; }
  if (lyrRoots().length < 2) { f.ppKey = true; delete f.ppK; return; }
  ppLayerSetKey(f, rid, true);
}
/* ease per layer: f.ppE = { rootId: easeName } on a layer's keyframe sets how that layer moves to its next keyframe
   (Animate: each tween span has its own easing); missing = the frame's own f.ppEase */
const ppLayerEase = (f, rid) => (f.ppE && f.ppE[rid]) || f.ppEase || 'inout';
function ppLayerSetEase(f, rid, e) { const o = { ...(f.ppE || {}) }; if (e === (f.ppEase || 'inout')) delete o[rid]; else o[rid] = e; if (Object.keys(o).length) f.ppE = o; else delete f.ppE; }
function ppRetween() {
  if (!S.pp) return;
  const groups = new Map();
  for (const p of S.pp.parts) { const r = ppCharOf(p) || p.id; if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p.id); }
  const out = S.frames.map(f => ({ ...(f.pp || {}) }));
  for (const [rid, ids] of groups) {
    const keys = []; S.frames.forEach((f, i) => { if (ppLayerKey(f, rid)) keys.push(i); });
    if (!keys.length) continue;
    const sub = pp => { const o = {}; if (pp) for (const id of ids) if (pp[id]) o[id] = pp[id]; return o; };
    const put = (i, pp) => { for (const id of ids) { if (pp[id]) out[i][id] = pp[id]; else delete out[i][id]; } };
    for (let i = 0; i < keys[0]; i++) put(i, ppClone(sub(S.frames[keys[0]].pp)));
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k], b = keys[k + 1], A = S.frames[a], B = S.frames[b], ez = EASE[ppLayerEase(A, rid)] || EASE.inout;
      for (let i = a + 1; i < b; i++) put(i, ppLerpPose(sub(A.pp), sub(B.pp), ez((i - a) / (b - a))));
    }
    for (let i = keys[keys.length - 1] + 1; i < S.frames.length; i++) put(i, ppClone(sub(S.frames[keys[keys.length - 1]].pp)));
  }
  const changed = [];
  S.frames.forEach((f, i) => { if (JSON.stringify(out[i]) !== JSON.stringify(f.pp || {})) { f.pp = out[i]; f.ver++; changed.push(f); } });
  changed.forEach(f => queueThumbFor(f)); if (changed.length) { scheduleSave(); requestRender(); }
}
function ppKeyEdit(fn) { const f = curFrame(), before = ppState(f); fn(f); pushEntry(ppEntry(f, before, ppState(f))); markEdited(f); ppRetween(); ppSyncBar(); updateFrameUI(); requestRender(); }

