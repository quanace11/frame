import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Quick shapes (line / rect / ellipse, hold-to-snap), symmetry drawing, draw-inside (lock alpha)
srv = subprocess.Popen(['python3','-m','http.server','8832'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
A = "(([x,y])=>curFrame().canvas.getContext('2d').getImageData(x,y,1,1).data[3])"
CLR = "(()=>{curFrame().canvas.getContext('2d').clearRect(0,0,W,H); S.size=10; S.smooth=0.3})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8832/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        print('buttons', await pg.evaluate("['shapeBtn','symBtn','clipBtn'].map(i=>!!document.getElementById(i).offsetParent)"))
        # straight-line mode: wobbly drag ends as a straight line
        await pg.click('#shapeBtn'); print('mode', await pg.evaluate('S.shapeMode'))
        await pg.evaluate(CLR)
        await pg.evaluate("(()=>{strokeBegin({x:200,y:500,p:.6},0); for(let i=1;i<=40;i++) strokePoint({x:200+i*15,y:500+Math.sin(i)*40,p:.6},i*16); strokePoint({x:800,y:500,p:.6},700); strokeEnd();})()")
        print('line straight', await pg.evaluate(A+"([500,500])")>0, 'no wobble', await pg.evaluate(A+"([500,535])")==0)
        # rect
        await pg.click('#shapeBtn'); await pg.evaluate(CLR)
        await pg.evaluate("(()=>{strokeBegin({x:300,y:300,p:.6},0); for(let i=1;i<=20;i++) strokePoint({x:300+i*20,y:300+i*30,p:.6},i*16); strokeEnd();})()")
        print('rect', await pg.evaluate('S.shapeMode'), await pg.evaluate(A+"([500,300])")>0, await pg.evaluate(A+"([700,600])")>0, 'hollow', await pg.evaluate(A+"([500,600])")==0)
        # ellipse
        await pg.click('#shapeBtn'); await pg.evaluate(CLR)
        await pg.evaluate("(()=>{strokeBegin({x:300,y:1000,p:.6},0); strokePoint({x:700,y:1400,p:.6},50); strokeEnd();})()")
        print('ellipse', await pg.evaluate('S.shapeMode'), await pg.evaluate(A+"([500,1000])")>0, await pg.evaluate(A+"([300,1200])")>0, 'corner empty', await pg.evaluate(A+"([310,1010])")==0)
        await pg.click('#shapeBtn'); print('back to free', await pg.evaluate('S.shapeMode')=='')
        # hold-to-snap: freehand wobbly line then hold still 600ms
        await pg.evaluate(CLR)
        await pg.evaluate("(()=>{strokeBegin({x:200,y:800,p:.6},performance.now()); for(let i=1;i<=30;i++) strokePoint({x:200+i*20,y:800+Math.sin(i*0.7)*25,p:.6},performance.now());})()")
        await pg.wait_for_timeout(800)
        print('hold → line', await pg.evaluate("stroke && stroke.shape"))
        await pg.evaluate("strokeEnd()"); print("snapped straight", await pg.evaluate(A+"([490,810])")>0)
        # hold on a rough circle → ellipse
        await pg.evaluate(CLR)
        await pg.evaluate("(()=>{strokeBegin({x:700,y:1100,p:.6},performance.now()); for(let i=1;i<=40;i++){const t=i/40*Math.PI*2*0.97; strokePoint({x:540+160*Math.cos(t)+(i%3)*4,y:1100+120*Math.sin(t),p:.6},performance.now());}})()")
        await pg.wait_for_timeout(800); print('hold → ellipse', await pg.evaluate("stroke && stroke.shape")); await pg.evaluate("strokeEnd()")
        # symmetry left-right
        await pg.evaluate(CLR); await pg.click('#symBtn'); print('sym', await pg.evaluate('S.sym'))
        await pg.evaluate("(()=>{strokeBegin({x:200,y:300,p:.6},0); for(let i=1;i<=10;i++) strokePoint({x:200+i*10,y:300,p:.6},i*16); strokeEnd();})()")
        print('mirrored', await pg.evaluate(A+"([1080-250,300])")>0)
        await pg.screenshot(path='t32_sym.png')
        await pg.evaluate("undo()"); print('one undo removes both', await pg.evaluate(A+"([1080-250,300])")==0 and await pg.evaluate(A+"([250,300])")==0)
        for _ in range(3): await pg.click('#symBtn')
        print('sym off', await pg.evaluate('S.sym'))
        # lock alpha brush
        await pg.evaluate("setTool('brush')"); print('clip btn shown', await pg.evaluate("!!document.getElementById('clipBtn').offsetParent"))
        await pg.click('#clipBtn')
        await pg.evaluate("(()=>{const f=curFrame(),x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); x.fillStyle='#000'; x.fillRect(400,400,200,200); f.ver++; setColor('#ff0000'); S.size=30;})()")
        await pg.evaluate("(()=>{strokeBegin({x:300,y:500,p:1},0); for(let i=1;i<=30;i++) strokePoint({x:300+i*13,y:500,p:1},i*16); strokeEnd();})()")
        px = "(([x,y])=>[...curFrame().canvas.getContext('2d').getImageData(x,y,1,1).data])"
        print('inside recoloured', (await pg.evaluate(px+"([500,500])"))[:2]==[255,0], 'outside untouched', (await pg.evaluate(px+"([340,500])"))[3]==0)
        await pg.click('#clipBtn')
        await pg.evaluate("(()=>{strokeBegin({x:300,y:700,p:1},0); for(let i=1;i<=30;i++) strokePoint({x:300+i*13,y:700,p:1},i*16); strokeEnd();})()")
        print('off draws anywhere', (await pg.evaluate(px+"([340,700])"))[3]>0)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
