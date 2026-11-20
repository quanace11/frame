import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# compact top bar: background options sit in a "Nền ▾" menu, buttons still work, top-bar chips are tall enough to tap
srv = subprocess.Popen(['python3','-m','http.server','8840'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for vp in [{'width':1180,'height':820},{'width':820,'height':1180}]:
            pg = await b.new_page(viewport=vp); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8840/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
            h = await pg.evaluate("document.getElementById('top').getBoundingClientRect().height")
            print(vp['width'], 'top bar height', round(h), h < (110 if vp['width'] > 1000 else 200))
            small = await pg.evaluate("[...document.querySelectorAll('#top .chip, #top .layer')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().height).filter(x=>x<36).length")
            print(vp['width'], 'no tiny chips', small == 0)
            print(vp['width'], 'bg buttons out of the bar', await pg.evaluate("!document.getElementById('newBgBtn').offsetParent"))
            await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(100)
            print(vp['width'], 'menu shows 3 options', await pg.evaluate("document.querySelectorAll('.pop.bgm .bgm-row[data-k] > button').length") == 3,
                  'info', await pg.inner_text('.pop.bgm .bgm-info'))
            n0 = await pg.evaluate("new Set(S.frames.map(f=>f.bgId)).size")
            await pg.click('#addBtn')
            await pg.wait_for_timeout(200)
            await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(100)
            await pg.click('.pop.bgm #newBgBtn'); await pg.wait_for_timeout(300)
            n1 = await pg.evaluate("new Set(S.frames.map(f=>f.bgId)).size")
            print(vp['width'], 'Nền mới works from menu', n1 > n0, 'menu closed', await pg.evaluate("!document.querySelector('.pop.bgm')"),
                  'buttons back in holder', await pg.evaluate("document.getElementById('newBgBtn').parentElement.id") == 'bgHold')
            # opening the menu again still works after closing by an outside tap
            await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(100); await pg.mouse.click(vp['width']//2, vp['height']//2); await pg.wait_for_timeout(100)
            print(vp['width'], 'outside tap closes, buttons restored', await pg.evaluate("document.querySelectorAll('#bgHold > button').length") == 3)
            # preset scenes are one tap away from the Nền ▾ menu
            await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(100); await pg.click('.pop.bgm .bgm-scene'); await pg.wait_for_timeout(300)
            print(vp['width'], 'Nền ▾ opens scene library', await pg.evaluate("!!document.querySelector('#scGrid') && !document.querySelector('.pop.bgm')"),
                  'buttons still in holder', await pg.evaluate("document.querySelectorAll('#bgHold > button').length") == 3)
            await pg.click('.dlg .btns >> text=Đóng'); await pg.wait_for_timeout(100)
            print(vp['width'], 'save state short', await pg.inner_text('#saveState'))
            await pg.screenshot(path=f"t40_{vp['width']}.png")
            print('ERR', errs); await pg.close()
        await b.close()
asyncio.run(main()); srv.kill()
