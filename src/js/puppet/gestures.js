/* ===== body gestures: keyframed, by role & absolute limb angle → works on any cut-out character ===== */
const GESTURES = {
  hello: ['👋 Vẫy chào', [{ a: { armR: -50, foreR: -95 }, n: 3 }, { a: { foreR: -60 }, n: 2 }, { a: { foreR: -110 }, n: 2 }, { a: { foreR: -60 }, n: 2 }, { a: { foreR: -110 }, n: 2 }, { n: 3, back: 1 }]],
  point: ['👉 Chỉ tay', [{ a: { armR: -10, foreR: -12 }, head: 6, n: 3, hold: 5 }, { n: 3, back: 1 }]],
  cheer: ['🙌 Ăn mừng', [{ a: { armL: 235, foreL: 248, armR: -55, foreR: -68 }, dy: -0.06, n: 3 }, { a: { armL: 215, foreL: 230, armR: -35, foreR: -50 }, dy: 0, n: 2 }, { a: { armL: 235, foreL: 248, armR: -55, foreR: -68 }, dy: -0.06, n: 2 }, { dy: 0, n: 2, hold: 2 }, { n: 3, back: 1 }]],
  clap: ['👏 Vỗ tay', [{ a: { armL: 120, foreL: 60, armR: 60, foreR: 120 }, n: 3 }, { a: { foreL: 25, foreR: 155 }, n: 1 }, { a: { foreL: 60, foreR: 120 }, n: 1 }, { a: { foreL: 25, foreR: 155 }, n: 1 }, { a: { foreL: 60, foreR: 120 }, n: 1 }, { a: { foreL: 25, foreR: 155 }, n: 1 }, { n: 3, back: 1 }]],
  shrug: ['🤷 Nhún vai', [{ a: { armL: 150, foreL: 215, armR: 30, foreR: -35 }, head: -8, dy: -0.015, n: 3, hold: 4 }, { n: 3, back: 1 }]],
  scratch: ['😅 Gãi đầu', [{ a: { armR: -75, foreR: -150 }, head: -6, n: 3 }, { a: { foreR: -165 }, n: 1 }, { a: { foreR: -145 }, n: 1 }, { a: { foreR: -165 }, n: 1 }, { a: { foreR: -145 }, n: 1 }, { n: 3, back: 1 }]],
  facepalm: ['🤦 Ôm mặt', [{ a: { armR: 55, foreR: -125 }, head: 14, n: 3, hold: 6 }, { n: 3, back: 1 }]],
  think: ['🤔 Suy nghĩ', [{ a: { armR: 70, foreR: -110, armL: 110, foreL: 15 }, head: 8, n: 4, hold: 6 }, { n: 3, back: 1 }]],
  cross: ['🙅 Khoanh tay', [{ a: { armL: 110, foreL: 8, armR: 70, foreR: 172 }, head: -4, n: 3, hold: 6 }, { n: 3, back: 1 }]],
  hips: ['😤 Chống nạnh', [{ a: { armL: 128, foreL: 38, armR: 52, foreR: 142 }, n: 3 }, { head: 8, n: 2 }, { head: -8, n: 2 }, { head: 0, n: 2, hold: 2 }, { n: 3, back: 1 }]],
  punch: ['👊 Đấm', [{ a: { armR: 80, foreR: -80, armL: 100, foreL: -100 }, n: 3 }, { a: { armR: -2, foreR: -2 }, torso: -6, n: 1, hold: 1 }, { a: { armR: 80, foreR: -80 }, torso: 0, n: 2 }, { a: { armR: -2, foreR: -2 }, torso: -6, n: 1, hold: 1 }, { a: { armR: 80, foreR: -80 }, torso: 0, n: 2 }, { n: 3, back: 1 }]],
  thumbs: ['👍 Like', [{ a: { armR: 25, foreR: -45 }, head: 5, n: 3, hold: 5 }, { n: 3, back: 1 }]],
  bow: ['🙇 Cúi chào', [{ torso: 22, head: 10, a: { armL: 95, foreL: 90, armR: 85, foreR: 90 }, n: 4, hold: 3 }, { n: 4, back: 1 }]],
  startle: ['😱 Giật mình', [{ a: { armL: 200, foreL: 230, armR: -20, foreR: -50 }, dy: -0.05, n: 1, hold: 1 }, { dy: 0, n: 2, hold: 4 }, { n: 4, back: 1 }]],
  cry: ['😭 Lau nước mắt', [{ a: { armL: 120, foreL: -55, armR: 60, foreR: -125 }, head: 6, n: 3 }, { head: 2, n: 2 }, { head: 6, n: 2 }, { head: 2, n: 2 }, { n: 3, back: 1 }]],
  nodyes: ['🙆 Gật đồng ý', [{ head: 10, n: 2 }, { head: -2, n: 2 }, { head: 10, n: 2 }, { head: 0, n: 2, back: 1 }]],
  nope: ['🙅 Lắc không', [{ head: -10, n: 2 }, { head: 10, n: 2 }, { head: -10, n: 2 }, { head: 10, n: 2 }, { n: 2, back: 1 }]],
  // kneeling from a standing (front view) character: thighs straight down, shins squashed (they point away from the camera), body drops
  beg: ['🙏 Quỳ gối xin tha', [{ a: { legL: 94, shinL: 92, legR: 86, shinR: 88 }, sy: { shinL: 0.18, shinR: 0.18 }, n: 4 },
    { a: { armL: 115, foreL: -28, armR: 65, foreR: 208 }, head: -6, n: 3 },
    { a: { foreL: -18, foreR: 198 }, head: -2, torso: 3, n: 2 }, { a: { foreL: -40, foreR: 220 }, head: -9, torso: 0, n: 2 },
    { a: { foreL: -18, foreR: 198 }, head: -2, torso: 3, n: 2 }, { a: { foreL: -40, foreR: 220 }, head: -9, torso: 0, n: 2 },
    { a: { foreL: -18, foreR: 198 }, head: -2, torso: 3, n: 2 }, { a: { foreL: -30, foreR: 210 }, head: -6, torso: 0, n: 2, hold: 4 }]],
  kowtow: ['🙇 Quỳ gối vái lạy', [{ a: { legL: 94, shinL: 92, legR: 86, shinR: 88 }, sy: { shinL: 0.18, shinR: 0.18 }, n: 4 },
    { a: { armL: 112, foreL: -66, armR: 68, foreR: 246 }, head: -4, n: 3, hold: 1 },
    { a: { armL: 98, foreL: 70, armR: 82, foreR: 110 }, sy: { legL: 0.6, legR: 0.6 }, torso: 10, head: 18, dy: 0.03, n: 3, hold: 2 }, { a: { armL: 112, foreL: -66, armR: 68, foreR: 246 }, sy: { legL: 1, legR: 1 }, torso: 0, head: -4, dy: 0, n: 3 },
    { a: { armL: 98, foreL: 70, armR: 82, foreR: 110 }, sy: { legL: 0.6, legR: 0.6 }, torso: 10, head: 18, dy: 0.03, n: 3, hold: 2 }, { a: { armL: 112, foreL: -66, armR: 68, foreR: 246 }, sy: { legL: 1, legR: 1 }, torso: 0, head: -4, dy: 0, n: 3 },
    { a: { armL: 98, foreL: 70, armR: 82, foreR: 110 }, sy: { legL: 0.6, legR: 0.6 }, torso: 10, head: 18, dy: 0.03, n: 3, hold: 2 }, { a: { armL: 112, foreL: -66, armR: 68, foreR: 246 }, sy: { legL: 1, legR: 1 }, torso: 0, head: -4, dy: 0, n: 3, hold: 3 }]],
  // head thrown back (works from the back too: the head is squashed toward the neck, as if its top tips away), shoulders up,
  // stiff arms, the whole body trembling; sh = shoulder raise, shiv = tremble (deg), mouth = open the Mouth part, shake/sfx = camera + sound
  shout: ['😡 Ngửa mặt hét giận', [{ a: { armL: 100, foreL: 96, armR: 80, foreR: 84 }, head: 5, dy: 0.012, n: 3 },
    { a: { armL: 120, foreL: 110, armR: 60, foreR: 70 }, sy: { head: 0.82 }, head: 0, dy: -0.012, sh: 0.01, mouth: 1, n: 2, shake: 16, sfx: 'roar' },
    { shiv: 2.5, hold: 10, shake: 9 }, { shiv: 1.5, hold: 3, shake: 4 }, { n: 4, back: 1 }]],
  // knocked out: arms fly up, the whole body tips over backwards around the hips (fall = 0…1 → 0…88°) and drops so it lies on
  // the ground where the feet were, small bounce, then lies still (no 'back': the following frames keep lying there)
  faint: ['😵 Ngã ngất', [{ a: { armL: 215, foreL: 240, armR: -35, foreR: -60 }, head: -12, dy: -0.03, n: 2 },
    { a: { armL: 150, foreL: 170, armR: 30, foreR: 10 }, head: 10, dy: 0, fall: 1, n: 3, shake: 14, sfx: 'bonk' },
    { fall: 0.9, n: 1 }, { fall: 1, n: 1, hold: 12 }]],
  rage: ['🤬 Giơ nắm đấm gào', [{ a: { armL: 105, foreL: 80, armR: 75, foreR: 100 }, head: 5, dy: 0.012, n: 3 },
    { a: { armL: 140, foreL: 255, armR: 40, foreR: -75 }, sy: { head: 0.82 }, head: 0, dy: -0.015, sh: 0.01, mouth: 1, n: 2, shake: 16, sfx: 'roar' },
    { a: { foreL: 240, foreR: -60 }, shiv: 2.5, n: 1, shake: 10 }, { a: { foreL: 258, foreR: -78 }, shiv: 2.5, n: 1, shake: 10 },
    { a: { foreL: 240, foreR: -60 }, shiv: 2.5, n: 1, shake: 9 }, { a: { foreL: 258, foreR: -78 }, shiv: 2.5, n: 1, shake: 9 },
    { a: { foreL: 240, foreR: -60 }, shiv: 2, n: 1, shake: 7 }, { a: { foreL: 258, foreR: -78 }, shiv: 2, n: 1, shake: 6, hold: 3 }, { n: 4, back: 1 }]]
};
let gestFx = true;
let gestMirror = false;
function ppCurAbs(f, charId) {
  const out = {}; const parts = S.pp.parts.filter(p => ppCharOf(p) === charId), M = ppMats(ppPoseFor(f));
  for (const role of ['armL', 'armR', 'legL', 'legR', 'foreL', 'foreR', 'shinL', 'shinR']) { const p = parts.find(q => q.role === role); if (!p) continue; const P0 = mApply(M[p.id], p.px, p.py), tip = ppTipOf(p), H0 = mApply(M[p.id], tip.x, tip.y); out[role] = Math.atan2(H0.y - P0.y, H0.x - P0.x) / DEG; }
  return out;
}
const angLerp = (a, b, t) => a + wrapRad((b - a) * DEG) / DEG * t;
async function ppGesture(id) {
  if (!S.pp || !S.pp.parts.length) { toast('Cần nhân vật ghép trước — Nhập ảnh → Tách thành nhân vật ghép'); return; }
  const G = GESTURES[id], f0 = curFrame(), ch = ppSelChar(), parts = S.pp.parts.filter(p => ppCharOf(p) === ch), byRole = r => parts.find(p => p.role === r);
  if (!byRole('armR') && !byRole('armL') && !byRole('head')) { toast('Nhân vật chưa có vai trò tay/đầu — dùng ✂ Tự cắt hoặc đặt Vai trò cho mảnh', 4000); return; }
  const mir = gestMirror, mapRole = r => mir ? r.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R') : r, mapAng = a => mir ? 180 - a : a, sg = mir ? -1 : 1;
  const start = ppCurAbs(f0, ch), tor = byRole('torso'), hgt = tor ? Math.max(200, tor.c.height * 2.2) : H * 0.6, dur = Math.round((+$('#ppPDur').value || 0.08) * 1000);
  const base = ppClone(f0.pp || {}), poses = [], isKey = [];
  const z0 = { head: 0, torso: 0, dy: 0, sh: 0, mouth: 0, fall: 0, sy: {} };
  let prev = { a: { ...start }, ...z0 };
  const startLegs = {}; for (const r of ['legL', 'legR', 'shinL', 'shinR']) if (start[r] != null) startLegs[r] = start[r];
  const mouth = byRole('mouth');
  const mk = (st, shiv = 0) => {
    const tf = { pp: ppClone(base) }; ppApplyAbs(tf, st.a, ch);
    const add = (role, prop, v) => { const p = byRole(role); if (!p || !v) return; const q = ppQ(tf, p.id); q[prop] = (q[prop] || 0) + v; };
    add('head', 'r', st.head * sg - shiv * 0.6); add('torso', 'r', st.torso * sg * (ppDir || 1) + shiv); add('torso', 'dy', st.dy * hgt); add('torso', 'dx', shiv * hgt * 0.002);
    if (st.sh) for (const r of ['armL', 'armR']) add(r, 'dy', -st.sh * hgt);   // shoulders up (arms hang from the torso, so lift their joints)
    if (mouth && st.mouth > 0.01) { const q = ppQ(tf, mouth.id); if (mouth.alts && mouth.alts.length) { if (st.mouth > 0.5) q.v = mouth.alts.length; } else q.sy = (q.sy == null ? 1 : q.sy) * (1 + 0.8 * st.mouth); }
    for (const [role, v] of Object.entries(st.sy || {})) { const p = byRole(role); if (p && v !== 1) { const q = ppQ(tf, p.id); q.sy = (q.sy == null ? 1 : q.sy) * v; } }   // squash (a shin pointing away from the camera)
    // squashed legs are shorter: the body drops by as much, so the knees land where the feet were
    let drop = 0; const len = p => { const t = ppTipOf(p); return Math.hypot(t.x - p.px, t.y - p.py); };
    for (const sd of ['L', 'R']) { let d = 0; for (const r of ['leg' + sd, 'shin' + sd]) { const p = byRole(r), v = st.sy && st.sy[r]; if (p && v != null) d += len(p) * (1 - v); } drop = Math.max(drop, d); }
    if (drop) add('torso', 'dy', drop);
    if (st.fall) {   // tipping over: the torso turns around its pivot (the hips) and drops by the leg length, so the body lies on the floor
      let leg = 0; for (const sd of ['L', 'R']) { let d = 0; for (const r of ['leg' + sd, 'shin' + sd]) { const p = byRole(r); if (p) d += len(p); } leg = Math.max(leg, d); }
      add('torso', 'r', st.fall * 88 * sg); add('torso', 'dy', st.fall * (leg || hgt * 0.45) * 0.85);
    }
    // legs given in the keyframe stay at their screen angle when the body leans (kneeling knees stay on the ground)
    const legs = shiv ? { ...startLegs } : {}; for (const r of ['legL', 'legR', 'shinL', 'shinR']) if (st.a[r] != null) legs[r] = st.a[r];   // trembling: feet stay put
    if ((st.torso || shiv) && Object.keys(legs).length) ppApplyAbs(tf, legs, ch);
    return tf.pp;
  };
  const shakes = [], sfxAt = []; let tick = 0;
  for (const k of G[1]) {
    const tgt = k.back ? { a: { ...start }, ...z0 } : { a: { ...prev.a }, head: k.head ?? prev.head, torso: k.torso ?? prev.torso, dy: k.dy ?? prev.dy, sh: k.sh ?? prev.sh, mouth: k.mouth ?? prev.mouth, fall: k.fall ?? prev.fall, sy: { ...prev.sy, ...(k.sy ? Object.fromEntries(Object.entries(k.sy).map(([r, v]) => [mapRole(r), v])) : {}) } };
    if (!k.back && k.a) for (const [r, v] of Object.entries(k.a)) tgt.a[mapRole(r)] = mapAng(v);
    const seg = poses.length, sv = () => k.shiv ? k.shiv * (tick++ % 2 ? 1 : -1) : 0;
    for (let i = 1; i <= (k.n || 0); i++) {
      const t = i / k.n, e = t * t * (3 - 2 * t), st = { a: {}, head: lerp(prev.head, tgt.head, e), torso: lerp(prev.torso, tgt.torso, e), dy: lerp(prev.dy, tgt.dy, e), sh: lerp(prev.sh, tgt.sh, e), mouth: lerp(prev.mouth, tgt.mouth, e), fall: lerp(prev.fall, tgt.fall, e), sy: {} };
      for (const r of new Set([...Object.keys(prev.sy), ...Object.keys(tgt.sy)])) st.sy[r] = lerp(prev.sy[r] ?? 1, tgt.sy[r] ?? 1, e);
      for (const r of new Set([...Object.keys(prev.a), ...Object.keys(tgt.a)])) { const a0 = prev.a[r] ?? tgt.a[r], a1 = tgt.a[r] ?? a0; st.a[r] = angLerp(a0, a1, e); }
      poses.push(mk(st, sv())); isKey.push(i === k.n);
    }
    for (let h = 0; h < (k.hold || 0); h++) { poses.push(mk(tgt, sv())); isKey.push(!k.shiv && h === k.hold - 1); }   // trembling frames aren't keys (tweening would smooth the shake away)
    for (let j = seg; j < poses.length; j++) shakes[j] = k.shake || 0;
    if (k.sfx && poses.length > seg) sfxAt.push([seg, k.sfx]);
    prev = tgt;
  }
  const c = await ppInsertFrames(poses, dur); f0.dur = dur; f0.ppKey = true;
  const added = S.frames.slice(S.cur + 1, S.cur + 1 + c);
  added.forEach((f, i) => { f.ppKey = isKey[i] || i === c - 1; });
  // shout/rage: camera shake on the new frames + the shout sound, folded into the same undo step as the frames
  let extra = '';
  if (gestFx && (shakes.some(Boolean) || sfxAt.length)) {
    added.forEach((f, i) => { if (shakes[i]) f.shake = shakes[i]; });
    const sfx = sfxAt.filter(([j, k]) => added[j] && SFX[k]).map(([j, k]) => ({ id: newId(), frameId: added[j].id, kind: k, vol: 0.9 }));
    const e = undoStack[undoStack.length - 1];
    if (sfx.length && e && e.add) {
      S.audio = S.audio || {}; S.audio.sfx = S.audio.sfx || []; S.audio.sfx.push(...sfx);
      undoStack.pop(); undoBytes -= e.bytes; pushEntry({ multi: [e, { t: e.t, sfxadd: sfx, bytes: 200 }], t: e.t });
    }
    extra = ' + âm thanh, rung camera'; fxSyncBar(); scheduleSave();
  }
  updateFrameUI(); toast(`Đã tạo "${G[0].replace(/^\S+\s/, '')}" — ${c} frame${extra}. Muốn chỉnh: sửa tư thế ở frame 🔑, frame giữa tự cập nhật. Bấm Phát để xem.`, 4500);
}

