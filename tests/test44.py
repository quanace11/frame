import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🏞 scene library: menu → pick a scene → background filled (shared bg / only this frame), undo, 16:9 project
srv = subprocess.Popen(['python3','-m','http.server','8842'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
BGPIX = "(i=>{const b=bgOf(S.frames[i]); const d=b.canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let k=3;k<d.length;k+=4*97) if(d[k]>200) n++; return n/(d.length/4/97); })"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8842/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.wait_for_timeout(200); await pg.evaluate("S.cur=0; updateFrameUI()")
        print('shared bg', await pg.evaluate("S.frames[0].bgId===S.frames[1].bgId"))
        await pg.click('#menuBtn'); await pg.click('[data-m=scene]'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("document.querySelectorAll('#scGrid [data-scene]').length"); print('scenes', n, n >= 10)
        await pg.screenshot(path='t42_dialog.png')
        await pg.click('[data-scene=classroom]'); await pg.wait_for_timeout(400)
        print('bg filled', await pg.evaluate(BGPIX, 0) > 0.99, 'both frames', await pg.evaluate(BGPIX, 1) > 0.99)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); print('undo clears', await pg.evaluate(BGPIX, 0) < 0.01)
        # only this frame → new bg for frame 1, frame 0 keeps empty
        await pg.evaluate("S.cur=1; updateFrameUI()")
        await pg.evaluate("sceneDialog()"); await pg.wait_for_timeout(300); await pg.click('[data-sco="1"]'); await pg.click('[data-scene=beach]'); await pg.wait_for_timeout(500)
        print('only this frame', await pg.evaluate("S.frames[0].bgId!==S.frames[1].bgId"), await pg.evaluate(BGPIX, 1) > 0.99, await pg.evaluate(BGPIX, 0) < 0.01)
        print('layer back to char', await pg.evaluate("S.layer") == 'char')
        await pg.screenshot(path='t42_beach.png')
        # wizard button
        await pg.click('#wizBtn'); await pg.wait_for_timeout(300); await pg.click('[data-wz=scene]'); await pg.wait_for_timeout(300)
        print('wizard opens dialog', await pg.evaluate("!!document.querySelector('#scGrid')")); await pg.click('.dlg .btns >> text=Đóng')
        # 16:9 project: scene adapts
        await pg.evaluate("newProject && newProject(1920,1080)") if await pg.evaluate("typeof newProject==='function' && newProject.length>=2") else None
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
