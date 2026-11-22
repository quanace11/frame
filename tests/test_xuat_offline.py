import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8921'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Offline font + PNG export: comic font is embedded (no request leaves localhost), PNG ZIP is split into parts, single PNG has a busy guard
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        outside = []
        async def route(r):
            u = r.request.url
            if u.startswith('http://localhost:8921/') or u.startswith('data:') or u.startswith('blob:'): await r.continue_()
            else: outside.append(u); await r.abort()
        await pg.route('**/*', route)
        await pg.goto('http://localhost:8921/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        ok = await pg.evaluate("(async()=>{ await fontsReady(); return document.fonts.check('100px Bangers') })()")
        print('font Bangers ready offline', ok)
        if not ok: errs.append('Bangers not loaded offline')
        # the Vietnamese subset is embedded too
        vi = await pg.evaluate("(async()=>{ await document.fonts.load('100px Bangers', 'Ợ'); return [...document.fonts].filter(f=>f.family.replace(/\"/g,'')==='Bangers'&&f.status==='loaded').length })()")
        print('Bangers faces loaded', vi)
        if vi < 2: errs.append('Vietnamese Bangers subset not loaded')
        print('requests outside localhost', outside)
        if outside: errs.append('outside requests: %s' % outside)

        for _ in range(3): await pg.click('#addBtn'); await pg.wait_for_timeout(60)
        await pg.evaluate("""(async()=>{ for(let i=0;i<4;i++){ const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.fillStyle=['#e53935','#1e88e5','#43a047','#111'][i]; x.fillRect(100+i*150,300,300,300); f.ver=(f.ver||0)+1; }
          window._got=[]; deliverFile = async (blob,name)=>{ _got.push({name, size: blob.size}); return true; }; PNG_ZIP_PART = 1; })()""")
        # every frame goes over the (tiny) limit → 4 parts, each needs a tap on "Lưu phần N"
        await pg.evaluate("(window._seq = exportPngSeq(), 0)")
        taps = 0
        for _ in range(60):
            await pg.wait_for_timeout(250)
            btn = pg.locator('.dlg .btns >> text=Lưu phần')
            if await btn.count():
                await btn.first.click(); taps += 1
            if await pg.evaluate("_got.length") >= 4 and not await pg.evaluate("exportBusy"): break
        got = await pg.evaluate("_got.map(g=>g.name)")
        print('png parts', len(got), 'taps', taps, [g.split('-')[-1] for g in got])
        if len(got) != 4 or taps != 4 or not all('-phan%d.zip' % (i + 1) in g for i, g in enumerate(got)): errs.append('PNG split wrong: %s taps %d' % (got, taps))
        # small film: one ZIP with no extra dialog
        await pg.evaluate("_got=[]; PNG_ZIP_PART = 400e6")
        await pg.evaluate("exportPngSeq()"); await pg.wait_for_timeout(2500)
        got = await pg.evaluate("_got.map(g=>g.name)")
        print('one zip', len(got), got and 'phan' not in got[0])
        if len(got) != 1 or 'phan' in got[0]: errs.append('small export should be one zip: %s' % got)
        # single PNG: second tap while busy is ignored
        await pg.evaluate("_got=[]; (async()=>{ await Promise.all([exportPngOne(), exportPngOne()]) })()"); await pg.wait_for_timeout(1500)
        n1 = await pg.evaluate("_got.length"); print('single png files', n1)
        if n1 != 1: errs.append('exportPngOne gave %d files' % n1)
        # the grey picture in the cut-region editor no longer uses ctx.filter
        src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
        if "gx.filter = 'grayscale" in src: errs.append('ctx.filter still used for grey')
        print('ERR', errs)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
