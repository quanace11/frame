import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8969'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# Dòng layer: ＋ 1 giây (thêm frame tự chuyển đủ 1 giây), dòng 🖼 Nền (mỗi nền 1 thanh, kéo cuối thanh để kéo dài), 🖼 Nền mới từ đây
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
SPANS = "lgBgSpans().map(s=>[s.a+1,s.b+1])"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8969/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("setDur(100, true)")
        await pg.click('#lgBtn'); await pg.wait_for_timeout(200)
        await pg.click('#lgAddSec'); await pg.wait_for_timeout(500)
        ok('＋ 1 giây adds 10 frames of 0.1 s', await pg.evaluate('S.frames.length') == 11, await pg.evaluate('S.frames.length'))
        ok('one background span', await pg.evaluate(SPANS) == [[1, 11]])
        await pg.evaluate('selectFrame(5)'); await pg.wait_for_timeout(200)
        await pg.click('#lgBgNew'); await pg.wait_for_timeout(400)
        ok('new background from frame 6', await pg.evaluate(SPANS) == [[1, 5], [6, 11]] and await pg.evaluate("S.layer==='bg'"), await pg.evaluate(SPANS))
        await pg.wait_for_timeout(600)
        # drag the end of Nền 1 (frame 5) to frame 8
        pt = await pg.evaluate('''(()=>{const cv=$('#lgCv'), r=cv.getBoundingClientRect(), ri=lgRows().length-1; return {y:r.top+LG.hd+ri*LG.rh+LG.rh/2, x0:r.left+4*LG.cw+LG.cw/2, x1:r.left+7*LG.cw+LG.cw/2}})()''')
        await pg.mouse.move(pt['x0'], pt['y']); await pg.mouse.down(); await pg.mouse.move(pt['x1'], pt['y'], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(500)
        ok('Nền 1 stretched to frame 8', await pg.evaluate(SPANS) == [[1, 8], [9, 11]], await pg.evaluate(SPANS))
        await pg.screenshot(path='nen_theo_doan.png')
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(400)
        ok('undo puts it back', await pg.evaluate(SPANS) == [[1, 5], [6, 11]], await pg.evaluate(SPANS))
        # shrink the last span: the frames let go get a new empty background
        await pg.evaluate('lgBgStretch(lgBgSpans()[1], 8)'); await pg.wait_for_timeout(400)
        ok('shrink the last span', await pg.evaluate(SPANS) == [[1, 5], [6, 9], [10, 11]], await pg.evaluate(SPANS))
        # tap the Nền row = the Nền layer of that frame
        await pg.evaluate("setLayer('char')"); await pg.mouse.click(pt['x0'], pt['y']); await pg.wait_for_timeout(300)
        ok('tap the row picks the background layer at that frame', await pg.evaluate("S.layer==='bg' && S.cur===4"))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
