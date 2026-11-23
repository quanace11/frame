import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9144'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ☑ Chọn nhiều frame → 🙈 Ẩn ở frame này ẩn layer ở mọi frame đã chọn (vd. cánh tay chỉ thò vào ở 3 frame cuối)
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
FIG = "(async()=>{const c=document.createElement('canvas');c.width=200;c.height=400;const x=c.getContext('2d');x.fillStyle='#e53935';x.fillRect(40,40,120,320);await imgToLayer(c,null,'Tay')})()"
OFF = "S.frames.map(f=>ppOffAt(f, lyrRoots()[0].id)?1:0).join('')"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9144/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate(FIG); await pg.wait_for_timeout(300)
        await pg.evaluate("setDur(100, true)")
        await pg.click('#lgBtn'); await pg.wait_for_timeout(200)
        await pg.click('#lgAddSec'); await pg.wait_for_timeout(500)
        await pg.evaluate("setTool('puppet'); ppSel = lyrRoots()[0].id; ppSyncBar()")
        ok('11 frames, layer shown everywhere', await pg.evaluate(OFF) == '0' * 11, await pg.evaluate(OFF))
        # select frames 1..8 and hide there
        await pg.click('#mselBtn'); await pg.wait_for_timeout(100)
        await pg.evaluate("msel.clear(); for(let i=0;i<8;i++) msel.add(S.frames[i].id); mselSync()")
        ok('button says it works on the selected frames', '8 frame' in await pg.inner_text('#ppOffBtn'), await pg.inner_text('#ppOffBtn'))
        await pg.click('#ppOffBtn'); await pg.wait_for_timeout(300)
        ok('hidden on frames 1-8 only', await pg.evaluate(OFF) == '1' * 8 + '000', await pg.evaluate(OFF))
        await pg.screenshot(path='an_nhieu_frame.png')
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(400)
        ok('one undo shows it again everywhere', await pg.evaluate(OFF) == '0' * 11, await pg.evaluate(OFF))
        await pg.click('#redoBtn'); await pg.wait_for_timeout(400)
        ok('redo hides it again', await pg.evaluate(OFF) == '1' * 8 + '000', await pg.evaluate(OFF))
        # pressing again with all selected hidden = show them again
        await pg.click('#ppOffBtn'); await pg.wait_for_timeout(300)
        ok('second press shows them again', await pg.evaluate(OFF) == '0' * 11, await pg.evaluate(OFF))
        # without multi-select: only the frame on screen
        await pg.click('#mselBar [data-ms=done]'); await pg.evaluate("selectFrame(9)"); await pg.wait_for_timeout(200)
        await pg.click('#ppOffBtn'); await pg.wait_for_timeout(300)
        ok('no multi-select: just this frame', await pg.evaluate(OFF) == '0' * 9 + '10', await pg.evaluate(OFF))
        # 📍 Hiện ở… → from this frame on
        await pg.evaluate("selectFrame(9); ppSel = lyrRoots()[0].id; ppSyncBar()"); await pg.wait_for_timeout(200)
        await pg.click('#ppShowBtn'); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=Từ frame 10 trở đi'); await pg.wait_for_timeout(300)
        ok('📍 from frame 10 on', await pg.evaluate(OFF) == '1' * 9 + '00', await pg.evaluate(OFF))
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(400)
        ok('one undo puts it back', await pg.evaluate(OFF) == '0' * 9 + '10', await pg.evaluate(OFF))
        await pg.click('#ppShowBtn'); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=Mọi frame'); await pg.wait_for_timeout(300)
        ok('📍 every frame', await pg.evaluate(OFF) == '0' * 11, await pg.evaluate(OFF))
        # a picture drawn on the last frame → 🧩 Thành mảnh ghép asks where it shows
        await pg.evaluate("selectFrame(10)"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const c=document.createElement('canvas');c.width=160;c.height=120;const x=c.getContext('2d');x.fillStyle='#fdd835';x.fillRect(0,0,160,120);floatFromImage(c);floating.scale=1;floating.cx=900;floating.cy=400;showSelbar();requestRender()})()")
        await pg.wait_for_timeout(200); await pg.click('#selPart'); await pg.wait_for_timeout(500)
        ok('Thành mảnh ghép asks where it shows', await pg.locator('.dlg .btns >> text=Chỉ frame này').count() == 1)
        await pg.click('.dlg .btns >> text=Chỉ frame này'); await pg.wait_for_timeout(300)
        OFF2 = "S.frames.map(f=>ppOffAt(f, ppSelChar())?1:0).join('')"
        ok('new picture only on frame 11', await pg.evaluate(OFF2) == '1' * 10 + '0', await pg.evaluate(OFF2))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
