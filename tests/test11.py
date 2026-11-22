import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8777'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8777/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        # line A horizontal at y=800 on char layer
        A=[await d2s(200+i*35,800) for i in range(21)]
        await pg.evaluate(PEN,[A]); await pg.wait_for_timeout(200)
        # draw B at y=815 with snap OFF on a NEW frame? same frame, measure: draw B with snap on at y=814
        await pg.click('#snapBtn'); await pg.wait_for_timeout(100)
        Bp=[await d2s(250+i*30,814) for i in range(20)]
        t=time.time(); await pg.evaluate(PEN,[Bp]); print('snap stroke ms', round((time.time()-t)*1000))
        await pg.wait_for_timeout(200)
        r = await pg.evaluate('''()=>{const x=curFrame().canvas.getContext('2d'); const col=y=>x.getImageData(600,y,1,1).data[3]; return {y800:col(800), y814:col(814), y820:col(820)}}''')
        print('alpha at x=600 rows (snap ON: y814 should be ~0):', r)
        # undo B, draw without snap for comparison
        await pg.click('#undoBtn'); await pg.click('#snapBtn'); await pg.evaluate(PEN,[Bp]); await pg.wait_for_timeout(200)
        r2 = await pg.evaluate('''()=>{const x=curFrame().canvas.getContext('2d'); const col=y=>x.getImageData(600,y,1,1).data[3]; return {y800:col(800), y814:col(814)}}''')
        print('snap OFF:', r2)
        # pixel -> vector via menu on char layer
        await pg.click('#menuBtn'); await pg.click('[data-m=tovec]'); await pg.wait_for_selector('text=Xoá pixel', timeout=30000)
        await pg.click('.dlg .btns >> text=Xoá pixel'); await pg.wait_for_timeout(400)
        print('vec after convert', await pg.evaluate('curFrame().vec.map(s=>[s.pts.length, +s.w.toFixed(1), s.c])'))
        # import pixel line art then selVec
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ'); await pg.wait_for_timeout(500); await pg.wait_for_function('document.getElementById("impBusy").hidden', timeout=60000); await pg.click('[data-lo=px]'); await pg.wait_for_timeout(300); await pg.wait_for_function('document.getElementById("impBusy").hidden', timeout=60000); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        print('floating', await pg.evaluate('!!floating'))
        await pg.click('#selVec'); await pg.wait_for_timeout(2500)
        print('vec after floating convert', await pg.evaluate('curFrame().vec.length'), 'floating', await pg.evaluate('!!floating'))
        await pg.screenshot(path='t11.png')
        # add frames then delete all
        await pg.click('#dupBtn'); await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        print('frames before delall', await pg.evaluate('S.frames.length'))
        await pg.click('#delAllBtn'); await pg.click('.dlg .btns >> text=Xoá hết'); await pg.wait_for_timeout(500)
        print('frames after', await pg.evaluate('S.frames.length'), 'vec', await pg.evaluate('curFrame().vec.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
