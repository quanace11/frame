/* ===== ✂ Cắt từng bộ phận: draw a character by hand on a frame, then lasso its body parts into a cut-out with bones =====
   Like making a cut-out rig in Adobe Animate, but quicker: pick a role (Thân, Đầu, Tay trên trái…) and lasso that part
   of the drawing on this frame (Nét + Màu + vector lines). Loops may overlap: draw each one round a bit past the joint
   (thigh past the knee, shin above the knee). The joint goes in the middle of where a part overlaps its parent (drag the
   pink dot to move it), and bones are linked by role (shin → thigh → body), so gestures and symbols work straight away.
   ✓ Xong turns the loops into one character layer from this frame on, clears the drawing that was cut from the frame,
   and is 1 undo step. `HC` = the cut in progress (null when off).
   Also from Nhập ảnh → ✂ Tự cắt từng phần (`hcBeginImage`): the picture is cut instead of the frame, which stays as it is.
   ◯ Khớp tròn (`HC.round`, default on): where two loops overlap, each pixel goes to the side of the joint it is on, plus a
   disc round the joint kept by the piece in front, so a turned arm leaves no stub on the body and no gap (a ball joint,
   like a paper puppet's split pin). Who owns a pixel in an overlap: a colour only one piece has (`hcColWin`), else the
   piece whose own drawing reaches it first without crossing outlines (`hcOwners`), else the side of the joint. Pieces are rigid (`hard`: no soft mesh warp, so turning never crumples the picture).
   Each loop can be hooked to another one (`r.par`, Gắn vào) and put in front of / behind it (`r.front`). */
