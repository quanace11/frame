import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎞 transitions (Chữ & FX → Chuyển cảnh): one tap at the cut before/after the frame, time-based windows across frames,
# dip to black, crossfade (two pictures), 📺 TV off at film end, the other kinds draw, strip marks, undo, sound,
# GIF split into sub-frames, playback, save + reload
srv = subprocess.Popen(['python3','-m','http.server','8896'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# picture of the finished film at time t (like the video export), pixel [r,g,b] at doc points
PIX = '''async ([t, pts]) => { const T = frameStartTimes(); let i = T.findIndex((v, k) => k < S.frames.length && t < T[k + 1]); if (i < 0) i = S.frames.length - 1;
  const f = S.frames[i]; await ensureLoaded(f); const base = makeCanvas(); drawFrameBase(base.getContext('2d'), f, bgOf(f));
  const ts = trSrcCache(false); await ts.prep(t, T); const out = makeCanvas(), x = out.getContext('2d', { willReadFrequently: true });
  drawFrameFx(x, i, base, t, t - T[i]); ts.done();
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8896/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.click('#addBtn')
        # three 1 s frames: red, blue, green
        await pg.evaluate("""(async()=>{const C=['#ff0000','#0000ff','#00c000']; for (let i=0;i<3;i++){const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.fillStyle=C[i]; x.fillRect(0,0,W,H); f.ver++; f.dur=1000; queueThumbFor(f);} S.cur=0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','trans');})()""")
        await pg.wait_for_timeout(300)
        W, H = await pg.evaluate("[W,H]"); C = [W / 2, H / 2]
        pix = lambda t, pts=None: pg.evaluate(PIX, [t, pts or [C]])
        check('transition tab + 10 kinds', await pg.evaluate("document.querySelectorAll('[data-trk]').length") == 10 and await pg.evaluate("document.getElementById('trKinds').offsetParent!==null"))
        # 1) dip to black after frame 1 (cut at 1.0 s, 0.8 s → 0.6 … 1.4 s)
        await pg.click('[data-trat=out]'); await pg.click('[data-trk=dip]'); await pg.wait_for_timeout(700)
        tr = await pg.evaluate("S.frames[0].tre")
        check('dip stored after frame 1', tr and tr['k'] == 'dip' and abs(tr['d'] - 0.8) < 1e-6)
        check('strip mark on frame 1 right edge', await pg.evaluate("(S.frames[0].el.querySelector('.trb.out')||{}).textContent") == '🌑')
        check('status names the cut', 'giữa frame 1 và 2' in await pg.inner_text('#trStat'))
        a, = await pix(0.5); m, = await pix(0.995); h1, = await pix(0.8); h2, = await pix(1.2); z, = await pix(1.5)
        print('dip', a, h1, m, h2, z)
        check('dip: before window = red', a[0] > 240 and a[2] < 15)
        check('dip: at the cut = black', max(m) < 12)
        check('dip: half way = dark red, then dark blue', 40 < h1[0] < 220 and h1[2] < 15 and 40 < h2[2] < 220 and h2[0] < 15)
        check('dip: after window = blue', z[2] > 240 and z[0] < 15)
        # 2) undo / redo through the automatic undo
        await pg.evaluate("undo()"); check('undo removes it', await pg.evaluate("!S.frames[0].tre"))
        await pg.evaluate("redo()"); check('redo restores it', await pg.evaluate("S.frames[0].tre && S.frames[0].tre.k==='dip'"))
        # 3) duration slider changes the selected transition
        await pg.evaluate("const e=document.getElementById('trD'); e.value=0.4; e.dispatchEvent(new Event('change'))")
        check('duration 0.4', abs(await pg.evaluate("S.frames[0].tre.d") - 0.4) < 1e-6)
        a, = await pix(0.75); check('shorter window: 0.75 s still red', a[0] > 240)
        # 4) crossfade into frame 2 ("⏮ Đầu frame này" on frame 2) replaces nothing on frame 1 and mixes both pictures
        await pg.evaluate("S.frames[0].tre=undefined; S.cur=1; updateFrameUI(); fxSyncBar()")
        await pg.click('[data-trat=in]'); await pg.click('[data-trk=cross]'); await pg.wait_for_timeout(300)
        check('cross stored before frame 2', await pg.evaluate("S.frames[1].tr && S.frames[1].tr.k==='cross'"))
        check('strip mark on frame 2 left edge', await pg.evaluate("!!S.frames[1].el.querySelector('.trb.in')"))
        m1, = await pix(0.99); m2, = await pix(1.01); q, = await pix(0.8)
        print('cross', q, m1, m2)
        check('cross: red and blue mixed at the cut', all(90 < v[0] < 165 and 90 < v[2] < 165 for v in (m1, m2)))
        check('cross: early = mostly red', q[0] > 170 and q[2] < 85)
        await pg.screenshot(path='tcc_tab.png')
        # 5) 📺 TV off at the end of the film (after the last frame, 0.7 s: 2.3 … 3.0 s)
        await pg.evaluate("S.cur=2; updateFrameUI(); fxSyncBar()")
        await pg.click('[data-trat=out]'); await pg.click('[data-trk=tvoff]'); await pg.wait_for_timeout(300)
        check('tvoff at film end', await pg.evaluate("S.frames[2].tre && S.frames[2].tre.k==='tvoff' && S.frames[2].tre.snd===true") and 'kết thúc phim' in await pg.inner_text('#trStat'))
        e1 = await pix(2.3 + 0.7 * 0.2, [C, [W / 2, 4]]); e2 = await pix(2.3 + 0.7 * 0.65, [C, [W / 2, H * 0.3]]); e3 = await pix(2.999, [C, [W / 2, H * 0.3]])
        print('tv', e1, e2, e3)
        check('tv: squashing (top black, picture brightening in the middle)', max(e1[1]) < 12 and e1[0][1] > 150)
        check('tv: bright line in the middle, dark above', min(e2[0]) > 200 and max(e2[1]) < 12)
        check('tv: dark at the end', max(e3[1]) < 12 and max(e3[0]) < 90)
        # the TV-off click sound is real and gets scheduled at the transition
        check('tvoff sound not silent', await pg.evaluate("(async()=>{const b=await sfxBuffer('tvoff'); const d=b.getChannelData(0); let m=0; for(const v of d) m=Math.max(m,Math.abs(v)); return m>0.05})()"))
        check('tvoff sound scheduled', await pg.evaluate("(async()=>{const oc=new OfflineAudioContext(1,44100*4,44100); const st=[]; const orig=AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start=function(at,...r){st.push([this.buffer.duration,at]); return orig.call(this,at,...r)}; await scheduleAudio(oc,oc.destination,0,3,0); AudioBufferSourceNode.prototype.start=orig; return st.some(([d,at])=>Math.abs(d-SFX.tvoff.dur)<0.01 && at>2.3 && at<2.4)})()"))
        # 6) the other kinds draw without errors at many points (incl. two-picture ones)
        for k in ['white', 'tvon', 'wipe', 'zoom', 'glitch', 'iris']:
            await pg.evaluate(f"S.frames[1].tr={{k:'{k}',d:0.8,snd:true}}")
            v = [await pix(t) for t in (0.65, 0.9, 1.0, 1.1, 1.35)]
            print(k, [x[0] for x in v])
            check(f'{k} changes the picture around the cut', any(x[0] != [255, 0, 0] and x[0] != [0, 0, 255] for x in v))
        await pg.evaluate("S.frames[1].tr={k:'wipe',d:0.8,snd:true}")
        wl = await pix(1.0, [[W * 0.2, H / 2], [W * 0.8, H / 2]]); check('wipe: left already blue, right still red', wl[0][2] > 200 and wl[1][0] > 200)
        await pg.evaluate("S.frames[1].tr={k:'push',d:0.8,snd:true}")
        pl = await pix(1.0, [[W * 0.25, H / 2], [W * 0.75, H / 2]]); check('push: red leaving left, blue coming from right', pl[0][0] > 200 and pl[1][2] > 200)
        # film start: dip on frame 1 becomes a fade in from black
        await pg.evaluate("S.frames[0].tr={k:'dip',d:0.8,snd:true}")
        s0, = await pix(0.0); s1, = await pix(0.9); check('fade in at film start', max(s0) < 12 and s1[0] > 240)
        # tvoff can't go at film start
        await pg.evaluate("S.frames[0].tr=undefined; S.cur=0; updateFrameUI(); fxSyncBar()"); await pg.click('[data-trat=in]'); await pg.click('[data-trk=tvoff]')
        check('tvoff refused at film start', await pg.evaluate("!S.frames[0].tr"))
        # 7) GIF: frames inside a transition are split into 1/20 s pictures; still parts stay 1 picture
        n = await pg.evaluate("""(async()=>{let n=0, cs=0; const ge=gifEncoder; gifEncoder=(w,h)=>{const e=ge(w,h); const add=e.add; e.add=(d,c)=>{n++; cs+=Math.max(2,Math.round(c)); return add(d,c)}; return e}; deliverFile=async()=>{}; await exportGif(320); gifEncoder=ge; return [n, cs]})()""")
        print('gif pictures, total cs', n)
        check('gif split around transitions, length kept', n[0] > 20 and abs(n[1] - 300) < 15)
        # 8) playback with transitions runs
        await pg.click('#playBtn'); await pg.wait_for_timeout(1500); await pg.screenshot(path='tcc_play.png'); await pg.click('#playBtn')
        await pg.evaluate("S.cur=1; updateFrameUI(); fxSyncBar()"); await pg.click('[data-trat=in]'); await pg.click('#trPrev'); await pg.wait_for_timeout(300)
        check('preview plays', await pg.evaluate("playing")); await pg.wait_for_timeout(1800); check('preview stops by itself', not await pg.evaluate("playing"))
        # 9) remove + save/reload
        await pg.click('#trDel'); check('🗑 removes', await pg.evaluate("!S.frames[1].tr"))
        await pg.evaluate("S.frames[1].tr={k:'tvon',d:0.6,snd:false}; saveProject()"); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved transitions survive reload', await pg.evaluate("S.frames[1].tr && S.frames[1].tr.k==='tvon' && S.frames[1].tr.snd===false && S.frames[2].tre && S.frames[2].tre.k==='tvoff'"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
