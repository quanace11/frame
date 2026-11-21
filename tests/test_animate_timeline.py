import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8871'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
def check(name, ok):
    print(('ok   ' if ok else 'FAIL ') + name)
    if not ok: bad.append(name)
bad = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8871/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # --- hold frames (exposure) + fps
        await pg.evaluate("S.fps=12; setDur(1000/12)")
        await pg.click('#expPlus'); await pg.click('#expPlus'); await pg.wait_for_timeout(100)
        d = await pg.evaluate("curFrame().dur"); check('exposure + gives 3 khung', abs(d-250) < 1)
        check('label shows khung', '3 khung' in await pg.inner_text('#expLbl'))
        await pg.click('#expMinus'); check('exposure − gives 2 khung', abs(await pg.evaluate("curFrame().dur")-1000/6) < 1)
        await pg.click('#expLbl'); await pg.wait_for_timeout(200); await pg.click('[data-fps="24"]'); await pg.click('.dlg .btns >> text=Xong')
        check('fps 24 saved', await pg.evaluate("S.fps") == 24)
        check('2 khung@12 = 4 khung@24', '4 khung' in await pg.inner_text('#expLbl'))
        # --- vector inbetween: A has a stroke, B is a copy with the stroke moved right by 300
        await pg.evaluate("""(()=>{const f=curFrame(); f.vec=[{id:'s1',c:'#000000',w:8,pts:[{x:100,y:500},{x:200,y:600},{x:300,y:500}]}]; f.ver++;})()""")
        await pg.evaluate("dupFrame()"); await pg.wait_for_timeout(300)
        await pg.evaluate("""(()=>{const f=curFrame(); f.vec[0].pts.forEach(q=>q.x+=300); f.vec[0].c='#ff0000'; f.ver++;})()""")
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(200)
        await pg.click('#ibBtn'); await pg.wait_for_timeout(300)
        await pg.fill('#ibN', '3'); await pg.click('[data-ibe="linear"]'); await pg.click('.dlg .btns >> text=Tạo frame giữa'); await pg.wait_for_timeout(800)
        n = await pg.evaluate("S.frames.length"); check('3 inbetweens added (5 frames)', n == 5)
        xs = await pg.evaluate("S.frames.map(f=>f.vec[0].pts[0].x)")
        check('stroke moves evenly 100→400 %s' % xs, [round(x) for x in xs] == [100,175,250,325,400])
        check('colour blends', await pg.evaluate("S.frames[2].vec[0].c") not in ('#000000','#ff0000'))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        check('one undo removes the inbetweens', await pg.evaluate("S.frames.length") == 2)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        check('redo puts them back', await pg.evaluate("S.frames.length") == 5)
        # different point counts are resampled
        r = await pg.evaluate("ibVec([{id:'a',c:'#000000',w:4,pts:[{x:0,y:0},{x:10,y:0}]}],[{id:'a',c:'#000000',w:4,pts:[{x:0,y:10},{x:5,y:10},{x:10,y:10}]}],0.5)[0].pts.map(q=>[q.x,q.y])")
        check('resample 2→3 points %s' % r, r == [[0,5],[5,5],[10,5]])
        # --- onion: 8 frames, true colour, skip held copies
        await pg.evaluate("S.onion=true; S.onionPrev=8; S.onionNext=8; selectFrame(2)"); await pg.wait_for_timeout(200)
        check('onion lists all neighbours', await pg.evaluate("onionList().length") == 4)
        await pg.evaluate("dupFrame()"); await pg.wait_for_timeout(500)   # frame 4 = held copy of 3
        await pg.evaluate("S.onionKeys=true; selectFrame(4)"); await pg.wait_for_timeout(300)
        idx = await pg.evaluate("onionList().map(x=>x[0])")
        check('onion skips the held copy %s' % idx, not (2 in idx and 3 in idx) and len(idx) == 4)
        await pg.evaluate("S.onionKeys=false; S.onionTrue=true; S.onionPal=1; tintCache.clear(); requestRender()"); await pg.wait_for_timeout(200)
        # --- scrub bar
        box = await pg.evaluate("(()=>{const r=document.getElementById('scrub').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        check('scrub bar visible', box[2] > 300 and box[3] >= 16)
        await pg.mouse.move(box[0]+5, box[1]+box[3]/2); await pg.mouse.down()
        await pg.mouse.move(box[0]+box[2]*0.5, box[1]+box[3]/2, steps=6); await pg.wait_for_timeout(200)
        mid = await pg.evaluate("S.cur")
        await pg.mouse.move(box[0]+box[2]-3, box[1]+box[3]/2, steps=6); await pg.wait_for_timeout(300); await pg.mouse.up()
        check('scrub to middle then end (%d)' % mid, 1 <= mid <= 4 and await pg.evaluate("S.cur") == await pg.evaluate("S.frames.length-1"))
        await pg.screenshot(path='at_timeline.png')
        # --- play range from multi-select + slow speed
        await pg.evaluate("S.frames.forEach(f=>f.dur=100); mselStart(); msel.add(S.frames[1].id); msel.add(S.frames[2].id); mselSync(); S.loop=true; selectFrame(0)")
        await pg.wait_for_timeout(200)
        await pg.click('#mselBar [data-ms=play]'); seen=set()
        for _ in range(14):
            await pg.wait_for_timeout(60); seen.add(await pg.evaluate("playIdx"))
        check('play range stays in frames 2–3 %s' % seen, seen <= {1,2} and len(seen) == 2)
        await pg.evaluate("stopPlay(); mselEnd()")
        await pg.click('#speedBtn'); check('speed ½×', await pg.evaluate("playSpeed") == 0.5 and await pg.inner_text('#speedBtn') == '½×')
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(100)
        t0 = time.time(); await pg.evaluate("startPlay()")
        await pg.wait_for_function("playIdx>=2", timeout=5000); dt = time.time()-t0
        check('½× takes about twice as long (%.2fs)' % dt, dt > 0.33)
        await pg.evaluate("stopPlay()"); await pg.click('#speedBtn'); await pg.click('#speedBtn')
        check('back to 1×', await pg.evaluate("playSpeed") == 1)
        # --- keyboard shortcuts
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(100); await pg.mouse.click(5, 5)
        await pg.keyboard.press('.'); await pg.wait_for_timeout(150); check('. = next frame', await pg.evaluate("S.cur") == 2)
        await pg.keyboard.press(','); await pg.wait_for_timeout(150); check(', = previous frame', await pg.evaluate("S.cur") == 1)
        d0 = await pg.evaluate("curFrame().dur"); await pg.keyboard.press('F5'); await pg.wait_for_timeout(100)
        check('F5 holds 1 more khung', await pg.evaluate("curFrame().dur") > d0)
        n0 = await pg.evaluate("S.frames.length"); await pg.keyboard.press('F7'); await pg.wait_for_timeout(300)
        check('F7 = blank frame', await pg.evaluate("S.frames.length") == n0+1 and await pg.evaluate("curFrame().vec.length") == 0)
        # onion dialog opens with the new options
        await pg.evaluate("onionDialog()"); await pg.wait_for_timeout(200)
        check('onion dialog has colour + 8 frames', await pg.locator('[data-opal]').count() == 3 and await pg.locator('[data-ok="onionPrev"][data-n="8"]').count() == 1)
        await pg.screenshot(path='at_onion_dialog.png'); await pg.click('.dlg .btns >> text=Xong')
        await pg.set_viewport_size({'width':820,'height':1180}); await pg.wait_for_timeout(400); await pg.screenshot(path='at_portrait.png')
        print('FAILED', bad)
        print('ERR', errs + bad); await b.close()
asyncio.run(main()); srv.kill()
