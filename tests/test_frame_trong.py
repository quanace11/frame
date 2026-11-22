import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9131'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# + Frame trống with characters = really blank (characters hidden on that frame only); 🙈 Ẩn ở frame này hides one
# character on one frame and keeps it on every other frame, also across tweens, undo, save/reload.
INK = '''(i)=>{const f=S.frames[i];const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  drawPuppet(x,f.pp,f.lip);const d=x.getImageData(0,0,W,H).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>20)n++;return n;}'''
def ok(c, m):
    print(('OK ' if c else 'FAIL ') + m)
    if not c: raise SystemExit(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9131/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # no character: + Frame trống still works
        await pg.click('#addBtn'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('S.frames.length') == 2, 'frame trống không có nhân vật')
        await pg.evaluate('delFrame()'); await pg.wait_for_timeout(300)
        await pg.evaluate('selectFrame(0)'); await pg.wait_for_timeout(200)
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(800)
        ok(await pg.evaluate(INK, 0) > 50, 'nhân vật hiện ở frame 1')
        # move the character so a blank frame must keep its place for later
        await pg.evaluate("(()=>{const r=ppRoots()[0];const f=curFrame();f.pp=f.pp||{};f.pp[r.id]={...(f.pp[r.id]||{}),dx:120};ppRetween();})()")
        await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate('selectFrame(0)'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.wait_for_timeout(400)
        st = await pg.evaluate("(()=>{const f=curFrame(),r=ppRoots()[0];return {cur:S.cur,n:S.frames.length,off:ppOffAt(f,r.id),dx:f.pp[r.id].dx,key:f.ppKey}})()")
        ok(st['cur'] == 1 and st['n'] == 3 and st['off'], 'frame trống mới ẩn nhân vật %s' % st)
        ok(abs(st['dx'] - 120) < 1 and st['key'] is False, 'giữ chỗ nhân vật cho frame sau')
        ok(await pg.evaluate(INK, 1) == 0, 'frame trống không vẽ nhân vật')
        ok(await pg.evaluate(INK, 0) > 50, 'frame 1 vẫn còn nhân vật')
        # 🙈 show it again on the blank frame via the Ghép bar
        await pg.click('[data-tool="puppet"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppSel=ppRoots()[0].id; ppSyncBar()")
        ok((await pg.text_content('#ppOffBtn')).startswith('👁'), 'nút Hiện ở frame này')
        await pg.click('#ppOffBtn'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate(INK, 1) > 50, 'hiện lại ở frame trống')
        # hide on frame 1 only: frames 2 and 3 keep it, also when frame 1 is a keyframe tweening to a later key
        await pg.evaluate('selectFrame(0)'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppSel=ppRoots()[0].id; ppSyncBar()")
        await pg.click('#ppOffBtn'); await pg.wait_for_timeout(300)
        ink = [await pg.evaluate(INK, i) for i in range(3)]
        ok(ink[0] == 0 and ink[1] > 50 and ink[2] > 50, 'chỉ ẩn ở frame 1 %s' % ink)
        ok(await pg.evaluate("ppHit({x:W/2+120,y:H*0.6},ppPoseFor(curFrame()))") is None, 'không chạm trúng nhân vật đã ẩn')
        await pg.evaluate('ppRetween()')
        ok(await pg.evaluate(INK, 1) > 50, 'tween không làm ẩn frame khác')
        # Dòng layer button reflects it
        await pg.evaluate("S.lgOpen=true; lgSync(true)"); await pg.wait_for_timeout(200)
        ok((await pg.text_content('#lgOff')).startswith('👁'), 'Dòng layer: nút Hiện ở frame này')
        # undo / redo
        await pg.evaluate('undo()'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate(INK, 0) > 50, 'hoàn tác: hiện lại')
        await pg.evaluate('redo()'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate(INK, 0) == 0, 'làm lại: ẩn')
        # hide again from the Dòng layer button on frame 3
        await pg.evaluate('selectFrame(2)'); await pg.wait_for_timeout(200)
        await pg.click('#lgOff'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate(INK, 2) == 0 and await pg.evaluate(INK, 1) > 50, 'Dòng layer: ẩn ở frame 3')
        # save + reload keeps it
        await pg.evaluate('saveProject()'); await pg.wait_for_timeout(800)
        await pg.reload(); await pg.wait_for_timeout(1500)
        for t in ['Mở dự án', 'Bắt đầu vẽ']:
            if await pg.locator('.dlg .btns >> text=' + t).count(): await pg.click('.dlg .btns >> text=' + t); break
        await pg.wait_for_timeout(600)
        ink = [await pg.evaluate(INK, i) for i in range(3)]
        ok(ink[0] == 0 and ink[1] > 50 and ink[2] == 0, 'sau khi mở lại %s' % ink)
        await pg.screenshot(path='frame_trong.png')
        print('ERR', errs)
        await b.close()
asyncio.run(main())
