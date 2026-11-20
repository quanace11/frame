import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8783'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8783/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        await pg.evaluate("()=>{ppPreset='walk'; document.getElementById('ppPN').value=8; document.getElementById('ppPDur').value=0.15;}")
        await pg.evaluate("ppMakePreset()"); await pg.wait_for_timeout(800)
        await pg.set_input_files('#bgVidFile',os.path.join(ASSETS,'bgv.webm')); await pg.wait_for_function('bgVid.ready', timeout=20000); await pg.wait_for_timeout(500)
        print('ready', await pg.evaluate('[bgVid.ready, bgVid.el.duration]'))
        await pg.click('.fr >> nth=5'); await pg.wait_for_timeout(600)
        print('video time at frame 6', await pg.evaluate('bgVid.el.currentTime.toFixed(2)'))
        await pg.screenshot(path='v_edit.png')
        await pg.click('#playBtn'); await pg.wait_for_timeout(900); print('vid playing', await pg.evaluate('!bgVid.el.paused')); await pg.screenshot(path='v_play.png'); await pg.click('#playBtn')
        await pg.click('#videoBtn'); await pg.wait_for_selector('text=Video đã xong', timeout=120000)
        async with pg.expect_download() as dl: await pg.click('text=Lưu video')
        d=await dl.value; await d.save_as('bgout.mp4')
        await pg.wait_for_timeout(2200); await pg.reload(); await pg.wait_for_timeout(2500)
        print('after reload bgVideo', await pg.evaluate('!!S.bgVideo'), await pg.evaluate('bgVid.ready'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
