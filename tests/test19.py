import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# its own build: rebuilding the shared dist/ would change the app under the tests running beside it
DIST = os.path.join(OUT, 'dist19'); BENV = dict(os.environ, FS_DIST=DIST)
subprocess.run([sys.executable, os.path.join(ROOT,'tools','build.py')], env=BENV, capture_output=True, check=True)
srv = subprocess.Popen(['python3','-m','http.server','8791'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(); pg = await ctx.new_page()
        await pg.goto('http://localhost:8791/'); await pg.wait_for_timeout(2500)
        v1 = await pg.evaluate('APP_VERSION'); print('v1', v1)
        time.sleep(61)  # new minute -> new version string
        subprocess.run([sys.executable,os.path.join(ROOT,'tools','build.py')], env=BENV, capture_output=True)
        await pg.evaluate('checkUpdate()'); await pg.wait_for_selector('text=Có bản cập nhật mới', timeout=30000); print('update prompt shown')
        await pg.click('.dlg .btns >> text=Tải lại ngay'); await pg.wait_for_timeout(3000)
        ch = (await pg.evaluate('APP_VERSION')) != v1; print('v2 changed', ch); print('ERR', [] if ch else ['version did not change'])
        await b.close()
asyncio.run(main()); srv.kill()
