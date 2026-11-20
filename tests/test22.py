import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8794'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN = """async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:x,clientY:y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8794/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        # asset sheet render
        await pg.click('#assetBtn'); await pg.wait_for_timeout(300)
        for cat in ['eyes','mouth','face','hand','fx']:
            await pg.click(f'[data-acat={cat}]'); await pg.wait_for_timeout(150); await pg.screenshot(path=f'a_{cat}.png')
        await pg.click('.dlg .btns >> text=Đóng')
        # vector: per-point drag
        await pg.evaluate("""()=>{setLayer('vec'); const f=curFrame(); f.vec.push({id:'t1',c:'#000',w:6,pts:[{x:100,y:300},{x:200,y:300},{x:300,y:300},{x:400,y:300},{x:500,y:300}]}); setTool('vedit'); vsel.clear(); vsel.add('t1'); updVecBar(); requestRender();}""")
        d2s = "([x,y])=>{const c=Math.cos(vr)*vs,s=Math.sin(vr)*vs;const r=document.getElementById('view').getBoundingClientRect();return [r.left+(c*x-s*y+vtx)/DPR, r.top+(s*x+c*y+vty)/DPR]}"
        a = await pg.evaluate(f"({d2s})([300,300])"); bb = await pg.evaluate(f"({d2s})([300,200])")
        await pg.evaluate(PEN,[[a,[(a[0]+bb[0])/2,(a[1]+bb[1])/2],bb]])
        print('point mode pts', await pg.evaluate("curFrame().vec[0].pts.map(q=>[Math.round(q.x),Math.round(q.y)])"))
        # insert point between
        a = await pg.evaluate(f"({d2s})([150,300])"); bb = await pg.evaluate(f"({d2s})([150,380])")
        await pg.evaluate(PEN,[[a,[(a[0]+bb[0])/2,(a[1]+bb[1])/2],bb]])
        print('after insert', await pg.evaluate("curFrame().vec[0].pts.map(q=>[Math.round(q.x),Math.round(q.y)])"))
        await pg.evaluate("setLayer('char'); setTool('brush')")
        # puppet
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        print('roles', await pg.evaluate("S.pp.parts.map(p=>p.role).join(',')"))
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar();}")
        await pg.click('#ppAssetBtn'); await pg.wait_for_timeout(200)
        print('dlg', await pg.evaluate("[document.querySelectorAll('[data-aset]').length, ppSel, !!document.querySelector('.ov')]"))
        await pg.click('[data-acat=mouth]'); print('sets', await pg.evaluate("[...document.querySelectorAll('[data-aset]')].map(b=>b.dataset.aset)"))
        await pg.evaluate("window.addEventListener('unhandledrejection',e=>console.error('UR',e.reason&&e.reason.stack))")
        await pg.click('[data-aset=lip]'); await pg.wait_for_timeout(2000)
        print('cnt', await pg.evaluate("S.pp.parts.filter(x=>x.asset).length"))
        mp = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.asset);return [p.role,p.alts.length,p.parent===S.pp.parts.find(x=>x.role==='head').id]})()"); print('mouth part', mp)
        # switch variant via library: select mouth part, pick 'grin'
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.asset).id; ppSyncBar();}")
        await pg.click('#ppAssetBtn'); await pg.wait_for_timeout(200)
        await pg.click('#aGrid >> text=Cười to'); await pg.wait_for_timeout(1500)
        print('variant now', await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.asset);return [p.alts.length, curFrame().pp[p.id].v]})()"))
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar();}")
        await pg.click('#ppAssetBtn'); await pg.click('[data-acat=eyes]'); await pg.click('[data-aset=blink]'); await pg.wait_for_timeout(2000)
        await pg.screenshot(path='a_pp.png')
        # gestures
        n0 = await pg.evaluate('S.frames.length')
        await pg.click('#ppGests >> text=Vẫy chào'); await pg.wait_for_timeout(1500)
        n1 = await pg.evaluate('S.frames.length'); print('gesture frames', n1-n0)
        for i,fi in enumerate([4,8]):
            await pg.evaluate(f'selectFrame({fi})'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'g_{i}.png')
        await pg.evaluate('selectFrame(0)')
        for g in ['Vỗ tay','Khoanh tay','Cúi chào','Đấm','Suy nghĩ']:
            await pg.click(f'#ppGests >> text={g}'); await pg.wait_for_timeout(800)
        print('total frames', await pg.evaluate('S.frames.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
