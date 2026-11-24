/* ========= ☁ Sync projects between devices (tablet ↔ laptop) through the user's own PRIVATE GitHub repo =========
   No server: the app talks to the GitHub git API with a fine-grained token that lives ONLY in this browser's localStorage
   (never in a project, ZIP or the repo). Remote layout (one commit per sync run):
     index.json            { v:1, projects:[{id, name, updated, frames, thumb, del?}] }
     p/<id>/rec.json       the IndexedDB project record; binaries replaced by {$b:<git sha>}, blob refs by {$r:name,$v:...}
     p/<id>/b/<git sha>    each binary (frame PNGs, audio...) once, named by its git sha → unchanged pictures are never re-uploaded
   Each device remembers what it last saw (IDB 'sync-state'): changed only here → push, only there → pull,
   both → keep both (the other device's version comes in as a copy "(từ máy khác)"). */
const SYNC_TOK_LS = 'fs-sync-gh-token', SYNC_REPO_LS = 'fs-sync-gh-repo', SYNC_AUTO_LS = 'fs-sync-auto', SYNC_API = 'https://api.github.com';
const syncCfg = () => { const tok = lsGet(SYNC_TOK_LS).trim(), repo = lsGet(SYNC_REPO_LS).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, ''); return tok && /^[\w.-]+\/[\w.-]+$/.test(repo) ? { tok, repo } : null; };
const syncAuto = () => lsGet(SYNC_AUTO_LS) !== 'off';
let syncBusy = null, syncAgain = false, syncLast = 0, syncT = null, syncMsg = '';
let syncHeadSeen = null, syncEtag = '';   // the remote commit this device last synced to (the live check compares with it)
const SYNC_AFTER_SAVE = 5000, SYNC_POLL_MS = 8000;
function setSyncState(t, title) {
  const el = document.getElementById('syncState'); if (!el) return; el.hidden = !syncCfg(); el.textContent = t; el.title = title || 'Đồng bộ giữa các máy (bấm để xem)';
  const m = document.getElementById('syMsg'); if (m && syncCfg() && title) m.textContent = (t.includes('⚠') ? '⚠ ' : t.includes('✓') ? '✓ ' : '☁ ') + title;   // the open ☁ dialog shows the progress too
}
function syncErr(status, j) {
  const m = j && j.message || '';
  if (status === 401) return 'Token sai hoặc đã hết hạn. Tạo token mới rồi dán lại.';
  if (status === 403 && /rate limit/i.test(m)) return 'GitHub đang giới hạn số lần gọi. Thử lại sau ít phút.';
  if (status === 403) return 'Token chưa có quyền ghi. Khi tạo token, chọn Contents: Read and write cho repo này.';
  if (status === 404) return 'Không thấy repo. Kiểm tra tên repo, và token đã được chọn cho đúng repo này chưa.';
  return 'GitHub báo lỗi ' + status + (m ? ': ' + m : '');
}
// GitHub allows only ~80 "content" writes (blob/tree/commit) a minute: pace the writes, and when GitHub says "slow down"
// wait and go on instead of failing (a big first upload used to fail half way and nothing reached the other device)
let ghLastWrite = 0;
const ghWait = (ms, why) => { if (why) setSyncState('☁ ⏳', why); return new Promise(r => setTimeout(r, ms)); };
async function gh(cfg, path, { method = 'GET', body, raw } = {}) {
  for (let attempt = 0; ; attempt++) {
    if (method !== 'GET') { const w = ghLastWrite + GH_PACE - Date.now(); if (w > 0) await ghWait(w); ghLastWrite = Date.now(); }
    let r;
    try { r = await fetch(SYNC_API + '/repos/' + cfg.repo + path, { method, cache: 'no-store', headers: { Authorization: 'Bearer ' + cfg.tok, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { const er = new Error('Không kết nối được GitHub (đang offline?)'); er.offline = true; throw er; }
    if (!r.ok) {
      let j = null; try { j = await r.json(); } catch (e) {}
      const m = j && j.message || '', ra = +(r.headers.get('retry-after') || 0), left = r.headers.get('x-ratelimit-remaining'), reset = +(r.headers.get('x-ratelimit-reset') || 0) * 1000;
      if ((r.status === 403 || r.status === 429) && (/rate limit/i.test(m) || ra || left === '0') && attempt < 8) {
        const ms = ra ? ra * 1000 : left === '0' && reset ? reset - Date.now() + 1000 : 60000;
        if (ms <= 6 * 60000) { await ghWait(Math.max(1000, ms), 'GitHub bảo chờ một chút, sẽ tự gửi tiếp…'); continue; }
      }
      const er = new Error(syncErr(r.status, j)); er.status = r.status; er.ghMsg = m; throw er;
    }
    if (raw) { const j = await r.json(), b = atob(String(j.content || '').replace(/\s+/g, '')), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); return u8; }
    return r.status === 204 ? null : r.json();
  }
}
let GH_PACE = 800;
// blobs this device already put in the repo (by git sha): a sync cut off half way does not upload them again
let syncKnown = null;
async function syncKnownGet(repo) { if (!syncKnown || syncKnown.repo !== repo) { let k = null; try { k = await idbGet('sync-known'); } catch (e) {} syncKnown = k && k.repo === repo ? { repo, set: new Set(k.shas) } : { repo, set: new Set() }; } return syncKnown.set; }
async function syncKnownSave() { if (syncKnown) try { await idbPut('sync-known', { repo: syncKnown.repo, shas: [...syncKnown.set].slice(-20000) }); } catch (e) {} }
const u8b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const strU8 = s => new TextEncoder().encode(s);
async function gitSha(u8) { const h = strU8('blob ' + u8.length + '\0'), all = new Uint8Array(h.length + u8.length); all.set(h); all.set(u8, h.length); return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map(b => b.toString(16).padStart(2, '0')).join(''); }
const asU8 = v => v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
// project record → JSON-safe tree + the binaries it needs (sha → bytes)
async function syncEncode(rec, pid) {
  const files = new Map(), pre = blobPrefix(pid);
  const bin = async (u8, t, extra) => { const sha = await gitSha(u8); files.set(sha, u8); return { $b: sha, $t: t, ...extra }; };
  const walk = async v => {
    if (v == null || typeof v !== 'object') return v;
    if (v instanceof ArrayBuffer) return bin(asU8(v), 'ab');
    if (ArrayBuffer.isView(v)) return bin(new Uint8Array(asU8(v)), v.constructor.name);
    if (typeof Blob !== 'undefined' && v instanceof Blob) return bin(new Uint8Array(await v.arrayBuffer()), 'blob', { $m: v.type });
    if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await walk(x)); return o; }
    if (typeof v.ref === 'string' && v.ref.startsWith(pre) && Object.keys(v).length === 1) { const b = await idbGet(v.ref); return b ? { $r: v.ref.slice(pre.length), $v: await walk(b) } : null; }
    const o = {}; for (const k of Object.keys(v)) o[k] = await walk(v[k]); return o;
  };
  return { json: await walk(rec), files };
}
async function syncDecode(j, pid, getBin) {
  const blobs = [], pre = blobPrefix(pid);
  const walk = async v => {
    if (v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await walk(x)); return o; }
    if (typeof v.$b === 'string') {
      const u8 = await getBin(v.$b);
      if (v.$t === 'ab') return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      if (v.$t === 'blob') return new Blob([u8], { type: v.$m || '' });
      const C = self[v.$t]; return C && C.BYTES_PER_ELEMENT ? new C(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)) : u8;
    }
    if (typeof v.$r === 'string') { const key = pre + v.$r; blobs.push([key, await walk(v.$v)]); return { ref: key }; }
    const o = {}; for (const k of Object.keys(v)) o[k] = await walk(v[k]); return o;
  };
  return { rec: await walk(j), blobs };
}
async function syncWriteLocal(pid, rec, blobs, item) {
  const db = await idbOpen();
  await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv'); st.delete(blobRange(pid)); for (const [k, v] of blobs) st.put(v, k); st.put(rec, 'project:' + pid); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort')); });
  const L = await projIndex(), it = L.find(x => x.id === pid), row = { id: pid, name: item.name, updated: item.updated, frames: item.frames, thumb: item.thumb || '' };
  if (it) Object.assign(it, row); else L.push(row); await idbPut('projects', L);
}
async function syncState() { try { const s = await idbGet('sync-state'); if (s && s.items) return s; } catch (e) {} return { repo: '', items: {}, dels: [] }; }
async function syncNoteDeleted(id) { if (!syncCfg()) return; const s = await syncState(); if (s.items[id] && !s.dels.includes(id)) { s.dels.push(id); await idbPut('sync-state', s); } syncSoon(); }
function syncSoon(ms = 8000) { clearTimeout(syncT); if (syncCfg() && syncAuto()) syncT = setTimeout(() => syncNow({ quiet: true }), ms); }
function syncNow(opt = {}) {
  if (!syncCfg()) return Promise.resolve(null);
  if (syncBusy) { syncAgain = true; return syncBusy; }
  syncBusy = (async () => { let r = null; try { r = await syncRun(opt); } finally { syncBusy = null; } if (syncAgain) { syncAgain = false; syncSoon(1500); } return r; })();
  return syncBusy;
}
async function syncRun(opt) {
  const cfg = syncCfg(); clearTimeout(syncT); syncT = null;
  if (stroke || playing || floating) { syncSoon(5000); return null; }
  await flushSave();
  setSyncState('☁ …', opt.startup ? 'Đang lấy bản mới nhất…' : 'Đang đồng bộ…');
  // joining with a session code on a fresh device: the untouched blank project would only clutter the other device's list
  if (opt.join) {
    const L = await projIndex(), st = await syncState();
    if (L.length === 1 && L[0].id === curProjId && !st.items[curProjId] && S.frames.length === 1 && vfBlank(S.frames[0]) && !hasAudio()) { const id = curProjId; await idbDel('project:' + id); try { await deleteProjectBlobs(id); } catch (e) {} await idbPut('projects', []); curProjId = null; }
  }
  const out = { pushed: 0, pulled: 0, copies: 0, deleted: 0, reloaded: false };
  try {
    for (let attempt = 0; ; attempt++) {
      try { await syncOnce(cfg, out, opt); break; }
      catch (e) { if (e.status === 422 && /fast.?forward|reference/i.test(e.ghMsg || '') && attempt < 3) continue; throw e; }   // another device committed meanwhile → redo on top of it
    }
    // "làm tiếp": after joining, or on open / F5, show the work the other device did last (not this device's older project)
    if ((opt.join || opt.startup) && out.pulledIds && out.pulledIds.length) {
      const L2 = await projIndex(), got = L2.filter(x => out.pulledIds.includes(x.id)).sort((a, b) => b.updated - a.updated)[0], cur = L2.find(x => x.id === curProjId);
      if (got && got.id !== curProjId && (opt.join || !cur || got.updated > cur.updated) && !saveT && !stroke && !floating) { await openProject(got.id); out.reloaded = true; }
    }
    syncLast = Date.now(); syncMsg = '';
    if (out.deferred) syncSoon(4000);   // the open project could not be replaced just now (a dialog was open…): try again soon
    const t = new Date(syncLast).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setSyncState('☁ ✓', 'Đã đồng bộ lúc ' + t);
    if (opt.join) toast(out.pulled ? `☁ Đã mở bài từ máy kia (${out.pulled} dự án). Làm tiếp thôi!` : '☁ Đã kết nối. Bài trên máy này sẽ tự lưu lên mạng.', 3500);
    else if (out.reloaded) toast('☁ Đã lấy bản mới nhất từ máy khác', 2600);
    else if (out.copyOpen) syncConflictDialog(out.copyOpen);
    else if (out.copies) toast(`☁ Hai máy cùng sửa 1 dự án: đã giữ cả 2 bản (bản kia tên "… (từ máy khác)")`, 4200);
    else if (!opt.quiet) toast(out.pushed || out.pulled || out.deleted ? `☁ Đồng bộ xong: gửi ${out.pushed}, nhận ${out.pulled} dự án` : '☁ Đã đồng bộ, không có gì mới');
    return out;
  } catch (e) {
    console.error(e); syncMsg = e.message;
    setSyncState(e.offline ? '☁ ⏸' : '☁ ⚠', (e.offline ? 'Chưa đồng bộ được: ' : 'Lỗi đồng bộ: ') + e.message);
    if (!opt.quiet || (!e.offline && !syncWarned)) { syncWarned = true; toast('☁ ' + e.message, 4000); }
    if (e.offline) syncSoon(60000);
    return null;
  }
}
let syncWarned = false;
/* --- 👀 live check: while the app is on screen, ask GitHub every few seconds whether the other device saved something
   (one small request; with the ETag GitHub answers "304 nothing new", which does not count against the hourly limit).
   Something new → a normal sync pulls it, so a tablet left open gets the PC's work without F5. --- */
