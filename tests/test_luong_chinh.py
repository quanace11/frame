import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8877'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Core flows re-tested on a touch tablet (bugs found and fixed):
#  1. undo: a quick action right after a stroke (Nhân bản frame < 0.4 s later) was swallowed (not undoable, undo removed the stroke)
#  2. one finger: taps for 🔍 Cận cảnh / combos, dragging texts, camera box and puppet parts did nothing without "Ngón tay cũng vẽ"
#  3. Nhân bản frame / ✨ Vẽ giữa / 🎞 Chuyển động lost 〰 Đường đi offsets (f.lip.mv): the character jumped back to its start
#  4. GIF delays were rounded per frame (12 fps → 8 cs instead of 8.33): total time drifted
#  5. icons of 2-line rail buttons were squashed in portrait; the selection bar hid the lifted picture; finger-only users got no hint
PTR = '''async ([kind,id,pts,delay])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:id,pointerType:kind,clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:ty==='pointerup'?0:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,delay));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
def line(a, b, n=20): return [[a[0] + (b[0]-a[0])*i/n, a[1] + (b[1]-a[1])*i/n] for i in range(n + 1)]
async def ptr(pg, pts, kind='pen', pid=7, doc=True, delay=4):
    if doc: pts = [await pg.evaluate(D2S, q) for q in pts]
    await pg.evaluate(PTR, [kind, pid, pts, delay]); await pg.wait_for_timeout(120)
async def start(b, w, h):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
    await pg.goto('http://localhost:8877/index.html'); await pg.wait_for_timeout(800); await pg.tap('text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
    return ctx, pg, errs
ST = "undoStack.map(e=>e.snap?'snap':e.add?'add':'pix').join(',')"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx, pg, errs = await start(b, 1180, 820)
        # 1. quick action after a stroke is its own undo step
        await ptr(pg, line([300, 500], [700, 900]))
        await pg.tap('#dupBtn'); await pg.wait_for_timeout(700)
        print('stroke + quick duplicate = 2 steps', await pg.evaluate(ST) == 'pix,snap')
        await pg.tap('#undoBtn'); await pg.wait_for_timeout(400)
        print('undo removes the duplicate, keeps the line', await pg.evaluate("S.frames.length===1 && curFrame().canvas.getContext('2d').getImageData(500,700,1,1).data[3]>0"))
        await pg.tap('#redoBtn'); await pg.wait_for_timeout(400)
        await pg.tap('#expPlus'); await ptr(pg, line([300, 1000], [700, 1100])); await pg.wait_for_timeout(700)
        print('hold then quick stroke = 2 steps', await pg.evaluate(ST) == 'pix,snap,snap,pix')
        await pg.tap('#undoBtn'); await pg.wait_for_timeout(300); await pg.tap('#undoBtn'); await pg.wait_for_timeout(300)
        print('undo stroke then hold', await pg.evaluate("curFrame().dur===100 && curFrame().canvas.getContext('2d').getImageData(500,1050,1,1).data[3]===0"))
        # 2. one finger in Chữ & FX
        await pg.tap('#rail [data-tool=fx]'); await pg.evaluate("openTab('fx','cam')"); await pg.wait_for_timeout(200)
        await pg.tap('#camCutIn'); await ptr(pg, [[500, 700], [500, 700]], kind='touch', pid=30)
        print('finger tap picks the close-up spot', await pg.evaluate("!!curFrame().cam && curFrame().cam.x===500 && curFrame().cam.y===700 && !camPresetMode"))
        await pg.evaluate("curFrame().cam=null; requestRender()")
        await pg.tap('#camCutIn')
        # 2nd finger joins quickly (pinch / 2-finger undo): the spot is not taken
        await pg.evaluate('''(async()=>{const v=document.getElementById('view'),r=v.getBoundingClientRect();const mk=(t,id,x)=>new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:r.left+x,clientY:r.top+300,buttons:t==='pointerup'?0:1,bubbles:true,cancelable:true});
          v.dispatchEvent(mk('pointerdown',61,400)); await new Promise(r=>setTimeout(r,40)); v.dispatchEvent(mk('pointerdown',62,500)); await new Promise(r=>setTimeout(r,40)); v.dispatchEvent(mk('pointerup',61,400)); v.dispatchEvent(mk('pointerup',62,500));})()''')
        await pg.wait_for_timeout(300)
        print('two fingers do not pick a spot', await pg.evaluate("!curFrame().cam && camPresetMode==='cut'"))
        await pg.evaluate("camPresetMode=null")
        await pg.evaluate("openTab('fx','text'); curFrame().texts=[{id:'t1',str:'Hi',x:540,y:600,size:110,color:'#ffe14d',style:'comic',rot:0}]; requestRender()")
        await ptr(pg, line([540, 600], [640, 800], 10), kind='touch', pid=31)
        print('finger drags a text', await pg.evaluate("Math.abs(curFrame().texts[0].x-640)<3 && Math.abs(curFrame().texts[0].y-800)<3"))
        await pg.tap('#undoBtn'); await pg.wait_for_timeout(300)
        print('text drag undoes', await pg.evaluate("curFrame().texts[0].x===540"))
        v0 = await pg.evaluate("[vtx,vty]"); await ptr(pg, line([200, 200], [260, 260], 8), kind='touch', pid=32)
        print('finger elsewhere still pans', await pg.evaluate("[vtx,vty]") != v0)
        # 4. GIF time at 12 fps
        await pg.evaluate("setTool('brush'); S.frames.forEach(f=>f.dur=83); dupFrame()"); await pg.wait_for_timeout(300)
        await pg.evaluate("(async()=>{for(let i=0;i<10;i++) await dupFrame(); S.frames.forEach(f=>f.dur=1000/12);})()"); await pg.wait_for_timeout(1500)
        gif = await pg.evaluate("(()=>{const e=gifEncoder(4,4),d=new Uint8ClampedArray(64);for(let i=0;i<12;i++)e.add(d,1000/12/10);return e.finish().arrayBuffer().then(b=>{const u=new Uint8Array(b);let t=0;for(let i=0;i<u.length-5;i++)if(u[i]===0x21&&u[i+1]===0xF9&&u[i+2]===4)t+=u[i+4]|(u[i+5]<<8);return t})})()")
        print('GIF of 12 frames at 12 fps lasts 1 s', gif == 100, gif)
        # 5. hint for a finger-only user
        await ctx.close(); ctx, pg, errs2 = await start(b, 820, 1180); errs += errs2
        await ptr(pg, line([300, 400], [400, 500], 8), kind='touch', pid=40, doc=False)
        print('finger-only hint', 'Ngón tay cũng vẽ' in await pg.evaluate("document.getElementById('toast').textContent"))
        print('rail icons not squashed (portrait)', await pg.evaluate("[...document.querySelectorAll('#rail .tool svg')].every(s=>s.getBoundingClientRect().height>=20)"))
        # selection bar moves out of the way of the lifted picture
        await ptr(pg, [[540 + 120*math.cos(t/30*2*math.pi), 450 + 120*math.sin(t/30*2*math.pi)] for t in range(31)])
        await pg.tap('#rail [data-tool=lasso]'); await pg.wait_for_timeout(200)
        await ptr(pg, line([380, 290], [700, 290], 8) + line([700, 290], [700, 610], 8) + line([700, 610], [380, 610], 8) + line([380, 610], [380, 294], 8))
        await pg.wait_for_timeout(300)
        vis = await pg.evaluate(f"(()=>{{const b=floatBox(),r=document.getElementById('selbar').getBoundingClientRect(),y={D2S}([b[0],b[1]])[1]+view.getBoundingClientRect().top;return y>r.bottom}})()")
        print('lifted picture shown below the selection bar', vis)
        await pg.screenshot(path='luong_chinh_selbar.png'); await ctx.close()
        # 3. puppet: path offsets survive duplicate / in-between; finger poses a part
        ctx, pg, errs2 = await start(b, 1280, 900); errs += errs2
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        j = await pg.evaluate("(()=>{const J=ppSetup.J.elR;return [J.x,J.y]})()")
        await ptr(pg, line(j, [j[0] + 30, j[1] + 20], 6), kind='touch', pid=50)
        print('finger drags a joint dot', await pg.evaluate(f"Math.abs(ppSetup.J.elR.x-{j[0]+30})<2"))
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("openTab('pp','frames')"); await pg.fill('#ppPathN', '6'); await pg.click('#ppPathBtn')
        await ptr(pg, line([300, 1300], [700, 1100], 30)); await pg.wait_for_timeout(1200)
        root = await pg.evaluate("ppSelChar()")
        await pg.evaluate("selectFrame(5)"); await pg.wait_for_timeout(200); await pg.click('#dupBtn'); await pg.wait_for_timeout(400)
        print('duplicate keeps the path place', await pg.evaluate(f"S.frames.length===7 && JSON.stringify(S.frames[6].lip.mv)===JSON.stringify(S.frames[5].lip.mv)"))
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200); await pg.evaluate("inbetween(1,'linear')"); await pg.wait_for_timeout(500)
        print('in-between is half way on the path', await pg.evaluate(f"(()=>{{const a=S.frames[1].lip.mv['{root}'],m=S.frames[2].lip.mv['{root}'],c=S.frames[3].lip.mv['{root}'];return Math.abs(m.x-(a.x+c.x)/2)<1 && Math.abs(m.y-(a.y+c.y)/2)<1 && m.x!==a.x}})()"))
        await pg.evaluate("ppDrag='rotate'; selectFrame(0)"); await pg.wait_for_timeout(200)
        arm = await pg.evaluate("(()=>{const t=S.pp.parts.find(p=>p.role==='torso'),M=ppMats(ppPoseFor(curFrame()))[t.id];const c=t.c;const q=mApply(M,t.ox+c.width/2,t.oy+c.height/2);return [t.id,q.x,q.y]})()")
        hit = await pg.evaluate(f"(ppHit({{x:{arm[1]},y:{arm[2]}}},ppPoseFor(curFrame()))||{{}}).id")
        r0 = await pg.evaluate(f"(curFrame().pp['{hit}']||{{}}).r||0")
        await ptr(pg, line([arm[1], arm[2]], [arm[1] + 80, arm[2] + 120], 10), kind='touch', pid=51)
        print('finger turns a puppet part', hit is not None and await pg.evaluate(f"Math.abs((curFrame().pp['{hit}']||{{}}).r||0)") != abs(r0))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
