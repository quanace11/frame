import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8962'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🖌 Thay màu: red shirt → yellow keeping the shading, skin untouched, black boots → white; frame (1 undo step) and cut-out character
PIX = "(x,y,c)=>{ const d=(c||curFrame().canvas).getContext('2d').getImageData(x,y,1,1).data; return [d[0],d[1],d[2],d[3]]; }"
async def tap(pg, fx, fy):
    b = await pg.locator('#rcPv').bounding_box(); await pg.mouse.click(b['x'] + b['width'] * fx, b['y'] + b['height'] * fy)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8962/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # a "photo": skin head, red shirt with a dark fold (shading), black boots, on a transparent frame
        await pg.evaluate("""(()=>{ const f=curFrame(), x=f.canvas.getContext('2d');
          x.fillStyle='#e8b896'; x.beginPath(); x.arc(540,500,90,0,7); x.fill();
          const g=x.createLinearGradient(400,0,680,0); g.addColorStop(0,'#d42a2a'); g.addColorStop(.5,'#8a1414'); g.addColorStop(1,'#e23a33'); x.fillStyle=g; x.fillRect(400,600,280,360);
          x.fillStyle='#161616'; x.fillRect(420,1300,100,50); x.fillRect(560,1300,100,50); f.ver++; requestRender(); })()""")
        await pg.evaluate("document.querySelector('#recolorBtn').click()"); await pg.wait_for_timeout(500)
        # composite is cropped to the content: x 400..680 → shirt left side at ~ (0.1, 0.35)
        bb = await pg.evaluate("[document.querySelector('#rcPv').width, document.querySelector('#rcPv').height]"); print('preview', bb)
        await tap(pg, 0.12, 0.38); await pg.wait_for_timeout(200)
        await pg.click('[data-rcc="#ffd21f"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='thay_mau_dialog.png')
        await pg.click('#rcGo'); await pg.wait_for_timeout(500)
        L, M, R, skin = [await pg.evaluate(f"({PIX})({x},{y})") for x, y in [(410, 700), (540, 700), (670, 700), (540, 500)]]
        print('shirt', L, M, R, 'skin', skin)
        yellow = lambda c: c[0] > 150 and c[1] > 110 and c[2] < 90
        if not (yellow(L) and yellow(R)): errs.append('shirt not yellow %s %s' % (L, R))
        if not (M[0] < L[0] - 40 and M[1] > M[2]): errs.append('fold shading lost %s vs %s' % (M, L))
        if abs(skin[0] - 0xe8) > 3 or abs(skin[1] - 0xb8) > 3: errs.append('skin changed %s' % skin)
        # boots: black → white
        await tap(pg, 0.15, 0.94); await pg.wait_for_timeout(200)
        src = await pg.evaluate("document.querySelector('#rcSrc').style.background"); print('boot src', src)
        await pg.click('[data-rcc="#ffffff"]'); await pg.click('#rcGo'); await pg.wait_for_timeout(500)
        boot = await pg.evaluate(f"({PIX})(470,1320)"); print('boot', boot)
        if min(boot[:3]) < 200: errs.append('boot not white %s' % boot)
        if (await pg.evaluate(f"({PIX})(410,700)"))[0] < 150: errs.append('second pass broke the shirt')
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='thay_mau.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        back = await pg.evaluate(f"[({PIX})(410,700), ({PIX})(470,1320)]"); print('after 2 undo', back)
        if abs(back[0][0] - 0xd4) > 12 or back[0][1] > 60 or back[1][0] > 40: errs.append('undo did not restore %s' % back)
        # cut-out character: the sample footballer's shirt colour → yellow on its part pictures
        await pg.evaluate("S.frames.forEach(f=>{f.canvas.getContext('2d').clearRect(0,0,W,H); f.ver++;})")
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        info = await pg.evaluate("""(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); const x=t.c.getContext('2d'); const d=x.getImageData(t.c.width>>1, t.c.height*0.55|0,1,1).data; return {rgb:[d[0],d[1],d[2]], c:t.c} })()""")
        rgb = info['rgb']; print('kit shirt', rgb)
        await pg.evaluate("document.querySelector('#recolorBtn').click()"); await pg.wait_for_timeout(500)
        kind = await pg.evaluate("document.querySelector('[data-rck=char]').classList.contains('on')")
        if not kind: errs.append('character target not chosen by default')
        # pick by setting the source from the torso colour (tapping exactly on the shirt is layout dependent)
        n = await pg.evaluate(f"(async()=>{{ const torso=S.pp.parts.find(q=>q.role==='torso'), c0=torso.c; const n=await recolorApply('char', rcHsl({rgb[0]},{rgb[1]},{rgb[2]}), '#ffd21f', 28); return [n, torso.c!==c0] }})()")
        after = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); const d=t.c.getContext('2d').getImageData(t.c.width>>1, t.c.height*0.55|0,1,1).data; return [d[0],d[1],d[2]] })()")
        print('kit recolour', n, after)
        if not n[0] or not n[1]: errs.append('character not recoloured %s' % n)
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(700)
        back = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); const d=t.c.getContext('2d').getImageData(t.c.width>>1, t.c.height*0.55|0,1,1).data; return [d[0],d[1],d[2]] })()")
        print('kit undo', back)
        if max(abs(a - b) for a, b in zip(back, rgb)) > 6: errs.append('character undo %s vs %s' % (back, rgb))
        # menu entry opens it too
        await pg.evaluate("(recolorDialog(), 1)"); await pg.wait_for_timeout(300)
        if not await pg.locator('#rcPv').count(): errs.append('dialog did not open')
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        # ✂ Cắt từng bộ phận on a picture imported as its own layer: the layer goes back into the frame (1 undo step) and cutting starts
        await pg.evaluate("(async()=>{ S.pp.parts=[]; ppSel=null; S.frames.forEach(f=>{f.canvas.getContext('2d').clearRect(0,0,W,H); f.ver++;}); const c=makeCanvas(300,600), x=c.getContext('2d'); x.fillStyle='#d42a2a'; x.fillRect(40,40,220,520); await imgToLayer(c, null); })()")
        await pg.wait_for_timeout(500)
        r0 = await pg.evaluate("[S.pp.parts.length, lyrRoots().length]"); print('layer', r0)
        await pg.evaluate("hcBegin()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(()=>{ const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let i=3;i<d.length;i+=64) if(d[i]>20) n++; return [!!HC, S.pp.parts.length, n] })()")
        print('flatten', r)
        if r0[0] != 1 or not r[0] or r[1] != 0 or r[2] < 1000: errs.append('hand cut on a layer %s %s' % (r0, r))
        await pg.evaluate("hcCancel()"); await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(()=>{ const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let i=3;i<d.length;i+=64) if(d[i]>20) n++; return [S.pp.parts.length, n] })()")
        print('flatten undo', r)
        if r != [1, 0]: errs.append('flatten undo %s' % r)
        await b.close()
        print('ERR', errs)
asyncio.run(main())
