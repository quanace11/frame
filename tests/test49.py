import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Cỡ / Độ đậm: − + buttons (hold = repeat), non-linear size slider, per-brush opacity that works for every brush + eraser
srv = subprocess.Popen(['python3','-m','http.server','8849'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
MAXA="(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data;let m=0;for(let i=3;i<d.length;i+=4)if(d[i]>m)m=d[i];return m})()"
LINE=[[300+i*4,400] for i in range(60)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8849/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("setSize(8)")
        plus = '#top .stp[data-stp=size][data-d="1"]'; minus = '#top .stp[data-stp=size][data-d="-1"]'
        bb = await pg.eval_on_selector(plus, "e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}")
        print('stepper >= 42px', bb[0] >= 42 and bb[1] >= 42)
        await pg.click(plus); print('size + ->', await pg.evaluate('S.size'), await pg.text_content('#sizeVal'))
        await pg.click(minus); await pg.click(minus); print('size - - ->', await pg.evaluate('S.size'))
        # hold = repeat
        await pg.hover(plus); await pg.mouse.down(); await pg.wait_for_timeout(900); await pg.mouse.up()
        print('hold + grows a lot', await pg.evaluate('S.size') > 12)
        print('slider fine at small end', await pg.evaluate('[posToSize(0),posToSize(250),posToSize(500),posToSize(1000),sizeToPos(150)]'))
        print('steps', await pg.evaluate('[sizeStep(9,1),sizeStep(10,1),sizeStep(30,1),sizeStep(60,1),sizeStep(60,-1),sizeStep(1,-1),sizeStep(150,1)]'))
        # tap the number -> big slider + presets (top-bar sliders are hidden on tablet widths)
        print('top slider hidden at 1366', await pg.eval_on_selector('#sizeIn', 'e=>e.offsetWidth') == 0)
        await pg.click('#sizeVal'); await pg.wait_for_timeout(150)
        await pg.click('.pop [data-qv="20"]'); print('preset 20', await pg.evaluate('S.size'), await pg.text_content('#sizeVal'), await pg.eval_on_selector('.pop [data-qv="20"]', 'e=>e.classList.contains("on")'))
        await pg.screenshot(path='t49_sizepop.png')
        await pg.click('#opVal'); await pg.wait_for_timeout(150); await pg.click('.pop [data-qv="50"]'); print('op preset', await pg.text_content('#opVal'))
        await pg.keyboard.press('Escape'); await pg.evaluate('closePop()')
        # opacity per brush
        await pg.evaluate("S.brushOp={}; S.brush='marker'; setTool('brush')")
        print('marker default shows', await pg.text_content('#opVal'))
        res = {}
        for br in ['pen','pencil','marker','crayon','soft','air','water','ink','callig']:
            row=[]
            for op in [1, 0.3]:
                await pg.evaluate(f"(()=>{{curFrame().canvas.getContext('2d').clearRect(0,0,W,H); S.brush='{br}'; setTool('brush'); setOp({op}); setSize(20)}})()")
                await pg.evaluate(PEN,[LINE]); await pg.wait_for_timeout(60); row.append(await pg.evaluate(MAXA))
            res[br]=row
        print('100% darker than 30% for every brush', all(r[0] > r[1] * 2 for r in res.values()))
        print('line brushes reach full at 100%', all(res[k][0] >= 250 for k in ['pen','pencil','marker','crayon','ink','callig']))
        print('air/water much darker than before at 100%', res['air'][0] > 100, res['water'][0] > 190)
        # each brush remembers its own value; − button steps 5%
        await pg.evaluate("S.brush='pen'; setTool('brush'); setOp(0.4); S.brush='marker'; setTool('brush'); setOp(0.7)")
        await pg.evaluate("S.brush='pen'; setTool('brush')"); print('pen remembers', await pg.text_content('#opVal'))
        await pg.click('#top .stp[data-stp=op][data-d="-1"]'); print('op - ->', await pg.text_content('#opVal'))
        # eraser strength
        await pg.evaluate("(()=>{const c=curFrame().canvas.getContext('2d');c.globalAlpha=1;c.fillStyle='#000';c.fillRect(0,0,W,H);S.eraserType='hard';setTool('eraser');setOp(0.5);setSize(30)})()")
        await pg.evaluate(PEN,[LINE]); await pg.wait_for_timeout(60)
        mn = await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data;let m=255;for(let i=3;i<d.length;i+=4)if(d[i]<m)m=d[i];return m})()")
        print('eraser 50% leaves half', 110 < mn < 145)
        await pg.evaluate("setOp(1)"); await pg.evaluate(PEN,[[[300+i*4,600] for i in range(60)]]); await pg.wait_for_timeout(60)
        mn = await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data;let m=255;for(let i=3;i<d.length;i+=4)if(d[i]<m)m=d[i];return m})()")
        print('eraser 100% clears', mn == 0)
        print('undo still one step', await pg.evaluate("(()=>{const n=undoStack.length;return n>0})()"))
        # Bút ▾ menu has the same controls, kept in sync
        await pg.evaluate("S.brush='pen'; setTool('brush'); setSize(8)")
        await pg.click('#brushBtn'); await pg.wait_for_timeout(200)
        await pg.click('.pop .stp[data-stp=size][data-d="1"]'); print('menu + syncs top', await pg.text_content('#sizeVal'), await pg.text_content('.pop .sizeV'))
        await pg.click('.pop [data-b=marker]'); print('menu shows marker op', await pg.text_content('.pop .opV'), await pg.text_content('.pop .bp-opfor'))
        await pg.screenshot(path='t49_menu.png')
        # settings persist
        await pg.reload(); await pg.wait_for_timeout(800)
        print('persist', await pg.evaluate("[S.size, S.brushOp.marker, S.brushOp.pen]"))
        await pg.set_viewport_size({'width':820,'height':1180}); await pg.wait_for_timeout(300)
        await pg.screenshot(path='t49_portrait.png')
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
