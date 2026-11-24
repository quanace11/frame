import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, zipfile, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8766'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
PEN='''async ([pts,type])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:type,clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
def d2s(x,y): return f"(()=>{{const r=document.getElementById('view').getBoundingClientRect();return [ ( {x}*vs+vtx)/DPR, ({y}*vs+vty)/DPR ];}})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '404' not in m.text and '403' not in m.text else None);
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        async def doc(x,y): return await pg.evaluate(d2s(x,y))
        # vector brush: draw a closed box on Nét layer
        await pg.click('[data-layer=vec]')
        pts=[await doc(x,y) for (x,y) in [(300,500),(800,500),(800,1200),(300,1200),(300,505)]]
        # interpolate
        P=[]
        for i in range(len(pts)-1):
            for t in range(10): P.append([pts[i][0]+(pts[i+1][0]-pts[i][0])*t/10, pts[i][1]+(pts[i+1][1]-pts[i][1])*t/10])
        P.append(pts[-1])
        await pg.evaluate(PEN,[P,'pen']); await pg.wait_for_timeout(200)
        print('vec strokes', await pg.evaluate('curFrame().vec.length'), 'pts', await pg.evaluate('curFrame().vec[0].pts.length'))
        # fill inside on char layer -> should be bounded by vector walls
        await pg.click('[data-layer=char]'); await pg.click('[data-tool=fill]'); await pg.click('[data-c="#fdd835"]')
        await pg.evaluate(PEN,[[await doc(550,850)],'pen']); await pg.wait_for_timeout(400)
        filled = await pg.evaluate('(()=>{const d=curFrame().canvas.getContext("2d");return [d.getImageData(550,850,1,1).data[3], d.getImageData(100,300,1,1).data[3]]})()')
        print('fill inside/outside alpha', filled)
        # vedit: select stroke, move, bend
        await pg.click('[data-tool=vedit]')
        await pg.evaluate(PEN,[[await doc(800,800), await doc(850,820)],'pen']); await pg.wait_for_timeout(100)
        print('selected', await pg.evaluate('vsel.size'), 'bar', await pg.evaluate('!document.getElementById("vecbar").hidden'))
        # bend: drag an anchor (first point)
        a0 = await pg.evaluate('curFrame().vec[0].pts[1]'); print('anchor before', a0)
        s0 = await doc(a0['x'],a0['y']); s1=[s0[0]+40,s0[1]+20]
        await pg.evaluate(PEN,[[s0,[s0[0]+20,s0[1]+10],s1],'pen'])
        print('anchor after', await pg.evaluate('curFrame().vec[0].pts[1]'))
        # rotate slider
        await pg.evaluate('''()=>{const r=document.getElementById('vecRot'); r.value=30; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));}''')
        print('undo len', await pg.evaluate('undoStack.length'))
        await pg.screenshot(path='v1.png')
        # undo twice
        await pg.click('#undoBtn'); await pg.wait_for_timeout(100); await pg.click('#undoBtn'); await pg.wait_for_timeout(100)
        print('after undo anchor', await pg.evaluate('curFrame().vec[0].pts[1]'))
        # import cartoon -> vector
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'cartoon.png')); await pg.wait_for_timeout(400)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ')
        t=time.time(); await pg.wait_for_function('document.getElementById("impBusy").hidden && document.getElementById("iVecInfo") && document.getElementById("iVecInfo").textContent', timeout=60000)
        print('vectorize secs', round(time.time()-t,1), await pg.inner_text('#iVecInfo'))
        await pg.screenshot(path='v2.png')
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(400)
        print('total strokes', await pg.evaluate('curFrame().vec.length'), 'selected', await pg.evaluate('vsel.size'))
        await pg.click('#vecNone')
        await pg.screenshot(path='v3.png')
        # bake all
        await pg.click('#vecBake'); await pg.wait_for_timeout(300)
        print('after bake strokes', await pg.evaluate('curFrame().vec.length'))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        print('after undo bake', await pg.evaluate('curFrame().vec.length'))
        # dup frame keeps vec
        await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        print('dup vec', await pg.evaluate('curFrame().vec.length'))
        await pg.wait_for_timeout(2200)
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('reload vec', await pg.evaluate('S.frames.map(f=>f.vec.length)'))
        # export + import roundtrip
        await pg.click('#menuBtn'); await pg.click('[data-m=export]')
        await pg.wait_for_selector('text=Lưu file ZIP', timeout=20000)
        async with pg.expect_download() as dl: await pg.click('text=Lưu file ZIP')
        d=await dl.value; await d.save_as('v.zip'); z=zipfile.ZipFile('v.zip'); print([n for n in z.namelist() if 'lines' in n])
        await pg.set_input_files('#zipFile','v.zip'); await pg.wait_for_timeout(1500)
        print('import vec', await pg.evaluate('S.frames.map(f=>f.vec.length)'))
        await pg.screenshot(path='v4.png')
        print('ERRORS', errs)
        await b.close()
asyncio.run(main()); srv.kill()
