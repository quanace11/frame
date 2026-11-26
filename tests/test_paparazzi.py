import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9531'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 📸 Paparazzi: camera flashes pop around the character over N frames + shutter sounds; ONE undo step.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9531/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        # a "character": a dark box in the middle of frame 1
        await pg.evaluate("(async()=>{const f=S.frames[0];await ensureLoaded(f);const x=f.canvas.getContext('2d');x.fillStyle='#222';x.fillRect(W*0.4,H*0.35,W*0.2,H*0.3);f.ver++;requestRender()})()")
        await pg.evaluate("setTool('fx'); openTab('fx','gag')"); await pg.wait_for_timeout(300)
        print('button', await pg.evaluate("!!document.querySelector('[data-gag=paparazzi]') && document.querySelectorAll('[data-papk]').length==3"))
        await pg.fill('#papN', '10'); await pg.dispatch_event('#papN', 'change'); await pg.click('[data-papk="3"]'); await pg.click('#papWhite')
        print('options saved', await pg.evaluate("JSON.stringify(papOpt())") == '{"n":10,"k":3,"white":true,"snd":true}', await pg.evaluate("JSON.stringify(papOpt())"))
        await pg.click('[data-gag=paparazzi]'); print('mode', await pg.evaluate("gagMode") == 'paparazzi')
        u0 = await pg.evaluate("undoStack.length")
        await pg.evaluate("gagRun('paparazzi', {x:W/2, y:H/2})"); await pg.wait_for_timeout(1500)
        print('frames made', await pg.evaluate("S.frames.length") == 10)
        print('one undo step', await pg.evaluate("undoStack.length") == u0 + 1)
        # bright white pixels outside the box on every frame, none drawn over the box's middle
        CNT = "(async i=>{const f=S.frames[i];await ensureLoaded(f);const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data;let out=0,inn=0;for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){const k=(y*W+x)*4;if(d[k+3]>150&&d[k]+d[k+1]+d[k+2]>400){if(x>W*0.43&&x<W*0.57&&y>H*0.4&&y<H*0.6)inn++;else out++;}}return [out,inn]})"
        cs = [await pg.evaluate(f"{CNT}({i})") for i in range(10)]
        print('flashes on every frame', all(c[0] > 30 for c in cs), [c[0] for c in cs])
        print('mostly around the character', sum(c[1] for c in cs) < 0.05 * sum(c[0] for c in cs), sum(c[1] for c in cs))
        print('frames differ', len(set(c[0] for c in cs)) > 3)
        print('white flash every 4', await pg.evaluate("S.frames.map(f=>!!f.flash).join()") == 'true,false,false,false,true,false,false,false,true,false')
        sfx = await pg.evaluate("S.audio.sfx.map(s=>s.kind)"); print('shutter sounds', 'shutter' in sfx and sfx.count('snaps') >= 1, sfx)
        print('sfx render', await pg.evaluate("(async()=>{const a=await sfxBuffer('shutter'),b=await sfxBuffer('snaps');let m=0;for(const v of b.getChannelData(0))m=Math.max(m,Math.abs(v));return a.length>0&&m>0.05})()"))
        await pg.evaluate("S.cur=2; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='paparazzi.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(600)
        print('undo', await pg.evaluate("S.frames.length") == 1 and await pg.evaluate("(S.audio.sfx||[]).length") == 0 and not await pg.evaluate("!!S.frames[0].flash") and (await pg.evaluate(f"{CNT}(0)"))[0] == 0)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
