import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 📸 Paparazzi (tab Hiệu ứng): star-burst flashes at random spots in time, face glow, shutter sounds, "Kéo dài" seconds,
# density, off, undo, save/reload, frame copy keeps it
srv = subprocess.Popen(['python3','-m','http.server','9547'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# final picture of frame i at time t (null = still) → [sum of brightness, pixels asked]
FX = '''async ([i, t, pts]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const base = makeCanvas(); drawFrameBase(base.getContext('2d'), f, bg); const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true });
  if (t === null) trSkip = true; drawFrameFx(x, i, base, 0, t || 0); trSkip = false;
  const d = x.getImageData(0, 0, W, H).data; let s = 0; for (let k = 0; k < d.length; k += 64) s += d[k];
  return [s, pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3)))]; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9547/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(2): await pg.click('#addBtn')
        W, H = await pg.evaluate("[W,H]")
        # dark background, a grey "head" drawn on every frame
        await pg.evaluate("""(async()=>{ const bg = bgOf(S.frames[0]); await ensureLoaded(bg); const x = bg.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,W,H); bg.ver++;
          for (const f of S.frames) { await ensureLoaded(f); const c = f.canvas.getContext('2d'); c.fillStyle='#505050'; c.beginPath(); c.arc(W/2, H*0.3, 110, 0, 7); c.fill(); c.fillRect(W/2-60, H*0.3, 120, 500); f.ver++; f.dur = 500; }
          S.cur=0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','look'); })()""")
        await pg.wait_for_timeout(300)
        check('paparazzi buttons built', await pg.evaluate("document.querySelectorAll('[data-pzn]').length===3 && document.querySelectorAll('[data-pzd]').length===4 && !!$('#pzOn')"))
        await pg.click('[data-pzn="12"]'); await pg.click('[data-pzd="1"]')
        if not await pg.is_checked('#pzG'): await pg.check('#pzG')
        if not await pg.is_checked('#pzS'): await pg.check('#pzS')
        await pg.click('#pzOn'); await pg.wait_for_timeout(700)
        r = await pg.evaluate("S.frames.map(f=>f.pz||null)")
        print('pz', r)
        check('1 second = 2 frames of 0.5 s', r[0] and r[1] and r[2] is None and r[0]['n'] == 12 and r[0]['g'] == 1 and r[0]['snd'] == 1 and r[0]['s'] == r[1]['s'])
        check('head found for the glow', r[0].get('h') and abs(r[0]['h'][0] - W/2) < 40)
        ev = await pg.evaluate("pzEvents(0)")
        check('about 12 flashes a second', 4 <= len(ev) <= 8 and ev == await pg.evaluate("pzEvents(0)"))
        check('frames get different flashes', ev != await pg.evaluate("pzEvents(1)"))
        e = ev[0]
        lit = await pg.evaluate(FX, [0, e['t'] + 0.02, [[e['x'], e['y']]]])
        print('lit at flash', lit[1])
        check('flash bright at its spot while lit', min(lit[1][0]) > 230)
        # a moment with nothing lit: picture as without the effect
        quiet = await pg.evaluate("(()=>{ const E = pzEvents(0); for (let t = 0; t < 0.5; t += 0.005) if (!pzLit(0, t).length) return t; return null; })()")
        print('quiet moment', quiet)
        if quiet is not None:
            q = await pg.evaluate(FX, [0, quiet, [[e['x'], e['y']]]])
            check('dark again when no flash is lit', max(q[1][0]) < 60 and q[0] < lit[0])
        # face glow: same moment with g on / off
        hx, hy = r[0]['h'][0], r[0]['h'][1]
        on = await pg.evaluate(FX, [0, e['t'] + 0.02, [[hx, hy]]])
        await pg.evaluate("S.frames[0].pz = { ...S.frames[0].pz, g: 0 }")
        off = await pg.evaluate(FX, [0, e['t'] + 0.02, [[hx, hy]]])
        await pg.evaluate("S.frames[0].pz = { ...S.frames[0].pz, g: 1 }")
        print('head glow on/off', on[1], off[1])
        check('face lights up with the flash', on[1][0][0] > off[1][0][0] + 25)
        st = await pg.evaluate(FX, [0, None, [[0, 0]]])
        base = await pg.evaluate(FX, [2, None, [[0, 0]]])
        check('still picture (PNG / cover / edit screen) shows flashes', st[0] > base[0] * 1.05)
        check('GIF splits the flash frames', await pg.evaluate("pzWins(frameStartTimes()).length===2"))
        # shutter sounds: render the mix offline
        snd = await pg.evaluate("""(async()=>{ const en = async () => { const oc = new OfflineAudioContext(1, 44100, 44100); await scheduleAudio(oc, oc.destination, 0, 1, 0); const b = await oc.startRendering(); const d = b.getChannelData(0); let s = 0; for (let k = 0; k < d.length; k++) s += Math.abs(d[k]); return s; };
          const a = await en(); const keep = S.frames.map(f=>f.pz); S.frames.forEach(f=>{ if (f.pz) f.pz = { ...f.pz, snd: 0 }; }); const z = await en(); S.frames.forEach((f,i)=>{ f.pz = keep[i]; }); return [a, z]; })()""")
        print('sound energy with/without', snd)
        check('shutter clicks in the mix', snd[0] > 5 and snd[1] < 0.01)
        await pg.screenshot(path='paparazzi_edit.png')
        check('status line', 'paparazzi' in await pg.inner_text('#lkStat'))
        # density change on the run
        await pg.click('[data-pzn="22"]'); await pg.wait_for_timeout(100)
        check('density changes the whole run', await pg.evaluate("S.frames[0].pz.n===22 && S.frames[1].pz.n===22"))
        # copy keeps it
        check('frame copy keeps the effect', await pg.evaluate("(async()=>{ await ensureLoaded(S.frames[0]); const f = frameCopyOf(S.frames[0]); return !!f.pz && f.pz.s===S.frames[0].pz.s; })()"))
        # longer than the film: last frame grows
        await pg.wait_for_timeout(600)
        await pg.evaluate("S.cur=2; updateFrameUI()"); await pg.click('[data-pzd="2"]'); await pg.click('#pzOn'); await pg.wait_for_timeout(700)
        check('last frame made longer to last 2 s', await pg.evaluate("S.frames[2].dur===2000 && !!S.frames[2].pz"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo takes it back', await pg.evaluate("S.frames[2].dur===500 && !S.frames[2].pz && !!S.frames[1].pz"))
        # off on the run
        await pg.evaluate("S.cur=1; updateFrameUI()"); await pg.click('#pzOff'); await pg.wait_for_timeout(700)
        check('off on the whole run', await pg.evaluate("S.frames.every(f=>!f.pz)"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo turns it back on', await pg.evaluate("!!S.frames[0].pz && !!S.frames[1].pz"))
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved effect survives reload', await pg.evaluate("!!S.frames[0].pz && S.frames[0].pz.n===22 && !!S.frames[1].pz && !S.frames[2].pz"))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
