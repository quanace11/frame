import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Tẩy ở lớp Nét tẩy tới đâu mất tới đó (cắt nét), "Tẩy cả nét" là tuỳ chọn; giữ yên bút không tự nắn nét (trừ khi bật)
srv = subprocess.Popen(['python3','-m','http.server','9402'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
DRAW='''async ([pts, hold])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();const M=viewMat();
 const s=q=>[(M[0]*q[0]+M[2]*q[1]+M[4])/DPR,(M[1]*q[0]+M[3]*q[1]+M[5])/DPR];
 const mk=(t,q)=>{const [x,y]=s(q);return new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:t==='pointerup'?0:1,bubbles:true,cancelable:true})};
 v.dispatchEvent(mk('pointerdown',pts[0])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i])); await new Promise(r=>setTimeout(r,6));}
 if(hold) await new Promise(r=>setTimeout(r,hold));
 v.dispatchEvent(mk('pointerup',pts[pts.length-1])); await new Promise(r=>setTimeout(r,50));}'''
def line(a,b,n=30): return [[a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n] for i in range(n+1)]
# alpha of the drawn Nét layer at a doc point
VA="([x,y])=>{const c=makeCanvas(),g=c.getContext('2d');drawVec(g,curFrame().vec);return g.getImageData(x,y,1,1).data[3]}"
async def main():
    errs = []
    def check(name, ok, *info):
        print(name, ok, *info)
        if not ok: errs.append(name)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9402/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("S.pressure=false; S.smooth=0; setTool('brush'); setLayer('vec'); setOp(1); setSize(10)")
        check('defaults: partial eraser, no quick shape', await pg.evaluate("S.vecEraseWhole===false && S.quickShape===false"))
        await pg.evaluate(DRAW, [line([200,600],[880,600]), 0])
        check('one stroke', await pg.evaluate("curFrame().vec.length") == 1)
        # erase across the middle: the stroke is cut, both ends stay
        await pg.evaluate("setTool('eraser'); setSize(30)")
        await pg.evaluate(DRAW, [line([540,500],[540,700]), 0]); await pg.wait_for_timeout(100)
        n = await pg.evaluate("curFrame().vec.length")
        check('cut into 2 pieces', n == 2, n)
        check('gap where the eraser went', await pg.evaluate(VA, [540, 600]) == 0)
        check('ends kept', await pg.evaluate(VA, [300, 600]) > 200 and await pg.evaluate(VA, [800, 600]) > 200)
        ids = await pg.evaluate("curFrame().vec.map(s=>s.id)")
        check('pieces have own ids', len(set(ids)) == 2)
        await pg.evaluate("undo()")
        check('undo brings the whole stroke back', await pg.evaluate("curFrame().vec.length") == 1 and await pg.evaluate(VA, [540, 600]) > 200)
        # erase a whole end: shorter stroke
        await pg.evaluate(DRAW, [line([180,560],[180,640]) + line([230,640],[230,560]), 0]); await pg.wait_for_timeout(100)
        check('end rubbed off', await pg.evaluate("curFrame().vec.length") == 1 and await pg.evaluate(VA, [205, 600]) == 0 and await pg.evaluate(VA, [400, 600]) > 200)
        # option: Tẩy cả nét (in the Bút ▾ menu)
        await pg.click('#brushBtn'); await pg.wait_for_timeout(150); await pg.click('.pop .bp-vw'); await pg.evaluate('closePop()')
        check('option saved', await pg.evaluate("JSON.parse(localStorage.getItem('fs-settings')).vecEraseWhole") is True)
        await pg.evaluate(DRAW, [line([540,500],[540,700]), 0]); await pg.wait_for_timeout(100)
        check('whole stroke erased with the option', await pg.evaluate("curFrame().vec.length") == 0)
        await pg.evaluate("S.vecEraseWhole=false")
        # quick shape: a wobbly line held still stays as drawn
        await pg.evaluate("setLayer('char'); setTool('brush'); setSize(8)")
        wob = [[200+i*20, 900+(30 if i%2 else 0)] for i in range(30)]
        await pg.evaluate(DRAW, [wob, 900]); await pg.wait_for_timeout(100)
        # height of the ink band between x 260..740 around y0: a straight line is ~8 px, the wobbly stroke much more
        A = "([y0])=>{const d=curFrame().canvas.getContext('2d').getImageData(260,y0-60,480,120).data;let a=1e9,z=-1;for(let i=3;i<d.length;i+=4)if(d[i]>100){const y=((i-3)/4/480)|0;a=Math.min(a,y);z=Math.max(z,y);}return z-a}"
        check('held stroke not redrawn as a line', await pg.evaluate(A, [915]) > 18, await pg.evaluate(A, [915]))
        # turned on: a straight line held still is cleaned up (still works for people who want it)
        await pg.evaluate("S.quickShape=true")
        await pg.evaluate(DRAW, [line([200,1300],[800,1310]), 900]); await pg.wait_for_timeout(100)
        check('quick shape works when on', await pg.evaluate("curFrame().canvas.getContext('2d').getImageData(500,1305,1,1).data[3]") > 100)
        # even when on, a wobbly stroke is not turned into a line
        await pg.evaluate(DRAW, [[[200+i*20, 1500+(30 if i%2 else 0)] for i in range(30)], 900]); await pg.wait_for_timeout(100)
        check('wobbly stroke kept when on', await pg.evaluate(A, [1515]) > 18, await pg.evaluate(A, [1515]))
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
