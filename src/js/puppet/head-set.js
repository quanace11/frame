/* ===== 🙂 Bộ đầu: many ready-made heads (drawn or AI made, one file per head or a sheet of heads) on one character =====
   For people who only want to draw (or generate) heads: the heads become the Head part's alternative pictures (`alts`),
   fitted on the neck (same height as the head picture, bottom centre on its bottom centre), so the body, the bones and
   every pose stay as they are. Tap a head = use it on this frame / from here on / every frame / the ☑ selected frames.
   ↑↓←→ − + nudge a head that sits a little off. Keyframes: a frame that is only tweened for that layer becomes its
   keyframe (ppMarkKey), the head picture holds until the next keyframe. `tests/test_bo_dau.py`. */
let hsScope = 'one', hsPick = 0;
function hsHead() {
  const sel = ppPart(ppSel); if (!sel) return S.pp && S.pp.parts.find(p => p.role === 'head') || null;
  const rid = ppCharOf(sel) || sel.id;
  return S.pp.parts.find(p => p.role === 'head' && (ppCharOf(p) || p.id) === rid) || sel;
}
// one picture → transparent background (white paper touching the edges) → the separate drawings in it
async function hsCutFile(file, split) {
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { return []; }
  const k0 = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), sw = Math.max(1, Math.round(bmp.width * k0)), sh = Math.max(1, Math.round(bmp.height * k0));
  const src = makeCanvas(sw, sh), sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(bmp, 0, 0, sw, sh); if (bmp.close) bmp.close();
  const img = sx.getImageData(0, 0, sw, sh), d = img.data; let opaque = 0;
  for (const i of [0, sw - 1, (sh - 1) * sw, sh * sw - 1]) if (d[i * 4 + 3] > 250) opaque++;
  if (opaque >= 3) { const fig = aiWhiteMask(img); for (let i = 0; i < sw * sh; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * fig[i]); }
  const { blobs, lab } = rsBlobs(img); if (!blobs.length) return [];
  const big = Math.max(...blobs.map(b => b.n)), main = split ? blobs.filter(b => b.n >= big * 0.15) : [{ b: [0, 0, sw - 1, sh - 1], k: 0 }];
  // small bits (a loose hair strand, an eye not touching the outline) go with the big drawing whose box holds them
  const owner = new Int32Array(blobs.length + 1);
  if (split) for (const b of blobs) { const cx = (b.b[0] + b.b[2]) / 2, cy = (b.b[1] + b.b[3]) / 2; const m = main.find(M => M === b) || main.find(M => cx >= M.b[0] && cx <= M.b[2] && cy >= M.b[1] && cy <= M.b[3]); owner[b.k] = m ? m.k : 0; }
  const out = [];
  for (const M of main.sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0])) {
    let [x0, y0, x1, y1] = M.b; if (!split) { x0 = sw; y0 = sh; x1 = -1; y1 = -1; for (let i = 0; i < sw * sh; i++) if (d[i * 4 + 3] > 16) { const x = i % sw, y = (i / sw) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 < 0) continue; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, c = makeCanvas(w, h), cx = c.getContext('2d'), o = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * sw + x0 + x; if (!split || owner[lab[i]] === M.k) o.data.set(d.subarray(i * 4, i * 4 + 4), (y * w + x) * 4); }
    cx.putImageData(o, 0, 0); out.push(c);
  }
  src.width = 0; return out;
}
// a head picture fitted on the neck of part p: as tall as the head picture × s, bottom centre on its bottom centre
function hsFit(p, c, s = 1) {
  const nh = Math.max(1, Math.round(p.c.height * s)), nw = Math.max(1, Math.round(c.width * nh / c.height));
  const o = makeCanvas(nw, nh), x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, nw, nh);
  return { c: o, dx: Math.round(p.c.width / 2 - nw / 2), dy: Math.round(p.c.height - nh), src: c, s };
}
async function hsAddFiles(files, split) {
  const p = hsHead(); if (!p) { toast('Cần nhân vật ghép có Đầu trước'); return 0; }
  const pm = progress('Đang tách nền các đầu…'); let n = 0;
  try {
    const add = [];
    for (const f of files) for (const c of await hsCutFile(f, split)) { const a = hsFit(p, c); await encodeHolder(a); add.push(a); n++; }
    if (add.length) { p.alts = [...(p.alts || []), ...add]; S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); ppSyncBar(); requestRender(); }
  } finally { pm.close(); }
  return n;
}
// frames a head choice goes to
function hsFrames(scope) {
  const i0 = S.cur;
  if (scope === 'all') return S.frames.map((f, i) => i);
  if (scope === 'after') return S.frames.map((f, i) => i).filter(i => i >= i0);
  if (scope === 'sel' && msel.size) return S.frames.map((f, i) => msel.has(f.id) ? i : -1).filter(i => i >= 0);
  return [i0];
}
// use picture v (0 = the head's own picture) of part p on those frames: one undo step
function hsUse(p, v, scope) {
  const rid = ppCharOf(p) || p.id, idx = hsFrames(scope), list = [];
  idx.forEach((i, j) => {
    const f = S.frames[i], key = ppLayerKey(f, rid);
    // a tweened frame in the middle of a run keeps following its keyframe (the picture holds from the key before);
    // the first frame of the choice and the frames picked one by one become keyframes of that layer
    if (!key && !(j === 0 || scope === 'sel' || scope === 'one')) return;
    const before = ppState(f), q = ppQ(f, p.id); if (v) q.v = v; else delete q.v;
    if (!key) ppMarkKey(f, p.id);
    list.push(ppEntry(f, before, ppState(f))); markEdited(f);
  });
  if (!list.length) return;
  pushEntry(list.length === 1 ? list[0] : { multi: list, t: list[0].t });
  ppRetween(); ppSyncBar(); updateFrameUI(); requestRender();
}
// nudge / resize one added head (a new alts array + new holder object, so the automatic undo keeps the old one)
async function hsNudge(p, k, dx, dy, ds) {
  const a = p.alts && p.alts[k - 1]; if (!a) return;
  let na;
  if (ds) { const s = Math.max(0.3, Math.min(3, (a.s || 1) + ds)), f = hsFit(p, a.src || a.c, s); f.dx = Math.round(a.dx + a.c.width / 2 - f.c.width / 2); f.dy = Math.round(a.dy + a.c.height - f.c.height); na = f; await encodeHolder(na); }
  else na = { ...a, dx: (a.dx || 0) + dx, dy: (a.dy || 0) + dy };
  p.alts = p.alts.map((x, i) => i === k - 1 ? na : x);
  S.frames.forEach(f => { f.ver++; queueThumbFor(f); }); scheduleSave(); ppSyncBar(); requestRender();
}
function hsRemove(p, k) {
  if (!k || !p.alts || !p.alts[k - 1]) return;
  p.alts = p.alts.filter((x, i) => i !== k - 1);
  S.frames.forEach(f => { const q = f.pp && f.pp[p.id]; if (q && q.v) { if (q.v === k) delete q.v; else if (q.v > k) q.v--; } f.ver++; queueThumbFor(f); });
  scheduleSave(); ppSyncBar(); requestRender();
}
function hsDialog() {
  const p = hsHead(); if (!p || !p.c) { toast('Cần nhân vật ghép có Đầu trước: ⚽ Cầu thủ mẫu, 🧍 Kho nhân vật, hoặc ✂ Tự cắt', 4000); return; }
  if (S.tool !== 'puppet') setTool('puppet');
  const sc = [['one', 'Frame này'], ['after', 'Từ đây về sau'], ['all', 'Mọi frame']].concat(msel.size ? [['sel', `☑ ${msel.size} frame đã chọn`]] : []);
  if (hsScope === 'sel' && !msel.size) hsScope = 'one';
  modal({
    title: '🙂 Bộ đầu — ' + p.name,
    html: `<p style="margin:0 0 8px">Tải lên các đầu đã vẽ / AI tạo (nền trắng cũng được, 1 ảnh có nhiều đầu thì tự tách). Đầu tự gắn vào cổ, thân và xương giữ nguyên. Chạm 1 đầu = dùng cho:</p>
      <div class="mrow" style="flex-wrap:wrap" id="hsScope">${sc.map(([k, l]) => `<button class="chip small${k === hsScope ? ' on' : ''}" data-hss="${k}">${l}</button>`).join('')}</div>
      <div id="hsGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;max-height:46vh;overflow:auto"></div>
      <div class="mrow" style="flex-wrap:wrap" id="hsAdj"><span class="lbl">Chỉnh đầu đang chọn:</span><button class="chip small" data-hsn="0,-4,0">↑</button><button class="chip small" data-hsn="0,4,0">↓</button><button class="chip small" data-hsn="-4,0,0">←</button><button class="chip small" data-hsn="4,0,0">→</button><button class="chip small" data-hsn="0,0,-0.05">− Nhỏ</button><button class="chip small" data-hsn="0,0,0.05">＋ To</button><button class="chip small" id="hsDel">🗑 Bỏ đầu này</button></div>
      <div class="mrow" style="flex-wrap:wrap;margin-top:8px"><button class="chip on" id="hsAddBtn">＋ Thêm đầu (chọn nhiều ảnh)</button><label class="lbl"><input type="checkbox" id="hsSplit" checked> Ảnh có nhiều đầu thì tách ra</label><input type="file" id="hsFile" accept="image/*" multiple hidden></div>`,
    buttons: [{ label: '✓ Xong', value: true, primary: true }],
    onOpen: ov => {
      const grid = ov.querySelector('#hsGrid');
      const draw = () => {
        const q = curFrame().pp && curFrame().pp[p.id], cur = q && q.v ? q.v : 0; grid.innerHTML = '';
        [p.c, ...(p.alts || []).map(a => a.c)].forEach((cc, i) => {
          const t = makeCanvas(84, 84), tx = t.getContext('2d'), k = Math.min(78 / cc.width, 78 / cc.height);
          tx.fillStyle = '#fff'; tx.fillRect(0, 0, 84, 84); tx.drawImage(cc, (84 - cc.width * k) / 2, (84 - cc.height * k) / 2, cc.width * k, cc.height * k);
          t.dataset.hsi = i; t.title = i ? 'Đầu ' + (i + 1) : 'Đầu gốc';
          t.style.cssText = `width:84px;height:84px;border-radius:10px;cursor:pointer;border:3px solid ${i === cur ? '#ffb21e' : i === hsPick ? '#2f7bff' : 'transparent'}`;
          t.addEventListener('click', () => { hsPick = i; hsUse(p, i, hsScope); draw(); });
          grid.append(t);
        });
        ov.querySelector('#hsAdj').style.opacity = hsPick ? 1 : 0.45;
      };
      ov.querySelectorAll('[data-hss]').forEach(b => b.addEventListener('click', () => { hsScope = b.dataset.hss; ov.querySelectorAll('[data-hss]').forEach(x => x.classList.toggle('on', x === b)); }));
      ov.querySelectorAll('[data-hsn]').forEach(b => b.addEventListener('click', async () => { if (!hsPick) { toast('Chạm chọn 1 đầu đã thêm (không phải đầu gốc)'); return; } const [dx, dy, ds] = b.dataset.hsn.split(',').map(Number); await hsNudge(p, hsPick, dx, dy, ds); draw(); }));
      ov.querySelector('#hsDel').addEventListener('click', () => { if (!hsPick) return; hsRemove(p, hsPick); hsPick = 0; draw(); });
      const fi = ov.querySelector('#hsFile');
      ov.querySelector('#hsAddBtn').addEventListener('click', () => fi.click());
      fi.addEventListener('change', async () => { const files = [...fi.files]; fi.value = ''; if (!files.length) return; const n = await hsAddFiles(files, ov.querySelector('#hsSplit').checked); toast(n ? `Đã thêm ${n} đầu — chạm 1 đầu để dùng` : 'Không tìm thấy hình trong ảnh', 3000); draw(); });
      draw();
    }
  });
}
$('#hsBtn').addEventListener('click', hsDialog);
