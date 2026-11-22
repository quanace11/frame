import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8967'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ⭐ Symbol: lưu chuyển động của 1 layer giữa 2 frame, thả lên layer khác ở frame khác (thiếu frame thì thêm), 1 bước undo cho phần tư thế
MKIMG='''([w,h,col])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,w,h);return c}'''
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('localStorage.removeItem("fs-symbols")')
        await pg.goto('http://localhost:8967/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for col, sz in [('#ff0000', 300), ('#0000ff', 120)]:
            await pg.evaluate(f'(async()=>{{const c=({MKIMG})([{sz},{sz},"{col}"]); await imgToLayer(c)}})()'); await pg.wait_for_timeout(150)
        red, blue = await pg.evaluate('lyrOrder().map(r=>r.id).reverse()')
        await pg.click('#lgBtn'); await pg.wait_for_timeout(100)
        for _ in range(3): await pg.click('#lgAdd'); await pg.wait_for_timeout(200)
        # red: hop right 200 then back up (keys on frame 1, 3, 4) — set by code like a drag would
        await pg.evaluate(f'''(()=>{{const F=S.frames;const set=(i,q)=>{{F[i].pp={{...F[i].pp,["{red}"]:q}};ppLayerSetKey(F[i],"{red}",true)}};
          set(0,{{dx:0,dy:0}}); set(2,{{dx:200,dy:-100,r:0.5}}); set(3,{{dx:200,dy:0}}); ppLayerSetEase(F[2],"{red}","linear"); ppRetween()}})()''')
        await pg.evaluate(f'(async()=>{{await selectFrame(0); lyrSelect("{red}"); lgSync(true)}})()'); await pg.wait_for_timeout(200)
        await pg.click('#lgSymSave'); await pg.wait_for_timeout(200)
        ok('save dialog prefilled 1 → 4', await pg.evaluate("[document.getElementById('symA').value, document.getElementById('symB').value]") == ['1','4'])
        await pg.fill('#symName', 'Nhảy'); await pg.click('.dlg .btns >> text=Lưu'); await pg.wait_for_timeout(200)
        sym = await pg.evaluate('symLoad()')
        ok('symbol stored', len(sym) == 1 and sym[0]['name'] == 'Nhảy' and sym[0]['n'] == 4 and [k['i'] for k in sym[0]['keys']] == [0,2,3], [len(sym), sym and sym[0]['n']])
        # put it on blue from frame 3: needs 2 more frames
        await pg.evaluate(f'(async()=>{{await selectFrame(2); lyrSelect("{blue}"); lgSync(true)}})()'); await pg.wait_for_timeout(200)
        bx0 = await pg.evaluate(f'(S.frames[2].pp["{blue}"]||{{}}).dx||0')
        await pg.click('#lgSymPut'); await pg.wait_for_timeout(200)
        await pg.click('[data-symgo]'); await pg.wait_for_timeout(500)
        n = await pg.evaluate('S.frames.length')
        bd = await pg.evaluate(f'S.frames.map(f=>Math.round(((f.pp["{blue}"]||{{}}).dx||0)))')
        by = await pg.evaluate(f'S.frames.map(f=>Math.round(((f.pp["{blue}"]||{{}}).dy||0)))')
        ok('frames added for the symbol', n == 6, n)
        ok('blue plays the hop from frame 3', bd[2] == round(bx0) and bd[4] == round(bx0) + 200 and bd[5] == round(bx0) + 200 and by[4] == -100 and by[5] == 0 and bd[3] == round(bx0) + 100, [bd, by])
        ok('blue keys + ease copied', await pg.evaluate(f'ppLayerKey(S.frames[2],"{blue}") && !ppLayerKey(S.frames[3],"{blue}") && ppLayerKey(S.frames[4],"{blue}") && ppLayerEase(S.frames[4],"{blue}")==="linear"'))
        ok('red unchanged', await pg.evaluate(f'S.frames.slice(0,4).map(f=>Math.round(f.pp["{red}"].dx))') == [0,100,200,200])
        await pg.wait_for_timeout(300); await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        bd2 = await pg.evaluate(f'S.frames.map(f=>Math.round(((f.pp["{blue}"]||{{}}).dx||0)))')
        ok('undo removes the poses', all(v == round(bx0) for v in bd2), bd2)
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
