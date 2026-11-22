import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8770'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8770/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ')
        for kind,name in [('ink','i1.png'),('photo','i2.png')]:
            await pg.click(f'[data-lk={kind}]')
            await pg.wait_for_timeout(300)
            await pg.wait_for_function('document.getElementById("impBusy").hidden && document.getElementById("iVecInfo") && document.getElementById("iVecInfo").textContent', timeout=60000)
            await pg.wait_for_timeout(300)
            print(kind, await pg.inner_text('#iVecInfo'))
            await pg.locator('.imp-prev').screenshot(path=name)
        print('ERR',errs); await b.close()
asyncio.run(main()); srv.kill()
