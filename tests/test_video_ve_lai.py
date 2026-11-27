import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎬 Video → frame, then redraw bad frames with the pen: a video frame never drawn on has no saved picture, so after it is
# freed (LRU) and visited again it must get a canvas back. Before the fix ensureLoaded kept a settled promise in
# `f.loading` and the frame stayed without canvas: the pen silently stopped drawing (both Nhân vật and Nền) until F5.
srv = subprocess.Popen(['python3','-m','http.server','8972'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
CLIP = os.path.join(ASSETS, 'clip_rgb.webm')
DARK = "(async(l)=>{const f=S.frames[S.cur]; const o=l==='bg'?bgOf(f):f; await ensureLoaded(o); if(!o.canvas) return -1; const d=o.canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let k=0;k<d.length;k+=4) if(d[k+3]&&d[k]<40&&d[k+1]<40&&d[k+2]<40) n++; return n;})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:8972/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.set_input_files('#vidFramesFile', CLIP)
        await pg.click('.dlg .btns >> text=Theo frame')
        await pg.wait_for_selector('#vfV', timeout=15000)
        await pg.click('[data-vffps="24"]')
        await pg.click('.dlg .btns >> text=Tách thành frame')
        await pg.wait_for_function("S.frames.length>=60 && !document.querySelector('.ov')", timeout=60000); await pg.wait_for_timeout(500)
        await pg.evaluate("S.color='#000000'")
        box = await pg.evaluate("(()=>{const r=document.getElementById('view').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()")
        async def draw(dy):
            cx, cy = box[0]+box[2]/2, box[1]+box[3]*0.4+dy
            await pg.mouse.move(cx-40, cy); await pg.mouse.down()
            for k in range(12): await pg.mouse.move(cx-40+k*7, cy+k)
            await pg.mouse.up(); await pg.wait_for_timeout(300)
        async def tryd(name, layer, dy):
            await pg.click(f'[data-layer="{layer}"]')
            n0 = await pg.evaluate(DARK, layer); await draw(dy); n1 = await pg.evaluate(DARK, layer)
            check(f'{name}: pen draws on {layer} ({n0} → {n1} px)', n1 > n0 >= 0)
        # visit many frames so frame 2 (never drawn on, nothing saved) is freed, then go back to it
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200)
        for k in range(30): await pg.evaluate(f"selectFrame({8+k*2})"); await pg.wait_for_timeout(40)
        await pg.wait_for_timeout(600)
        st = await pg.evaluate("({c: !!S.frames[1].canvas, loading: !!S.frames[1].loading})"); print('frame 2 after visiting others', st)
        check('frame 2 was freed (test really covers a reload)', not st['c'])
        check('no stale loading promise left on a freed frame', not st['loading'])
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(300)
        check('frame 2 has its canvas again', await pg.evaluate("!!curFrame().canvas"))
        await tryd('back on frame 2', 'char', 0)
        await tryd('back on frame 2', 'bg', 20)
        # ⧉ Nhân bản + undo back and forth (the person's case), then draw again
        await pg.click('#dupBtn'); await pg.wait_for_timeout(500)
        for k in range(30): await pg.evaluate(f"selectFrame({10+k*2})"); await pg.wait_for_timeout(40)
        await pg.wait_for_timeout(500)
        for k in range(3): await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        await tryd('after duplicate + undo', 'char', 40)
        await tryd('after duplicate + undo', 'bg', 60)
        await b.close()
        print('ERR', errs)
asyncio.run(main())
