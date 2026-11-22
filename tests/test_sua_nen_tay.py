import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9107'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# Import dialog hand fixes on the background cut: 🧽 Xoá / 🖌 Lấy lại brush with size − +, undo/redo (button + two-finger tap),
# pinch / wheel zoom + pan of the preview. Works in 🎨 Tách nét + màu and Tách nhân vật.
COUNT = '''()=>{ const c=document.querySelector('#impCv'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0;
  for(let i=0;i<d.length;i+=4){ const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a<128) continue; if((r===255&&g===255&&b===255)||(r===233&&g===233&&b===238)) continue; n++; } return n; }'''
ALPHA_AT = '''([fx,fy])=>{ const c=document.querySelector('#impCv'); return c.getContext('2d').getImageData(Math.round(c.width*fx),Math.round(c.height*fy),1,1).data[3]; }'''
IDLE = "document.querySelector('#impBusy').hidden"
TOUCH = '''([pts, kind])=>{ const el=document.querySelector('#impPrev');
  for(const [id,x,y] of pts) el.dispatchEvent(new PointerEvent(kind,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:id===11,bubbles:true,cancelable:true})); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9107/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate('S.impLayer = false')   # this test checks the old flow: picture as a floating selection (🗂 layer riêng tắt)
        fails = []
        def check(name, ok, extra=''):
            print(name, ok, extra)
            if not ok: fails.append(name)
        async def idle():
            await pg.wait_for_timeout(250); await pg.wait_for_function(IDLE, timeout=180000); await pg.wait_for_timeout(150)
        async def cv_box():
            return await pg.evaluate("(()=>{const r=document.querySelector('#impCv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        async def drag(fx0, fy0, fx1, fy1):
            x, y, w, h = await cv_box()
            await pg.mouse.move(x + w * fx0, y + h * fy0); await pg.mouse.down()
            for k in range(1, 13): await pg.mouse.move(x + w * (fx0 + (fx1 - fx0) * k / 12), y + h * (fy0 + (fy1 - fy0) * k / 12))
            await pg.mouse.up(); await idle()

        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        check('tools hidden on Ảnh mờ tab', await pg.evaluate("document.querySelector('#impTools').hidden"))
        await pg.click('[data-mode=split]'); await idle()
        await pg.wait_for_function("document.querySelector('#iSplitInfo').textContent", timeout=180000)
        check('tools shown on Tách nét + màu', not await pg.evaluate("document.querySelector('#impTools').hidden"))
        await pg.click('[data-sp="view:col"]'); await idle()
        n0 = await pg.evaluate(COUNT)
        # erase a band across the body
        await pg.click('[data-et=erase]'); await pg.wait_for_timeout(100)
        for _ in range(4): await pg.click('#iBp')
        check('brush size + works', await pg.evaluate("+document.querySelector('#iBv').textContent") > 80)
        await drag(0.2, 0.5, 0.8, 0.5)
        n1 = await pg.evaluate(COUNT); print('colour px', n0, '->', n1)
        check('erase removes colour', n1 < n0 * 0.93)
        await pg.screenshot(path='sua_nen_erase.png')
        await pg.click('#iEdU'); await idle()
        check('undo button restores', abs(await pg.evaluate(COUNT) - n0) < n0 * 0.01)
        await pg.click('#iEdR'); await idle()
        check('redo erases again', abs(await pg.evaluate(COUNT) - n1) < n0 * 0.01)
        # restore over the same band
        await pg.click('[data-et=keep]'); await drag(0.2, 0.5, 0.8, 0.5)
        n2 = await pg.evaluate(COUNT); print('after Lấy lại', n2)
        check('Lấy lại brings colour back', n2 > n0 * 0.97)
        # two-finger tap = undo
        await pg.evaluate(TOUCH, [[[11, 500, 300], [12, 560, 300]], 'pointerdown'])
        await pg.wait_for_timeout(80)
        await pg.evaluate(TOUCH, [[[11, 500, 300], [12, 560, 300]], 'pointerup'])
        await idle()
        check('two-finger tap undoes', abs(await pg.evaluate(COUNT) - n1) < n0 * 0.01)
        # pinch zoom
        x, y, w, h = await cv_box()
        cx, cy = x + w / 2, y + h / 2
        await pg.evaluate(TOUCH, [[[11, cx - 40, cy], [12, cx + 40, cy]], 'pointerdown'])
        for k in range(1, 9): await pg.evaluate(TOUCH, [[[11, cx - 40 - 15 * k, cy], [12, cx + 40 + 15 * k, cy]], 'pointermove'])
        await pg.evaluate(TOUCH, [[[11, cx - 160, cy], [12, cx + 160, cy]], 'pointerup'])
        await pg.wait_for_timeout(200)
        z = await pg.evaluate("document.querySelector('#iZl').textContent"); print('zoom', z)
        check('pinch zooms in', int(z.rstrip('%')) > 300)
        check('pinch did not paint', abs(await pg.evaluate(COUNT) - n1) < n0 * 0.01)
        x2, y2, w2, h2 = await cv_box()
        check('zoom keeps pinch centre', abs((cx - x2) / w2 - (cx - x) / w) < 0.03, ((cx - x2) / w2, (cx - x) / w))
        await pg.screenshot(path='sua_nen_zoom.png')
        # hand tool: one-finger drag pans
        await pg.click('[data-et=""]')
        await pg.evaluate(TOUCH, [[[11, 500, 300]], 'pointerdown'])
        await pg.evaluate(TOUCH, [[[11, 560, 330]], 'pointermove'])
        await pg.evaluate(TOUCH, [[[11, 560, 330]], 'pointerup'])
        x3, y3, _, _ = await cv_box()
        check('one-finger pan with ✋', abs((x3 - x2) - 60) < 2 and abs((y3 - y2) - 30) < 2, (x3 - x2, y3 - y2))
        await pg.click('#iZf'); await pg.wait_for_timeout(100)
        check('fit resets zoom', await pg.evaluate("document.querySelector('#iZl').textContent") == '100%')
        await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, -400); await pg.wait_for_timeout(100)
        check('wheel zooms', await pg.evaluate("document.querySelector('#iZl').textContent") != '100%')
        await pg.click('#iZf')
        # Dùng → the hand fix reaches the Màu layer
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        check('floating carries colour', await pg.evaluate("!!(floating && floating.cc)"))
        await pg.click('#selDone'); await pg.wait_for_timeout(300)

        # Tách nhân vật: restore part of the white background in a corner
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=cut]'); await idle()
        check('corner is cut away', await pg.evaluate(ALPHA_AT, [0.05, 0.05]) < 10)
        await pg.click('[data-et=keep]'); await drag(0.02, 0.05, 0.12, 0.05)
        check('Lấy lại restores background', await pg.evaluate(ALPHA_AT, [0.05, 0.05]) > 200)
        check('Bỏ hết sửa shown', await pg.evaluate("!!document.querySelector('#iEdClr')"))
        await pg.click('#iEdClr'); await idle()
        check('Bỏ hết sửa clears', await pg.evaluate(ALPHA_AT, [0.05, 0.05]) < 10)
        await pg.click('.dlg .btns >> text=Huỷ')
        await b.close()
        print('FAILS', fails)
    print('ERR', errs)
asyncio.run(main())
srv.terminate()
