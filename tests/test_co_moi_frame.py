import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9183'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🔗 Sửa cả nhóm cho nhiều frame: resizing character 1 on frame 1 also resizes it on later frames (feet stay put),
# character 2 is untouched; 📐 Cỡ frame này cho frame khác fixes frames that were left big. One undo step each.
BOX = '''(i)=>{const r=ppRoots()[0].id,f=S.frames[i],b=ppBoxOf(f,r),M=b.M;const p=[[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]].map(([x,y])=>mApply(M,x,y));
  const xs=p.map(q=>q.x),ys=p.map(q=>q.y);return {w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),fx:(Math.max(...xs)+Math.min(...xs))/2,fy:Math.max(...ys)};}'''
B2 = '''(i)=>JSON.stringify(S.frames[i].pp[ppRoots()[1].id]||{})'''
def ok(c, m):
    print(('OK ' if c else 'FAIL ') + m)
    if not c: raise SystemExit(1)
async def drag_corner(pg, frame):
    # drag the bottom-left handle of character 1's box toward the box centre (shrink)
    pts = await pg.evaluate('''(()=>{const r=ppRoots()[0].id,b=ppBoxOf(curFrame(),r),a=mApply(b.M,b.x0,b.y1),c=mApply(b.M,(b.x0+b.x1)/2,(b.y0+b.y1)/2);
      const s=v=>{const m=viewMat(),R=$('#stage').getBoundingClientRect();return {x:R.left+m[0]*v.x+m[2]*v.y+m[4],y:R.top+m[1]*v.x+m[3]*v.y+m[5]};};return [s(a),s(c)];})()''')
    a, c = pts
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for k in range(1, 9):
        t = k / 8 * 0.5
        await pg.mouse.move(a['x'] + (c['x'] - a['x']) * t, a['y'] + (c['y'] - a['y']) * t)
    await pg.mouse.up(); await pg.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9183/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(800)
        # 4 keyframes where character 1 walks right, then character 2 added on all of them
        await pg.evaluate('''(async()=>{const r=ppRoots()[0].id;for(let i=1;i<4;i++){const s=S.frames[S.frames.length-1];insertFrames(S.frames.length,[frameCopyOf(s)]);}
          S.frames.forEach((f,i)=>{f.ppKey=true;f.pp[r]={...(f.pp[r]||{}),dx:-200+i*60};f.ver++;});ppRetween();selectFrame(0);})()''')
        await pg.wait_for_timeout(300)
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(800)
        ok(await pg.evaluate('ppRoots().length') == 2 and await pg.evaluate('S.frames.length') == 4, '2 nhân vật, 4 frame')
        await pg.evaluate('selectFrame(0)'); await pg.click('[data-tool="puppet"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppSel=ppRoots()[0].id; ppDrag='box'; ppSyncBar(); requestRender()"); await pg.wait_for_timeout(200)
        b0 = [await pg.evaluate(BOX, i) for i in range(4)]; c2 = [await pg.evaluate(B2, i) for i in range(4)]
        # default: only this frame
        ok(await pg.evaluate("document.querySelector('[data-ppsc=\"one\"]').classList.contains('on')"), 'mặc định: chỉ frame này')
        await drag_corner(pg, 0)
        b1 = [await pg.evaluate(BOX, i) for i in range(4)]
        ok(b1[0]['h'] < b0[0]['h'] * 0.85 and abs(b1[1]['h'] - b0[1]['h']) < 1, 'chỉ frame 1 nhỏ lại %s %s' % (b1[0]['h'], b0[0]['h']))
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        ok(abs((await pg.evaluate(BOX, 0))['h'] - b0[0]['h']) < 1, 'hoàn tác')
        # 🔗 every frame from here on
        await pg.click('[data-ppsc="after"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppSel=ppRoots()[0].id; requestRender()")
        await drag_corner(pg, 0)
        b2 = [await pg.evaluate(BOX, i) for i in range(4)]
        k0 = b2[0]['h'] / b0[0]['h']
        ok(k0 < 0.85, 'frame 1 nhỏ lại %.2f' % k0)
        for i in range(1, 4):
            k = b2[i]['h'] / b0[i]['h']
            ok(abs(k - k0) < 0.02, 'frame %d cùng tỉ lệ %.3f' % (i + 1, k))
            # still walking: feet keep their spacing relative to frame 1
            ok(abs((b2[i]['fx'] - b2[0]['fx']) - (b0[i]['fx'] - b0[0]['fx'])) < 2 and abs(b2[i]['fy'] - b2[0]['fy'] - (b0[i]['fy'] - b0[0]['fy'])) < 2, 'frame %d giữ chỗ đứng tương đối' % (i + 1))
        ok([await pg.evaluate(B2, i) for i in range(4)] == c2, 'nhân vật 2 không đổi')
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        hs = [(await pg.evaluate(BOX, i))['h'] for i in range(4)]
        ok(all(abs(hs[i] - b0[i]['h']) < 1 for i in range(4)), 'hoàn tác 1 bước: mọi frame về cỡ cũ')
        await pg.evaluate('redo()'); await pg.wait_for_timeout(300)
        hs = [(await pg.evaluate(BOX, i))['h'] for i in range(4)]
        ok(all(abs(hs[i] - b2[i]['h']) < 1 for i in range(4)), 'làm lại')
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        # 📐 the user's case: shrank only on frame 1, then copy the size to the later frames
        await pg.click('[data-ppsc="one"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppSel=ppRoots()[0].id; requestRender()")
        await drag_corner(pg, 0)
        b3 = await pg.evaluate(BOX, 0)
        await pg.click('#ppSizeSync'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Mọi frame'); await pg.wait_for_timeout(400)
        for i in range(1, 4):
            bi = await pg.evaluate(BOX, i)
            ok(abs(bi['h'] - b3['h']) < 1.5 and abs(bi['fx'] - b0[i]['fx']) < 2 and abs(bi['fy'] - b0[i]['fy']) < 2, 'frame %d cùng cỡ frame 1, chân đứng yên %s' % (i + 1, bi))
        ok([await pg.evaluate(B2, i) for i in range(4)] == c2, 'nhân vật 2 không đổi (📐)')
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        ok(abs((await pg.evaluate(BOX, 2))['h'] - b0[2]['h']) < 1 and abs((await pg.evaluate(BOX, 0))['h'] - b3['h']) < 1, 'hoàn tác 📐')
        await pg.screenshot(path='co_moi_frame.png')
        print('ERR', errs)
        await b.close()
asyncio.run(main())
