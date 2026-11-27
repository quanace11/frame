import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9543'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🫠 Uốn mềm cả người: pin + drag the belly → the body bends softly, the feet stay; 🔁 Cho chuyển động (đánh hông) swings it
# over film time on frames a..b without new frames; one undo step; copied frames keep it; a tap on a pin removes it
# draw the puppet of frame 0 at film time tt (null = editing) and count changed pixels above / in the feet band
DIFF = """(([t1, t2]) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), f=curFrame();
  const draw = (tt, plain) => { x.clearRect(0,0,W,H); jgClock=tt; try { drawPuppet(x, f.pp, plain ? {...(f.lip||{}), bw:null} : f.lip); } finally { jgClock=null; } return new Uint8ClampedArray(x.getImageData(0,0,W,H).data); };
  const a = draw(t1), b = t2==='plain' ? draw(null, true) : draw(t2); let y1=0; for (let y=H-1;y>0&&!y1;y--) for (let X=0;X<W;X+=2) if (a[(y*W+X)*4+3]>100) { y1=y; break; }
  let top=0, feet=0; for (let y=0;y<H;y+=2) for (let X=0;X<W;X+=2) { const i=(y*W+X)*4; if (Math.abs(a[i+3]-b[i+3])>60) { if (y > y1 - H*0.03) feet++; else top++; } }
  return [top, feet]; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9543/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("kitAdd()"); await pg.wait_for_timeout(500)
        for _ in range(3): await pg.evaluate("addFrame()"); await pg.wait_for_timeout(150)
        await pg.evaluate("selectFrame(0); setTool('puppet')"); await pg.wait_for_timeout(300)
        await pg.click('#bwBtn'); await pg.wait_for_timeout(100)
        if not await pg.evaluate("bwMode"): errs.append('📌 Ghim + kéo did not turn the mode on')
        # the belly in document coords (middle of the torso)
        bel = await pg.evaluate("""(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), M=ppMats(ppPoseFor(curFrame()))[t.id];
            return mApply(M, t.ox+t.c.width/2, t.oy+t.c.height*0.6) })()""")
        n0 = await pg.evaluate("undoStack.length")
        await pg.evaluate("""(b => { const base={}; bwStart(b, base, curFrame()); for (let k=1;k<=10;k++) bwMove(action, {x:b.x+k*9, y:b.y}); bwEnd(action); action=null; })""", bel)
        await pg.wait_for_timeout(200)
        pins = await pg.evaluate("(()=>{ const o=Object.values(curFrame().lip.bw)[0]; return o.p.length })()")
        if pins != 1: errs.append('one pin expected, got %s' % pins)
        if await pg.evaluate("undoStack.length") != n0 + 1: errs.append('drag should be one undo step')
        d = await pg.evaluate(DIFF, [None, 'plain'])
        print('bent vs plain: changed above / feet', d)
        if d[0] < 200: errs.append('the body did not bend: %s' % d)
        if d[1] > d[0] * 0.03: errs.append('the feet moved: %s' % d)
        await pg.evaluate("requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='uon_mem_keo.png')
        # a tap on the pin takes it away (one more undo step), undo brings it back
        await pg.evaluate("""(b => { bwStart({x:b.x+90,y:b.y}, {}, curFrame()); bwEnd(action); action=null; })""", bel)
        if await pg.evaluate("!!(curFrame().lip && curFrame().lip.bw)"): errs.append('tap on the pin should remove it')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(100)
        if not await pg.evaluate("!!(curFrame().lip && curFrame().lip.bw)"): errs.append('undo should bring the pin back')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(100)
        if await pg.evaluate("!!(curFrame().lip && curFrame().lip.bw)"): errs.append('undo of the drag should remove the bend')
        # 🔁 Cho chuyển động → 💃 Đánh hông on frames 1..3 (dialog)
        await pg.click('#bwAnim'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='uon_mem_hop_thoai.png')
        await pg.click('[data-bwp="hips"]'); await pg.fill('#bwFrom', '1'); await pg.fill('#bwTo', '3')
        await pg.click('.dlg .btns >> text=✓ Uốn'); await pg.wait_for_timeout(500)
        await pg.evaluate("if (playing) stopPlay(); selectFrame(0)"); await pg.wait_for_timeout(300)
        st = await pg.evaluate("S.frames.map(f => Object.values((f.lip&&f.lip.bw)||{}).map(o => o.k))")
        print('kinds per frame', st)
        if st != [['swing'], ['swing'], ['swing'], []]: errs.append('frames 1..3 should swing: %s' % st)
        if await pg.evaluate("bwMode"): errs.append('mode should end after applying')
        d = await pg.evaluate(DIFF, [0.125, 0.375])   # 2 beats/s: right at 1/8 s, left at 3/8 s
        print('swing right vs left: changed above / feet', d)
        if d[0] < 300: errs.append('the hips did not swing: %s' % d)
        if d[1] > d[0] * 0.03: errs.append('the feet moved while swinging: %s' % d)
        # smooth playback draw (ppLiveOver) moves it inside one frame
        lv = await pg.evaluate("""(()=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), g=t=>{ x.clearRect(0,0,W,H); ppLiveOver(0,t,false)(x); return new Uint8ClampedArray(x.getImageData(0,0,W,H).data); };
            const a=g(0.125), b=g(0.375); let n=0; for (let i=3;i<a.length;i+=16) if (Math.abs(a[i]-b[i])>40) n++; return n })()""")
        print('live draw changes', lv)
        if lv < 50: errs.append('live playback draw does not swing')
        await pg.evaluate("jgClock=0.125; requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='uon_mem_danh_hong.png'); await pg.evaluate("jgClock=null")
        cp = await pg.evaluate("(()=>{ const f=frameCopyOf(S.frames[0]); return !!(f.lip && f.lip.bw && Object.keys(f.lip.bw).length) })()")
        if not cp: errs.append('frameCopyOf lost the bend')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        u = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.bw).length")
        await pg.evaluate("redo()"); await pg.wait_for_timeout(200)
        r = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.bw).length")
        print('after undo', u, 'after redo', r)
        if u != 0 or r != 3: errs.append('undo/redo wrong %s %s' % (u, r))
        # 😂 laugh preset on a single imported-image layer (one piece, no joints) also works
        await pg.click('#bwClear'); await pg.wait_for_timeout(200); await pg.click('.dlg .btns >> text=Mọi frame'); await pg.wait_for_timeout(200)
        if await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.bw).length"): errs.append('Bỏ uốn left frames')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
