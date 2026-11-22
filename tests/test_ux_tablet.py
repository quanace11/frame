import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# UX on touch tablets (has_touch → CSS pointer:coarse), at the sizes of common tablets:
#  - every visible button / chip / colour dot is ≥ 32 px on its short side (fingers), no sideways page scroll
#  - Menu is visible without scrolling the rail (portrait: pinned at the bottom of the rail)
#  - short landscape (1280×800, one scrolling row of frame buttons): Nhân bản frame / + Frame trống are on screen
#  - Esc closes the dialog on top (keyboard / laptop), tapping outside still closes it
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9122'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
SMALL = '''() => { const out = [];
  for (const el of document.querySelectorAll('#app button, #app .chip, #app .sw, #app .tool')) {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    let hid = false; for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') { hid = true; break; } } if (hid) continue;
    if (Math.min(r.width, r.height) < 32) out.push((el.id || el.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  return out; }'''
ONSCREEN = '''(sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }'''
async def main():
    errs = []
    def check(name, ok, info=''):
        print(('ok  ' if ok else 'FAIL'), name, info); ok or errs.append(name)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for (nm, w, h) in [('ipad-land', 1366, 1024), ('ipad-port', 820, 1180), ('tab-land', 1280, 800), ('tab-port', 800, 1280)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True)
            pg = await ctx.new_page(); pe = []; pg.on('pageerror', lambda e, pe=pe: pe.append(str(e)))
            await pg.goto('http://localhost:9122/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
            check(f'{nm}: touch layout active', await pg.evaluate("matchMedia('(pointer:coarse)').matches"))
            sm = await pg.evaluate(SMALL)
            check(f'{nm}: no button under 32 px', not sm, str(sm[:6]))
            check(f'{nm}: no sideways scroll', not await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1'))
            check(f'{nm}: Menu on screen', await pg.evaluate(ONSCREEN, '#menuBtn'))
            for sel in ['#playBtn', '#dupBtn', '#addBtn']:
                check(f'{nm}: {sel} on screen', await pg.evaluate(ONSCREEN, sel))
            await pg.screenshot(path=f'ux_{nm}.png')
            check(f'{nm}: no page errors', not pe, str(pe[:2]))
            await ctx.close()
        # Esc closes the top dialog only
        pg = await b.new_page(viewport={'width': 1366, 'height': 1024})
        await pg.goto('http://localhost:9122/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('#menuBtn'); await pg.wait_for_timeout(200)
        await pg.click('.ov [data-m="help"]'); await pg.wait_for_timeout(200)
        check('help dialog open', await pg.evaluate("document.querySelectorAll('.ov').length") == 1)
        await pg.evaluate("(modal({title:'A'}), modal({title:'B'}), 0)"); await pg.wait_for_timeout(100)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        check('Esc closes only the top dialog', await pg.evaluate("[...document.querySelectorAll('.ov h3')].map(h=>h.textContent)") == ['Hướng dẫn nhanh', 'A'])
        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        check('Esc closes them all', await pg.evaluate("document.querySelectorAll('.ov').length") == 0)
        r = await pg.evaluate("(async()=>{ const p = modal({title:'X', dismissable:false}); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,50)); const n=document.querySelectorAll('.ov').length; document.querySelector('.ov').remove(); return n })()")
        check('Esc leaves a non-dismissable dialog open', r == 1)
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
