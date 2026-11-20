import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8776'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '404' not in m.text else None)
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8776/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        await pg.evaluate("()=>{ppFillMode='ai'; ppSel=S.pp.parts.find(x=>x.role==='torso').id; ppSyncBar();}")
        await pg.click('#ppPatchBtn')
        # lasso a hole across the shirt (fill an area that cuts into shirt + outside)
        c = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='torso');return [p.ox+p.c.width*0.85,p.oy+p.c.height*0.3]})()")
        ring=[await pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[c[0]+60*math.cos(t/12*6.283), c[1]+60*math.sin(t/12*6.283)]) for t in range(13)]
        await pg.evaluate('''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
          const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
          v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
          v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}''',[ring])
        t=time.time(); await pg.wait_for_function('!document.querySelector(".ov")', timeout=120000)
        print('patch secs', round(time.time()-t,1), 'migan loaded', await pg.evaluate('!!miganSession'), 'mode', await pg.evaluate('ppFillMode'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
