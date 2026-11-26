import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9520'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 👕 Áo đấu: colour slots, own logo, number + name, 4 views on the drawn player; recolour a drawn character keeping its shading;
# saved kit put on another character; undo; saved with the project
LOGO = """(async()=>{ const c=document.createElement('canvas'); c.width=120; c.height=120; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,120,120);
  x.fillStyle='#0033ff'; x.beginPath(); x.arc(60,60,50,0,7); x.fill(); const b=await new Promise(r=>c.toBlob(r,'image/png')); await kitMakerApi.addLogo(new File([b],'logo.png',{type:'image/png'})); })()"""
PX = "((c,x,y)=>[...c.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data])"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9520/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), h=S.pp.parts.find(q=>q.role==='head'); ppSel=t.id; return [t.alts.length, h.alts.length, !!(t.kit&&t.kit.o), ppPartMeta(t).kit.gen] })()")
        print('player', r)
        if r != [3, 1, True, 1]: errs.append('player views/kit %s' % r)
        # the dialog on the player: red body, blue logo on the left chest, number 7 + name, number on the back too
        await pg.evaluate('kitMaker(); 0'); await pg.wait_for_timeout(500)
        await pg.click('[data-kms="body"]'); await pg.click('[data-kmc="#e53935"]')
        await pg.click('[data-kmsl="twin"]'); await pg.click('[data-kmns="block"]'); await pg.click('[data-kmnp="both"]')
        await pg.fill('#kmNum', '7'); await pg.fill('#kmName', 'Quân')
        await pg.evaluate(LOGO); await pg.wait_for_timeout(400)
        await pg.screenshot(path='ao_dau_dialog.png')
        await pg.click('[data-kmv="back"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='ao_dau_dialog_back.png')
        await pg.click('.dlg .btns >> text=Mặc cho nhân vật'); await pg.wait_for_timeout(900)
        r = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), L=kitLayout(), B=kitShirtBox(L), ox=t.ox, oy=t.oy, px=%s;"
            " return { body: px(t.c, B.x-ox+B.w*.12, B.y-oy+B.h*.8), logo: px(t.c, B.x-ox+B.w*.68, B.y-oy+B.h*.22), back: px(t.alts[2].c, B.x-ox+B.w*.5, B.y-oy+B.h*.52), q: px(t.alts[0].c, B.x-ox+B.w*.68, B.y-oy+B.h*.22), o: t.kit.o.body, n: t.kit.o.logos.length, sleeve: t.kit.o.sleeve, skin: t.kit.o.skin } })()" % PX)
        print('kit on player', r)
        if r['body'][:3] != [229, 57, 53]: errs.append('body not red %s' % r['body'])
        if not (r['logo'][2] > 200 and r['logo'][0] < 60): errs.append('logo not on the chest %s' % r['logo'])
        if r['back'][:3] == [229, 57, 53]: errs.append('no number on the back %s' % r['back'])
        if r['q'][:3] == r['logo'][:3]: errs.append('3/4 view should squeeze the logo away from that spot')
        if r['o'] != '#e53935' or r['n'] != 1 or r['sleeve'] != 'twin' or r['skin'] != 1: errs.append('kit options not kept %s' % r)
        # 👕 Góc áo: Sau on this frame (head turns its back), one undo step
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose')"); await pg.wait_for_timeout(300)
        await pg.click('[data-kv="3"]'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), h=S.pp.parts.find(q=>q.role==='head'), f=curFrame(); return [f.pp[t.id].v, f.pp[h.id].v] })()")
        print('view back', v)
        if v != [3, 1]: errs.append('view not set %s' % v)
        await pg.screenshot(path='ao_dau_sau_lung.png')
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("(()=>{ const t=S.pp.parts.find(q=>q.role==='torso'), f=curFrame(); return (f.pp[t.id]||{}).v || 0 })()")
        if v: errs.append('undo view %s' % v)
        await pg.click('[data-kv="1"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='ao_dau_3_4.png'); await pg.click('[data-kv="0"]')
        # save the kit
        await pg.evaluate("(async()=>{ const t=S.pp.parts.find(q=>q.role==='torso'); window._rec = await kitLibSave('Đội đỏ', t.kit.o); })()")
        # a character the user drew: white shirt with grey folds, a pink stripe, black outline (as one torso piece)
        await pg.evaluate("""(async()=>{ const c=makeCanvas(200,260), x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(10,10,180,240); x.fillStyle='#b4b8c8'; x.fillRect(30,60,30,150);
            x.fillStyle='#e6508c'; x.fillRect(140,10,20,240); x.strokeStyle='#111'; x.lineWidth=6; x.strokeRect(10,10,180,240);
            const p={ id:newId(), name:'Áo tự vẽ', role:'torso', parent:null, z:0, ox:100, oy:300, px:200, py:560, c, tip:{x:200,y:300} }; await encodePart(p); ppPushChar([p]); ppSel=p.id; ppShowAdded(); })()""")
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        await pg.evaluate('kitMaker(); 0'); await pg.wait_for_timeout(500)
        u = await pg.evaluate("[...kitMakerApi.U.from]"); print('detected', u)
        if u[0] != '#ffffff' or not u[1] or u[1][:3] != '#e6': errs.append('detected colours %s' % u)
        await pg.evaluate("kitMakerApi.load(_rec.o)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='ao_dau_tu_ve.png')
        await pg.click('.dlg .btns >> text=Mặc cho nhân vật'); await pg.wait_for_timeout(900)
        PXS = "(()=>{ const p=ppPart(ppSel), px=%s; return { white: px(p.c,100,230), fold: px(p.c,45,150), stripe: px(p.c,150,230), ink: px(p.c,11,130), base: !!(p.kit&&p.kit.base), logo: px(p.c, 10+180*.68, 10+240*.22) } })()" % PX
        r = await pg.evaluate(PXS); print('drawn char', r)
        if r['white'][:3] != [229, 57, 53]: errs.append('white not red %s' % r['white'])
        f = r['fold']
        if not (f[0] > f[1] + 60 and f[0] < 229): errs.append('fold should be a darker red %s' % f)
        if r['stripe'][:3] != [255, 255, 255]: errs.append('stripe should take the trim colour (white) %s' % r['stripe'])
        if max(r['ink'][:3]) > 40: errs.append('outline changed %s' % r['ink'])
        if not r['base']: errs.append('original picture not kept')
        if not (r['logo'][2] > 200 and r['logo'][0] < 60): errs.append('logo not on the drawn shirt %s' % r['logo'])
        # again with a blue body: starts from the original (no red left), then undo goes back to red
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        await pg.evaluate('kitMaker(); 0'); await pg.wait_for_timeout(500)
        await pg.click('[data-kms="body"]'); await pg.click('[data-kmc="#1e88e5"]'); await pg.click('.dlg .btns >> text=Mặc cho nhân vật'); await pg.wait_for_timeout(900)
        r = await pg.evaluate(PXS); print('blue', r['white'], r['fold'])
        if r['white'][:3] != [30, 136, 229]: errs.append('second kit %s' % r['white'])
        await pg.wait_for_timeout(600); await pg.wait_for_function('!histT', timeout=5000)
        await pg.evaluate('undo()'); await pg.wait_for_timeout(400)
        r = await pg.evaluate(PXS); print('undo', r['white'])
        if r['white'][:3] != [229, 57, 53]: errs.append('undo did not bring back the red kit %s' % r['white'])
        # kept with the project
        await pg.evaluate('saveProject()'); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(2000)
        r = await pg.evaluate("(()=>{ const ps=S.pp.parts; return [ps.filter(q=>q.kit&&q.kit.o).length, ps.filter(q=>q.kit&&q.kit.base).length, ps.find(q=>q.role==='torso'&&q.kit.gen).alts.length] })()")
        print('after reload', r)
        if r != [2, 1, 3]: errs.append('kit not saved %s' % r)
        lib = await pg.evaluate("kitLib().then(L=>L.map(r=>r.name))"); print('lib', lib)
        if lib != ['Đội đỏ']: errs.append('kit library %s' % lib)
        # no character yet: the dialog adds a player wearing the kit
        await pg.evaluate('kitMaker(null); 0'); await pg.wait_for_timeout(400)
        await pg.click('[data-kms="body"]'); await pg.click('[data-kmc="#43a047"]'); await pg.click('.dlg .btns >> text=Thêm cầu thủ mặc áo này'); await pg.wait_for_timeout(900)
        while await pg.locator('.ov').count(): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        n = await pg.evaluate("S.pp.parts.filter(q=>q.role==='torso'&&q.kit&&q.kit.o&&q.kit.o.body==='#43a047').length")
        if n != 1: errs.append('new player with the kit %s' % n)
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
