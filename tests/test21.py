import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8793'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
TOUCH='''async ([a0,b0,a1,b1])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
 const mk=(t,id,x,y)=>new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:r.left+x,clientY:r.top+y,bubbles:true,cancelable:true});
 v.dispatchEvent(mk('pointerdown',31,...a0)); v.dispatchEvent(mk('pointerdown',32,...b0));
 for(let i=1;i<=12;i++){const t=i/12; v.dispatchEvent(mk('pointermove',31,a0[0]+(a1[0]-a0[0])*t,a0[1]+(a1[1]-a0[1])*t)); v.dispatchEvent(mk('pointermove',32,b0[0]+(b1[0]-b0[0])*t,b0[1]+(b1[1]-b0[1])*t)); await new Promise(r=>setTimeout(r,10));}
 v.dispatchEvent(mk('pointerup',31,...a1)); v.dispatchEvent(mk('pointerup',32,...b1));}'''
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8793/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.screenshot(path='o_land.png')
        # rotate view ~90 deg with two fingers around stage centre
        box = await pg.evaluate("(()=>{const r=document.getElementById('view').getBoundingClientRect();return [r.width,r.height]})()")
        cx,cy = box[0]/2, box[1]/2; R=150
        await pg.evaluate(TOUCH,[[cx-R,cy],[cx+R,cy],[cx,cy-R],[cx,cy+R]]); await pg.wait_for_timeout(200)
        print('vr deg', await pg.evaluate('Math.round(vr/DEG)'))
        # draw at screen point and verify doc mapping: screen->doc via scrToDoc, then check pixel
        pt=[cx+60, cy+40]
        doc = await pg.evaluate(f"(()=>{{const r=document.getElementById('view').getBoundingClientRect(); return scrToDoc({pt[0]}*DPR,{pt[1]}*DPR)}})()")
        await pg.evaluate(PEN,[[pt,[pt[0]+1,pt[1]+1]]]); await pg.wait_for_timeout(200)
        a = await pg.evaluate(f"curFrame().canvas.getContext('2d').getImageData({int(doc['x'])},{int(doc['y'])},1,1).data[3]")
        print('pixel drawn at mapped doc point', a>0)
        await pg.click('#rotBtn'); await pg.wait_for_timeout(200); print('after rot btn', await pg.evaluate('Math.round(vr/DEG)'))
        await pg.screenshot(path='o_rot.png')
        await pg.click('#fitBtn'); print('fit resets', await pg.evaluate('vr'))
        # focus mode
        w0 = await pg.evaluate("document.getElementById('view').getBoundingClientRect().width")
        await pg.click('#focusBtn'); await pg.wait_for_timeout(300)
        w1 = await pg.evaluate("document.getElementById('view').getBoundingClientRect().width")
        print('focus: rail hidden', await pg.evaluate("getComputedStyle(document.getElementById('rail')).display==='none'"), 'canvas grew', w1>w0)
        await pg.screenshot(path='o_focus.png')
        await pg.click('#fbShow'); await pg.wait_for_timeout(200)
        await pg.click('#tlCollapse'); await pg.wait_for_timeout(200); print('strip hidden', await pg.evaluate("getComputedStyle(document.getElementById('strip')).display==='none'"))
        await pg.click('#tlCollapse')
        # portrait
        await pg.set_viewport_size({'width':1024,'height':1366}); await pg.wait_for_timeout(500); await pg.screenshot(path='o_port.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
