import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Undo for deleting frames: Xoá (one frame, keeps its own background) and Xoá hết (everything) come back with ↶ / ↷.
# Also: landscape tablet layout gives the canvas more height and keeps the Menu button on screen.
srv = subprocess.Popen(['python3','-m','http.server','8847'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
PIX = "(([i,x,y])=>{const f=S.frames[i]; return ensureLoaded(f).then(()=>f.canvas.getContext('2d').getImageData(x,y,1,1).data[3])})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':800}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:8847/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # landscape layout
        m = await pg.evaluate("document.getElementById('menuBtn').getBoundingClientRect().bottom")
        check('menu button on screen', m <= 800)
        h = await pg.evaluate("document.getElementById('view').getBoundingClientRect().height")
        check('canvas area tall (>=540px)', h >= 540)
        check('frame bar one row', await pg.evaluate("document.getElementById('tlBar').getBoundingClientRect().height") < 60)
        await pg.screenshot(path='t47_land.png')
        # 3 frames; frame 2 gets its own background + a mark on char and bg
        await pg.click('#addBtn'); await pg.click('#addBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("S.cur=1; updateFrameUI()")
        await pg.evaluate("(async()=>{await newBg(false); const f=curFrame(); f.canvas.getContext('2d').fillRect(100,100,50,50); markEdited(f); const b=bgOf(f); b.canvas.getContext('2d').fillRect(300,300,40,40); markEdited(b);})()")
        await pg.wait_for_timeout(300)
        ids = await pg.evaluate("S.frames.map(f=>f.id)"); bgid = await pg.evaluate("S.frames[1].bgId")
        await pg.click('#delBtn'); await pg.wait_for_timeout(400)
        check('no confirm dialog for one frame', await pg.evaluate("!document.querySelector('.ov')"))
        check('frame removed', await pg.evaluate("S.frames.length") == 2)
        check('its background removed', await pg.evaluate(f"!S.bgs.some(b=>b.id==='{bgid}')"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        check('undo restores order', await pg.evaluate("S.frames.map(f=>f.id)") == ids)
        check('undo selects it', await pg.evaluate("S.cur") == 1)
        check('drawing back', await pg.evaluate(PIX, [1, 120, 120]) > 0)
        check('background back', await pg.evaluate(f"(()=>{{const b=S.bgs.find(b=>b.id==='{bgid}'); return !!b && b.canvas.getContext('2d').getImageData(310,310,1,1).data[3]>0}})()"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        check('redo deletes again', await pg.evaluate("S.frames.length") == 2)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        # delete all → undo brings everything back
        await pg.click('#delAllBtn'); await pg.wait_for_timeout(200); await pg.click('.dlg .btns >> text=Xoá hết'); await pg.wait_for_timeout(600)
        check('wiped to 1 frame', await pg.evaluate("S.frames.length") == 1)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(600)
        check('undo wipe restores frames', await pg.evaluate("S.frames.map(f=>f.id)") == ids)
        check('undo wipe restores drawing', await pg.evaluate(PIX, [1, 120, 120]) > 0)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        check('redo wipe', await pg.evaluate("S.frames.length") == 1)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        # survives save + reload
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved after undo', await pg.evaluate("S.frames.length") == 3 and await pg.evaluate(PIX, [1, 120, 120]) > 0)
        # portrait unchanged: rail is one column
        await pg.set_viewport_size({'width':800,'height':1280}); await pg.wait_for_timeout(300)
        check('portrait rail one column', await pg.evaluate("getComputedStyle(document.getElementById('rail')).display") == 'flex')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
