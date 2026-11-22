import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9125'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✥ Dời tất cả (mọi frame): one drag moves every character (not locked) by the same amount on all frames, paths keep their shape;
# a locked 🔒 layer stays; one undo step
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9125/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("(async()=>{await kitAdd(); await kitAdd(); await kitAdd();})()"); await pg.wait_for_timeout(500)
        A, B, C = await pg.evaluate("ppRoots().map(p=>p.id)")
        # A walks + path, B stands, C is locked
        await pg.evaluate(f"(async()=>{{ppSel='{A}';ppPreset='walk';await ppMakePreset(); S.cur=0; const pts=[];for(let k=0;k<=20;k++)pts.push({{x:200+k*20,y:1300}}); $('#ppPathN').value=8; await ppApplyPath(pts)}})()"); await pg.wait_for_timeout(400)
        await pg.evaluate(f"(()=>{{ppPart('{C}').lk=true; S.cur=3; updateFrameUI(); S.tool='puppet'; ppSyncBar(); openTab('pp','pose')}})()"); await pg.wait_for_timeout(300)
        mv = lambda: pg.evaluate(f"S.frames.map(f=>[ '{A}','{B}','{C}' ].map(id=>{{const m=f.lip&&f.lip.mv&&f.lip.mv[id];return m?[m.x,m.y]:[0,0]}}))")
        m0 = await mv(); n = len(m0)
        await pg.click('[data-ppd="all"]'); await pg.wait_for_timeout(100)
        print('button turns on', await pg.evaluate("ppDrag") == 'all')
        pts = [[540 + 0, 900 + k * 25] for k in range(9)]   # drag 200 down, anywhere on the canvas
        spts = [await pg.evaluate(D2S, q) for q in pts]; await pg.evaluate(PEN, spts); await pg.wait_for_timeout(400)
        m1 = await mv()
        dA = [(m1[i][0][0] - m0[i][0][0], m1[i][0][1] - m0[i][0][1]) for i in range(n)]
        dB = [(m1[i][1][0] - m0[i][1][0], m1[i][1][1] - m0[i][1][1]) for i in range(n)]
        dC = [(m1[i][2][0] - m0[i][2][0], m1[i][2][1] - m0[i][2][1]) for i in range(n)]
        print('A moved down 200 on every frame', all(abs(dx) < 0.2 and abs(dy - 200) < 0.6 for dx, dy in dA), dA[:2])
        print('B moved the same', all(abs(dx) < 0.2 and abs(dy - 200) < 0.6 for dx, dy in dB))
        print('locked C stays', all(d == (0, 0) for d in dC))
        print('A path keeps its shape', all(abs((m1[i][0][0] - m1[0][0][0]) - (m0[i][0][0] - m0[0][0][0])) < 0.2 for i in range(n)))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('one undo puts all back', await mv() == m0)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        print('redo', await mv() == m1)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
