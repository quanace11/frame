import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# ☁ live sync (PC ↔ tablet both open at the same time): a device left open on screen picks up the other device's work by
# itself (👀 live check of the remote head every few seconds, ETag → "304 nothing new"), drawing afterwards makes no
# "(từ máy khác)" copy, a pull skipped while a dialog is open is retried, a real conflict shows the 2-version dialog.
# Reuses the mocked GitHub (in-memory git) from test_sync.py, on its own port.
import re
_src = open(os.path.join(HERE, 'test_sync.py'), encoding='utf-8').read()
exec(_src[_src.index('import asyncio'):_src.index('async def main():')].replace("'8857'", "'8858'").replace('localhost:8857', 'localhost:8858'))
ETAG = {'ok': 0, 'nm': 0}
async def route_etag(r):   # like api.github.com: the ref has an ETag, If-None-Match with the same one → 304
    q = r.request
    if q.method == 'GET' and q.url.endswith('/git/ref/heads/main') and G.head:
        tag = '"%s"' % G.head
        if q.headers.get('if-none-match') == tag: ETAG['nm'] += 1; return await r.fulfill(status=304, headers={**CORS, 'ETag': tag, 'Access-Control-Expose-Headers': 'ETag'})
        ETAG['ok'] += 1
        return await r.fulfill(status=200, body=json.dumps({'object': {'sha': G.head}}), headers={**CORS, 'ETag': tag, 'Access-Control-Expose-Headers': 'ETag', 'Content-Type': 'application/json'})
    return await route(r)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        errs = []
        async def device(name):
            ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); await ctx.route('https://api.github.com/**', route_etag)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e)))
            await pg.add_init_script("localStorage.setItem('fs-help','1')")
            await pg.goto('http://localhost:8858/index.html'); await pg.wait_for_timeout(900)
            return pg
        async def draw(pg, pts):
            await pg.evaluate(PEN, [[await pg.evaluate(f"({D2S})([{x},{y}])") for x, y in pts]]); await pg.wait_for_timeout(200)
        async def until(pg, cond, secs):   # seconds until cond is true in the page, or None
            t0 = time.time()
            while time.time() - t0 < secs:
                if await pg.evaluate(cond): return round(time.time() - t0, 1)
                await pg.wait_for_timeout(500)
            return None
        names = lambda pg: pg.evaluate("projIndex().then(L=>L.map(x=>x.name).sort())")
        A = await device('tablet'); B = await device('pc')
        await draw(A, [(300, 600), (500, 700)]); await A.wait_for_timeout(1500)
        await A.click('#menuBtn'); await A.click('[data-m=sync]'); await A.wait_for_timeout(200)
        await A.click('.dlg summary'); await A.fill('#syRepo', 'me/frame-data'); await A.fill('#syTok', TOK); await A.click('#syMake')
        await A.wait_for_function("!syncBusy && syncLast > 0", timeout=20000); code = await A.input_value('#syCode'); await A.click('.dlg .btns >> text=Đóng')
        await B.click('#menuBtn'); await B.click('[data-m=sync]'); await B.wait_for_timeout(200); await B.fill('#syCode', code); await B.click('#syJoin')
        await B.wait_for_function("!syncBusy && syncLast > 0", timeout=20000); await B.wait_for_timeout(500); await B.keyboard.press('Escape')
        pid = await A.evaluate('curProjId'); print('same project open on both', await B.evaluate('curProjId') == pid)
        # 1. PC adds a frame → the tablet, open and idle, gets it by itself
        await B.click('#addBtn')
        t = await until(A, "S.frames.length === 2", 40); print('tablet got the PC frame by itself after', t, 's')
        if t is None: errs.append('tablet did not pick up the PC change')
        # 2. tablet draws in that frame → the PC gets it, and nobody gets a "(từ máy khác)" copy
        await A.evaluate("selectFrame(1)"); await A.wait_for_timeout(300); await draw(A, [(300, 900), (600, 1000), (700, 1100)])
        t = await until(B, "(async()=>{ const f=S.frames[1]; if(!f) return false; await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(250,850,500,300).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]>100) n++; return n>200 })()", 40)
        print('PC got the tablet drawing after', t, 's')
        if t is None: errs.append('PC did not pick up the tablet drawing')
        na, nb = await names(A), await names(B); print('no copies', na, nb)
        if na != ['Dự án 1'] or nb != ['Dự án 1']: errs.append('unexpected copies %s %s' % (na, nb))
        print('the live check mostly gets "304 nothing new"', ETAG['nm'] > ETAG['ok'], ETAG)
        if ETAG['nm'] == 0: errs.append('poll does not use the ETag')
        # 3. a dialog is open on the tablet: its open project is not swapped under it; closed → it comes soon
        await A.evaluate("window._dlg = modal({title:'Thử', html:'<p>hộp thoại</p>', buttons:[{label:'Đóng', value:null}]})")
        await B.click('#addBtn')
        await A.wait_for_timeout(16000); n_open = await A.evaluate('S.frames.length'); print('dialog open: still', n_open, 'frames')
        if n_open != 2: errs.append('project replaced while a dialog was open')
        await A.click('.dlg .btns >> text=Đóng')
        t = await until(A, "S.frames.length === 3", 30); print('after closing the dialog it came in', t, 's')
        if t is None: errs.append('skipped pull was not retried')
        # 4. a real conflict: both change the project before they can sync → the 2-version dialog, open the other one
        await A.evaluate("clearInterval(1e9); window._sp = syncPoll; syncPoll = async()=>{}; localStorage.setItem('fs-sync-auto','off')")
        await B.evaluate("syncPoll = async()=>{}; localStorage.setItem('fs-sync-auto','off')")
        await B.click('#addBtn'); await B.wait_for_timeout(1500); await draw(A, [(200, 300), (400, 350)]); await A.wait_for_timeout(1500)
        await B.evaluate("syncNow({manual:true})"); await A.evaluate("syncNow({manual:true})")
        await A.wait_for_selector('.dlg >> text=Hai máy cùng sửa dự án này', timeout=15000)
        await A.screenshot(path='dong_bo_2_ban.png')
        await A.click('.dlg .btns >> text=Mở bản từ máy kia'); await A.wait_for_timeout(1200)
        nm, fr = await A.evaluate('S.projName'), await A.evaluate('S.frames.length'); print('opened the other version', nm, fr)
        if '(từ máy khác)' not in nm or fr != 4: errs.append('conflict dialog did not open the other version: %s %d' % (nm, fr))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.kill()