let HC = null;
const HC_SEQ = ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'];
const HC_SHORT = { torso: 'Thân', head: 'Đầu', armL: 'Tay T', foreL: 'Cẳng T', armR: 'Tay P', foreR: 'Cẳng P', legL: 'Đùi T', shinL: 'Ống T', legR: 'Đùi P', shinR: 'Ống P', eyes: 'Mắt', mouth: 'Miệng' };
const hcName = r => r.role === 'other' ? 'Mảnh ' + (HC.regs.filter(q => q.role === 'other').indexOf(r) + 1) : PP_ROLES[r.role];
const HC_PARENT = { head: 'torso', armL: 'torso', armR: 'torso', legL: 'torso', legR: 'torso', foreL: 'armL', foreR: 'armR', shinL: 'legL', shinR: 'legR', eyes: 'head', mouth: 'head', other: 'torso' };
const HC_Z = { torso: 9, head: 10, eyes: 11, mouth: 11, armL: 5, armR: 5, foreL: 4, foreR: 4, legL: 2, legR: 2, shinL: 1, shinR: 1, other: 7 };
const HC_COL = { torso: '#ff9f1c', head: '#ff3b9a', eyes: '#00b4d8', mouth: '#ef233c', armL: '#2ec4b6', foreL: '#3a86ff', armR: '#8ac926', foreR: '#06d6a0', legL: '#a06cd5', shinL: '#7b2cbf', legR: '#e76f51', shinR: '#f4a261', other: '#ffd60a' };
function hcSource(f) {   // what the frame shows of its own drawing: Màu under Nét pixels, vector lines on top
  const c = makeCanvas(), x = c.getContext('2d');
  if (S.showCol && f.col) x.drawImage(f.col, 0, 0);
  if (S.showChar && f.canvas) x.drawImage(f.canvas, 0, 0);
  if (S.showVec && f.vec && f.vec.length) drawVec(x, f.vec);
  return c;
}
function hcOpen(f, src, img) {
  const d = src.getContext('2d').getImageData(0, 0, W, H).data;
  let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++;
  if (n < 40) return false;
  HC = { f, src, ink: d, regs: [], role: 'torso', img: !!img, round: true, sel: null };
  setTool('puppet'); hcSync(); requestRender();
  toast('Khoanh Thân trước. Mỗi vùng bo tròn quá khớp một chút, các vùng được chồng lên nhau', 4000);
  return true;
}
async function hcBegin() {
  const f = curFrame(); if (!f) return;
  if (playing) stopPlay(); commitFloating(); await ensureLoaded(f);
  if (!hcOpen(f, hcSource(f))) {
    modal({ title: '✂ Cắt từng bộ phận', html: '<p>Frame này chưa có hình vẽ. Bạn có thể:</p><p>• <b>Vẽ nhân vật</b> ở lớp Nét / Màu (đồ qua ảnh mờ cũng được), rồi bấm lại ✂ Cắt từng bộ phận.</p><p>• <b>Nhập ảnh nhân vật</b> rồi tự khoanh từng phần trên ảnh (frame giữ nguyên).</p>',
      buttons: [{ label: 'Để sau', value: null }, { label: '🖼 Nhập ảnh để tự cắt', primary: true, value: 1 }] }).then(v => { if (v) hcPickImage(); });
  }
}
function hcPickImage() { wizImport = 'hand'; $('#imgFile').click(); }
// Nhập ảnh → ✂ Tự cắt từng phần: the picture fits 90% of the frame (like the automatic cut) and is lassoed on its own
function hcBeginImage(img) {
  if (playing) stopPlay(); commitFloating(); motionClose(); rigClose();
  const src = makeCanvas(), x = src.getContext('2d'), k = Math.min(W * 0.9 / img.width, H * 0.9 / img.height);
  x.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  if (!hcOpen(curFrame(), src, true)) toast('Ảnh trống sau khi xoá nền');
}
function hcCancel() { HC = null; lasso = null; hcSync(); ppSyncBar(); requestRender(); }
function hcRemove(r) { const i = HC.regs.indexOf(r); if (i < 0) return; HC.regs.splice(i, 1); for (const q of HC.regs) if (q.par === r) delete q.par; if (HC.sel === r) HC.sel = null; }
function hcMask(poly) {
  const c = makeCanvas(), x = c.getContext('2d'); polyPath(x, poly); x.fillStyle = '#fff'; x.fill();
  const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); let b = [W, H, -1, -1];
  for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] > 127) { m[i] = 1; const xx = i % W, yy = (i - xx) / W; if (xx < b[0]) b[0] = xx; if (yy < b[1]) b[1] = yy; if (xx > b[2]) b[2] = xx; if (yy > b[3]) b[3] = yy; }
  c.width = 0; return { m, b };
}
function hcReg(role) { return HC && HC.regs.find(r => r.role === role); }
function hcAutoRoot() { return hcReg('torso') || HC.regs[0] || null; }
function hcParentOf(r) {
  if (r.par !== undefined && r.par && HC.regs.includes(r.par) && r.par !== r) return r.par;
  const root = hcAutoRoot(); if (r === root) return null;
  const pr = HC_PARENT[r.role] && hcReg(HC_PARENT[r.role]);
  return pr && pr !== r ? pr : root;
}
function hcRoot() { return HC.regs.find(r => !hcParentOf(r)) || hcAutoRoot(); }
function hcIsUnder(q, r) { for (let k = 0, a = q; a && k < 40; k++) { if (a === r) return true; a = hcParentOf(a); } return false; }   // q is r or hangs below r
// joint of a part = middle of the drawing where its loop overlaps its parent's loop (no ink there → middle of the overlap,
// no overlap at all → the part's drawing nearest to the parent)
function hcJointAuto(r, pr) {
  const a = r.m, b = pr.m, ink = HC.ink, x0 = Math.max(r.b[0], pr.b[0]), y0 = Math.max(r.b[1], pr.b[1]), x1 = Math.min(r.b[2], pr.b[2]), y1 = Math.min(r.b[3], pr.b[3]);
  let sx = 0, sy = 0, n = 0, ex = 0, ey = 0, en = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (!a[i] || !b[i]) continue; ex += x; ey += y; en++; if (ink[i * 4 + 3] > 20) { sx += x; sy += y; n++; } }
  if (n > 8) return { x: sx / n, y: sy / n };
  if (en) return { x: ex / en, y: ey / en };
  let cx = 0, cy = 0, cn = 0;
  for (let y = pr.b[1]; y <= pr.b[3]; y += 3) for (let x = pr.b[0]; x <= pr.b[2]; x += 3) { const i = y * W + x; if (b[i] && ink[i * 4 + 3] > 20) { cx += x; cy += y; cn++; } }
  if (!cn) return { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] };
  cx /= cn; cy /= cn; let best = { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] }, bd = Infinity;
  for (let y = r.b[1]; y <= r.b[3]; y += 2) for (let x = r.b[0]; x <= r.b[2]; x += 2) { const i = y * W + x; if (a[i] && ink[i * 4 + 3] > 20) { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < bd) { bd = dd; best = { x, y }; } } }
  return best;
}
function hcJoint(r) {
  if (r.jm) return r.jm;
  const pr = hcParentOf(r);
  if (pr) return hcJointAuto(r, pr);
  // the root turns round the hips: between the legs' joints, else the bottom middle of the body
  const legs = ['legL', 'legR'].map(hcReg).filter(Boolean).map(q => hcJointAuto(q, r));
  if (legs.length) return { x: legs.reduce((s, q) => s + q.x, 0) / legs.length, y: legs.reduce((s, q) => s + q.y, 0) / legs.length };
  return { x: (r.b[0] + r.b[2]) / 2, y: r.b[1] + (r.b[3] - r.b[1]) * 0.85 };
}
function hcAdd(poly) {
  if (!HC || poly.length < 3) return;
  const { m, b } = hcMask(poly);
  let ink = 0; for (let y = b[1]; y <= b[3]; y += 2) for (let x = b[0]; x <= b[2]; x += 2) { const i = y * W + x; if (m[i] && HC.ink[i * 4 + 3] > 20) ink++; }
  if (b[2] < 0 || ink < 6) { toast('Vùng khoanh không có hình vẽ'); return; }
  const role = HC.role, old = HC.regs.findIndex(r => r.role === role && role !== 'other');
  const r = { role, poly, m, b, jm: null };
  if (old >= 0) { const o = HC.regs[old]; if (o.par !== undefined) r.par = o.par; if (o.front !== undefined) r.front = o.front; for (const q of HC.regs) if (q.par === o) q.par = r; HC.regs[old] = r; } else HC.regs.push(r);
  HC.sel = r;
  const kid = Object.keys(HC_PARENT).find(k => HC_PARENT[k] === role && HC_SEQ.includes(k) && !hcReg(k) && role !== 'torso');
  const next = kid || HC_SEQ.find(q => !hcReg(q)); HC.role = next || 'other';
  hcSync(); requestRender();
}
function hcHitJoint(p) {
  const tol = 22 * DPR / vs;
  for (const r of HC.regs) { if (r === hcRoot() && !r.jm && HC.regs.length < 2) continue; const j = hcJoint(r); if (Math.hypot(j.x - p.x, j.y - p.y) < tol) return r; }
  return null;
}
function hcStart(p, base) {
  const r = hcHitJoint(p);
  if (r) { const j = hcJoint(r), jm0 = r.jm; r.jm = { x: j.x, y: j.y }; action = { ...base, kind: 'hcjoint', r, jm0, last: p }; return; }
  lasso = [p]; lassoOpen = false; action = { ...base, kind: 'hclasso' };
}
function hcMove(p) {
  const a = action; if (!a || !HC) return;
  if (a.kind === 'hcjoint') { a.r.jm.x += p.x - a.last.x; a.r.jm.y += p.y - a.last.y; a.last = p; requestRender(); return; }
  const l = lasso && lasso[lasso.length - 1]; if (l && Math.hypot(p.x - l.x, p.y - l.y) > 3 / vs) { lasso.push(p); requestRender(); }
}
function hcEnd() {
  const a = action; if (!a || !HC) return;
  if (a.kind === 'hclasso') {
    const poly = lasso; lasso = null;
    let len = 0; if (poly) for (let k = 1; k < poly.length; k++) len += Math.hypot(poly[k].x - poly[k - 1].x, poly[k].y - poly[k - 1].y);
    if (poly && len < 24 / vs) {   // a tap (no loop): pick the piece under the finger to hook it / order it
      const hit = [...HC.regs].reverse().find(r => pip(poly[0], r.poly)); if (hit) { HC.sel = hit; hcSync(); }
    } else if (poly && poly.length > 2 && performance.now() - a.t0 > 120) hcAdd(poly);
    requestRender();
  }
}
function hcDraw(c, px) {
  if (!HC) return;
  c.save();
  if (HC.img) c.drawImage(HC.src, 0, 0);   // the imported picture being cut (the frame itself is not touched)
  for (const r of HC.regs) {
    const col = HC_COL[r.role] || '#ffd60a', on = r === HC.sel;
    polyPath(c, r.poly); c.globalAlpha = on ? 0.26 : 0.16; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
    c.lineWidth = (on ? 5 : 3) * px; c.strokeStyle = col; c.setLineDash(on ? [] : [10 * px, 6 * px]); c.stroke(); c.setLineDash([]);
    const t = HC_SHORT[r.role] || hcName(r), lx = r.poly.reduce((a, q) => a + q.x, 0) / r.poly.length, ly = r.poly.reduce((a, q) => a + q.y, 0) / r.poly.length;
    c.font = `bold ${13 * px}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; const tw = c.measureText(t).width + 10 * px;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(lx - tw / 2, ly - 10 * px, tw, 20 * px); c.fillStyle = col; c.fillText(t, lx, ly);
  }
  for (const r of HC.regs) {
    const j = hcJoint(r), pr = hcParentOf(r);
    if (!pr && HC.regs.length < 2) continue;
    if (pr) {   // bone line from the parent's joint, and the round joint the two pieces share
      const pj = hcJoint(pr); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3 * px; c.setLineDash([6 * px, 5 * px]); c.beginPath(); c.moveTo(pj.x, pj.y); c.lineTo(j.x, j.y); c.stroke(); c.setLineDash([]);
      if (HC.round) { const R = hcCapR(r, pr, j); c.beginPath(); c.arc(j.x, j.y, R, 0, Math.PI * 2); c.lineWidth = 2 * px; c.strokeStyle = '#ff3b9a'; c.setLineDash([4 * px, 4 * px]); c.stroke(); c.setLineDash([]); }
    }
    c.beginPath(); c.arc(j.x, j.y, 10 * px, 0, Math.PI * 2); c.fillStyle = '#ff3b9a'; c.fill(); c.lineWidth = 3 * px; c.strokeStyle = '#fff'; c.stroke();
  }
  c.restore();
}
function hcSync() {
  const bar = $('#hcBar'); if (!bar) return;
  bar.hidden = !HC || S.tool !== 'puppet';
  document.body.classList.toggle('hcOn', !!HC);
  if (!HC) return;
  bar.querySelectorAll('[data-hcr]').forEach(b => { const k = b.dataset.hcr, done = k !== 'other' && !!hcReg(k); b.classList.toggle('on', HC.role === k); b.classList.toggle('done', done); b.textContent = (done ? '✓ ' : '') + (k === 'other' ? '＋ Mảnh khác' : PP_ROLES[k]); });
  $('#hcUndo').disabled = !HC.regs.length; $('#hcDone').disabled = !HC.regs.length;
  $('#hcRound').classList.toggle('on', HC.round);
  $('#hcHint').textContent = `Khoanh: ${HC.role === 'other' ? 'mảnh khác' : PP_ROLES[HC.role]} · đã có ${HC.regs.length} vùng`;
  // the piece picked last (or tapped in the list): hook it to another piece, in front of / behind it, or drop it
  $('#hcRegs').innerHTML = HC.regs.length ? '<span class="lbl">Mảnh:</span>' + HC.regs.map((q, i) => `<button class="chip small${q === HC.sel ? ' on' : ''}" data-hci="${i}" style="border-color:${HC_COL[q.role] || '#ffd60a'}">${hcName(q)}</button>`).join('') : '';
  const r = HC.sel && HC.regs.includes(HC.sel) ? HC.sel : null, row = $('#hcSelRow'); row.hidden = !r;
  if (!r) return;
  const pr = hcParentOf(r), sel = $('#hcPar');
  $('#hcSelName').textContent = hcName(r);
  sel.innerHTML = (pr ? '' : '<option value="">— gốc: cả người đi theo mảnh này —</option>') + HC.regs.filter(q => !hcIsUnder(q, r)).map(q => `<option value="${HC.regs.indexOf(q)}">${hcName(q)}</option>`).join('');
  sel.value = pr ? String(HC.regs.indexOf(pr)) : ''; sel.disabled = !pr && HC.regs.length < 2;
  const front = hcFront(r, pr);
  $('#hcFront').classList.toggle('on', !!pr && front); $('#hcBack').classList.toggle('on', !!pr && !front); $('#hcFront').disabled = $('#hcBack').disabled = !pr;
}
const hcFront = (r, pr) => r.front !== undefined ? r.front : pr ? (HC_Z[r.role] || 7) > (HC_Z[pr.role] || 7) : true;
// radius of the round joint between a piece and its parent: half the width of the piece across its bone at the joint
function hcCapR(r, pr, j) {
  const key = j.x + ',' + j.y + ',' + HC.regs.indexOf(pr); if (r.capK === key) return r.capR;
  const d = hcDir(r, pr, j), vx = -d.y, vy = d.x, m = r.m, ink = HC.ink; let w = 0;
  for (const sg of [-1, 1]) { let gap = 0, s = 0; for (let t = 1; t < 400; t++) { const x = Math.round(j.x + vx * t * sg), y = Math.round(j.y + vy * t * sg); if (x < 0 || y < 0 || x >= W || y >= H || !m[y * W + x]) break; if (ink[(y * W + x) * 4 + 3] > 20) { s = t; gap = 0; } else if (++gap > 6) break; } w = Math.max(w, s); }
  const sz = Math.min(r.b[2] - r.b[0], r.b[3] - r.b[1]);
  r.capK = key; r.capR = clamp(w + 3, 8, Math.max(8, 0.6 * sz)); return r.capR;
}
// colours each loop has on its own (outside every other loop): 4096-bin histogram of its drawing there
function hcHists() {
  for (const r of HC.regs) {
    const hh = new Float32Array(4096); let n = 0;
    for (let y = r.b[1]; y <= r.b[3]; y += 2) for (let x = r.b[0]; x <= r.b[2]; x += 2) {
      const i = y * W + x, o = i * 4; if (!r.m[i] || HC.ink[o + 3] <= 20 || HC.regs.some(q => q !== r && q.m[i])) continue;
      hh[(HC.ink[o] >> 4) << 8 | (HC.ink[o + 1] >> 4) << 4 | HC.ink[o + 2] >> 4]++; n++;
    }
    r.hist = hh; r.histN = n;
  }
}
function hcColWin(r, q, R, G, B) {   // 1 = this colour belongs to r, -1 = to q, 0 = both have it (outlines) or no telling
  if (r.histN < 40 || q.histN < 40) return 0;
  const c = (R >> 4) << 8 | (G >> 4) << 4 | B >> 4, a = r.hist[c], b = q.hist[c];   // a colour the other piece (almost) never has
  return a >= 6 && b <= 0.02 * a && b < 4 ? 1 : b >= 6 && a <= 0.02 * b && a < 4 ? -1 : 0;
}
// who owns each pixel where loops overlap: grown from each loop's own drawing at the same time (like a flood fill),
// a step costs 1 and stepping onto a dark outline costs 8 more, so a sleeve seam keeps the sleeve with the arm and the
// shirt with the body, and along a plain limb the two sides meet half way (at the joint). Int16: region index + 1, 0 = none.
function hcOwners() {
  const cnt = new Uint8Array(W * H), ink = HC.ink, regs = HC.regs, own = new Int16Array(W * H), cost = new Int32Array(W * H).fill(1e9), B = [];
  for (const r of regs) for (let y = r.b[1]; y <= r.b[3]; y++) for (let x = r.b[0]; x <= r.b[2]; x++) { const i = y * W + x; if (r.m[i] && cnt[i] < 255) cnt[i]++; }
  const push = (i, c) => { (B[c] || (B[c] = [])).push(i); }, dark = i => { const o = i * 4; return ink[o] * 0.3 + ink[o + 1] * 0.59 + ink[o + 2] * 0.11 < 90; };
  regs.forEach((r, k) => {
    for (let y = Math.max(1, r.b[1]); y <= Math.min(H - 2, r.b[3]); y++) for (let x = Math.max(1, r.b[0]); x <= Math.min(W - 2, r.b[2]); x++) {
      const i = y * W + x; if (!r.m[i] || cnt[i] !== 1 || ink[i * 4 + 3] <= 20) continue;
      if (cnt[i - 1] > 1 || cnt[i + 1] > 1 || cnt[i - W] > 1 || cnt[i + W] > 1) { own[i] = k + 1; cost[i] = 0; push(i, 0); }
    }
  });
  for (let c = 0; c < B.length; c++) {
    const L = B[c]; if (!L) continue;
    for (const i of L) {
      if (cost[i] !== c) continue; const r = regs[own[i] - 1];
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || cnt[j] < 2 || ink[j * 4 + 3] <= 20 || !r.m[j]) continue;
        const nc = c + 1 + (dark(j) ? 8 : 0); if (nc < cost[j]) { cost[j] = nc; own[j] = own[i]; push(j, nc); }
      }
    }
    B[c] = null;
  }
  for (let i = 0; i < own.length; i++) if (cnt[i] < 2) own[i] = 0;
  return own;
}
// after the split: small loose bits (a sliver of the neighbour's outline) are dropped, real pieces like 2 eyes stay
function hcDropCrumbs(d, w, h) {
  const lab = new Int32Array(w * h), sizes = [0], st = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (lab[s0] || !d[s0 * 4 + 3]) continue; const L = sizes.length; let n = 0; lab[s0] = L; st.push(s0);
    while (st.length) { const i = st.pop(); n++; const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!lab[j] && d[j * 4 + 3]) { lab[j] = L; st.push(j); } } }
    sizes.push(n);
  }
  const big = Math.max(...sizes), min = Math.max(40, 0.03 * big);
  for (let i = 0; i < w * h; i++) if (lab[i] && sizes[lab[i]] < min) d[i * 4 + 3] = 0;
}
function hcInside(r, pr) { let n = 0, k = 0; for (let y = r.b[1]; y <= r.b[3]; y += 2) for (let x = r.b[0]; x <= r.b[2]; x += 2) { const i = y * W + x; if (r.m[i]) { n++; if (pr.m[i]) k++; } } return n > 0 && k / n > 0.9; }
// which way a piece points away from its parent: from the joint to the middle of its own drawing outside the parent's loop
function hcDir(r, pr, j) {
  const m = r.m, pm = pr.m, ink = HC.ink; let sx = 0, sy = 0, n = 0, ax = 0, ay = 0, an = 0;
  for (let y = r.b[1]; y <= r.b[3]; y += 2) for (let x = r.b[0]; x <= r.b[2]; x += 2) { const i = y * W + x; if (!m[i]) continue; ax += x; ay += y; an++; if (!pm[i] && ink[i * 4 + 3] > 20) { sx += x; sy += y; n++; } }
  const cx = n > 4 ? sx / n : an ? ax / an : j.x, cy = n > 4 ? sy / n : an ? ay / an : j.y + 1, l = Math.hypot(cx - j.x, cy - j.y) || 1;
  return { x: (cx - j.x) / l, y: (cy - j.y) / l };
}
function hcParts() {   // the loops → cut-out pieces (each piece = the drawing inside its loop; overlaps split at the joint + a shared disc)
  const ids = new Map(HC.regs.map(r => [r, newId()])), parts = [], root = hcRoot();
  // every joint between two loops: child side = the way the child points, both keep a disc round the joint
  const links = HC.regs.map(r => { const pr = r === root ? null : hcParentOf(r) || root; if (!pr) return null; const j = hcJoint(r); return { c: r, p: pr, j, d: hcDir(r, pr, j), R: HC.round ? hcCapR(r, pr, j) : 0, inside: hcInside(r, pr), front: hcFront(r, pr) }; }).filter(Boolean);
  let own = null; if (HC.round) { hcHists(); own = hcOwners(); }
  // stacking: a piece sits just in front of / behind its parent (Trước/Sau), half as far at each level so a forearm stays next to its arm
  const zOf = new Map(), zz = (r, k = 0) => {
    if (zOf.has(r)) return zOf.get(r); const pr = r === root ? null : hcParentOf(r) || root, i = HC.regs.indexOf(r) * 1e-4;
    let o; if (pr && k < 30) { const q = zz(pr, k + 1); o = { z: q.z + (hcFront(r, pr) ? 1 : -1) * 0.5 / 2 ** q.d + i, d: q.d + 1 }; } else o = { z: (HC_Z[r.role] || 7) + i, d: 0 };
    zOf.set(r, o); return o;
  };
  for (const r of HC.regs) {
    const x0 = Math.max(0, r.b[0] - 2), y0 = Math.max(0, r.b[1] - 2), x1 = Math.min(W, r.b[2] + 3), y1 = Math.min(H, r.b[3] + 3), w = x1 - x0, h = y1 - y0;
    const c = makeCanvas(w, h), cx = c.getContext('2d');
    cx.save(); cx.translate(-x0, -y0); polyPath(cx, r.poly); cx.clip(); cx.drawImage(HC.src, 0, 0); cx.restore();
    const others = HC.round ? HC.regs.filter(q => q !== r && q.b[0] <= r.b[2] && q.b[2] >= r.b[0] && q.b[1] <= r.b[3] && q.b[3] >= r.b[1]) : [];
    if (others.length) {
      const ri = HC.regs.indexOf(r), id = cx.getImageData(0, 0, w, h), d = id.data, lk = new Map(others.map(q => [q, links.find(l => (l.c === r && l.p === q) || (l.c === q && l.p === r))]));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x + x0, Y = y + y0, i = Y * W + X, o = (y * w + x) * 4; if (!d[o + 3]) continue;
        for (const q of others) {
          if (!q.m[i]) continue; const l = lk.get(q);
          if (l && l.inside) continue;   // eyes / mouth lassoed inside the head: both keep their drawing
          if (l && (l.front ? l.c : l.p) === r) { const dx = X - l.j.x, dy = Y - l.j.y; if (dx * dx + dy * dy <= l.R * l.R) continue; }   // the round joint: kept by the piece in front, it covers the turn
          // pieces not joined to each other (a hand lying on the shorts), or the body and a limb / the head near their joint:
          // a colour only one of the two has (shorts vs hand) goes to that one, else the piece whose own drawing reaches it first
          // without crossing an outline (sleeve vs shirt). Between two limb pieces (elbow, knee), and farther than the round joint
          // from the body, a colour / outline edge is a sock or glove inside one piece, not the seam between two: only the side
          // of the joint decides there (else the thigh takes the shin's skin down to the sock and the knee tears when it bends)
          const sd = l ? (X - l.j.x) * l.d.x + (Y - l.j.y) * l.d.y : 0;
          if (!l || (l.p === root && Math.abs(sd) <= l.R * 1.25)) {
            const cw = hcColWin(r, q, d[o], d[o + 1], d[o + 2]);
            if (cw < 0) { d[o + 3] = 0; break; }
            if (cw > 0) continue;
            const ow = own[i] - 1;
            if (ow === ri) continue;
            if (ow >= 0 && HC.regs[ow] === q) { d[o + 3] = 0; break; }
          }
          if (l && (sd >= 0) !== (l.c === r)) { d[o + 3] = 0; break; }   // nobody reaches it: the side of the joint
        }
      }
      hcDropCrumbs(d, w, h); cx.putImageData(id, 0, 0);
    }
    const j = hcJoint(r), pr = r === root ? null : hcParentOf(r) || root;
    const kids = HC.regs.filter(q => q !== r && q !== root && (hcParentOf(q) || root) === r);
    const kid = kids.find(q => HC_PARENT[q.role] === r.role) || (kids.length === 1 ? kids[0] : null);
    let tip = kid ? hcJoint(kid) : null;
    if (!tip) { let bd = -1; for (let y = r.b[1]; y <= r.b[3]; y += 3) for (let x = r.b[0]; x <= r.b[2]; x += 3) { const i = y * W + x; if (r.m[i] && HC.ink[i * 4 + 3] > 20) { const dd = (x - j.x) ** 2 + (y - j.y) ** 2; if (dd > bd) { bd = dd; tip = { x, y }; } } } }
    parts.push({ id: ids.get(r), name: hcName(r), role: r.role === 'other' ? '' : r.role,
      parent: pr ? ids.get(pr) : null, z: zz(r).z, ox: x0, oy: y0, px: j.x, py: j.y, c, tip, hard: 1 });
  }
  return parts;
}
async function hcFinish() {
  if (!HC || !HC.regs.length) return;
  const f = HC.img ? curFrame() : HC.f; if (f !== curFrame()) { toast('Quay lại frame đang cắt để xong'); return; }
  const pm = progress('Đang tạo nhân vật…'); await new Promise(r => setTimeout(r, 30));
  try {
    histFlush(); const hb = histSnap();
    const parts = hcParts(); for (const p of parts) await encodePart(p);
    // the drawing that was cut leaves this frame (it is the character now): pixels inside the loops + vector lines mostly inside
    const ents = [], all = HC.regs, b = [W, H, 0, 0];
    for (const r of all) { b[0] = Math.min(b[0], r.b[0]); b[1] = Math.min(b[1], r.b[1]); b[2] = Math.max(b[2], r.b[2] + 1); b[3] = Math.max(b[3], r.b[3] + 1); }
    const rect = [b[0], b[1], Math.max(1, b[2] - b[0]), Math.max(1, b[3] - b[1])];
    const clear = (cv, col) => {
      if (!cv) return; const x = cv.getContext('2d'), before = x.getImageData(...rect);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; for (const r of all) { polyPath(x, r.poly); x.fill(); } x.restore();
      ents.push(pixEntry(f, rect, before, x.getImageData(...rect), col));
    };
    if (!HC.img && S.showChar) clear(f.canvas, false);
    if (!HC.img && S.showCol && f.col) { clear(f.col, true); f.colVer++; }
    if (!HC.img && S.showVec && f.vec && f.vec.length) {
      const vb = cloneVec(f.vec), inside = st => { let n = 0; for (const q of st.pts) if (all.some(r => pip(q, r.poly))) n++; return st.pts.length && n / st.pts.length >= 0.6; };
      f.vec = f.vec.filter(st => !inside(st)); if (f.vec.length !== vb.length) ents.push(vecEntry(f, vb, cloneVec(f.vec)));
    }
    ppPushChar(parts);
    const n = parts.length; HC = null; hcSync();
    ppSel = (parts.find(p => !p.parent) || parts[0]).id; ppDrag = 'bone';
    markEdited(f); ppShowAdded(); lyrSync(true); render();   // drawn once first: drawing fills the parts' alpha caches, which the snapshot sees
    const ha = histSnap(), fr = [];
    for (const [g, a] of ha.fm) { const bs = hb.fm.get(g); if (bs !== undefined && bs !== a) fr.push([g, bs, a]); }
    ents.push({ snap: { before: hb, after: ha, fr }, bytes: 2000 });
    pushEntry({ multi: ents }); histRebase();
    pm.close();
    toast(`Đã tạo nhân vật ${n} mảnh có xương. 🦴 Kéo tay/chân để xoay quanh khớp, kéo thân để dời cả người; Dòng layer để đặt keyframe`, 5500);
  } catch (e) { pm.close(); console.error(e); toast('Lỗi cắt: ' + e.message, 3000); }
}
// 📖 Mẹo cắt: which picture to pick and how to lasso, with a sample drawn in code (A-pose with loops past the joints vs arms glued)
function hcTipsDraw(cv) {
  const x = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, k = Hc / 330;
  x.fillStyle = '#fff'; x.fillRect(0, 0, Wc, Hc); x.lineCap = x.lineJoin = 'round';
  const seg = (pts, w, col) => { for (const [ww, c] of [[w + 5, '#232028'], [w, col]]) { x.strokeStyle = c; x.lineWidth = ww * k; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.stroke(); } };
  const blob = (cx, cy, rx, ry, col) => { x.beginPath(); x.ellipse(cx * k, cy * k, rx * k, ry * k, 0, 0, 7); x.fillStyle = col; x.fill(); x.lineWidth = 2.5 * k; x.strokeStyle = '#232028'; x.stroke(); };
  const loop = (a, b, r, e, col) => {   // the lasso: a capsule round the bone a→b, pushed e past both joints
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, A = [a[0] - ux * e, a[1] - uy * e], B = [b[0] + ux * e, b[1] + uy * e], an = Math.atan2(uy, ux);
    x.beginPath(); x.arc(B[0] * k, B[1] * k, r * k, an - Math.PI / 2, an + Math.PI / 2); x.arc(A[0] * k, A[1] * k, r * k, an + Math.PI / 2, an + Math.PI * 1.5); x.closePath();
    x.fillStyle = col + '30'; x.fill(); x.setLineDash([5 * k, 4 * k]); x.lineWidth = 2 * k; x.strokeStyle = col; x.stroke(); x.setLineDash([]);
  };
  const dot = (p) => { x.beginPath(); x.arc(p[0] * k, p[1] * k, 4.5 * k, 0, 7); x.fillStyle = '#ff3b9a'; x.fill(); x.lineWidth = 1.5 * k; x.strokeStyle = '#fff'; x.stroke(); };
  const man = (ox, good) => {
    const P = (a, b) => [ox + a, b], sh = good ? [[-34, 100], [34, 100]] : [[-34, 100], [34, 100]];
    const el = good ? [[-58, 140], [58, 140]] : [[-40, 142], [40, 142]], ha = good ? [[-76, 182], [76, 182]] : [[-33, 180], [33, 180]];
    const hip = [[-16, 196], [16, 196]], kn = good ? [[-26, 248], [26, 248]] : [[-9, 248], [9, 248]], an = good ? [[-32, 296], [32, 296]] : [[-8, 296], [8, 296]];
    for (const s of [0, 1]) seg([P(...hip[s]), P(...kn[s]), P(...an[s])], 15, '#f9cda0');
    for (const s of [0, 1]) blob(ox + an[s][0] + (s ? 6 : -6), 304, 13, 7, '#3c3c46');
    for (const s of [0, 1]) { seg([P(...sh[s]), P(...el[s]), P(...ha[s])], 12, '#f9cda0'); blob(ox + ha[s][0], ha[s][1] + 6, 8, 8, '#f9cda0'); seg([P(...sh[s]), [ox + (sh[s][0] * 0.6 + el[s][0] * 0.4), sh[s][1] * 0.6 + el[s][1] * 0.4]], 16, '#f07820'); }
    x.beginPath(); x.moveTo((ox - 34) * k, 94 * k); x.lineTo((ox + 34) * k, 94 * k); x.lineTo((ox + 28) * k, 170 * k); x.lineTo((ox - 28) * k, 170 * k); x.closePath(); x.fillStyle = '#f07820'; x.fill(); x.lineWidth = 2.5 * k; x.strokeStyle = '#232028'; x.stroke();
    x.beginPath(); x.rect((ox - 30) * k, 166 * k, 60 * k, 36 * k); x.fillStyle = '#3260c8'; x.fill(); x.stroke();
    blob(ox, 58, 32, 31, '#f9cda0');
    if (!good) return;
    loop(P(-34, 100), P(...el[0]), 13, 12, '#2ec4b6'); loop(P(...el[0]), P(...ha[0]), 13, 12, '#3a86ff');
    loop(P(...hip[0]), P(...kn[0]), 14, 12, '#a06cd5'); loop(P(...kn[0]), P(...an[0]), 16, 14, '#7b2cbf');
    for (const p of [sh[0], el[0], hip[0], kn[0]]) dot(P(...p));
  };
  man(Wc / k * 0.27, true); man(Wc / k * 0.75, false);
  x.font = `bold ${15 * k}px system-ui`; x.textAlign = 'center';
  x.fillStyle = '#169646'; x.fillText('✓ Nên: tay dang, chân tách', Wc * 0.27, 18 * k);
  x.fillStyle = '#d22828'; x.fillText('✗ Tránh: tay sát thân', Wc * 0.75, 18 * k);
}
function hcTips() {
  modal({ title: '📖 Mẹo chọn ảnh và cắt', buttons: [{ label: 'Đã hiểu', primary: true, value: 1 }],
    html: `<canvas id="hcTipCv" width="520" height="330" style="width:100%;max-width:520px;border-radius:10px;display:block;margin:0 auto 8px"></canvas>
<p><b>Chọn ảnh</b>: toàn thân, nền trắng trơn, viền tối rõ, quần áo khác màu da. Chính diện: tay dang ra 20–35° (có khe giữa tay và thân), khuỷu hơi cong, 2 chân tách nhau. Góc nghiêng: tay gần đưa ra trước, tay xa ra sau, không che thân; chân bước nhẹ để thấy cả 2 chân. Chỗ nào bị che, khi xoay sẽ thành lỗ.</p>
<p><b>Khoanh</b>: Thân trước (cả áo + quần), rồi Đầu (cả cổ), Tay trên, Cẳng tay, Đùi, Ống chân. Mỗi vùng bo tròn <b>quá khớp khoảng 1 bề ngang tay/chân</b>, 2 vùng kề nhau chồng đều 2 bên khớp. Tay trên lấy đủ vai, vòng qua đỉnh vai.</p>
<p><b>Trước khi Xong</b>: chấm hồng phải nằm đúng vai, khuỷu, hông, gối (kéo để chỉnh). Góc nghiêng: tay gần, đùi gần chọn ⏫ Trước. Xong thì thử kéo tay chân ở 🦴 Tạo dáng; lệch thì hoàn tác rồi khoanh lại vùng đó.</p>`,
    onOpen: ov => hcTipsDraw(ov.querySelector('#hcTipCv')) });
}
$('#hcTips').addEventListener('click', hcTips);
document.querySelectorAll('[data-hcr]').forEach(b => b.addEventListener('click', () => { if (!HC) return; HC.role = b.dataset.hcr; hcSync(); }));
$('#hcUndo').addEventListener('click', () => { if (!HC || !HC.regs.length) return; const r = HC.regs[HC.regs.length - 1]; hcRemove(r); HC.role = r.role; hcSync(); requestRender(); });
$('#hcRound').addEventListener('click', () => { if (!HC) return; HC.round = !HC.round; hcSync(); requestRender(); toast(HC.round ? '◯ Khớp tròn: chỗ chồng chia đôi tại khớp + 1 đĩa tròn chung, xoay không lộ khe, không thừa mẩu' : 'Giữ nguyên chỗ chồng ở cả 2 mảnh', 3500); });
$('#hcPar').addEventListener('change', e => { const r = HC && HC.sel; if (!r) return; const q = HC.regs[+e.target.value]; r.par = e.target.value === '' || !q ? undefined : q; r.jm = null; hcSync(); requestRender(); });
$('#hcFront').addEventListener('click', () => { const r = HC && HC.sel; if (r) { r.front = true; hcSync(); } });
$('#hcBack').addEventListener('click', () => { const r = HC && HC.sel; if (r) { r.front = false; hcSync(); } });
$('#hcDel').addEventListener('click', () => { const r = HC && HC.sel; if (r) { hcRemove(r); hcSync(); requestRender(); } });
$('#hcRegs').addEventListener('click', e => { const b = e.target.closest('[data-hci]'); if (!b || !HC) return; HC.sel = HC.regs[+b.dataset.hci] || null; hcSync(); requestRender(); });
$('#hcCancel').addEventListener('click', hcCancel);
$('#hcDone').addEventListener('click', hcFinish);
document.querySelectorAll('.hcStart').forEach(b => b.addEventListener('click', hcBegin));
document.querySelectorAll('.hcImg').forEach(b => b.addEventListener('click', hcPickImage));
