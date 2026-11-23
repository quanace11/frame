import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9171'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🔧 Sửa khớp: after cutting, the character shows its rest pose, joints are dragged to a new place (undo restores),
# 🔄 Thử cử động swings the limbs, ◯ Bo tròn khớp closes the gap that opens at a bent knee (1 undo step),
# ✎ Vẽ chỗ khớp paints on the piece in that view, ✓ Xong brings the frame's pose back.
PEN='''async ([pts, type])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:type||'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
W2S = '''([role, lx, ly])=>{ const p=S.pp.parts.find(q=>q.role===role), M=ppMats(ppPoseFor(curFrame()))[p.id], w=mApply(M, lx, ly); return [(w.x*vs+vtx)/DPR,(w.y*vs+vty)/DPR]; }'''
INFO = '''(role)=>{ const p=S.pp.parts.find(q=>q.role===role); return {w:p.c.width,h:p.c.height,ox:p.ox,oy:p.oy,px:p.px,py:p.py,tip:p.tip,z:p.z}; }'''
# transparent pixels round the knee when the shin is bent 70° (real pose, not the rest view)
HOLES = '''(()=>{ const sh=S.pp.parts.find(q=>q.role==='shinL'), f=curFrame(), P=JSON.parse(JSON.stringify(ppPoseFor0(f)||{}));
  P[sh.id]={...(P[sh.id]||{}), r:70}; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); const was=S.ppSoft; S.ppSoft=false; drawPuppet(x, P, null); S.ppSoft=was;
  const w=mApply(ppMats(P)[sh.id], sh.px, sh.py), R=ppJECapR(sh)*0.7, d=x.getImageData(0,0,W,H).data; let n=0, t=0;
  for(let y=Math.floor(w.y-R); y<=w.y+R; y++) for(let X=Math.floor(w.x-R); X<=w.x+R; X++){ if(Math.hypot(X-w.x,y-w.y)>R) continue; t++; if(d[(y*W+X)*4+3]<50) n++; }
  return [n, t]; })()'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9171/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose'); ppDrag='box'; ppSel=S.pp.parts.find(q=>!q.parent).id; ppSyncBar()"); await pg.wait_for_timeout(200)
        # like a hand cut: thigh and shin cut straight across at the knee (no overlap), and the frame has a bent knee
        await pg.evaluate("""(()=>{ const sh=S.pp.parts.find(q=>q.role==='shinL'), lg=S.pp.parts.find(q=>q.role==='legL'), ky=sh.py;
          for (const [p, keep] of [[sh, y=>y>=ky], [lg, y=>y<ky]]) { const c=document.createElement('canvas'); c.width=p.c.width; c.height=p.c.height; const x=c.getContext('2d'); x.drawImage(p.c,0,0);
            const d=x.getImageData(0,0,c.width,c.height); for(let y=0;y<c.height;y++) if(!keep(p.oy+y+0.5)) for(let X=0;X<c.width;X++) d.data[(y*c.width+X)*4+3]=0; x.putImageData(d,0,0); p.c=c; p.png=null; p.alpha=null; encodePart(p); }
          const f=curFrame(); f.pp=f.pp||{}; f.pp[sh.id]={...(f.pp[sh.id]||{}), r:40}; S.frames.forEach(fr=>fr.ver++); scheduleSave(); requestRender(); })()""")
        await pg.wait_for_timeout(700)
        # 1. 🔧 Sửa khớp: rest pose in the view, bar shown
        await pg.click('#ppJointBtn'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("[!!ppJE, !document.getElementById('ppJointBar').hidden, ppPoseFor(curFrame())[S.pp.parts.find(q=>q.role==='shinL').id].r, (curFrame().pp[S.pp.parts.find(q=>q.role==='shinL').id]||{}).r]")
        print('joint mode', r)
        if r != [True, True, 0, 40]: errs.append('🔧 Sửa khớp should show the rest pose without changing the frame: %s' % r)
        await pg.screenshot(path='sua_khop_0.png')
        # 2. drag the knee joint 30 px (screen) down
        sh = await pg.evaluate(INFO, 'shinL'); leg = await pg.evaluate(INFO, 'legL')
        s0 = await pg.evaluate(W2S, ['shinL', sh['px'], sh['py']])
        await pg.evaluate(PEN, [[s0] + [[s0[0], s0[1] + k * 3] for k in range(1, 11)], 'mouse']); await pg.wait_for_timeout(700)
        sh1 = await pg.evaluate(INFO, 'shinL'); leg1 = await pg.evaluate(INFO, 'legL')
        print('knee', sh['px'], sh['py'], '->', sh1['px'], sh1['py'], 'leg tip', leg['tip'], '->', leg1['tip'])
        if not (sh1['py'] - sh['py'] > 5 and abs(sh1['px'] - sh['px']) < 3): errs.append('dragging the joint dot did not move the knee down')
        if leg['tip'] and abs(leg['tip']['x'] - sh['px']) < 3 and abs(leg['tip']['y'] - sh['py']) < 3 and abs(leg1['tip']['y'] - sh1['py']) > 1: errs.append('the thigh tip did not follow the knee')
        if (sh1['w'], sh1['ox']) != (sh['w'], sh['ox']): errs.append('moving a joint changed the picture')
        sel = await pg.evaluate("ppPart(ppSel).role")
        if sel != 'shinL': errs.append('dragging the knee should select the shin: %s' % sel)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        sh2 = await pg.evaluate(INFO, 'shinL'); print('after undo', sh2['px'], sh2['py'])
        if abs(sh2['py'] - sh['py']) > 0.01: errs.append('undo did not put the knee back')
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        sh3 = await pg.evaluate(INFO, 'shinL')
        if abs(sh3['py'] - sh1['py']) > 0.01: errs.append('redo did not move the knee again')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        # 3. 🔄 Thử cử động swings the limbs
        await pg.click('#ppJEWig'); await pg.wait_for_timeout(450)
        rs = await pg.evaluate("(()=>{const P=ppPoseFor(curFrame()); return ['shinL','armL','foreR'].map(r=>Math.abs(P[S.pp.parts.find(q=>q.role===r).id].r||0))})()")
        print('wiggle', rs)
        if not all(x > 1 for x in rs): errs.append('🔄 Thử cử động did not swing the limbs: %s' % rs)
        await pg.screenshot(path='sua_khop_1.png')
        await pg.click('#ppJEWig'); await pg.wait_for_timeout(200)
        # 4. ◯ Bo tròn khớp this knee: the gap at a bent knee closes, 1 undo step
        h0 = await pg.evaluate(HOLES); print('holes before', h0)
        n0 = await pg.evaluate('undoStack.length')
        await pg.evaluate("ppSel=S.pp.parts.find(q=>q.role==='shinL').id; ppSyncBar()")
        await pg.click('#ppJERound'); await pg.wait_for_timeout(800)
        h1 = await pg.evaluate(HOLES); print('holes after', h1)
        if h0[0] < 20 or h1[0] > max(2, h0[0] * 0.1): errs.append('◯ Bo tròn khớp did not close the knee gap: %s -> %s' % (h0, h1))
        st = await pg.evaluate("[undoStack.length, !!(undoStack.at(-1).partpix || (undoStack.at(-1).multi||[]).every(e=>e.partpix))]")
        print('round undo', st[0] - n0, st[1])
        if st[0] - n0 != 1 or not st[1]: errs.append('round joint should be exactly 1 partpix undo step')
        png_ok = await pg.evaluate("S.pp.parts.every(p=>!!p.png)")
        if not png_ok: errs.append('png not encoded after rounding')
        await pg.screenshot(path='sua_khop_2.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        h2 = await pg.evaluate(HOLES); sh4 = await pg.evaluate(INFO, 'shinL'); lg4 = await pg.evaluate(INFO, 'legL')
        print('after undo', h2)
        if h2 != h0 or (sh4['w'], sh4['h'], sh4['ox'], lg4['w'], lg4['h']) != (sh['w'], sh['h'], sh['ox'], leg['w'], leg['h']): errs.append('undo did not bring the old pictures back')
        # 5. ◯ every limb joint: one undo step
        n1 = await pg.evaluate('undoStack.length')
        await pg.click('#ppJERoundAll'); await pg.wait_for_timeout(900)
        k = await pg.evaluate("[undoStack.length, (undoStack.at(-1).multi||[]).length]"); print('round all', k[0] - n1, k[1])
        if k[0] - n1 != 1 or k[1] < 4: errs.append('round all should be 1 undo step over several pieces: %s' % k)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        # 6. ✎ Vẽ chỗ khớp: paint on the shin in the rest view (1 partpix step)
        await pg.evaluate("ppSel=S.pp.parts.find(q=>q.role==='shinL').id; ppSyncBar()")
        await pg.click('#ppJEPaint'); await pg.wait_for_timeout(200)
        m = await pg.evaluate("[ppPaint, !!ppJE, !document.getElementById('ppPaintBar').hidden]"); print('paint', m)
        if m != ['brush', True, True]: errs.append('✎ Vẽ chỗ khớp should paint the shin inside joint mode: %s' % m)
        n2 = await pg.evaluate('undoStack.length')
        await pg.evaluate("setColor('#e0218a'); setSize(20)")
        pts = [await pg.evaluate(W2S, ['shinL', sh['px'] - 20 + i * 4, sh['py'] + 6]) for i in range(11)]
        await pg.evaluate(PEN, [pts]); await pg.wait_for_timeout(800)
        k = await pg.evaluate("[undoStack.length, !!undoStack.at(-1).partpix, undoStack.at(-1).pid===S.pp.parts.find(q=>q.role==='shinL').id]"); print('paint undo', k)
        if k[0] - n2 != 1 or not k[1] or not k[2]: errs.append('painting the joint should be 1 partpix step on the shin: %s' % k)
        pink = await pg.evaluate("""(([lx,ly])=>{const p=S.pp.parts.find(q=>q.role==='shinL'); const d=p.c.getContext('2d').getImageData(Math.round(lx-p.ox),Math.round(ly-p.oy),1,1).data; return [...d]})""", [sh['px'], sh['py'] + 6])
        print('pink', pink)
        if not (pink[0] > 180 and pink[1] < 90 and pink[3] > 200): errs.append('the stroke did not land on the shin at the knee')
        # 7. ✓ Xong: the frame's own pose is back
        await pg.click('#ppJEDone'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("[!!ppJE, ppPaint, document.getElementById('ppJointBar').hidden, ppPoseFor(curFrame())[S.pp.parts.find(q=>q.role==='shinL').id].r]")
        print('done', r)
        if r != [False, None, True, 40]: errs.append('✓ Xong should leave joint mode and show the pose again: %s' % r)
        # 8. switching to another drag mode also leaves it
        await pg.click('#ppJointBtn'); await pg.click('[data-ppd=bone]'); await pg.wait_for_timeout(200)
        if await pg.evaluate('!!ppJE'): errs.append('🦴 Tạo dáng did not leave joint mode')
        await pg.screenshot(path='sua_khop_3.png')
        # 9. 🦴 gập thử khớp while redrawing a piece: dots on the joints, tap the knee, drag the knob = the shin bends (preview only)
        await pg.evaluate("ppDrag='box'; ppSel=S.pp.parts.find(q=>q.role==='shinL').id; ppSyncBar()")
        await pg.click('#ppPaintBtn2'); await pg.wait_for_timeout(200)
        if await pg.evaluate('ppPaint') != 'brush': errs.append('paint should start on the selected shin')
        KNEE = '''(()=>{const p=S.pp.parts.find(q=>q.role==='shinL'), f=curFrame(), w=mApply(ppMats(ppPoseFor(f))[p.id], p.px, p.py); return [(w.x*vs+vtx)/DPR,(w.y*vs+vty)/DPR]})()'''
        kn = await pg.evaluate(KNEE)
        n3 = await pg.evaluate('undoStack.length')
        await pg.evaluate(PEN, [[kn], 'touch' if False else 'pen']); await pg.wait_for_timeout(200)
        r = await pg.evaluate("[ppPrevJ===S.pp.parts.find(q=>q.role==='shinL').id, undoStack.length]"); print('tap knee', r)
        if not r[0] or r[1] != n3: errs.append('tapping the knee dot should pick the joint, not paint: %s' % r)
        kb = await pg.evaluate("(()=>{const k=ppPrevKnob(curFrame(), ppPart(ppPrevJ)); return [(k.x*vs+vtx)/DPR,(k.y*vs+vty)/DPR, (k.w.x*vs+vtx)/DPR,(k.w.y*vs+vty)/DPR]})()")
        import math
        cx, cy = kb[2], kb[3]; a0 = math.atan2(kb[1] - cy, kb[0] - cx); R = math.hypot(kb[0] - cx, kb[1] - cy)
        pts = [[cx + R * math.cos(a0 + math.radians(6 * k)), cy + R * math.sin(a0 + math.radians(6 * k))] for k in range(0, 11)]
        await pg.evaluate(PEN, [pts]); await pg.wait_for_timeout(300)
        r = await pg.evaluate("(()=>{const id=S.pp.parts.find(q=>q.role==='shinL').id; return [Math.round(ppPrev[id]||0), Math.round(ppPoseFor(curFrame())[id].r), curFrame().pp[id].r, undoStack.length]})()")
        print('bend preview', r)
        if not (55 <= r[0] <= 65 and 95 <= r[1] <= 105 and r[2] == 40 and r[3] == n3): errs.append('dragging the knob should bend the shin only as a preview: %s' % r)
        await pg.screenshot(path='sua_khop_4.png')
        # paint on the bent shin: the stroke lands at the right spot of the shin picture
        loc = [sh['px'] + 6, sh['py'] + 40]
        tgt = await pg.evaluate(W2S, ['shinL', *loc])
        await pg.evaluate("setColor('#20c020'); setSize(14)")
        await pg.evaluate(PEN, [[[tgt[0] - 3, tgt[1]], [tgt[0], tgt[1]], [tgt[0] + 3, tgt[1]]]]); await pg.wait_for_timeout(700)
        g = await pg.evaluate('''(([lx,ly])=>{const p=S.pp.parts.find(q=>q.role==='shinL'); const d=p.c.getContext('2d').getImageData(Math.round(lx-p.ox),Math.round(ly-p.oy),1,1).data; return [...d]})''', loc)
        print('green on bent shin', g, await pg.evaluate('undoStack.length') - n3)
        if not (g[1] > 150 and g[0] < 90): errs.append('painting on the bent shin did not land on the shin picture')
        await pg.click('#ppPrevReset'); await pg.wait_for_timeout(200)
        r = await pg.evaluate("Object.keys(ppPrev).length + ' ' + ppPoseFor(curFrame())[S.pp.parts.find(q=>q.role==='shinL').id].r")
        if r != '0 40': errs.append('↺ Dáng cũ did not reset the preview: %s' % r)
        await pg.evaluate("ppPrev[S.pp.parts.find(q=>q.role==='armL').id]=30"); await pg.click('#ppPaintDone'); await pg.wait_for_timeout(200)
        if await pg.evaluate('Object.keys(ppPrev).length'): errs.append('ending the redraw should drop the preview bend')
        await b.close()
        print('ERR', errs)
asyncio.run(main())
