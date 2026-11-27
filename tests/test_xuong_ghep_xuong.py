import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
srv = subprocess.Popen(['python3','-m','http.server','9611'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🦴 Xưởng ghép xương: a picture with the body parts drawn apart on white paper → 6 pieces (paper gone), pieces dragged
# together, 🪄 Tự gắn xương (head / arms / legs on the body + roles), a joint dragged, a stroke painted on a piece, ✂ Khoanh
# tách (forearm off the arm), workshop undo, ✓ Xong → a character with bones in the project (1 undo step), the draft
# survives closing, and ✏ Sửa nhân vật này opens it again: a moved joint is written back with the same part ids.
def sheet(path):
    im = Image.new('RGB', (600, 1000), 'white'); d = ImageDraw.Draw(im); ink = (30, 30, 40)
    d.ellipse((210, 40, 390, 220), fill=(255, 214, 170), outline=ink, width=6)      # head
    d.ellipse((260, 110, 280, 130), fill=ink); d.ellipse((320, 110, 340, 130), fill=ink)
    d.rounded_rectangle((220, 290, 380, 570), 20, fill=(40, 110, 230), outline=ink, width=6)   # body
    d.rounded_rectangle((80, 290, 150, 560), 25, fill=(255, 214, 170), outline=ink, width=6)   # arm (screen left)
    d.rounded_rectangle((450, 290, 520, 560), 25, fill=(255, 214, 170), outline=ink, width=6)  # arm (screen right)
    d.rounded_rectangle((225, 640, 290, 950), 25, fill=(30, 30, 60), outline=ink, width=6)     # legs
    d.rounded_rectangle((310, 640, 375, 950), 25, fill=(30, 30, 60), outline=ink, width=6)
    im.save(path)
async def main():
    sheet(os.path.join(OUT, 'xuong_parts.png'))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9611/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("(()=>{document.getElementById('menuBtn').click(); document.querySelector('.ov [data-m=\"rigstudio\"]').click();})()"); await pg.wait_for_timeout(500)
        if not await pg.evaluate("!!RS && !!document.getElementById('rsWrap')"): errs.append('Menu → 🦴 did not open the workshop')
        await pg.set_input_files('#rsFile', os.path.join(OUT, 'xuong_parts.png')); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""(()=>{ const c=RS.pcs.map(p=>{ const a=rsAlpha(p.c); let t=0; for(const v of a) if(v>30) t++; const d=p.c.getContext('2d').getImageData(0,0,p.c.width,p.c.height).data; let w=0; for(let i=0;i<d.length;i+=4) if(d[i+3]>200&&d[i]>240&&d[i+1]>240&&d[i+2]>240) w++; return [t,w]; }); return {n:RS.pcs.length, c}; })()""")
        print('pieces', r['n'], r['c'])
        if r['n'] != 6: errs.append('the sheet should give 6 pieces: %s' % r['n'])
        if any(w > 30 for t, w in r['c']): errs.append('white paper left on a piece: %s' % r['c'])
        await pg.screenshot(path='xuong_0_nhap.png')
        # 1. drag the pieces together (the canvas, like a finger): head down onto the body, arms + legs next to it
        D2S = """([x,y])=>{ const r=RS.cv.getBoundingClientRect(), q=mApply(RS.vw,x,y); return [r.left+q.x/DPR, r.top+q.y/DPR]; }"""
        info = await pg.evaluate("RS.pcs.map(p=>({id:p.id,x:p.x,y:p.y,n:rsAlpha(p.c).filter(v=>v>30).length,w:p.c.width*p.s,h:p.c.height*p.s}))")
        info.sort(key=lambda q: q['y'])
        head = info[0]; body = [q for q in info if abs(q['x'] - 540) < 60 and q is not head][0]
        bx, by, bw, bh = body['x'], body['y'], body['w'], body['h']
        async def drag(src, dst, kind='touch'):
            a = await pg.evaluate(D2S, src); z = await pg.evaluate(D2S, dst)
            await pg.evaluate("""async ([a,z,kind])=>{ const cv=RS.cv, mk=(t,x,y)=>new PointerEvent(t,{pointerId:3,pointerType:kind,clientX:x,clientY:y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
              cv.dispatchEvent(mk('pointerdown',a[0],a[1])); for(let k=1;k<=12;k++){ cv.dispatchEvent(mk('pointermove',a[0]+(z[0]-a[0])*k/12,a[1]+(z[1]-a[1])*k/12)); await new Promise(r=>setTimeout(r,5)); } cv.dispatchEvent(mk('pointerup',z[0],z[1])); }""", [a, z, kind])
            await pg.wait_for_timeout(120)
        await drag([head['x'], head['y']], [bx, by - bh / 2 - head['h'] / 2 + 25])
        for q in info:
            if q is head or q is body: continue
            if q['y'] < by + bh / 2:   # arms: their top overlaps the shoulder
                side = -1 if q['x'] < bx else 1
                await drag([q['x'], q['y']], [bx + side * (bw / 2 + q['w'] / 2 - 16), by - bh / 2 + q['h'] / 2 + 6])
            else:
                side = -1 if q['x'] < bx else 1
                await drag([q['x'], q['y']], [bx + side * bw * 0.22, by + bh / 2 + q['h'] / 2 - 22])
        moved = await pg.evaluate("RS.undo.length")
        if moved < 5: errs.append('dragging pieces should each be one workshop undo step: %s' % moved)
        # 2. 🦴 Xương → 🪄 Tự gắn xương
        await pg.click('[data-rsm="bone"]'); await pg.click('[data-rsa="auto"]'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("(()=>{ const roots=rsRoots(); return {roots:roots.map(p=>p.role), roles:RS.pcs.map(p=>p.role).sort(), par:RS.pcs.map(p=>p.parent?rsPc(p.parent).role:null)}; })()")
        print('auto bone', r)
        if len(r['roots']) != 1 or r['roots'][0] != 'torso': errs.append('one root (the body) after auto bone: %s' % r)
        if sorted(r['roles']) != sorted(['torso', 'head', 'armL', 'armR', 'legL', 'legR']): errs.append('roles guessed wrong: %s' % r['roles'])
        if any(x not in (None, 'torso') for x in r['par']): errs.append('every piece should hang on the body: %s' % r['par'])
        await pg.screenshot(path='xuong_1_xuong.png')
        # 3. drag the left arm's joint dot 30 px lower
        j0 = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='armL'); return rsJD(p); })()")
        top = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='armL'), c=rsCorners(rsA(p),p.c); return [Math.min(...c.map(q=>q.y)), Math.max(...c.map(q=>q.y))]; })()")
        if not (j0['y'] - top[0] < (top[1] - top[0]) * 0.25): errs.append('the shoulder joint should sit at the top of the arm (arm lying along the body): %s %s' % (j0, top))
        await drag([j0['x'], j0['y']], [j0['x'], j0['y'] + 30], 'pen')
        j1 = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='armL'); return rsJD(p); })()")
        print('joint', j0, '->', j1)
        if not (abs(j1['y'] - j0['y'] - 30) < 3 and abs(j1['x'] - j0['x']) < 3): errs.append('joint drag did not move the shoulder')
        # 4. drag from a loose piece onto another = attach (unlink the right leg first, then link it to the left leg)
        await pg.evaluate("RS.sel=RS.pcs.find(q=>q.role==='legR').id; rsAct('unlink')")
        lr = await pg.evaluate("(()=>{ const a=RS.pcs.find(q=>q.role==='legR'), b=RS.pcs.find(q=>q.role==='legL'); return [a.x,a.y-a.c.height*a.s*0.4,b.x,b.y]; })()")
        await drag([lr[0], lr[1]], [lr[2], lr[3]], 'pen')
        r = await pg.evaluate("(()=>{ const a=RS.pcs.find(q=>q.role==='legR'); return [rsPc(a.parent)&&rsPc(a.parent).role, rsJD(a)]; })()")
        if r[0] != 'legL' or abs(r[1]['y'] - lr[1]) > 3: errs.append('drag piece→piece should attach with the joint at the start: %s' % r)
        await pg.click('#rsUndo'); await pg.click('#rsUndo'); await pg.wait_for_timeout(100)
        r = await pg.evaluate("(()=>{ const a=RS.pcs.find(q=>q.role==='legR'); return rsPc(a.parent)&&rsPc(a.parent).role; })()")
        if r != 'torso': errs.append('two workshop undos should bring the leg back on the body: %s' % r)
        # 5. ✂ Khoanh tách: the lower half of the left arm becomes a forearm joined at the cut
        await pg.click('[data-rsm="arrange"]')
        arm = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='armL'); RS.sel=p.id; rsSync(); const c=rsCorners(rsA(p),p.c); return c; })()")
        await pg.click('[data-rsa="cut"]')
        x0 = min(c['x'] for c in arm) - 20; x1 = max(c['x'] for c in arm) + 20; ym = (min(c['y'] for c in arm) + max(c['y'] for c in arm)) / 2; y1 = max(c['y'] for c in arm) + 20
        pts = [[x0, ym], [x1, ym], [x1, y1], [x0, y1], [x0, ym + 2]]
        sp = [await pg.evaluate(D2S, q) for q in pts]
        await pg.evaluate("""async (pts)=>{ const cv=RS.cv, mk=(t,x,y)=>new PointerEvent(t,{pointerId:4,pointerType:'pen',clientX:x,clientY:y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
          cv.dispatchEvent(mk('pointerdown',...pts[0])); for(let i=1;i<pts.length;i++) for(let k=1;k<=8;k++){ cv.dispatchEvent(mk('pointermove',pts[i-1][0]+(pts[i][0]-pts[i-1][0])*k/8,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*k/8)); await new Promise(r=>setTimeout(r,3)); } cv.dispatchEvent(mk('pointerup',...pts.at(-1))); }""", sp)
        await pg.wait_for_timeout(300)
        r = await pg.evaluate("(()=>{ const f=RS.pcs.find(p=>/tách/.test(p.name)); if(!f) return null; const j=rsJD(f); return {n:RS.pcs.length, par:rsPc(f.parent).role, jy:j.y}; })()")
        print('cut', r)
        if not r or r['n'] != 7 or r['par'] != 'armL' or abs(r['jy'] - ym) > 12: errs.append('✂ Khoanh tách should make a forearm joined at the cut: %s' % r)
        else: await pg.evaluate("(()=>{ const f=RS.pcs.find(p=>/tách/.test(p.name)); RS.sel=f.id; rsEdit(p=>{p.role='foreL'; p.name='Cẳng tay trái';}); })()")
        # 6. ✎ Vẽ: a red stroke across the head, drawn past its edge (the piece grows)
        await pg.click('[data-rsm="paint"]')
        hd = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='head'); RS.sel=p.id; rsSync(); return {x:p.x,y:p.y,w:p.c.width*p.s,cw:p.c.width,ch:p.c.height}; })()")
        await pg.evaluate("setColor('#ff0000')")
        await drag([hd['x'] - hd['w'] * 0.3, hd['y']], [hd['x'] + hd['w'] * 0.75, hd['y']], 'pen')
        r = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='head'), d=p.c.getContext('2d').getImageData(0,0,p.c.width,p.c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]>200&&d[i+1]<60&&d[i+2]<60&&d[i+3]>200) n++; return [n,p.c.width,p.c.height]; })()")
        print('paint', r, hd)
        if r[0] < 200: errs.append('the stroke did not paint the head: %s' % r)
        if r[1] <= hd['cw']: errs.append('painting past the edge should widen the piece: %s' % r)
        await pg.screenshot(path='xuong_2_ve.png')
        # 7. 🤸 Thử: bend the left arm (preview only)
        await pg.click('[data-rsm="pose"]')
        a = await pg.evaluate("(()=>{ const p=RS.pcs.find(q=>q.role==='armL'), J=rsJD(p); return [J.x,J.y,p.x,p.y]; })()")
        await drag([a[0], a[1] + 60], [a[0] - 160, a[1] + 20], 'pen')
        r = await pg.evaluate("RS.pose[RS.pcs.find(q=>q.role==='armL').id]||0")
        if abs(r) < 20: errs.append('🤸 drag should bend the arm: %s' % r)
        await pg.screenshot(path='xuong_3_thu.png')
        await pg.click('[data-rsa="rest"]')
        # 8. close + open again: the draft is still there
        await pg.click('#rsClose'); await pg.wait_for_timeout(600)
        if await pg.evaluate("!!RS"): errs.append('✕ should close the workshop')
        await pg.evaluate("rsOpen()"); await pg.wait_for_timeout(800)
        r = await pg.evaluate("[RS.pcs.length, RS.pcs.filter(p=>p.parent).length, RS.pcs.map(p=>p.role).sort().join(',')]")
        print('draft', r)
        if r[0] != 7 or r[1] != 6: errs.append('the draft should come back with pieces + bones: %s' % r)
        # 9. ✓ Xong → character in the project
        nf = await pg.evaluate("S.frames.length")
        await pg.click('#rsDone'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=✓ Tạo nhân vật'); await pg.wait_for_timeout(1500)
        for k in range(3):
            if await pg.evaluate("!!document.querySelector('.ov')"): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("""(()=>{ const ps=S.pp.parts; const root=ps.find(p=>!p.parent); return {n:ps.length, roots:ps.filter(p=>!p.parent).length, lname:root.lname, hard:ps.every(p=>p.hard),
          roles:ps.map(p=>p.role).sort().join(','), studio:!!RS, tool:S.tool, png:ps.every(p=>p.png), fore:(()=>{const f=ps.find(p=>p.role==='foreL'); return f && ps.find(q=>q.id===f.parent).role;})(), tipArm:(()=>{const a=ps.find(p=>p.role==='armL'), f=ps.find(p=>p.role==='foreL'); return Math.hypot(a.tip.x-f.px,a.tip.y-f.py);})()}; })()""")
        print('character', r)
        if r['n'] != 7 or r['roots'] != 1 or not r['hard'] or r['studio'] or r['fore'] != 'armL' or r['tipArm'] > 1 or not r['png']: errs.append('✓ Xong should make one 7-piece character with bones: %s' % r)
        if r['lname'] != 'Nhân vật 1': errs.append('layer name from the dialog: %s' % r['lname'])
        kho = await pg.evaluate("charLib().then(L=>L.length)")
        if kho != 1: errs.append('💾 Lưu vào Kho nhân vật was ticked: %s' % kho)
        # the character is drawn where it was put together: the head picture with its red stroke on the frame
        await pg.evaluate("render()"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='xuong_4_nhan_vat.png')
        # the arm bends round the shoulder joint in the real rig
        r = await pg.evaluate("""(()=>{ const a=S.pp.parts.find(p=>p.role==='armL'), f=curFrame(); const P={...(f.pp||{})}; P[a.id]={r:60}; const M=ppMats(P)[a.id], w=mApply(M,a.px,a.py); return [w.x-a.px, w.y-a.py]; })()""")
        if abs(r[0]) > 0.01 or abs(r[1]) > 0.01: errs.append('the shoulder pivot should stay put when the arm turns: %s' % r)
        # undo: one step removes the character
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("S.pp ? S.pp.parts.length : 0")
        if r != 0: errs.append('one undo should take the new character away: %s' % r)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("S.pp ? S.pp.parts.length : 0")
        if r != 7: errs.append('redo should bring it back: %s' % r)
        # 10. ✏ Sửa nhân vật này: rest pose, move the head joint, ✓ Xong writes it back with the same ids
        ids0 = await pg.evaluate("S.pp.parts.map(p=>p.id).sort().join(',')")
        await pg.evaluate("setTool('puppet'); ppSel=S.pp.parts.find(p=>p.role==='head').id; ppSyncBar(); openTab('pp','parts')"); await pg.wait_for_timeout(300)
        await pg.click('#rsEditBtn'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("[!!RS && RS.edit, RS.pcs.length]")
        if not r[0] or r[1] != 7: errs.append('✏ Sửa nhân vật này should open the 7 pieces: %s' % r)
        h0 = await pg.evaluate("(()=>{ const p=S.pp.parts.find(q=>q.role==='head'); return [p.px,p.py,p.ox,p.oy,p.c.width]; })()")
        await pg.click('[data-rsm="bone"]')
        j = await pg.evaluate("rsJD(RS.pcs.find(q=>q.role==='head'))")
        await drag([j['x'], j['y']], [j['x'], j['y'] + 24], 'pen')
        await pg.click('#rsDone'); await pg.wait_for_timeout(1200)
        h1 = await pg.evaluate("(()=>{ const p=S.pp.parts.find(q=>q.role==='head'); return [p.px,p.py,p.ox,p.oy,p.c.width]; })()")
        ids1 = await pg.evaluate("S.pp.parts.map(p=>p.id).sort().join(',')")
        print('edit', h0, '->', h1)
        if ids0 != ids1: errs.append('editing should keep the part ids')
        if not (abs(h1[1] - h0[1] - 24) < 2 and h1[2:] == h0[2:]): errs.append('the head joint should move 24 px, picture unchanged: %s → %s' % (h0, h1))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        h2 = await pg.evaluate("(()=>{ const p=S.pp.parts.find(q=>q.role==='head'); return [p.px,p.py,p.ox,p.oy,p.c.width]; })()")
        if h2 != h0: errs.append('undo should restore the joint: %s' % h2)
        # 11. portrait iPad: the workshop fits (canvas + panel below), no sideways scroll
        await pg.set_viewport_size({'width': 820, 'height': 1180}); await pg.wait_for_timeout(200)
        await pg.evaluate("rsOpen(S.pp.parts[0].id)"); await pg.wait_for_timeout(600)
        r = await pg.evaluate("(()=>{ const c=RS.cv.getBoundingClientRect(), s=document.querySelector('#rsWrap .rs-side').getBoundingClientRect(); return [c.width, c.height, s.top>=c.bottom-1, document.documentElement.scrollWidth<=innerWidth+1]; })()")
        print('portrait', r)
        if not (r[0] > 600 and r[1] > 400 and r[2] and r[3]): errs.append('portrait layout: %s' % r)
        await pg.screenshot(path='xuong_5_doc.png')
        await pg.evaluate("rsClose(true)")
        await b.close()
    print('ERR', errs)
asyncio.run(main())
