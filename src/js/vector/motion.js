/* ========= Motion generator (vector strokes) ========= */
let motion = null;
const MDEF = {
  swing: { amp: 25, ampMin: 3, ampMax: 90, unit: '°', lbl: 'Góc vẫy ±', n: 6, cyc: 1, dur: 0.1,
    hint: 'Chạm lên khung để đặt <b>điểm khớp</b> (vai, khuỷu, hông) — chấm hồng. Uốn mềm cao = tay cong như sợi mì.' },
  mouth: { amp: 60, ampMin: 10, ampMax: 160, unit: '%', lbl: 'Độ há miệng', n: 4, cyc: 2, dur: 0.08,
    hint: 'Chọn đúng nét <b>miệng</b>. Môi dưới sẽ hạ xuống rồi khép lại.' },
  bob: { amp: 20, ampMin: 2, ampMax: 200, unit: 'px', lbl: 'Độ nhún', n: 6, cyc: 1, dur: 0.1,
    hint: 'Các nét đang chọn sẽ nhún lên xuống (thở, nhảy nhẹ).' },
  shake: { amp: 15, ampMin: 2, ampMax: 200, unit: 'px', lbl: 'Độ lắc', n: 6, cyc: 2, dur: 0.06,
    hint: 'Các nét đang chọn sẽ lắc qua lại (run, giận dữ, cười).' }
};
const LIP = '~lip';
function guessPivot(vec, ids) {
  const sel = vec.filter(st => ids.has(st.id)), others = vec.filter(st => !ids.has(st.id) && !st.id.endsWith(LIP));
  const ends = []; sel.forEach(st => { ends.push(st.pts[0], st.pts[st.pts.length - 1]); });
  if (!ends.length) return { x: W / 2, y: H / 2 };
  if (!others.length) return ends.reduce((a, q) => q.y < a.y ? q : a);
  let best = ends[0], bd = Infinity;
  for (const q of ends) { let d = Infinity; for (const o of others) d = Math.min(d, strokeDist(o, q)); if (d < bd) { bd = d; best = q; } }
  return { x: best.x, y: best.y };
}
/** Return a new stroke list where strokes in ids are posed for phase k (others unchanged). */
function motionVec(vec, k, m) {
  const t = 2 * Math.PI * m.cyc * k / m.n, out = [];
  let maxD = 1;
  if (m.type === 'swing') for (const st of vec) if (m.ids.has(st.id)) for (const q of st.pts) maxD = Math.max(maxD, Math.hypot(q.x - m.pivot.x, q.y - m.pivot.y));
  for (const st of vec) {
    if (st.id.endsWith(LIP) && m.ids.has(st.id.slice(0, -LIP.length))) continue;   // regenerate lips
    if (!m.ids.has(st.id)) { out.push(st); continue; }
    const s2 = { id: st.id, c: st.c, w: st.w, a: st.a, pts: st.pts.map(q => ({ x: q.x, y: q.y })) };
    if (m.type === 'swing') {
      const A = m.amp * Math.PI / 180 * Math.sin(t), soft = m.soft / 100;
      for (const q of s2.pts) {
        const dx = q.x - m.pivot.x, dy = q.y - m.pivot.y, d = Math.hypot(dx, dy);
        const a = A * ((1 - soft) + soft * Math.pow(d / maxD, 1.3)), cs = Math.cos(a), sn = Math.sin(a);
        q.x = m.pivot.x + dx * cs - dy * sn; q.y = m.pivot.y + dx * sn + dy * cs;
      }
      out.push(s2);
    } else if (m.type === 'bob' || m.type === 'shake') {
      const v = m.amp * Math.sin(t);
      for (const q of s2.pts) { if (m.type === 'bob') q.y += v; else q.x += v; }
      out.push(s2);
    } else if (m.type === 'mouth') {
      out.push(s2);
      const v = (1 - Math.cos(t)) / 2;
      if (v > 0.03 && st.pts.length >= 2) { const l = lipStroke(st, m.amp / 100 * 0.5 * v); if (l) out.push(l); }
    }
  }
  return out;
}
function motionOpen() {
  const f = curFrame(); if (!f || !vsel.size) { toast('Chọn nét cần chuyển động trước (chạm hoặc khoanh)'); return; }
  if (playing) stopPlay();
  const ids = new Set([...vsel].filter(id => !id.endsWith(LIP)));
  motion = { ids, type: 'swing', mode: 'new', soft: 40, k: 0, timer: null, pv: null };
  setMotionType('swing');
  motion.pivot = guessPivot(f.vec, ids);
  $('#vecbar').hidden = true; $('#motionbar').hidden = false;
  syncMotionUI(); motionPreview();
}
function setMotionType(t) {
  const d = MDEF[t]; Object.assign(motion, { type: t, amp: d.amp, n: d.n, cyc: d.cyc, dur: d.dur });
  if (!motion.pivot) motion.pivot = guessPivot(curFrame().vec, motion.ids);
}
function syncMotionUI() {
  const m = motion, d = MDEF[m.type];
  document.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === m.type));
  document.querySelectorAll('[data-ma]').forEach(b => b.classList.toggle('on', b.dataset.ma === m.mode));
  const a = $('#mAmp'); a.min = d.ampMin; a.max = d.ampMax; a.value = m.amp; $('#mAmpLbl').textContent = d.lbl; $('#mAmpVal').textContent = m.amp + d.unit;
  document.querySelectorAll('.mSoft').forEach(e => e.style.display = m.type === 'swing' ? '' : 'none'); $('#mSoft').value = m.soft;
  $('#mN').value = m.n; $('#mNVal').textContent = m.n; $('#mCyc').value = m.cyc; $('#mCycVal').textContent = m.cyc; $('#mDur').value = m.dur;
  const avail = S.frames.length - S.cur;
  $('#mInfo').textContent = `${m.ids.size} nét · ${m.n} frame · ${(m.n * m.dur).toFixed(2)}s`;
  $('#mHint').innerHTML = d.hint + (m.mode === 'apply' ? ` <br>Áp lên frame ${S.cur + 1}–${Math.min(S.frames.length, S.cur + m.n)}` + (avail < m.n ? ` (chỉ có ${avail} frame, phần thiếu bị bỏ)` : '') + ' — dùng để ghép thêm chuyển động khác (vd. vừa vẫy tay vừa nói).' : '');
}
function motionPreview() {
  clearTimeout(motion && motion.timer); if (!motion) return;
  const f = curFrame(); motion.pv = motionVec(f.vec, motion.k, motion); requestRender();
  motion.timer = setTimeout(() => { if (!motion) return; motion.k = (motion.k + 1) % motion.n; motionPreview(); }, Math.max(30, motion.dur * 1000));
}
function motionClose() {
  if (!motion) return; clearTimeout(motion.timer); motion = null;
  $('#motionbar').hidden = true; updVecBar(); requestRender();
}
async function motionCommit() {
  const m = motion; if (!m) return; clearTimeout(m.timer);
  const f0 = curFrame(), i0 = S.cur, durMs = Math.round(m.dur * 1000);
  if (m.mode === 'new') {
    await ensureLoaded(f0);
    const added = [];
    for (let k = 1; k < m.n; k++) {
      const f = newFrameObj(f0.bgId); f.dur = durMs;
      f.canvas.getContext('2d').drawImage(f0.canvas, 0, 0); copyCol(f, f0); f.ver = 1; f.pngVer = 0;
      f.vec = cloneVec(motionVec(f0.vec, k, m)); f.pp = ppClone(f0.pp); f.lip = lipCopy(f0); added.push(f);
    }
    const oldDur = f0.dur; f0.dur = durMs;
    S.frames.splice(i0 + 1, 0, ...added); loaded.push(...added);
    pushEntry({ t: targetOf(f0), add: { frames: added, index: i0 + 1, dur0: oldDur, dur1: durMs }, bytes: 0 });
    motionClose();
    for (const f of added) await drawThumb(f);
    buildStrip(); updateFrameUI(); evictSoon(); scheduleSave();
    toast(`Đã tạo ${added.length} frame mới — bấm Phát để xem`, 3000);
  } else {
    const entries = []; let n = 0;
    for (let k = 0; k < m.n; k++) {
      const f = S.frames[i0 + k]; if (!f) break;
      const before = cloneVec(f.vec);
      if (!f.vec.some(st => m.ids.has(st.id))) continue;
      f.vec = motionVec(f.vec, k, m); f.dur = durMs;
      entries.push(vecEntry(f, before, cloneVec(f.vec))); markEdited(f); n++;
    }
    if (entries.length) pushEntry({ multi: entries });
    motionClose(); updateFrameUI(); scheduleSave();
    toast(n ? `Đã áp chuyển động lên ${n} frame` : 'Các frame sau không có những nét này — dùng "Tạo frame mới"', 3000);
  }
}
$('#vecMotion').addEventListener('click', motionOpen);
document.querySelectorAll('[data-mt]').forEach(b => b.addEventListener('click', () => { setMotionType(b.dataset.mt); motion.k = 0; syncMotionUI(); motionPreview(); }));
document.querySelectorAll('[data-ma]').forEach(b => b.addEventListener('click', () => { motion.mode = b.dataset.ma; syncMotionUI(); }));
$('#mAmp').addEventListener('input', e => { motion.amp = +e.target.value; syncMotionUI(); });
$('#mSoft').addEventListener('input', e => { motion.soft = +e.target.value; });
$('#mN').addEventListener('input', e => { motion.n = +e.target.value; motion.k %= motion.n; syncMotionUI(); });
$('#mCyc').addEventListener('input', e => { motion.cyc = +e.target.value; syncMotionUI(); });
$('#mDur').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { motion.dur = v; syncMotionUI(); } });
$('#mCancel').addEventListener('click', motionClose);
$('#mMini').addEventListener('click', () => { const mb = $('#motionbar'); mb.classList.toggle('mini'); $('#mMini').textContent = mb.classList.contains('mini') ? '▴ Mở rộng' : '▾ Thu gọn'; });
$('#mGo').addEventListener('click', motionCommit);

