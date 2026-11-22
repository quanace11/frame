import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# "Vừa khung" fits the frame into the area left free by floating panels, and refits when a panel opens/folds/closes
srv = subprocess.Popen(['python3','-m','http.server','8839'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
GEO = """((sel)=>{const m=viewMat(), st=document.getElementById('stage').getBoundingClientRect(); const bottom=st.top+(m[1]*W+m[3]*H+m[5])/DPR, top=st.top+m[5]/DPR; const el=document.querySelector(sel); const r=el&&!el.hidden?el.getBoundingClientRect():null; return {top:Math.round(top), bottom:Math.round(bottom), panelTop: r?Math.round(r.top):null, vs}})"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for vp in [{'width':1180,'height':820},{'width':820,'height':1180}]:
            pg = await b.new_page(viewport=vp); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8839/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
            g0 = await pg.evaluate(GEO, '#ppbar')
            await pg.evaluate("setTool('puppet')"); await pg.wait_for_timeout(300)
            g1 = await pg.evaluate(GEO, '#ppbar')
            print(vp['width'], 'panel open: frame ends above panel', g1['panelTop'] is not None and g1['bottom'] <= g1['panelTop'], g1)
            await pg.click('#ppMini'); await pg.wait_for_timeout(300); g2 = await pg.evaluate(GEO, '#ppbar')
            print(vp['width'], 'folded panel → bigger frame', g2['vs'] > g1['vs'], 'still above', g2['bottom'] <= g2['panelTop'])
            await pg.click('#ppMini'); await pg.evaluate("setTool('brush')"); await pg.wait_for_timeout(300); g3 = await pg.evaluate(GEO, '#ppbar')
            print(vp['width'], 'panel closed → back to full fit', abs(g3['vs'] - g0['vs']) < 1e-6)
            # user zoom is kept when a panel opens
            await pg.evaluate("vs*=1.5; requestRender()"); z = await pg.evaluate('vs')
            await pg.evaluate("setTool('fx')"); await pg.wait_for_timeout(300)
            print(vp['width'], 'manual zoom kept', abs(await pg.evaluate('vs') - z) < 1e-9)
            await pg.click('#fitBtn'); await pg.wait_for_timeout(100); g4 = await pg.evaluate(GEO, '#fxbar')
            print(vp['width'], 'fit button respects FX panel', g4['bottom'] <= g4['panelTop'] + 1)
            await pg.screenshot(path=f"t39_{vp['width']}.png")
            print('ERR', errs); await pg.close()
        await b.close()
asyncio.run(main()); srv.kill()
