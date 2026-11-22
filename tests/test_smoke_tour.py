import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# Smoke tour (nghiệm thu nhanh mọi tính năng): in real Chrome, at iPad landscape + portrait, with a drawn frame,
#  1. every rail tool, and every tab of its panel,
#  2. every Menu item (opened from a fresh Menu, then its dialog closed),
#  3. the main dialogs of the top bar,
# must open without a page error, must not make the page scroll sideways, and the Menu must stay reachable.
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9120'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
CLOSE_ALL = "(()=>{let n=0; while(document.querySelector('.ov')&&n<6){document.querySelector('.ov').remove(); n++;} document.querySelectorAll('.pop').forEach(p=>p.classList.remove('open')); return n;})()"
# Menu items that only open a native file picker / start a download or a long export: checked for existence only
SKIP_M = {'vidframes', 'open', 'img', 'export', 'video', 'update'}
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for (nm, w, h) in [('land', 1366, 1024), ('port', 820, 1180)]:
            pg = await b.new_page(viewport={'width': w, 'height': h})
            pe = []; pg.on('pageerror', lambda e, pe=pe: pe.append(str(e)))
            await pg.goto('http://localhost:9120/index.html'); await pg.wait_for_timeout(1200)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
            await pg.evaluate(PEN, [[[150 + i * 6, 200 + (i % 7) * 9] for i in range(30)]]); await pg.wait_for_timeout(300)
            await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
            def chk(where):
                if pe: errs.append(f'{nm} {where}: {pe[:2]}'); pe.clear()
            # 1. rail tools + their tabs
            for t in await pg.evaluate("[...document.querySelectorAll('#rail .tool[data-tool]')].map(e=>e.dataset.tool)"):
                await pg.click(f'#rail .tool[data-tool="{t}"]'); await pg.wait_for_timeout(250); chk('tool ' + t)
                tabs = await pg.evaluate("[...document.querySelectorAll('[data-tabs] .tabb')].filter(e=>e.offsetParent).map(e=>e.parentElement.dataset.tabs+':'+e.dataset.t)")
                for tb in tabs:
                    g, k = tb.split(':')
                    await pg.click(f'[data-tabs="{g}"] .tabb[data-t="{k}"]'); await pg.wait_for_timeout(200); chk(f'tab {t}/{tb}')
                    hs = await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                    if hs: errs.append(f'{nm} tab {tb}: page scrolls sideways')
                await pg.screenshot(path=f'smoke_{nm}_{t}.png')
                await pg.evaluate(CLOSE_ALL)
            await pg.click('#rail .tool[data-tool="brush"]')
            # 2. Menu items
            items = await pg.evaluate("(()=>{document.getElementById('menuBtn').click(); const m=[...document.querySelectorAll('.ov [data-m]')].map(e=>e.dataset.m); document.querySelector('.ov').remove(); return m})()")
            if len(items) < 15: errs.append(f'{nm} menu items {items}')
            vis = await pg.evaluate("(()=>{const r=document.getElementById('menuBtn').getBoundingClientRect(); return r.bottom<=innerHeight+1 && r.height>20})()")
            rail_scroll = await pg.evaluate("(()=>{const r=document.getElementById('rail'); return r.scrollHeight>r.clientHeight})()")
            if not vis and not rail_scroll: errs.append(f'{nm} Menu button out of reach')
            for m in items:
                if m in SKIP_M or m in ('delall', 'new916', 'new169'): continue
                await pg.evaluate(f"(()=>{{document.getElementById('menuBtn').click(); document.querySelector('.ov [data-m=\"{m}\"]').click();}})()")
                await pg.wait_for_timeout(500); chk('menu ' + m)
                if m in ('help', 'projects', 'sync', 'scene', 'cover', 'aifx'): await pg.screenshot(path=f'smoke_{nm}_m_{m}.png')
                await pg.evaluate(CLOSE_ALL); await pg.wait_for_timeout(100)
            # 3. top bar dialogs
            for sel in ['#assetBtn', '#aiCharBtn', '#aiFxBtn', '#wizBtn', '#projBtn', '#brushBtn', '#colorBtn']:
                if not await pg.evaluate(f"!!document.querySelector('{sel}') && !!document.querySelector('{sel}').offsetParent"): continue
                await pg.click(sel); await pg.wait_for_timeout(400); chk('top ' + sel)
                await pg.evaluate(CLOSE_ALL); await pg.keyboard.press('Escape')
            # still alive: undo/redo + playback
            await pg.click('#undoBtn'); await pg.click('#redoBtn'); await pg.wait_for_timeout(200)
            await pg.evaluate('startPlay ? startPlay() : null'); await pg.wait_for_timeout(600); await pg.evaluate('stopPlay()'); chk('play')
            print(nm, 'tools ok, menu items', len(items))
            await pg.close()
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
