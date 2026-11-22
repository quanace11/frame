import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8798'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# Colour layer: fill goes under the lines (own layer), erasing a line keeps the colour where it was; eyedropper returns to fill
COL = "([x,y])=>{const c=curFrame().col; if(!c) return null; const d=c.getContext('2d').getImageData(x,y,1,1).data; return [d[0],d[1],d[2],d[3]]}"
CHA = "([x,y])=>curFrame().canvas.getContext('2d').getImageData(x,y,1,1).data[3]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8798/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        # pixel line art on Nhân vật: a box 300..700 x 500..900, line width 16, plus a divider at x=500
        await pg.evaluate("""()=>{setLayer('char'); const x=curFrame().canvas.getContext('2d'); x.strokeStyle='#111'; x.lineWidth=16;
          x.strokeRect(300,500,400,400); x.beginPath(); x.moveTo(500,500); x.lineTo(500,900); x.stroke(); markEdited(curFrame()); setTool('fill');}""")
        assert not await pg.is_hidden('#dropBtn'), 'dropper shown in fill tool'
        await pg.evaluate("()=>{setColor('#e53935'); doFill({x:400,y:700}); setColor('#1e88e5'); doFill({x:600,y:700});}")
        left, right = await pg.evaluate(COL, [400,700]), await pg.evaluate(COL, [600,700])
        print('fill went to colour layer', left[:3] == [229,57,53] and right[:3] == [30,136,229])
        assert left[:3] == [229,57,53] and right[:3] == [30,136,229]
        assert await pg.evaluate(CHA, [400,700]) == 0, 'line layer untouched inside'
        # under the divider line: left half red, right half blue
        ul, ur = await pg.evaluate(COL, [496,700]), await pg.evaluate(COL, [504,700])
        print('colour runs under the line, split in the middle', ul[:3], ur[:3]); assert ul[:3] == [229,57,53] and ur[:3] == [30,136,229]
        assert (await pg.evaluate(COL, [300,700]))[3] == 255, 'colour under the outer line too'
        # erase the divider with the eraser tool on the Nhân vật layer
        await pg.evaluate("()=>{setTool('eraser'); S.size=40; strokeBegin({x:500,y:520,p:1}); for(let y=520;y<=880;y+=10) strokePoint({x:500,y,p:1}); strokeEnd();}")
        assert await pg.evaluate(CHA, [500,700]) == 0, 'line erased'
        ul, ur = await pg.evaluate(COL, [496,700]), await pg.evaluate(COL, [504,700])
        print('after erasing the line the colour stays put', ul[:3], ur[:3]); assert ul[:3] == [229,57,53] and ur[:3] == [30,136,229]
        await pg.screenshot(path='col_after_erase.png')
        # undo the erase brings the line back, colour unchanged
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        assert await pg.evaluate(CHA, [500,700]) > 200
        # undo the blue fill
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        assert (await pg.evaluate(COL, [600,700]))[3] == 0, 'undo fill'
        await pg.evaluate("redo()"); await pg.wait_for_timeout(200)
        assert (await pg.evaluate(COL, [600,700]))[:3] == [30,136,229]
        # vector lines also bound the fill
        await pg.evaluate("""()=>{const f=curFrame(); f.vec=[{id:'v1',c:'#000',w:10,pts:[{x:300,y:1100},{x:700,y:1100},{x:700,y:1400},{x:300,y:1400},{x:300,y:1100}]}]; setTool('fill'); setColor('#43a047'); doFill({x:500,y:1250});}""")
        g, out = await pg.evaluate(COL, [500,1250]), await pg.evaluate(COL, [500,1500])
        print('vector box filled, outside untouched', g[:3], out[3]); assert g[:3] == [67,160,71] and out[3] == 0
        # eyedropper: press 💧, tap the red area -> colour picked, back to fill
        await pg.click('#dropBtn'); assert await pg.evaluate("S.tool") == 'pick'
        await pg.evaluate("doPick({x:400,y:700})")
        print('dropper', await pg.evaluate("[S.color, S.tool]")); assert await pg.evaluate("[S.color, S.tool]") == ['#e53935', 'fill']
        # lasso on Nhân vật carries the colour under it
        await pg.evaluate("()=>{setTool('lasso'); liftSelection([{x:280,y:480},{x:720,y:480},{x:720,y:920},{x:280,y:920}]); floating.cy += 300; commitFloating();}")
        moved, old = await pg.evaluate(COL, [400,1000]), await pg.evaluate(COL, [400,700])
        print('lasso moves colour too', moved[:3], old[3]); assert moved[:3] == [229,57,53] and old[3] == 0
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        assert (await pg.evaluate(COL, [400,700]))[:3] == [229,57,53], 'undo lasso restores colour'
        # duplicate frame copies colour; hide colour layer hides it from composite
        await pg.evaluate("dupFrame()"); await pg.wait_for_timeout(300)
        assert (await pg.evaluate(COL, [400,700]))[:3] == [229,57,53], 'dup copies colour'
        # save + reload keeps colour layer
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        for t in ['Tiếp tục', 'Mở tiếp', 'Bắt đầu vẽ']:
            if await pg.locator('.dlg .btns >> text=' + t).count(): await pg.click('.dlg .btns >> text=' + t); break
        await pg.wait_for_timeout(800)
        c = await pg.evaluate("(async()=>{await ensureLoaded(curFrame()); const c=curFrame().col; return c? [...c.getContext('2d').getImageData(400,700,1,1).data] : null})()")
        print('colour layer saved', c); assert c and c[:3] == [229,57,53]
        await pg.screenshot(path='col_reload.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
