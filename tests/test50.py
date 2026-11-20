import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🪄 colour a frame from the previous one: areas that overlap a coloured area take its colour; chain to the last frame; one undo
srv = subprocess.Popen(['python3','-m','http.server','8846'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
DRAW = """(async ([i,dx])=>{ const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); x.strokeStyle='#111'; x.lineWidth=8;
  x.beginPath(); x.arc(400+dx,600,150,0,7); x.stroke(); x.strokeRect(250+dx,900,300,400);
  x.beginPath(); x.arc(400+dx,560,25,0,7); x.stroke(); f.ver++; })"""
COL = "(async ([i,x,y])=>{ const f=S.frames[i]; await ensureLoaded(f); const c=f.col; if(!c) return null; return [...c.getContext('2d').getImageData(x,y,1,1).data]; })"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8846/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("(async()=>{ await addFrame(); await addFrame(); await addFrame(); })(); 0"); await pg.wait_for_timeout(600)
        for i, dx in enumerate([0, 30, 60, 90]): await pg.evaluate(DRAW, [i, dx])
        # colour frame 1 by hand: head red, eye white, body blue
        await pg.evaluate("(async()=>{ await selectFrame(0); setColor('#e53935'); fillColLayer(curFrame(),{x:400,y:680}); setColor('#ffffff'); fillColLayer(curFrame(),{x:400,y:560}); setColor('#1e88e5'); fillColLayer(curFrame(),{x:400,y:1100}); })(); 0")
        await pg.wait_for_timeout(500)
        await pg.evaluate("setTool('fill')"); await pg.wait_for_timeout(100)
        print('button shown for fill tool', await pg.evaluate("!!document.getElementById('autoColBtn').offsetParent"))
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(300)
        await pg.click('#autoColBtn'); await pg.wait_for_timeout(800)
        head = await pg.evaluate(COL, [1, 430, 690]); eye = await pg.evaluate(COL, [1, 430, 560]); body = await pg.evaluate(COL, [1, 430, 1100]); out = await pg.evaluate(COL, [1, 900, 300])
        line = await pg.evaluate(COL, [1, 430 + 150, 600])
        print('frame2 head red', head[:3] == [229, 57, 53], 'eye white', eye[:3] == [255, 255, 255], 'body blue', body[:3] == [30, 136, 229], 'outside empty', out[3] == 0, 'under line', line[3] == 255)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        print('undo clears', (await pg.evaluate(COL, [1, 430, 690]) or [0,0,0,0])[3] == 0)
        # long-press → to the last frame (chained)
        box = await pg.evaluate("(()=>{const r=document.getElementById('autoColBtn').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        await pg.mouse.move(*box); await pg.mouse.down(); await pg.wait_for_timeout(750); await pg.mouse.up(); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=Tới frame cuối'); await pg.wait_for_timeout(2000)
        f4 = await pg.evaluate(COL, [3, 490, 690]); f4b = await pg.evaluate(COL, [3, 490, 1100])
        print('chained to frame 4', f4[:3] == [229, 57, 53], f4b[:3] == [30, 136, 229])
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        vals = [((await pg.evaluate(COL, [i, 400 + 30*i, 690])) or [0,0,0,0])[3] for i in [1, 2, 3]]; print('one undo clears all', vals == [0, 0, 0])
        # first frame / no colour messages don't crash
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(200); await pg.click('#autoColBtn'); await pg.wait_for_timeout(200)
        await pg.evaluate("selectFrame(2)"); await pg.wait_for_timeout(200); await pg.click('#autoColBtn'); await pg.wait_for_timeout(300)
        print('no colour on prev → message', await pg.inner_text('#toast'))
        ms = await pg.evaluate("(async()=>{ await ensureLoaded(S.frames[0]); await ensureLoaded(S.frames[1]); const t=performance.now(); const e=autoColorFrame(S.frames[0], S.frames[1]); return performance.now()-t; })()")
        print('time per frame ms', round(ms), ms < 3000)
        await pg.screenshot(path='t46.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
