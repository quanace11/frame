import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Adjustable onion skin (frames before/after) + copy a lasso selection and paste it onto other frames
srv = subprocess.Popen(['python3','-m','http.server','8833'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
A = "(([i,x,y])=>S.frames[i].canvas.getContext('2d').getImageData(x,y,1,1).data[3])"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8833/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for _ in range(5): await pg.click('#addBtn'); await pg.wait_for_timeout(100)
        await pg.evaluate("selectFrame(2)"); await pg.wait_for_timeout(200)
        print('default onion', await pg.evaluate("onionList().map(x=>x[0])"))
        # long-press opens the onion dialog
        bb = await pg.query_selector('#onionBtn'); box = await bb.bounding_box()
        await pg.mouse.move(box['x']+10, box['y']+10); await pg.mouse.down(); await pg.wait_for_timeout(700); await pg.mouse.up()
        await pg.wait_for_timeout(200); print('dialog open', await pg.evaluate("!!document.querySelector('[data-ok=onionPrev]')"), 'onion still on', await pg.evaluate('S.onion'))
        await pg.click('[data-ok=onionPrev][data-n="2"]'); await pg.click('[data-ok=onionNext][data-n="0"]')
        await pg.screenshot(path='t33_onion.png'); await pg.click('.dlg .btns >> text=Xong')
        L = await pg.evaluate("onionList()"); print('onion 2 prev 0 next', [x[0] for x in L], 'fades', L[0][2] < L[1][2])
        await pg.evaluate("render()")
        # copy / paste
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{const x=curFrame().canvas.getContext('2d'); x.fillStyle='#e00'; x.fillRect(100,100,80,80); curFrame().ver++; setTool('lasso'); liftSelection([{x:90,y:90},{x:190,y:90},{x:190,y:190},{x:90,y:190}]); floating.cx+=200;})()")
        await pg.click('#selCopy'); print('paste btn shown', await pg.evaluate("!document.getElementById('pasteBtn').hidden"))
        await pg.click('#selDone')
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200)
        await pg.click('#pasteBtn'); await pg.wait_for_timeout(200)
        await pg.fill('#pasteN', '3'); await pg.click('.dlg .btns >> text=Dán nhiều frame'); await pg.wait_for_timeout(500)
        print('pasted frames 2-4 at moved spot', [await pg.evaluate(A+f"([{i},340,140])")>0 for i in (1,2,3)], 'not frame 5', await pg.evaluate(A+"([4,340,140])")==0)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo removes all', [await pg.evaluate(f"(async()=>{{await ensureLoaded(S.frames[{i}]); return S.frames[{i}].canvas.getContext('2d').getImageData(340,140,1,1).data[3]}})()")==0 for i in (1,2,3)])
        # paste & adjust by hand
        await pg.click('#pasteBtn'); await pg.click('.dlg .btns >> text=Dán & chỉnh tay'); await pg.wait_for_timeout(200)
        print('floating paste', await pg.evaluate("!!floating && Math.round(floating.cx)"))
        await pg.click('#selDone'); print('committed', await pg.evaluate(A+"([1,340,140])")>0)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
