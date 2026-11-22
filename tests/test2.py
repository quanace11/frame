import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8765'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820})
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.location.get('url','') and '403' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        # ref mode
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'cartoon.png')); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
        print('ref', await pg.evaluate('({has:!!REF.c, edit:refEdit})'))
        await pg.click('#refDone'); await pg.screenshot(path='r1.png')
        # line mode
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'cartoon.png')); await pg.wait_for_timeout(500)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ'); await pg.wait_for_timeout(800); await pg.click('[data-lo=px]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='r2.png')
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        print('floating line', await pg.evaluate('!!floating')); await pg.click('#selDone')
        # cut AI
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'cartoon.png')); await pg.wait_for_timeout(500)
        await pg.click('.imp-tabs >> text=Tách nhân vật'); 
        t=time.time()
        await pg.wait_for_function('!document.getElementById("impBusy") || document.getElementById("impBusy").hidden', timeout=60000)
        await pg.wait_for_timeout(500); print('ai secs', round(time.time()-t,1), 'aiA', await pg.evaluate('typeof ortSession'))
        await pg.screenshot(path='r3.png')
        await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200); await pg.screenshot(path='r4.png')
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500); await pg.click('#selDone')
        await pg.wait_for_timeout(2200); print('save', await pg.inner_text('#saveState'))
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('ref after reload', await pg.evaluate('!!REF.c'))
        await pg.screenshot(path='r5.png')
        print('ERRORS', errs)
        await b.close()
asyncio.run(main()); srv.kill()
