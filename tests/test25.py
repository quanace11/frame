import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8797'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# "Nhiều chấm": lasso many points across strokes, drag them together, unselected points stay put
PEN = """async ([pts])=>{const v=document.getElementById('view');
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:x,clientY:y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}"""
D2S = "([x,y])=>{const c=Math.cos(vr)*vs,s=Math.sin(vr)*vs;const r=document.getElementById('view').getBoundingClientRect();return [r.left+(c*x-s*y+vtx)/DPR, r.top+(s*x+c*y+vty)/DPR]}"
PTS = "curFrame().vec.map(st=>st.pts.map(q=>[Math.round(q.x),Math.round(q.y)]))"
def line(a, b, n=8): return [[a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n] for i in range(n+1)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8797/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        # a "leg": two outline strokes, thigh y 300..600, shin y 600..900
        await pg.evaluate("""()=>{setLayer('vec'); const f=curFrame(); f.vec=[];
          const mk=(id,x)=>({id,c:'#000',w:6,pts:[300,400,500,600,700,800,900].map(y=>({x,y}))});
          f.vec.push(mk('L',450), mk('R',600)); setTool('vedit'); vsel.clear(); updVecBar(); requestRender();}""")
        await pg.click('[data-vdm=multi]'); await pg.wait_for_timeout(100)
        assert await pg.evaluate("S.vdm") == 'multi'
        assert await pg.is_visible('#vecMBend')
        s2 = lambda x, y: pg.evaluate(f"({D2S})([{x},{y}])")
        # lasso around the shin of both strokes (y 650..950)
        corners = [await s2(400,650), await s2(650,650), await s2(650,950), await s2(400,950)]
        path = line(corners[0],corners[1]) + line(corners[1],corners[2]) + line(corners[2],corners[3]) + line(corners[3],corners[0])
        await pg.evaluate(PEN, [path]); await pg.wait_for_timeout(100)
        n = await pg.evaluate("vpCount()"); info = await pg.inner_text('#vecInfo')
        print('selected', n, info); assert n == 6, n   # 700/800/900 on both strokes
        await pg.screenshot(path='t25_selected.png')
        before = await pg.evaluate(PTS)
        # drag from inside the lasso (between the strokes, not on a point) upward by 200
        a = await s2(525, 800); bb = await s2(525, 600)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(100)
        after = await pg.evaluate(PTS); print('after drag', after)
        for k in range(2):
            for j in range(7):
                dy = after[k][j][1] - before[k][j][1]
                if j < 4: assert dy == 0 and after[k][j][0] == before[k][j][0], ('anchor moved', k, j, dy)
                else: assert abs(dy + 200) <= 2, ('selected not moved', k, j, dy)
        await pg.screenshot(path='t25_dragged.png')
        # undo restores
        await pg.evaluate("undo()"); await pg.wait_for_timeout(100)
        assert await pg.evaluate(PTS) == before
        # tap a point to select it, then drag it: only that point moves
        await pg.evaluate("vsel.clear(); vsel.add('L'); updVecBar(); requestRender();")
        a = await s2(450, 500); await pg.evaluate(PEN, [[a, a]]); await pg.wait_for_timeout(50)
        assert await pg.evaluate("vpCount()") == 1
        a = await s2(450, 500); bb = await s2(350, 500)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(50)
        pts = await pg.evaluate(PTS); print('one point', pts[0])
        assert abs(pts[0][2][0] - 350) <= 2 and pts[0][1] == [450, 400] and pts[0][3] == [450, 600]
        # soft falloff: neighbours bend a little, far points stay
        await pg.evaluate("undo(); S.mbendR=150; vsel.clear(); vsel.add('L'); vpsel.set('L', new Set([3])); updVecBar();")
        a = await s2(450, 600); bb = await s2(350, 600)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(50)
        pts = await pg.evaluate(PTS); print('soft', pts[0])
        assert pts[0][3][0] <= 352 and 350 < pts[0][2][0] < 450 and pts[0][0] == [450, 300]
        await pg.evaluate("undo(); S.mbendR=0;")
        # densify keeps selection and adds in-between points
        await pg.evaluate("vsel.clear(); vsel.add('L'); vpsel.set('L', new Set([4,5])); updVecBar();")
        await pg.click('#vecDense'); await pg.wait_for_timeout(50)
        r = await pg.evaluate("[curFrame().vec[0].pts.length, [...vpsel.get('L')].length]"); print('densify', r)
        assert r[0] > 7 and r[1] > 2
        # tap on empty space clears; back to old modes still works
        a = await s2(900, 400); await pg.evaluate(PEN, [[a, a]])
        assert await pg.evaluate("vsel.size") == 0
        await pg.click('[data-vdm=point]'); assert not await pg.is_visible('#vecMBend')
        print('ERR', errs)
        await b.close()
asyncio.run(main())
srv.terminate()
