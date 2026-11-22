/* ========= Image → vector strokes (centre-line tracing) ========= */
function chamferDT(b, w, h) {
  const d = new Float32Array(w * h), INF = 1e9, D = 1.4142;
  for (let i = 0; i < d.length; i++) d[i] = b[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) { v = Math.min(v, d[i - w] + 1); if (x > 0) v = Math.min(v, d[i - w - 1] + D); if (x < w - 1) v = Math.min(v, d[i - w + 1] + D); }
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) v = Math.min(v, 1);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + D); if (x > 0) v = Math.min(v, d[i + w - 1] + D); }
    d[i] = v;
  }
  return d;
}
function zhangSuen(b, w, h) {
  for (let x = 0; x < w; x++) { b[x] = 0; b[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { b[y * w] = 0; b[y * w + w - 1] = 0; }
  let changed = true, guard = 0; const del = [];
  while (changed && guard++ < 300) {           // Guo-Hall thinning (keeps diagonal strokes)
    changed = false;
    for (let it = 0; it < 2; it++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) { const r = y * w; for (let x = 1; x < w - 1; x++) {
        const i = r + x; if (!b[i]) continue;
        const p2 = b[i - w], p3 = b[i - w + 1], p4 = b[i + 1], p5 = b[i + w + 1], p6 = b[i + w], p7 = b[i + w - 1], p8 = b[i - 1], p9 = b[i - w - 1];
        const C = ((!p2 && (p3 || p4)) ? 1 : 0) + ((!p4 && (p5 || p6)) ? 1 : 0) + ((!p6 && (p7 || p8)) ? 1 : 0) + ((!p8 && (p9 || p2)) ? 1 : 0);
        if (C !== 1) continue;
        const N1 = ((p9 || p2) ? 1 : 0) + ((p3 || p4) ? 1 : 0) + ((p5 || p6) ? 1 : 0) + ((p7 || p8) ? 1 : 0);
        const N2 = ((p2 || p3) ? 1 : 0) + ((p4 || p5) ? 1 : 0) + ((p6 || p7) ? 1 : 0) + ((p8 || p9) ? 1 : 0);
        const N = Math.min(N1, N2); if (N < 2 || N > 3) continue;
        const m = it === 0 ? ((p6 || p7 || !p9) && p8) : ((p2 || p3 || !p5) && p4);
        if (m) continue;
        del.push(i);
      } }
      if (del.length) { changed = true; for (const i of del) b[i] = 0; }
    }
  }
  // remove staircase corner pixels so every line pixel has ≤2 neighbours
  // (non-cascading: a pixel is only removed if none of its 4-neighbours was removed in this pass)
  const gone = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!b[i]) continue;
    if (gone[i - 1] || gone[i - w] || gone[i + 1] || gone[i + w]) continue;
    const N = b[i - w], E = b[i + 1], S_ = b[i + w], Wn = b[i - 1], NE = b[i - w + 1], SE = b[i + w + 1], SW = b[i + w - 1], NW = b[i - w - 1];
    if ((N && E && !NE && !S_ && !SW && !Wn) || (E && S_ && !SE && !Wn && !NW && !N) || (S_ && Wn && !SW && !N && !NE && !E) || (Wn && N && !NW && !E && !SE && !S_)) { b[i] = 0; gone[i] = 1; }
  }
}
function traceSkeleton(sk, dt, w, h) {
  const OFF = [1, w, -1, -w, w + 1, w - 1, -w - 1, -w + 1];
  const nb = i => { const x = i % w, out = []; for (let k = 0; k < 8; k++) { const j = i + OFF[k], dx = (k === 0 || k === 4 || k === 7) ? 1 : (k === 2 || k === 5 || k === 6) ? -1 : 0; if (x + dx < 0 || x + dx >= w || j < 0 || j >= w * h) continue; if (sk[j]) out.push(j); } return out; };
  const deg = new Uint8Array(w * h), pix = [];
  for (let i = 0; i < sk.length; i++) if (sk[i]) { pix.push(i); deg[i] = nb(i).length; }
  const isNode = i => deg[i] !== 2, vis = new Uint8Array(w * h), seen = new Set(), paths = [];
  const walk = (start, next) => {
    const path = [start]; let prev = start, cur = next;
    for (let g = 0; g < 100000; g++) {
      path.push(cur); if (isNode(cur)) break; vis[cur] = 1;
      const ns = nb(cur).filter(j => j !== prev && !(vis[j] && !isNode(j)) && !(path.length > 2 && j === path[path.length - 3]));
      if (!ns.length) break; prev = cur; cur = ns[0];
      if (cur === start) { path.push(cur); break; }
    }
    return path;
  };
  for (const i of pix) if (isNode(i) && deg[i] > 0) for (const j of nb(i)) {
    if (isNode(j)) { const k = i < j ? i + ',' + j : j + ',' + i; if (!seen.has(k)) { seen.add(k); paths.push([i, j]); } continue; }
    if (vis[j]) continue; paths.push(walk(i, j));
  }
  for (const i of pix) if (deg[i] === 0 && dt[i] >= 2) paths.push([i]);
  for (const i of pix) if (!vis[i] && deg[i] === 2) { vis[i] = 1; const ns = nb(i); const p = walk(i, ns[0]); p.push(i); paths.push(p); }
  const strokes = [];
  for (const p of paths) {
    const ws = p.map(i => dt[i]).sort((a, b) => a - b), w2 = Math.max(1, ws[ws.length >> 1] * 2 - 0.5);
    if (p.length === 1) { const i = p[0]; strokes.push({ w: w2, pts: [{ x: i % w + 0.5, y: Math.floor(i / w) + 0.5 }] }); continue; }
    const endA = deg[p[0]] === 1, endB = deg[p[p.length - 1]] === 1;
    if (p.length < 4 && !(endA && endB && p.length >= 2)) continue;
    if ((endA !== endB) && p.length < w2 * 1.2 + 3) continue; // spur
    const pts = rdp(p.map(i => ({ x: i % w + 0.5, y: Math.floor(i / w) + 0.5 })), 1.1);
    strokes.push({ w: w2, pts });
  }
  return strokes;
}
function vectorizeAlpha(a, w, h, thr = 0.35) {
  const b = new Uint8Array(w * h); for (let i = 0; i < b.length; i++) b[i] = a[i] > thr ? 1 : 0;
  const dt = chamferDT(b, w, h); zhangSuen(b, w, h);
  return traceSkeleton(b, dt, w, h);
}
function placeVectors(strokes, sw, sh, color) {
  const f = curFrame(); if (!f) return;
  const k = Math.min(W * 0.9 / sw, H * 0.9 / sh), ox = (W - sw * k) / 2, oy = (H - sh * k) / 2;
  const before = cloneVec(f.vec), ids = [];
  for (const st of strokes) { const id = newId(); ids.push(id); f.vec.push({ id, c: color, w: Math.max(0.8, st.w * k), pts: st.pts.map(q => ({ x: ox + q.x * k, y: oy + q.y * k })) }); }
  pushVecUndo(f, before); markEdited(f);
  setLayer('vec'); setTool('vedit'); vsel.clear(); ids.forEach(id => vsel.add(id)); updVecBar(); requestRender();
  toast(`Đã tạo ${strokes.length} nét vector — đang chọn hết: kéo để dời, dùng Xoay/Cỡ, kéo chấm để uốn`, 4000);
}

