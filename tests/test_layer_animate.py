import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8963'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🗂 Layer (mỗi ảnh = 1 layer, đổi trước/sau, ẩn, khoá) + ⬚ khung 8 chấm (ảnh nổi + cả nhân vật) + nút − / + và 🎥 Camera
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
MKIMG='''([w,h,col])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,w,h);return c}'''
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
FAILS=[]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8963/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        px = lambda x,y: pg.evaluate('([x,y])=>{const c=document.createElement("canvas");c.width=W;c.height=H;const k=c.getContext("2d");k.fillStyle="#fff";k.fillRect(0,0,W,H);drawPuppet(k,ppPoseFor(curFrame()),curFrame().lip);return [...k.getImageData(x,y,1,1).data].slice(0,3)}',[x,y])
        # 3 pictures -> 3 layers, the newest on top
        for col in ['#ff0000','#00ff00','#0000ff']:
            await pg.evaluate(f'(async()=>{{const c=({MKIMG})([300,400,"{col}"]); await imgToLayer(c)}})()'); await pg.wait_for_timeout(150)
        names = await pg.evaluate('lyrOrder().map(lyrName)')
        ok('3 layers, newest in front', names == ['Ảnh 3','Ảnh 2','Ảnh 1'], names)
        ok('panel open with rows', await pg.evaluate("!$('#lyrPanel').hidden && document.querySelectorAll('#lyrList .lyr.pp').length===3"))
        ok('tool = puppet, box mode', await pg.evaluate("S.tool==='puppet' && ppDrag==='box'"))
        await pg.wait_for_timeout(500)
        ok('blue in front', await px(540,960) == [0,0,255], await px(540,960))
        # send blue to the back with the ▼ button twice
        await pg.click('#lyrDown'); await pg.wait_for_timeout(600); await pg.click('#lyrDown'); await pg.wait_for_timeout(100)
        ok('green in front after ▼▼', await px(540,960) == [0,255,0], await pg.evaluate('lyrOrder().map(lyrName)'))
        await pg.wait_for_timeout(500)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        ok('undo puts the order back one step', (await pg.evaluate('lyrOrder().map(lyrName)')) == ['Ảnh 2','Ảnh 3','Ảnh 1'], await pg.evaluate('lyrOrder().map(lyrName)'))
        # drag the grip of the last row to the top
        rows = await pg.query_selector_all('#lyrList .lyr.pp .lgrip')
        bb0 = await rows[-1].bounding_box(); bbT = await rows[0].bounding_box()
        await pg.mouse.move(bb0['x']+8, bb0['y']+bb0['height']/2); await pg.mouse.down()
        await pg.mouse.move(bb0['x']+8, bbT['y']+2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
        order = await pg.evaluate('lyrOrder().map(lyrName)')
        ok('drag ≡ to the top', order[0] == 'Ảnh 1', order)
        ok('red in front', await px(540,960) == [255,0,0])
        # hide / lock
        rid = await pg.evaluate('lyrOrder()[0].id')
        await pg.click(f'[data-lre="{rid}"]'); await pg.wait_for_timeout(100)
        ok('hidden layer not drawn', await px(540,960) != [255,0,0], await px(540,960))
        await pg.click(f'[data-lre="{rid}"]')
        await pg.click(f'[data-lrk="{rid}"]'); await pg.evaluate('ppSel=null')
        await pg.evaluate(PEN,[[await d2s(540,960), await d2s(541,960)]]); await pg.wait_for_timeout(100)
        ok('locked layer is skipped by a tap', await pg.evaluate(f'ppSel && ppCharOf(ppPart(ppSel))!=="{rid}"'), await pg.evaluate('ppSel'))
        await pg.click(f'[data-lrk="{rid}"]')
        # 8-handle box: select red, drag bottom-right corner outwards -> uniform bigger, top-left stays
        await pg.evaluate(f'lyrSelect("{rid}")'); await pg.wait_for_timeout(100)
        b0 = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return [xbDoc(b,"tl"),xbDoc(b,"br"),xbDoc(b,"r")]}})()')
        br = b0[1]; await pg.evaluate(PEN,[[await d2s(br['x'],br['y']), await d2s(br['x']+75,br['y']+100), await d2s(br['x']+150,br['y']+200)]]); await pg.wait_for_timeout(200)
        q = await pg.evaluate(f'curFrame().pp["{rid}"]')
        b1 = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return [xbDoc(b,"tl"),xbDoc(b,"br")]}})()')
        ok('corner = proportional scale', abs(q.get('sx',1)-1.5) < 0.03 and abs(q.get('sy',1)-1.5) < 0.03, q)
        ok('opposite corner stays', abs(b1[0]['x']-b0[0]['x']) < 1.5 and abs(b1[0]['y']-b0[0]['y']) < 1.5, (b0[0], b1[0]))
        ok('keyframe set', await pg.evaluate('ppIsKey(curFrame())'))
        # edge handle = stretch one way only
        r0 = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return xbDoc(b,"r")}})()')
        await pg.evaluate(PEN,[[await d2s(r0['x'],r0['y']), await d2s(r0['x']-150,r0['y'])]]); await pg.wait_for_timeout(200)
        q = await pg.evaluate(f'curFrame().pp["{rid}"]')
        ok('edge = stretch x only', abs(q['sx']-1.0) < 0.05 and abs(q['sy']-1.5) < 0.03, q)
        await pg.wait_for_timeout(300)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(200)
        q = await pg.evaluate(f'curFrame().pp["{rid}"]')
        ok('undo the stretch', abs(q['sx']-1.5) < 0.03, q)
        # rotate knob
        kn = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return [xbKnob(b),xbCentre(b)]}})()')
        k, c = kn
        await pg.evaluate(PEN,[[await d2s(k['x'],k['y']), await d2s(c['x']+(c['y']-k['y']), c['y'])]]); await pg.wait_for_timeout(200)
        r = await pg.evaluate(f'curFrame().pp["{rid}"].r')
        c2 = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return xbCentre(b)}})()')
        ok('knob rotates 90°', abs(r-90) < 2, r); ok('rotates about the centre', abs(c2['x']-c['x']) < 2 and abs(c2['y']-c['y']) < 2)
        # a multi-piece character: drag a piece in box mode -> whole character moves, pieces stay together
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(600)
        kr = await pg.evaluate('lyrOrder()[0].id'); arm = await pg.evaluate(f'(()=>{{const p=S.pp.parts.find(p=>p.role==="foreL"&&ppCharOf(p)==="{kr}");const M=ppMats(ppPoseFor(curFrame()));const t=ppTipOf(p);return [p.id,mApply(M[p.id],(p.px+t.x)/2,(p.py+t.y)/2)]}})()')
        await pg.evaluate('ppSel=null')
        hit = await pg.evaluate(f'(()=>{{const h=ppHit({{x:{arm[1]["x"]},y:{arm[1]["y"]}}},ppPoseFor(curFrame()),true);return h&&h.id}})()')
        a0 = arm[1]; await pg.evaluate(PEN,[[await d2s(a0['x'],a0['y']), await d2s(a0['x']+60,a0['y']+20), await d2s(a0['x']+120,a0['y']+40)]]); await pg.wait_for_timeout(200)
        rootq = await pg.evaluate(f'curFrame().pp["{kr}"]'); armq = await pg.evaluate(f'curFrame().pp["{arm[0]}"]||{{}}')
        ok('drag on the arm moves the whole character', hit is not None and abs(rootq.get('dx',0)-120) < 2 and abs(rootq.get('dy',0)-40) < 2, rootq)
        ok('the arm itself did not come off', not armq.get('dx') and not armq.get('dy'), armq)
        ok('character selected as a group', await pg.evaluate(f'ppSel==="{kr}"'))
        # double tap a piece = edit that piece alone
        a1 = await pg.evaluate(f'(()=>{{const p=ppPart("{arm[0]}");const M=ppMats(ppPoseFor(curFrame()));const t=ppTipOf(p);return mApply(M[p.id],(p.px+t.x)/2,(p.py+t.y)/2)}})()')
        s = await d2s(a1['x'],a1['y'])
        await pg.evaluate(PEN,[[s,[s[0]+1,s[1]]]]); await pg.evaluate(PEN,[[s,[s[0]+1,s[1]]]]); await pg.wait_for_timeout(100)
        ok('double tap enters the piece', await pg.evaluate(f'ppDrag==="rotate" && ppSel==="{arm[0]}"'), await pg.evaluate('[ppDrag,ppSel]'))
        await pg.click('[data-ppd=box]')
        # floating picture: corner + edge handles
        await pg.evaluate(f'(()=>{{const c=({MKIMG})([200,100,"#ff00ff"]); floatFromImage(c)}})()'); await pg.wait_for_timeout(150)
        f0 = await pg.evaluate('[floating.scale, xbDoc(floatXbox(),"br"), xbDoc(floatXbox(),"tl"), xbDoc(floatXbox(),"b")]')
        br = f0[1]; await pg.evaluate(PEN,[[await d2s(br['x'],br['y']), await d2s(br['x']+100,br['y']+50)]]); await pg.wait_for_timeout(100)
        f1 = await pg.evaluate('[floating.scale, xbDoc(floatXbox(),"tl"), floating.ay||1]')
        ok('floating corner scales', abs(f1[0]/f0[0]-1.5) < 0.03 and abs(f1[2]-1) < 0.01, f1)
        ok('floating opposite corner stays', abs(f1[1]['x']-f0[2]['x']) < 1.5 and abs(f1[1]['y']-f0[2]['y']) < 1.5)
        bm = await pg.evaluate('xbDoc(floatXbox(),"b")')
        await pg.evaluate(PEN,[[await d2s(bm['x'],bm['y']), await d2s(bm['x'],bm['y']+75)]]); await pg.wait_for_timeout(100)
        ok('floating edge stretches one way', abs(await pg.evaluate('floating.ay')-1.5) < 0.05, await pg.evaluate('floating.ay'))
        ok('slider follows', await pg.evaluate("+$('#selScale').value") == round(f1[0]*100))
        await pg.screenshot(path='layer_box.png')
        await pg.click('#selCancel')
        # view zoom buttons + camera tool button
        v0 = await pg.evaluate('vs'); await pg.click('#zoomIn'); v1 = await pg.evaluate('vs')
        ok('+ zooms in', abs(v1/v0-1.25) < 0.01); await pg.click('#zoomLbl'); ok('label = fit', abs(await pg.evaluate('vs/fitS')-1) < 0.01)
        await pg.click('#camToolBtn'); ok('🎥 opens the camera', await pg.evaluate("S.tool==='fx' && TABS.fx==='cam'"))
        # import dialog: plain image -> its own layer
        await pg.set_input_files('#imgFile', os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(500)
        await pg.click('[data-mode=raw]'); await pg.wait_for_timeout(800)
        ok('layer option shown', await pg.evaluate("!document.getElementById('impLayerRow').hidden && document.getElementById('impLayerChk').checked"))
        n0 = await pg.evaluate('lyrRoots().length')
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
        ok('imported picture became a layer', await pg.evaluate('lyrRoots().length') == n0+1 and await pg.evaluate("S.tool==='puppet' && !floating"))
        await pg.screenshot(path='layer_panel.png')
        # names / hidden flags survive a reload
        await pg.evaluate(f'(()=>{{ppPart("{rid}").lname="Nam"; ppPart("{rid}").lh=true; scheduleSave()}})()'); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(2500)
        ok('layer name + hidden kept after reload', await pg.evaluate(f'(()=>{{const r=ppPart("{rid}");return !!r && r.lname==="Nam" && !!r.lh}})()'))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
