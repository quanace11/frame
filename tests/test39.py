import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Repeat a range of frames (loop / there-and-back), one undo step
srv = subprocess.Popen(['python3','-m','http.server','8836'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
ORDER = "(async()=>{const r=[]; for(const f of S.frames){ await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data; let x=-1; for(let i=0;i<W;i++){ if(d[(500*W+i)*4+3]>0){x=i;break;} } r.push(x<0?-1:Math.round((x-100)/150)); } return r; })()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8836/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for _ in range(3): await pg.click('#addBtn'); await pg.wait_for_timeout(60)
        await pg.evaluate("(async()=>{for(let i=0;i<4;i++){const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(100+i*150,450,100,100); f.ver++; f.dur=100+i*10;}})()")
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200)
        await pg.click('#loopRangeBtn'); await pg.wait_for_timeout(200)
        await pg.fill('#lrA', '2'); await pg.fill('#lrB', '3'); await pg.fill('#lrN', '2')
        await pg.click('.dlg .btns >> text=Lặp lại'); await pg.wait_for_timeout(1200)
        print('loop order', await pg.evaluate(ORDER))
        print('durations kept', await pg.evaluate("S.frames.map(f=>f.dur)"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); print('undo', await pg.evaluate(ORDER))
        await pg.click('#loopRangeBtn'); await pg.fill('#lrA', '1'); await pg.fill('#lrB', '4'); await pg.fill('#lrN', '2')
        await pg.click('.dlg .btns >> text=Đi rồi về'); await pg.wait_for_timeout(1200)
        print('pingpong', await pg.evaluate(ORDER))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
