import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9231'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🫨 Rung 1 chỗ: lasso a spot on a character (top of the chest) → that spot moves over time on frames a..b, the rest stays still;
# one undo step, kept by copied frames, removable with 🗑 Bỏ rung
DIFF = """(([t, box]) => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const draw = tt => { x.clearRect(0,0,W,H); jgClock=tt; try { drawPuppet(x, curFrame().pp, curFrame().lip); } finally { jgClock=null; } return new Uint8ClampedArray(x.getImageData(0,0,W,H).data); };
  const a = draw(0), b = draw(t); let inn=0, out=0;
  for (let y=0;y<H;y+=2) for (let X=0;X<W;X+=2) { const i=(y*W+X)*4; if (Math.abs(a[i+3]-b[i+3])+Math.abs(a[i]-b[i])>40) { if (X>=box[0]&&X<=box[2]&&y>=box[1]&&y<=box[3]) inn++; else out++; } }
  return [inn, out]; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9231/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("kitAdd()"); await pg.wait_for_timeout(500)
        for _ in range(3): await pg.evaluate("addFrame()"); await pg.wait_for_timeout(150)
        await pg.evaluate("selectFrame(0); setTool('puppet')"); await pg.wait_for_timeout(300)
        # a spot on the top edge of the torso (so its outline shows the motion), in document coords
        box = await pg.evaluate("""(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), M=ppMats(ppPoseFor(curFrame()))[t.id];
            const c=mApply(M, t.ox+t.c.width/2, t.oy+t.c.height*0.05), r=t.c.width*0.3; return [c.x-r, c.y-r*0.7, c.x+r, c.y+r*0.7] })()""")
        await pg.click('#jgBtn'); await pg.wait_for_timeout(100)
        if not await pg.evaluate("jgMode"): errs.append('⭕ Khoanh did not turn the mode on')
        # lasso around the spot (as ppEnd would get it) → dialog
        await pg.evaluate("""(b => { const cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2, rx=(b[2]-b[0])/2, ry=(b[3]-b[1])/2, poly=[];
            for (let k=0;k<24;k++) poly.push({x:cx+rx*Math.cos(k/24*6.283), y:cy+ry*Math.sin(k/24*6.283)}); jgLassoDone(poly); })""", box)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='rung_hop_thoai.png')
        await pg.click('[data-jgk="bounce"]'); await pg.fill('#jgFrom', '1'); await pg.fill('#jgTo', '3')
        await pg.click('.dlg .btns >> text=✓ Rung'); await pg.wait_for_timeout(500)
        await pg.evaluate("if (playing) stopPlay(); selectFrame(0)"); await pg.wait_for_timeout(300)
        st = await pg.evaluate("S.frames.map(f => Object.values((f.lip&&f.lip.jg)||{}).map(r => [r.k, !!ppPart(r.p)]))")
        print('regions per frame', st)
        if [len(x) for x in st] != [1, 1, 1, 0]: errs.append('frames 1..3 should have 1 spot, frame 4 none: %s' % st)
        if st[0] and st[0][0] != ['bounce', True]: errs.append('spot should be a bounce on a part: %s' % st[0])
        if await pg.evaluate("jgMode"): errs.append('mode should end after applying')
        d = await pg.evaluate(DIFF, [0.08, box])
        print('changed pixels inside / outside the spot', d)
        if d[0] < 30: errs.append('the spot did not move: %s' % d)
        if d[1] > d[0] * 0.15: errs.append('too much moved outside the spot: %s' % d)
        await pg.evaluate("jgClock=0.08; requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='rung_nguc.png'); await pg.evaluate("jgClock=null")
        # a smooth-playback draw (ppLiveOver) moves it inside one frame too
        lv = await pg.evaluate("""(()=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), g=t=>{ x.clearRect(0,0,W,H); ppLiveOver(0,t,false)(x); return new Uint8ClampedArray(x.getImageData(0,0,W,H).data); };
            const a=g(0), b=g(0.08); let n=0; for (let i=3;i<a.length;i+=16) if (Math.abs(a[i]-b[i])>40) n++; return n })()""")
        print('live draw changes', lv)
        if lv < 10: errs.append('live playback draw does not jiggle')
        # a copied frame keeps the spot
        cp = await pg.evaluate("(()=>{ const f=frameCopyOf(S.frames[0]); return !!(f.lip && f.lip.jg && Object.keys(f.lip.jg).length) })()")
        if not cp: errs.append('frameCopyOf lost the spot')
        # one undo step removes it on every frame, redo brings it back
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        u = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.jg).length")
        await pg.evaluate("redo()"); await pg.wait_for_timeout(200)
        r = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.jg).length")
        print('after undo', u, 'after redo', r)
        if u != 0 or r != 3: errs.append('undo/redo wrong %s %s' % (u, r))
        # 🗑 Bỏ rung → everything
        await pg.click('#jgClear'); await pg.wait_for_timeout(200); await pg.click('.dlg .btns >> text=Bỏ hết mọi chỗ rung'); await pg.wait_for_timeout(200)
        c = await pg.evaluate("S.frames.filter(f=>f.lip&&f.lip.jg).length")
        if c: errs.append('Bỏ rung left %s frames' % c)
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
