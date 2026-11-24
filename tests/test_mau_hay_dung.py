import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9197'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ⭐ Màu hay dùng (own swatches in the top bar) + 💧 picking with a finger (loupe, lift to take) + one-finger tap fill
FINGER = '''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:41,pointerType:'touch',clientX:r.left+x,clientY:r.top+y,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,10));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
SCR = "([x,y])=>{const m=viewMat(), r=document.getElementById('view').getBoundingClientRect(); return [(m[0]*x+m[2]*y+m[4])/DPR, (m[1]*x+m[3]*y+m[5])/DPR];}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9197/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
        n0 = await pg.evaluate("document.querySelectorAll('#favSw .sw').length")
        print('default swatches', n0); assert n0 == 12
        # paint 2 blocks to pick from
        await pg.evaluate("""()=>{const x=curFrame().canvas.getContext('2d'); x.fillStyle='#123456'; x.fillRect(200,300,300,300); x.fillStyle='#ab7733'; x.fillRect(600,300,300,300); curFrame().ver++; requestRender();}""")
        await pg.wait_for_timeout(200)
        # ＋ → Thêm màu đang chọn
        await pg.evaluate("setColor('#ff00aa')")
        await pg.click('#favAddBtn'); await pg.click('.pop .fv-add')
        favs = await pg.evaluate("favList()"); print('added current', favs[-1]); assert favs[-1] == '#ff00aa' and len(favs) == 13
        await pg.click('.pop .fv-add'); assert len(await pg.evaluate("favList()")) == 13, 'no doubles'
        # 💧 Hút để thêm: several finger taps in a row, stays on the dropper
        await pg.click('.pop .fv-pick'); assert await pg.evaluate("S.tool") == 'pick'
        assert (await pg.inner_text('#dropBtn')).startswith('✓')
        a = await pg.evaluate(SCR, [350, 450]); c = await pg.evaluate(SCR, [750, 450])
        await pg.evaluate(FINGER, [[[a[0]+40, a[1]+40], [a[0]+10, a[1]+10], a]])   # drag with the loupe, lift on the block
        assert await pg.evaluate("document.getElementById('pickLoupe').hidden"), 'loupe hidden after lift'
        await pg.evaluate(FINGER, [[c]])
        favs = await pg.evaluate("favList()"); print('picked into favourites', favs[-2:], await pg.evaluate("S.tool"))
        assert favs[-2:] == ['#123456', '#ab7733'] and await pg.evaluate("S.tool") == 'pick'
        await pg.click('#dropBtn'); assert await pg.evaluate("S.tool") != 'pick'
        assert (await pg.inner_text('#dropBtn')) == '💧 Dò màu'
        top = await pg.evaluate("[...document.querySelectorAll('#favSw .sw')].map(s=>s.dataset.c)"); assert top == favs
        # long-press swatch 1 → 🗑 Bỏ; swatch 0 → Thay bằng màu đang chọn; ▶ dời chỗ
        sw = pg.locator('#favSw .sw').nth(1)
        await sw.click(button='right'); await pg.click('.pop .fv-del')
        favs2 = await pg.evaluate("favList()"); assert favs2 == favs[:1] + favs[2:], 'removed'
        await pg.evaluate("setColor('#00ff00')")
        await pg.locator('#favSw .sw').nth(0).click(button='right'); await pg.click('.pop .fv-cur')
        assert (await pg.evaluate("favList()"))[0] == '#00ff00'
        await pg.locator('#favSw .sw').nth(0).click(button='right'); await pg.click('.pop .fv-r'); await pg.keyboard.press('Escape')
        f3 = await pg.evaluate("favList()"); assert f3[1] == '#00ff00' and f3[0] == favs2[1]
        # 💧 Hút màu để thay ô số 3
        await pg.locator('#favSw .sw').nth(2).click(button='right'); await pg.click('.pop .fv-pick')
        await pg.evaluate(FINGER, [[a]])
        f4 = await pg.evaluate("favList()"); print('replaced by picking', f4[2]); assert f4[2] == '#123456' and f4.count('#123456') == 1
        assert await pg.evaluate("S.tool") != 'pick'
        # full colour popover: ⭐ section, set a swatch from there
        await pg.locator('#favSw .sw').nth(0).click(button='right'); await pg.click('.pop .fv-full')
        assert await pg.is_visible('.pop .cp-fvok')
        await pg.fill('.pop .cp-hex', '#336699'); await pg.click('.pop .cp-fvok')
        assert (await pg.evaluate("favList()"))[0] == '#336699'
        await pg.screenshot(path='mau_hay_dung_pop.png')
        await pg.keyboard.press('Escape'); await pg.mouse.click(5, 1000)
        # one finger tap with Đổ màu fills (without "Ngón tay cũng vẽ"), a drag still pans
        await pg.evaluate("""()=>{const f=curFrame(), x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); x.strokeStyle='#000'; x.lineWidth=8; x.strokeRect(300,900,400,400); f.ver++; S.fingerDraw=false; setTool('fill'); setColor('#e53935'); requestRender();}""")
        await pg.wait_for_timeout(200)
        t = await pg.evaluate(SCR, [500, 1100]); v0 = await pg.evaluate("[vtx,vty]")
        await pg.evaluate(FINGER, [[t]]); await pg.wait_for_timeout(300)
        px = await pg.evaluate("Array.from(curFrame().col.getContext('2d').getImageData(500,1100,1,1).data)")
        print('finger tap fill', px); assert px[:3] == [229, 57, 53] and px[3] > 200
        await pg.evaluate(FINGER, [[[t[0], t[1]], [t[0]+40, t[1]+20], [t[0]+120, t[1]+60]]]); await pg.wait_for_timeout(200)
        assert await pg.evaluate("[vtx,vty]") != v0, 'drag pans'
        # saved in settings → survives a reload
        saved = await pg.evaluate("favList()")
        await pg.reload(); await pg.wait_for_timeout(1000)
        try: await pg.click('.dlg .btns >> text=Bắt đầu vẽ', timeout=1500)
        except Exception: pass
        assert await pg.evaluate("favList()") == saved and await pg.evaluate("[...document.querySelectorAll('#favSw .sw')].map(s=>s.dataset.c)") == saved
        # ↺ Về màu mặc định
        await pg.click('#favAddBtn'); await pg.click('.pop .fv-reset')
        assert await pg.evaluate("favList().length") == 12
        await pg.set_viewport_size({'width': 820, 'height': 1180}); await pg.wait_for_timeout(400)
        await pg.screenshot(path='mau_hay_dung_portrait.png')
        print('ERR', errs)
        await b.close()
asyncio.run(main())
