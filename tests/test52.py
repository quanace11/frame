import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8854'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# "Cả nét": pick many strokes by tapping, drag to move, corner handles scale, round knob rotates
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
        await pg.goto('http://localhost:8854/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("""()=>{setLayer('vec'); const f=curFrame(); f.vec=[];
          const mk=(id,x)=>({id,c:'#000',w:6,pts:[400,500,600].map(y=>({x,y}))});
          f.vec.push(mk('A',300), mk('B',500), mk('C',700)); setTool('vedit'); vsel.clear(); updVecBar(); requestRender();}""")
        await pg.evaluate("panelHidden.vedit=false; updVecBar()")
        await pg.click('[data-vdm=move]'); await pg.wait_for_timeout(100)
        s2 = lambda x, y: pg.evaluate(f"({D2S})([{x},{y}])")
        tap = lambda pt: pg.evaluate(PEN, [[pt, pt]])
        # tap A then B: both selected; tap B again: deselected; tap again: selected
        await tap(await s2(300, 500)); await tap(await s2(500, 500))
        assert await pg.evaluate("[...vsel].sort().join()") == 'A,B'
        await tap(await s2(500, 500)); assert await pg.evaluate("[...vsel].join()") == 'A'
        await tap(await s2(500, 500)); assert await pg.evaluate("vsel.size") == 2
        print('info', await pg.inner_text('#vecInfo'))
        await pg.screenshot(path='t46_box.png')
        before = await pg.evaluate(PTS)
        # drag a selected stroke: both A and B move, C stays
        a = await s2(300, 500); bb = await s2(300, 400)   # middle of stroke A: far from the corner handles at any canvas size
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(50)
        aft = await pg.evaluate(PTS); print('moved', aft)
        assert all(abs(q[1] - o[1] + 100) <= 2 for k in (0, 1) for q, o in zip(aft[k], before[k])) and aft[2] == before[2]
        await pg.evaluate("undo()"); await pg.wait_for_timeout(50); assert await pg.evaluate(PTS) == before
        await pg.evaluate("vsel.clear(); vsel.add('A'); vsel.add('B'); updVecBar(); requestRender();")
        # drag inside the box on empty space (between A and B) also moves both
        a = await s2(400, 500); bb = await s2(450, 500)
        await pg.evaluate(PEN, [line(a, bb)]); aft = await pg.evaluate(PTS)
        assert abs(aft[0][0][0] - 350) <= 2 and abs(aft[1][0][0] - 550) <= 2 and aft[2] == before[2], aft
        await pg.evaluate("undo(); vsel.clear(); vsel.add('A'); vsel.add('B'); updVecBar(); requestRender();")
        # bottom-right corner handle: drag away from the top-left anchor -> bigger
        box = await pg.evaluate("(()=>{const b=vselBox(curFrame()); return [b.x0,b.y0,b.x1,b.y1]})()"); print('box', box)
        a = await s2(box[2], box[3]); w0 = (box[2]-box[0]); bb = await s2(box[0] + w0*2, box[1] + (box[3]-box[1])*2)
        await pg.evaluate(PEN, [line(a, bb)]); await pg.wait_for_timeout(50)
        nb = await pg.evaluate("(()=>{const b=vselBox(curFrame()); return [b.x0,b.y0,b.x1,b.y1]})()")
        ws = await pg.evaluate("curFrame().vec.map(s=>s.w)"); print('scaled', nb, ws)
        assert abs(nb[0]-box[0]) < 15 and (nb[2]-nb[0]) > 1.6*w0 and ws[0] > 10 and ws[2] == 6
        await pg.evaluate("undo(); vsel.clear(); vsel.add('A'); vsel.add('B'); updVecBar(); requestRender();")
        # top-left corner toward the centre -> smaller
        a = await s2(box[0], box[1]); bb = await s2((box[0]+box[2])/2, (box[1]+box[3])/2)
        await pg.evaluate(PEN, [line(a, bb)]); nb = await pg.evaluate("(()=>{const b=vselBox(curFrame()); return [b.x0,b.y0,b.x1,b.y1]})()")
        print('smaller', nb); assert (nb[2]-nb[0]) < 0.75*w0
        await pg.evaluate("undo(); vsel.clear(); vsel.add('A'); updVecBar(); requestRender();")
        # rotate knob: drag from top knob to the right side -> vertical line becomes horizontal
        r = await pg.evaluate("(()=>{const b=vselBox(curFrame()); const h=vboxHandles(b).find(h=>h.k==='r'); return [h.x,h.y,(b.x0+b.x1)/2,(b.y0+b.y1)/2]})()")
        a = await s2(r[0], r[1]); bb = await s2(r[2] + (r[3]-r[1]), r[3])
        await pg.evaluate(PEN, [line(a, bb, 16)]); aft = await pg.evaluate(PTS); print('rotated', aft[0])
        assert abs(aft[0][0][1] - aft[0][2][1]) <= 3 and abs(abs(aft[0][0][0] - aft[0][2][0]) - 200) <= 4
        await pg.screenshot(path='t46_rot.png')
        await pg.evaluate("undo()")
        # point mode still bends a single point; box also shown there
        await pg.click('[data-vdm=point]'); await pg.evaluate("vsel.clear(); vsel.add('C'); updVecBar(); requestRender();")
        a = await s2(700, 500); bb = await s2(760, 500); await pg.evaluate(PEN, [line(a, bb)])
        aft = await pg.evaluate(PTS); assert aft[2][1][0] >= 758 and aft[2][0] == [700, 400], aft[2]
        print('ERR', errs)
        await b.close()
asyncio.run(main())
srv.terminate()
