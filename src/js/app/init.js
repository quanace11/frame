/* ========= Init ========= */
async function init() {
  loadSettings(); applyBigUi();
  S.ballOpt = { obj: 'ball', n: 8, ease: 'even', size: 1, hit: true, trail: true, sound: true, tobj: 'remote', crack: true, ...(S.ballOpt || {}) }; ballWire(); ballSyncBar();
  S.size = clamp(Math.round(S.size) || 8, 1, SIZE_MAX);
  if (!S.brushOp || typeof S.brushOp !== 'object') S.brushOp = {};
  if (S.opacity < 1 && !Object.keys(S.brushOp).length) S.brushOp[BRUSHES[S.brush] ? S.brush : 'pen'] = S.opacity;   // old single setting
  syncSizeOp();
  setColor(S.color); renderRecentSw(); updateToggles(); setTool('brush'); setLayer(S.lineLayer === 'vec' ? 'vec' : 'char');
  if (S.atlOpen) atlShow(true);
  tlScaleSet(S.tlScale || 1); setTimeout(tlCap, 300);
  if (S.tlCollapsed) { $('#tl').classList.add('collapsed'); $('#tlCollapse').textContent = '▴ Hiện dòng frame'; }
  setUiHide('rail', S.uiHide.rail, true);
  new ResizeObserver(() => resizeView()).observe(stage);
  window.addEventListener('orientationchange', () => setTimeout(resizeView, 250));
  let p = null, list = [];
  try {
    list = await projIndex();
    if (!list.length) { const legacy = await idbGet('project'); if (legacy && legacy.frames && legacy.frames.length) { const id = newId(); legacy.name = legacy.name || 'Dự án 1'; await idbPut('project:' + id, legacy); list = [{ id, name: legacy.name, updated: Date.now(), frames: legacy.frames.length }]; await idbPut('projects', list); await idbDel('project'); } }
    let id = null; try { id = localStorage.getItem('fs-cur-proj'); } catch (e) {}
    if (!list.find(x => x.id === id)) id = list.length ? list.sort((a, b) => b.updated - a.updated)[0].id : null;
    if (id) { p = await idbGet('project:' + id); if (p) { await resolveProjectRefs(p, id); setCurProj(id); } }
  } catch (e) { storageOk = false; }
  if (p && p.frames && p.frames.length) { try { await loadProjectData(p); } catch (e) { console.error(e); S.projName = 'Dự án 1'; setCurProj(newId()); newProject(1080, 1920); } }
  else { S.projName = 'Dự án 1'; setCurProj(newId()); newProject(1080, 1920); }
  updateProjLabel();
  setSaveState();
  $('#syncState').addEventListener('click', syncDialog);
  if (syncCfg()) { setSyncState('☁'); if (syncAuto()) setTimeout(() => syncNow({ quiet: true, startup: true }), 300); }   // open / F5 → fetch the newest version first
  let seen = false; try { seen = localStorage.getItem('fs-help') === '1'; localStorage.setItem('fs-help', '1'); } catch (e) {}
  if (!seen) modal({ title: 'Chào mừng đến Frame Studio 👋', html: '<p>Làm hoạt hình Shorts từ ảnh nhân vật (vd. ảnh AI tạo) — không cần biết vẽ.</p><p>Bấm <b>🚀 Làm video nhanh</b> để được hướng dẫn từng bước, hoặc tự vẽ tay như một app vẽ frame bình thường.</p>', buttons: [{ label: 'Bắt đầu vẽ', value: 'draw' }, { label: '🚀 Làm video nhanh', value: 'wiz', primary: true }] }).then(v => { if (v === 'wiz') wizard(); });
}
fontsReady().then(() => requestRender());   // comic text drawn before the embedded font was ready gets redrawn
