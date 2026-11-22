import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🌈 tab Hiệu ứng: 🏃 scrolling background (mirrored tiles, time-based shift), 💨 speed lines / 💥 focus lines,
# 🎨 film colour (blend modes), 📺 slow-motion replay (copies, slower, label, glitch, one undo), save/reload, undo
srv = subprocess.Popen(['python3','-m','http.server','8899'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
BASE = '''async ([i, pts]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawFrameBase(x, f, bg);
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
FX = '''async ([i, t, pts]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const base = makeCanvas(); drawFrameBase(base.getContext('2d'), f, bg); const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true });
  trSkip = true; drawFrameFx(x, i, base, 0, t); trSkip = false;
  if (pts === 'dark') { const d = x.getImageData(0, 0, W, H).data; let e = 0, m = 0; for (let y = 0; y < H; y += 4) for (let q = 0; q < W; q += 4) { const k = (y * W + q) * 4; if (d[k] < 90) { const r = Math.hypot((q - W / 2) / W, (y - H * 0.46) / H); if (r < 0.12) m++; else e++; } } return [e, m]; }
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
DARK = '''async (i) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawFrameBase(x, f, bg); const d = x.getImageData(0, 0, W, H).data;
  let n = 0, h = 0; for (let k = 0; k < d.length; k += 16) if (d[k] < 90) { n++; h = (h * 31 + k) % 1000003; } return [n, h]; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8899/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        W, H = await pg.evaluate("[W,H]")
        # background: red stripe on the right (x > 0.7W), white elsewhere; all frames share it
        await pg.evaluate("""(async()=>{ const bg = bgOf(S.frames[0]); await ensureLoaded(bg); const x = bg.canvas.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.fillStyle='#ff0000'; x.fillRect(W*0.7,0,W*0.3,H); bg.ver++;
          S.frames.forEach(f=>f.dur=250); S.cur=0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','look'); })()""")
        await pg.wait_for_timeout(300)
        check('all frames share the background', await pg.evaluate("S.frames.every(f=>f.bgId===S.frames[0].bgId)"))
        check('look tab buttons built', await pg.evaluate("document.querySelectorAll('[data-bgsd]').length===5 && document.querySelectorAll('[data-flt]').length===8 && document.querySelectorAll('[data-slk]').length===4"))
        # ---------- 🏃 scrolling background ----------
        await pg.fill('#lkN', '4'); await pg.dispatch_event('#lkN', 'change')
        await pg.click('[data-bgsv="0.8"]'); await pg.click('[data-bgsd="l"]'); await pg.wait_for_timeout(200)
        check('bgs on 4 frames', await pg.evaluate("S.frames.every(f=>f.bgs && f.bgs.d==='l' && f.bgs.v===0.8)"))
        offs = await pg.evaluate("S.frames.map((f,i)=>bgsOff(i))")
        print('offsets', offs)
        check('shift grows with time', offs[0] == [0, 0] and abs(offs[1][0] + 0.2 * W) <= 1 and abs(offs[2][0] + 0.4 * W) <= 1 and offs[3][0] < offs[2][0])
        px0 = await pg.evaluate(BASE, [0, [[W*0.35, H/2], [W*0.8, H/2]]])
        px2 = await pg.evaluate(BASE, [2, [[W*0.1, H/2], [W*0.35, H/2], [W*0.62, H/2]]])
        print('frame0', px0, 'frame2', px2)
        check('frame 0 unshifted', px0[0] == [255, 255, 255] and px0[1] == [255, 0, 0])
        check('frame 2: picture slid left, mirrored copy joins on the right', px2[0] == [255, 255, 255] and px2[1] == [255, 0, 0] and px2[2] == [255, 0, 0])
        await pg.evaluate("buildPlayCache()"); await pg.wait_for_timeout(300)
        check('play cache key includes the shift', await pg.evaluate("S.frames[2].playKey.includes('b-')"))
        await pg.click('[data-bgsd="r"]'); await pg.wait_for_timeout(100)
        check('direction right: positive shift', await pg.evaluate("bgsOff(2)[0] > 0"))
        # stops at a scene start
        await pg.evaluate("S.frames[2].scene='Cảnh 2'")
        check('shift restarts at a scene', await pg.evaluate("bgsOff(2)[0]===0 && bgsOff(3)[0]>0"))
        await pg.evaluate("delete S.frames[2].scene")
        await pg.click('[data-bgsd=""]'); await pg.wait_for_timeout(100)
        check('background off', await pg.evaluate("S.frames.every(f=>!f.bgs) && bgsOff(2)===null"))
        # ---------- 💨 speed lines ----------
        await pg.click('[data-slc="#111111"]'); await pg.click('[data-slk="h"]'); await pg.wait_for_timeout(100)
        check('speed lines set', await pg.evaluate("S.frames.every(f=>f.sl && f.sl.k==='h' && f.sl.c==='#111111')"))
        d0 = await pg.evaluate(DARK, 0); d1 = await pg.evaluate(DARK, 1)
        print('dark speed-line pixels', d0, d1)
        check('speed lines drawn, different on each frame', d0[0] > 200 and d1[0] > 200 and d0[1] != d1[1])
        # ---------- 💥 focus lines ----------
        await pg.click('[data-slk="focus"]'); await pg.wait_for_timeout(100)
        fl = await pg.evaluate(FX, [0, 0, 'dark']); fl2 = await pg.evaluate(FX, [0, 0.2, 'dark'])
        print('focus edge/middle', fl, fl2)
        check('focus lines at the edges, middle stays clear', fl[0] > 2000 and fl[1] == 0)
        check('focus lines shimmer in time', fl != fl2)
        await pg.screenshot(path='hieu_ung_focus.png')
        await pg.click('[data-slk=""]')
        # ---------- 🎨 film colour ----------
        await pg.click('[data-flt="bw"]'); await pg.wait_for_timeout(100)
        c = await pg.evaluate(FX, [0, 0, [[W*0.85, H/2]]])
        print('bw red →', c)
        check('black & white: red becomes grey', abs(c[0][0] - c[0][1]) < 6 and abs(c[0][1] - c[0][2]) < 6)
        await pg.wait_for_timeout(600); await pg.click('[data-flt="rage"]'); await pg.wait_for_timeout(100)
        c = await pg.evaluate(FX, [0, 0, [[W*0.35, H/2]]])
        print('rage white →', c)
        check('rage: white turns red', c[0][0] > 200 and c[0][1] < 160)
        check('status line', 'giận đỏ' in await pg.inner_text('#lkStat'))
        await pg.wait_for_timeout(600); await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        check('undo goes back to black & white', await pg.evaluate("S.frames[0].flt==='bw'"))
        await pg.click('[data-flt=""]'); await pg.wait_for_timeout(600)
        check('colour off', await pg.evaluate("S.frames.every(f=>!f.flt)"))
        # ---------- 📺 replay ----------
        await pg.evaluate("S.cur=3; updateFrameUI(); S.frames[1].bgs={d:'l',v:0.8}"); await pg.wait_for_timeout(500)
        await pg.fill('#rpN', '4'); await pg.dispatch_event('#rpN', 'change'); await pg.click('[data-rps="2"]')
        await pg.click('#rpGo'); await pg.wait_for_timeout(800)
        r = await pg.evaluate("({n:S.frames.length, flt:S.frames.slice(4).every(f=>f.flt==='replay'), dur:S.frames.slice(4).map(f=>f.dur), lbl:S.frames.slice(4).every(f=>f.texts.some(t=>t.str.includes('PHÁT LẠI'))), tr:S.frames[4].tr&&S.frames[4].tr.k, bgs:!!S.frames[5].bgs, orig:S.frames.slice(0,4).every(f=>!f.flt), cur:S.cur})")
        print('replay', r)
        check('replay copies added after the action', r['n'] == 8 and r['flt'] and r['dur'] == [500]*4 and r['lbl'] and r['tr'] == 'glitch' and r['bgs'] and r['orig'] and r['cur'] == 4)
        lid = await pg.evaluate("S.frames[4].texts.find(t=>t.str.includes('PHÁT LẠI')).id")
        check('label is one text run (animates once)', await pg.evaluate(f"JSON.stringify(txRun(5,'{lid}'))") == '[4,7]')
        await pg.screenshot(path='hieu_ung_replay.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('replay is one undo step', await pg.evaluate("S.frames.length") == 4)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300)
        check('redo brings it back', await pg.evaluate("S.frames.length") == 8)
        # multi-select range
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        await pg.evaluate("mselStart(); msel.add(S.frames[0].id); msel.add(S.frames[1].id); mselSync()"); await pg.click('[data-rps="3"]'); await pg.click('#rpGo'); await pg.wait_for_timeout(600)
        check('replay of selected frames, 3× slower, right after them', await pg.evaluate("S.frames.length===6 && S.frames[2].flt==='replay' && S.frames[2].dur===750 && S.frames[4].flt!=='replay'"))
        await pg.evaluate("typeof mselEnd==='function' && mselEnd()")
        # ---------- save / reload ----------
        await pg.evaluate("S.frames[0].bgs={d:'u',v:1.6}; S.frames[0].sl={k:'v',c:'#ffd23f'}; S.frames[0].flt='night'; saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved effects survive reload', await pg.evaluate("S.frames[0].bgs.d==='u' && S.frames[0].sl.k==='v' && S.frames[0].flt==='night' && S.frames[2].flt==='replay' && S.frames.length===6"))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
