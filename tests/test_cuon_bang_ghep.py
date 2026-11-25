import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# Android tablet in Chrome: the Ghép panel (and the other panels on the drawing area) scroll with a finger swipe,
# a swipe on the drawing itself still never scrolls / zooms the page; the app is installable and Menu → 📲 explains how.
import asyncio, subprocess, time, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9411'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
FAILS = []
def ok(name, cond, info=''):
    print(('ok  ' if cond else 'FAIL'), name, info)
    if not cond: FAILS.append(name)
async def swipe(cdp, x, y0, y1, steps=8):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y0}]})
    for i in range(1, steps + 1):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y0 + (y1 - y0) * i / steps}]})
        await asyncio.sleep(0.02)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await asyncio.sleep(0.4)
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for W, H in [(1280, 720), (800, 860), (1024, 700)]:
            ctx = await b.new_context(viewport={'width': W, 'height': H}, has_touch=True, is_mobile=False)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:9411/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
            await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(300)
            await pg.click('[data-tool=puppet]'); await pg.wait_for_timeout(400)
            info = await pg.evaluate("(()=>{const e=document.getElementById('ppbar'),r=e.getBoundingClientRect();return {sh:e.scrollHeight,ch:e.clientHeight,top:r.top,bot:r.bottom,ih:innerHeight}})()")
            ok(f'{W}x{H}: Ghép panel fits on screen', info['top'] >= 0 and info['bot'] <= info['ih'] + 1, info)
            ok(f'{W}x{H}: Ghép panel content is taller than the panel (test is meaningful)', info['sh'] > info['ch'] + 20, info)
            r = await pg.evaluate("(()=>{const r=document.getElementById('ppbar').getBoundingClientRect();return {x:r.left+12,y0:r.bottom-30,y1:r.top+40}})()")
            cdp = await ctx.new_cdp_session(pg)
            await swipe(cdp, r['x'], r['y0'], r['y1'])
            st = await pg.evaluate("document.getElementById('ppbar').scrollTop")
            ok(f'{W}x{H}: finger swipe scrolls the Ghép panel', st > 30, st)
            await pg.screenshot(path=f'cuon_bang_ghep_{W}x{H}.png')
            # a swipe on the drawing (not on a panel) still does not scroll the page
            await pg.click('#ppMini'); await pg.wait_for_timeout(200)
            vr = await pg.evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();for(let y=r.top+20;y<r.bottom-160;y+=20)for(let x=r.left+40;x<r.right-40;x+=40){const a=document.elementFromPoint(x,y),b=document.elementFromPoint(x,y+150);if(a&&b&&a.id==='view'&&b.id==='view')return {x,y}}return {x:0,y:0}})()")
            ok(f'{W}x{H}: swipe test starts on the drawing', await pg.evaluate("(p)=>document.elementFromPoint(p.x,p.y+150).id==='view'", vr))
            ev = await pg.evaluate('''(()=>{window.__tm=[];document.addEventListener('touchmove',e=>__tm.push(e.defaultPrevented),{passive:true});return 1})()''')
            await swipe(cdp, vr['x'], vr['y'] + 150, vr['y'])
            tm = await pg.evaluate('window.__tm')
            ok(f'{W}x{H}: swipe on the drawing is still blocked', len(tm) > 0 and all(tm), tm[:4])
            ok(f'{W}x{H}: page not scrolled', await pg.evaluate('scrollY === 0 && document.documentElement.scrollTop === 0'))
            await ctx.close()
        # installable PWA + Menu → 📲
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9411/index.html'); await pg.wait_for_timeout(2500)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        cdp = await ctx.new_cdp_session(pg)
        ie = await cdp.send('Page.getInstallabilityErrors')
        bad = [x for x in ie.get('installabilityErrors', []) if x.get('errorId') != 'in-incognito']   # Playwright contexts count as incognito
        ok('app is installable (no Chrome installability errors)', not bad, ie)
        man = json.load(open(os.path.join(DIST, 'manifest.webmanifest'), encoding='utf-8'))
        ok('manifest opens full screen', man.get('display_override', [None])[0] == 'fullscreen' and man.get('display') == 'standalone' and man.get('id'), man.get('display_override'))
        await pg.click('#menuBtn'); await pg.wait_for_timeout(300)
        await pg.click('[data-m=install]'); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[...document.querySelectorAll('.dlg')].pop().innerText")
        ok('📲 explains how to install (Mở trong Chrome, Cài đặt ứng dụng)', 'Mở trong Chrome' in t and 'Cài đặt ứng dụng' in t, t[:120])
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        # with Chrome's install event, 📲 opens Chrome's own install prompt
        await pg.evaluate("(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=1};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e)})()")
        await pg.click('#menuBtn'); await pg.wait_for_timeout(300)
        await pg.click('[data-m=install]'); await pg.wait_for_timeout(300)
        ok('📲 uses Chrome install prompt when offered', await pg.evaluate('window.__prompted === 1'))
        await ctx.close(); await b.close()
    ok('no page errors', not errs, errs[:3])
    print('FAILS', FAILS); print('ERR', errs)
asyncio.run(main())
