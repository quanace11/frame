import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8881'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# A split picture (lines in Nhân vật, colour in Màu, some lines as vector strokes) moves as ONE piece:
#  - Chọn vùng on lớp Nét no longer jumps to Sửa nét; the lasso lifts pixel lines + colour + vector lines
#  - Sửa nét: dragging lasso-picked strokes / points also moves the colour inside the loop
#  - 🎞 Chuyển động: start = where it was lifted, end = where it is dragged → N in-between frames, one undo step
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
# a "person": black outline (pixels), red body (colour layer), blue vector line inside
SETUP = '''(()=>{const f=curFrame(); const x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); x.lineWidth=10; x.strokeStyle='#111'; x.strokeRect(300,900,200,300);
  const k=colOf(f,true).getContext('2d'); k.clearRect(0,0,W,H); k.fillStyle='#e53935'; k.fillRect(305,905,190,290); f.colVer++;
  f.vec=[{id:'v1',c:'#1e88e5',w:8,pts:[{x:340,y:1000},{x:400,y:1050},{x:460,y:1000}]}]; f.ver++; requestRender();})()'''
RED = "((f,x,y)=>{const d=f.col.getContext('2d').getImageData(x,y,1,1).data;return d[0]>200&&d[1]<100&&d[3]>200})"
INK = "((f,x,y)=>f.canvas.getContext('2d').getImageData(x,y,1,1).data[3]>200)"
def loop(pg, x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + 2]]
async def lasso(pg, x0, y0, x1, y1):
    pts = []
    for a, b in zip(loop(pg, x0, y0, x1, y1)[:-1], loop(pg, x0, y0, x1, y1)[1:]):
        for i in range(10): pts.append([a[0] + (b[0]-a[0])*i/10, a[1] + (b[1]-a[1])*i/10])
    pts.append(loop(pg, x0, y0, x1, y1)[-1])
    spts = [await pg.evaluate(D2S, q) for q in pts]
    await pg.evaluate(PEN, spts); await pg.wait_for_timeout(200)
