/* ========= Pose library ========= */
const BUILTIN_POSES = {
  stand: { name: 'Đứng tự nhiên', abs: { armL: 100, foreL: 95, armR: 80, foreR: 85, legL: 92, shinL: 90, legR: 88, shinR: 90 }, reset: ['head', 'torso'] },
  cheer: { name: 'Giơ 2 tay ăn mừng', abs: { armL: 235, foreL: 248, armR: -55, foreR: -68 } },
  spread: { name: 'Dang 2 tay', abs: { armL: 180, foreL: 180, armR: 0, foreR: 0 } },
  point: { name: 'Chỉ tay sang phải', abs: { armR: -8, foreR: -12, armL: 100, foreL: 95 } },
  hips: { name: 'Chống nạnh', abs: { armL: 128, foreL: 38, armR: 52, foreR: 142 } },
  shrug: { name: 'Nhún vai bó tay', abs: { armL: 150, foreL: 215, armR: 30, foreR: -35 } },
  stepF: { name: 'Bước chân', abs: { legL: 108, shinL: 96, legR: 74, shinR: 84 } },
  wide: { name: 'Đứng dạng chân', abs: { legL: 112, shinL: 100, legR: 68, shinR: 80 } }
};
function ppCharOf(p) { let g = p, n = 0; while (g && g.parent && n++ < 30) g = ppPart(g.parent); return g ? g.id : null; }
function ppSelChar() { const s = ppPart(ppSel); if (s) return ppCharOf(s); const r = S.pp && S.pp.parts.find(p => !p.parent); return r ? r.id : null; }
function ppApplyAbs(f, abs, charId, reset) {
  const parts = S.pp.parts.filter(p => ppCharOf(p) === charId);
  const byRole = r => parts.find(p => p.role === r);
  (reset || []).forEach(r => { const p = byRole(r); if (p && f.pp && f.pp[p.id]) { f.pp[p.id].r = 0; } });
  // parents first so children use updated parent angles
  for (const role of ['armL', 'armR', 'legL', 'legR', 'foreL', 'foreR', 'shinL', 'shinR']) {
    if (abs[role] == null) continue; const p = byRole(role); if (!p) continue;
    const M = ppMats(ppPoseFor(f)), P0 = mApply(M[p.id], p.px, p.py), tip = ppTipOf(p), H0 = mApply(M[p.id], tip.x, tip.y);
    const cur = Math.atan2(H0.y - P0.y, H0.x - P0.x), dd = wrapRad(abs[role] * DEG - cur);
    const q = ppQ(f, p.id); q.r = (q.r || 0) + dd / DEG;
  }
}
function ppPoseList() { return [...Object.entries(BUILTIN_POSES).map(([k, v]) => ({ id: 'b:' + k, name: '⭐ ' + v.name })), ...(S.poses || []).map(p => ({ id: 'u:' + p.id, name: p.name }))]; }
function ppApplyPose(id) {
  if (!S.pp) return; const f = curFrame(), charId = ppSelChar(); if (!charId) return;
  ppKeyEdit(fr => {
    fr.ppKey = true;
    if (id.startsWith('b:')) { const b = BUILTIN_POSES[id.slice(2)]; ppApplyAbs(fr, b.abs, charId, b.reset); }
    else {
      const u = (S.poses || []).find(p => 'u:' + p.id === id); if (!u) return;
      const ids = new Set(S.pp.parts.filter(p => ppCharOf(p) === charId).map(p => p.id));
      for (const pid of ids) delete fr.pp[pid];
      for (const [pid, q] of Object.entries(u.pp)) { const tgt = u.map && u.map[pid] ? u.map[pid] : pid; const role = (S.pp.parts.find(p => p.id === pid) || {}).role; const dest = S.pp.parts.find(p => ppCharOf(p) === charId && (p.id === tgt || (role && p.role === role))); if (dest) fr.pp[dest.id] = { ...q }; }
    }
  });
  toast('Đã áp tư thế (frame này thành keyframe)');
}
async function ppSavePose() {
  if (!S.pp) return; const f = curFrame(), charId = ppSelChar(); let name = null;
  await modal({ title: 'Lưu tư thế', html: '<input id="poseNameIn" placeholder="vd. Chống nạnh cười" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">', buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { name = document.getElementById('poseNameIn').value.trim(); } }] });
  if (!name) return;
  const pp = {}; S.pp.parts.filter(p => ppCharOf(p) === charId).forEach(p => { if (f.pp && f.pp[p.id]) pp[p.id] = { ...f.pp[p.id] }; });
  S.poses = S.poses || []; S.poses.push({ id: newId(), name: name.slice(0, 40), pp }); ppSyncBar(); scheduleSave(); toast('Đã lưu tư thế');
}
function ppFlipChar() {
  if (!S.pp) return; const charId = ppSelChar(); if (!charId) return;
  ppKeyEdit(f => { f.ppKey = true; const q = ppQ(f, charId); q.fl = !q.fl; });
}

