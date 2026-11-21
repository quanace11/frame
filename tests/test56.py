import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# bigger max zoom (4800%), stricter lasso, "Nhiều chấm": double-tap a point drops its whole line, ➖ Khoanh bớt unselects points
srv = subprocess.Popen(['python3','-m','http.server','8856'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN = """async ([pts, gap])=>{const v=document.getElementById('view');
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:x,clientY:y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,gap||4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}"""
D2S = "([x,y])=>{const c=Math.cos(vr)*vs,s=Math.sin(vr)*vs;const r=document.getElementById('view').getBoundingClientRect();return [r.left+(c*x-s*y+vtx)/DPR, r.top+(s*x+c*y+vty)/DPR]}"
def line(a, b, n=8): return [[a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n] for i in range(n+1)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8856/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        # zoom: wheel far in, it now stops at 4800% (was 1600%)
        box = await pg.locator('#view').bounding_box()
        await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
        for _ in range(40): await pg.mouse.wheel(0, -400)
        await pg.wait_for_timeout(200)
        z = await pg.evaluate("Math.round(vs/fitS*100)"); check('max zoom 4800%', z == 4800)
        check('zoom label', '4800%' in await pg.inner_text('#zoomLbl'))
        await pg.evaluate("fitView(); vs = fitS * 1.02; requestRender()")   # not exactly fitted, so panels changing size do not re-fit the view mid-test
        s2 = lambda x, y: pg.evaluate(f"({D2S})([{x},{y}])")
        # 3 lines: L and R fully in the box, X only clips the box edge with 2 of its 5 points
        await pg.evaluate("""()=>{setLayer('vec'); const f=curFrame(); f.vec=[];
          const mk=(id,x,ys)=>({id,c:'#000',w:6,pts:ys.map(y=>({x,y}))});
          f.vec.push(mk('L',450,[300,400,500,600,700]), mk('R',600,[300,400,500,600,700]), mk('X',680,[600,700,800,900,1000]));
          setTool('vedit'); vsel.clear(); updVecBar(); requestRender();}""")
        async def lasso(x0, y0, x1, y1):
            c = [await s2(x0,y0), await s2(x1,y0), await s2(x1,y1), await s2(x0,y1)]
            await pg.evaluate(PEN, [line(c[0],c[1]) + line(c[1],c[2]) + line(c[2],c[3]) + line(c[3],c[0])]); await pg.wait_for_timeout(80)
        # Cả nét: only lines mostly inside the loop are picked
        await pg.evaluate("curFrame().vec[2].pts=[600,650,700,800,900].map(y=>({x:680,y}))")   # 3 of 5 points inside, but only ~33% of its length
        await pg.click('[data-vdm=move]')
        await lasso(400, 250, 700, 760)
        sel = await pg.evaluate("[...vsel].sort()"); check('whole-line lasso skips line spilling out', sel == ['L', 'R'])
        # Nhiều chấm: points right on the loop edge are skipped
        await pg.click('[data-vdm=multi]'); await pg.wait_for_timeout(50)
        check('minus chip shown', await pg.is_visible('#vecMinus'))
        await pg.evaluate("vsel.clear(); vpsel.clear(); updVecBar()")
        await lasso(400, 302, 760, 760)    # edge 2 px from the y=300 points
        n = await pg.evaluate("vpCount()"); check('edge points skipped (strict)', n == 4 + 4 + 3)
        # quick double-tap on a point of X: drops the whole line X
        a = await s2(680, 700)
        await pg.evaluate(PEN, [[a, a]]); await pg.wait_for_timeout(120); await pg.evaluate(PEN, [[a, a]]); await pg.wait_for_timeout(80)
        check('double-tap drops line', await pg.evaluate("!vsel.has('X') && vsel.has('L') && vsel.has('R') && vpCount()===8"))
        # single tap on an orange point toggles only that point (slow taps)
        a = await s2(450, 500)
        await pg.evaluate(PEN, [[a, [a[0]+3, a[1]+2]]]); await pg.wait_for_timeout(600)
        check('tap with small wobble unselects one point', await pg.evaluate("vpCount()===7 && !vpsel.get('L').has(2)"))
        await pg.evaluate(PEN, [[a, a]]); await pg.wait_for_timeout(600)
        check('tap again selects it back', await pg.evaluate("vpCount()===8"))
        # ➖ Khoanh bớt: loop around the bottom of R unselects those points, the rest stay
        await pg.click('#vecMinus'); check('minus on', await pg.evaluate("vpMinus"))
        await lasso(560, 550, 640, 760)
        check('minus lasso removes R 600/700', await pg.evaluate("vpCount()===6 && [...vpsel.get('R')].sort().join()==='1,2'"))
        await pg.screenshot(path='t56_minus.png')
        # drag still moves the remaining selection, one undo step
        await pg.click('#vecMinus'); check('minus off', not await pg.evaluate("vpMinus"))
        before = await pg.evaluate("JSON.stringify(curFrame().vec)")
        a = await s2(525, 450); bb = await s2(525, 350)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(80)
        moved = await pg.evaluate("curFrame().vec.find(s=>s.id==='R').pts.map(q=>Math.round(q.y))")
        check('drag moves remaining points', moved == [300, 300, 400, 600, 700])
        await pg.evaluate("undo()"); await pg.wait_for_timeout(80)
        check('undo', await pg.evaluate("JSON.stringify(curFrame().vec)") == before)
        await pg.click('[data-vdm=point]'); check('minus chip hidden', not await pg.is_visible('#vecMinus'))
        print('ERR', errs)
        await b.close()
asyncio.run(main())
srv.terminate()