async def drag(pg, a, z):
    a = await pg.evaluate(D2S, a); z = await pg.evaluate(D2S, z)
    await pg.evaluate(PEN, [[a[0] + (z[0]-a[0])*i/12, a[1] + (z[1]-a[1])*i/12] for i in range(13)]); await pg.wait_for_timeout(200)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8881/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("S.onion=false; S.sizeScreen=false"); await pg.evaluate(SETUP); await pg.wait_for_timeout(100)

        # 1. Chọn vùng while on lớp Nét: stays a pixel lasso (was: jumped to Sửa nét)
        await pg.evaluate("setLayer('vec'); setTool('lasso')")
        print('lasso tool from lớp Nét', await pg.evaluate("S.tool==='lasso' && S.layer==='char'"))
        await lasso(pg, 250, 850, 550, 1250)
        print('lifted lines + colour + vector', await pg.evaluate("!!floating && !!floating.cc && curFrame().vec.length===0 && !!floating.vecBefore"))
        await pg.click('#selCancel'); await pg.wait_for_timeout(100)
        print('cancel puts the vector line back', await pg.evaluate("curFrame().vec.length===1 && !floating"))
        await lasso(pg, 250, 850, 550, 1250)
        await drag(pg, [400, 1050], [700, 1050]); await pg.click('#selDone'); await pg.wait_for_timeout(200)
        f = "curFrame()"
        print('moved as one piece', await pg.evaluate(f"{RED}({f},700,1050) && {INK}({f},600,1050) && !{RED}({f},400,1050) && !{INK}({f},300,1050)"))
        print('vector line went with it', await pg.evaluate(f"(()=>{{const d=curFrame().canvas.getContext('2d').getImageData(700,1050,1,1).data;return d[2]>150&&d[0]<100}})()"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo puts all back', await pg.evaluate(f"{RED}({f},400,1050) && {INK}({f},300,1050) && !{RED}({f},700,1050) && curFrame().vec.length===1"))

        # 2. 🎞 Chuyển động: knee slide to the right over 6 frames, slowing down
        await pg.evaluate("liftAll()"); await pg.wait_for_timeout(200)
        print('liftAll grabs the whole picture', await pg.evaluate("!!floating && curFrame().vec.length===0"))
        await pg.click('#selTw'); print('tween row shown', await pg.evaluate("!document.getElementById('selTween').hidden && !!floating.tw"))
        await pg.fill('#twN', '6'); await pg.click('[data-twp=line]'); await pg.click('[data-twe=out]')
        await drag(pg, [400, 1050], [800, 1050]); await pg.wait_for_timeout(100)
        await pg.evaluate("document.getElementById('selRot').value=-10; document.getElementById('selRot').dispatchEvent(new Event('input'))")
        await pg.screenshot(path='truot_setup.png')
        await pg.click('#twGo'); await pg.wait_for_timeout(1200)
        print('6 frames', await pg.evaluate("S.frames.length===6 && !floating"))
        # centre of the red colour in each frame
        xs = await pg.evaluate("(async()=>{const out=[];for(const f of S.frames){await ensureLoaded(f);const d=f.col.getContext('2d').getImageData(0,1040,W,20).data;let s=0,n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<100&&d[i+3]>200){s+=(i/4)%W;n++}out.push(n?s/n:-1)}return out})()")
        print('xs', [round(x) for x in xs])
        print('starts at start, ends at end', abs(xs[0] - 400) < 12 and abs(xs[-1] - 800) < 20)
        steps = [xs[i+1] - xs[i] for i in range(5)]
        print('moves forward, slowing down', all(s > 0 for s in steps) and steps[0] > steps[-1])
        print('lines came along', await pg.evaluate("(async()=>{const f=S.frames[5];await ensureLoaded(f);return f.canvas.getContext('2d').getImageData(0,0,W,H).data.some((v,i)=>i%4===3&&v>200)})()"))
        print('tilted at the end', await pg.evaluate("(async()=>{const f=S.frames[5];await ensureLoaded(f);const d=f.col.getContext('2d').getImageData(0,0,W,H).data;let top=1e9,tx=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<100&&d[i+3]>200){const y=(i/4/W)|0;if(y<top){top=y;tx=(i/4)%W}}return Math.abs(tx-800)>60})()"))
        await pg.evaluate("S.cur=5; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='truot_end.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        print('one undo removes it all', await pg.evaluate(f"S.frames.length===1 && {RED}(S.frames[0],400,1050) && curFrame().vec.length===1"))

        # 3. Sửa nét, Nhiều chấm: dragging the loop moves the colour inside too
        await pg.evaluate("(()=>{const f=curFrame();f.canvas.getContext('2d').clearRect(0,0,W,H);f.ver++;f.vec=[{id:'s1',c:'#111',w:8,pts:[{x:300,y:900},{x:500,y:900},{x:500,y:1200},{x:300,y:1200},{x:300,y:900}]}];S.vdm='multi';setTool('vedit')})()"); await pg.wait_for_timeout(300)
        await lasso(pg, 250, 850, 550, 1250)
        print('points picked', await pg.evaluate("vpCount()>0"))
        await drag(pg, [400, 1050], [400, 1350])
        print('Nhiều chấm: colour followed', await pg.evaluate(f"{RED}(curFrame(),400,1350) && !{RED}(curFrame(),400,950)"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('undo', await pg.evaluate(f"{RED}(curFrame(),400,950) && curFrame().vec[0].pts[0].y===900"))
        # Cả nét: lasso the stroke, drag it: colour inside the loop follows even if the outline has a gap
        await pg.evaluate("(()=>{const f=curFrame();f.vec=[{id:'s2',c:'#111',w:8,pts:[{x:300,y:900},{x:500,y:900},{x:500,y:1200},{x:300,y:1200},{x:300,y:1000}]}];S.vdm='move';vsel.clear();setTool('vedit')})()"); await pg.wait_for_timeout(300)
        await lasso(pg, 150, 750, 650, 1350)
        print('stroke picked', await pg.evaluate("vsel.size===1"))
        await drag(pg, [500, 1050], [500, 1350])
        print('Cả nét: colour followed', await pg.evaluate(f"{RED}(curFrame(),400,1350) && !{RED}(curFrame(),400,950)"))

        # 4. tapping pixel lines in Sửa nét offers "✋ Dời cả hình"
        await pg.evaluate("undo()"); await pg.evaluate("(()=>{const f=curFrame();f.vec=[];const x=f.canvas.getContext('2d');x.lineWidth=10;x.strokeStyle='#111';x.strokeRect(300,900,200,300);f.ver++;S.vdm='point';setTool('vedit')})()"); await pg.wait_for_timeout(300)
        a = await pg.evaluate(D2S, [300, 1000]); await pg.evaluate(PEN, [a, a]); await pg.wait_for_timeout(300)
        print('offer has Dời cả hình', await pg.evaluate("[...document.querySelectorAll('.dlg button')].some(b=>b.textContent.includes('Dời cả hình'))"))
        await pg.click('.dlg button:has-text("Dời cả hình")'); await pg.wait_for_timeout(300)
        print('whole picture lifted', await pg.evaluate("S.tool==='lasso' && !!floating && !!floating.cc"))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
