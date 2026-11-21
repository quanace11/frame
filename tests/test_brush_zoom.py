import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Giữ cỡ bút khi phóng to (S.sizeScreen) + Độ đậm on the Nét (vector) layer
srv = subprocess.Popen(['python3','-m','http.server','8871'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# draw a horizontal line through the doc point (dx,dy), in screen space
PEN='''async ([dx,dy,len])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const M=viewMat(); const sx=(M[0]*dx+M[2]*dy+M[4])/DPR, sy=(M[1]*dx+M[3]*dy+M[5])/DPR;
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',sx-len/2,sy)); for(let i=1;i<=30;i++){v.dispatchEvent(mk('pointermove',sx-len/2+len*i/30,sy)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',sx+len/2,sy));}'''
# stroke thickness (rows with alpha) in column x of the frame canvas
THICK="([x])=>{const d=curFrame().canvas.getContext('2d').getImageData(x,0,1,H).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>60)n++;return n}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8871/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("S.pressure=false; S.brush='pen'; setTool('brush'); setLayer('char'); setOp(1); setSize(24)")
        print('default on', await pg.evaluate('S.sizeScreen'))
        await pg.evaluate(PEN, [540, 600, 200]); await pg.wait_for_timeout(80)
        t1 = await pg.evaluate(THICK, [540])
        # zoom 400% around (540,1000) and draw again: line must be ~4x thinner in the picture
        await pg.evaluate("(()=>{vs=fitS*4; setViewAnchor(540,1000,view.width/2,view.height/2); requestRender();})()"); await pg.wait_for_timeout(100)
        await pg.evaluate(PEN, [540, 1000, 200]); await pg.wait_for_timeout(80)
        t4 = await pg.evaluate("([x])=>{const d=curFrame().canvas.getContext('2d').getImageData(x,900,1,200).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>60)n++;return n}", [540])
        print('fit width ~24', 20 <= t1 <= 28, 'zoom 400% width ~6', 4 <= t4 <= 8, t1, t4)
        # turn it off in the Bút ▾ menu: same size in the picture again
        await pg.click('#brushBtn'); await pg.wait_for_timeout(150); await pg.click('.pop .bp-zs'); await pg.evaluate('closePop()')
        print('off saved', await pg.evaluate("JSON.parse(localStorage.getItem('fs-settings')).sizeScreen"))
        await pg.evaluate(PEN, [540, 1060, 120]); await pg.wait_for_timeout(80)
        t4b = await pg.evaluate("([x])=>{const d=curFrame().canvas.getContext('2d').getImageData(x,1030,1,60).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>60)n++;return n}", [540])
        print('off: width ~24 when zoomed', 20 <= t4b <= 28, t4b)
        await pg.evaluate("S.sizeScreen=true; fitView(true)")
        # vector layer: Độ đậm is used and kept
        await pg.evaluate("curFrame().canvas.getContext('2d').clearRect(0,0,W,H); setLayer('vec'); setTool('brush'); setOp(0.5); setSize(20)")
        await pg.evaluate(PEN, [540, 400, 200]); await pg.wait_for_timeout(100)
        st = await pg.evaluate("curFrame().vec.at(-1)")
        print('vec stroke alpha', st and st.get('a'))
        px = await pg.evaluate("(()=>{const c=makeCanvas(),x=c.getContext('2d');drawVec(x,curFrame().vec);return x.getImageData(540,400,1,1).data[3]})()")
        print('vec drawn at 50%', 120 <= px <= 136, px)
        print('clone keeps a', await pg.evaluate("cloneVec(curFrame().vec).at(-1).a"))
        await pg.evaluate("setOp(1)"); await pg.evaluate(PEN, [540, 700, 200]); await pg.wait_for_timeout(100)
        print('100% has no a', await pg.evaluate("!('a' in curFrame().vec.at(-1))"))
        await pg.evaluate("undo()"); await pg.evaluate("undo()"); await pg.evaluate("redo()")
        print('undo/redo keeps a', await pg.evaluate("curFrame().vec.at(-1).a"))
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
