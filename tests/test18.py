import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8790'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1024,'height':1366})
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8790/'); await pg.wait_for_timeout(2500)
        print('sw', await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active))"), 'version', await pg.evaluate('APP_VERSION'))
        print('manifest', await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json()).then(j=>j.name+' '+j.display)"))
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # draw something, save
        await pg.evaluate("""async()=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});v.dispatchEvent(mk('pointerdown',300,300));for(let i=0;i<20;i++){v.dispatchEvent(mk('pointermove',300+i*10,300+i*5));await new Promise(r=>setTimeout(r,5))}v.dispatchEvent(mk('pointerup',500,400));}""")
        await pg.wait_for_timeout(2500)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(2500)
        print('offline reload ok', await pg.evaluate('typeof S==="object" && S.frames.length'), 'undo stack fresh', await pg.evaluate('!!curFrame().png || curFrame().ver>=0'))
        await pg.screenshot(path='pwa_offline.png')
        await ctx.set_offline(False)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