async function syncPoll() {
  const cfg = syncCfg();
  if (!cfg || !syncAuto() || document.hidden || syncBusy || syncHeadSeen == null || navigator.onLine === false) return;
  let sha = null;
  try {
    const r = await fetch(SYNC_API + '/repos/' + cfg.repo + '/git/ref/heads/main', { cache: 'no-store', headers: { Authorization: 'Bearer ' + cfg.tok, Accept: 'application/vnd.github+json', ...(syncEtag ? { 'If-None-Match': syncEtag } : {}) } });
    if (r.status === 304 || !r.ok) return;
    syncEtag = r.headers.get('etag') || ''; sha = ((await r.json()).object || {}).sha;
  } catch (e) { return; }
  if (sha && sha !== syncHeadSeen && !syncBusy) { syncEtag = '';   // compare afresh next time, even if this sync fails
    setSyncState('☁ ↓', 'Máy khác vừa lưu — đang lấy bản mới…'); syncNow({ quiet: true, live: true }); }
}
setInterval(syncPoll, SYNC_POLL_MS);
// leaving this window (e.g. picking up the tablet after working on the PC): send what is not sent yet right away
window.addEventListener('blur', () => { if (syncCfg() && syncAuto() && (saveT || syncT)) syncNow({ quiet: true }); });
// both devices changed the open project before they could sync: both versions are kept — say which is which, offer to switch
function syncConflictDialog(c) {
  modal({ title: '☁ Hai máy cùng sửa dự án này', html: `<p>Máy khác đã lưu dự án này trong lúc máy này cũng đang sửa, nên app <b>giữ cả 2 bản</b>, không mất gì:</p>
    <ul style="margin:6px 0 10px 18px;padding:0;line-height:1.6"><li><b>Bản đang mở</b> (máy này): ${c.mine || '?'} frame</li><li><b>${escHtml(c.name)}</b> (máy kia): ${c.frames || '?'} frame</li></ul>
    <p class="lbl">Mẹo: để không bị 2 bản, đợi biểu tượng ☁ ✓ trên máy kia rồi mới vẽ ở máy này (app tự lấy bản mới sau vài giây).</p>`,
    buttons: [{ label: 'Ở lại bản này', value: false }, { label: 'Mở bản từ máy kia', value: true, primary: true }] })
    .then(v => { if (v) openProject(c.id); });
}
async function syncOnce(cfg, out, opt) {
  // 1. where the remote is now
  let head = null;
  try { head = (await gh(cfg, '/git/ref/heads/main')).object.sha; }
  catch (e) {
    if (e.status !== 409 && e.status !== 404) throw e;
    if (e.status === 404) await gh(cfg, '');          // 404 on the repo itself → clear "repo not found" error
    // empty repo: the first file has to go through the contents API, which also creates the branch
    await gh(cfg, '/contents/index.json', { method: 'PUT', body: { message: 'Frame Studio: bắt đầu đồng bộ', content: btoa('{"v":1,"projects":[]}'), branch: 'main' } });
    head = (await gh(cfg, '/git/ref/heads/main')).object.sha;
  }
  let treeSha = (await gh(cfg, '/git/commits/' + head)).tree.sha;
  const tree = await gh(cfg, '/git/trees/' + treeSha + '?recursive=1');
  const paths = new Map(); for (const t of tree.tree || []) if (t.type === 'blob') paths.set(t.path, t.sha);
  const readJson = async p => paths.has(p) ? JSON.parse(new TextDecoder().decode(await gh(cfg, '/git/blobs/' + paths.get(p), { raw: true }))) : null;
  const rIndex = (await readJson('index.json')) || { v: 1, projects: [] };
  const R = new Map(rIndex.projects.map(x => [x.id, x]));
  const st = await syncState(); if (st.repo !== cfg.repo) { st.repo = cfg.repo; st.items = {}; st.dels = []; }
  const local = await projIndex(), Lm = new Map(local.map(x => [x.id, x]));
  st.dels = st.dels.filter(id => !Lm.has(id));
  let edits = [], newItems = new Map(); const newState = {};
  const known = await syncKnownGet(cfg.repo); for (const [p, sha] of paths) if (p.includes('/b/')) known.add(sha);
  const upBlob = async (u8, sha) => { if (known.has(sha)) return; await gh(cfg, '/git/blobs', { method: 'POST', body: { content: u8b64(u8), encoding: 'base64' } }); known.add(sha); if (known.size % 10 === 0) syncKnownSave(); };
  let rIdx = rIndex.projects, idxSha0 = paths.get('index.json');
  // one commit with what is ready; refused if another device moved main meanwhile (→ the caller redoes the sync)
  const flush = async () => {
    const projects = rIdx.filter(x => !newItems.has(x.id)).concat([...newItems.values()]);
    const idxU8 = strU8(JSON.stringify({ v: 1, projects })), idxSha = await gitSha(idxU8);
    if (!edits.length && idxSha === idxSha0) return;
    await upBlob(idxU8, idxSha);
    edits.push({ path: 'index.json', mode: '100644', type: 'blob', sha: idxSha });
    const nt = await gh(cfg, '/git/trees', { method: 'POST', body: { base_tree: treeSha, tree: edits } });
    const cm = await gh(cfg, '/git/commits', { method: 'POST', body: { message: `Frame Studio: đồng bộ ${out.pushed} dự án`, tree: nt.sha, parents: [head] } });
    await gh(cfg, '/git/refs/heads/main', { method: 'PATCH', body: { sha: cm.sha, force: false } });
    syncKnownSave();
    for (const e of edits) { if (e.sha) paths.set(e.path, e.sha); else paths.delete(e.path); }
    head = cm.sha; treeSha = nt.sha; rIdx = projects; idxSha0 = idxSha; edits = []; newItems = new Map();
  };
  // 2. pull = copy one remote project into this device (as the same id, or as a copy with a new id)
  const pull = async (rit, asId, name) => {
    const recSha = paths.get(`p/${rit.id}/rec.json`); if (!recSha) return false;
    const j = JSON.parse(new TextDecoder().decode(await gh(cfg, '/git/blobs/' + recSha, { raw: true })));
    const cache = new Map(), getBin = async sha => { if (!cache.has(sha)) cache.set(sha, await gh(cfg, '/git/blobs/' + sha, { raw: true })); return cache.get(sha); };
    const { rec, blobs } = await syncDecode(j, asId, getBin);
    if (name) rec.name = name;
    if (asId === curProjId) {   // the open project: only replace it when nothing was touched since this sync started
      const now = (await projIndex()).find(x => x.id === asId);
      if (saveT || saving || stroke || floating || (now && Lm.get(asId) && now.updated !== Lm.get(asId).updated) || (!opt.manual && !opt.startup && document.querySelector('.ov'))) { out.deferred = true; return false; }
    }
    await syncWriteLocal(asId, rec, blobs, { ...rit, name: rec.name || rit.name, updated: name ? Date.now() : rit.updated });
    (out.pulledIds = out.pulledIds || []).push(asId);
    if (asId === curProjId) { curProjId = null; await openProject(asId); out.reloaded = true; }
    out.pulled++; return true;
  };
  // 3. push = put one local project into the next commit
  const push = async it => {
    const rec = await idbGet('project:' + it.id); if (!rec) return;
    const { json, files } = await syncEncode(rec, it.id), dir = `p/${it.id}/`;
    const recU8 = strU8(JSON.stringify(json)), recSha = await gitSha(recU8);
    const want = new Set(), n0 = edits.length;
    let k = 0;
    for (const [sha, u8] of files) { k++; const p = dir + 'b/' + sha; want.add(p); if (paths.get(p) !== sha) { if (!known.has(sha)) setSyncState(`☁ ↑${k}/${files.size}`, `Đang gửi "${it.name}": ${k}/${files.size} hình`); await upBlob(u8, sha); edits.push({ path: p, mode: '100644', type: 'blob', sha }); } }
    if (paths.get(dir + 'rec.json') !== recSha) { await upBlob(recU8, recSha); edits.push({ path: dir + 'rec.json', mode: '100644', type: 'blob', sha: recSha }); }
    for (const p of paths.keys()) if (p.startsWith(dir + 'b/') && !want.has(p)) edits.push({ path: p, mode: '100644', type: 'blob', sha: null });
    const r = R.get(it.id);
    if (edits.length === n0 && r && !r.del && r.name === it.name) return r.updated;   // same content already there: leave the remote as it is
    newItems.set(it.id, { id: it.id, name: it.name, updated: it.updated, frames: it.frames, thumb: it.thumb || '' });
    out.pushed++; await flush(); return it.updated;   // commit each project as soon as it is up, so the other device gets it even if a later one fails
  };
  const drop = id => { for (const p of paths.keys()) if (p.startsWith(`p/${id}/`)) edits.push({ path: p, mode: '100644', type: 'blob', sha: null }); };
  const ids = new Set([...Lm.keys(), ...R.keys(), ...st.dels]);
  let n = 0;
  for (const id of ids) {
    setSyncState(`☁ ${++n}/${ids.size}`, 'Đang đồng bộ…');
    const L = Lm.get(id), r = R.get(id), s = st.items[id];
    const rLive = r && !r.del;
    const lCh = L && (!s || L.updated !== s.l), rCh = r && (!s || r.updated !== s.r);
    if (L && !rLive) {
      if (r && r.del && s && !lCh) { await idbDel('project:' + id); await deleteProjectBlobs(id); await idbPut('projects', (await projIndex()).filter(x => x.id !== id)); out.deleted++; if (id === curProjId) curProjId = null; continue; }   // deleted on the other device
      newState[id] = { l: L.updated, r: await push(L) };
    } else if (L && rLive) {
      if (!lCh && !rCh) newState[id] = s;
      else if (!lCh && rCh) { if (await pull(r, id)) newState[id] = { l: r.updated, r: r.updated }; else newState[id] = s; }
      else if (lCh && !rCh) { newState[id] = { l: L.updated, r: await push(L) }; }
      else {   // changed on both sides (or first meeting): if the content is the same nothing to do, otherwise keep both
        const rec = await idbGet('project:' + id), mine = rec ? await gitSha(strU8(JSON.stringify((await syncEncode(rec, id)).json))) : '';
        if (mine && mine === paths.get(`p/${id}/rec.json`)) newState[id] = { l: L.updated, r: r.updated };
        else { const nid = newId(); if (await pull(r, nid, (r.name || 'Dự án') + ' (từ máy khác)')) { out.copies++; if (id === curProjId) out.copyOpen = { id: nid, name: (r.name || 'Dự án') + ' (từ máy khác)', frames: r.frames, mine: L.frames }; const c = (await projIndex()).find(x => x.id === nid); newState[nid] = { l: c.updated, r: await push(c) }; } newState[id] = { l: L.updated, r: await push(L) }; }
      }
    } else if (!L && rLive) {
      if (st.dels.includes(id)) {
        if (s && !rCh) { drop(id); newItems.set(id, { id, name: r.name, updated: Date.now(), del: true }); out.deleted++; }   // deleted here → delete there too
        else if (await pull(r, id)) newState[id] = { l: r.updated, r: r.updated };       // edited on the other device after → bring it back
      } else if (await pull(r, id)) newState[id] = { l: r.updated, r: r.updated };
    }
  }
  await flush(); syncHeadSeen = head;
  st.items = newState; st.dels = st.dels.filter(id => { const x = rIdx.find(y => y.id === id); return x && !x.del; });
  await idbPut('sync-state', st);
  if (!curProjId) { const L2 = (await projIndex()).sort((a, b) => b.updated - a.updated); if (L2.length) await openProject(L2[0].id); else await createProject(1080, 1920); }
}
/* --- 🔑 Mã phiên (session code): the repo + token packed into one string. Set up GitHub once on one device, then on any
   other device just paste the code: the same work opens there. The code is the key, so it stays in localStorage only. --- */
