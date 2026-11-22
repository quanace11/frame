import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8925'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# ⚽ Cầu thủ mẫu: a ready-cut footballer (10 parts with roles + joints) and 🔄 Đổi hình mảnh (caricature head on the neck), both undoable
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8925/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("sceneDialog()"); await pg.wait_for_timeout(200); await pg.click('[data-scene="pitch"]'); await pg.wait_for_timeout(300)
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('[data-kp="stripes"]'); await pg.click('[data-kc="0"]'); await pg.fill('#kitNum', '7'); await pg.click('[data-kh="spiky"]')
        await pg.screenshot(path='cau_thu_dialog.png')
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("S.pp.parts.map(q=>[q.role, !!q.parent, !!q.tip, q.c.width>10&&q.c.height>10])")
        roles = sorted(x[0] for x in r); print('parts', len(r), roles)
        want = sorted(['torso','head','armL','foreL','armR','foreR','legL','shinL','legR','shinR'])
        if roles != want: errs.append('roles %s' % roles)
        if not all(x[2] and x[3] for x in r): errs.append('part without tip/picture')
        if sum(1 for x in r if not x[1]) != 1: errs.append('should have one root part')
        # z: legs under the torso, arms and head over it
        z = await pg.evaluate("Object.fromEntries(S.pp.parts.map(q=>[q.role,q.z]))")
        if not (z['legL'] < z['torso'] < z['armL'] < z['head'] and z['shinL'] < z['torso']): errs.append('z order %s' % z)
        # a gesture made for cut characters works on it (absolute arm angles by role)
        g = await pg.evaluate("(async()=>{ const k=Object.keys(GESTURES)[0]; const a=JSON.stringify(curFrame().pp); await ppGesture(k); return [k, S.frames.length, a!==JSON.stringify(S.frames.at(-1).pp)] })()")
        print('gesture', g)
        if not g[2] or g[1] < 2: errs.append('gesture did nothing: %s' % g)
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='cau_thu.png')
        # swap the head: a picture on white paper (a red face) → white edges become transparent, bottom stays on the neck
        before = await pg.evaluate("(()=>{ const h=S.pp.parts.find(q=>q.role==='head'); ppSel=h.id; return {w:h.c.width,h:h.c.height,ox:h.ox,oy:h.oy,px:h.px,py:h.py,bot:h.oy+h.c.height} })()")
        await pg.evaluate("""(async()=>{ const c=document.createElement('canvas'); c.width=400; c.height=500; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,400,500);
            x.fillStyle='#d84315'; x.beginPath(); x.ellipse(200,240,150,200,0,0,7); x.fill(); x.fillStyle='#000'; x.fillRect(140,200,30,30); x.fillRect(230,200,30,30);
            const blob=await new Promise(r=>c.toBlob(r,'image/png')); window._ok = await ppSwapImage(new File([blob],'dau.png',{type:'image/png'})); })()""")
        await pg.wait_for_timeout(700)
        after = await pg.evaluate("(()=>{ const h=S.pp.parts.find(q=>q.role==='head'); const d=h.c.getContext('2d').getImageData(0,0,1,1).data[3]; const m=h.c.getContext('2d').getImageData(h.c.width>>1,h.c.height>>1,1,1).data; return {ok:_ok,w:h.c.width,h:h.c.height,ox:h.ox,oy:h.oy,px:h.px,py:h.py,bot:h.oy+h.c.height,corner:d,mid:[...m]} })()")
        print('head before', before); print('head after', after)
        if not after['ok'] or after['corner'] != 0 or after['mid'][0] < 180: errs.append('swap picture wrong')
        if after['px'] != before['px'] or after['py'] != before['py'] or abs(after['bot'] - before['bot']) > 1 or after['h'] != before['h']: errs.append('swap moved the joint/size')
        await pg.screenshot(path='cau_thu_dau_moi.png')
        await pg.wait_for_timeout(600)   # let the automatic undo snapshot run
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        back = await pg.evaluate("(()=>{ const h=S.pp.parts.find(q=>q.role==='head'); return {w:h.c.width,h:h.c.height,ox:h.ox} })()")
        print('after undo', back)
        if back['w'] != before['w'] or back['ox'] != before['ox']: errs.append('undo did not restore the head')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
