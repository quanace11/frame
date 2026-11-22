import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8778'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8778/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800); await pg.click('#refDone')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        print('before', await pg.evaluate('({ref:!!REF.c, pp:S.pp&&S.pp.parts.length, frames:S.frames.length})'))
        await pg.click('#delAllBtn'); await pg.click('.dlg .btns >> text=Xoá hết'); await pg.wait_for_timeout(600)
        print('after', await pg.evaluate('({ref:!!REF.c, pp:!!S.pp, frames:S.frames.length, tool:S.tool})'))
        await pg.wait_for_timeout(2200); await pg.reload(); await pg.wait_for_timeout(1500)
        print('after reload', await pg.evaluate('({ref:!!REF.c, pp:!!S.pp, frames:S.frames.length})'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
