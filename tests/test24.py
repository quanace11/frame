import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8796'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# collapse rail / top bar / timeline into small floating buttons, persisted across reload
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8796/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        st = "()=>{const r=document.getElementById('stage').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]}"
        s0 = await pg.evaluate(st); print('stage before', s0)
        await pg.screenshot(path='t24_before.png')
        for k in ['rail','top','tl']:
            await pg.click(f'#{k}Hide'); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(200)
        s1 = await pg.evaluate(st); print('stage after', s1)
        assert s1[0] > s0[0] and s1[1] > s0[1], (s0, s1)
        vis = await pg.evaluate("['dockRail','dockTop','dockTl'].map(i=>!document.getElementById(i).hidden && document.getElementById(i).getBoundingClientRect().height>=44)")
        print('dock visible', vis); assert all(vis)
        print('dock label', await pg.inner_text('#dockTlLbl'))
        await pg.screenshot(path='t24_collapsed.png')
        # drawing still works with everything collapsed
        await pg.reload(); await pg.wait_for_timeout(900)
        s2 = await pg.evaluate(st); print('stage after reload', s2); assert s2 == s1
        await pg.tap('#dockTl'); await pg.wait_for_timeout(150)
        assert await pg.is_visible('#tl') and await pg.is_hidden('#dockTl')
        await pg.tap('#dockTop'); await pg.tap('#dockRail'); await pg.wait_for_timeout(200)
        s3 = await pg.evaluate(st); print('stage restored', s3); assert s3 == s0
        # floating panel close is remembered too
        await pg.evaluate("setTool('fx')"); await pg.click('#fxbar .pclose'); await pg.wait_for_timeout(100)
        await pg.reload(); await pg.wait_for_timeout(900)
        print('fx hidden kept', await pg.evaluate("panelHidden.fx"))
        await pg.evaluate("setTool('fx')"); await pg.wait_for_timeout(100)
        assert await pg.is_hidden('#fxbar') and await pg.is_visible('#panelPill')
        await pg.click('#panelPill'); assert await pg.is_visible('#fxbar')
        await pg.set_viewport_size({'width':1180,'height':820}); await pg.evaluate("setTool('brush')")
        for k in ['rail','top','tl']: await pg.click(f'#{k}Hide')
        await pg.wait_for_timeout(200); await pg.screenshot(path='t24_landscape.png')
        await b.close()
        print('ERR', errs)
asyncio.run(main()); srv.terminate()
