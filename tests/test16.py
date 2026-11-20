import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8782'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1024,'height':1366}, accept_downloads=True)   # iPad portrait size
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8782/index.html'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='d0.png')
        await pg.click('.dlg .btns >> text=Làm video nhanh'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='d1.png')
        async with pg.expect_file_chooser() as fc: await pg.click('[data-wz=char]')
        ch = await fc.value; await ch.set_files(os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(600)
        print('import tab pp', await pg.evaluate("document.querySelector('[data-mode=pp]').classList.contains('on')"))
        await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200); await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000); await pg.wait_for_timeout(300)
        await pg.screenshot(path='d2.png')
        await pg.click('#wizBtn'); await pg.wait_for_timeout(300); await pg.click('[data-wz="act:walk"]'); await pg.wait_for_timeout(1500)
        print('frames after walk', await pg.evaluate('S.frames.length'), 'playing', await pg.evaluate('playing'))
        await pg.click('#playBtn')
        await pg.click('#wizBtn'); await pg.wait_for_timeout(300); await pg.click('[data-wz=text]'); await pg.wait_for_timeout(300)
        await pg.fill('#fxTxtIn','SIUUU'); await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='d3.png')
        await pg.click('#wizBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path='d4.png')
        await pg.click('[data-wz=video]'); await pg.wait_for_selector('text=Video đã xong', timeout=120000)
        print('video ok', await pg.inner_text('.dlg .body'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
