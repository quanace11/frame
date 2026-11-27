import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9521'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🏷 Dán logo lên áo: logo on white paper → background removed (holes inside optional), 4-corner / mesh warp with the finger,
# 〰 Ôm áo bend, shading from the shirt under it, clip to the shirt; pasted into the torso piece (follows every frame) or into the
# drawing layer (pixel undo)
LOGO = """async (bg) => { const c=document.createElement('canvas'); c.width=200; c.height=200; const x=c.getContext('2d'); if (bg) { x.fillStyle='#fff'; x.fillRect(0,0,200,200); }
  x.fillStyle='#1040ff'; x.beginPath(); x.arc(100,100,80,0,7); x.fill(); x.fillStyle='#fff'; x.beginPath(); x.arc(100,100,25,0,7); x.fill();
  if (!bg) { x.fillStyle='#e02020'; x.fillRect(0,0,200,200); }
  const b=await new Promise(r=>c.toBlob(r,'image/png')); return new File([b],'logo.png',{type:'image/png'}); }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9521/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("sceneDialog()"); await pg.wait_for_timeout(200); await pg.click('[data-scene="pitch"]'); await pg.wait_for_timeout(300)
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(500)
        await pg.evaluate("ppSel = S.pp.parts.find(q=>q.role==='torso').id")
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        # open with a logo on white paper
        await pg.evaluate("(async()=>{ const f = await (%s)(true); await lwOpen(f); })()" % LOGO); await pg.wait_for_timeout(600)
        r = await pg.evaluate("(()=>{ const x=LW.img.getContext('2d'), w=LW.img.width, h=LW.img.height; return { w, corner: x.getImageData(1,1,1,1).data[3], mid: [...x.getImageData(w>>1,h>>1,1,1).data], ring: [...x.getImageData(w>>1,Math.round(h*.15),1,1).data], tgt: LW.tgt && LW.tgt.p && LW.tgt.p.role } })()")
        print('logo', r); await pg.screenshot(path='dan_logo_mo.png')
        if r['corner'] != 0: errs.append('paper not removed %s' % r)
        if r['mid'][3] < 250: errs.append('hole inside should stay without "Xoá cả lỗ" %s' % r['mid'])
        if r['ring'][2] < 200: errs.append('logo colour lost %s' % r['ring'])
        if r['tgt'] != 'torso': errs.append('target should be the torso %s' % r['tgt'])
        await pg.click('#lwHoles'); await pg.wait_for_timeout(400)
        m = await pg.evaluate("(()=>{ const w=LW.img.width, h=LW.img.height; return LW.img.getContext('2d').getImageData(w>>1,h>>1,1,1).data[3] })()")
        if m != 0: errs.append('hole not removed %s' % m)
        # ⬚ 4 góc: drag the top-right corner with the finger/mouse
        S0 = "((n)=>{ const r=$('#lwCv').getBoundingClientRect(), dp=lwDpr(), q=lwScr(LW.base[n]); return [r.left+q.x/dp, r.top+q.y/dp] })"
        before = await pg.evaluate("JSON.stringify(LW.base)")
        x0, y0 = await pg.evaluate(S0 + "(3)")
        await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x0 + 40, y0 - 30, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(200)
        r = await pg.evaluate("[LW.base[3], LW.base[1], LW.base[12]]"); b0 = await pg.evaluate("JSON.parse(%r)" % before)
        print('corner drag', r[0], b0[3])
        if not (r[0]['x'] > b0[3]['x'] + 20 and r[0]['y'] < b0[3]['y'] - 10): errs.append('corner did not follow the finger')
        if abs(r[1]['x'] - b0[1]['x']) < 1: errs.append('4-corner mode: the handles should follow the corner')
        if abs(r[2]['x'] - b0[12]['x']) > .01: errs.append('the opposite corner moved')
        # ▦ Uốn lưới: drag one inner point, only that area bends
        await pg.click('[data-lwm="mesh"]')
        b1 = await pg.evaluate("JSON.stringify(LW.base)")
        x1, y1 = await pg.evaluate(S0 + "(5)")
        await pg.mouse.move(x1, y1); await pg.mouse.down(); await pg.mouse.move(x1, y1 + 25, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(200)
        r = await pg.evaluate("(b=>{ const B=JSON.parse(b); return LW.base.map((p,i)=>Math.round(Math.hypot(p.x-B[i].x,p.y-B[i].y))) })(%r)" % b1)
        print('mesh moved', r)
        if r[5] < 10 or any(v > 0 for i, v in enumerate(r) if i != 5): errs.append('mesh point drag %s' % r)
        # 〰 Ôm áo bends the patch
        await pg.evaluate("$('#lwWrap').value=60; $('#lwWrap').dispatchEvent(new Event('input'))")
        bend = await pg.evaluate("Math.round(lwPts()[1].y - LW.base[1].y)")
        if bend == 0: errs.append('wrap does nothing')
        await pg.wait_for_timeout(300); await pg.screenshot(path='dan_logo_editor.png')
        # paste into the torso: its picture changes on every frame, undo brings it back
        await pg.evaluate("$('#lwWrap').value=25; $('#lwWrap').dispatchEvent(new Event('input'))")
        await pg.evaluate("(async()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); window._c0=t.c; window._n0=(()=>{ const d=t.c.getContext('2d').getImageData(0,0,t.c.width,t.c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i+2]>200&&d[i]<80&&d[i+3]>200) n++; return n })(); })()")
        await pg.click('#lwOk'); await pg.wait_for_timeout(800)
        r = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); const d=t.c.getContext('2d').getImageData(0,0,t.c.width,t.c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i+2]>200&&d[i]<80&&d[i+3]>200) n++; return { open: !!$('#lwOv'), same: t.c===_c0, blue: n, blue0: _n0, w: t.c.width===_c0.width } })()")
        print('pasted on torso', r)
        if r['open'] or r['same'] or r['blue'] < 300 or not r['w']: errs.append('paste on torso %s' % r)
        await pg.evaluate("setTool('puppet'); selectFrame(0)"); await pg.wait_for_timeout(300); await pg.screenshot(path='dan_logo_ket_qua.png')
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        await pg.evaluate('undo()'); await pg.wait_for_timeout(400)
        if not await pg.evaluate("S.pp.parts.find(q=>q.role==='torso').c === _c0"): errs.append('undo did not restore the torso')
        # a frame without a character piece under the logo: pasted into the drawing layer, shaded by it, clipped to it
        await pg.evaluate("""(async()=>{ S.showPP=false; updateToggles(); const f=curFrame(); await ensureLoaded(f); const x=f.canvas.getContext('2d');
            x.fillStyle='rgb(220,220,220)'; x.fillRect(300,600,200,300); x.fillStyle='rgb(110,110,110)'; x.fillRect(500,600,200,300); f.ver++; requestRender();
            const lg = await (%s)(false); await lwOpen(lg); LW.shade=1; LW.base = lwFromCorners({x:400,y:700},{x:600,y:700},{x:400,y:800},{x:600,y:800});
            LW.tgt=null; lwTarget(); })()""" % LOGO.replace("x.fillStyle='#e02020'; x.fillRect(0,0,200,200);", "x.globalCompositeOperation='destination-over'; x.fillStyle='rgba(0,0,0,0)';"))
        await pg.wait_for_timeout(500)
        r = await pg.evaluate("[LW.tgt && LW.tgt.name, !!(LW.tgt && LW.tgt.p)]"); print('layer target', r)
        if r[1] or 'Nhân vật' not in (r[0] or ''): errs.append('target should be the drawing layer %s' % r)
        # a logo bigger than the grey shirt: the part outside is cut away
        await pg.evaluate("LW.base = lwFromCorners({x:420,y:540},{x:600,y:540},{x:420,y:800},{x:600,y:800}); lwTarget()")
        await pg.click('#lwOk'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("(()=>{ const x=curFrame().canvas.getContext('2d'), px=(a,b)=>[...x.getImageData(a,b,1,1).data]; return { light: px(440,750), dark: px(580,750), out: px(510,570) } })()")
        print('layer paste', r)
        if not (r['light'][2] > 150 and r['dark'][2] < r['light'][2] - 40): errs.append('logo should be darker over the darker shirt %s' % r)
        if r['out'][3] != 0: errs.append('logo outside the shirt should be cut %s' % r['out'])
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        u = await pg.evaluate("[...curFrame().canvas.getContext('2d').getImageData(440,750,1,1).data]")
        if u[:3] != [220, 220, 220]: errs.append('undo layer paste %s' % u)
        # Esc closes the editor without pasting; the menu opens it
        await pg.evaluate("lwOpen()"); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        if await pg.evaluate("!!$('#lwOv')"): errs.append('Esc did not close')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
