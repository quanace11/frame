import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9213'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# A layer added on a later frame from 🎨 Kho hình / 🧍 Kho nhân vật / ⚽ Cầu thủ mẫu / Nhập ảnh behaves like the first picture
# turned into a piece: it asks "hiện ở frame nào?", and 📍 Hiện ở… / 👁 can show it on every frame again
# (before: frames before were hidden in the pose, which 📍 Mọi frame could not undo).
INK = '''([i,rid])=>{const f=S.frames[i];const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  ppOnlyRoot=rid;try{drawPuppet(x,f.pp,f.lip);}finally{ppOnlyRoot=null;}const d=x.getImageData(0,0,W,H).data;let n=0;for(let k=3;k<d.length;k+=16)if(d[k]>20)n++;return n;}'''
def ok(c, m):
    print(('OK ' if c else 'FAIL ') + m)
    if not c: raise SystemExit(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9213/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for _ in range(4): await pg.click('#addBtn'); await pg.wait_for_timeout(150)
        ok(await pg.evaluate('S.frames.length') == 5, '5 frame')
        await pg.evaluate('selectFrame(2)'); await pg.wait_for_timeout(200)
        mark = lambda: pg.evaluate('window._rb = (S.pp ? ppRoots() : []).map(r=>r.id)')
        newRoot = lambda: pg.evaluate('ppRoots().map(r=>r.id).find(id=>!window._rb.includes(id))')
        ink = lambda rid: asyncio.gather(*[pg.evaluate(INK, [i, rid]) for i in range(5)])
        # 1) 🎨 Kho hình → 🗂 Layer mới: the dialog defaults to a new layer, then asks where it shows
        await mark(); await pg.evaluate("assetDialog('eyes')"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('[data-adst=layer]').classList.contains('on')"), 'Kho hình: mặc định 🗂 Layer mới')
        await pg.click('#aGrid button >> nth=0'); await pg.wait_for_timeout(600)
        ok('hiện ở frame nào' in (await pg.text_content('.ov:last-child h3')), 'Kho hình: hỏi hiện ở frame nào')
        await pg.click('.ov:last-child .btns >> text=Mọi frame'); await pg.wait_for_timeout(300)
        r1 = await newRoot()
        v = await ink(r1); ok(all(n > 20 for n in v), 'Kho hình: Mọi frame → hiện ở cả 5 frame %s' % v)
        await pg.evaluate('undo()'); await pg.wait_for_timeout(400)
        v = await ink(r1); ok(v[0] == 0 and v[1] == 0 and v[2] > 20 and v[4] > 20, 'hoàn tác: về từ frame 3 trở đi %s' % v)
        await pg.evaluate('redo()'); await pg.wait_for_timeout(400)
        # 2) ⚽ Cầu thủ mẫu: Chỉ frame này
        await pg.evaluate('selectFrame(3)'); await pg.wait_for_timeout(200)
        await mark(); await pg.evaluate('kitDialog(); 0'); await pg.wait_for_timeout(400); await pg.click('.ov:last-child .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(900)
        await pg.click('.ov:last-child .btns >> text=Chỉ frame này'); await pg.wait_for_timeout(300)
        r2 = await newRoot()
        v = await ink(r2); ok(v[3] > 50 and v[0] == 0 and v[2] == 0 and v[4] == 0, 'Cầu thủ: chỉ frame 4 %s' % v)
        # 📍 Hiện ở… → Mọi frame works on it later too
        await pg.evaluate("ppShowAsk(%r); 0" % r2); await pg.wait_for_timeout(300)
        await pg.click('.ov:last-child .btns >> text=Mọi frame'); await pg.wait_for_timeout(300)
        v = await ink(r2); ok(all(n > 50 for n in v), '📍 Mọi frame %s' % v)
        # 2b) 📍 Từ … tới …: shown on frames 2–4 only
        await pg.evaluate("ppShowAsk(%r); 0" % r2); await pg.wait_for_timeout(300)
        await pg.fill('#psA', '2'); await pg.fill('#psB', '4'); await pg.click('.ov:last-child .btns >> text=Từ … tới …'); await pg.wait_for_timeout(300)
        v = await ink(r2); ok(v[0] == 0 and v[1] > 50 and v[2] > 50 and v[3] > 50 and v[4] == 0, '📍 từ frame 2 tới 4 %s' % v)
        await pg.evaluate("ppShowRange(%r,'all')" % r2); await pg.wait_for_timeout(200)
        # 3) Esc on the question = from this frame on (the default), 👁 Hiện ở frame này shows it on an earlier frame
        await pg.evaluate('selectFrame(2)'); await pg.wait_for_timeout(200)
        c = await pg.evaluate("(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;const x=c.getContext('2d');x.fillStyle='#e33';x.fillRect(20,20,160,160);window._l=imgToLayer(c,null,'Ô đỏ');return 1})()")
        await pg.wait_for_timeout(600); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        r3 = await pg.evaluate('ppRoots().find(r=>r.lname==="Ô đỏ").id')
        v = await ink(r3); ok(v[0] == 0 and v[1] == 0 and v[2] > 50 and v[4] > 50, 'Nhập ảnh: Esc = từ frame 3 %s' % v)
        await pg.evaluate('selectFrame(0)'); await pg.wait_for_timeout(200)
        await pg.evaluate("ppOffToggle(%r)" % r3); await pg.wait_for_timeout(200)
        v = await ink(r3); ok(v[0] > 50 and v[1] == 0, '👁 hiện ở frame 1 %s' % v)
        # 4) an old project: the layer was hidden in the pose on earlier frames → 📍 Mọi frame still shows it
        await pg.evaluate("""(()=>{const rid=%r;for(const i of [0,1]){const f=S.frames[i];f.pp=f.pp||{};for(const p of lyrParts(rid))f.pp[p.id]={...(f.pp[p.id]||{}),h:true};f.ppKey=true;ppLayerSetKey(f,rid,true);}})()""" % r1)
        v = await ink(r1); ok(v[0] == 0 and v[1] == 0, 'dự án cũ: ẩn bằng tư thế %s' % v)
        await pg.evaluate("ppShowRange(%r,'all')" % r1); await pg.wait_for_timeout(300)
        v = await ink(r1); ok(all(n > 20 for n in v), 'dự án cũ: 📍 Mọi frame hiện lại %s' % v)
        await pg.evaluate('undo()'); await pg.wait_for_timeout(400)
        v = await ink(r1); ok(v[0] == 0 and v[2] > 20, 'dự án cũ: hoàn tác %s' % v)
        ok(await pg.evaluate("lgHiddenAt(S.frames[0], %r)" % r1), 'Dòng layer thấy ô ẩn')
        # 5) 🧍 Kho nhân vật: save the footballer, add it on frame 5 → asked too
        await pg.evaluate("ppSel=%r" % r2)
        await pg.evaluate('window._s = charLibSave(); 0'); await pg.wait_for_timeout(400)
        await pg.click('.ov:last-child .btns >> text=💾 Lưu'); await pg.wait_for_timeout(800)
        await pg.evaluate('selectFrame(4)'); await pg.wait_for_timeout(200)
        await mark(); await pg.evaluate('charLibDialog(); 0'); await pg.wait_for_timeout(600); await pg.click('.ov:last-child #chList [data-a=add] >> nth=0'); await pg.wait_for_timeout(1200)
        ok('hiện ở frame nào' in (await pg.text_content('.ov:last-child h3')), 'Kho nhân vật: hỏi hiện ở frame nào')
        await pg.click('.ov:last-child .btns >> text=Mọi frame'); await pg.wait_for_timeout(300)
        r4 = await newRoot()
        ok(r4 not in (r1, r2, r3), 'nhân vật mới')
        v = await ink(r4); ok(all(n > 50 for n in v), 'Kho nhân vật: Mọi frame %s' % v)
        await pg.screenshot(path='hien_layer_tu_kho.png')
        await b.close()
        print('ERR', errs)
asyncio.run(main())
