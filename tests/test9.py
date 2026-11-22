import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8774'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
POSE='''(mode)=>{ const f=curFrame(); const R=r=>S.pp.parts.find(x=>x.role===r).id;
  f.pp={[R('armR')]:{r:75},[R('armL')]:{r:55},[R('legL')]:{r:25},[R('legR')]:{r:-25},[R('head')]:{r:-18}};
  const c=makeCanvas(700,1250),x=c.getContext('2d'); x.fillStyle='#bfe3ff'; x.fillRect(0,0,c.width,c.height); x.translate(-190,-330); drawPuppet(x,f.pp);
  x.setTransform(1,0,0,1,0,0); x.fillStyle='#000'; x.font='bold 44px sans-serif'; x.fillText(mode,20,60); return c.toDataURL(); }'''
async def run(mode):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8774/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click(f'[data-ppf={mode}]')
        t=time.time(); await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000)
        print(mode,'cut secs', round(time.time()-t,1), 'mode now', await pg.evaluate('ppFillMode'))
        url = await pg.evaluate(POSE, mode)
        open(f'gap_{mode}.png','wb').write(base64.b64decode(url.split(',')[1]))
        if mode=='fast':
            # manual patch test: select torso, patch a lasso near shoulder
            await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='torso').id; ppSyncBar();}")
            await pg.click('#ppPatchBtn')
            import math
            c = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='torso');return [p.ox+p.c.width+20,p.oy+60]})()")
            ring=[await pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[c[0]+40*math.cos(t/10*6.283), c[1]+40*math.sin(t/10*6.283)]) for t in range(11)]
            await pg.evaluate('''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
              const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
              v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
              v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}''',[ring])
            await pg.wait_for_timeout(1500)
            print('patch torso size', await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='torso');return [p.c.width,p.c.height,p.ox,p.oy]})()"))
        print('ERR', errs); await b.close()
async def main():
    for m in ['off','fast','ai']: await run(m)
asyncio.run(main()); srv.kill()
