import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9537'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🏷 Logo kênh: 🎬 Xuất video asks about the logo first; an uploaded logo (white paper removed) is drawn top-right by drawFrameFx
# (video / playback), not on the editing canvas; corner + size options move it; turning it off removes it; settings persist.
FX = """((c0) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); const base=document.createElement('canvas'); base.width=W; base.height=H;
  base.getContext('2d').fillStyle='#fff'; base.getContext('2d').fillRect(0,0,W,H); drawFrameFx(x, 0, base, 0, 0);
  const red = (X,Y) => { const d=x.getImageData(X,Y,1,1).data; return d[0]>180 && d[1]<80 && d[2]<80; };
  return { tr: red(Math.round(W*0.85), Math.round(W*0.135)), tl: red(Math.round(W*0.15), Math.round(W*0.135)), corner: Array.from(x.getImageData(W-30, 30, 1, 1).data) }; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9537/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # the dialog opens before exporting; Huỷ does not export
        await pg.click('#videoBtn'); await pg.wait_for_timeout(300)
        if not await pg.locator('#logoPick').count(): errs.append('export dialog has no logo upload button')
        await pg.screenshot(path='logo_hop_thoai_trong.png')
        await pg.click('.dlg .btns >> text=Huỷ'); await pg.wait_for_timeout(300)
        if await pg.locator('text=Đang xuất video').count(): errs.append('Huỷ still exported')
        # a red square logo on white paper (the white should go)
        ok = await pg.evaluate("""(async () => { const c=document.createElement('canvas'); c.width=300; c.height=300; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,300,300); x.fillStyle='#e00'; x.fillRect(50,50,200,200);
            const blob = await new Promise(r => c.toBlob(r)); return await logoSetFile(blob); })()""")
        await pg.wait_for_timeout(300)
        st = await pg.evaluate("({on: vxLogo.on, c: vxLogo.c, saved: !!JSON.parse(localStorage.getItem('fs-logo')).src})")
        print('set', ok, st)
        if not ok or not st['on'] or st['c'] != 'tr' or not st['saved']: errs.append('logo not set/saved: %s' % st)
        r = await pg.evaluate(FX, 0); print('drawn', r)
        if not r['tr'] or r['tl']: errs.append('logo should be top-right only: %s' % r)
        if r['corner'][1] < 200: errs.append('white paper around the logo was not removed: %s' % r['corner'])
        # editing canvas: no logo
        ed = await pg.evaluate("(() => { requestRender(); const c=document.querySelector('#stage canvas') || document.querySelector('canvas'); return !!c; })()")
        # options in the dialog: corner ↖, then size To, then off
        await pg.click('#videoBtn'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='logo_hop_thoai.png')
        await pg.click('[data-logoc="tl"]'); await pg.wait_for_timeout(100); await pg.click('[data-logos="l"]'); await pg.wait_for_timeout(100)
        r2 = await pg.evaluate(FX, 0); print('top-left big', r2)
        if r2['tr'] or not r2['tl']: errs.append('corner option did not move it: %s' % r2)
        await pg.click('#logoOn'); await pg.wait_for_timeout(100)
        r3 = await pg.evaluate(FX, 0)
        if r3['tr'] or r3['tl']: errs.append('turned off but still drawn: %s' % r3)
        await pg.click('.dlg .btns >> text=Huỷ'); await pg.wait_for_timeout(200)
        # reload: settings persist
        await pg.reload(); await pg.wait_for_timeout(1200)
        st2 = await pg.evaluate("({on: vxLogo.on, c: vxLogo.c, s: vxLogo.s, src: !!vxLogo.src})"); print('after reload', st2)
        if st2 != {'on': False, 'c': 'tl', 's': 'l', 'src': True}: errs.append('settings not kept: %s' % st2)
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
