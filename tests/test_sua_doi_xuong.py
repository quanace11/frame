import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
srv = subprocess.Popen(['python3','-m','http.server','9733'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# Sửa và dời xương:
# 1. 🦴 Tạo dáng: the ⟳ knob beside the hips leans the whole character round its root joint (1 undo step), the hips stay put.
# 2. 🔧 Sửa khớp: the root's joint (yellow dot) can be moved; every frame keeps the character exactly where it was
#    (turned / grown / flipped frames too), only the point it turns round changes; undo puts it back.
# 3. 🔧 Sửa khớp shows the drawing without 🫠 Uốn mềm (the joint dots sit on the picture), bones skip a character hidden here.
# 4. 🦴 Xưởng ghép xương: turning / growing / flipping a piece (⟳ knob, buttons) carries its attached pieces, so every
#    joint stays on its parent.
PEN='''async ([pts, type])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:type||'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = '''([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]'''
# world matrices of every piece of the real pose of frame i
MATS = '''(i)=>{ const M=ppMats(ppPoseFor0(S.frames[i])); return S.pp.parts.map(p=>M[p.id].map(v=>Math.round(v*1000)/1000)); }'''
def sheet(path):
    im = Image.new('RGB', (600, 1000), 'white'); d = ImageDraw.Draw(im); ink = (30, 30, 40)
    d.ellipse((210, 40, 390, 220), fill=(255, 214, 170), outline=ink, width=6)
    d.rounded_rectangle((220, 290, 380, 570), 20, fill=(40, 110, 230), outline=ink, width=6)
    d.rounded_rectangle((80, 290, 150, 560), 25, fill=(255, 214, 170), outline=ink, width=6)
    d.rounded_rectangle((450, 290, 520, 560), 25, fill=(255, 214, 170), outline=ink, width=6)
    im.save(path)
async def main():
    sheet(os.path.join(OUT, 'sdx_parts.png'))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9733/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("kitAdd()"); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose'); ppSel=S.pp.parts.find(q=>!q.parent).id; document.querySelector('[data-ppd=\"bone\"]').click()"); await pg.wait_for_timeout(300)
        # 1. ⟳ lean knob
        k = await pg.evaluate("(()=>{ const k=ppLeanKnob(curFrame()); return k && [k.x,k.y,k.w.x,k.w.y]; })()")
        if not k: errs.append('no ⟳ lean knob in 🦴 Tạo dáng'); k = [0, 0, 0, 0]
        n0 = await pg.evaluate("undoStack.length")
        s0 = await pg.evaluate(D2S, [k[0], k[1]]); c = await pg.evaluate(D2S, [k[2], k[3]])
        # turn the knob 25° round the hips (clockwise on screen)
        import math
        rr = math.hypot(s0[0] - c[0], s0[1] - c[1]); a0 = math.atan2(s0[1] - c[1], s0[0] - c[0])
        pts = [[c[0] + rr * math.cos(a0 + math.radians(25) * t / 10), c[1] + rr * math.sin(a0 + math.radians(25) * t / 10)] for t in range(11)]
        await pg.evaluate(PEN, [pts, 'touch' if False else 'pen']); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(()=>{ const root=S.pp.parts.find(q=>!q.parent), q=curFrame().pp[root.id]||{}, w=mApply(ppMats(ppPoseFor(curFrame()))[root.id], root.px, root.py); return [q.r||0, w.x, w.y]; })()")
        n1 = await pg.evaluate("undoStack.length")
        print('lean', r, 'hips was', k[2:], 'undo', n0, '->', n1)
        if not (20 < r[0] < 30): errs.append('the ⟳ knob should lean the character ~25°: %s' % r[0])
        if abs(r[1] - k[2]) > 1 or abs(r[2] - k[3]) > 1: errs.append('leaning moved the hips')
        if n1 != n0 + 1: errs.append('leaning should be 1 undo step: %s -> %s' % (n0, n1))
        await pg.screenshot(path='sdx_1_lean.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        if abs(await pg.evaluate("(curFrame().pp[S.pp.parts.find(q=>!q.parent).id]||{}).r||0")) > 0.01: errs.append('undo did not take the lean back')
        # 2. 🔧 Sửa khớp: move the root joint; frame 1 plain, frame 2 turned + grown + flipped
        await pg.evaluate("""(async()=>{ const root=S.pp.parts.find(q=>!q.parent), f=frameCopyOf(curFrame()); f.pp[root.id]={...(f.pp[root.id]||{}), r:30, sx:1.4, sy:1.2, dx:15, fl:true}; insertFrames(1,[f]); selectFrame(0); })()""")
        await pg.wait_for_timeout(700)
        m0 = [await pg.evaluate(MATS, i) for i in range(2)]
        await pg.click('#ppJointBtn'); await pg.wait_for_timeout(300)
        root = await pg.evaluate("(()=>{ const r=S.pp.parts.find(q=>!q.parent); return [r.px, r.py]; })()")
        w = await pg.evaluate("(()=>{ const r=S.pp.parts.find(q=>!q.parent), w=mApply(ppMats(ppPoseFor(curFrame()))[r.id], r.px, r.py); return [w.x,w.y]; })()")
        s = await pg.evaluate(D2S, w)
        await pg.evaluate(PEN, [[s] + [[s[0], s[1] + 4 * t] for t in range(1, 11)], 'pen']); await pg.wait_for_timeout(700)
        root1 = await pg.evaluate("(()=>{ const r=S.pp.parts.find(q=>!q.parent); return [r.px, r.py]; })()")
        m1 = [await pg.evaluate(MATS, i) for i in range(2)]
        print('root joint', root, '->', root1)
        if not (root1[1] - root[1] > 10): errs.append('dragging the yellow root dot in 🔧 Sửa khớp did not move the root joint')
        def same(A, B): return all(abs(x - y) < 0.05 for a, b in zip(A, B) for x, y in zip(a, b))
        for i in range(2):
            if not same(m0[i], m1[i]): errs.append('moving the root joint moved the character on frame %d' % (i + 1))
        await pg.evaluate("ppJEStop(); histCheck(true)"); await pg.wait_for_timeout(300)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        root2 = await pg.evaluate("(()=>{ const r=S.pp.parts.find(q=>!q.parent); return [r.px, r.py]; })()")
        if abs(root2[1] - root[1]) > 0.5: errs.append('undo did not put the root joint back: %s' % root2)
        if not same(m0[1], await pg.evaluate(MATS, 1)): errs.append('undo of the root joint broke frame 2')
        # 3. 🫠 pins on this frame: 🔧 Sửa khớp draws the plain picture; bones of a character hidden here are not drawn
        await pg.evaluate("""(()=>{ const root=S.pp.parts.find(q=>!q.parent), f=curFrame(); f.lip=f.lip||{}; f.lip.bw={[root.id]:{p:[{x:root.px,y:root.py-200,dx:160,dy:0}], k:'still'}}; f.ver++; })()""")
        await pg.click('#ppJointBtn'); await pg.wait_for_timeout(300)
        calls = await pg.evaluate("""(()=>{ let got=null; const o=window.bwDraw; window.bwDraw=(...a)=>{ got=true; return o(...a); }; try { render(); } finally { window.bwDraw=o; } return got; })()""")
        if calls: errs.append('🔧 Sửa khớp still draws the 🫠 warp (joint dots land off the picture)')
        await pg.evaluate("ppJEStop()")
        lk = await pg.evaluate("(()=>{ const root=S.pp.parts.find(q=>!q.parent), f=curFrame(); f.lip.bw=null; f.lip.off={[root.id]:1}; return ppLeanKnob(f); })()")
        if lk: errs.append('⟳ knob shown for a character hidden on this frame')
        await pg.evaluate("curFrame().lip.off=null")
        # 4. 🦴 Xưởng ghép xương: the knob carries the attached pieces
        await pg.evaluate("rsOpen()"); await pg.wait_for_timeout(400)
        await pg.set_input_files('#rsFile', os.path.join(OUT, 'sdx_parts.png')); await pg.wait_for_timeout(1500)
        await pg.evaluate("""(()=>{ const by=[...RS.pcs].sort((a,b)=>b.c.width*b.c.height-a.c.width*a.c.height), body=by[0];
          for (const p of RS.pcs) if (p!==body) { p.parent=body.id; p.jx=p.c.width/2; p.jy=10; }
          RS.sel=body.id; RS.mode='arrange'; rsSync(); rsDraw(); })()""")
        LOC = """(()=>{ const body=rsPc(RS.sel); return RS.pcs.filter(p=>p.parent===body.id).map(p=>{ const j=rsJD(p), l=mApply(mInv(rsA(body)), j.x, j.y); return [l.x, l.y]; }); })()"""
        l0 = await pg.evaluate(LOC)
        kb = await pg.evaluate("(()=>{ const p=rsPc(RS.sel), {M}=rsMats(), k=rsKnob(p,M[p.id]), r=RS.cv.getBoundingClientRect(); return [r.left+k.x/DPR, r.top+k.y/DPR, r.left+mApply(RS.vw,p.x,p.y).x/DPR, r.top+mApply(RS.vw,p.x,p.y).y/DPR]; })()")
        rr = math.hypot(kb[0] - kb[2], kb[1] - kb[3]); a0 = math.atan2(kb[1] - kb[3], kb[0] - kb[2])
        pts = [[kb[2] + rr * (1 + 0.03 * t) * math.cos(a0 + math.radians(4 * t)), kb[3] + rr * (1 + 0.03 * t) * math.sin(a0 + math.radians(4 * t))] for t in range(11)]
        await pg.evaluate("""async (pts)=>{ const cv=RS.cv, mk=(t,x,y)=>new PointerEvent(t,{pointerId:3,pointerType:'pen',clientX:x,clientY:y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
          cv.dispatchEvent(mk('pointerdown',...pts[0])); for (const q of pts.slice(1)) { cv.dispatchEvent(mk('pointermove',...q)); await new Promise(r=>setTimeout(r,5)); } cv.dispatchEvent(mk('pointerup',...pts.at(-1))); }""", pts)
        await pg.wait_for_timeout(200)
        body = await pg.evaluate("(()=>{ const p=rsPc(RS.sel); return [p.r, p.s]; })()")
        l1 = await pg.evaluate(LOC)
        print('studio knob', body, l0, l1)
        if not (abs(body[0]) > 20): errs.append('the studio knob did not turn the body: %s' % body)
        if any(abs(a[0] - c[0]) > 0.5 or abs(a[1] - c[1]) > 0.5 for a, c in zip(l0, l1)): errs.append('turning the body left the arms/head behind (joints off the body)')
        for k in ['rr', 'bg', 'flip']:
            await pg.evaluate("rsBtn('%s')" % k)
            l2 = await pg.evaluate(LOC)
            if any(abs(a[0] - c[0]) > 0.5 or abs(a[1] - c[1]) > 0.5 for a, c in zip(l0, l2)): errs.append('button %s left the attached pieces behind' % k)
        await pg.screenshot(path='sdx_4_studio.png')
        await pg.evaluate("rsUndo()")
        print('ERR', errs)
        await b.close()
asyncio.run(main())
