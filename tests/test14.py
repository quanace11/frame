import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, zipfile, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8780'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def cut(pg, add=False):
    await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
    await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
    await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
    await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_timeout(400)
    if add: await pg.click('.dlg .btns >> text=Thêm nhân vật')
    await pg.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8780/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ')
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        await cut(pg)
        # cut mouth from head as new part (keep), set role mouth
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar();}")
        await pg.click('#ppKeep'); await pg.click('#ppCutBtn')
        m = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='head');return [p.ox+p.c.width*0.5,p.oy+p.c.height*0.7]})()")
        ring=[await d2s(m[0]+60*math.cos(t/10*6.283), m[1]+28*math.sin(t/10*6.283)) for t in range(11)]
        await pg.evaluate(PEN,[ring]); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const r=document.getElementById('ppRole'); r.value='mouth'; r.dispatchEvent(new Event('change'));}")
        # add variant from file
        await pg.set_input_files('#ppVarFile',os.path.join(ASSETS,'mouth_open.png')); await pg.wait_for_timeout(800)
        mp = "S.pp.parts.find(x=>x.role==='mouth')"
        print('mouth alts', await pg.evaluate(f"{mp}.alts.length"), 'v on frame', await pg.evaluate(f"(curFrame().pp[{mp}.id]||{{}}).v"))
        # dup variant + paint on it + undo
        await pg.click('#ppVarDup'); await pg.wait_for_timeout(400)
        await pg.click('#ppPaintBtn')
        c = await pg.evaluate(f"(()=>{{const p={mp},im=ppImg(p,curFrame().pp[p.id]);return [im.x+im.c.width/2, im.y+im.c.height/2]}})()")
        await pg.evaluate(PEN,[[await d2s(c[0]-30,c[1]), await d2s(c[0]+30,c[1])]]); await pg.wait_for_timeout(300)
        print('undo has partpix', await pg.evaluate('undoStack.at(-1).partpix===true'))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300); await pg.click('#ppPaintBtn')
        # talk preset uses variants
        await pg.click('[data-ppp=talk]'); await pg.click('#ppPresetGo'); await pg.wait_for_timeout(800)
        print('talk v per frame', await pg.evaluate(f"S.frames.map(f=>(f.pp[{mp}.id]||{{}}).v||0)"))
        await pg.screenshot(path='b1.png')
        # second character
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(200)
        await cut(pg, add=True)
        print('roots', await pg.evaluate("S.pp.parts.filter(p=>!p.parent).length"), 'parts', await pg.evaluate('S.pp.parts.length'))
        # move second char by dragging torso in move mode
        await pg.click('[data-ppd=move]')
        tor = await pg.evaluate("(()=>{const p=S.pp.parts.filter(p=>!p.parent).at(-1);return [p.px,p.py-100]})()")
        await pg.evaluate(PEN,[[await d2s(*tor), await d2s(tor[0]+250,tor[1])]]); await pg.wait_for_timeout(300)
        await pg.screenshot(path='b2.png')
        # export/import roundtrip
        await pg.wait_for_timeout(2000)
        await pg.click('#menuBtn'); await pg.click('[data-m=export]'); await pg.wait_for_selector('text=Lưu file ZIP', timeout=30000)
        async with pg.expect_download() as dl: await pg.click('text=Lưu file ZIP')
        d=await dl.value; await d.save_as('b.zip')
        await pg.set_input_files('#zipFile','b.zip'); await pg.click('.dlg .btns >> text=Mở'); await pg.wait_for_timeout(2500)
        print('import parts', await pg.evaluate('S.pp.parts.length'), 'mouth alts', await pg.evaluate("S.pp.parts.filter(x=>x.role==='mouth').map(p=>p.alts.length)"))
        await pg.reload(); await pg.wait_for_timeout(2000)
        print('reload mouth alts', await pg.evaluate("S.pp.parts.filter(x=>x.role==='mouth').map(p=>p.alts.length)"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
