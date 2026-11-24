import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9217'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# A picture (a speaker) saved to 🧍 Kho nhân vật and taken out again on frame 3 of a project whose frames are all 🔑:
# it is its own layer with the same keyframes (● on every frame) as the first picture, it stands still when played,
# ⧉ Nhân bản copies it, and moving it never moves the old speaker.
POS = '''(rid)=>S.frames.map((f,i)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');ppOnlyRoot=rid;try{drawPuppet(x,f.pp,f.lip);}finally{ppOnlyRoot=null;}const d=x.getImageData(0,0,W,H).data;let n=0,sx=0;for(let y=0;y<H;y+=4)for(let X=0;X<W;X+=4)if(d[(y*W+X)*4+3]>20){n++;sx+=X;}return n?Math.round(sx/n):-1})'''
def ok(c, m):
    print(('OK ' if c else 'FAIL ') + m)
    if not c: raise SystemExit(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9217/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("imgToLayer((()=>{const c=document.createElement('canvas');c.width=200;c.height=300;const x=c.getContext('2d');x.fillStyle='#333';x.fillRect(0,0,200,300);return c})(),null,'Loa'); 0"); await pg.wait_for_timeout(800)
        loa = await pg.evaluate('ppRoots()[0].id')
        await pg.evaluate("ppSel=%r; charLibSave(); 0" % loa); await pg.wait_for_timeout(400)
        await pg.click('.ov:last-child .btns >> text=💾 Lưu'); await pg.wait_for_timeout(800)
        for _ in range(3): await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("S.frames.forEach(f=>{f.ppKey=true;delete f.ppK;})")   # hand-drawn frames: every frame is 🔑
        await pg.evaluate('selectFrame(2)'); await pg.wait_for_timeout(300)
        await pg.evaluate("charLibDialog(); 0"); await pg.wait_for_timeout(600); await pg.click('.ov:last-child #chList [data-a=add] >> nth=0'); await pg.wait_for_timeout(1200)
        await pg.click('.ov:last-child .btns >> text=Mọi frame'); await pg.wait_for_timeout(400)
        new = await pg.evaluate("ppRoots().map(r=>r.id).find(id=>id!==%r)" % loa)
        ok(await pg.evaluate("S.frames.every(f=>ppLayerKey(f,%r))" % new), 'layer mới: ● ở mọi frame như hình gốc')
        x0 = await pg.evaluate(POS, new); ok(len(set(x0)) == 1 and x0[0] > 0, 'hiện ở mọi frame, cùng chỗ (không nhảy) %s' % x0)
        xo0 = await pg.evaluate(POS, loa)
        await pg.evaluate("ppSel=%r; ppEdit(q=>{q.dx=(q.dx||0)-200;})" % new); await pg.wait_for_timeout(300)
        x1 = await pg.evaluate(POS, new); ok(abs(x1[2] - (x0[2] - 200)) < 3 and x1[:2] == x0[:2] and x1[3] == x0[3], 'dời ở frame 3 = chỉ frame 3, như hình gốc %s' % x1)
        xo = await pg.evaluate(POS, loa); ok(xo == xo0, 'loa gốc không đổi %s' % xo)
        await pg.click('#dupBtn'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("S.frames.length==5 && S.frames.every(f=>ppLayerKey(f,%r))" % new), 'nhân bản: frame mới cũng có ●')
        x2 = await pg.evaluate(POS, new); ok(x2[3] == x1[2], 'nhân bản giữ chỗ của frame 3 %s' % x2)
        ok(await pg.evaluate(POS, loa) == xo0[:3] + [xo0[2]] + xo0[3:], 'loa gốc vẫn không đổi')
        await b.close()
        print('ERR', errs)
asyncio.run(main())
