/* ========= Projects ========= */
let curProjId = null;
async function idbDel(k) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function projIndex() { try { return (await idbGet('projects')) || []; } catch (e) { return []; } }
function setCurProj(id) { curProjId = id; try { localStorage.setItem('fs-cur-proj', id); } catch (e) {} updateProjLabel(); }
function updateProjLabel() { const el = document.getElementById('projBtn'); if (el) el.textContent = '📁 ' + (S.projName || 'Dự án'); }
async function createProject(w, h, name) {
  await flushSave();
  const list = await projIndex();
  S.projName = name || `Dự án ${list.length + 1}`; S.poses = [];
  setCurProj(newId()); newProject(w, h); await saveProject();
}
async function openProject(id) {
  if (id === curProjId) return;
  if (curProjId) await flushSave(); else { clearTimeout(saveT); saveT = null; }   // no open project (sync reload): nothing to write
  const prev = curProjId, pm = progress('Đang mở dự án…');
  let ok = false, started = false;
  try {
    const p = await idbGet('project:' + id); if (!p) throw new Error('Không tìm thấy dự án');
    await resolveProjectRefs(p, id); started = true; setCurProj(id); await loadProjectData(p); S.projName = p.name || S.projName; updateProjLabel(); ok = true;
  } catch (e) { console.error(e); toast('Không mở được: ' + e.message, 3000); }
  pm.close();
  // half loaded: the screen holds a mix of 2 projects, and autosave would write it over one of them → load a whole project again
  if (!ok && started) await projRecover(prev, id);
}
async function projRecover(prev, failed) {
  clearTimeout(saveT); saveT = null; curProjId = null;
  if (prev && prev !== failed) { await openProject(prev); if (curProjId) return; }   // (a failed reopen already recovered itself)
  clearTimeout(saveT); saveT = null;
  await createProject(1080, 1920);
}
async function projectsDialog() {
  await flushSave();
  const list = (await projIndex()).sort((a, b) => b.updated - a.updated);
  const fmt = t => { const d = new Date(t); return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const rows = list.map(p => `<div class="prow ${p.id === curProjId ? 'on' : ''}" data-id="${p.id}">
    <img src="${p.thumb || ''}" alt=""><div class="pinfo"><b>${(p.name || 'Dự án').replace(/</g, '&lt;')}</b><span>${p.frames || 1} frame · ${fmt(p.updated || Date.now())}</span></div>
    <div class="pbtns"><button class="chip small" data-pa="open">Mở</button><button class="chip small" data-pa="ren">Đổi tên</button><button class="chip small" data-pa="dup">Nhân bản</button><button class="chip small" data-pa="del" style="color:var(--danger)">Xoá</button></div></div>`).join('');
  modal({ title: '📁 Dự án của bạn', html: `<div class="menu-grid" style="margin-top:0"><button class="btn primary" data-pn="916">＋ Dự án mới 9:16 (Shorts)</button><button class="btn" data-pn="169">＋ Dự án mới 16:9</button><button class="btn" data-pn="sync">☁ ${syncCfg() ? 'Đồng bộ ngay' : 'Làm tiếp trên máy khác'}</button></div><div class="plist">${rows || '<p class="lbl">Chưa có dự án</p>'}</div>`,
    buttons: [{ label: 'Đóng', value: null }], onOpen: (ov, close) => {
      ov.querySelector('.dlg').classList.add('wide');
      ov.querySelectorAll('[data-pn]').forEach(b => b.addEventListener('click', async () => { close(); if (b.dataset.pn === 'sync') { if (!syncCfg()) syncDialog(); else { await syncNow({ manual: true }); projectsDialog(); } return; } await createProject(b.dataset.pn === '916' ? 1080 : 1920, b.dataset.pn === '916' ? 1920 : 1080); toast('Đã tạo dự án mới — dự án cũ vẫn được giữ'); }));
      ov.querySelectorAll('.prow').forEach(row => row.querySelectorAll('[data-pa]').forEach(b => b.addEventListener('click', async () => {
        const id = row.dataset.id, act = b.dataset.pa, item = list.find(x => x.id === id);
        if (act === 'open') { close(); await openProject(id); }
        else if (act === 'ren') { let v = null; await modal({ title: 'Đổi tên dự án', html: `<input id="pnIn" value="${(item.name || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)">`, buttons: [{ label: 'Huỷ', value: null }, { label: 'Lưu', primary: true, action: () => { v = document.getElementById('pnIn').value.trim(); } }] });
          if (v) { if (id === curProjId) { S.projName = v.slice(0, 60); updateProjLabel(); await saveProject(); } else { const p = await idbGet('project:' + id); if (p) { p.name = v.slice(0, 60); await idbPut('project:' + id, p); } const L = await projIndex(); const it = L.find(x => x.id === id); if (it) { it.name = v.slice(0, 60); it.updated = Date.now(); await idbPut('projects', L); syncSoon(); } } close(); projectsDialog(); } }
        else if (act === 'dup') { const p = await idbGet('project:' + id); if (!p) return; const nid = newId(); p.name = (p.name || 'Dự án') + ' (bản sao)'; await copyProjectBlobs(id, nid, p); await idbPut('project:' + nid, p); const L = await projIndex(); L.push({ ...item, id: nid, name: p.name, updated: Date.now() }); await idbPut('projects', L); close(); projectsDialog(); }
        else if (act === 'del') {
          const ok = await modal({ title: `Xoá dự án "${item.name}"?`, html: `<p><b>Không hoàn tác được</b>: dự án bị xoá khỏi máy này.</p><p class="lbl">${syncCfg() ? 'Bản đã đồng bộ ☁ vẫn lấy lại được ở ☁ → 🕘 Bản cũ.' : 'Muốn giữ thì bấm Huỷ rồi mở dự án đó và ☰ Menu → Xuất ZIP trước.'}</p>`, buttons: [{ label: 'Huỷ', value: false, primary: true }, { label: 'Xoá hẳn', value: true, cls: 'danger' }] });
          if (!ok) return; await idbDel('project:' + id); try { await deleteProjectBlobs(id); } catch (e) { console.error(e); } const L = (await projIndex()).filter(x => x.id !== id); await idbPut('projects', L); await syncNoteDeleted(id);
          if (id === curProjId) { close(); if (L.length) { curProjId = null; await openProject(L.sort((a, b) => b.updated - a.updated)[0].id); } else await createProject(1080, 1920); }
          else { close(); projectsDialog(); }
        }
      })));
    } });
}
