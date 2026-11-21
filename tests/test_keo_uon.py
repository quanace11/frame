import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8894'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# 🫳 Kéo uốn (Chọn vùng): loop an eyebrow of a picture (pixel lines + colour + a vector line), drag it down:
# inside the loop moves fully, the band around stretches, far away stays; one undo step; drag from inside again keeps bending
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
# a face: skin circle (colour), outline (lines), an eyebrow bar (lines) at y=600 x 420..500, a second eyebrow far right, a vector line in the eyebrow
SETUP = '''(()=>{const f=curFrame(); const x=f.canvas.getContext('2d'), k=colOf(f,true).getContext('2d'); x.clearRect(0,0,W,H); k.clearRect(0,0,W,H);
  k.fillStyle='#f1c27d'; k.beginPath(); k.arc(540,700,250,0,Math.PI*2); k.fill();
  x.lineWidth=8; x.strokeStyle='#111'; x.beginPath(); x.arc(540,700,250,0,Math.PI*2); x.stroke();
  x.fillStyle='#111'; x.fillRect(420,596,80,10); x.fillRect(600,596,80,10);
  k.fillStyle='#e53935'; k.fillRect(430,560,60,20);   // a red mark (colour layer) just above the eyebrow, inside the loop
  f.vec=[{id:'b1',c:'#1e88e5',w:6,pts:[{x:430,y:620},{x:490,y:620}]}];
  f.colVer++; f.ver++; requestRender();})()'''
A = "((cv,x,y)=>cv.getContext('2d').getImageData(x,y,1,1).data[3])"
RED = "((cv,x,y)=>{const d=cv.getContext('2d').getImageData(x,y,1,1).data;return d[0]>200&&d[1]<90&&d[3]>200})"
async def pen(pg, pts):
    spts = [await pg.evaluate(D2S, q) for q in pts]; await pg.evaluate(PEN, spts); await pg.wait_for_timeout(200)
async def lasso(pg, x0, y0, x1, y1):
    c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + 2]]; pts = []
    for a, b in zip(c[:-1], c[1:]):
        for i in range(10): pts.append([a[0] + (b[0]-a[0])*i/10, a[1] + (b[1]-a[1])*i/10])
    pts.append(c[-1]); await pen(pg, pts)
async def drag(pg, a, z):
    await pen(pg, [[a[0] + (z[0]-a[0])*i/12, a[1] + (z[1]-a[1])*i/12] for i in range(13)])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8894/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("S.onion=false; S.sizeScreen=false"); await pg.evaluate(SETUP); await pg.wait_for_timeout(100)
        LN = "curFrame().canvas"; COL = "curFrame().col"
        await pg.evaluate("setTool('lasso')"); await pg.click('[data-selm=warp]')
        print('warp mode + softness chips', await pg.evaluate("selMode()==='warp' && !document.getElementById('lassoSoft').hidden"))
        await pg.click('[data-wsoft="2"]')
        await lasso(pg, 410, 550, 510, 630)
        print('loop kept, nothing lifted', await pg.evaluate("!!warpSel && !floating && curFrame().vec.length===1"))
        await pg.screenshot(path='keo_uon_loop.png')
        await drag(pg, [460, 600], [460, 660])
        print('eyebrow moved down 60', await pg.evaluate(f"{A}({LN},460,661)>200 && {A}({LN},460,601)<60"))
        print('colour inside moved too', await pg.evaluate(f"{RED}({COL},460,630) && !{RED}({COL},460,565)"))
        print('vector line bent with it', await pg.evaluate("(()=>{const s=curFrame().vec[0];return Math.abs(s.pts[0].y-680)<2 && s.id==='b1'})()"))
        print('other eyebrow + outline far away stay', await pg.evaluate(f"{A}({LN},640,601)>200 && {A}({LN},540,453)>200 && {A}({LN},290,700)>200"))
        print('skin still fills the gap (stretched)', await pg.evaluate(f"{A}({COL},460,600)>200"))
        print('loop followed the drag', await pg.evaluate("Math.abs(warpSel.poly[0].y-610)<2"))
        await pg.screenshot(path='keo_uon_after.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo puts it back', await pg.evaluate(f"{A}({LN},460,601)>200 && {A}({LN},460,661)<60 && {RED}({COL},460,565) && Math.abs(curFrame().vec[0].pts[0].y-620)<1"))
        # tilt one end: loop only the inner end of the eyebrow and pull it down (angry eyebrow)
        await pg.evaluate("warpSel=null"); await lasso(pg, 475, 585, 510, 615)
        await drag(pg, [495, 600], [495, 625])
        print('inner end down, outer end stays', await pg.evaluate(f"{A}({LN},498,626)>200 && {A}({LN},425,601)>200"))
        # a drag starting outside the loop draws a new loop instead
        await lasso(pg, 590, 580, 700, 620)
        print('new loop replaces old', await pg.evaluate("!!warpSel && warpSel.poly[0].x>580"))
        await pg.click('[data-selm=pic]')
        print('leaving warp mode clears loop', await pg.evaluate("!warpSel"))
        print('ERR', errs)
        await b.close()
asyncio.run(main()); srv.terminate()
