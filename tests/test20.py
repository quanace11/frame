import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8792'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1024,'height':1366}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8792/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for tool, bar in [('fx','#fxbar'),('vedit','#vecbar'),('puppet','#ppbar')]:
            await pg.click(f'[data-tool={tool}]'); await pg.wait_for_timeout(200)
            vis = lambda: pg.evaluate(f"!document.querySelector('{bar}').hidden")
            v1 = await vis()
            await pg.click(f'[data-close={tool}]'); await pg.wait_for_timeout(150)
            v2 = await vis(); pill = await pg.evaluate("!document.getElementById('panelPill').hidden")
            await pg.click('#panelPill'); await pg.wait_for_timeout(150); v3 = await vis()
            await pg.click(f'[data-tool={tool}]'); await pg.wait_for_timeout(150); v4 = await vis()
            await pg.click(f'[data-tool={tool}]'); await pg.wait_for_timeout(150); v5 = await vis()
            print(tool, 'open',v1,'closed',not v2,'pill',pill,'reopen',v3,'tap-tool-hide',not v4,'tap-again-show',v5)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
