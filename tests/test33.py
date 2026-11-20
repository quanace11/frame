import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Shorts safe-zone overlay: rail button cycles off → zone → zone + thirds; drawn on screen only, saved in settings
srv = subprocess.Popen(['python3','-m','http.server','8830'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8830/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # view pixel at doc top-left corner area before/after
        px = "(()=>{const m=viewMat(); const x=Math.round(m[0]*20+m[2]*20+m[4]), y=Math.round(m[1]*20+m[3]*20+m[5]); render(); return [...vctx.getImageData(x,y,1,1).data]})()"
        before = await pg.evaluate(px)
        await pg.click('#safeBtn'); await pg.wait_for_timeout(200)
        after = await pg.evaluate(px)
        print('safe on', await pg.evaluate('S.safe'), 'btn on', await pg.evaluate("document.getElementById('safeBtn').classList.contains('on')"), 'corner tinted', before != after and after[1] < before[1])
        r = await pg.evaluate("safeRect()"); print('safe rect inside frame', r['tall'] and r['x']>0 and r['x']+r['w']<1080 and r['y']+r['h']<1920)
        await pg.screenshot(path='t30_safe.png')
        await pg.keyboard.press('z'); await pg.wait_for_timeout(200); print('thirds', await pg.evaluate('S.safe'))
        await pg.screenshot(path='t30_thirds.png')
        print('saved in settings', await pg.evaluate("JSON.parse(localStorage.getItem('fs-settings')).safe"))
        # never baked into the exported frame
        print('not in export', await pg.evaluate("(()=>{const c=makeCanvas(W,H); drawFrameBase(c.getContext('2d'), curFrame(), bgOf(curFrame())); const d=c.getContext('2d').getImageData(20,20,1,1).data; return d[0]===255&&d[1]===255})()"))
        await pg.keyboard.press('z'); print('off again', await pg.evaluate('S.safe'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
