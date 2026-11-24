import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# 🖊 Tablet làm bảng vẽ: Frame Studio (tab 1) ↔ PenPad server thật (penpad/penpad_server.py --dry) ↔ trang tablet (tab 2).
# Chọn bút/tẩy/màu/cỡ/lớp trên tablet đổi Frame Studio, nét bút trên tablet vẽ vào frame, chạm 2 ngón = hoàn tác,
# tablet nhận hình frame, trang lạ không nối được vào PenPad.
import asyncio, subprocess, time
from playwright.async_api import async_playwright
HTTP, PAD = 9191, 9192
srv = subprocess.Popen(['python3', '-m', 'http.server', str(HTTP)], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
pad = subprocess.Popen([sys.executable, os.path.join(ROOT, 'penpad', 'penpad_server.py'), '--dry', '--no-adb', '--port', str(PAD)],
                       stdout=open(os.path.join(OUT, 'penpad_server.log'), 'w'), stderr=subprocess.STDOUT)
import atexit; atexit.register(srv.kill); atexit.register(pad.kill)
time.sleep(1.2)

PEN = '''async ([pts, pr])=>{const st=document.getElementById('stage'), r=document.getElementById('area').getBoundingClientRect();
  const mk=(t,x,y,b)=>new PointerEvent(t,{pointerId:5,pointerType:'pen',clientX:r.left+x*r.width,clientY:r.top+y*r.height,pressure:b?pr:0,buttons:b,bubbles:true,cancelable:true});
  st.dispatchEvent(mk('pointermove',pts[0][0],pts[0][1],0));
  st.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1],1));
  for(const [x,y] of pts.slice(1)){st.dispatchEvent(mk('pointermove',x,y,1)); await new Promise(r=>setTimeout(r,8));}
  st.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1],0));
  st.dispatchEvent(mk('pointerleave',pts.at(-1)[0],pts.at(-1)[1],0));}'''
TWO = '''async ()=>{const st=document.getElementById('stage'), r=st.getBoundingClientRect();
  const mk=(t,id,x)=>new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:r.left+x,clientY:r.top+200,bubbles:true,cancelable:true});
  st.dispatchEvent(mk('pointerdown',21,300)); st.dispatchEvent(mk('pointerdown',22,420));
  await new Promise(r=>setTimeout(r,60)); st.dispatchEvent(mk('pointerup',21,300)); st.dispatchEvent(mk('pointerup',22,420));}'''

async def wait(pg, js, ms=6000):
    t = time.time()
    while time.time() - t < ms / 1000:
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(100)
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        errs = []
        fsx = await b.new_context(viewport={'width': 1366, 'height': 900})
        await fsx.add_init_script(f"localStorage.setItem('fs-pad', JSON.stringify({{on:true, port:{PAD}}}))")
        fs = await fsx.new_page(); fs.on('pageerror', lambda e: errs.append('fs: ' + str(e)))
        await fs.goto(f'http://localhost:{HTTP}/index.html'); await fs.wait_for_timeout(1000)
        await fs.click('.dlg .btns >> text=Bắt đầu vẽ')
        print('fs connected', await wait(fs, 'padLive()'))

        tbx = await b.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True)
        tb = await tbx.new_page(); tb.on('pageerror', lambda e: errs.append('tablet: ' + str(e)))
        await tb.goto(f'http://127.0.0.1:{PAD}/')
        print('tablet in Frame Studio mode', await wait(tb, "document.body.classList.contains('fs') && !!document.querySelector('#fKinds .chip')"))
        print('tablet got frame picture', await wait(tb, "(document.getElementById('fimg').src||'').startsWith('data:image/jpeg')"))
        r = await tb.evaluate("(()=>{const r=document.getElementById('area').getBoundingClientRect();return r.height/r.width})()")
        print('area is 9:16', abs(r - 16 / 9) < 0.02)

        await tb.click('#fTools [data-tool=eraser]'); print('tool eraser', await wait(fs, "S.tool==='eraser'"))
        await tb.click('#fTools [data-tool=brush]'); print('tool brush', await wait(fs, "S.tool==='brush'"))
        await tb.click('#fKinds .chip >> text=Bút mực'); print('brush kind ink', await wait(fs, "S.brush==='ink'"))
        await tb.click('#fKinds .chip >> text=Bút tròn'); await wait(fs, "S.brush==='pen'")
        await tb.click('#fPal .sw[title="#e53935"]'); print('colour red', await wait(fs, "S.color==='#e53935'"))
        s0 = await fs.evaluate('S.size'); await tb.click('#fpanel [data-stp=size][data-d="1"]')
        print('size +', await wait(fs, f'S.size>{s0}'))
        for _ in range(6): await tb.click('#fpanel [data-stp=size][data-d="1"]')
        await tb.click('#fLayers [data-layer=vec]'); print('layer Nét', await wait(fs, "S.layer==='vec'"))
        await tb.click('#fLayers [data-layer=char]'); await wait(fs, "S.layer==='char'")
        print('tablet panel follows', await wait(tb, "document.querySelector('#fTools [data-tool=brush]').classList.contains('on') && document.querySelector('#fLayers [data-layer=char]').classList.contains('on')"))

        # pen line across the middle of the frame on the tablet → red pixels in the middle of the frame on the computer
        src0 = await tb.evaluate("document.getElementById('fimg').src")
        await tb.evaluate(PEN, [[[0.3 + i * 0.02, 0.5] for i in range(21)], 0.8])
        px = "(()=>{const c=curFrame().canvas.getContext('2d').getImageData(Math.round(W*0.5)-2,Math.round(H*0.5)-2,5,5).data;let a=0,r=0;for(let i=0;i<c.length;i+=4){if(c[i+3]>a){a=c[i+3];r=c[i];}}return [a,r]})()"
        ok = await wait(fs, px + "[0] > 100")
        a, red = await fs.evaluate(px)
        print('pen line drawn in frame', ok, 'red', red > 150)
        print('nothing at top of frame', await fs.evaluate("curFrame().canvas.getContext('2d').getImageData(Math.round(W*0.5),Math.round(H*0.1),1,1).data[3]===0"))
        await tb.evaluate("window.__src0=" + repr(src0))
        print('tablet picture updated after line', await wait(tb, "document.getElementById('fimg').src!==window.__src0"))
        await tb.screenshot(path='o_tablet_fs.png'); await fs.screenshot(path='o_tablet_pc.png')

        # 2-finger tap on the tablet = undo
        await tb.evaluate(TWO)
        print('2-finger tap undo', await wait(fs, px + "[0] === 0"))

        # eraser end of the stylus: erases, then the tool comes back
        await tb.click('#fFit')
        n0 = await fs.evaluate('S.frames.length'); await tb.click('#fAdd')
        print('add frame', await wait(fs, f'S.frames.length==={n0 + 1}'), await wait(tb, f"document.getElementById('fFr').textContent.includes('/ {n0 + 1}')"))
        await tb.click('#fPrev'); print('prev frame', await wait(fs, f'S.cur==={n0 - 1}'))

        # a page that is not the PenPad page cannot connect as the tablet (would type keys on the computer)
        refused = await fs.evaluate(f"new Promise(r=>{{const w=new WebSocket('ws://127.0.0.1:{PAD}/ws');w.onopen=()=>{{w.close();r(false)}};w.onerror=()=>r(true);setTimeout(()=>r('timeout'),3000)}})")
        print('foreign page refused as tablet', refused is True)

        # turning it off in Frame Studio → the tablet leaves Frame Studio mode
        await fs.evaluate('padSet(false)')
        print('tablet back to computer mode', await wait(tb, "!document.body.classList.contains('fs')"))
        await b.close()
    print('ERR', errs)

asyncio.run(main())
