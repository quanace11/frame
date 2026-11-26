import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9533'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 〰 Nét sôi: a layer with p.bo boils (picture changes over film time, cycling n copies) while playing smoothly / exporting,
# stays exactly as drawn while editing, saves via ppPartMeta, and the dialog turns it on for the chosen layers
LIVE = """(t => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const f = S.frames[0]; const i0=0; x.clearRect(0,0,W,H); ppLiveOver(i0, t, false)(x); const d=x.getImageData(0,0,W,H).data, o=[]; for (let k=3;k<d.length;k+=28) o.push(d[k]); return o; })"""
STILL = """(() => { const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); drawPuppet(x, curFrame().pp, curFrame().lip); const d=x.getImageData(0,0,W,H).data, o=[]; for (let k=3;k<d.length;k+=28) o.push(d[k]); return o; })"""
def diff(a, b): return sum(1 for p, q in zip(a, b) if abs(p - q) > 40)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9533/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("kitAdd()"); await pg.wait_for_timeout(500)
        await pg.evaluate("S.frames[0].dur = 2000; selectFrame(0); setTool('puppet')"); await pg.wait_for_timeout(300)
        still0 = await pg.evaluate(STILL); off0 = await pg.evaluate(LIVE, 0.01); off1 = await pg.evaluate(LIVE, 0.2)
        if diff(off0, off1): errs.append('no boil yet but the picture changed: %s' % diff(off0, off1))
        # the dialog: ✓ Áp turns it on for the (only) layer
        await pg.click('#boBtn'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='net_soi_hop_thoai.png')
        await pg.click('.dlg .btns >> text=✓ Áp'); await pg.wait_for_timeout(400)
        await pg.evaluate("if (playing) stopPlay(); selectFrame(0)"); await pg.wait_for_timeout(200)
        cfg = await pg.evaluate("lyrRoots().map(r => r.bo)")
        print('cfg', cfg)
        if not cfg or not cfg[0] or cfg[0]['s'] != 8 or cfg[0]['n'] != 3: errs.append('dialog did not set the boil: %s' % cfg)
        if 'bo' not in await pg.evaluate("ppPartMeta(lyrRoots()[0])") or not await pg.evaluate("ppPartMeta(lyrRoots()[0]).bo"): errs.append('ppPartMeta does not keep bo')
        # editing: still as drawn
        still1 = await pg.evaluate(STILL)
        if diff(still0, still1): errs.append('editing view changed with boil on: %s' % diff(still0, still1))
        # playing: copy 0 (t 0.01) vs copy 1 (t 0.13) differ, copy 0 again after a full cycle (3 / 8 s) is the same
        a = await pg.evaluate(LIVE, 0.01); bb = await pg.evaluate(LIVE, 0.13); c = await pg.evaluate(LIVE, 0.01 + 3/8)
        d1, d2, d3 = diff(a, bb), diff(a, c), diff(a, still0)
        print('copy0 vs copy1', d1, 'copy0 vs next cycle', d2, 'copy0 vs drawn', d3, 'pixels', len(a))
        if d1 < 50: errs.append('the lines do not boil between copies: %s' % d1)
        if d2: errs.append('the copies do not cycle: %s' % d2)
        if d3 > sum(1 for v in still0 if v > 40) * 0.6: errs.append('boil moved the picture too much: %s' % d3)
        # 👀 Xem trên khung → the canvas moves live
        await pg.click('#boPrevBtn'); await pg.wait_for_timeout(100)
        if not await pg.evaluate("boPrev"): errs.append('preview did not turn on')
        await pg.screenshot(path='net_soi_khung.png')
        await pg.click('#boPrevBtn')
        # undo removes it, redo brings it back
        await pg.wait_for_timeout(600); await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        u = await pg.evaluate("lyrRoots().some(r => r.bo)"); await pg.evaluate("redo()"); await pg.wait_for_timeout(200)
        r = await pg.evaluate("lyrRoots().some(r => r.bo)")
        print('after undo', u, 'after redo', r)
        if u or not r: errs.append('undo/redo wrong %s %s' % (u, r))
        # Tắt hết
        await pg.click('#boBtn'); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Tắt hết'); await pg.wait_for_timeout(200)
        if await pg.evaluate("lyrRoots().some(r => r.bo)"): errs.append('Tắt hết left boil on')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
