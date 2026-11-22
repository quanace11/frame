import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8884'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# 🎯 Ném vật: the selected cut-out winds up and throws, a code-drawn object flies in an arc to the tapped spot,
# smashes it (cracks stay), shake + flash + sound; ONE undo step.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8884/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("setTool('fx'); openTab('fx','gag')"); await pg.wait_for_timeout(300)
        print('button + objects', await pg.evaluate("!!document.querySelector('[data-gag=throw]') && document.querySelectorAll('[data-tobj]').length==4"))
        await pg.click('[data-tobj=remote]'); await pg.click('[data-gag=throw]'); print('throw mode', await pg.evaluate("gagMode") == 'throw')
        a0 = await pg.evaluate("ppCurAbs(S.frames[0], ppSelChar())")
        u0 = await pg.evaluate("undoStack.length")
        tx, ty = await pg.evaluate("[W*0.3, H*0.2]")
        # the target pixel area is empty before the throw
        PIX = "(async i=>{const f=S.frames[i];await ensureLoaded(f);const d=f.canvas.getContext('2d').getImageData(Math.round(W*0.3)-60,Math.round(H*0.2)-60,120,120).data;let n=0;for(let k=3;k<d.length;k+=4)if(d[k]>100)n++;return n})"
        await pg.evaluate("ensureLoaded(S.frames[0])")
        print('target empty before', await pg.evaluate(f"{PIX}(0)") == 0)
        await pg.evaluate(f"gagRun('throw', {{x:{tx}, y:{ty}}})"); await pg.wait_for_timeout(2500)
        n = await pg.evaluate("S.frames.length"); print('frames made', n == 23, n)
        print('one undo step', await pg.evaluate("undoStack.length") == u0 + 1)
        side = 'L' if await pg.evaluate("(()=>{const ch=ppSelChar(),m=r=>S.pp.parts.find(q=>q.role===r&&ppCharOf(q)===ch);return !m('foreR')})()") else None
        ab3 = await pg.evaluate("ppCurAbs(S.frames[3], ppSelChar())")
        up = min(ab3.get('foreR', 0), ab3.get('foreL', 0), key=lambda v: -abs(((v + 180) % 360) - 180 + 90) )
        print('wind-up: a forearm points up', any(-170 <= ((ab3[k] + 180) % 360 - 180) <= -10 for k in ('foreR', 'foreL') if k in ab3), {k: round(ab3[k]) for k in ('foreR','foreL') if k in ab3})
        ab22 = await pg.evaluate("ppCurAbs(S.frames[22], ppSelChar())")
        print('arm back at rest', all(abs(((ab22[k] - a0[k] + 180) % 360) - 180) < 3 for k in ('armR','armL','foreR','foreL') if k in a0))
        await pg.evaluate("Promise.all(S.frames.map(f=>ensureLoaded(f)))"); await pg.wait_for_timeout(500)
        print('crack stays at target', await pg.evaluate(f"{PIX}(12)") > 200 and await pg.evaluate(f"{PIX}(22)") > 200)
        mid = await pg.evaluate("(async()=>{const f=S.frames[8];await ensureLoaded(f);await ensureLoaded(S.frames[0]);const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>100)n++;const g=S.frames[0].canvas.getContext('2d').getImageData(0,0,W,H).data;let m=0;for(let k=3;k<g.length;k+=16)if(g[k]>100)m++;return n-m})()")
        print('object in flight drawn', mid > 50, mid)
        sh = await pg.evaluate("S.frames.map(f=>f.shake||0)"); print('shake + flash at hit', sh[11] >= 20 and await pg.evaluate("S.frames[11].flash"), sh)
        print('XOẢNG text', await pg.evaluate("S.frames[11].texts.some(t=>t.str==='XOẢNG!') && !S.frames[20].texts.some(t=>t.gag)"))
        sfx = await pg.evaluate("S.audio.sfx.map(s=>[S.frames.findIndex(f=>f.id===s.frameId),s.kind])"); print('sfx', sorted(sfx) == sorted([[5,'whoosh'],[11,'crash'],[11,'bang']]), sfx)
        await pg.evaluate("S.cur=8; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='nem_vat.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(600)
        print('undo', await pg.evaluate("S.frames.length") == 1 and await pg.evaluate("S.audio.sfx.length") == 0 and abs(await pg.evaluate("ppCurAbs(S.frames[0], ppSelChar()).armR") - a0['armR']) < 1)
        print('objects draw', await pg.evaluate("(()=>{const c=makeCanvas(200,200),x=c.getContext('2d');for(const k of [...document.querySelectorAll('[data-tobj]')].map(b=>b.dataset.tobj))throwObjDraw(x,k,100,100,40,0.5);aCrack(x,100,100,90,5,1);return true})()"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
