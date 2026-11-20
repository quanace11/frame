import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8799'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Caricature import: photo -> cut out person -> big head / small body / cartoon colours -> floating selection or puppet
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':960}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8799/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        for name, wait_ai in (('portrait.png', True), ('photoish.png', False)):
            await pg.set_input_files('#imgFile', os.path.join(ASSETS, name)); await pg.wait_for_timeout(400)
            await pg.click('[data-mode=cari]')
            t=time.time()
            await pg.wait_for_function("document.querySelector('#impBusy').hidden && document.querySelector('#impCv').width>0 && document.querySelector('#impCv').height>0 && document.querySelector('#iCHead')", timeout=180000)
            await pg.wait_for_timeout(1500)
            await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000)
            print(name, 'secs', round(time.time()-t,1), 'size', await pg.evaluate("[impCv.width, impCv.height]"))
            await pg.screenshot(path=f'cari_{name}')
            # change style + head size -> result changes, still no error
            w0 = await pg.evaluate("impCv.width")
            await pg.click('[data-cs=bw]'); await pg.wait_for_timeout(300); await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=60000)
            await pg.evaluate("(()=>{const e=document.querySelector('#iCHead'); e.value=200; e.dispatchEvent(new Event('input'))})()"); await pg.wait_for_timeout(1200)
            print(name, 'bigger head -> wider', await pg.evaluate("impCv.width") >= w0)
            await pg.screenshot(path=f'cari_bw_{name}')
            url = await pg.evaluate("impCv.toDataURL()"); open(f'cari_res_{name}','wb').write(base64.b64decode(url.split(',')[1]))
            if name == 'portrait.png':
                await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
                print('floating placed', await pg.evaluate("!!floating && floating.c.width>0"))
                await pg.evaluate("commitFloating()")
            else:
                await pg.click('[data-co=pp]'); await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
                print('puppet setup opened', await pg.evaluate("!!document.querySelector('#ppCutAuto')"))
                await pg.screenshot(path='cari_pp.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
