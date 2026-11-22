import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Fill that seals small gaps in the outline
srv = subprocess.Popen(['python3','-m','http.server','8831'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
SETUP = '''(gap)=>{ const f=curFrame(), x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); if(f.col){f.col.getContext('2d').clearRect(0,0,W,H);}
  x.strokeStyle='#000'; x.lineWidth=8; x.beginPath(); x.arc(540,900,200, gap, Math.PI*2); x.stroke(); f.ver++; }'''
ALPHA = "(([x,y])=>{const f=curFrame(); return f.col? f.col.getContext('2d').getImageData(x,y,1,1).data[3]:0})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8831/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("setTool('fill')")
        print('gap button shown', await pg.evaluate("!!document.getElementById('gapBtn').offsetParent"), await pg.evaluate("document.getElementById('gapBtn').textContent"))
        # circle with a ~7px gap (angle 0.035 rad * r200 = 7px)
        await pg.evaluate(SETUP, 0.035)
        await pg.evaluate("S.fillGap=2; doFill({x:540,y:900})")
        inside = await pg.evaluate(ALPHA+"([540,900])"); outside = await pg.evaluate(ALPHA+"([100,300])")
        near = await pg.evaluate(ALPHA+"([540+192,900+20])")
        print('gap sealed: inside', inside==255, 'outside clean', outside==0, 'fills up to line', near==255)
        await pg.screenshot(path='t31_gap.png')
        await pg.evaluate(SETUP, 0.035)
        await pg.evaluate("S.fillGap=0; doFill({x:540,y:900})")
        print('gap off leaks (old behaviour)', await pg.evaluate(ALPHA+"([100,300])")==255)
        await pg.click('#gapBtn'); print('cycle', await pg.evaluate("S.fillGap"))
        await pg.evaluate("setTool('brush')"); print('hidden for brush', await pg.evaluate("!document.getElementById('gapBtn').offsetParent"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
