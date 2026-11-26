import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9535'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 😂 Rung cả người: lip.sh on frames a..b moves the whole character in steps over film time (playing smoothly / exporting),
# still while editing, other frames untouched, one undo step, kept by copied frames, removable
LIVE = """(([i, t]) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  x.clearRect(0,0,W,H); ppLiveOver(i, t, false)(x); const d=x.getImageData(0,0,W,H).data; let y0=H; for (let y=0;y<H&&y0===H;y+=2) for (let X=0;X<W;X+=3) if (d[(y*W+X)*4+3]>100) { y0=y; break; } return y0; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9535/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("kitAdd()"); await pg.wait_for_timeout(500)
        await pg.evaluate("addFrame()"); await pg.wait_for_timeout(300); await pg.evaluate("S.frames[1].lip = null; S.frames.forEach(f => f.dur = 2000); selectFrame(0); setTool('puppet')"); await pg.wait_for_timeout(300)
        top0 = await pg.evaluate(LIVE, [0, 0.01])
        await pg.click('#shBtn'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='rung_ca_nguoi_hop_thoai.png')
        await pg.click('[data-shk="laugh"]'); await pg.click('.dlg .btns >> text=✓ Rung'); await pg.wait_for_timeout(400)
        await pg.evaluate("if (playing) stopPlay(); selectFrame(0)"); await pg.wait_for_timeout(200)
        st = await pg.evaluate("S.frames.map(f => Object.values((f.lip && f.lip.sh) || {}).map(o => o.k))")
        print('per frame', st)
        if st != [['laugh'], []]: errs.append('frame 1 should laugh, frame 2 not: %s' % st)
        # steps: at 6 steps/s, t=0.01 is "up", t=0.2 is "down": the top of the character moves; frame 2 does not
        up = await pg.evaluate(LIVE, [0, 0.01]); dn = await pg.evaluate(LIVE, [0, 0.2]); up2 = await pg.evaluate(LIVE, [0, 0.34])
        f2a = await pg.evaluate(LIVE, [1, 0.01]); f2b = await pg.evaluate(LIVE, [1, 0.2])
        print('top: before', top0, 'up', up, 'down', dn, 'up again', up2, 'frame2', f2a, f2b)
        if not (up < dn - 5): errs.append('the character does not jump up and down: %s %s' % (up, dn))
        if not (up2 < dn - 5): errs.append('the bounce does not repeat: %s %s' % (up2, dn))
        if f2a != f2b: errs.append('frame 2 moves without shake: %s %s' % (f2a, f2b))
        # editing view: still
        still = await pg.evaluate("(() => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); drawPuppet(x, curFrame().pp, curFrame().lip); const d=x.getImageData(0,0,W,H).data; let n=0; for (let i=3;i<d.length;i+=40) if (d[i]>100) n+=i; return n; })()")
        await pg.wait_for_timeout(300)
        still2 = await pg.evaluate("(() => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); drawPuppet(x, curFrame().pp, curFrame().lip); const d=x.getImageData(0,0,W,H).data; let n=0; for (let i=3;i<d.length;i+=40) if (d[i]>100) n+=i; return n; })()")
        if still != still2: errs.append('editing view moves')
        cp = await pg.evaluate("(()=>{ const f=frameCopyOf(S.frames[0]); return !!(f.lip && f.lip.sh) })()")
        if not cp: errs.append('frameCopyOf lost the shake')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200); u = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.sh).length")
        await pg.evaluate("redo()"); await pg.wait_for_timeout(200); r = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.sh).length")
        if u != 0 or r != 1: errs.append('undo/redo wrong %s %s' % (u, r))
        await pg.click('#shClear'); await pg.wait_for_timeout(200); await pg.click('.dlg .btns >> text=Mọi frame'); await pg.wait_for_timeout(200)
        if await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.sh).length"): errs.append('🗑 Bỏ left shake')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