const SYNC_CODE_PRE = 'FS1-';
function syncCodeMake(cfg) { const s = JSON.stringify({ r: cfg.repo, t: cfg.tok }); return SYNC_CODE_PRE + btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function syncCodeParse(str) {
  const s = String(str || '').replace(/\s+/g, '');
  if (!s.toUpperCase().startsWith(SYNC_CODE_PRE)) return null;
  try { let b = s.slice(SYNC_CODE_PRE.length).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; const j = JSON.parse(decodeURIComponent(escape(atob(b)))); return j && typeof j.r === 'string' && typeof j.t === 'string' && j.t ? { repo: j.r, tok: j.t } : null; } catch (e) { return null; }
}
// check a repo + token, keep them on this device only when the repo is private and writable; returns '' or an error message
async function syncConnect(repo, tok) {
  const prev = [lsGet(SYNC_REPO_LS), lsGet(SYNC_TOK_LS)], undo = () => { lsSet(SYNC_REPO_LS, prev[0]); lsSet(SYNC_TOK_LS, prev[1]); };
  lsSet(SYNC_REPO_LS, repo); lsSet(SYNC_TOK_LS, tok);
  const cfg = syncCfg();
  if (!cfg) { undo(); return !tok ? 'Chưa dán token.' : 'Tên repo phải có dạng tên-bạn/tên-repo.'; }
  try {
    const info = await gh(cfg, '');
    if (!info.private) { undo(); return '⚠ Repo này đang Công khai (Public): ai cũng xem được bài của bạn. Vào Settings của repo đổi sang Private rồi thử lại.'; }
    if (info.permissions && info.permissions.push === false) { undo(); return syncErr(403); }
  } catch (e) { undo(); return '⚠ ' + e.message; }
  lsSet(SYNC_AUTO_LS, ''); syncWarned = false; setSyncState('☁ …');
  return '';
}
const syncWhen = t => t ? new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
async function syncDialog() {
  const c = syncCfg();
  const inp = 'min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px';
  const status = syncMsg ? '⚠ ' + escHtml(syncMsg) : syncBusy ? '☁ Đang đồng bộ…' : syncLast ? '✓ Đã lưu lên mạng lúc ' + syncWhen(syncLast) : '';
  if (c) return modal({ title: '☁ Làm tiếp trên máy khác', html: `
<p style="margin-top:0">✅ Máy này đã kết nối. Bài tự lưu lên mạng sau khi bạn sửa, và mỗi lần mở app hoặc <b>tải lại trang (F5)</b> sẽ lấy bản mới nhất.</p>
<p style="margin:6px 0 4px"><b>Mã phiên của bạn</b>: trên máy kia, mở ☁ rồi dán mã này vào.</p>
<div style="display:flex;gap:6px;align-items:center"><input id="syCode" type="password" readonly value="${escHtml(syncCodeMake(c))}" style="flex:1;min-width:0;${inp}"><button class="btn" id="syEye" style="min-width:44px" title="Hiện mã">👁</button><button class="btn primary" id="syCopy" style="min-width:44px">📋 Chép mã</button></div>
<p class="lbl" style="font-size:13px">🔒 Mã phiên như chìa khoá: ai có mã là mở được bài của bạn. Chỉ gửi cho chính bạn (vd. tin nhắn cho mình), đừng đăng lên mạng.</p>
<p class="lbl" style="font-size:13px">🛟 Không mất bài: bản nào cũng được giữ lại. Hai máy cùng sửa thì giữ cả 2 bản. Bấm <b>🕘 Bản cũ</b> để lấy lại bản trước đây.</p>
<div class="lbl" id="syMsg" style="font-size:13px;min-height:20px">${status}</div>`,
    buttons: [{ label: 'Ngắt kết nối', value: 'off', cls: 'danger', action: async () => { const ok = await modal({ title: 'Ngắt kết nối máy này?', html: '<p>Bài trên máy này vẫn còn, bài trên mạng vẫn còn. Muốn nối lại thì dán mã phiên.</p>', buttons: [{ label: 'Huỷ', value: false }, { label: 'Ngắt', value: true, cls: 'danger' }] }); if (!ok) return false; lsSet(SYNC_TOK_LS, ''); clearTimeout(syncT); setSyncState(''); toast('Đã ngắt kết nối máy này. Bài trên máy vẫn còn.'); } },
      { label: '🕘 Bản cũ', value: 'hist' }, { label: 'Đóng', value: null },
      { label: '☁ Đồng bộ ngay', value: 'now', primary: true }],
    onOpen: ov => {
      ov.querySelector('#syEye').addEventListener('click', () => { const i = ov.querySelector('#syCode'); i.type = i.type === 'password' ? 'text' : 'password'; });
      ov.querySelector('#syCopy').addEventListener('click', async () => { const i = ov.querySelector('#syCode'); let ok = false; try { await navigator.clipboard.writeText(i.value); ok = true; } catch (e) { i.type = 'text'; i.select(); try { ok = document.execCommand('copy'); } catch (e2) {} } toast(ok ? '📋 Đã chép mã phiên. Dán vào ☁ trên máy kia.' : 'Chưa chép được: hãy chọn mã rồi chép tay', 3000); });
    }
  }).then(v => { if (v === 'now') syncNow({ manual: true }); else if (v === 'hist') syncHistoryDialog(); return v; });
  return modal({ title: '☁ Làm tiếp trên máy khác', html: `
<p style="margin-top:0">Làm trên tablet rồi mở laptop làm tiếp (và ngược lại) bằng một <b>mã phiên</b>. Không cần làm cùng lúc: mở app hoặc tải lại trang (F5) là có bản mới nhất.</p>
<p style="margin:6px 0 4px"><b>Đã có mã phiên?</b> (lấy ở máy kia: ☁ → 📋 Chép mã)</p>
<div style="display:flex;gap:6px;align-items:center"><input id="syCode" type="text" autocomplete="off" spellcheck="false" placeholder="FS1-…" style="flex:1;min-width:0;${inp}"><button class="btn primary" id="syJoin" style="min-width:44px">Mở bài</button></div>
<details style="margin:10px 0 8px"><summary style="cursor:pointer;min-height:36px"><b>Chưa có mã? Tạo mã phiên</b> (làm 1 lần, trên 1 máy)</summary>
<p style="margin:6px 0">Bài được giữ trong <b>một repo GitHub riêng tư</b> của bạn: miễn phí, giữ mọi bản cũ, không ai khác xem được.</p>
<ol style="margin:6px 0;padding-left:20px;line-height:1.5">
<li>Tạo repo mới, chọn <b>Private</b> (riêng tư), ví dụ tên <code>frame-data</code>: <a href="https://github.com/new" target="_blank" rel="noopener" style="color:var(--accent)">github.com/new</a></li>
<li>Tạo token: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" style="color:var(--accent)">Fine-grained token</a> → Expiration: <b>No expiration</b> (hoặc 1 năm) → Repository access: <b>Only select repositories</b> → chọn repo đó → Permissions: <b>Contents: Read and write</b> → Generate.</li>
<li>Dán tên repo và token vào đây rồi bấm <b>Tạo mã</b>. Máy kia chỉ cần dán mã phiên, không phải làm lại.</li>
</ol>
<div class="set-row"><span>Repo (tên-bạn/tên-repo)</span><input id="syRepo" type="text" autocomplete="off" spellcheck="false" placeholder="ten-ban/frame-data" value="${escHtml(lsGet(SYNC_REPO_LS))}" style="width:230px;${inp}"></div>
<div style="display:flex;gap:6px;align-items:center"><input id="syTok" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" style="flex:1;min-width:0;${inp}"><button class="btn" id="syEye" style="min-width:44px">👁</button></div>
<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn primary" id="syMake">🔑 Tạo mã</button></div>
</details>
<p class="lbl" style="font-size:13px">🔒 Mã phiên và token chỉ lưu trên máy này, không nằm trong dự án, file ZIP hay repo. Lịch sử hoàn tác (↶) không đi theo sang máy kia.</p>
<div class="lbl" id="syMsg" style="font-size:13px;min-height:20px">${status}</div>`,
    buttons: [{ label: 'Đóng', value: null }],
    onOpen: (ov, close) => {
      const m = ov.querySelector('#syMsg');
      ov.querySelector('#syEye').addEventListener('click', () => { const i = ov.querySelector('#syTok'); i.type = i.type === 'password' ? 'text' : 'password'; });
      const go = async (repo, tok, made) => {
        m.textContent = 'Đang kiểm tra…';
        const er = await syncConnect(repo, tok); if (er) { m.textContent = er; return; }
        close(made ? 'made' : 'join');
        const r = syncNow({ manual: true, join: !made });
        if (made && syncCfg()) syncDialog();   // show the new code to copy right away; the first upload goes on behind it
        return r;
      };
      ov.querySelector('#syJoin').addEventListener('click', () => { const cfg = syncCodeParse(ov.querySelector('#syCode').value); if (!cfg) { m.textContent = 'Mã phiên không đúng. Mã bắt đầu bằng FS1-, hãy chép lại cả mã ở máy kia.'; return; } go(cfg.repo, cfg.tok, false); });
      ov.querySelector('#syMake').addEventListener('click', () => go(ov.querySelector('#syRepo').value.trim(), ov.querySelector('#syTok').value.trim(), true));
    }
  });
}
/* --- 🕘 Bản cũ: every sync is a git commit, so each saved version of a project stays in the repo's history.
   Restoring never overwrites: it brings the old version in as a new project "… (bản dd/mm hh:mm)". --- */
async function syncHistoryDialog() {
  const cfg = syncCfg(); if (!cfg) return;
  let idx = null, head;
  try { head = (await gh(cfg, '/git/ref/heads/main')).object.sha; const t = await gh(cfg, '/git/trees/' + (await gh(cfg, '/git/commits/' + head)).tree.sha); const e = (t.tree || []).find(x => x.path === 'index.json'); idx = e ? JSON.parse(new TextDecoder().decode(await gh(cfg, '/git/blobs/' + e.sha, { raw: true }))) : null; }
  catch (e) { toast('☁ ' + e.message, 3500); return; }
  const list = (idx && idx.projects || []).slice().sort((a, b) => (a.del ? 1 : 0) - (b.del ? 1 : 0) || b.updated - a.updated);
  const cur = list.find(x => x.id === curProjId);
  const opts = list.map(x => `<option value="${escHtml(x.id)}" ${x === cur ? 'selected' : ''}>${escHtml((x.del ? '🗑 ' : '') + (x.name || 'Dự án'))}</option>`).join('');
  return modal({ title: '🕘 Bản cũ trên mạng', html: list.length ? `
<p style="margin-top:0">Chọn dự án rồi chọn lúc muốn lấy lại. Bản cũ được thêm thành <b>dự án mới</b>, bài hiện tại vẫn giữ nguyên.</p>
<select id="shProj" style="width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:16px;padding:6px">${opts}</select>
<div id="shList" class="plist" style="margin-top:8px"></div>` : '<p>Chưa có bản nào trên mạng.</p>',
    buttons: [{ label: 'Đóng', value: null }],
    onOpen: (ov, close) => {
      const box = ov.querySelector('#shList'); if (!box) return;
      const show = async () => {
        const id = ov.querySelector('#shProj').value, it = list.find(x => x.id === id);
        box.innerHTML = '<p class="lbl">Đang tải…</p>';
        let cm = [];
        try { cm = await gh(cfg, '/commits?path=' + encodeURIComponent(`p/${id}/rec.json`) + '&sha=main&per_page=40'); } catch (e) { box.innerHTML = '<p class="lbl">⚠ ' + escHtml(e.message) + '</p>'; return; }
        if (!cm.length) { box.innerHTML = '<p class="lbl">Chưa có bản nào.</p>'; return; }
        box.innerHTML = cm.map((x, k) => `<div class="prow" style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 6px 6px 12px"><span>${k === 0 && !(it && it.del) ? '⭐ Mới nhất · ' : ''}${escHtml(syncWhen(Date.parse(x.commit && (x.commit.committer || x.commit.author || {}).date)))}</span><button class="btn small" data-sh="${escHtml(x.sha)}" style="min-height:42px">Lấy lại</button></div>`).join('');
        box.querySelectorAll('[data-sh]').forEach(b => b.addEventListener('click', async () => {
          const pr = progress('Đang lấy bản cũ…');
          try { const nid = await syncRestore(cfg, b.dataset.sh, id, it ? it.name : 'Dự án'); pr.close(); if (nid) { close(null); await openProject(nid); toast('🕘 Đã lấy lại bản cũ thành dự án mới. Bài cũ vẫn còn trong 📁 Dự án.', 3500); syncSoon(3000); } else toast('Bản này không còn dữ liệu, chọn bản khác', 3000); }
          catch (e) { pr.close(); console.error(e); toast('⚠ ' + e.message, 3500); }
        }));
      };
      ov.querySelector('#shProj').addEventListener('change', show); show();
    }
  });
}
async function syncRestore(cfg, commit, pid, name) {
  // the version is the commit itself, or (for the commit that deleted it) the one before
  let c = await gh(cfg, '/git/commits/' + commit), t = await gh(cfg, '/git/trees/' + c.tree.sha + '?recursive=1');
  let e = (t.tree || []).find(x => x.path === `p/${pid}/rec.json`);
  if (!e && c.parents && c.parents.length) { c = await gh(cfg, '/git/commits/' + c.parents[0].sha); t = await gh(cfg, '/git/trees/' + c.tree.sha + '?recursive=1'); e = (t.tree || []).find(x => x.path === `p/${pid}/rec.json`); }
  if (!e) return null;
  const j = JSON.parse(new TextDecoder().decode(await gh(cfg, '/git/blobs/' + e.sha, { raw: true })));
  const cache = new Map(), getBin = async sha => { if (!cache.has(sha)) cache.set(sha, await gh(cfg, '/git/blobs/' + sha, { raw: true })); return cache.get(sha); };
  const nid = newId(), { rec, blobs } = await syncDecode(j, nid, getBin), when = Date.parse(c.committer && c.committer.date || c.author && c.author.date || '') || Date.now();
  rec.name = (name || rec.name || 'Dự án').replace(/ \(bản [^)]*\)$/, '') + ' (bản ' + syncWhen(when) + ')';
  await syncWriteLocal(nid, rec, blobs, { name: rec.name, updated: Date.now(), frames: (rec.frames || []).length, thumb: '' });
  return nid;
}
