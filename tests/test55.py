import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8857'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# front / behind for imported pictures (Trên cùng / Sau nét vẽ / Vào nền / Thành mảnh ghép) + drag frames to reorder
PX = "([cv,x,y])=>{const f=curFrame(); const c= cv==='char'?f.canvas: cv==='col'?f.col: bgOf(f).canvas; if(!c) return [-1,-1,-1,-1]; return [...c.getContext('2d').getImageData(x,y,1,1).data]}"
IMG = """()=>{const c=document.createElement('canvas'); c.width=300; c.height=300; const x=c.getContext('2d'); x.fillStyle='#ff0000'; x.fillRect(0,0,300,300); return c}"""
PUT = "()=>{const c=(" + IMG + ")(); floatFromImage(c); floating.scale=1; floating.cx=540; floating.cy=960; showSelbar(); requestRender();}"
# a press on frame `a`, optional hold, then a drag to the right half of frame `b`
DRAG = """async ([a,b,kind,hold])=>{const fa=S.frames[a].el, fb=S.frames[b].el, ra=fa.getBoundingClientRect(), rb=fb.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:11,pointerType:kind,clientX:x,clientY:y,buttons:1,bubbles:true,cancelable:true});
  const x0=ra.left+ra.width/2, y0=ra.top+ra.height/2, x1=rb.left+rb.width*0.8;
  fa.dispatchEvent(mk('pointerdown',x0,y0)); if(hold) await new Promise(r=>setTimeout(r,600));
  for(let i=1;i<=10;i++){ window.dispatchEvent(mk('pointermove',x0+(x1-x0)*i/10,y0)); await new Promise(r=>setTimeout(r,16)); }
  window.dispatchEvent(mk('pointerup',x1,y0)); await new Promise(r=>setTimeout(r,80));}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1180,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8857/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        px = lambda cv, x, y: pg.evaluate(f"({PX})(['{cv}',{x},{y}])")
        # a black bar on the Nhân vật layer across the middle
        await pg.evaluate("()=>{const f=curFrame(); const x=f.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(300,940,480,40); f.ver++; requestRender();}")
        # 1. default: picture on top, place buttons shown, "Trên cùng" on
        await pg.evaluate(PUT); await pg.wait_for_timeout(100)
        assert await pg.is_visible('#selPlace') and await pg.evaluate("floatPlace()") == 'top'
        assert 'on' in await pg.get_attribute('[data-fpl=top]', 'class')
        # 2. Sau nét vẽ: the black bar stays, the picture goes into Màu underneath
        await pg.click('[data-fpl=under]'); await pg.wait_for_timeout(100)
        assert 'on' in await pg.get_attribute('[data-fpl=under]', 'class')
        await pg.screenshot(path='t55_under_preview.png')
        await pg.click('#selDone'); await pg.wait_for_timeout(200)
        c1, k1, k2 = await px('char', 540, 960), await px('col', 540, 960), await px('col', 540, 860)
        print('under: char', c1, 'col', k1, k2); assert c1[:3] == [0, 0, 0] and c1[3] == 255 and k2[0] == 255 and k2[3] == 255
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        assert (await px('col', 540, 860))[3] == 0 and (await px('char', 540, 960))[3] == 255
        # 3. Vào nền: lands in the background, the frame layers stay untouched
        await pg.evaluate(PUT); await pg.click('[data-fpl=bg]'); await pg.click('#selDone'); await pg.wait_for_timeout(200)
        g1, c2 = await px('bg', 540, 860), await px('char', 540, 860)
        print('bg:', g1, 'char', c2); assert g1[0] == 255 and g1[3] == 255 and c2[3] == 0
        await pg.screenshot(path='t55_into_bg.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        assert (await px('bg', 540, 860))[3] == 0
        # cancel after stamping into another layer puts that layer back too
        await pg.evaluate(PUT); await pg.click('[data-fpl=bg]'); await pg.evaluate("stampFloating()"); assert (await px('bg', 540, 860))[3] == 255
        await pg.click('#selCancel'); await pg.wait_for_timeout(100); assert (await px('bg', 540, 860))[3] == 0
        # 4. Thành mảnh ghép: becomes a cut-out piece on top of everything; undo = one step
        await pg.evaluate(PUT); await pg.click('#selPart'); await pg.wait_for_timeout(400)
        parts = await pg.evaluate("S.pp && S.pp.parts.map(p=>p.name)"); print('parts', parts); assert parts == ['Hình 1']
        assert await pg.evaluate("S.tool") == 'puppet' and (await px('char', 540, 860))[3] == 0
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); assert await pg.evaluate("S.pp") is None
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300); assert await pg.evaluate("S.pp.parts.length") == 1
        # a second picture piece, then move the first in front / behind
        await pg.evaluate("()=>{setTool('lasso'); const c=(" + IMG + ")(); floatFromImage(c); floating.scale=0.5; floating.cx=640; floating.cy=1000;}")
        await pg.click('#selPart'); await pg.wait_for_timeout(400)
        z = lambda: pg.evaluate("S.pp.parts.slice().sort((a,b)=>a.z-b.z).map(p=>p.name).join(',')")
        assert await z() == 'Hình 1,Hình 2'
        await pg.evaluate("ppSel=S.pp.parts.find(p=>p.name==='Hình 1').id; ppSyncBar()")
        await pg.click('#ppCharTop'); assert await z() == 'Hình 2,Hình 1'
        await pg.screenshot(path='t55_parts_order.png')
        await pg.click('#ppCharBot'); assert await z() == 'Hình 1,Hình 2'
        await pg.click('#ppCharTop'); await pg.wait_for_timeout(900); await pg.evaluate("histFlush(); undo()"); await pg.wait_for_timeout(300)
        print('after undo', await z()); assert await z() == 'Hình 1,Hình 2'
        # 5. drag frames on the timeline
        await pg.evaluate("setTool('brush')")
        for _ in range(3): await pg.evaluate("addFrame()"); await pg.wait_for_timeout(150)
        ids = await pg.evaluate("S.frames.map(f=>f.id)")
        order = lambda: pg.evaluate("S.frames.map(f=>f.id)")
        await pg.evaluate(DRAG, [0, 2, 'mouse', False]); await pg.wait_for_timeout(200)
        o1 = await order(); print('mouse drag 1 -> after 3', [ids.index(i) for i in o1]); assert o1 == [ids[1], ids[2], ids[0], ids[3]]
        assert await pg.evaluate("curFrame().id") == ids[0] and await pg.evaluate("document.querySelectorAll('.frghost,.frdrop').length") == 0
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200); assert await order() == ids
        # touch: hold, then drag
        await pg.evaluate(DRAG, [3, 0, 'touch', True]); await pg.wait_for_timeout(200)
        o2 = await order(); print('touch drag 4 -> after 1', [ids.index(i) for i in o2]); assert o2 == [ids[0], ids[3], ids[1], ids[2]]
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        # touch without hold = scroll, nothing moves; hold without moving = multi-select like before
        await pg.evaluate(DRAG, [0, 3, 'touch', False]); assert await order() == ids
        await pg.evaluate("""async ()=>{const el=S.frames[1].el, r=el.getBoundingClientRect(); const mk=t=>new PointerEvent(t,{pointerId:12,pointerType:'touch',clientX:r.left+10,clientY:r.top+10,bubbles:true}); el.dispatchEvent(mk('pointerdown')); await new Promise(q=>setTimeout(q,600)); window.dispatchEvent(mk('pointerup')); el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}""")
        assert await pg.evaluate("mselOn && msel.size") == 1
        # several selected frames move together
        await pg.evaluate("msel.clear(); msel.add(S.frames[0].id); msel.add(S.frames[1].id); mselSync()")
        await pg.evaluate(DRAG, [0, 3, 'mouse', False]); await pg.wait_for_timeout(200)
        o3 = await order(); print('multi drag', [ids.index(i) for i in o3]); assert o3 == [ids[2], ids[3], ids[0], ids[1]]
        await pg.screenshot(path='t55_frames.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200); assert await order() == ids
        print('ERR', errs)
        await b.close()
asyncio.run(main())
srv.terminate()
