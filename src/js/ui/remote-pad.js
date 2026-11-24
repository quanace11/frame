/* ========= 🖊 Tablet làm bảng vẽ (PenPad) ========= */
// Frame Studio on the computer connects to the PenPad helper (penpad/penpad_server.py) at ws://127.0.0.1:<port>/ws?role=host.
// The Android tablet opens the PenPad page (cable: adb reverse, or Wi-Fi). It shows the frame being drawn (a small JPEG sent
// from here, padImg), a tool bar (Bút / Tẩy / Đổ màu / Hút màu, loại bút, màu, cỡ, độ đậm, lớp, ↶ ↷, frame) and sends pen
// samples in FRAME coordinates (10 bytes each: state 0 rời / 1 lơ lửng / 2 chạm, flags 1 nút bút / 2 đầu tẩy, x, y 0..65535,
// pressure 0..1024, tiltX, tiltY). They are replayed as pen PointerEvents on #view (padPen), so every tool, the undo and the
// palm rejection work exactly like a real stylus on this screen. Commands from the tablet: padCmd. State back: padState.
const PAD = { ws: null, on: false, port: 8765, st: '', img: '', imgT: 0, busy: false, down: false, lastC: null, tool0: null, retry: null, was: false, cv: null, cur: null };
const PAD_LS = 'fs-pad', PAD_ID = 9001, PAD_TOOLS = ['brush', 'eraser', 'fill', 'pick', 'lasso'], PAD_LAYERS = ['bg', 'col', 'char', 'vec'];
function padLoad() { try { const o = JSON.parse(localStorage.getItem(PAD_LS) || '{}'); PAD.on = !!o.on; PAD.port = (o.port | 0) || 8765; } catch (e) {} }
function padSave() { try { localStorage.setItem(PAD_LS, JSON.stringify({ on: PAD.on, port: PAD.port })); } catch (e) {} }
const padLive = () => !!(PAD.ws && PAD.ws.readyState === 1);
function padSend(o) { const ws = PAD.ws; if (ws && ws.readyState === 1 && ws.bufferedAmount < 4e6) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function padConnect() {
  clearTimeout(PAD.retry); if (!PAD.on || PAD.ws) return;
  let ws; try { ws = new WebSocket(`ws://127.0.0.1:${PAD.port}/ws?role=host`); } catch (e) { padRetry(); return; }
  ws.binaryType = 'arraybuffer'; PAD.ws = ws;
  ws.onopen = () => { PAD.st = ''; PAD.img = ''; padSend({ t: 'hi', app: 'frame' }); padSync(true); padStatus(); if (!PAD.was) toast('🖊 Đã nối PenPad: vẽ trên tablet được rồi', 2500); PAD.was = true; };
  ws.onmessage = e => { if (typeof e.data === 'string') padCmd(e.data); else padPen(new DataView(e.data)); };
  ws.onclose = () => {
    if (PAD.ws !== ws) return;
    PAD.ws = null; padUp(); padCursor(0); padStatus(); padRetry();
    if (PAD.was && PAD.on) { PAD.was = false; toast('🖊 Mất kết nối PenPad, đang thử nối lại…', 2500); }
  };
}
function padRetry() { clearTimeout(PAD.retry); if (PAD.on) PAD.retry = setTimeout(padConnect, 3000); }
function padSet(on) {
  PAD.on = on; padSave();
  if (on) padConnect(); else { clearTimeout(PAD.retry); const ws = PAD.ws; PAD.ws = null; PAD.was = false; padUp(); padCursor(0); if (ws) try { ws.close(); } catch (e) {} }
  padStatus();
}

// frame point (0..1) → client point on #view, the inverse of toDoc (input.js) through the current zoom / pan / rotation
function padToClient(nx, ny) {
  const r = view.getBoundingClientRect(), m = viewMat(), x = nx * W, y = ny * H;
  return { x: r.left + (m[0] * x + m[2] * y + m[4]) / DPR, y: r.top + (m[1] * x + m[3] * y + m[5]) / DPR };
}
function padEv(type, c, p, tx, ty, buttons) {
  view.dispatchEvent(new PointerEvent(type, { pointerId: PAD_ID, pointerType: 'pen', isPrimary: true, clientX: c.x, clientY: c.y, pressure: p, tiltX: tx, tiltY: ty,
    buttons, button: type === 'pointermove' ? -1 : 0, bubbles: true, cancelable: true }));
}
function padPen(dv) {
  for (let o = 0; o + 10 <= dv.byteLength; o += 10) {
    const st = dv.getUint8(o), fl = dv.getUint8(o + 1);
    const c = padToClient(dv.getUint16(o + 2, true) / 65535, dv.getUint16(o + 4, true) / 65535);
    const p = Math.max(0.01, dv.getUint16(o + 6, true) / 1024), tx = dv.getInt8(o + 8), ty = dv.getInt8(o + 9);
    padCursor(st, c);
    if (st === 2) {
      PAD.lastC = c;
      if (!PAD.down) {
        PAD.down = true;
        if ((fl & 2) && S.tool !== 'eraser') { PAD.tool0 = S.tool; setTool('eraser'); }   // the stylus' eraser end erases, then the tool comes back
        padEv('pointerdown', c, p, tx, ty, 1);
      } else padEv('pointermove', c, p, tx, ty, 1);
    } else if (PAD.down) padUp(c);
  }
}
function padUp(c) {
  if (!PAD.down) return;
  PAD.down = false; padEv('pointerup', c || PAD.lastC || { x: 0, y: 0 }, 0, 0, 0, 0);
  if (PAD.tool0) { const t = PAD.tool0; PAD.tool0 = null; setTool(t); }
  padSync();
}
// a ring on the computer screen where the stylus hovers, so you can look at the big screen while drawing on the tablet
function padCursor(st, c) {
  let el = PAD.cur;
  if (!st) { if (el) el.hidden = true; return; }
  if (!el) {
    el = PAD.cur = document.createElement('div'); el.id = 'padCur';
    el.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #1e88e5;box-shadow:0 0 0 1px #fff;pointer-events:none;z-index:50';
    document.body.append(el);
  }
  el.hidden = false; el.style.transform = `translate(${c.x}px,${c.y}px)`; el.style.background = st === 2 ? 'rgba(30,136,229,.35)' : 'transparent';
}

function padCmd(txt) {
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'want': padSync(true); return;
    case 'penout': padUp(); padCursor(0); return;   // the tablet went away in the middle of a line
    case 'tool': if (PAD_TOOLS.includes(m.v) && S.tool !== m.v) setTool(m.v); break;
    case 'brush': if (BRUSHES[m.v]) { S.brush = m.v; saveSettings(); if (S.tool !== 'brush') setTool('brush'); updBrushBtn(); syncSizeOp(); } break;
    case 'eraser': if (ERASERS[m.v]) { S.eraserType = m.v; saveSettings(); if (S.tool !== 'eraser') setTool('eraser'); updBrushBtn(); syncSizeOp(); } break;
    case 'color': if (normHex(String(m.v))) { setColor(String(m.v)); addRecentColor(S.color); if (S.tool !== 'brush' && S.tool !== 'fill') setTool('brush'); } break;
    case 'size': if (isFinite(m.v)) setSize(+m.v); break;
    case 'op': if (isFinite(m.v)) setOp(+m.v); break;
    case 'layer': if (PAD_LAYERS.includes(m.v) && S.layer !== m.v) setLayer(m.v); break;
    case 'pressure': S.pressure = !!m.v; updateToggles(); saveSettings(); break;
    case 'undo': $('#undoBtn').click(); break;
    case 'redo': $('#redoBtn').click(); break;
    case 'frame': selectFrame(clamp(S.cur + (m.d | 0), 0, S.frames.length - 1)); break;
    case 'goto': selectFrame(clamp(m.i | 0, 0, S.frames.length - 1)); break;
    case 'add': $('#addBtn').click(); break;
    case 'onion': $('#onionBtn').click(); break;
    case 'play': $('#playBtn').click(); break;
    default: return;
  }
  padSync();
}
function padState() {
  return {
    t: 'state', app: 'frame', tool: S.tool, brush: S.brush, eraser: S.eraserType, color: S.color, size: S.size, op: curOp(), layer: S.layer,
    pressure: !!S.pressure, onion: !!S.onion, playing: !!playing, cur: S.cur, n: S.frames.length, W, H,
    pal: PALETTE, recent: (S.recentColors || []).slice(0, 12),
    brushes: Object.entries(BRUSHES).map(([k, o]) => [k, o.name]), erasers: Object.entries(ERASERS).map(([k, o]) => [k, o.name]),
    undo: !$('#undoBtn').disabled, redo: !$('#redoBtn').disabled
  };
}
function padSync(force) {
  if (!padLive()) return;
  const s = JSON.stringify(padState());
  if (force || s !== PAD.st) { PAD.st = s; padSend(s); }
  if (force) PAD.img = '';
  padImg();
}
// what the frame picture depends on: a change here (or 4 s passing) sends a new picture to the tablet
function padImgKey() {
  const f = curFrame(); if (!f) return '';
  const bg = bgOf(f), v = f.vec || [], lv = v[v.length - 1];
  return [S.cur, f.id, f.ver, f.colVer, !!f.canvas, bg && bg.id, bg && bg.ver, v.length, lv && lv.pts && lv.pts.length, W, H, S.onion,
    S.showBg, S.showChar, S.showCol, S.showVec, S.showPP, S.frames.length, undoStack.length, redoStack.length, !!floating].join('|');
}
async function padImg() {
  if (PAD.busy || !padLive() || stroke || action || playing) return;   // while drawing the tablet shows its own line
  const key = padImgKey(); if (!key || (key === PAD.img && performance.now() - PAD.imgT < 4000)) return;
  const f = curFrame(); PAD.busy = true;
  try {
    await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
    const k = Math.min(1, 1400 / Math.max(W, H)), cv = PAD.cv || (PAD.cv = document.createElement('canvas'));
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.setTransform(k, 0, 0, k, 0, 0);
    if (bg && bg.canvas && S.showBg) x.drawImage(bg.canvas, 0, 0);
    const pf = S.onion && S.frames[S.cur - 1];
    if (pf && pf.canvas) { x.globalAlpha = 0.22; x.drawImage(pf.canvas, 0, 0); x.globalAlpha = 1; }
    drawCol(x, f);
    if (f.canvas && S.showChar) x.drawImage(f.canvas, 0, 0);
    if (S.pp && S.showPP) drawPuppet(x, f.pp, f.lip);
    if (S.showVec && f.vec && f.vec.length) drawVec(x, f.vec);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
    if (blob && padLive()) {
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(''); fr.readAsDataURL(blob); });
      if (url) padSend({ t: 'img', cur: S.cur, w: cv.width, h: cv.height, data: url });
    }
    PAD.img = key; PAD.imgT = performance.now();
  } catch (e) { PAD.img = ''; } finally { PAD.busy = false; }
}
function padStatus() {
  const el = document.getElementById('padSt'); if (!el) return;
  el.textContent = !PAD.on ? 'Đang tắt.' : padLive() ? '✅ Đã nối PenPad. Mở trang PenPad trên tablet để vẽ.' : '⏳ Đang tìm PenPad trên máy này… (đã chạy PenPad chưa?)';
}
function padDialog() {
  modal({
    title: '🖊 Tablet làm bảng vẽ (PenPad)',
    html: `<p>Dùng tablet Android + bút làm bảng vẽ cho Frame Studio trên máy tính. Tablet hiện frame đang vẽ, có nút chọn bút, tẩy, màu, cỡ nét; nét vẽ đi thẳng vào frame (có lực nhấn).</p>
      <ol style="padding-left:20px;margin:8px 0">
        <li>Trên máy tính chạy <b>PenPad</b> (thư mục <code>penpad</code> của repo, nhấp đúp <code>Chay_PenPad_USB.bat</code>).</li>
        <li>Cắm cáp tablet (đã bật Gỡ lỗi USB): Chrome trên tablet tự mở trang PenPad.</li>
        <li>Bật công tắc dưới đây. Lần đầu Chrome có thể hỏi cho phép kết nối tới thiết bị/ứng dụng trên máy này: bấm <b>Cho phép</b>.</li>
      </ol>
      <label class="set-row"><span>Nối với PenPad</span><input type="checkbox" id="padOn"></label>
      <label class="set-row"><span>Cổng (mặc định 8765)</span><input type="number" id="padPort" min="1024" max="65535" style="width:96px"></label>
      <p id="padSt" style="margin:8px 0 0"></p>
      <p style="margin:6px 0 0;opacity:.75;font-size:13px">Trên tablet: chạm 2 ngón = hoàn tác, chụm 2 ngón = phóng to. Đầu tẩy của bút (nếu có) tự xoá.</p>`,
    buttons: [{ label: 'Xong', value: true, primary: true }],
    onOpen: ov => {
      const on = ov.querySelector('#padOn'), port = ov.querySelector('#padPort');
      on.checked = PAD.on; port.value = PAD.port; padStatus();
      on.addEventListener('change', () => padSet(on.checked));
      port.addEventListener('change', () => { const v = port.value | 0; if (v < 1024 || v > 65535) { port.value = PAD.port; return; } PAD.port = v; padSave(); if (PAD.on) { padSet(false); padSet(true); } });
    }
  });
}
padLoad();
setInterval(() => { if (padLive()) padSync(); }, 250);
setTimeout(padConnect, 1500);
