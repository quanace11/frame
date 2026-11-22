import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8795'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Kho hình: animated effects (dizzy / fight / sound words) stamp across frames, add frames when missing, attach a sound, undo/redo
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8795/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # every animated item renders every frame without throwing and draws something
        bad = await pg.evaluate('''(()=>{const bad=[];for(const [c,C] of Object.entries(ASSET_CATS)){if(!C.anim)continue;for(const k of Object.keys(C.items)){for(let t=0;t<assetAnimN(c,k);t++){const cv=assetRender(c,k,0.5,{...assetOpt,t});const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;if(n<20)bad.push(c+'/'+k+'#'+t);}}}return bad;})()''')
        print('empty frames', bad); assert not bad
        await pg.click('#assetBtn'); await pg.wait_for_timeout(300)
        await pg.click('[data-acat="fight"]'); await pg.click('[data-aloop="2"]')
        await pg.evaluate("document.querySelectorAll('#aGrid button')[0].click()"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='a_anim_place.png')
        await pg.evaluate('commitFloating()'); await pg.wait_for_timeout(1500)
        n, sfx = await pg.evaluate("[S.frames.length, (S.audio&&S.audio.sfx||[]).map(s=>s.kind)]")
        print('frames', n, 'sfx', sfx); assert n == 16 and sfx == ['scuffle']
        await pg.evaluate('undo()'); await pg.wait_for_timeout(600)
        assert await pg.evaluate('S.frames.length') == 1
        await pg.evaluate('redo()'); await pg.wait_for_timeout(600)
        assert await pg.evaluate('S.frames.length') == 16
        # a sound word over existing frames: no new frames
        await pg.evaluate("selectFrame(3)"); await pg.wait_for_timeout(300)
        await pg.evaluate("assetOpt.loops=1; assetToFrame('sound','pow'); commitFloating()"); await pg.wait_for_timeout(1200)
        assert await pg.evaluate('S.frames.length') == 16
        await pg.screenshot(path='a_anim_done.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
