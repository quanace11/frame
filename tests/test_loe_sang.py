import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# ✨ Lóe sáng ở cửa (tab 🌈 Hiệu ứng): mark the tunnel opening by dragging, the light fades in/out over the run,
# a cut-out character walking out stays in front of the light (z back) or is covered (z top), burst flash, play cache, undo, save
srv = subprocess.Popen(['python3','-m','http.server','9751'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
DRAG='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:9,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,8));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
DOC2SCR = "(([x,y])=>{const [a,b,c,d,e,f]=viewMat(); return [(a*x+c*y+e)/DPR,(b*x+d*y+f)/DPR]})"
def line(a, b, n=10): return [[a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n] for t in range(n + 1)]
# final picture of frame i at time t (as in the video), sampled at points
FX = '''async ([i, t, pts]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const base = makeCanvas(); drawFrameBase(base.getContext('2d'), f, bg); const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true });
  trSkip = true; drawFrameFx(x, i, base, 0, t); trSkip = false;
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        async def drag(docs):
            scr = [await pg.evaluate(DOC2SCR, d) for d in docs]; await pg.evaluate(DRAG, [scr]); await pg.wait_for_timeout(150)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9751/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(7): await pg.click('#addBtn')
        W, H = await pg.evaluate("[W,H]")
        # tunnel background on every frame, a cut-out player standing in the opening
        await pg.evaluate("""(async()=>{ const bg = bgOf(S.frames[0]); await ensureLoaded(bg); drawScene(bg.canvas.getContext('2d'), 'tunnel', W, H); bg.ver++;
          S.frames.forEach(f=>{ f.bgId = bg.id; f.dur = 200; }); S.cur = 0; await kitAdd(); S.cur = 0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','look'); })()""")
        await pg.wait_for_timeout(500)
        check('glow rows built', await pg.evaluate("document.querySelectorAll('[data-glsh]').length===3 && document.querySelectorAll('[data-glk]').length===3 && document.querySelector('#glPick').offsetParent!==null"))
        # a puppet pixel near the opening (to see whether the character covers the light)
        pix = await pg.evaluate("""(()=>{ const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawPuppet(x, S.frames[0].pp, S.frames[0].lip);
          const d = x.getImageData(0, 0, W, H).data; let best = null, bd = 1e9; for (let y = 0; y < H; y += 3) for (let q = 0; q < W; q += 3) { const k = (y * W + q) * 4;
          if (d[k + 3] === 255) { const r = Math.hypot(q - W * .5, y - H * .45); if (r < bd) { bd = r; best = [q, y]; } } } return best; })()""")
        print('puppet pixel', pix)
        check('player stands near the opening', pix is not None and abs(pix[1] - H * 0.45) < H * 0.25)
        ox, oy = W * 0.5, H * 0.34   # inside the opening, above the player
        side = [W * 0.2, H * 0.62]    # tunnel wall below-left of the opening (bloom + floor spill)
        pts = [[ox, oy], side, pix]
        before = await pg.evaluate(FX, [3, 0, pts])
        # ---------- mark the opening by dragging ----------
        await pg.fill('#lkN', '8'); await pg.dispatch_event('#lkN', 'change')
        await pg.click('[data-glsh="arch"]'); await pg.click('[data-glk="steady"]'); await pg.click('[data-glfi="0.4"]')
        await pg.click('#glPick'); check('pick mode on', await pg.evaluate("glPick"))
        await drag(line([W * 0.36, H * 0.30], [W * 0.64, H * 0.56]))
        g = await pg.evaluate("S.frames[0].gl")
        print('gl', g)
        check('drag marks the opening on 8 frames', g and abs(g['x'] - W * 0.36) < 4 and abs(g['w'] - W * 0.28) < 6 and g['sh'] == 'arch' and await pg.evaluate("S.frames.every(f=>f.gl && f.gl.id===S.frames[0].gl.id)"))
        check('pick mode off after marking', not await pg.evaluate("glPick"))
        lv = await pg.evaluate("[0,1,3,6,7].map(i=>glLevel(i,0).a)")
        print('levels', lv)
        check('fades in at the start and out at the end', lv[0] < 0.05 and lv[1] > lv[0] and lv[2] > 0.9 and lv[4] < lv[2] and lv[3] > lv[4])
        mid = await pg.evaluate(FX, [3, 0, pts])
        print('before', before, 'with light', mid)
        check('opening glows white', min(mid[0]) > 230 and sum(mid[0]) >= sum(before[0]))
        check('wall near the door gets lighter', sum(mid[1]) > sum(before[1]) + 60)
        check('character stays in front of the light', max(abs(a - c) for a, c in zip(mid[2], before[2])) <= 2)
        await pg.evaluate("S.cur=3; updateFrameUI()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='loe_sang_edit.png')
        # ---------- move the box by dragging inside it (whole run), undo ----------
        await pg.wait_for_timeout(600)
        x0 = g['x']
        await drag(line([W * 0.5, H * 0.45], [W * 0.55, H * 0.45]))
        check('drag inside moves the light on every frame', await pg.evaluate(f"S.frames.every(f=>Math.abs(f.gl.x - ({x0} + W*0.05)) < 4)"))
        await pg.wait_for_timeout(600); await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo puts the box back', await pg.evaluate(f"S.frames.every(f=>Math.abs(f.gl.x - {x0}) < 1)"))
        # corner drag resizes, the opposite corner stays
        await drag(line([g['x'] + g['w'], g['y'] + g['h']], [g['x'] + g['w'] + W * 0.05, g['y'] + g['h'] + H * 0.02]))
        g2 = await pg.evaluate("S.frames[5].gl")
        check('corner drag makes it bigger, top-left stays', abs(g2['x'] - g['x']) < 2 and abs(g2['y'] - g['y']) < 2 and g2['w'] > g['w'] + W * 0.04)
        # ---------- light over the character ----------
        await pg.click('[data-glz="top"]'); await pg.wait_for_timeout(100)
        top = await pg.evaluate(FX, [3, 0, pts])
        print('top', top)
        check('💡 light over the character lights the character', sum(top[2]) > sum(before[2]) + 40)
        await pg.click('[data-glz="back"]')
        # ---------- burst: whole picture flashes at full light, then calms ----------
        await pg.click('[data-glk="burst"]'); await pg.wait_for_timeout(100)
        far = [[W * 0.05, H * 0.05]]
        a = await pg.evaluate(FX, [2, 0, far]); b2 = await pg.evaluate(FX, [6, 0, far]); f0 = await pg.evaluate(FX, [0, 0, far])
        print('burst', f0, a, b2)
        check('✨ burst flashes the whole picture at full light', sum(a[0]) > sum(b2[0]) + 150 and sum(a[0]) > sum(f0[0]) + 150)
        # ---------- options apply to the whole run, play cache ----------
        await pg.click('[data-glc="warm"]'); await pg.click('#glRay')
        check('options on the run', await pg.evaluate("S.frames.every(f=>f.gl.c==='warm' && !f.gl.ray && f.gl.k==='burst')"))
        await pg.evaluate("buildPlayCache()"); await pg.wait_for_timeout(300)
        check('play cache key has the light level', await pg.evaluate("S.frames[3].playKey.startsWith('g') && S.frames[0].playKey!==S.frames[3].playKey"))
        # ---------- copy keeps it, save / reload, off ----------
        check('frame copy keeps the light', await pg.evaluate("(async()=>{ await ensureLoaded(S.frames[2]); return frameCopyOf(S.frames[2]).gl.id===S.frames[2].gl.id })()"))
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved light survives reload', await pg.evaluate("S.frames.length===8 && S.frames.every(f=>f.gl && f.gl.c==='warm' && f.gl.k==='burst')"))
        await pg.evaluate("S.cur=0; updateFrameUI(); setTool('fx'); openTab('fx','look')"); await pg.wait_for_timeout(200)
        await pg.click('#glOffB'); await pg.wait_for_timeout(100)
        check('Tắt removes it from the run', await pg.evaluate("S.frames.every(f=>!f.gl)"))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
