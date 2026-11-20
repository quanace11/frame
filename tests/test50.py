import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# on-canvas flipper: ◀ n/N ▶ ＋ — tap to move, hold to peek and come back, ＋ = new frame with onion, hold ＋ = duplicate
srv = subprocess.Popen(['python3','-m','http.server','8850'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def hold(pg, sel, ms):
    box = await pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
    await pg.mouse.move(*box); await pg.mouse.down(); await pg.wait_for_timeout(ms); return box
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for vp in [{'width':1180,'height':820},{'width':820,'height':1180}]:
            pg = await b.new_page(viewport=vp); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8850/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
            w = vp['width']
            print(w, 'shown on brush', await pg.evaluate("!!document.getElementById('flipNav').offsetParent"), await pg.inner_text('#fnLbl'))
            # frame stays above the pill
            geo = await pg.evaluate("(()=>{const m=viewMat(), st=stage.getBoundingClientRect(); return [st.top+(m[1]*W+m[3]*H+m[5])/DPR, document.getElementById('flipNav').getBoundingClientRect().top]})()")
            print(w, 'frame clear of pill', geo[0] <= geo[1] + 1, [round(g) for g in geo])
            await pg.evaluate("S.onion=false; updateToggles()")
            await pg.click('#fnAdd'); await pg.wait_for_timeout(400)
            print(w, '＋ adds frame', await pg.evaluate("S.frames.length") == 2, 'onion on', await pg.evaluate("S.onion"), await pg.inner_text('#fnLbl'))
            await pg.click('#fnAdd'); await pg.wait_for_timeout(400)
            await pg.click('#fnPrev'); await pg.wait_for_timeout(300); print(w, 'tap ◀', await pg.evaluate("S.cur") == 1)
            await pg.click('#fnNext'); await pg.wait_for_timeout(300); print(w, 'tap ▶', await pg.evaluate("S.cur") == 2)
            await hold(pg, '#fnPrev', 600); print(w, 'hold ◀ peeks', await pg.evaluate("S.cur") == 1, await pg.inner_text('#fnLbl'))
            await pg.mouse.up(); await pg.wait_for_timeout(300); print(w, 'release returns', await pg.evaluate("S.cur") == 2, await pg.inner_text('#fnLbl'))
            # hold ＋ → duplicate current
            await pg.evaluate("(async()=>{const f=curFrame(); await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(100,100,50,50); f.ver++;})(); 0")
            await hold(pg, '#fnAdd', 750); await pg.mouse.up(); await pg.wait_for_timeout(500)
            dup = await pg.evaluate("(async()=>{const f=curFrame(); await ensureLoaded(f); return [S.frames.length, S.cur, f.canvas.getContext('2d').getImageData(120,120,1,1).data[3]];})()")
            print(w, 'hold ＋ duplicates', dup == [4, 3, 255], dup)
            await pg.evaluate("setTool('puppet')"); await pg.wait_for_timeout(200)
            print(w, 'hidden in puppet', await pg.evaluate("!document.getElementById('flipNav').offsetParent"))
            await pg.evaluate("setTool('brush'); startPlay()"); await pg.wait_for_timeout(300)
            print(w, 'hidden while playing', await pg.evaluate("!document.getElementById('flipNav').offsetParent")); await pg.evaluate("stopPlay()")
            await pg.screenshot(path=f't47_{w}.png')
            print('ERR', errs); await pg.close()
        await b.close()
asyncio.run(main()); srv.kill()
