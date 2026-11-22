import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# ☑ multi-select frames: long-press / button, range, timing, duplicate, reverse, delete with undo/redo (pixels survive)
srv = subprocess.Popen(['python3','-m','http.server','8845'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
ORDER = "S.frames.map(f=>f.tag||'?').join('')"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}, has_touch=True); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8845/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # 6 frames A..F, each with a coloured square at a different x so pixels identify them
        await pg.evaluate("""(async()=>{ for(let k=0;k<5;k++) await addFrame(); const L='ABCDEF';
           for(let i=0;i<6;i++){ const f=S.frames[i]; await ensureLoaded(f); f.tag=L[i]; const x=f.canvas.getContext('2d'); x.fillStyle='#e00'; x.fillRect(60+i*120,200,80,80); f.ver++; } buildStrip(); })(); 0""")
        await pg.wait_for_timeout(800)
        print('frames', await pg.evaluate(ORDER))
        # long-press frame 2 (B) → select mode
        box = await pg.evaluate("(()=>{const r=S.frames[1].el.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(*box); await pg.mouse.down(); await pg.wait_for_timeout(650); await pg.mouse.up(); await pg.wait_for_timeout(100)
        print('long-press enters mode', await pg.evaluate("mselOn && msel.size===1 && !document.getElementById('mselBar').hidden"))
        # shift-click frame 4 (D) → range B..D
        await pg.click(f'#strip .fr >> nth=3', modifiers=['Shift']); await pg.wait_for_timeout(100)
        print('range B-D', await pg.evaluate("S.frames.filter(f=>msel.has(f.id)).map(f=>f.tag).join('')"), await pg.inner_text('#mselInfo'))
        # tap toggles off C
        await pg.click('#strip .fr >> nth=2'); print('tap toggles', await pg.evaluate("S.frames.filter(f=>msel.has(f.id)).map(f=>f.tag).join('')"))
        await pg.click('#strip .fr >> nth=2')
        # timing
        await pg.click('[data-msd="0.2"]'); print('dur set', await pg.evaluate("S.frames.map(f=>f.dur).join(',')"))
        # reverse B..D
        await pg.click('[data-ms=rev]'); await pg.wait_for_timeout(200); print('reversed', await pg.evaluate(ORDER))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200); print('undo reverse', await pg.evaluate(ORDER))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(200); print('redo reverse', await pg.evaluate(ORDER))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        # duplicate B..D → inserted after D
        await pg.click('[data-ms=dup]'); await pg.wait_for_timeout(800)
        print('dup', await pg.evaluate("S.frames.length"), 'new ones selected', await pg.evaluate("msel.size"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400); print('undo dup', await pg.evaluate("S.frames.length"))
        # select B,C,D again and delete
        await pg.evaluate("msel.clear(); S.frames.slice(1,4).forEach(f=>msel.add(f.id)); mselSync()")
        await pg.click('[data-ms=del]'); await pg.wait_for_timeout(500)
        print('deleted', await pg.evaluate(ORDER))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(600); print('undo delete', await pg.evaluate(ORDER))
        px = await pg.evaluate("(async()=>{ const f=S.frames[2]; await ensureLoaded(f); return [...f.canvas.getContext('2d').getImageData(60+2*120+40,240,1,1).data]; })()")
        print('restored pixels', px[:2] == [238, 0] or px[0] > 200, px)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400); print('redo delete', await pg.evaluate(ORDER))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        # can't delete everything
        await pg.click('[data-ms=all]'); await pg.click('[data-ms=del]'); await pg.wait_for_timeout(200); print('keeps 1', await pg.evaluate("S.frames.length") == 6)
        await pg.screenshot(path='t45.png')
        await pg.click('[data-ms=done]'); print('done hides', await pg.evaluate("!mselOn && document.getElementById('mselBar').hidden && !document.querySelector('.fr.msel')"))
        # normal tap selects frame again
        await pg.click('#strip .fr >> nth=4'); print('normal tap', await pg.evaluate("S.cur") == 4)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
