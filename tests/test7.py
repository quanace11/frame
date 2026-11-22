import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8771'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
SHEET='''([body,face,dir,n])=>{ rig.body=body; rig.face=face; rig.dir=dir; rig.n=n; rig.cyc=1; rig.amp=1;
  const cw=180,ch=320, c=makeCanvas(cw*n, ch), x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
  for(let k=0;k<n;k++){ const r=rigFrameVec(k); x.save(); x.translate(k*cw,0); x.scale(cw/W, ch/H); drawVec(x, r.vec);
     x.restore(); x.strokeStyle='#ddd'; x.strokeRect(k*cw,0,cw,ch); }
  return c.toDataURL('image/png'); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8771/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ')
        await pg.wait_for_function('document.getElementById("impBusy").hidden && document.getElementById("iVecInfo") && document.getElementById("iVecInfo").textContent', timeout=60000)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(300)
        await pg.click('#vecNone'); await pg.click('#vecRig'); await pg.wait_for_timeout(300)
        print('face guess', await pg.evaluate('({e:S.rig.face.eyes.length,m:S.rig.face.mouth.length,b:S.rig.face.brows.length})'))
        await pg.screenshot(path='rig0.png')
        sets=[('walk','none',1,8),('run','none',1,6),('walk','talk',0,8),('jump','none',0,8),('roll','none',1,8),('celebrate','laugh',0,6),('wave','none',0,6),('fall','none',1,8),
              ('none','cry',0,6),('none','scream',0,6),('none','angry',0,6),('none','surprised',0,6),('none','sad',0,6),('none','blink',0,8)]
        for body,face,d,n in sets:
            url = await pg.evaluate(SHEET,[body,face,d,n])
            open(f'sheet_{body}_{face}.png','wb').write(base64.b64decode(url.split(',')[1]))
        # commit walk + talk
        await pg.evaluate("()=>{rig.body='walk';rig.face='talk';rig.dir=1;rig.n=8;rig.dur=0.1;rig.k=0;syncRigUI();rigPreview();}")
        await pg.wait_for_timeout(500); await pg.screenshot(path='rig1.png')
        await pg.click('#rgGo'); await pg.wait_for_timeout(600)
        print('frames', await pg.evaluate('S.frames.length'))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300); print('undo frames', await pg.evaluate('S.frames.length'), 'vec0', await pg.evaluate('curFrame().vec.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
