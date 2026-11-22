import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8874'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# 〰 Motion path: draw a line, the cut-out character walks along it over N frames (walk cycle repeats), one undo step.
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8874/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("ppPreset='walk'"); await pg.evaluate("ppMakePreset()"); await pg.wait_for_timeout(800)
        print('walk frames', await pg.evaluate("S.frames.length"))
        await pg.evaluate("S.cur=0; updateFrameUI(); openTab('pp','frames')"); await pg.wait_for_timeout(200)
        await pg.fill('#ppPathN', '24'); await pg.select_option('#ppPathEase', 'linear')
        await pg.click('#ppPathBtn'); print('path mode on', await pg.evaluate("ppPathMode"))
        a = await pg.evaluate(D2S, [300, 1300]); z = await pg.evaluate(D2S, [700, 1100])
        pts = [[a[0] + (z[0]-a[0])*i/40, a[1] + (z[1]-a[1])*i/40] for i in range(41)]
        await pg.evaluate(PEN, pts); await pg.wait_for_timeout(1500)
        print('path mode off after drawing', not await pg.evaluate("ppPathMode"))
        n = await pg.evaluate("S.frames.length"); print('frames extended to 24', n == 24)
        root = await pg.evaluate("ppSelChar()")
        mv = await pg.evaluate(f"S.frames.map(f=>f.lip&&f.lip.mv&&f.lip.mv['{root}'])")
        print('starts at 0', abs(mv[0]['x']) < 1 and abs(mv[0]['y']) < 1)
        print('ends at the path end', abs(mv[-1]['x'] - 400) < 15 and abs(mv[-1]['y'] + 200) < 15, mv[-1])
        steps = [mv[k+1]['x'] - mv[k]['x'] for k in range(23)]
        print('even steps (linear)', max(steps) - min(steps) < 3)
        print('walk cycle repeats', await pg.evaluate("JSON.stringify(S.frames[8].pp)===JSON.stringify(S.frames[0].pp) && JSON.stringify(S.frames[13].pp)===JSON.stringify(S.frames[5].pp)"))
        # drawn where it moved; tapping on it there still selects it
        hit = await pg.evaluate(f"(()=>{{const f=S.frames[23],t=S.pp.parts.find(p=>p.role==='torso');const P={{x:t.px+400,y:t.py-200-40}};const h=ppHit(P,ppPoseFor(f));return !!h}})()")
        print('hit test follows the path', hit)
        moved = await pg.evaluate("(()=>{const f=S.frames[23],c=makeCanvas(W,H),x=c.getContext('2d');drawPuppet(x,f.pp,f.lip);const t=S.pp.parts.find(p=>p.role==='torso');return x.getImageData(Math.round(t.px+400),Math.round(t.py-240),1,1).data[3]>0 && x.getImageData(Math.round(t.px),Math.round(t.py-40),1,1).data[3]===0})()")
        print('drawn at the new place', moved)
        # smooth playback moves between frame positions
        mid = await pg.evaluate(f"(()=>{{const l=ppLipAt(3,S.frames[3].dur/1000*0.75);return l.mv['{root}'].x}})()")
        print('smooth playback in between', mv[3]['x'] < mid < mv[4]['x'])
        # survives re-tweening and lip-sync rewrites
        await pg.evaluate("ppRetween()"); print('kept after retween', await pg.evaluate(f"!!S.frames[20].lip.mv['{root}']"))
        # one undo step removes added frames and the path
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        print('undo', await pg.evaluate(f"S.frames.length===8 && S.frames.every(f=>!(f.lip&&f.lip.mv))"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300)
        print('redo', await pg.evaluate(f"S.frames.length===24 && !!S.frames[23].lip.mv['{root}']"))
        await pg.evaluate("S.cur=23; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='duongdi.png')
        await pg.click('#ppPathClear'); print('clear', await pg.evaluate("S.frames.every(f=>!(f.lip&&f.lip.mv))"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
