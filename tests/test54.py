import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8856'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# strokes stay editable: pixel lines -> offer conversion, Nét layer remembered, colour follows moved/scaled strokes
PEN = """async ([pts])=>{const v=document.getElementById('view');
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:x,clientY:y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}"""
D2S = "([x,y])=>{const c=Math.cos(vr)*vs,s=Math.sin(vr)*vs;const r=document.getElementById('view').getBoundingClientRect();return [r.left+(c*x-s*y+vtx)/DPR, r.top+(s*x+c*y+vty)/DPR]}"
PTS = "curFrame().vec.map(st=>st.pts.map(q=>[Math.round(q.x),Math.round(q.y)]))"
def line(a, b, n=8): return [[a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n] for i in range(n+1)]
COLA = "([x,y])=>{const f=curFrame(); return f.col? f.col.getContext('2d').getImageData(x,y,1,1).data[3] : -1}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1180,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8856/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        s2 = lambda x, y: pg.evaluate(f"({D2S})([{x},{y}])")
        async def draw(pts): await pg.evaluate(PEN, [[await s2(x, y) for x, y in pts]])
        assert await pg.evaluate("S.layer") == 'char'
        # 1. a line drawn on Nhân vật is pixels; Sửa nét offers to convert it
        await draw([(300, 600), (400, 620), (500, 640), (600, 660)])
        assert await pg.evaluate("curFrame().vec.length") == 0
        await pg.click('.tool[data-tool=vedit]'); await pg.wait_for_timeout(100)
        await draw([(450, 630), (450, 630)]); await pg.wait_for_timeout(200)
        assert await pg.is_visible('text=Đây là nét pixel')
        await pg.click('.dlg .btns >> text=Chuyển thành nét sửa được'); await pg.wait_for_timeout(600)
        await pg.click('.dlg .btns >> text=Xoá pixel'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("curFrame().vec.length"); print('converted', n, await pg.evaluate("S.layer"))
        assert n >= 1 and await pg.evaluate("S.layer") == 'vec'
        # 2. the Nét layer is remembered after a restart
        await pg.wait_for_timeout(300); await pg.reload(); await pg.wait_for_timeout(1200)
        print('after reload', await pg.evaluate("S.layer")); assert await pg.evaluate("S.layer") == 'vec'
        if await pg.is_visible('text=Bắt đầu vẽ'): await pg.click('text=Bắt đầu vẽ')
        # 3. colour inside a closed stroke follows move and scale (and undo puts it back)
        await pg.evaluate("""()=>{const f=curFrame(); f.vec=[{id:'Q',c:'#000',w:6,pts:[[300,300],[500,300],[500,500],[300,500],[300,300]].map(([x,y])=>({x,y}))}];
          f.vec.push({id:'Z',c:'#000',w:6,pts:[[700,300],[900,300],[900,500],[700,500],[700,300]].map(([x,y])=>({x,y}))}); setTool('fill'); requestRender();}""")
        await draw([(400, 400), (400, 400)]); await draw([(800, 400), (800, 400)]); await pg.wait_for_timeout(100)
        assert await pg.evaluate(f"({COLA})([400,400])") == 255 and await pg.evaluate(f"({COLA})([800,400])") == 255
        await pg.click('.tool[data-tool=vedit]'); await pg.click('[data-vdm=move]')
        await draw([(300, 400), (300, 400)]); assert await pg.evaluate("[...vsel].join()") == 'Q'
        await draw([(300, 420), (350, 520), (300, 620)])
        old, new, other = [await pg.evaluate(f"({COLA})({q})") for q in ([400, 330], [400, 580], [800, 400])]
        print('move: old/new/other', old, new, other); assert old == 0 and new == 255 and other == 255
        await pg.screenshot(path='t54_moved.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(100)
        assert await pg.evaluate(f"({COLA})([400,330])") == 255 and await pg.evaluate(f"({COLA})([400,580])") == 0
        await pg.evaluate("vsel.clear(); vsel.add('Q'); updVecBar(); requestRender();")
        box = await pg.evaluate("(()=>{const b=vselBox(curFrame()); return [b.x0,b.y0,b.x1,b.y1]})()")
        a = await s2(box[2], box[3]); bb = await s2(box[2] + 150, box[3] + 150)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(100)
        big = await pg.evaluate(f"({COLA})([560,560])"); print('scaled colour at 560', big); assert big == 255
        await pg.evaluate("undo()"); assert await pg.evaluate(f"({COLA})([560,560])") == 0
        print('ERR', errs)
        await b.close()
asyncio.run(main())
srv.terminate()
