import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9124'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# Each character has its own motion on the shared frames (like Animate layers/symbols): with 2 characters the walk preset
# writes onto the frames that are there for the selected one only, 🔁 Lặp chu kỳ repeats one character's in-place cycle,
# 〰 path moves only it. The other character is never touched. Each is one undo step.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9124/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("(async()=>{await kitAdd(); await kitAdd();})()"); await pg.wait_for_timeout(500)
        roots = await pg.evaluate("ppRoots().map(p=>p.id)"); A, B = roots[0], roots[1]
        print('2 characters', len(roots) == 2)
        await pg.evaluate(f"(()=>{{ppQ(S.frames[0],'{A}').dx=-200;ppQ(S.frames[0],'{B}').dx=200;S.frames[0].ppKey=true;requestRender()}})()")
        charPose = lambda cid, i: pg.evaluate(f"(()=>{{const f=S.frames[{i}],o={{}};S.pp.parts.filter(p=>ppCharOf(p)==='{cid}').forEach(p=>o[p.id]=f.pp&&f.pp[p.id]||null);return JSON.stringify(o)}})()")
        bpose0 = await charPose(B, 0)
        # walk preset on A: 2+ characters → poses written onto frames (added), B holds
        await pg.evaluate(f"(async()=>{{ppSel='{A}';ppPreset='walk';await ppMakePreset()}})()"); await pg.wait_for_timeout(500)
        print('walk preset makes 8 frames', await pg.evaluate("S.frames.length") == 8)
        bs = [await charPose(B, i) for i in range(8)]
        print('B holds its pose on the new frames', all(x == bpose0 for x in bs))
        a1, a3 = await charPose(A, 1), await charPose(A, 3)
        print('A walks', a1 != a3)
        # 🔁 loop A's cycle 1-8 up to frame 24 (with the UI)
        await pg.evaluate(f"ppSel='{A}'; S.tool='puppet'; ppSyncBar(); openTab('pp','frames')"); await pg.wait_for_timeout(200)
        print('cycle inputs prefilled', await pg.evaluate("$('#cycB').value") == '8')
        await pg.fill('#cycA', '1'); await pg.fill('#cycB', '8'); await pg.fill('#cycTo', '24'); await pg.click('#cycGo')
        await pg.wait_for_function('S.frames.length === 24', timeout=10000); await pg.wait_for_timeout(300)
        print('loops to frame 24', True)
        same = [await charPose(A, i) == await charPose(A, i % 8) for i in range(8, 24)]
        print('A repeats its cycle', all(same))
        bs = [await charPose(B, i) for i in range(24)]
        print('B untouched by the loop', all(x == bpose0 for x in bs))
        print('path length set to the loop', await pg.evaluate("$('#ppPathN').value") == '24')
        # 〰 path for A over 24 frames
        await pg.evaluate("(async()=>{S.cur=0;const pts=[];for(let k=0;k<=20;k++)pts.push({x:300+k*20,y:1200});await ppApplyPath(pts)})()"); await pg.wait_for_timeout(500)
        mv = await pg.evaluate(f"S.frames.map(f=>[f.lip&&f.lip.mv&&f.lip.mv['{A}'],f.lip&&f.lip.mv&&f.lip.mv['{B}']])")
        print('A moves along the path, B does not', mv[23][0]['x'] > 350 and all(m[1] is None for m in mv))
        await pg.evaluate("S.cur=12; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='lap_chu_ky.png')
        # now B gets its own walk on the frames that are there; A untouched
        apose = [await charPose(A, i) for i in range(24)]
        await pg.evaluate(f"(async()=>{{S.cur=0;ppSel='{B}';ppPreset='walk';await ppMakePreset()}})()"); await pg.wait_for_timeout(500)
        print('no frames inserted for B', await pg.evaluate("S.frames.length") == 24)
        print('B walks now', await charPose(B, 2) != bpose0)
        print('A untouched by B walk', [await charPose(A, i) for i in range(24)] == apose)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('one undo removes B walk', await charPose(B, 2) == bpose0 and [await charPose(A, i) for i in range(24)] == apose)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500); await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('undo path then loop', await pg.evaluate("S.frames.length") == 8)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