function setFocus(on) {
  $('#app').classList.toggle('focus', on); $('#focusBar').hidden = !on; S.focus = on;
  $('#fbPen').classList.toggle('on', S.tool === 'brush'); $('#fbEraser').classList.toggle('on', S.tool === 'eraser');
  setTimeout(() => { resizeView(); }, 30); if (on) toast('Chế độ vẽ toàn màn hình — bấm ☰ Công cụ để hiện lại', 2500);
}
$('#focusBtn').addEventListener('click', () => setFocus(true));
$('#assetBtn').addEventListener('click', () => assetDialog());
$('#aiCharBtn').addEventListener('click', () => aiCharDialog());
$('#aiFxBtn').addEventListener('click', () => aiFxDialog());
$('#ppAssetBtn').addEventListener('click', () => { const s = ppPart(ppSel); assetDialog(s && s.asset ? s.asset.cat : (s && s.role === 'head' ? 'face' : /fore|arm/.test(s && s.role || '') ? 'hand' : 'eyes')); });
Object.entries(GESTURES).forEach(([k, v]) => { const b = document.createElement('button'); b.className = 'chip small'; b.textContent = v[0]; b.title = 'Tạo các frame cử chỉ từ tư thế frame này'; b.addEventListener('click', () => ppGesture(k)); $('#ppGests').append(b); });
$('#gestMir').addEventListener('change', e => { gestMirror = e.target.checked; });
$('#gestFx').addEventListener('change', e => { gestFx = e.target.checked; });
/* --- ⭐ my motions (like Animate's motion presets): save a run of frames as limb angles by role + head/body offsets,
   then rebuild it on any cut-out character, in any project. Kept in localStorage 'fs-motions' (small JSON). --- */
