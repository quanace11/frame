import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Kéo đổi cỡ thanh frame (tablet, cảm ứng thật qua CDP): kéo tay kéo #tlGrip lên → frame + dòng 🎚 Âm thanh to ra,
# ảnh frame vẽ lại nét hơn, không chiếm quá 60% màn hình, nhớ cỡ sau khi tải lại, chạm tay kéo = đổi nhanh, chạm frame/đoạn âm thanh vẫn chọn được.
srv = subprocess.Popen(['python3','-m','http.server','8937'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1180,'height':820}, has_touch=True)
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        cdp = await ctx.new_cdp_session(pg)
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        async def touch(pts):   # pts = list of (x, y); first = down, last = up
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':pts[0][0],'y':pts[0][1]}]})
            for x, y in pts[1:]:
                await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y}]}); await pg.wait_for_timeout(16)
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(250)
        async def box(sel):
            return await pg.evaluate(f"(()=>{{const r=document.querySelector({sel!r}).getBoundingClientRect();return [r.left,r.top,r.width,r.height]}})()")
        async def grip_drag(dy):
            g = await box('#tlGrip'); x, y = g[0] + g[2] / 2, g[1] + g[3] / 2
            await touch([(x, y)] + [(x, y + dy * i / 12) for i in range(1, 13)])
        await pg.goto('http://localhost:8937/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        await pg.set_input_files('#musicFile', os.path.join(ASSETS, 'music.wav')); await pg.wait_for_timeout(600)
        check('audio timeline open', await pg.evaluate("atlOpen()"))
        g = await box('#tlGrip'); print('grip', g)
        check('handle is easy to hit', g[2] >= 200 and g[3] >= 26)
        h0 = (await box('.fr canvas'))[3]; tl0 = (await box('#tl'))[3]; lane0 = await pg.evaluate("ATL_LANE")
        st0 = (await box('#stage'))[3]
        print('before', h0, tl0, lane0)
        await pg.screenshot(path='tls_0.png')
        await grip_drag(-50)
        s1 = await pg.evaluate("S.tlScale"); h1 = (await box('.fr canvas'))[3]; tl1 = (await box('#tl'))[3]; lane1 = await pg.evaluate("ATL_LANE")
        st1 = (await box('#stage'))[3]
        print('after drag up', s1, h1, tl1, lane1, 'stage', st0, st1)
        check('drag up makes it bigger', s1 > 1.5 and h1 > h0 * 1.4 and lane1 > lane0 and tl1 > tl0)
        check('drawing area gives room', st1 < st0)
        check('not more than 60% of the screen', tl1 <= 820 * 0.6 + 1)
        th = await pg.evaluate("[S.frames[0].thumb.height, thumbSize()[1]]")
        check('thumbnails redrawn sharper', th[0] == th[1] and th[0] >= 144)
        await pg.screenshot(path='tls_1_big.png')
        # very far up: stops at the 60% limit
        await grip_drag(-400)
        tl2 = (await box('#tl'))[3]; print('far up', await pg.evaluate("S.tlScale"), tl2)
        check('far drag still capped', tl2 <= 820 * 0.6 + 1)
        await grip_drag(120)
        s3 = await pg.evaluate("S.tlScale"); print('after drag down', s3)
        check('drag down makes it smaller', s3 < s1)
        # bigger again, then touch still works on frames and audio clips
        await pg.evaluate("tlScaleSet(1.5, true)"); await pg.wait_for_timeout(300)
        f = await pg.evaluate("(()=>{const r=S.frames[2].el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        await touch([f]); check('tap a frame selects it', await pg.evaluate("S.cur") == 2)
        c = await pg.evaluate("(()=>{const r=document.getElementById('atlCv').getBoundingClientRect(),o=atlLay.clips[0];return [r.left+atlX(o.st+o.len/2), r.top+o.y+ATL_LANE/2]})()")
        await touch([c]); check('tap an audio clip selects it', await pg.evaluate("atlSel") == await pg.evaluate("atlLay.clips[0].c.id"))
        await pg.screenshot(path='tls_2_touch.png')
        # remembered after reload
        await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_timeout(1200)
        try: await pg.click('.dlg .btns >> text=Bắt đầu vẽ', timeout=1500)
        except Exception: pass
        await pg.wait_for_timeout(300)
        s4 = await pg.evaluate("S.tlScale"); h4 = (await box('.fr canvas'))[3]
        print('after reload', s4, h4)
        check('size remembered', abs(s4 - 1.5) < 0.01 and h4 > h0 * 1.4)
        # tap the handle: 1.8 → 2 → 1 → 1.5
        seq = []
        for _ in range(3):
            g = await box('#tlGrip'); await touch([(g[0] + g[2] / 2, g[1] + g[3] / 2)]); seq.append(await pg.evaluate("S.tlScale"))
        print('tap cycle', seq); check('tap cycles sizes (each tap changes it, back to 100% when no room)', 1 in seq and max(seq) > 1 and all(x != y for x, y in zip([1.5] + seq, seq)))
        check('tap size fits the screen', (await box('#tl'))[3] <= 820 * 0.6 + 1)
        # portrait tablet
        await pg.set_viewport_size({'width':820,'height':1180}); await pg.wait_for_timeout(400)
        await pg.evaluate("tlScaleSet(1, true)"); await pg.wait_for_timeout(200)
        hp = (await box('.fr canvas'))[3]
        await grip_drag(-60)
        hp2 = (await box('.fr canvas'))[3]; print('portrait', hp, hp2, await pg.evaluate("S.tlScale"))
        check('portrait drag works', hp2 > hp * 1.4 and (await box('#tl'))[3] <= 1180 * 0.6 + 1)
        await pg.screenshot(path='tls_3_portrait.png')
        await b.close()
        print('ERR', errs)
srv_ok = True
try: asyncio.run(main())
finally: srv.terminate()
