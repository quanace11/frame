import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎥 camera shots: drag a camera box (draw / move / corner zoom), ✂ cut vs 〰 smooth push (time-based, inside one long frame),
# one-tap Cận cảnh / Đẩy vào, legacy keys unchanged, undo, save + reload, playback
srv = subprocess.Popen(['python3','-m','http.server','8871'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8871/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#addBtn'); await pg.click('#addBtn')
        await pg.evaluate("S.frames.forEach(f=>f.dur=500); S.frames[2].dur=3000; S.cur=1; updateFrameUI(); setTool('fx'); openTab('fx','cam')"); await pg.wait_for_timeout(200)
        W, H = await pg.evaluate("[W,H]")
        check('cam rows visible', await pg.evaluate("document.getElementById('camPushIn').offsetParent!==null && document.querySelector('[data-camtr=cut]').offsetParent!==null"))
        # 1) frame 2: draw a box around "person + TV" (cut is the default)
        await drag(line([W * 0.2, H * 0.3], [W * 0.7, H * 0.55]))
        c = await pg.evaluate("S.frames[1].cam")
        check('drawn box makes a cut key', c and c['tr'] == 'cut' and abs(c['x'] - W * 0.45) < 3 and abs(c['z'] - min(1 / 0.5, 1 / 0.25)) < 0.05)
        check('cut: frame 1 stays wide until the cut', await Z(0) == 1 and await Z(0, 0.49) == 1 and abs(await Z(1) - 2) < 0.05)
        check('badge on frame 2', await pg.evaluate("(S.frames[1].el.querySelector('.camk')||{}).textContent") == '🎥✂')
        await pg.screenshot(path='tcam_box.png')
        # 2) undo / redo
        await pg.evaluate("undo()"); check('undo removes key', await pg.evaluate("S.frames[1].cam") is None)
        await pg.evaluate("redo()"); check('redo restores key', await pg.evaluate("!!S.frames[1].cam"))
        # 3) drag inside the box moves it, a corner zooms
        await drag(line([W * 0.45, H * 0.42], [W * 0.5, H * 0.45]))
        c = await pg.evaluate("S.frames[1].cam"); check('move inside box', abs(c['x'] - W * 0.5) < 3 and abs(c['z'] - 2) < 0.05)
        bx = await pg.evaluate("(()=>{const b=camBox(camEdit(1));return [b.cx+b.hw,b.cy+b.hh,b.cx,b.cy]})()")
        await drag(line([bx[0], bx[1]], [bx[2] + (bx[0] - bx[2]) * 0.5, bx[3] + (bx[1] - bx[3]) * 0.5]))
        tl0 = [bx[2] - (bx[0] - bx[2]), bx[3] - (bx[1] - bx[3])]
        tl1 = await pg.evaluate("(()=>{const b=camBox(camEdit(1));return [b.cx-b.hw,b.cy-b.hh]})()")
        check('corner drag zooms in, opposite corner stays', abs(await pg.evaluate("S.frames[1].cam.z") - 8 / 3) < 0.1 and abs(tl0[0] - tl1[0]) < 3 and abs(tl0[1] - tl1[1]) < 3)
        # 4) frame 3 (one long 3 s still): 🎬 push in on a tap, over 1 s, starting from frame 2's shot
        await pg.evaluate("S.cur=2; updateFrameUI(); fxSyncBar()"); await pg.click('#camPushIn')
        check('push armed', await pg.evaluate("camPresetMode") == 'push')
        await drag([[W * 0.3, H * 0.6]])
        c = await pg.evaluate("S.frames[2].cam")
        check('push key', c['tr'] == 'smooth' and c['d'] == 1 and abs(c['x'] - W * 0.3) < 2)
        z0, zm, z1 = await Z(2, 0), await Z(2, 0.5), await Z(2, 1.5)
        print('push z', z0, zm, z1, c['z'])
        check('push starts from previous shot and moves inside the frame', abs(z0 - await Z(1)) < 0.01 and min(z0, c['z']) < zm < max(z0, c['z']) and abs(z1 - c['z']) < 0.01)
        await pg.screenshot(path='tcam_push.png')
        # 5) change duration with the slider
        await pg.evaluate("const e=document.getElementById('camD'); e.value=2; e.dispatchEvent(new Event('change'))")
        check('duration slider updates key', await pg.evaluate("S.frames[2].cam.d") == 2 and abs(await Z(2, 1.0) - c['z']) > 0.01)
        # 6) switch to cut and back to wide
        await pg.click('[data-camtr=cut]'); check('switch to cut', await pg.evaluate("S.frames[2].cam.tr") == 'cut' and abs(await Z(2, 0) - c['z']) < 0.01)
        await pg.click('#camWide'); check('wide', await Z(2) == 1)
        # 7) 🔍 Cận cảnh one tap
        await pg.click('#camCutIn'); await drag([[W * 0.6, H * 0.4]])
        check('close-up cut', await pg.evaluate("S.frames[2].cam.tr") == 'cut' and await Z(2) >= 2)
        # 8) legacy keys (no tr) behave like before: neighbours switch exactly at the frame
        leg = await pg.evaluate("(()=>{const s=S.frames.map(f=>f.cam); S.frames[0].cam={z:2,x:540,y:960}; S.frames[1].cam={z:3,x:540,y:960}; S.frames[2].cam=null; const r=[camAt(0,0.4).z, camAt(1).z, camAt(2,2).z]; S.frames.forEach((f,i)=>f.cam=s[i]); return r})()")
        check('legacy adjacent keys snap', leg == [2, 3, 3])
        leg2 = await pg.evaluate("(()=>{const s=S.frames.map(f=>f.cam); S.frames[0].cam={z:1,x:540,y:960}; S.frames[1].cam=null; S.frames[2].cam={z:3,x:540,y:960}; const r=[camAt(0).z, camAt(1).z, camAt(2).z]; S.frames.forEach((f,i)=>f.cam=s[i]); return r})()")
        check('legacy keys glide between', leg2[0] == 1 and 1 < leg2[1] < 3 and leg2[2] == 3)
        # 8b) zoom carries on to later frames until the next key; "↩ Bỏ zoom từ đây" ends it; 🗑 removes a key
        await pg.evaluate("S.frames[0].cam=null; S.frames[1].cam={z:2,x:540,y:960,tr:'cut'}; S.frames[2].cam=null; S.camTr='smooth'; S.cur=2; updateFrameUI(); fxSyncBar()")
        check('later frame keeps zoom', abs(await Z(2) - 2) < 0.01)
        check('held badge + status', await pg.evaluate("(S.frames[2].el.querySelector('.camk')||{}).textContent") == '🔍' and 'vẫn zoom' in await pg.inner_text('#camStat'))
        await pg.click('#camWide')
        check('bỏ zoom from here = cut back to wide', await Z(2) == 1 and await Z(2, 0.5) == 1 and await pg.evaluate("S.frames[2].cam.tr") == 'cut' and abs(await Z(1) - 2) < 0.01)
        check('wide badge', await pg.evaluate("S.frames[2].el.querySelector('.camk').textContent") == '🎥↩' and 'toàn cảnh' in await pg.inner_text('#camStat'))
        await pg.click('#fxCamKey'); check('delete key → zoom carries again', await pg.evaluate("S.frames[2].cam") is None and abs(await Z(2) - 2) < 0.01)
        await pg.evaluate("undo()"); check('undo delete', await pg.evaluate("!!S.frames[2].cam"))
        await pg.screenshot(path='tcam_status.png')
        await pg.evaluate("S.camTr='cut'; S.frames[2].cam={z:2.2,x:648,y:768,tr:'cut'}")
        # 9) playback + save/reload
        await pg.click('#playBtn'); await pg.wait_for_timeout(1500); await pg.click('#playBtn')
        await pg.evaluate("S.cur=1; updateFrameUI(); S.frames[1].cam.tr='smooth'; S.frames[1].cam.d=1.5; saveProject()"); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved keys keep transition', await pg.evaluate("S.frames[1].cam && S.frames[1].cam.tr==='smooth' && S.frames[1].cam.d===1.5 && S.frames[2].cam.tr==='cut'"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
