import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# Thêm/Nhân bản frame stopped working at ~1xx frames on iPad: every rebuild of the frame strip made a new 300×150
# waveform canvas per frame (~18 MB of dead canvases per click at 100 frames), and iPad Safari counts dead canvases
# against its canvas memory limit until GC, so getContext('2d') returned null. The waveform canvas is now kept per
# frame and 0×0 until a waveform is drawn. Here: count canvases created per click at 120+ frames, and a failing
# canvas must give a toast, not a half-added frame.
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9123'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
HOOK = r'''(()=>{window.__made=[]; const ce=Document.prototype.createElement; Document.prototype.createElement=function(t,...a){const e=ce.call(this,t,...a); if(String(t).toLowerCase()==='canvas') __made.push(e); return e;};})()'''
async def main():
    errs = []
    def check(name, ok, info=''):
        print(('ok  ' if ok else 'FAIL'), name, info); ok or errs.append(name)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1366, 'height': 1024}); pe = []; pg.on('pageerror', lambda e: pe.append(str(e)))
        await pg.add_init_script(HOOK)
        await pg.goto('http://localhost:9123/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # 120 frames fast (copies of frame 1), then click the real buttons
        await pg.evaluate("""(async()=>{const s0=curFrame(); await ensureLoaded(s0); const add=[]; for(let k=0;k<119;k++){const f=frameCopyOf(s0); add.push(f);} S.frames.splice(1,0,...add); for(const f of add) await drawThumb(f); buildStrip(); await selectFrame(S.frames.length-1); await evictSoon();})()""")
        n0 = await pg.evaluate('S.frames.length')
        await pg.evaluate('__made.length=0')
        for k in range(10):
            await pg.click('#dupBtn' if k % 2 else '#addBtn'); await pg.wait_for_timeout(80)
        n1 = await pg.evaluate('S.frames.length')
        check('10 clicks at 120 frames add 10 frames', n1 == n0 + 10, f'{n0} -> {n1}')
        made = await pg.evaluate('[__made.length, __made.reduce((a,c)=>a+c.width*c.height,0)*4/1e6, __made.filter(c=>c.className==="wave").length]')
        check('a click does not make a canvas per frame', made[0] <= 10 * 4 and made[2] <= 10, str(made))
        check('waveform canvases stay 0×0 with no audio', await pg.evaluate("[...document.querySelectorAll('#strip canvas.wave, canvas.wave')].every(c=>c.width===0)"))
        # out of canvas memory: toast, no half-added frame, buttons still work afterwards
        r = await pg.evaluate("""(async()=>{const n=S.frames.length; const g=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(){return null};
          await addFrame(); await dupFrame(); HTMLCanvasElement.prototype.getContext=g;
          const t=document.getElementById('toast'); const msg=t.textContent; await addFrame(); return [n, S.frames.length, msg];})()""")
        check('no canvas memory: toast and no frame added, then works again', r[1] == r[0] + 1 and 'bộ nhớ' in r[2], str(r))
        check('no page errors', not pe, str(pe[:2]))
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