const MYMO_KEY = 'fs-motions';
function myMoLoad() { try { return JSON.parse(localStorage.getItem(MYMO_KEY) || '[]'); } catch (e) { return []; } }
function myMoStore(L) { try { localStorage.setItem(MYMO_KEY, JSON.stringify(L)); return true; } catch (e) { toast('Không lưu được (bộ nhớ trình duyệt đầy?)'); return false; } }
function myMoSync() { const sel = $('#myMoSel'); if (!sel) return; const L = myMoLoad(); sel.innerHTML = L.length ? L.map(m => `<option value="${m.id}">${m.name.replace(/[<>&"]/g, '')} (${m.frames.length} frame)</option>`).join('') : '<option value="">— chưa có —</option>'; }
function myMoCapture(f, ch, ref) {
  const parts = S.pp.parts.filter(p => ppCharOf(p) === ch), byRole = r => parts.find(p => p.role === r), q = (r, k, d) => { const p = byRole(r); return p && f.pp && f.pp[p.id] && f.pp[p.id][k] != null ? f.pp[p.id][k] : d; };
  const tor = byRole('torso'), hgt = tor ? Math.max(200, tor.c.height * 2.2) : H * 0.6;
  const fr = { a: ppCurAbs(f, ch), head: q('head', 'r', 0), torso: q('torso', 'r', 0), dy: q('torso', 'dy', 0) / hgt, dur: f.dur, k: ppIsKey(f) };
  if (ref) { fr.head -= ref.head; fr.torso -= ref.torso; fr.dy -= ref.dy; }
  return fr;
}
async function myMoSave() {
  if (!S.pp || !S.pp.parts.length) { toast('Cần nhân vật ghép trước'); return; }
  const ch = ppSelChar(), left = S.frames.length - S.cur; if (left < 2) { toast('Đứng ở frame đầu của chuyển động (cần ít nhất 2 frame từ đây trở đi)'); return; }
  let name = null, n = left;
  await modal({ title: '⭐ Lưu chuyển động', html: `<p class="lbl">Lưu các frame từ frame này (${S.cur + 1}) trở đi. Sau đó dùng lại cho nhân vật khác bằng nút Áp.</p><input id="myMoName" placeholder="vd. Vẫy tay chào" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)"><p class="lbl" style="margin-top:8px">Số frame: <input id="myMoN" type="number" min="2" max="${left}" value="${left}" style="width:70px;padding:6px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text)"></p>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { name = document.getElementById('myMoName').value.trim() || 'Chuyển động ' + (myMoLoad().length + 1); n = clamp(+document.getElementById('myMoN').value || left, 2, left); } }] });
  if (!name) return;
  const f0 = S.frames[S.cur], ref = myMoCapture(f0, ch), frames = [];
  for (let k = 0; k < n; k++) frames.push(myMoCapture(S.frames[S.cur + k], ch, ref));
  const L = myMoLoad(); L.push({ id: newId(), name: name.slice(0, 40), frames }); if (myMoStore(L)) { myMoSync(); $('#myMoSel').value = L[L.length - 1].id; toast(`Đã lưu "${name}" (${n} frame) — dùng được ở mọi dự án`); }
}
async function myMoApply() {
  if (!S.pp || !S.pp.parts.length) { toast('Cần nhân vật ghép trước — Nhập ảnh → Nhân vật ghép'); return; }
  const m = myMoLoad().find(x => x.id === $('#myMoSel').value); if (!m) { toast('Chưa có chuyển động nào — làm các frame rồi bấm ＋ Lưu chuyển động'); return; }
  const f0 = curFrame(), ch = ppSelChar(), parts = S.pp.parts.filter(p => ppCharOf(p) === ch), byRole = r => parts.find(p => p.role === r);
  const mir = gestMirror, mapRole = r => mir ? r.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R') : r, mapAng = a => mir ? 180 - a : a, sg = mir ? -1 : 1;
  const tor = byRole('torso'), hgt = tor ? Math.max(200, tor.c.height * 2.2) : H * 0.6;
  // the first saved frame is the starting pose: put this character's limbs there too
  { const a = {}; for (const [r, v] of Object.entries(m.frames[0].a)) a[mapRole(r)] = mapAng(v); ppKeyEdit(fr => { fr.ppKey = true; ppApplyAbs(fr, a, ch); }); }
  const base = ppClone(f0.pp || {});
  const poses = m.frames.slice(1).map(fr => {
    const tf = { pp: ppClone(base) }, a = {}; for (const [r, v] of Object.entries(fr.a)) a[mapRole(r)] = mapAng(v);
    ppApplyAbs(tf, a, ch);
    const add = (role, prop, v) => { const p = byRole(role); if (!p || !v) return; const q = ppQ(tf, p.id); q[prop] = (q[prop] || 0) + v; };
    add('head', 'r', fr.head * sg); add('torso', 'r', fr.torso * sg); add('torso', 'dy', fr.dy * hgt); return tf.pp;
  });
  const c = await ppInsertFrames(poses, m.frames[0].dur);
  S.frames.slice(S.cur + 1, S.cur + 1 + c).forEach((f, i) => { const fr = m.frames[i + 1]; f.dur = fr.dur; f.ppKey = fr.k || i === c - 1; });
  f0.dur = m.frames[0].dur; buildStrip(); updateFrameUI(); scheduleSave(); requestRender();
  toast(`Đã tạo "${m.name}" — ${c} frame. Bấm Phát để xem.`, 3500);
}
$('#myMoSave').addEventListener('click', myMoSave);
$('#myMoApply').addEventListener('click', myMoApply);
$('#myMoDel').addEventListener('click', async () => { const id = $('#myMoSel').value, L = myMoLoad(), m = L.find(x => x.id === id); if (!m) return; const ok = await modal({ title: 'Xoá chuyển động?', html: `<p>Xoá "${m.name.replace(/[<>&"]/g, '')}" khỏi danh sách (frame đã làm vẫn giữ).</p>`, buttons: [{ label: 'Huỷ', value: null }, { label: 'Xoá', value: 1, cls: 'danger' }] }); if (!ok) return; myMoStore(L.filter(x => x.id !== id)); myMoSync(); });
myMoSync();

