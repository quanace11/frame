import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8848'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# Import a coloured cartoon -> 🎨 Tách nét + màu: dark outlines go to the Nhân vật layer, the picture's own colours go to
# the Màu layer and run under the lines, so erasing every line leaves (almost) no hole. Also the 🧩 "Làm sạch" switch.
STATS = '''()=>{ const f=curFrame(), n=W*H, a=f.canvas.getContext('2d').getImageData(0,0,W,H).data, c=f.col?f.col.getContext('2d').getImageData(0,0,W,H).data:null;
  let line=0, col=0, under=0, dark=0, colored=0;
  for(let i=0;i<n;i++){ const j=i*4; if(a[j+3]>128){ line++; if(a[j]+a[j+1]+a[j+2]<300) dark++; if(c&&c[j+3]>128) under++; }
    if(c&&c[j+3]>128){ col++; const mx=Math.max(c[j],c[j+1],c[j+2]), mn=Math.min(c[j],c[j+1],c[j+2]); if(mx-mn>40) colored++; } }
  return {line, col, under, dark, colored}; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8848/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate('S.impLayer = false')   # this test checks the old flow: picture as a floating selection (🗂 layer riêng tắt)
        fails = []
        def check(name, ok, extra=''):
            print(name, ok, extra)
            if not ok: fails.append(name)
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=split]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden && document.querySelector('#iSplitInfo').textContent", timeout=180000); await pg.wait_for_timeout(300)
        check('plain background -> colour cut', await pg.evaluate("document.querySelector('[data-cm].on').dataset.cm") == 'color')
        check('lines found', '✓' in await pg.evaluate("document.querySelector('#iSplitInfo').textContent"))
        await pg.screenshot(path='split_dialog.png')
        await pg.click('[data-sp="view:line"]'); await pg.wait_for_timeout(600); await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=60000)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        check('floating carries colour', await pg.evaluate("!!(floating && floating.cc && floating.csnap)"))
        await pg.click('#selDone'); await pg.wait_for_timeout(300)
        s = await pg.evaluate(STATS); print(s)
        check('lines in Nhân vật layer', s['line'] > 2000 and s['dark'] > 0.8 * s['line'])
        check('colours in Màu layer', s['col'] > 5 * s['line'] and s['colored'] > 0.2 * s['col'])
        check('colour runs under the lines', s['under'] > 0.85 * s['line'], round(s['under'] / max(1, s['line']), 3))
        await pg.screenshot(path='split_placed.png')
        # erase every line: the colour must still be there with no holes where the lines were
        await pg.evaluate("(()=>{const f=curFrame(); f.canvas.getContext('2d').clearRect(0,0,W,H); f.ver++; requestRender();})()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='split_lines_erased.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        s2 = await pg.evaluate(STATS)
        check('one undo removes the import (lines + colour)', s2['col'] == 0, s2)
        # 🧩 Nhân vật ghép with "Làm sạch"
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(200)
        await pg.click('#iPPClean'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden && document.querySelector('#iSSens')", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        check('clean image goes to the body-part cutting', await pg.evaluate("!!(ppSetup && ppSetup.J && ppSetup.J.head)"))
        print('fails', fails)
        print('ERR', errs + fails); await b.close()
asyncio.run(main()); srv.kill()
