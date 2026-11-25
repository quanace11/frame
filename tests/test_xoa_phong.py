import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🌫 Xoá phông (tab Hiệu ứng): f.bgb = {k} draws the Nền layer blurred (no white bleed at the borders thanks to mirrored
# padding), the character layer stays sharp, the play cache key changes, frame copies keep it, undo + save/reload
srv = subprocess.Popen(['python3','-m','http.server','9431'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# pixels of the composed frame (background + character layer) along a row
ROW = '''async ([i, y, xs]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawFrameBase(x, f, bg);
  return xs.map(px => Array.from(x.getImageData(Math.round(px), Math.round(y), 1, 1).data.slice(0, 3))); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9431/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(2): await pg.click('#addBtn')
        W, H = await pg.evaluate("[W,H]")
        # background: left half black, right half white (sharp edge in the middle), edge colour at the far left/right
        # character layer: a red square around x = 0.25W
        await pg.evaluate("""(async()=>{ const bg = bgOf(S.frames[0]); await ensureLoaded(bg); const x = bg.canvas.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.fillStyle='#000'; x.fillRect(0,0,W/2,H); bg.ver++;
          const f = S.frames[0]; await ensureLoaded(f); const c = f.canvas.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(W*0.2, H*0.6, W*0.1, W*0.1); f.ver++;
          S.frames.forEach(g=>g.dur=250); S.cur=0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','look'); })()""")
        await pg.wait_for_timeout(300)
        check('buttons built', await pg.evaluate("document.querySelectorAll('[data-bgb]').length===4"))
        y = H * 0.3; xs = [2, W * 0.5 - 6, W * 0.5 + 6, W - 3]
        sharp = await pg.evaluate(ROW, [0, y, xs]); print('sharp', sharp)
        check('sharp edge before', sharp[1] == [0, 0, 0] and sharp[2] == [255, 255, 255])
        await pg.fill('#lkN', '2'); await pg.dispatch_event('#lkN', 'change')
        await pg.click('[data-bgb="2"]'); await pg.wait_for_timeout(300)
        check('bgb on 2 frames only', await pg.evaluate("S.frames[0].bgb.k===2 && S.frames[1].bgb.k===2 && !S.frames[2].bgb"))
        check('status line', 'xoá phông' in await pg.inner_text('#lkStat'))
        check('button shows on', await pg.evaluate("document.querySelector('[data-bgb=\"2\"]').classList.contains('on')"))
        blur = await pg.evaluate(ROW, [0, y, xs]); print('blur', blur)
        check('edge in the middle is blurred (grey on both sides)', 20 < blur[1][0] < 200 and 50 < blur[2][0] < 235)
        check('outer edges keep their colour (no white bleed)', blur[0][0] < 30 and blur[3][0] > 225)
        red = await pg.evaluate(ROW, [0, H * 0.6 + W * 0.05, [W * 0.25]]); print('character', red)
        check('character layer stays sharp', red[0] == [255, 0, 0])
        strong = await pg.evaluate(ROW, [0, y, [W * 0.5 - W * 0.02]])
        await pg.click('[data-bgb="1"]'); await pg.wait_for_timeout(200)
        light = await pg.evaluate(ROW, [0, y, [W * 0.5 - W * 0.02]]); print('vừa', strong, 'nhẹ', light)
        check('Nhẹ blurs less than Vừa', light[0][0] < strong[0][0])
        await pg.evaluate("buildPlayCache()")
        check('play cache key has the blur', await pg.evaluate("S.frames[0].playKey.includes('z1') && !S.frames[2].playKey.includes('z')"))
        # drawing on the Nền layer: no errors
        await pg.evaluate("setTool('pen'); S.layer='bg'; requestRender()"); await pg.wait_for_timeout(200)
        await pg.evaluate("S.layer='char'; setTool('fx'); openTab('fx','look')")
        # editing the background refreshes the blurred copy (cache keyed by bg.ver)
        await pg.evaluate("""(async()=>{ const bg = bgOf(S.frames[0]); const x = bg.canvas.getContext('2d'); x.fillStyle='#0000ff'; x.fillRect(0,0,W,H); bg.ver++; })()""")
        blue = await pg.evaluate(ROW, [0, y, [W * 0.5]]); print('after edit', blue)
        check('cache follows background edits', blue[0][2] > 240 and blue[0][0] < 15)
        # frame copy keeps it
        check('copy of frame keeps xoá phông', await pg.evaluate("(()=>{ const f = frameCopyOf(S.frames[0], true); return !!f.bgb && f.bgb.k===1 })()"))
        # undo / off
        await pg.wait_for_timeout(600); await pg.evaluate("S.cur=0; updateFrameUI()"); await pg.click('[data-bgb="3"]'); await pg.wait_for_timeout(700)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo goes back to Nhẹ', await pg.evaluate("S.frames[0].bgb && S.frames[0].bgb.k===1"))
        await pg.click('[data-bgb=""]'); await pg.wait_for_timeout(600)
        check('off', await pg.evaluate("!S.frames[0].bgb && !S.frames[1].bgb"))
        # save / reload
        await pg.evaluate("S.frames[1].bgb={k:3}; saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('survives reload', await pg.evaluate("S.frames[1].bgb && S.frames[1].bgb.k===3 && !S.frames[0].bgb"))
        await pg.screenshot(path='xoa_phong.png')
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
