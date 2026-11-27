import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Vòng tròn cỡ bút (brush-cursor.js) + cỡ tẩy riêng với cỡ bút (S.eSize)
srv = subprocess.Popen(['python3','-m','http.server','9627'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
HOVER='''([x,y,b])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  v.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0,buttons:b,bubbles:true,cancelable:true}));
  const el=document.getElementById('brushCur'); return el&&!el.hidden?{w:el.getBoundingClientRect().width,x:parseFloat(el.style.left)-r.left,y:parseFloat(el.style.top)-r.top,er:el.classList.contains('er')}:null}'''
def ok(name, c, *a): print(name, bool(c), *a); return c
async def main():
    fails = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9627/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("S.brush='pen'; setLayer('char'); setTool('brush'); setSize(10); setTool('eraser'); setSize(60); setTool('brush')")
        # separate sizes
        fails += not ok('brush size kept', await pg.evaluate("S.size") == 10 and await pg.inner_text('#sizeVal') == '10')
        fails += not ok('label Cỡ bút', (await pg.inner_text('#top .sizeL')) == 'Cỡ bút')
        await pg.click('.tool[data-tool=eraser]')
        fails += not ok('eraser size shown', await pg.inner_text('#sizeVal') == '60' and (await pg.inner_text('#top .sizeL')) == 'Cỡ tẩy')
        await pg.click('#top [data-stp=size][data-d="1"]'); await pg.wait_for_timeout(50)
        fails += not ok('+ changes eraser only', await pg.evaluate("[S.eSize, S.size]") == [70, 10])
        fails += not ok('saved', await pg.evaluate("(()=>{const o=JSON.parse(localStorage.getItem('fs-settings'));return [o.size,o.eSize]})()") == [10, 70])
        # preview dot while changing the size
        pv = await pg.evaluate("(()=>{const el=document.getElementById('brushCur');return el&&!el.hidden&&el.classList.contains('prev')?el.querySelector('b').textContent:null})()")
        fails += not ok('size preview shown', pv == 'Cỡ tẩy 70', pv)
        await pg.screenshot(path='co_but_preview.png')
        await pg.wait_for_timeout(1300)
        fails += not ok('preview hides', await pg.evaluate("document.getElementById('brushCur').hidden"))
        # hover ring = real size on screen (eraser: hard = pen sizeK 1)
        await pg.evaluate("S.sizeScreen=true; fitView(true)")
        exp = await pg.evaluate("S.eSize*fitS/DPR")
        h = await pg.evaluate(HOVER, [400, 400, 0])
        fails += not ok('eraser ring follows pen', h and abs(h['w'] - exp) < 2 and abs(h['x'] - 400) < 1 and h['er'], h, exp)
        # zoom without "Giữ cỡ": ring grows with the zoom
        await pg.evaluate("S.sizeScreen=false; vs=fitS*2; requestRender()")
        h2 = await pg.evaluate(HOVER, [410, 400, 0])
        fails += not ok('ring follows zoom', h2 and abs(h2['w'] - 70 * await pg.evaluate("vs/DPR")) < 2, h2)
        await pg.evaluate("S.sizeScreen=true; fitView(true)")
        # brush ring uses the brush size (marker sizeK 1.4) and hides while the line is being drawn
        await pg.click('.tool[data-tool=brush]'); await pg.evaluate("S.brush='marker'")
        h3 = await pg.evaluate(HOVER, [420, 400, 0]); exp3 = await pg.evaluate("10*1.4*fitS/DPR")
        fails += not ok('brush ring', h3 and abs(h3['w'] - exp3) < 2 and not h3['er'], h3, exp3)
        fails += not ok('hidden while drawing', await pg.evaluate(HOVER, [430, 400, 1]) is None)
        await pg.evaluate("document.getElementById('view').dispatchEvent(new PointerEvent('pointerleave',{pointerId:7,pointerType:'pen'}))")
        fails += not ok('hidden on leave', await pg.evaluate("document.getElementById('brushCur').hidden"))
        # other tools: no ring
        await pg.evaluate("setTool('fill')")
        fails += not ok('no ring for fill', await pg.evaluate(HOVER, [400, 400, 0]) is None)
        # really erases with the eraser size: a 70 px eraser clears a wide band
        await pg.evaluate("S.brush='pen'; S.pressure=false; setTool('brush'); (()=>{const x=curFrame().canvas.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,W,H);})(); setTool('eraser')")
        await pg.evaluate('''async()=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();const M=viewMat();const sx=(M[0]*540+M[2]*800+M[4])/DPR, sy=(M[1]*540+M[3]*800+M[5])/DPR;
          const mk=(t,x,y)=>new PointerEvent(t,{pointerId:8,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
          v.dispatchEvent(mk('pointerdown',sx-60,sy)); for(let i=1;i<=20;i++){v.dispatchEvent(mk('pointermove',sx-60+6*i,sy)); await new Promise(r=>setTimeout(r,4));} v.dispatchEvent(mk('pointerup',sx+60,sy));}''')
        await pg.wait_for_timeout(100)
        n = await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(540,0,1,H).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]<60)n++;return n})()")
        fails += not ok('erased band ~70', 62 <= n <= 78, n)
        # ✎ Vẽ lại mảnh: 🧽 Tẩy uses the eraser size
        fails += not ok('part-paint erase size', await pg.evaluate("(()=>{S.tool='puppet'; ppPaint='erase'; const a=curSize(); ppPaint='brush'; const b=curSize(); ppPaint=null; S.tool='eraser'; return [a,b]})()") == [70, 10])
        await b.close()
    print('FAILS', fails)
    if fails: errs.append('%d checks failed' % fails)
    print('ERR', errs)
asyncio.run(main()); srv.kill()
