/* ===== 🎬 Scenes (cảnh): split a long film into named parts; move a whole scene earlier/later, copy it, select it =====
   f.scene = name on the FIRST frame of a scene (frame 1 is always the start of scene 1). Order is in the automatic undo. */
function sceneList() {
  const out = []; S.frames.forEach((f, i) => { if (i === 0 || f.scene) out.push({ a: i, name: f.scene || 'Cảnh 1' }); });
  const T = frameStartTimes(); out.forEach((s, k) => { s.b = (k + 1 < out.length ? out[k + 1].a : S.frames.length) - 1; s.sec = T[s.b + 1] - T[s.a]; });
  return out;
}
const sceneNames = () => sceneList().forEach(s => { S.frames[s.a].scene = s.name; });   // a moved scene keeps its own name
function sceneMove(k, dir) {
  const L = sceneList(), j = k + dir; if (j < 0 || j >= L.length) return;
  sceneNames(); const before = S.frames.map(f => f.id), blocks = L.map(s => S.frames.slice(s.a, s.b + 1)), cur = S.frames[S.cur];
  [blocks[k], blocks[j]] = [blocks[j], blocks[k]]; S.frames = blocks.flat();
  if (!S.frames[0].scene) S.frames[0].scene = 'Cảnh 1';
  pushEntry({ ford: { before, after: S.frames.map(f => f.id) }, bytes: 0 });
  S.cur = S.frames.indexOf(cur); tintCache.clear(); ppRetween(); buildStrip(); selectFrame(S.cur); scheduleSave(); updUndoBtns();
}
function sceneSelect(s) { mselStart(); msel.clear(); for (let i = s.a; i <= s.b; i++) msel.add(S.frames[i].id); mselLast = s.b; mselSync(); selectFrame(s.a); }
async function sceneAsk(title, init) {
  let v = null;
  await modal({ title, html: `<input id="scName" maxlength="30" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:18px" value="${String(init).replace(/"/g, '&quot;')}">`,
    buttons: [{ label: 'Huỷ', value: null }, { label: 'Xong', primary: true, action: () => { v = document.getElementById('scName').value.trim(); } }], onOpen: ov => setTimeout(() => { const i = ov.querySelector('#scName'); i.focus(); i.select(); }, 50) });
  return v ? v.slice(0, 30) : null;
}
async function shotsDialog() {
  if (playing) stopPlay(); commitFloating();
  const L = sceneList(), esc = t => String(t).replace(/</g, '&lt;');
  const rows = L.map((s, k) => `<div class="set-row" style="flex-wrap:wrap;gap:4px"><span style="flex:1;min-width:140px"><b>🎬 ${k + 1}. ${esc(s.name)}</b><br><span class="lbl" style="font-size:12px">frame ${s.a + 1}–${s.b + 1} · ${s.sec.toFixed(1)}s</span></span>
<span class="grp" style="flex-wrap:wrap;gap:4px"><button class="chip small" data-sc="go" data-k="${k}">Đi tới</button><button class="chip small" data-sc="up" data-k="${k}" ${k ? '' : 'disabled'} title="Đưa cả cảnh lên trước cảnh trước nó">⬆</button><button class="chip small" data-sc="down" data-k="${k}" ${k < L.length - 1 ? '' : 'disabled'} title="Đưa cả cảnh ra sau cảnh sau nó">⬇</button><button class="chip small" data-sc="sel" data-k="${k}" title="Chọn mọi frame của cảnh: xoá, nhân bản, đảo ngược, đổi thời lượng, kéo dời">☑ Chọn</button><button class="chip small" data-sc="dup" data-k="${k}" title="Nhân bản cả cảnh ngay sau nó">⧉</button><button class="chip small" data-sc="ren" data-k="${k}" title="Đổi tên">✎</button>${k ? `<button class="chip small" data-sc="rm" data-k="${k}" title="Bỏ mốc cảnh: gộp vào cảnh trước">✕</button>` : ''}</span></div>`).join('');
  const cs = L.findIndex((s, k) => S.cur >= s.a && S.cur <= s.b);
  let act = null;
  await modal({ title: '🎬 Cảnh (chia phim dài)', html: `<p class="lbl" style="font-size:13px">Mỗi cảnh là một đoạn frame liền nhau. Đặt mốc ở frame đầu của cảnh, rồi dời cả cảnh lên/xuống, nhân bản hoặc chọn cả cảnh để sửa một lượt.</p>${rows}`,
    buttons: [{ label: 'Đóng', value: null }, { label: `＋ Cảnh mới từ frame ${S.cur + 1}`, primary: true, action: () => { act = { sc: 'new' }; } }],
    onOpen: (ov, close) => ov.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => { act = { sc: b.dataset.sc, k: +b.dataset.k }; close(null); })) });
  if (!act) return;
  const s = L[act.k];
  if (act.sc === 'new') {
    if (S.cur === 0 || S.frames[S.cur].scene) { toast(S.cur === 0 ? 'Frame 1 luôn là đầu cảnh 1 — chọn frame khác để mở cảnh mới' : 'Frame này đã là đầu một cảnh'); return; }
    const n = await sceneAsk('Tên cảnh mới', `Cảnh ${cs + 2}`); if (!n) return;
    S.frames[S.cur].scene = n; buildStrip(); scheduleSave(); toast(`Cảnh "${n}" bắt đầu ở frame ${S.cur + 1}`);
  } else if (act.sc === 'go') selectFrame(s.a);
  else if (act.sc === 'up' || act.sc === 'down') { sceneMove(act.k, act.sc === 'up' ? -1 : 1); return shotsDialog(); }
  else if (act.sc === 'sel') { sceneSelect(s); toast(`Đã chọn ${s.b - s.a + 1} frame của "${s.name}"`); }
  else if (act.sc === 'dup') { sceneNames(); sceneSelect(s); await mselDuplicate(); const i0 = mselIdx()[0]; if (i0 != null) { S.frames[i0].scene = s.name + ' (2)'; buildStrip(); scheduleSave(); } mselEnd(); }
  else if (act.sc === 'ren') { const n = await sceneAsk('Đổi tên cảnh', s.name); if (n) { S.frames[s.a].scene = n; buildStrip(); scheduleSave(); } return shotsDialog(); }
  else if (act.sc === 'rm') { delete S.frames[s.a].scene; buildStrip(); scheduleSave(); return shotsDialog(); }
}

