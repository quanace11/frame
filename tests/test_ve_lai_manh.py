import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9131'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✎ Vẽ lại mảnh: redraw a part of a cut-out character (a longer shoe on the shin, fill the shirt, erase, pick a colour).
# The change belongs to the part: every frame shows it, it moves with the rig, undo/redo and save/reload keep it.
PEN='''async ([pts, type])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:type||'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
# doc point of a part-local point (rest coordinates) on the current frame → screen point
W2S = '''([role, lx, ly])=>{ const p=S.pp.parts.find(q=>q.role===role), M=ppMats(ppPoseFor(curFrame()))[p.id], w=mApply(M, lx, ly); return [(w.x*vs+vtx)/DPR,(w.y*vs+vty)/DPR]; }'''
INFO = '''(role)=>{ const p=S.pp.parts.find(q=>q.role===role); return {w:p.c.width,h:p.c.height,ox:p.ox,oy:p.oy,px:p.px,py:p.py,tip:p.tip}; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9131/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose'); ppDrag='box'; ppSel=S.pp.parts.find(q=>!q.parent).id; ppSyncBar()"); await pg.wait_for_timeout(200)
        # 1. ✎ Vẽ lại mảnh with the whole character selected → first tap picks the part
        await pg.click('#ppPaintBtn2'); await pg.wait_for_timeout(200)
        mode = await pg.evaluate('[ppPaint, !document.getElementById("ppPaintBar").hidden]'); print('mode', mode)
        if mode != ['sel', True]: errs.append('paint mode should start by picking a part: %s' % mode)
        shin = await pg.evaluate(INFO, 'shinL')
        mid = [shin['ox'] + shin['w'] / 2, shin['oy'] + shin['h'] / 2]
        await pg.evaluate(PEN, [[await pg.evaluate(W2S, ['shinL', *mid])], 'mouse']); await pg.wait_for_timeout(200)
        r = await pg.evaluate('[ppPaint, ppPart(ppSel).role]'); print('picked', r)
        if r != ['brush', 'shinL']: errs.append('tap did not pick the shin: %s' % r)
        await pg.screenshot(path='ve_lai_manh_0.png')
        # 2. draw a long shoe: from the foot down past the old edge of the picture
        n0 = await pg.evaluate('undoStack.length')
        await pg.evaluate("setColor('#e0218a'); setSize(30)")
        bot = shin['oy'] + shin['h'] - 10; cx = shin['ox'] + shin['w'] / 2
        pts = [await pg.evaluate(W2S, ['shinL', cx - 40 + i * 12, bot + i * 9]) for i in range(16)]
        await pg.evaluate(PEN, [pts]); await pg.wait_for_timeout(900)
        s1 = await pg.evaluate(INFO, 'shinL'); print('shin before', shin, 'after', s1)
        if not (s1['oy'] + s1['h'] > shin['oy'] + shin['h'] + 80): errs.append('picture did not grow past the old edge')
        if s1['px'] != shin['px'] or s1['py'] != shin['py']: errs.append('joint moved')
        steps = await pg.evaluate('undoStack.length') - n0
        last = await pg.evaluate('!!undoStack.at(-1).partpix')
        print('steps', steps, 'partpix', last)
        if steps != 1 or not last: errs.append('one stroke should be exactly 1 undo step (got %s)' % steps)
        png_ok = await pg.evaluate("(()=>{const p=S.pp.parts.find(q=>q.role==='shinL'); return !!p.png && undoStack.at(-1).after.png===p.png})()")
        if not png_ok: errs.append('png not encoded for the new picture')
        # the pink is drawn where the stroke went, in local coords (moves with the rig)
        pink = await pg.evaluate("""(([lx,ly])=>{const p=S.pp.parts.find(q=>q.role==='shinL'); const d=p.c.getContext('2d').getImageData(Math.round(lx-p.ox),Math.round(ly-p.oy),1,1).data; return [...d]})""", [cx - 40 + 7 * 12, bot + 7 * 9])
        print('pink', pink)
        if not (pink[0] > 180 and pink[1] < 90 and pink[3] > 200): errs.append('stroke not on the part picture')
        # 3. every frame shows it, and it follows a new pose: add a frame, bend the shin, the pink stays at the same local spot
        await pg.evaluate("insertFrames(S.cur + 1, [frameCopyOf(curFrame())])"); await pg.wait_for_timeout(200)
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const p=S.pp.parts.find(q=>q.role==='legL'); const f=curFrame(); f.pp[p.id]={...(f.pp[p.id]||{}), r:35}; f.ver++; requestRender();})()"); await pg.wait_for_timeout(300)
        render_pink = await pg.evaluate("""(([lx,ly])=>{const f=curFrame(); const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); drawPuppet(x, ppPoseFor(f), f.lip);
           const p=S.pp.parts.find(q=>q.role==='shinL'), w=mApply(ppMats(ppPoseFor(f))[p.id], lx, ly); return [...x.getImageData(Math.round(w.x),Math.round(w.y),1,1).data]})""", [cx - 40 + 7 * 12, bot + 7 * 9])
        print('frame 2 posed pink', render_pink)
        if not (render_pink[0] > 180 and render_pink[1] < 90): errs.append('the redrawn shoe does not move with the rig on another frame')
        await pg.screenshot(path='ve_lai_manh_1.png')
        # 4. undo / redo
        await pg.click('#ppPaintUndo'); await pg.wait_for_timeout(300)   # the frame bend was not an undo step; this undoes the frame add
        await pg.evaluate("(async()=>{ while(undoStack.length && !undoStack.at(-1).partpix) await undo(); })()"); await pg.wait_for_timeout(300)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        s2 = await pg.evaluate(INFO, 'shinL'); print('after undo', s2)
        if (s2['w'], s2['h'], s2['ox'], s2['oy']) != (shin['w'], shin['h'], shin['ox'], shin['oy']): errs.append('undo did not bring the old shin back')
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        s3 = await pg.evaluate(INFO, 'shinL')
        if (s3['w'], s3['h'], s3['oy']) != (s1['w'], s1['h'], s1['oy']): errs.append('redo did not redraw the shoe')
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(300)
        # 5. 🪣 fill the shirt (torso) with a colour, then 💧 pick it back
        await pg.click('[data-ppt=sel]')
        tor = await pg.evaluate(INFO, 'torso'); tc = [tor['ox'] + tor['w'] / 2, tor['oy'] + tor['h'] * 0.55]
        await pg.evaluate(PEN, [[await pg.evaluate(W2S, ['torso', *tc])], 'mouse']); await pg.wait_for_timeout(200)
        await pg.click('[data-ppt=fill]'); await pg.evaluate("setColor('#22cc44')")
        n1 = await pg.evaluate('undoStack.length')
        await pg.evaluate(PEN, [[await pg.evaluate(W2S, ['torso', *tc])], 'touch']); await pg.wait_for_timeout(600)
        fill = await pg.evaluate("""(([lx,ly])=>{const p=S.pp.parts.find(q=>q.role==='torso'); return [...p.c.getContext('2d').getImageData(Math.round(lx-p.ox),Math.round(ly-p.oy),1,1).data]})""", tc)
        print('fill', fill, 'steps', await pg.evaluate('undoStack.length') - n1)
        if fill[:3] != [0x22, 0xcc, 0x44]: errs.append('fill did not paint the shirt: %s' % fill)
        if await pg.evaluate('undoStack.length') - n1 != 1: errs.append('fill should be 1 undo step')
        await pg.evaluate("setColor('#000000')"); await pg.click('[data-ppt=pick]')
        await pg.evaluate(PEN, [[await pg.evaluate(W2S, ['torso', *tc])], 'touch']); await pg.wait_for_timeout(200)
        r = await pg.evaluate('[S.color, ppPaint]'); print('picked colour', r)
        if r != ['#22cc44', 'brush']: errs.append('colour pick failed: %s' % r)
        # filling the outside (transparent, open to the edge) is refused
        n2 = await pg.evaluate('undoStack.length'); await pg.click('[data-ppt=fill]')
        await pg.evaluate(PEN, [[await pg.evaluate(W2S, ['torso', tor['ox'] - 60, tor['oy'] - 60])], 'touch']); await pg.wait_for_timeout(300)
        if await pg.evaluate('undoStack.length') != n2: errs.append('fill outside the picture should do nothing')
        # 6. ⌫ eraser makes holes
        await pg.click('[data-ppt=erase]'); await pg.evaluate("setSize(40)")
        a0 = await pg.evaluate("(()=>{const p=S.pp.parts.find(q=>q.role==='torso'); return ppAlphaH(p).reduce((s,v)=>s+(v>128),0)})()")
        pts = [await pg.evaluate(W2S, ['torso', tor['ox'] + tor['w'] * (0.2 + i * 0.06), tor['oy'] + tor['h'] * 0.4]) for i in range(11)]
        await pg.evaluate(PEN, [pts]); await pg.wait_for_timeout(500)
        a1 = await pg.evaluate("(()=>{const p=S.pp.parts.find(q=>q.role==='torso'); return ppAlphaH(p).reduce((s,v)=>s+(v>128),0)})()")
        print('erase alpha', a0, a1)
        if not a1 < a0 * 0.97: errs.append('eraser did not erase')
        await pg.screenshot(path='ve_lai_manh_2.png')
        # 7. ✓ Xong, no stray automatic undo step afterwards, and the drawing is saved
        await pg.click('#ppPaintDone'); await pg.wait_for_timeout(1200)
        if await pg.evaluate('ppPaint') is not None: errs.append('✓ Xong did not leave the mode')
        if not await pg.evaluate('!!undoStack.at(-1).partpix'): errs.append('an extra automatic undo step appeared after painting')
        sh = await pg.evaluate(INFO, 'shinL')
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1000)
        await pg.reload(); await pg.wait_for_timeout(1500)
        sh2 = await pg.evaluate(INFO, 'shinL'); print('reloaded shin', sh2)
        if (sh2['w'], sh2['h'], sh2['oy']) != (sh['w'], sh['h'], sh['oy']): errs.append('redrawn shoe not kept after reload')
        print('ERR', errs)
        await b.close()
asyncio.run(main())
