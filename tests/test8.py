import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64, zipfile, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8772'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S='''([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]'''
SHEET='''(idxs)=>{ const cw=200,ch=356,c=makeCanvas(cw*idxs.length,ch),x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
  idxs.forEach((i,k)=>{ const f=S.frames[i]; x.save(); x.translate(k*cw,0); x.scale(cw/W,ch/H); drawPuppet(x,f.pp); x.restore(); x.strokeStyle='#ccc'; x.strokeRect(k*cw,0,cw,ch); });
  return c.toDataURL('image/png'); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8772/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        print('setup', await pg.evaluate('!!ppSetup'), await pg.evaluate('JSON.stringify(ppSetup.J.shL)'))
        await pg.screenshot(path='p1.png')
        t0=time.time(); await pg.click('#ppCutAuto')
        try:
            await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        except Exception as ex:
            print('ERRS', errs); raise
        print('cut secs', round(time.time()-t0,1))
        print('parts', await pg.evaluate("S.pp.parts.map(p=>p.name+':'+p.c.width+'x'+p.c.height)"))
        # select arm R by tapping on its middle (in doc coords: find armR part center)
        arm = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='armR');return [p.ox+p.c.width*0.75,p.oy+p.c.height*0.5]})()")
        s0 = await pg.evaluate(D2S, arm)
        piv = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='armR');return [p.px,p.py]})()")
        # rotate arm down: drag from arm end downward around pivot
        import math
        ang=math.atan2(arm[1]-piv[1],arm[0]-piv[0]); R=math.hypot(arm[0]-piv[0],arm[1]-piv[1])
        path=[await pg.evaluate(D2S,[piv[0]+R*math.cos(ang+t*0.12), piv[1]+R*math.sin(ang+t*0.12)]) for t in range(0,11)]
        await pg.evaluate(PEN,[path]); await pg.wait_for_timeout(200)
        print('armR rot', await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='armR');return curFrame().pp[p.id]})()"))
        # dup frame, rotate armL up via slider
        await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='armL').id; ppSyncBar(); const r=document.getElementById('ppRot'); r.value=60; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));}")
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar(); const r=document.getElementById('ppRot'); r.value=-15; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));}")
        # go back to frame 1 and tween
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(300)
        await pg.click('#ppTweenBtn'); await pg.wait_for_timeout(600)
        print('frames after tween', await pg.evaluate('S.frames.length'))
        url = await pg.evaluate(SHEET, list(range(5)))
        open('pp_tween.png','wb').write(base64.b64decode(url.split(',')[1]))
        # preset walk from last frame
        await pg.click('.fr >> nth=4'); await pg.wait_for_timeout(300)
        await pg.click('[data-ppp=walk]'); await pg.click('#ppPresetGo'); await pg.wait_for_timeout(800)
        n = await pg.evaluate('S.frames.length'); print('frames after walk', n)
        url = await pg.evaluate(SHEET, list(range(4, n)))
        open('pp_walk.png','wb').write(base64.b64decode(url.split(',')[1]))
        # lasso cut mouth from head (keep original)
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar();}")
        await pg.click('#ppKeep'); await pg.click('#ppCutBtn')
        # mouth approx in doc: compute from head part: mit mouth at img (450,310); doc transform k
        mouth = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='head');return [p.ox+p.c.width*0.5,p.oy+p.c.height*0.66]})()")
        ring=[await pg.evaluate(D2S,[mouth[0]+70*math.cos(t/10*6.283), mouth[1]+35*math.sin(t/10*6.283)]) for t in range(11)]
        await pg.evaluate(PEN,[ring]); await pg.wait_for_timeout(500)
        print('parts after cut', await pg.evaluate('S.pp.parts.length'))
        await pg.evaluate("()=>{const r=document.getElementById('ppRole'); r.value='mouth'; r.dispatchEvent(new Event('change'));}")
        await pg.screenshot(path='p2.png')
        # undo/redo pose
        await pg.click('#undoBtn'); await pg.wait_for_timeout(200)
        # save + reload
        await pg.wait_for_timeout(2500); await pg.reload(); await pg.wait_for_timeout(2000)
        print('reload parts', await pg.evaluate('S.pp && S.pp.parts.length'), 'frames', await pg.evaluate('S.frames.length'))
        # export/import
        await pg.click('#menuBtn'); await pg.click('[data-m=export]')
        await pg.wait_for_selector('text=Lưu file ZIP', timeout=30000)
        async with pg.expect_download() as dl: await pg.click('text=Lưu file ZIP')
        d=await dl.value; await d.save_as('pp.zip'); z=zipfile.ZipFile('pp.zip'); print('zip puppet files', len([n for n in z.namelist() if n.startswith('puppet/')]))
        await pg.set_input_files('#zipFile','pp.zip'); await pg.click('.dlg .btns >> text=Mở'); await pg.wait_for_timeout(2500)
        print('import parts', await pg.evaluate('S.pp && S.pp.parts.length'), 'frames', await pg.evaluate('S.frames.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
