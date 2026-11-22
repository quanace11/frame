import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8769'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8769/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'cartoon.png')); await pg.wait_for_timeout(400)
        await pg.click('.imp-tabs >> text=Chuyển thành nét vẽ')
        await pg.wait_for_function('document.getElementById("impBusy").hidden && document.getElementById("iVecInfo") && document.getElementById("iVecInfo").textContent', timeout=60000)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(300)
        await pg.click('#vecNone')
        # find right arm stroke: the one with max x endpoint going up-right
        arm = await pg.evaluate('''(()=>{let best=null;for(const s of curFrame().vec){const e=s.pts.reduce((a,q)=>q.x>a.x?q:a);if(!best||e.x>best.e.x)best={id:s.id,e};}return best})()''')
        # tap on arm midpoint in screen coords
        mid = await pg.evaluate(f'''(()=>{{const s=curFrame().vec.find(x=>x.id==="{arm['id']}");const q=s.pts[Math.floor(s.pts.length/2)];return [(q.x*vs+vtx)/DPR,(q.y*vs+vty)/DPR]}})()''')
        await pg.evaluate(PEN,[[mid]]); await pg.wait_for_timeout(100)
        print('sel', await pg.evaluate('vsel.size'))
        await pg.click('#vecMotion'); await pg.wait_for_timeout(500)
        print('pivot', await pg.evaluate('motion.pivot'))
        await pg.screenshot(path='m1.png')
        await pg.click('#mGo'); await pg.wait_for_timeout(500)
        print('frames', await pg.evaluate('S.frames.length'))
        tips = await pg.evaluate(f'''S.frames.map(f=>{{const s=f.vec.find(x=>x.id==="{arm['id']}");const e=s.pts.reduce((a,q)=>q.x>a.x?q:a);return [Math.round(e.x),Math.round(e.y)]}})''')
        print('arm tip per frame', tips)
        # mouth: go frame 1, select smile (stroke with lowest width near head center?) -> pick stroke whose bbox center y ~ 283*k
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(300)
        await pg.evaluate("setTool('vedit')")
        smile = await pg.evaluate('''(()=>{const v=curFrame().vec; // smile: width>30 and height<40 and highest-ish y in head region
           let best=null; for(const s of v){const xs=s.pts.map(q=>q.x),ys=s.pts.map(q=>q.y);const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);if(w>40&&h<60&&s.pts.length>2){const cy=(Math.max(...ys)+Math.min(...ys))/2; if(!best||cy<best.cy) best={id:s.id,cy,q:s.pts[Math.floor(s.pts.length/2)]};}} return best})()''')
        sp = await pg.evaluate(f'''[({smile['q']['x']}*vs+vtx)/DPR,({smile['q']['y']}*vs+vty)/DPR]''')
        await pg.evaluate(PEN,[[sp]]); await pg.wait_for_timeout(100)
        print('smile sel', await pg.evaluate('[...vsel]')==[smile['id']])
        await pg.click('#vecMotion'); await pg.click('[data-mt=mouth]'); await pg.click('[data-ma=apply]')
        await pg.evaluate("()=>{const r=document.getElementById('mN'); r.value=6; r.dispatchEvent(new Event('input'));}")
        await pg.wait_for_timeout(300); await pg.screenshot(path='m2.png')
        await pg.click('#mGo'); await pg.wait_for_timeout(300)
        print('lips per frame', await pg.evaluate("S.frames.map(f=>f.vec.filter(s=>s.id.endsWith('~lip')).length)"))
        # play a moment
        await pg.click('#playBtn'); await pg.wait_for_timeout(700); await pg.screenshot(path='m3.png'); await pg.click('#playBtn')
        # undo mouth, undo frames
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        print('after undo lips', await pg.evaluate("S.frames.map(f=>f.vec.filter(s=>s.id.endsWith('~lip')).length)"))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        print('after undo frames', await pg.evaluate('S.frames.length'))
        await pg.click('#redoBtn'); await pg.wait_for_timeout(300)
        print('after redo frames', await pg.evaluate('S.frames.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
