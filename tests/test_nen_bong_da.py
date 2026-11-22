import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8924'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# ⚽ football scenes in 🏞 Nền vẽ sẵn: each one draws something, applying one is one undo step
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8924/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        keys = ['pitch', 'pitchNight', 'goal', 'stands', 'tunnel', 'locker', 'press', 'trophy']
        r = await pg.evaluate("""(ks)=>ks.map(k=>{ if(!SCENES[k]) return [k,-1]; const c=makeCanvas(270,480), x=c.getContext('2d'); drawScene(x,k,270,480);
            const d=x.getImageData(0,0,270,480).data; const cols=new Set(); let op=0; for(let i=0;i<d.length;i+=4*37){ if(d[i+3]>250) op++; cols.add(d[i]>>4<<8|d[i+1]>>4<<4|d[i+2]>>4); } return [k, cols.size, op]; })""", keys)
        print('scenes', r)
        for k, nc, op in r:
            if nc < 6: errs.append('scene %s looks empty (%d colours)' % (k, nc))
        await pg.evaluate('sceneDialog()')
        await pg.wait_for_timeout(300)
        await pg.click('[data-scene="goal"]'); await pg.wait_for_timeout(300)
        px = await pg.evaluate("(async()=>{ const b=bgOf(curFrame()); await ensureLoaded(b); return [...b.canvas.getContext('2d').getImageData(Math.round(W*.07),Math.round(H*.45),1,1).data] })()")
        print('goal post pixel', px)
        if not (px[0] > 220 and px[1] > 220 and px[2] > 220): errs.append('goal post not drawn: %s' % px)
        await pg.screenshot(path='nen_bong_da.png')
        await pg.evaluate('undo()'); await pg.wait_for_timeout(200)
        a = await pg.evaluate("(async()=>{ const b=bgOf(curFrame()); await ensureLoaded(b); return [...b.canvas.getContext('2d').getImageData(Math.round(W*.07),Math.round(H*.45),1,1).data] })()")
        print('after undo', a)
        if a == px: errs.append('undo did not remove the scene')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
