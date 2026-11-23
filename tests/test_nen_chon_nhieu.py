import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9142'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# Chọn nhiều frame → 🖼 Nền mới chung / 🖼 Dùng nền frame này
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
SPANS = "lgBgSpans().map(s=>[s.a+1,s.b+1])"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9142/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("setDur(100, true)")
        await pg.click('#lgBtn'); await pg.wait_for_timeout(200)
        await pg.click('#lgAddSec'); await pg.wait_for_timeout(500)
        ok('11 frames, one background', await pg.evaluate(SPANS) == [[1, 11]])
        # pick frames 3..6 with multi-select, then a new shared background
        await pg.click('#mselBtn'); await pg.wait_for_timeout(100)
        await pg.evaluate("msel.clear(); [2,3,4,5].forEach(i=>msel.add(S.frames[i].id)); mselSync()")
        await pg.click('#mselBar [data-ms=bgnew]'); await pg.wait_for_timeout(500)
        ok('frames 3-6 share a new background', await pg.evaluate(SPANS) == [[1, 2], [3, 6], [7, 11]], await pg.evaluate(SPANS))
        ok('Nền layer, on frame 3', await pg.evaluate("S.layer==='bg' && S.cur===2"), await pg.evaluate("[S.layer,S.cur]"))
        # paint on the shared background once: every selected frame shows it
        await pg.evaluate("(()=>{const c=bgOf(curFrame()).canvas.getContext('2d'); c.fillStyle='#f00'; c.fillRect(0,0,50,50); bgOf(curFrame()).ver++})()")
        ok('frames 3 and 6 use the same canvas', await pg.evaluate("bgOf(S.frames[2])===bgOf(S.frames[5]) && bgOf(S.frames[0])!==bgOf(S.frames[2])"))
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(400)
        ok('undo puts the background back', await pg.evaluate(SPANS) == [[1, 11]], await pg.evaluate(SPANS))
        # use the background of the frame on screen for some other frames (not next to each other)
        await pg.click('#redoBtn'); await pg.wait_for_timeout(400)
        await pg.evaluate("selectFrame(3)"); await pg.wait_for_timeout(200)
        await pg.evaluate("if(!mselOn) mselStart(); msel.clear(); [8,10].forEach(i=>msel.add(S.frames[i].id)); mselSync()")
        await pg.click('#mselBar [data-ms=bgcur]'); await pg.wait_for_timeout(500)
        ok('frames 9 and 11 take the background of frame 4', await pg.evaluate("S.frames[8].bgId===S.frames[3].bgId && S.frames[10].bgId===S.frames[3].bgId && S.frames[9].bgId!==S.frames[3].bgId"))
        await pg.screenshot(path='nen_chon_nhieu.png')
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