$('#fbShow').addEventListener('click', () => setFocus(false));
$('#fbUndo').addEventListener('click', undo); $('#fbRedo').addEventListener('click', redo);
$('#fbPen').addEventListener('click', () => { setTool('brush'); setFocus(true); });
$('#fbEraser').addEventListener('click', () => { setTool('eraser'); setFocus(true); });
$('#fbPlay').addEventListener('click', startPlay);
$('#fbPrev').addEventListener('click', () => selectFrame(S.cur - 1)); $('#fbNext').addEventListener('click', () => selectFrame(S.cur + 1));
/* ===== resize the frame bar: drag the handle on top of it (or tap it) — frames, the scrub bar and the 🎚 audio rows get bigger.
   Size is a scale S.tlScale (0.75–2.5, saved in settings), applied through the CSS variable --tls and ATL_LANE. ===== */
const TLS_MIN = 0.75, TLS_MAX = 2.5;
function tlScaleSet(v, done) {
  S.tlScale = clamp(Math.round((+v || 1) * 100) / 100, TLS_MIN, TLS_MAX);
  document.documentElement.style.setProperty('--tls', S.tlScale);
  ATL_LANE = Math.round(36 * clamp(S.tlScale, 0.9, 2));
  const lb = document.getElementById('tlGripLbl'); if (lb) lb.textContent = Math.round(S.tlScale * 100) + '%';
  const add = strip.querySelector('.addfr'); if (add) add.style.width = Math.max(Math.round(96 * W / H * S.tlScale), 44) + 'px';
  if (atlOpen()) atlDraw();
  if (done) {
    const th = thumbSize()[1];
    if (S.frames.some(f => f.thumb && f.thumb.height !== th)) { S.frames.forEach(f => { f.thumb = null; }); buildStrip(); }
    saveSettings();
  }
}
// never let the frame bar eat more than ~60% of the screen (the drawing area must stay usable): shrink to the biggest size that fits
function tlCap() {
  const tl = $('#tl'), lim = window.innerHeight * 0.6;
  for (let k = 0; k < 40 && S.tlScale > 1 && tl.getBoundingClientRect().height > lim; k++) tlScaleSet(Math.max(1, S.tlScale - 0.05));
}
(() => {
  const g = $('#tlGrip'); let d = null;
  g.addEventListener('pointerdown', e => {
    if (e.button > 0) return; e.preventDefault();
    try { g.setPointerCapture(e.pointerId); } catch (_) { }
    const c = strip.querySelector('.fr canvas');
    d = { id: e.pointerId, y0: e.clientY, s0: S.tlScale || 1, moved: false, base: c && c.clientHeight && !$('#tl').classList.contains('collapsed') ? c.clientHeight / (S.tlScale || 1) : 96 };
    g.classList.add('on');
  });
  g.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y0; if (!d.moved && Math.abs(dy) < 6) return; d.moved = true;
    const prev = S.tlScale; tlScaleSet(d.s0 - dy / d.base); if (S.tlScale > prev) tlCap();
  });
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    const tap = !d.moved; d = null; g.classList.remove('on');
    if (tap) {   // 100% → 150% → 200% → 100% (when the screen has no room to grow, go back to 100%)
      const s = S.tlScale || 1; tlScaleSet(s < 1.5 - 0.01 ? 1.5 : s < 2 - 0.01 ? 2 : 1); tlCap();
      if (s > 1 && S.tlScale <= s + 0.01) tlScaleSet(1);
    }
    tlCap();
    if (tap) toast('Cỡ thanh frame: ' + Math.round(S.tlScale * 100) + '% (kéo thanh này lên/xuống để chỉnh)');
    tlScaleSet(S.tlScale, true);
  };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
})();
$('#tlCollapse').addEventListener('click', () => { const tl = $('#tl'); tl.classList.toggle('collapsed'); S.tlCollapsed = tl.classList.contains('collapsed'); $('#tlCollapse').textContent = S.tlCollapsed ? '▴ Hiện dòng frame' : '▾ Ẩn dòng frame'; saveSettings(); setTimeout(resizeView, 30); });
/* collapsible regions (rail / top bar / timeline) → small floating button on the stage */
function setUiHide(k, on, quiet) {
  S.uiHide[k] = !!on; const app = $('#app');
  ['rail', 'top', 'tl'].forEach(n => { app.classList.toggle('hide-' + n, !!S.uiHide[n]); });
  $('#dockRail').hidden = !S.uiHide.rail; $('#dockTop').hidden = !S.uiHide.top; $('#dockTl').hidden = !S.uiHide.tl;
  // keep the timeline button clear of the top button when both are on the left
  $('#dockRail').style.top = S.uiHide.top ? 'calc(50% + 20px)' : '';
  if (!quiet) { saveSettings(); if (on) toast('Đã thu gọn — chạm nút nhỏ ở góc để mở lại', 2200); }
  setTimeout(() => { resizeView(); if (!quiet) fitView(); }, 30);   // refit so the drawing really gets bigger
}
$('#railHide').addEventListener('click', () => setUiHide('rail', true));
$('#topHide').addEventListener('click', () => setUiHide('top', true));
$('#tlHide').addEventListener('click', () => setUiHide('tl', true));
$('#dockRail').addEventListener('click', () => setUiHide('rail', false));
$('#dockTop').addEventListener('click', () => setUiHide('top', false));
$('#dockTl').addEventListener('click', () => setUiHide('tl', false));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => hidePanel(b.dataset.close)));
$('#panelPill').addEventListener('click', showPanel);
$('#bgVidBtn').addEventListener('click', bgVideoDialog);
$('#bgVidFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (file.size > 150e6) { toast('Video quá lớn (tối đa 150 MB) — hãy cắt ngắn hoặc giảm chất lượng', 4000); return; }
  const pm = progress('Đang nạp video nền…'); const buf = await file.arrayBuffer(); pm.close();
  S.bgVideo = { name: file.name.slice(0, 60), type: file.type || 'video/mp4', buf, offset: 0, audio: false, vol: 0.7 };
  bgVideoSetup(); markAllFrames(); scheduleSave();
  toast('Đã đặt nền video — bấm Phát để xem. Lớp Nền chỗ nào trống sẽ thấy video', 4000);
});
$('#fxExport2').addEventListener('click', exportVideo);
$('#ppLayerBtn').addEventListener('click', () => setTool('puppet'));
$('#ppNew').addEventListener('click', () => { $('#imgFile').click(); });
$('#ppMini').addEventListener('click', () => { const mb = $('#ppbar'); mb.classList.toggle('mini'); $('#ppMini').textContent = mb.classList.contains('mini') ? '▴ Mở rộng' : '▾ Thu gọn'; });

