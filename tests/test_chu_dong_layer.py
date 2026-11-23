import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9151'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# Gõ dấu cách trong ô chữ (phím Space không được bật Phát) + dòng 🔤 chữ trên Dòng layer: kéo 2 đầu thanh để chữ hiện qua nhiều frame
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.tabhide{display:revert!important}';document.head.append(s)})")
        await pg.goto('http://localhost:9151/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("setDur(100, true)")
        for _ in range(7): await pg.evaluate('addFrame()')
        await pg.wait_for_timeout(300); await pg.evaluate('selectFrame(1)'); await pg.wait_for_timeout(200)
        # type text with spaces in the Thêm chữ box
        await pg.evaluate("setTool('fx'); openTab('fx','text')"); await pg.wait_for_timeout(200)
        await pg.click('#fxAddTxt'); await pg.wait_for_timeout(300)
        await pg.click('#fxTxtIn'); await pg.keyboard.type('XIN CHAO BAN'); await pg.wait_for_timeout(100)
        ok('space types into the text box', await pg.evaluate("document.getElementById('fxTxtIn').value") == 'XIN CHAO BAN', await pg.evaluate("document.getElementById('fxTxtIn').value"))
        ok('space did not start playing', not await pg.evaluate('playing'))
        await pg.keyboard.type('b'); ok('a letter does not switch tool', await pg.evaluate("S.tool") == 'fx', await pg.evaluate("S.tool"))
        await pg.keyboard.press('Backspace')
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        ok('text saved with spaces', await pg.evaluate("curFrame().texts[0].str") == 'XIN CHAO BAN')
        # Dòng layer shows a 🔤 row for it
        await pg.click('#lgBtn'); await pg.wait_for_timeout(300)
        ri = await pg.evaluate("lgRows().findIndex(r=>r.tx)")
        ok('Dòng layer has a text row', ri >= 0 and await pg.evaluate("lgRows()[%d].name" % ri) == '🔤 XIN CHAO BAN', await pg.evaluate("lgRows().map(r=>r.name)"))
        tid = await pg.evaluate("curFrame().texts[0].id")
        SP = "lgTxSpans('%s').map(s=>[s.a+1,s.b+1])" % tid
        ok('text on frame 2 only', await pg.evaluate(SP) == [[2, 2]], await pg.evaluate(SP))
        pos = lambda i: pg.evaluate('''(()=>{const cv=$('#lgCv'), r=cv.getBoundingClientRect(); return {y:r.top+LG.hd+%d*LG.rh+LG.rh/2, x:r.left+%d*LG.cw+LG.cw/2}})()''' % (ri, i))
        await pg.wait_for_timeout(600)
        a = await pos(1); c = await pos(5)
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(c['x'], c['y'], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(500)
        ok('drag the end: text on frames 2–6', await pg.evaluate(SP) == [[2, 6]], await pg.evaluate(SP))
        ok('copies keep the words', await pg.evaluate("S.frames[5].texts[0].str") == 'XIN CHAO BAN')
        await pg.screenshot(path='chu_dong_layer.png')
        # drag the start back to frame 1
        a = await pos(1); c = await pos(0)
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(c['x'] - 2, c['y'], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(500)
        ok('drag the start: frames 1–6', await pg.evaluate(SP) == [[1, 6]], await pg.evaluate(SP))
        await pg.wait_for_timeout(600)
        # shrink the end to frame 3
        a = await pos(5); c = await pos(2)
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(c['x'], c['y'], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(500)
        ok('shrink: frames 1–3', await pg.evaluate(SP) == [[1, 3]], await pg.evaluate(SP))
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(400)
        ok('undo puts frames 1–6 back', await pg.evaluate(SP) == [[1, 6]], await pg.evaluate(SP))
        # tap the row = that frame + text tool with the text picked
        await pg.evaluate("setTool('brush'); fxSel=null"); a = await pos(4); await pg.mouse.click(a['x'], a['y']); await pg.wait_for_timeout(300)
        ok('tap picks the text at that frame', await pg.evaluate("S.cur===4 && S.tool==='fx' && fxSel===%r" % tid))
        # Space outside a text box still plays
        await pg.evaluate("document.activeElement && document.activeElement.blur()"); await pg.keyboard.press('Space'); await pg.wait_for_timeout(200)
        ok('Space on the canvas still plays', await pg.evaluate('playing')); await pg.evaluate('stopPlay()')
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
