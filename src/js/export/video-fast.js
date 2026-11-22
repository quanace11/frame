/* ===== ⚡ fast video export: WebCodecs encodes the frames as fast as the device draws them (no real-time wait),
   the sound is mixed offline, and both are packed into an MP4 file right here (no library, works offline) ===== */
const VX_FPS = 30;
async function fastVideoCfg(w, h) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033', 'avc1.4d0033', 'avc1.42e033']) {
    const c = { codec, width: w, height: h, bitrate: 8e6, framerate: VX_FPS, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) return c; } catch (e) {}
  }
  return null;
}
async function fastAudioCfg(sr, ch) {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  for (const codec of ['mp4a.40.2', 'opus']) { const c = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: 160000 }; try { if ((await AudioEncoder.isConfigSupported(c)).supported) return c; } catch (e) {} }
  return null;
}
const vxU8 = v => v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
// minimal MP4 writer: one sample per chunk (so video and sound can be interleaved by time), moov at the end
function mp4Mux({ w, h, fps, vDesc, vSamples, audio }) {
  const u16 = n => [(n >> 8) & 255, n & 255], u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const str = s => [...s].map(c => c.charCodeAt(0));
  const box = (type, ...parts) => {
    const arrs = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p)), len = 8 + arrs.reduce((a, b) => a + b.length, 0);
    const o = new Uint8Array(len); o.set(u32(len), 0); o.set(str(type), 4); let k = 8; for (const a of arrs) { o.set(a, k); k += a.length; } return o;
  };
  const fbox = (type, v, fl, ...parts) => box(type, [v, (fl >> 16) & 255, (fl >> 8) & 255, fl & 255], ...parts);
  const MATRIX = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];
  const VTS = fps * 1000, vDur = vSamples.length * 1000, movDur = Math.round(vSamples.length / fps * 1000);
  // interleave samples by time → file offsets
  const items = vSamples.map((s, i) => ({ s, t: i / fps, tr: 'v' }));
  if (audio) { let t = 0; for (const s of audio.samples) { items.push({ s, t: t / audio.sr, tr: 'a' }); t += s.dur; } }
  items.sort((a, b) => a.t - b.t || (a.tr === 'v' ? -1 : 1));
  const ftyp = box('ftyp', str('isom'), u32(512), str('isomiso2avc1mp41'));
  let off = ftyp.length + 8, mdLen = 0;
  for (const it of items) { it.off = off; off += it.s.data.length; mdLen += it.s.data.length; }
  const mdatHead = new Uint8Array([...u32(8 + mdLen), ...str('mdat')]);
  const stco = tr => { const L = items.filter(x => x.tr === tr); return fbox('stco', 0, 0, u32(L.length), L.flatMap(x => u32(x.off))); };
  const stsz = L => fbox('stsz', 0, 0, u32(0), u32(L.length), L.flatMap(s => u32(s.data.length)));
  const stsc = fbox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
  const dinf = box('dinf', fbox('dref', 0, 0, u32(1), fbox('url ', 0, 1)));
  const tkhd = (id, dur, vol, tw, th) => fbox('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(dur), u32(0), u32(0), u16(0), u16(0), u16(vol), u16(0), MATRIX, u32(tw << 16), u32(th << 16));
  const mdhd = (ts, dur) => fbox('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0));
  const hdlr = (t, name) => fbox('hdlr', 0, 0, u32(0), str(t), u32(0), u32(0), u32(0), str(name), [0]);
  const keys = vSamples.map((s, i) => s.key ? i + 1 : 0).filter(Boolean);
  const avc1 = box('avc1', new Array(6).fill(0), u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(w), u16(h), u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', vDesc));
  const vtrak = box('trak', tkhd(1, movDur, 0, w, h), box('mdia', mdhd(VTS, vDur), hdlr('vide', 'VideoHandler'),
    box('minf', fbox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf,
      box('stbl', fbox('stsd', 0, 0, u32(1), avc1), fbox('stts', 0, 0, u32(1), u32(vSamples.length), u32(1000)), fbox('stss', 0, 0, u32(keys.length), keys.flatMap(k => u32(k))), stsc, stsz(vSamples), stco('v')))));
  let atrak = null;
  if (audio) {
    const A = audio, aDur = A.samples.reduce((a, s) => a + s.dur, 0), aEntry = [new Array(6).fill(0), u16(1), u32(0), u32(0), u16(A.ch), u16(16), u16(0), u16(0), u32(A.sr << 16)].flat();
    let sd;
    if (A.codec === 'opus') {
      const d = A.desc && A.desc.length >= 19 ? A.desc : null, pre = d ? d[10] | (d[11] << 8) : 312, rate = d ? (d[12] | (d[13] << 8) | (d[14] << 16) | (d[15] << 24)) >>> 0 : A.sr;
      sd = box('Opus', aEntry, box('dOps', [0, A.ch], u16(pre), u32(rate), u16(0), [0]));
    } else {
      const fi = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000].indexOf(A.sr);
      const asc = A.desc && A.desc.length ? [...A.desc] : [(2 << 3) | (fi >> 1), ((fi & 1) << 7) | (A.ch << 3)];
      const dsi = [5, asc.length, ...asc], dcd = [4, 13 + dsi.length, 0x40, 0x15, 0, 0, 0, ...u32(160000), ...u32(160000), ...dsi], es = [3, 3 + dcd.length + 3, ...u16(1), 0, ...dcd, 6, 1, 2];
      sd = box('mp4a', aEntry, fbox('esds', 0, 0, es));
    }
    const stts = []; let run = null;
    for (const s of A.samples) { if (run && run[1] === s.dur) run[0]++; else stts.push(run = [1, s.dur]); }
    atrak = box('trak', tkhd(2, Math.round(aDur / A.sr * 1000), 0x100, 0, 0), box('mdia', mdhd(A.sr, aDur), hdlr('soun', 'SoundHandler'),
      box('minf', fbox('smhd', 0, 0, u16(0), u16(0)), dinf,
        box('stbl', fbox('stsd', 0, 0, u32(1), sd), fbox('stts', 0, 0, u32(stts.length), stts.flatMap(r => [...u32(r[0]), ...u32(r[1])])), stsc, stsz(A.samples), stco('a')))));
  }
  const mvhd = fbox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movDur), u32(0x10000), u16(0x100), new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(audio ? 3 : 2));
  const moov = atrak ? box('moov', mvhd, vtrak, atrak) : box('moov', mvhd, vtrak);
  return new Blob([ftyp, mdatHead, ...items.map(it => it.s.data), moov], { type: 'video/mp4' });
}
// the whole sound track (music, voices, sound effects) rendered offline → AudioBuffer
async function vxMixAudio(total, sr) {
  const oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.max(1, Math.ceil(total * sr)), sr);
  await scheduleAudio(oc, oc.destination, 0, total, 0);
  return oc.startRendering();
}
// returns the finished MP4 blob, or null when this device cannot encode (the caller then records in real time)
async function exportVideoFast(msg, isCancelled) {
  const w = W & ~1, h = H & ~1, vcfg = await fastVideoCfg(w, h); if (!vcfg) return null;
  const T = frameStartTimes(), total = T[T.length - 1], N = Math.max(1, Math.ceil(total * VX_FPS - 1e-6)), live = ppSmoothOn();
  let err = null, vDesc = null; const vSamples = [];
  const enc = new VideoEncoder({ output: (c, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) vDesc = new Uint8Array(vxU8(meta.decoderConfig.description)); const d = new Uint8Array(c.byteLength); c.copyTo(d); vSamples.push({ data: d, key: c.type === 'key' }); }, error: e => { err = e; } });
  enc.configure(vcfg);
  const out = makeCanvas(w, h), ox = out.getContext('2d'), base = makeCanvas(), bx = base.getContext('2d'), ts = trSrcCache(live);
  let bi = -1;
  try {
    for (let n = 0; n < N; n++) {
      if (isCancelled()) throw new Error('cancel'); if (err) throw err;
      const t = n / VX_FPS; let i = T.findIndex((v, k) => k < S.frames.length && t < T[k + 1]); if (i < 0) i = S.frames.length - 1;
      if (i !== bi) { const f = S.frames[i]; await ghostLoad(f); await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg); drawFrameBase(bx, f, bg, live); bi = i; evictSoon(); }
      await ts.prep(t, T); if (vtOn()) await vtSeekAt(t);
      drawFrameFx(ox, i, base, t, t - T[i], null, live ? ppLiveOver(i, t - T[i], false) : null);
      const vf = new VideoFrame(out, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / VX_FPS) });
      enc.encode(vf, { keyFrame: n % (VX_FPS * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 3) await new Promise(r => setTimeout(r, 1));
      if (n % 5 === 0) { msg(`⚡ Xuất nhanh: ${t.toFixed(1)} / ${total.toFixed(1)} giây`); await new Promise(r => setTimeout(r, 0)); }
    }
    await enc.flush(); if (err) throw err;
  } finally { try { enc.close(); } catch (e) {} ts.done(); out.width = base.width = 0; if (vtOn()) bgVideoSync(true); }
  if (!vDesc || !vSamples.length) return null;
  let audio = null;
  if (hasAudio()) {
    msg('⚡ Đang trộn âm thanh…');
    let acfg = await fastAudioCfg(48000, 2); const sr = 48000;
    if (acfg) {
      const buf = await vxMixAudio(total, sr), ch = 2, samples = []; let adesc = null, aerr = null;
      const aenc = new AudioEncoder({ output: (c, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) adesc = new Uint8Array(vxU8(meta.decoderConfig.description)); const d = new Uint8Array(c.byteLength); c.copyTo(d); samples.push({ data: d, dur: Math.round((c.duration || 0) * sr / 1e6) || (acfg.codec === 'opus' ? 960 : 1024) }); }, error: e => { aerr = e; } });
      aenc.configure(acfg);
      const L = buf.length, step = 4800, c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : c0;
      for (let o = 0; o < L; o += step) {
        const n = Math.min(step, L - o), data = new Float32Array(n * ch); data.set(c0.subarray(o, o + n), 0); data.set(c1.subarray(o, o + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(o / sr * 1e6), data });
        aenc.encode(ad); ad.close(); if (aerr) break;
      }
      await aenc.flush(); try { aenc.close(); } catch (e) {}
      if (!aerr && samples.length) audio = { codec: acfg.codec === 'opus' ? 'opus' : 'aac', sr, ch, desc: adesc, samples };
      else console.error(aerr);
    }
    if (!audio) return null;   // keep the sound: fall back to real-time recording
  }
  msg('⚡ Đang đóng gói MP4…');
  return mp4Mux({ w, h, fps: VX_FPS, vDesc, vSamples, audio });
}
