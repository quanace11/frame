import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎬 film zoom techniques (Camera tab): pull-out, crash zoom, 3-step zoom, Ken Burns, pan, shot sizes around the drawing,
# editing the START and END box of a move (▶ Khung đầu / ⏹ Khung cuối), ⇄ swap, ease, 💥 impact shake, 📷 handheld,
# corner resize keeps the opposite corner, undo, SFX, GIF time windows, save + reload
srv = subprocess.Popen(['python3','-m','http.server','8898'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
DRAG='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:9,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,8));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
DOC2SCR = "(([x,y])=>{const [a,b,c,d,e,f]=viewMat(); return [(a*x+c*y+e)/DPR,(b*x+d*y+f)/DPR]})"
def line(a, b, n=10): return [[a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n] for t in range(n + 1)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        async def drag(docs):
            scr = [await pg.evaluate(DOC2SCR, d) for d in docs]; await pg.evaluate(DRAG, [scr]); await pg.wait_for_timeout(150)
        Z = lambda i, t=0: pg.evaluate(f"camAt({i},{t}).z")
        C = lambda i, t=0: pg.evaluate(f"camAt({i},{t})")
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8898/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.click('#addBtn')
        # a drawn "character" on frame 1: a tall blob (head on top) so shot sizes have something to frame
        await pg.evaluate("""(async()=>{ S.frames.forEach(f=>f.dur=3000); S.cur=0; updateFrameUI(); const f=S.frames[0]; await ensureLoaded(f);
          const x=f.canvas.getContext('2d'); x.fillStyle='#222'; x.beginPath(); x.arc(400,500,90,0,7); x.fill(); x.fillRect(330,590,140,700); f.ver++;
          setTool('fx'); openTab('fx','cam'); fxSyncBar(); })()"""); await pg.wait_for_timeout(300)
        W, H = await pg.evaluate("[W,H]")
        check('technique rows visible', await pg.evaluate("['camFxBtns','camShotBtns','camMoveRow'].every(id=>document.getElementById(id).offsetParent!==null) && document.querySelectorAll('[data-camfx]').length===5 && document.querySelectorAll('[data-camshot]').length===5"))
        # 1) 🧍 shot sizes around the drawing
        await pg.click('[data-camshot=close]'); await pg.wait_for_timeout(300)
        c = await pg.evaluate("S.frames[0].cam")
        print('close-up', c)
        check('close-up frames the head', c and c['z'] > 3 and abs(c['x'] - 400) < 60 and 380 < c['y'] < 720)
        await pg.click('[data-camshot=full]'); await pg.wait_for_timeout(300)
        c = await pg.evaluate("S.frames[0].cam"); print('full', c)
        check('full shot shows the whole body', c['z'] < 2.1 and H / c['z'] > 880 and abs(c['y'] - (410 + 1290) / 2) < 120)
        await pg.click('[data-camshot=wide]'); check('wide shot', await Z(0) == 1)
        await pg.evaluate("undo()"); check('undo shot size', abs(await Z(0) - c['z']) < 0.01)
        await pg.evaluate("S.frames[0].cam=null; fxSyncBar()")
        # 2) 🔙 pull-out: starts close on the tap, ends on the whole shot, inside one long frame
        await pg.evaluate("S.cur=1; updateFrameUI(); fxSyncBar()"); await pg.click('[data-camfx=pull]')
        await drag([[W * 0.3, H * 0.3]])
        k = await pg.evaluate("S.frames[1].cam"); print('pull', k)
        check('pull key', k['tr'] == 'smooth' and k['k'] == 'pull' and k['s']['z'] >= 2.5 and k['z'] == 1)
        check('pull moves close → wide', await Z(1, 0) >= 2.5 and 1 < await Z(1, k['d'] / 2) < 2.5 and await Z(1, k['d'] + 0.1) == 1)
        check('status names the technique', '🔙 Kéo ra' in await pg.inner_text('#camStat'))
        await pg.screenshot(path='tzoom_pull.png')
        # 3) edit the START box (▶ Khung đầu): drag a corner, the opposite corner stays
        await pg.click('[data-camside=start]'); check('start side on', await pg.evaluate("camSide") == 'start')
        b0 = await pg.evaluate("(()=>{const b=camBox(camAt(1,0));return [b.cx-b.hw,b.cy-b.hh,b.cx+b.hw,b.cy+b.hh]})()")
        await drag(line([b0[2], b0[3]], [b0[2] + (b0[2] - b0[0]) * 0.3, b0[3] + (b0[3] - b0[1]) * 0.3]))
        b1 = await pg.evaluate("(()=>{const b=camBox(camAt(1,0));return [b.cx-b.hw,b.cy-b.hh,b.cx+b.hw,b.cy+b.hh]})()")
        print('start box', b0, b1)
        check('start box grew from its corner', abs(b1[0] - b0[0]) < 3 and abs(b1[1] - b0[1]) < 3 and (b1[2] - b1[0]) > (b0[2] - b0[0]) * 1.2)
        check('end box untouched', await pg.evaluate("S.frames[1].cam.z") == 1)
        await pg.evaluate("undo()"); check('undo start edit', abs(await pg.evaluate("S.frames[1].cam.s.z") - k['s']['z']) < 0.01)
        # drag inside the start box moves it
        b0 = await pg.evaluate("(()=>{const b=camBox(camAt(1,0));return [b.cx,b.cy]})()")
        await drag(line(b0, [b0[0] + 60, b0[1] + 40]))
        s2 = await pg.evaluate("S.frames[1].cam.s"); check('move start box', abs(s2['x'] - b0[0] - 60) < 4 and abs(s2['y'] - b0[1] - 40) < 4)
        # ⏹ end box + 📍 / zoom slider edit the end box
        await pg.click('[data-camside=end]')
        await pg.evaluate("const e=document.getElementById('fxZoom'); e.value=150; e.dispatchEvent(new Event('change'))")
        k2 = await pg.evaluate("S.frames[1].cam"); check('end edit keeps the start box + technique', abs(k2['z'] - 1.5) < 0.01 and k2['s']['x'] == s2['x'] and k2['k'] == 'pull')
        # ⇄ swap → push-in
        await pg.click('#camSwap'); k3 = await pg.evaluate("S.frames[1].cam")
        check('swap start/end', abs(k3['s']['z'] - 1.5) < 0.01 and abs(k3['z'] - k2['s']['z']) < 0.01)
        # ease
        await pg.select_option('#camEase', 'linear'); check('ease set', await pg.evaluate("S.frames[1].cam.e") == 'linear')
        zl = await Z(1, k3['d'] * 0.25); exp = k3['s']['z'] * (k3['z'] / k3['s']['z']) ** 0.25  # zoom goes on a log scale (camMix): steady speed for the eye
        check('linear ease', abs(zl - exp) < 0.02)
        # 4) ⚡ crash zoom: fast, overshoots, impact shake, whoosh sound, one undo step
        await pg.evaluate("S.cur=2; updateFrameUI(); fxSyncBar()"); n_sfx = await pg.evaluate("(S.audio.sfx||[]).length")
        await pg.click('[data-camfx=crash]'); await drag([[W * 0.6, H * 0.4]])
        k = await pg.evaluate("S.frames[2].cam"); print('crash', k)
        zs = [await Z(2, t) for t in (0, 0.1, 0.2, 0.3)]; print('crash z', zs)
        check('crash zoom is fast with overshoot', k['e'] == 'crash' and k['d'] <= 0.3 and max(zs) > k['z'] + 0.05 and abs(zs[-1] - k['z']) < 0.01)
        sh = await pg.evaluate("[camFx(2,0.05).sh, camFx(2,0.2).sh, camFx(2,1).sh]"); print('shake', sh)
        check('impact shake after arrival, then calm', sh[1] > 5 and sh[2] == 0)
        check('whoosh added', await pg.evaluate(f"S.audio.sfx.length") == n_sfx + 1 and await pg.evaluate("S.audio.sfx.at(-1).kind") == 'whoosh')
        await pg.evaluate("undo()"); check('one undo removes key + sound', await pg.evaluate("S.frames[2].cam") is None and await pg.evaluate("S.audio.sfx.length") == n_sfx)
        await pg.evaluate("redo()"); check('redo', await pg.evaluate("S.frames[2].cam.k") == 'crash' and await pg.evaluate("S.audio.sfx.length") == n_sfx + 1)
        # 5) 🥁 3-step zoom: three hard jumps
        await pg.click('[data-camfx=steps]'); await drag([[W * 0.5, H * 0.5]])
        k = await pg.evaluate("S.frames[2].cam"); zs = [round(await Z(2, t), 3) for t in (0.05, 0.25, 0.4, 0.55, 0.7, 1.0)]; print('steps', zs)
        check('3 steps', k['e'] == 'steps' and zs[0] == zs[1] and zs[2] == zs[3] and zs[0] < zs[2] < zs[4] and zs[4] == zs[5])
        # 6) 🖼 Ken Burns: linear, lasts until the next key (here: film end = 3 s)
        await pg.click('[data-camfx=kb]'); await drag([[W * 0.7, H * 0.35]])
        k = await pg.evaluate("S.frames[2].cam"); print('kb', k)
        a, m, e = await C(2, 0), await C(2, k['d'] / 2), await C(2, k['d'])
        check('ken burns pans + zooms slowly', k['e'] == 'linear' and k['d'] == 3 and a['z'] < e['z'] and min(a['x'], e['x']) < m['x'] < max(a['x'], e['x']) and abs(a['x'] - e['x']) > 50)
        # 7) ↔ pan keeps the zoom
        await pg.click('[data-camfx=pan]'); await drag([[W * 0.25, H * 0.5]])
        k = await pg.evaluate("S.frames[2].cam"); check('pan keeps zoom', abs(k['s']['z'] - k['z']) < 0.01 and abs(k['s']['x'] - k['x']) > 50)
        # 8) 💥 / 📷 toggles
        await pg.click('#camHit'); check('hit toggle', await pg.evaluate("S.frames[2].cam.hit") == 16)
        await pg.click('#camHand'); hh = await pg.evaluate("(()=>{const v=[0,0.5,1,1.5,2,2.5].map(t=>camFx(2,t).ox*S.frames[2].cam.z); return [S.frames[2].cam.hh, Math.max(...v)-Math.min(...v)]})()"); print('hh', hh)
        check('handheld sway', hh[0] == 1 and hh[1] > 3)
        await pg.click('#camHand'); check('handheld off', not await pg.evaluate("S.frames[2].cam.hh"))
        # 9) GIF splits the moves into small steps
        w = await pg.evaluate("camWins(frameStartTimes())"); print('wins', w)
        check('gif windows for moves', len(w) >= 3)
        # 10) the edit box: cut keys have no start side
        await pg.click('[data-camtr=cut]'); check('cut drops the move', await pg.evaluate("!S.frames[2].cam.s && !S.frames[2].cam.e && document.querySelector('[data-camside=start]').disabled"))
        await pg.evaluate("undo()")
        await pg.screenshot(path='tzoom_tools.png')
        # 11) playback + preview + save/reload
        await pg.click('#camPrev'); await pg.wait_for_timeout(800); await pg.evaluate("if(playing) stopPlay()")
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1200)
        before = await pg.evaluate("JSON.stringify(S.frames.map(f=>f.cam))")
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved keys keep the moves', await pg.evaluate("JSON.stringify(S.frames.map(f=>f.cam))") == before)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
