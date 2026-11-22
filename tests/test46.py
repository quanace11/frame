import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# ⚽ ball path (draw a curve → ball flies along it over N frames, adds frames, sounds, one undo) + ⚡ one-tap gag combos
srv = subprocess.Popen(['python3','-m','http.server','8846'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
DRAG='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:9,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,8));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
DOC2SCR = "(([x,y])=>{const [a,b,c,d,e,f]=viewMat(); return [(a*x+c*y+e)/DPR,(b*x+d*y+f)/DPR]})"
INK = "(([i,x,y,r])=>{const f=S.frames[i]; return ensureLoaded(f).then(()=>{const d=f.canvas.getContext('2d').getImageData(Math.round(x-r),Math.round(y-r),2*r,2*r).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]>0) n++; return n;})})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8846/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.click('#addBtn'); await pg.evaluate("S.cur=0; updateFrameUI()")
        await pg.evaluate("setTool('fx'); openTab('fx','gag')"); await pg.wait_for_timeout(200)
        check('ball tab visible', await pg.evaluate("!document.getElementById('ballGo').closest('[data-tab]').hidden && document.getElementById('ballGo').offsetParent!==null"))
        await pg.fill('#ballN', '6'); await pg.dispatch_event('#ballN', 'change')
        await pg.click('#ballGo')
        check('ball mode on', await pg.evaluate("!!ballMode"))
        # path in doc coords: kick from bottom-left curving to upper right
        docs = [[200 + 680 * t / 20, 1500 - 900 * t / 20 - 500 * (t / 20) * (1 - t / 20)] for t in range(21)]
        scr = [await pg.evaluate(DOC2SCR, d) for d in docs]
        await pg.evaluate(DRAG, [scr]); await pg.wait_for_timeout(800)
        await pg.screenshot(path='t46_ball.png')
        check('frames added up to 6', await pg.evaluate("S.frames.length") == 6)
        check('ball mode off after drawing', await pg.evaluate("!ballMode"))
        check('ball at start (frame 1)', await pg.evaluate(INK, [0, 200, 1500, 20]) > 300)
        check('ball at end (frame 6)', await pg.evaluate(INK, [5, 880, 600, 20]) > 300)
        check('frame 6 has nothing at start', await pg.evaluate(INK, [5, 200, 1500, 20]) == 0)
        kinds = await pg.evaluate("(S.audio.sfx||[]).map(x=>x.kind)")
        check('kick + whoosh + bonk sounds', kinds == ['kick', 'whoosh', 'bonk'])
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        check('one undo removes it all', await pg.evaluate("S.frames.length") == 3 and await pg.evaluate(INK, [0, 200, 1500, 20]) == 0 and await pg.evaluate("(S.audio.sfx||[]).length") == 0)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        check('redo brings it back', await pg.evaluate("S.frames.length") == 6 and await pg.evaluate(INK, [5, 880, 600, 20]) > 300 and await pg.evaluate("S.audio.sfx.length") == 3)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        # short path → refused
        await pg.click('#ballGo'); await pg.evaluate(DRAG, [[scr[0], [scr[0][0] + 2, scr[0][1]]]]); await pg.wait_for_timeout(300)
        check('tiny path ignored', await pg.evaluate("S.frames.length") == 3)
        # gag combos: each one is a single undo step
        face = await pg.evaluate(DOC2SCR, [540, 700])
        for key, n in [('shock', 6), ('ballface', 12), ('goal', 10), ('dizzy', 16), ('angry', 12)]:
            await pg.evaluate("S.cur=0; updateFrameUI()")
            await pg.click(f'[data-gag={key}]'); await pg.wait_for_timeout(100)
            check(f'{key}: waiting for tap', await pg.evaluate("gagMode") == key)
            await pg.evaluate(DRAG, [[face, face]]); await pg.wait_for_timeout(900)
            check(f'{key}: {n} frames', await pg.evaluate("S.frames.length") == max(3, n))
            check(f'{key}: sounds attached', await pg.evaluate("(S.audio.sfx||[]).length") >= 2)
            await pg.screenshot(path=f't46_{key}.png')
            await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
            check(f'{key}: undo clean', await pg.evaluate("S.frames.length") == 3 and await pg.evaluate("(S.audio.sfx||[]).length") == 0 and await pg.evaluate("S.frames.every(f=>!f.cam && !f.flash && !(f.texts||[]).length && !f.shake)"))
        # shock: camera zoom and snap back
        await pg.evaluate("S.cur=0; updateFrameUI()")
        await pg.click('[data-gag=shock]'); await pg.evaluate(DRAG, [[face, face]]); await pg.wait_for_timeout(800)
        z = await pg.evaluate("[0,1,2,3,4,5].map(i=>camAt(i).z)"); print(z)
        check('shock zooms in then back', z[0] >= 2.2 and z[4] >= 2.2 and z[5] == 1)
        check('shock flash + shake', await pg.evaluate("S.frames[0].flash && S.frames[0].shake>0"))
        # saved + reloaded keeps sounds and camera
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1200); await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved', await pg.evaluate("S.frames.length") == 6 and await pg.evaluate("S.audio.sfx.length") == 2 and await pg.evaluate("camAt(2).z") >= 2.2)
        # leaving the FX tool cancels a pending combo
        await pg.evaluate("setTool('fx'); openTab('fx','gag')"); await pg.click('[data-gag=dizzy]'); await pg.evaluate("setTool('brush')")
        check('tool change cancels', await pg.evaluate("gagMode===null && ballMode===null"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
