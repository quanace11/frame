import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8964'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🗂 Dòng layer: timeline layer × frame, keyframe riêng từng layer (f.ppK), ✂ Tách / 🔗 Nối keyframe, ＋ / − Frame
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
MKIMG='''([w,h,col])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,w,h);return c}'''
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8964/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        for col, sz in [('#ff0000', 400), ('#0000ff', 100)]:
            await pg.evaluate(f'(async()=>{{const c=({MKIMG})([{sz},{sz},"{col}"]); await imgToLayer(c)}})()'); await pg.wait_for_timeout(150)
        red, blue = await pg.evaluate('lyrOrder().map(r=>r.id).reverse()')
        await pg.click('#lgBtn'); await pg.wait_for_timeout(100)
        ok('rows: 2 layers + Vẽ tay', await pg.evaluate("document.querySelectorAll('#lgNames .lgn').length") == 3)
        for _ in range(4): await pg.click('#lgAdd'); await pg.wait_for_timeout(250)
        ok('＋ Frame adds tween frames', await pg.evaluate('S.frames.length') == 5 and await pg.evaluate('S.frames.slice(1).every(f=>f.ppKey===false)') and await pg.evaluate('S.cur') == 4)
        # pick red on frame 4 (tap its row name), split, then drag it right
        await pg.click(f'#lgNames [data-lgr="{red}"]'); await pg.wait_for_timeout(100)
        ok('row tap selects the layer', await pg.evaluate(f'ppSel==="{red}" && S.tool==="puppet"'))
        await pg.click('#lgSplit'); await pg.wait_for_timeout(100)
        ok('✂ split = key for red only', await pg.evaluate(f'ppLayerKey(curFrame(),"{red}") && !ppLayerKey(curFrame(),"{blue}")'), await pg.evaluate('curFrame().ppK'))
        c = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{red}");return xbCentre(b)}})()')
        # blue may sit in front of red: lock it for the drag so the tap goes to red
        await pg.evaluate(f'ppPart("{blue}").lk = true')
        await pg.evaluate(PEN,[[await d2s(c['x'],c['y']), await d2s(c['x']+100,c['y']), await d2s(c['x']+200,c['y'])]]); await pg.wait_for_timeout(200)
        await pg.evaluate(f'delete ppPart("{blue}").lk')
        dx = await pg.evaluate(f'S.frames.map(f=>Math.round((f.pp[ "{red}" ]||{{}}).dx||0))')
        bx = await pg.evaluate(f'S.frames.map(f=>Math.round((f.pp[ "{blue}" ]||{{}}).dx||0))')
        ok('red tweens 0 → 200 over the frames', dx[0] == 0 and dx[4] == 200 and 60 < dx[2] < 140, dx)
        ok('blue untouched', bx == [0,0,0,0,0], bx)
        ok('frame 4 stays tween for blue', await pg.evaluate('curFrame().ppKey===false'))
        await pg.screenshot(path='dong_layer.png')
        # 🔗 join: frame 4 is no longer red's key -> red holds frame 0's pose everywhere
        await pg.wait_for_timeout(300)
        await pg.click('#lgJoin'); await pg.wait_for_timeout(150)
        dx = await pg.evaluate(f'S.frames.map(f=>Math.round((f.pp[ "{red}" ]||{{}}).dx||0))')
        ok('🔗 join removes the key', dx == [0,0,0,0,0] and not await pg.evaluate(f'ppLayerKey(curFrame(),"{red}")'), dx)
        await pg.click('#lgJoin'); await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(300); await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        dx = await pg.evaluate(f'S.frames.map(f=>Math.round((f.pp[ "{red}" ]||{{}}).dx||0))')
        ok('undo brings the key back', dx[4] == 200 and await pg.evaluate(f'ppLayerKey(S.frames[4],"{red}")'), dx)
        # tap a cell: blue row, frame 1
        cv = await pg.query_selector('#lgCv'); bb = await cv.bounding_box()
        await pg.mouse.click(bb['x'] + 32*1 + 16, bb['y'] + 34*0 + 17); await pg.wait_for_timeout(200)
        ok('cell tap = frame + layer', await pg.evaluate(f'S.cur===1 && ppSel==="{blue}"'), await pg.evaluate('[S.cur, ppSel]'))
        # − Frame removes the frame being viewed
        await pg.click('#lgDel'); await pg.wait_for_timeout(300)
        ok('− Frame', await pg.evaluate('S.frames.length') == 4)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        # per-layer keys are saved
        await pg.evaluate('scheduleSave()'); await pg.wait_for_timeout(2500); await pg.reload(); await pg.wait_for_timeout(2500)
        ok('ppK kept after reload', await pg.evaluate(f'S.frames.length===5 && ppLayerKey(S.frames[4],"{red}") && !ppLayerKey(S.frames[4],"{blue}")'))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
