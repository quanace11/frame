/* ========= Gap filling: fast colour diffusion + optional MI-GAN (free, runs locally) ========= */
let ppFillMode = 'fast';   // 'fast' | 'ai' | 'off'
/** Fill every unknown pixel with the average of already-filled neighbours, layer by layer (onion peel). */
function diffuseFill(rgba, w, h, known) {
  const out = new Uint8ClampedArray(rgba), done = known.slice(), n = w * h;
  let front = [];
  const nb = i => { const x = i % w, r = []; if (x > 0) r.push(i - 1); if (x < w - 1) r.push(i + 1); if (i >= w) r.push(i - w); if (i < n - w) r.push(i + w); if (x > 0 && i >= w) r.push(i - w - 1); if (x < w - 1 && i >= w) r.push(i - w + 1); if (x > 0 && i < n - w) r.push(i + w - 1); if (x < w - 1 && i < n - w) r.push(i + w + 1); return r; };
  const queued = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!done[i]) for (const j of nb(i)) if (done[j]) { front.push(i); queued[i] = 1; break; }
  let guard = 0;
  while (front.length && guard++ < 4000) {
    const vals = [];
    for (const i of front) { let r = 0, g = 0, b = 0, c = 0; for (const j of nb(i)) if (done[j]) { r += out[j * 4]; g += out[j * 4 + 1]; b += out[j * 4 + 2]; c++; } vals.push(c ? [r / c, g / c, b / c] : [255, 255, 255]); }
    front.forEach((i, k) => { out[i * 4] = vals[k][0]; out[i * 4 + 1] = vals[k][1]; out[i * 4 + 2] = vals[k][2]; out[i * 4 + 3] = 255; done[i] = 1; });
    const next = []; for (const i of front) for (const j of nb(i)) if (!done[j] && !queued[j]) { queued[j] = 1; next.push(j); }
    front = next;
  }
  return out;
}
let miganSession = null, miganLoading = null;
function getMigan() {
  if (miganSession) return Promise.resolve(miganSession);
  if (!miganLoading) miganLoading = (async () => {
    if (!window.ort) await loadScript('./ort.wasm.min.js');
    ort.env.wasm.wasmPaths = new URL('./', document.baseURI).href; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    for (const k of [1, 2, 3]) if (!window['MIGAN_B64_' + k]) await loadScript(`./migan-${k}.js`);
    const b64 = window.MIGAN_B64_1 + window.MIGAN_B64_2 + window.MIGAN_B64_3; window.MIGAN_B64_1 = window.MIGAN_B64_2 = window.MIGAN_B64_3 = null;
    const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    miganSession = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
    return miganSession;
  })().catch(e => { miganLoading = null; throw e; });
  return miganLoading;
}
/** MI-GAN refine: rgba (already roughly filled) + hole mask (1 = repaint). Returns new RGB in an RGBA array. */
async function miganFill(rgba, w, h, hole) {
  const sess = await getMigan();
  const k = Math.min(1, 512 / Math.max(w, h)), W2 = Math.max(16, Math.round(w * k / 8) * 8), H2 = Math.max(16, Math.round(h * k / 8) * 8);
  const c = makeCanvas(w, h), cx = c.getContext('2d'); const id = new ImageData(new Uint8ClampedArray(rgba), w, h);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = 255; cx.putImageData(id, 0, 0);
  const s = makeCanvas(W2, H2), sx = s.getContext('2d'); sx.drawImage(c, 0, 0, W2, H2);
  const mc = makeCanvas(w, h), mx = mc.getContext('2d'), mi = mx.createImageData(w, h);
  for (let i = 0; i < hole.length; i++) { const v = hole[i] ? 0 : 255; mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = v; mi.data[i * 4 + 3] = 255; }
  mx.putImageData(mi, 0, 0); const ms = makeCanvas(W2, H2), msx = ms.getContext('2d'); msx.drawImage(mc, 0, 0, W2, H2);
  const sd = sx.getImageData(0, 0, W2, H2).data, md = msx.getImageData(0, 0, W2, H2).data, N = W2 * H2;
  const img = new Uint8Array(3 * N), mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) { img[i] = sd[i * 4]; img[N + i] = sd[i * 4 + 1]; img[2 * N + i] = sd[i * 4 + 2]; mask[i] = md[i * 4] < 128 ? 0 : 255; }
  const out = await sess.run({ image: new ort.Tensor('uint8', img, [1, 3, H2, W2]), mask: new ort.Tensor('uint8', mask, [1, 1, H2, W2]) });
  const r = out[sess.outputNames[0]].data;
  const rc = makeCanvas(W2, H2), rx = rc.getContext('2d'), ri = rx.createImageData(W2, H2);
  for (let i = 0; i < N; i++) { ri.data[i * 4] = r[i]; ri.data[i * 4 + 1] = r[N + i]; ri.data[i * 4 + 2] = r[2 * N + i]; ri.data[i * 4 + 3] = 255; }
  rx.putImageData(ri, 0, 0); const back = makeCanvas(w, h), bx = back.getContext('2d'); bx.drawImage(rc, 0, 0, w, h);
  const bd = bx.getImageData(0, 0, w, h).data, res = new Uint8ClampedArray(rgba);
  for (let i = 0; i < hole.length; i++) if (hole[i]) { res[i * 4] = bd[i * 4]; res[i * 4 + 1] = bd[i * 4 + 1]; res[i * 4 + 2] = bd[i * 4 + 2]; res[i * 4 + 3] = 255; }
  return res;
}
/** Fill a hole inside a crop. known: 1 where pixel is trusted context. hole: 1 where we want new pixels. */
async function fillCrop(rgba, w, h, known, hole, mode) {
  let res = diffuseFill(rgba, w, h, known);
  if (mode === 'ai') { try { res = await miganFill(res, w, h, hole); } catch (e) { console.error(e); toast('AI vá không chạy được ở đây — dùng cách nhanh', 3000); ppFillMode = 'fast'; } }
  return res;
}
