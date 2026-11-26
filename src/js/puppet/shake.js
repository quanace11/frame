/* ===== 😂 Rung cả người (cười ha hả, khúc khích, run sợ, tức run) =====
   Cả nhân vật giật lên xuống / lẩy bẩy theo từng nhịp (kiểu hoạt hình cười nắc nẻ): thân nảy, hơi bẹp khi xuống, đầu ngửa
   và vai nhún theo. Không thêm frame, không vẽ lại: lớp phủ trên frame f.lip.sh = {rootId: {k, a, s}} (như lip.jg, giữ khi tween /
   chép frame, undo 'lipe', 1 entry multi). Chạy theo thời gian phim (boTime: 🌊 phát mượt / xuất video / 👀 Xem trên khung),
   nên 1 frame đứng 2 giây vẫn cười suốt 2 giây; lúc sửa nhân vật đứng yên. */
const SH_KINDS = {
  laugh: ['😂 Cười ha hả', 'Cả người giật lên xuống, đầu ngửa, vai nhún', 6],
  giggle: ['🤭 Cười khúc khích', 'Nhún nhỏ và nhanh', 10],
  scared: ['😨 Run sợ', 'Lẩy bẩy qua lại', 14],
  angry: ['😡 Tức run', 'Run bần bật tại chỗ', 16],
};
let shOpt = { k: 'laugh', a: 1, s: 6 };
try { const o = JSON.parse(localStorage.getItem('fs-shake') || 'null'); if (o && typeof o === 'object') shOpt = { ...shOpt, ...o }; } catch (e) { /* no storage */ }
const shSaveOpt = () => { try { localStorage.setItem('fs-shake', JSON.stringify(shOpt)); } catch (e) { /* no storage */ } };
// height of a character in its own coordinates (for the size of the bounce)
function shHeight(rid) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of S.pp.parts) if (p.c && (ppCharOf(p) || p.id) === rid) { y0 = Math.min(y0, p.oy); y1 = Math.max(y1, p.oy + p.c.height); }
  return y1 > y0 ? y1 - y0 : 400;
}
const shRand = (k, s) => (boHash(k, s, 91) + 1) / 2;   // 0..1, fixed for a step
// the pose with every shaking character moved for film time t
function shApply(pose, sh, t) {
  const P = { ...(pose || {}) };
  for (const rid in sh) {
    const o = sh[rid], root = ppPart(rid); if (!o || !root || !(o.a > 0)) continue;
    const A = clamp(o.a, 0.1, 2.5), k = Math.floor(t * (o.s || 6) + 1e-6), up = k % 2 === 0, v = 0.7 + 0.3 * shRand(k, 1), hgt = shHeight(rid);
    const q = P[rid] = { ...(P[rid] || {}) }, add = (key, d) => { q[key] = (q[key] == null ? (key === 'sx' || key === 'sy' ? 1 : 0) : q[key]) + d; };
    const turn = (role, deg) => { for (const p of S.pp.parts) if (p.role === role && p.id !== rid && (ppCharOf(p) || p.id) === rid) { const r = P[p.id] = { ...(P[p.id] || {}) }; r.r = (r.r || 0) + deg; } };
    if (o.k === 'scared' || o.k === 'angry') {
      const side = o.k === 'scared' ? 0.012 : 0.006, vert = o.k === 'scared' ? 0.004 : 0.006;
      add('dx', (shRand(k, 2) * 2 - 1) * side * hgt * A); add('dy', (shRand(k, 3) * 2 - 1) * vert * hgt * A);
      turn('head', (shRand(k, 4) * 2 - 1) * 2 * A);
      continue;
    }
    const big = o.k === 'giggle' ? 0.4 : 1, lift = 0.03 * hgt * A * big * v;
    if (up) { add('dy', -lift); add('sy', 0.02 * A * big); add('sx', -0.01 * A * big); }
    else { add('sy', -0.03 * A * big); add('sx', 0.02 * A * big); }
    turn('head', (up ? -5 : 2) * A * big);   // head thrown back on the way up
    turn('armL', (up ? -4 : 2) * A * big); turn('armR', (up ? 4 : -2) * A * big);   // shoulders bounce
  }
  return P;
}
function shEdit(f, fn) {
  const before = f.lip ? JSON.stringify(f.lip) : null, l = { ...(f.lip || {}) }; l.sh = { ...(l.sh || {}) }; fn(l.sh);
  if (!Object.keys(l.sh).length) delete l.sh; const lip = Object.keys(l).length ? l : null, after = lip ? JSON.stringify(lip) : null;
  if (before === after) return null; f.lip = lip; f.ver++; queueThumbFor(f); return { t: targetOf(f), lipe: true, before, after, bytes: 64 };
}
function shSync() {
  let n = 0; S.frames.forEach(f => { if (f.lip && f.lip.sh && Object.keys(f.lip.sh).length) n++; });
  const el = document.getElementById('shInfo'); if (el) el.textContent = n ? `${n} frame đang rung` : '';
}
async function shDialog() {
  const roots = lyrRoots(); if (!roots.length) { toast('Chưa có nhân vật / hình. Nhập ảnh (thành layer) hoặc cắt nhân vật trước'); return; }
  const sel = ppSel && ppPart(ppSel) ? ppCharOf(ppPart(ppSel)) : null, rid = sel || (roots.length === 1 ? roots[0].id : null);
  if (!rid) { toast('Chạm chọn nhân vật muốn rung trước (công cụ Ghép)'); return; }
  const n = S.frames.length, o = shOpt, inp = 'style="width:72px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:inherit"';
  const kinds = Object.entries(SH_KINDS).map(([k, [l, t]]) => `<button class="chip small${k === o.k ? ' on' : ''}" data-shk="${k}" title="${t}">${l}</button>`).join('');
  let out = null;
  const v = await modal({ title: '😂 Rung cả người',
    html: `<p>"${String(lyrName(ppPart(rid))).replace(/&/g, '&amp;').replace(/</g, '&lt;')}" giật theo nhịp suốt các frame chọn, không cần thêm frame. Lúc sửa đứng yên, ▶ Phát hoặc 👀 Xem trên khung để thấy.</p>
      <div class="mrow" style="gap:6px;flex-wrap:wrap">${kinds}</div>
      <div class="mrow" style="gap:8px;align-items:center;margin-top:8px"><span class="lbl">Mạnh</span><input id="shA" type="range" min="0.2" max="2.5" step="0.1" value="${o.a}" style="flex:1"><span class="lbl" id="shAV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center"><span class="lbl">Nhanh</span><input id="shS" type="range" min="2" max="20" step="1" value="${o.s}" style="flex:1"><span class="lbl" id="shSV"></span></div>
      <div class="mrow" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px"><span class="lbl">Từ frame</span><input id="shFrom" type="number" min="1" max="${n}" value="${S.cur + 1}" ${inp}><span class="lbl">tới</span><input id="shTo" type="number" min="1" max="${n}" value="${S.cur + 1}" ${inp}><span class="lbl">(trên ${n} frame)</span></div>`,
    onOpen: ov => {
      const lab = () => { ov.querySelector('#shAV').textContent = Math.round(+ov.querySelector('#shA').value * 100) + '%'; ov.querySelector('#shSV').textContent = (+ov.querySelector('#shS').value) + ' nhịp/giây'; };
      ov.querySelectorAll('[data-shk]').forEach(b => b.addEventListener('click', () => { ov.querySelectorAll('[data-shk]').forEach(x => x.classList.toggle('on', x === b)); ov.querySelector('#shS').value = SH_KINDS[b.dataset.shk][2]; lab(); }));
      ov.querySelector('#shA').addEventListener('input', lab); ov.querySelector('#shS').addEventListener('input', lab); lab();
    },
    buttons: [{ label: 'Huỷ', value: null }, { label: '✓ Rung', value: 1, primary: true, action: () => {
      const q = s => document.querySelector(s), kb = q('[data-shk].on');
      out = { k: kb ? kb.dataset.shk : 'laugh', a: +q('#shA').value, s: +q('#shS').value, from: clamp((+q('#shFrom').value || 1) - 1, 0, n - 1), to: clamp((+q('#shTo').value || 1) - 1, 0, n - 1) };
    } }],
  });
  if (!v || !out) return;
  shApplyRange(rid, out);
}
// write the shake of one character on frames from..to as ONE undo step, then play it once
function shApplyRange(rid, v) {
  const a = Math.min(v.from, v.to), b = Math.max(v.from, v.to), multi = [];
  shOpt = { k: v.k, a: v.a, s: v.s }; shSaveOpt();
  for (let i = a; i <= b; i++) { const e = shEdit(S.frames[i], sh => { sh[rid] = { k: v.k, a: v.a, s: v.s }; }); if (e) multi.push(e); }
  if (!multi.length) return;
  pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); updateFrameUI(); shSync();
  const secs = S.frames.slice(a, b + 1).reduce((s, f) => s + f.dur, 0) / 1000;
  toast(secs < 0.5 ? `Đoạn này chỉ ${secs.toFixed(1)} s: kéo dài thời lượng frame để cười lâu hơn` : `😂 Đã rung ${b - a + 1} frame. Đang phát thử…`, 3500);
  if (!ppSmoothOn()) toast('Bật 🌊 Phát mượt để nhân vật rung cả khi frame đứng lâu', 4000);
  if (playing) stopPlay(); playRangeOnce = [a, b]; startPlay();
}
async function shClear() {
  const here = Object.keys((curFrame().lip && curFrame().lip.sh) || {}); let any = false; S.frames.forEach(f => { if (f.lip && f.lip.sh) any = true; });
  if (!any) { toast('Chưa có chỗ nào rung cả người'); return; }
  const v = await modal({ title: '🗑 Bỏ rung cả người', html: '<p>Bỏ ở frame này hay ở mọi frame?</p>',
    buttons: [{ label: 'Huỷ', value: null }, ...(here.length ? [{ label: 'Chỉ frame này', value: 'here' }] : []), { label: 'Mọi frame', value: 'all', primary: true }] });
  if (!v) return; const multi = [];
  (v === 'all' ? S.frames : [curFrame()]).forEach(f => { const e = shEdit(f, sh => { for (const k in sh) delete sh[k]; }); if (e) multi.push(e); });
  if (multi.length) { pushEntry(multi.length > 1 ? { multi } : multi[0]); scheduleSave(); requestRender(); updateFrameUI(); toast('Đã bỏ rung'); }
  shSync();
}
{ const b = document.getElementById('shBtn'); if (b) b.addEventListener('click', shDialog); }
{ const b = document.getElementById('shClear'); if (b) b.addEventListener('click', shClear); }
shSync();
