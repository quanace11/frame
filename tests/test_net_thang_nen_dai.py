import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🌄 Nền dài drawing aids: 📏 straight line (auto flat / upright, 🧲 snaps to 📐 guides), ▭ rectangle, 📐 guides (add, drag, drag off = remove,
# editor undo, saved with the pano + reload), ▦ grid
srv = subprocess.Popen(['python3','-m','http.server','9773'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
SCR = "(([x, y]) => { const V = PE.vw, r = PE.cv.getBoundingClientRect(); return [r.left + (V[0]*x + V[4]) / DPR, r.top + (V[3]*y + V[5]) / DPR]; })"
A = "(([x, y]) => PE.layers[PE.sel].c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data[3])"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9773/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        W, H = await pg.evaluate("[W,H]")
        await pg.evaluate("panoEdit()"); await pg.wait_for_timeout(300)
        check('editor open with the new tools', await pg.locator('#pnWrap [data-pnt="line"]').count() == 1 and await pg.locator('[data-pnt="rect"]').count() == 1 and await pg.locator('[data-pnt="guide"]').count() == 1)
        async def drag(a, c, steps=12):
            s0 = await pg.evaluate(SCR, a); s1 = await pg.evaluate(SCR, c)
            await pg.mouse.move(*s0); await pg.mouse.down()
            for k in range(1, steps + 1): await pg.mouse.move(s0[0] + (s1[0]-s0[0])*k/steps, s0[1] + (s1[1]-s0[1])*k/steps)
            await pg.mouse.up(); await pg.wait_for_timeout(80)
        # 📐 guide: tap adds a horizon line, drag moves it
        await pg.click('[data-pnt="guide"]')
        await drag([W*0.5, H*0.55], [W*0.5, H*0.55], 1)
        check('tap adds a guide', await pg.evaluate("PE.gd.length") == 1)
        await drag([W*0.5, H*0.55], [W*1.2, H*0.6])
        gy = await pg.evaluate("PE.gd[0]")
        check('drag moves the guide', abs(gy - H*0.6) < 3)
        await pg.click('#pnUndo'); await pg.wait_for_timeout(50)
        check('editor undo puts the guide back', abs(await pg.evaluate("PE.gd[0]") - H*0.55) < 3)
        await pg.click('#pnRedo'); await pg.wait_for_timeout(50)
        gy = await pg.evaluate("PE.gd[0]")
        # 📏 a shaky, slightly tilted drag becomes an exactly flat line
        await pg.click('[data-pnt="line"]'); await pg.evaluate("setColor('#000000'); PE.size = 10; PE.snap = false")
        await drag([W*0.2, H*0.3], [W*2.6, H*0.3 + 40])
        check('nearly flat drag = flat line', await pg.evaluate(A, [W*2.4, H*0.3]) > 200 and await pg.evaluate(A, [W*2.4, H*0.3 + 36]) == 0)
        check('one undo step per line', await pg.evaluate("PE.undo.length") == 3)
        # 🧲 a line that starts near the guide sits exactly on it, across frame joins
        await pg.evaluate("PE.snap = true")
        await drag([W*0.3, gy - 8], [W*2.7, gy + 12])
        check('line snaps onto the guide', await pg.evaluate(A, [W*1.5, gy]) > 200 and await pg.evaluate(A, [W*1.5, gy - 8]) == 0)
        # upright line
        await drag([W*1.4, H*0.1], [W*1.4 + 25, H*0.45])
        check('nearly upright drag = upright line', await pg.evaluate(A, [W*1.4, H*0.4]) > 200 and await pg.evaluate(A, [W*1.4 + 22, H*0.4]) == 0)
        # ▭ rectangle: 4 sides, hollow inside
        await pg.click('[data-pnt="rect"]')
        await drag([W*0.3, H*0.7], [W*0.8, H*0.85])
        check('rectangle sides drawn', all([await pg.evaluate(A, q) > 200 for q in ([W*0.55, H*0.7], [W*0.55, H*0.85], [W*0.3, H*0.78], [W*0.8, H*0.78])]))
        check('rectangle is hollow', await pg.evaluate(A, [W*0.55, H*0.78]) == 0)
        await pg.click('#pnUndo'); await pg.wait_for_timeout(50)
        check('undo removes the rectangle', await pg.evaluate(A, [W*0.55, H*0.7]) == 0)
        # ▦ grid toggle draws, no error
        await pg.click('#pnGrid'); await pg.wait_for_timeout(50)
        check('grid on', await pg.evaluate("PE.grid === true"))
        await pg.screenshot(path='net_thang_nen_dai.png')
        # 📐 second guide via the button, then drag it off the pano = removed
        await pg.click('[data-pnt="guide"]'); await pg.click('#pnGdAdd'); await pg.wait_for_timeout(50)
        check('＋ Thước ngang adds a guide', await pg.evaluate("PE.gd.length") == 2)
        g2 = await pg.evaluate("PE.gd[1]")
        await drag([W*0.5, g2], [W*0.5, H + 300])
        check('drag off the pano removes the guide', await pg.evaluate("PE.gd.length") == 1)
        # saved with the pano, reopened in the editor after a reload
        await pg.click('#pnDone')
        await pg.wait_for_function("!PE && document.querySelector('.dlg')", timeout=20000)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        check('guide saved on the pano', await pg.evaluate("S.panos.length === 1 && S.panos[0].gd.length === 1"))
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(2500)
        for _ in range(3):
            if await pg.locator('.dlg .btns >> text=Bắt đầu vẽ').count(): await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        check('guide survives reload', await pg.evaluate(f"S.panos.length === 1 && Math.abs(S.panos[0].gd[0] - {gy}) < 1"))
        await pg.evaluate("panoEdit(S.panos[0])"); await pg.wait_for_timeout(400)
        check('editor reopens with the guide', await pg.evaluate("PE && PE.gd.length === 1"))
        print('ERR', errs)
        await b.close()
asyncio.run(main())
