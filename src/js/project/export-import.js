/* ========= Export / import ========= */
let downloadsApi = null;
(async () => { try { if (window.claude && window.claude.use) downloadsApi = await window.claude.use('downloads'); } catch (e) { downloadsApi = null; } })();
async function deliverFile(blob, filename) {
  if (downloadsApi) {
    try { await downloadsApi.save({ filename, data: blob }); toast('Đã lưu ' + filename); return true; }
    catch (err) {
      const code = err && err.code;
      if (code === 'declined') { toast('Đã huỷ lưu'); return false; }
      if (code === 'rate_limited') { toast('Đang có hộp thoại lưu khác — thử lại sau'); return false; }
      if (code === 'too_large') { toast('File quá lớn để lưu tại đây'); return false; }
    }
  }
  try {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
      await navigator.share({ files: [file], title: filename }); return true;
    }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    return true;
  } catch (e) { toast('Trình duyệt này chặn tải file'); return false; }
}
function stamp() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; }
async function exportZip() {
  if (playing) stopPlay(); if (stroke) strokeEnd(); commitFloating();
  const pm = progress('Đang chuẩn bị…');
  try {
    const files = [];
    const blankBuf = new Uint8Array(await (await toBlob(makeCanvas())).arrayBuffer());
    const bgOrder = [];
    S.frames.forEach(f => { if (!bgOrder.includes(f.bgId)) bgOrder.push(f.bgId); });
    const bgFile = new Map();
    for (let i = 0; i < bgOrder.length; i++) {
      const b = S.bgs.find(x => x.id === bgOrder[i]); await ensureLoaded(b); await ensurePng(b);
      const name = `layers/bg_${String(i + 1).padStart(2, '0')}.png`; bgFile.set(b.id, name);
      files.push({ name, data: b.png ? new Uint8Array(b.png) : blankBuf });
    }
    const comp = makeCanvas(), cx = comp.getContext('2d');
    const meta = [];
    for (let i = 0; i < S.frames.length; i++) {
      pm.set(`Frame ${i + 1}/${S.frames.length}`);
      const f = S.frames[i], b = bgOf(f), n = String(i + 1).padStart(3, '0');
      await ensureLoaded(f); await ensurePng(f);
      cx.globalCompositeOperation = 'source-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
      if (b && b.canvas) cx.drawImage(b.canvas, 0, 0);
      if (f.col) cx.drawImage(f.col, 0, 0);
      if (f.canvas) cx.drawImage(f.canvas, 0, 0);
      if (S.pp && S.showPP) drawPuppet(cx, f.pp, f.lip);
      drawVec(cx, f.vec); if (f.texts && f.texts.length) drawTexts(cx, f, null);
      const compBuf = new Uint8Array(await (await toBlob(comp)).arrayBuffer());
      files.push({ name: `frames/frame_${n}.png`, data: compBuf });
      files.push({ name: `layers/char_${n}.png`, data: f.png ? new Uint8Array(f.png) : blankBuf });
      let colorName = null;
      if (f.colPng) { colorName = `layers/color_${n}.png`; files.push({ name: colorName, data: new Uint8Array(f.colPng) }); }
      let linesName = null;
      if (f.vec.length) {
        cx.clearRect(0, 0, W, H); drawVec(cx, f.vec);
        linesName = `layers/lines_${n}.png`;
        files.push({ name: linesName, data: new Uint8Array(await (await toBlob(comp)).arrayBuffer()) });
      }
      meta.push({ index: i + 1, file: `frames/frame_${n}.png`, char_layer: `layers/char_${n}.png`, color_layer: colorName, lines_layer: linesName, bg_layer: bgFile.get(f.bgId), duration_ms: f.dur,
        pp: f.pp || {}, ppKey: f.ppKey, ppEase: f.ppEase, texts: f.texts || [], camera: camAt(i), cam_key: f.cam || null, shake: f.shake || 0, flash: !!f.flash, lip: f.lip || null, scene: f.scene || null, tr: f.tr || null, tre: f.tre || null, ghost: f.ghost || null, bgs: f.bgs || null, sl: f.sl || null, flt: f.flt || null,
        vector: f.vec.map(st => ({ c: st.c, w: +st.w.toFixed(2), a: st.a, pts: st.pts.map(q => [+q.x.toFixed(1), +q.y.toFixed(1)]) })) });
    }
    comp.width = 0;
    const total = S.frames.reduce((a, f) => a + f.dur, 0);
    let ppMeta = null;
    if (S.pp && S.pp.parts.length) {
      ppMeta = { parts: [] };
      for (const pt of S.pp.parts) {
        const name = `puppet/part_${pt.id}.png`; files.push({ name, data: new Uint8Array(pt.png) });
        const alts = (pt.alts || []).map((a, k) => { const an = `puppet/part_${pt.id}_v${k + 1}.png`; files.push({ name: an, data: new Uint8Array(a.png) }); return { file: an, dx: a.dx || 0, dy: a.dy || 0 }; });
        ppMeta.parts.push({ id: pt.id, name: pt.name, role: pt.role, parent: pt.parent, z: pt.z, ox: pt.ox, oy: pt.oy, px: pt.px, py: pt.py, tip: pt.tip || null, asset: pt.asset || null, file: name, alts });
      }
    }
    const timing = { app: 'frame-studio', version: 1, width: W, height: H, total_ms: total, frames: meta, backgrounds: bgOrder.map(id => bgFile.get(id)), puppet: ppMeta };
    const enc = new TextEncoder();
    files.unshift({ name: 'timing.json', data: enc.encode(JSON.stringify(timing, null, 2)) });
    files.push({ name: 'README.txt', data: enc.encode(
`Frame Studio export
frames/   : từng frame đã ghép (nền trắng + nền + nhân vật + nét), ${W}x${H}
layers/   : lớp nền (bg_XX), lớp nhân vật trong suốt (char_XXX), lớp màu tô dưới nét (color_XXX), lớp nét vector đã vẽ ra (lines_XXX)
timing.json : thứ tự frame và thời lượng mỗi frame (duration_ms)
Mở lại trong Frame Studio: Menu > Mở dự án từ ZIP.
`) });
    pm.set('Đang đóng gói ZIP…');
    const blob = makeZip(files);
    pm.close();
    const mb = (blob.size / 1048576).toFixed(1);
    await modal({ title: 'Xuất xong', html: `<p>${S.frames.length} frame · ${(total / 1000).toFixed(1)} giây · ${mb} MB</p><p>Gửi file ZIP này cho Claude để dựng thành video (thêm nhạc, chữ, rung/zoom).</p>`,
      buttons: [{ label: 'Đóng', value: null }, { label: 'Lưu file ZIP', primary: true, action: async () => { await deliverFile(blob, `frame-studio-${stamp()}.zip`); } }] });
  } catch (e) { pm.close(); console.error(e); toast('Lỗi khi xuất: ' + e.message, 3500); }
}
async function importZip(file) {
  const pm = progress('Đang đọc ZIP…');
  try {
    const z = await readZip(file);
    const tj = z.get('timing.json'); if (!tj) throw new Error('ZIP không có timing.json của Frame Studio');
    const t = JSON.parse(new TextDecoder().decode(tj));
    if (t.app !== 'frame-studio') throw new Error('ZIP không phải dự án Frame Studio');
    const bgs = [], bgIdByFile = new Map();
    for (const name of t.backgrounds) { const id = newId(); bgIdByFile.set(name, id); const d = z.get(name); bgs.push({ id, png: d ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : null }); }
    const frames = t.frames.map(fr => {
      const d = z.get(fr.char_layer);
      let bgId = bgIdByFile.get(fr.bg_layer);
      if (!bgId) { bgId = newId(); bgs.push({ id: bgId, png: null }); }
      const vec = (fr.vector || []).map(st => ({ id: newId(), c: st.c, w: st.w, a: st.a, pts: st.pts.map(([x, y]) => ({ x, y })) }));
      const dc = fr.color_layer && z.get(fr.color_layer);
      return { id: newId(), dur: fr.duration_ms || 100, bgId, vec, col: dc ? dc.buffer.slice(dc.byteOffset, dc.byteOffset + dc.byteLength) : null, pp: fr.pp || {}, ppKey: fr.ppKey, ppEase: fr.ppEase, texts: fr.texts || [], cam: fr.cam_key || null, shake: fr.shake || 0, flash: !!fr.flash, lip: fr.lip || null, scene: fr.scene || undefined, tr: fr.tr || undefined, tre: fr.tre || undefined, ghost: fr.ghost || undefined, bgs: fr.bgs || undefined, sl: fr.sl || undefined, flt: fr.flt || undefined, png: d ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : null };
    });
    if (!frames.length) throw new Error('ZIP không có frame nào');
    pm.set('Đang mở…');
    let ppData = null;
    const zbuf = f2 => { const d = z.get(f2); return d ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : null; };
    if (t.puppet && t.puppet.parts) ppData = { parts: t.puppet.parts.map(q => ({ ...q, png: zbuf(q.file), alts: (q.alts || []).map(a => ({ png: zbuf(a.file), dx: a.dx, dy: a.dy })).filter(a => a.png) })).filter(q => q.png) };
    await loadProjectData({ W: t.width, H: t.height, cur: 0, bgs, frames, pp: ppData });
    S.frames.forEach(f => f.pngVer = 0); S.bgs.forEach(b => b.pngVer = 0);
    pm.close(); toast('Đã mở dự án'); scheduleSave();
  } catch (e) { pm.close(); console.error(e); toast('Không mở được: ' + e.message, 3500); }
}
$('#imgFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let bmp;
  try { bmp = await createImageBitmap(f); } catch (err) { toast('Không đọc được ảnh'); return; }
  openImport(bmp);
});
$('#importBtn').addEventListener('click', () => { if (playing) stopPlay(); $('#imgFile').click(); });

