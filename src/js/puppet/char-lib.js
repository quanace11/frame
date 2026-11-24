/* ===== 🧍 character library: save a cut-out character once (pieces, pivots, roles, mouth/eye pictures), drop it into any project =====
   IndexedDB: "char-lib" = [{id, name, t, n, thumb: Blob}] (newest first), "char:<id>" = {w, h, parts: [{…part, png, alts: [{png, dx, dy}]}]} */
const CHAR_LIB_KEY = 'char-lib', CHAR_LIB_MAX = 60;
async function charLib() { try { return (await idbGet(CHAR_LIB_KEY)) || []; } catch (e) { return []; } }
const charBaseName = n => String(n || '').replace(/ \((NV\d+|kho)\)$/, '');
// the pieces of the character that holds part p, parents before children
function charParts(p) { const ch = ppCharOf(p); return S.pp.parts.filter(q => ppCharOf(q) === ch).sort((a, b) => a.z - b.z); }
function charThumb(parts, size = 160) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of parts) { x0 = Math.min(x0, q.ox); y0 = Math.min(y0, q.oy); x1 = Math.max(x1, q.ox + q.c.width); y1 = Math.max(y1, q.oy + q.c.height); }
  const k = Math.min(size / Math.max(1, x1 - x0), size / Math.max(1, y1 - y0)), c = makeCanvas(size, size), x = c.getContext('2d');
  x.translate((size - (x1 - x0) * k) / 2, (size - (y1 - y0) * k) / 2); x.scale(k, k); x.translate(-x0, -y0);
  for (const q of parts) x.drawImage(q.c, q.ox, q.oy);
  return c;
}
async function charLibSave() {
  const sel = ppPart(ppSel); if (!sel) { toast('Chạm chọn một mảnh của nhân vật cần lưu'); return; }
  const parts = charParts(sel), root = parts.find(q => !q.parent) || parts[0];
  let name = charBaseName(root.name); if (/^(Thân|Đầu|Hình \d+|Cả ảnh)?$/.test(name)) name = '';
  const v = await modal({ title: '💾 Lưu vào Kho nhân vật', html: `<p>Lưu <b>${parts.length} mảnh</b> (khớp, vai trò, hình mắt/miệng) để thêm vào dự án khác chỉ bằng 1 chạm.</p><label class="lbl">Tên nhân vật<br><input id="chName" maxlength="40" value="${escHtml(name || 'Nhân vật ' + ((await charLib()).length + 1))}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px"></label>`,
    buttons: [{ label: 'Huỷ', value: null }, { label: '💾 Lưu', primary: true, action: () => { name = $('#chName').value.trim() || 'Nhân vật'; } , value: true }] });
  if (!v) return;
  const ids = new Set(parts.map(q => q.id));
  for (const q of parts) { if (!q.png) await encodePart(q); for (const a of (q.alts || [])) if (!a.png) await encodeHolder(a); }
  const rec = { w: W, h: H, parts: parts.map(q => ({ ...ppPartMeta(q), name: charBaseName(q.name), parent: ids.has(q.parent) ? q.parent : null, png: q.png, alts: (q.alts || []).map(a => ({ png: a.png, dx: a.dx || 0, dy: a.dy || 0 })) })) };
  const id = 'ch' + Date.now().toString(36), thumb = await toBlob(charThumb(parts));
  try {
    await idbPut('char:' + id, rec);
    const L = await charLib(); L.unshift({ id, name, t: Date.now(), n: parts.length, thumb });
    for (const old of L.splice(CHAR_LIB_MAX)) { try { await idbDel('char:' + old.id); } catch (e) {} }
    await idbPut(CHAR_LIB_KEY, L);
  } catch (e) { console.error(e); toast('Chưa lưu được vào kho (bộ nhớ máy đầy?)'); return; }
  toast(`Đã lưu "${name}" vào 🧍 Kho nhân vật — mở dự án khác rồi bấm 🧍 Kho nhân vật để thêm`, 4000);
}
async function charLibAdd(id) {
  let rec = null; try { rec = await idbGet('char:' + id); } catch (e) {}
  if (!rec || !rec.parts || !rec.parts.length) { toast('Không đọc được nhân vật này'); return false; }
  if (playing) stopPlay();
  const pm = progress('Đang thêm nhân vật…');
  try {
    const dec = async png => { const bmp = await decodePng(png); const c = makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close(); return c; };
    // a project of another size: keep the character's size, place it at the same spot relative to the frame
    const sx = rec.w && rec.w !== W ? (W - rec.w) / 2 : 0, sy = rec.h && rec.h !== H ? (H - rec.h) : 0;
    const idMap = {}; rec.parts.forEach(q => idMap[q.id] = newId());
    const others = S.pp ? S.pp.parts.filter(q => !q.parent).length : 0, suf = others ? ` (NV${others + 1})` : '';
    const zb = S.pp && S.pp.parts.length ? Math.max(...S.pp.parts.map(q => q.z)) + 1 : 0, parts = [];
    for (const q of rec.parts) {
      const c = await dec(q.png), alts = [];
      for (const a of (q.alts || [])) { try { alts.push({ c: await dec(a.png), png: a.png, dx: a.dx || 0, dy: a.dy || 0 }); } catch (e) {} }
      parts.push({ ...q, id: idMap[q.id], parent: q.parent ? idMap[q.parent] || null : null, name: q.name + suf, z: zb + q.z * 0.01, ox: q.ox + sx, oy: q.oy + sy, px: q.px + sx, py: q.py + sy, tip: q.tip ? { x: q.tip.x + sx, y: q.tip.y + sy } : null, asset: q.asset ? JSON.parse(JSON.stringify(q.asset)) : null, c, png: q.png, alts });
    }
    ppPushChar(parts);   // like a freshly cut character: it appears from the frame being edited on
    ppSel = (parts.find(q => !q.parent) || parts[0]).id;
  } finally { pm.close(); }
  ppShowAdded();
  toast('Đã thêm nhân vật — kéo để dời, chạm mảnh để tạo dáng. Lỡ tay thì ↶ Hoàn tác', 4000);
  return true;
}
async function charLibDialog() {
  if (ppSetup) { toast('Đang cắt nhân vật — xong bước cắt rồi mở kho'); return; }
  const urls = [];
  const sel = S.pp && ppPart(ppSel);
  modal({ title: '🧍 Kho nhân vật của tôi', html: `<p style="margin-top:0">Chạm một nhân vật để thêm vào dự án này (xuất hiện từ frame đang chọn). Nhân vật lưu trên máy này, dùng được ở mọi dự án.</p>
${sel ? '<div class="mrow"><button class="btn primary" id="chSave" title="Lưu nhân vật chứa mảnh đang chọn">💾 Lưu nhân vật đang chọn</button></div>' : ''}
<div id="chList" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"></div>`, buttons: [{ label: 'Đóng', value: null }], onOpen: (ov, close) => {
    ov.querySelector('.dlg').classList.add('wide');
    const q = s => ov.querySelector(s);
    const show = async () => {
      const L = await charLib(), el = q('#chList'); el.innerHTML = '';
      if (!L.length) { el.innerHTML = '<span class="lbl" style="font-size:14px">Chưa có nhân vật nào. Cắt một nhân vật ghép, chọn một mảnh của nó rồi bấm 💾 Lưu.</span>'; return; }
      for (const e of L) {
        const d = document.createElement('div'); d.className = 'ch-item'; d.dataset.id = e.id;
        d.style.cssText = 'display:flex;flex-direction:column;gap:4px;align-items:center;width:112px';
        const u = e.thumb ? URL.createObjectURL(e.thumb) : ''; if (u) urls.push(u);
        d.innerHTML = `<button class="btn" data-a="add" title="Thêm vào dự án này" style="padding:4px;width:112px;height:120px;background:#fff;border-radius:10px"><img alt="" src="${u}" style="width:100%;height:100%;object-fit:contain"></button><div class="lbl" style="font-size:13px;text-align:center;word-break:break-word">${escHtml(e.name)} · ${e.n} mảnh</div><div style="display:flex;gap:4px"><button class="btn" data-a="ren" title="Đổi tên" style="min-width:44px">✏️</button><button class="btn" data-a="del" title="Xoá khỏi kho" style="min-width:44px;color:var(--danger)">🗑</button></div>`;
        d.querySelector('[data-a=add]').addEventListener('click', async () => { close(null); if (await charLibAdd(e.id)) await ppAskNew(ppCharOf(ppPart(ppSel))); });
        d.querySelector('[data-a=ren]').addEventListener('click', async () => {
          const L2 = await charLib(), it = L2.find(x => x.id === e.id); if (!it) return;
          ov.style.display = 'none'; let nn = null;
          await modal({ title: 'Đổi tên nhân vật', html: `<input id="chRen" maxlength="40" value="${escHtml(it.name)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px">`, buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, value: true, action: () => { nn = $('#chRen').value.trim(); } }] });
          ov.style.display = '';
          if (nn) { it.name = nn; await idbPut(CHAR_LIB_KEY, L2); show(); }
        });
        d.querySelector('[data-a=del]').addEventListener('click', async () => {
          ov.style.display = 'none';
          const ok = await modal({ title: `Xoá "${e.name}" khỏi kho?`, html: '<p>Chỉ xoá trong kho. Nhân vật đã thêm vào các dự án vẫn còn nguyên.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Xoá', value: true, cls: 'danger' }] });
          ov.style.display = '';
          if (!ok) return;
          const L2 = (await charLib()).filter(x => x.id !== e.id); await idbPut(CHAR_LIB_KEY, L2); try { await idbDel('char:' + e.id); } catch (err) {} show();
        });
        el.append(d);
      }
    };
    show();
    q('#chSave') && q('#chSave').addEventListener('click', async () => { ov.style.display = 'none'; await charLibSave(); ov.style.display = ''; show(); });
    const mo = new MutationObserver(() => { if (!ov.isConnected) { mo.disconnect(); urls.forEach(u => URL.revokeObjectURL(u)); } });
    mo.observe(document.body, { childList: true });
  } });
}
$('#ppLibBtn').addEventListener('click', charLibDialog);
$('#ppLibBtn0').addEventListener('click', charLibDialog);
