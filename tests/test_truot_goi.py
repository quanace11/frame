import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9108'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# 🛷 Knee slide, one tap: the character rushes in, slows down, stops where it stands, dust behind, leans back,
# camera pushes in, SFX; one undo step
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9108/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
        print('step 1 tells where the path / slide buttons are', await pg.evaluate("[...document.querySelectorAll('span')].some(e=>e.textContent.includes('Bước 1 — Đặt khớp')&&e.textContent.includes('Trượt gối')&&e.offsetParent)"))
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const id=ppSelChar(),q=ppQ(S.frames[0],id);q.sx=q.sy=0.6;q.dy=200;requestRender()})()")
        await pg.evaluate("openTab('pp','frames')"); await pg.wait_for_timeout(200)
        await pg.fill('#slideN', '20'); await pg.click('[data-slide="1"]')
        await pg.wait_for_function('S.frames.length === 30', timeout=20000); await pg.wait_for_timeout(500)
        print('20 slide frames + 10 hold frames', await pg.evaluate("S.frames.length") == 30)
        root = await pg.evaluate("ppSelChar()")
        mv = await pg.evaluate(f"S.frames.map(f=>f.lip&&f.lip.mv&&f.lip.mv['{root}'])")
        xs = [m['x'] for m in mv]
        print('rushes in from the left', xs[0] < -500)
        print('stops where it stood', all(abs(x) < 0.5 for x in xs[19:]))
        steps = [xs[k+1] - xs[k] for k in range(19)]
        print('slows down (ease out)', all(s > 0 for s in steps) and steps[0] > steps[-1] * 4)
        tor = await pg.evaluate("S.pp.parts.find(p=>p.role==='torso').id")
        rs = await pg.evaluate(f"S.frames.map(f=>(f.pp['{tor}']||{{}}).r||0)")
        print('leans back at the end', abs(rs[0]) < 0.1 and abs(rs[29] + 12) < 0.1 and abs(rs[19] + 12) < 0.1)
        dust = await pg.evaluate("(async()=>{const o=[];for(const i of [0,10,16]){const f=S.frames[i];await ensureLoaded(f);const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data;let c=0;for(let k=3;k<d.length;k+=16)if(d[k]>0)c++;o.push(c)}return o})()")
        print('dust behind the slide', dust[1] > 200 and dust[2] > 200, dust)
        cam = await pg.evaluate("S.frames.map((f,i)=>f.cam?[i,f.cam.tr,f.cam.z]:null).filter(Boolean)")
        print('camera pushes in near the stop', len(cam) == 1 and cam[0][0] == 17 and cam[0][1] == 'smooth' and cam[0][2] > 1.3, cam)
        print('slide + crowd sounds', await pg.evaluate("JSON.stringify(S.audio.sfx.map(s=>s.kind))") == '["slide","crowd"]')
        await pg.evaluate("S.cur=12; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='truot_goi.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('one undo removes it all', await pg.evaluate("S.frames.length===1 && !(S.frames[0].lip&&S.frames[0].lip.mv) && !(S.audio.sfx||[]).length && !S.frames[0].cam"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        print('redo', await pg.evaluate("S.frames.length===30 && S.audio.sfx.length===2"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
