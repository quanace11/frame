import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9889'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🙂 Bộ đầu: upload ready-made heads (a sheet of 3 heads on white paper) as the Head's pictures, fitted on the neck;
# tap one = use it on this frame / from here on (keyframes) / every frame; ↑↓ − + nudge; one undo step per choice.
from PIL import Image, ImageDraw
sheet = os.path.join(OUT, 'bo_dau_sheet.png')
im = Image.new('RGB', (900, 360), 'white'); d = ImageDraw.Draw(im)
for k, mouth in enumerate(['smile', 'o', 'flat']):
    x = 60 + k * 300
    d.ellipse([x, 40, x + 200, 280], fill=(240, 190, 150), outline=(30, 20, 20), width=8)
    d.rectangle([x + 75, 270, x + 125, 330], fill=(240, 190, 150), outline=(30, 20, 20), width=6)   # neck
    for ex in (x + 65, x + 135): d.ellipse([ex - 10, 120, ex + 10, 145], fill=(30, 20, 20))
    if mouth == 'smile': d.arc([x + 60, 170, x + 140, 230], 0, 180, fill=(30, 20, 20), width=8)
    elif mouth == 'o': d.ellipse([x + 85, 185, x + 115, 225], outline=(30, 20, 20), width=8)
    else: d.line([x + 65, 210, x + 135, 210], fill=(30, 20, 20), width=8)
im.save(sheet)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9889/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','parts')"); await pg.wait_for_timeout(200)
        hid = await pg.evaluate("S.pp.parts.find(p=>p.role==='head').id"); n0 = await pg.evaluate(f"(ppPart('{hid}').alts||[]).length")
        await pg.click('#hsBtn'); await pg.wait_for_timeout(300)
        await pg.set_input_files('#hsFile', sheet)
        await pg.wait_for_function(f"(ppPart('{hid}').alts||[]).length >= {n0 + 3}", timeout=20000); await pg.wait_for_timeout(300)
        n = await pg.evaluate(f"ppPart('{hid}').alts.length")
        print('a sheet of 3 heads = 3 new head pictures', n == n0 + 3, n0, n)
        fit = await pg.evaluate(f"(()=>{{ const p=ppPart('{hid}'); return p.alts.slice({n0}).map(a=>[a.c.height===p.c.height, Math.abs(a.dy+a.c.height-p.c.height)<=1, Math.abs(a.dx+a.c.width/2-p.c.width/2)<=1]) }})()")
        print('each head fitted on the neck (same height, bottom centre)', all(all(x) for x in fit), fit)
        print('white paper removed', await pg.evaluate(f"(()=>{{ const c=ppPart('{hid}').alts[{n0}].c, d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; return d[3]===0 }})()"))
        print('grid shows head + every picture', await pg.evaluate("document.querySelectorAll('#hsGrid canvas').length") == n + 1)
        u0 = await pg.evaluate("undoStack.length")
        await pg.click(f'#hsGrid canvas[data-hsi="{n0 + 2}"]'); await pg.wait_for_timeout(200)
        print('tap = this frame uses that head', await pg.evaluate(f"curFrame().pp['{hid}'].v==={n0 + 2} && undoStack.length==={u0}+1"))
        await pg.screenshot(path='bo_dau.png')
        # nudge the picked head down, bigger
        a0 = await pg.evaluate(f"(()=>{{ const a=ppPart('{hid}').alts[{n0 + 1}]; return [a.dy,a.c.height] }})()")
        await pg.click('[data-hsn="0,4,0"]'); await pg.click('[data-hsn="0,0,0.05"]'); await pg.wait_for_timeout(300)
        a1 = await pg.evaluate(f"(()=>{{ const a=ppPart('{hid}').alts[{n0 + 1}]; return [a.dy,a.c.height] }})()")
        print('↓ and ＋ To move / grow the head (bottom stays put)', a1[1] > a0[1] and abs((a1[0] + a1[1]) - (a0[0] + 4 + a0[1])) <= 2, a0, a1)
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(200)
        # 6 frames of a gesture (tweened between keys), then "from here on" from frame 1
        await pg.evaluate("ppGesture('hello')"); await pg.wait_for_timeout(800)
        N = await pg.evaluate("S.frames.length")
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(200)
        await pg.click('#hsBtn'); await pg.wait_for_timeout(200)
        await pg.click('[data-hss="after"]'); u1 = await pg.evaluate("undoStack.length")
        await pg.click(f'#hsGrid canvas[data-hsi="{n0 + 1}"]'); await pg.wait_for_timeout(300)
        vs = await pg.evaluate(f"S.frames.map(f=>(ppPoseFor(f)['{hid}']||{{}}).v||0)")
        print('from here on: every frame shows that head (tweened ones too)', N > 4 and all(v == n0 + 1 for v in vs), vs)
        print('one undo step', await pg.evaluate(f"undoStack.length==={u1}+1"))
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(100)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        vs2 = await pg.evaluate(f"S.frames.map(f=>(ppPoseFor(f)['{hid}']||{{}}).v||0)")
        print('undo puts the old heads back', vs2[0] == n0 + 2 and vs2 != vs, vs2)
        # remove a head: frames using a later picture shift down
        await pg.click('#hsBtn'); await pg.wait_for_timeout(200)
        await pg.click(f'#hsGrid canvas[data-hsi="{n0 + 1}"]'); await pg.click('#hsDel'); await pg.wait_for_timeout(200)
        print('🗑 removes it, frames that used it go back to the head', await pg.evaluate(f"ppPart('{hid}').alts.length==={n - 1} && !curFrame().pp['{hid}'].v"))
        await pg.click('.dlg .btns >> text=Xong')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
