import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8875'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# ⭐ My motions (motion presets): save a run of frames, rebuild it from another starting pose / mirrored, kept across reloads.
ANG = "(i)=>{const a=ppCurAbs(S.frames[i],ppSelChar());return a}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8875/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        g = await pg.evaluate("Object.keys(GESTURES)[0]")
        await pg.evaluate(f"ppGesture('{g}')"); await pg.wait_for_timeout(800)
        n = await pg.evaluate("S.frames.length"); print('gesture frames', n)
        saved = [await pg.evaluate(ANG, i) for i in range(n)]
        await pg.evaluate("S.cur=0; updateFrameUI(); openTab('pp','frames')")
        await pg.click('#myMoSave'); await pg.wait_for_timeout(200); await pg.fill('#myMoName', 'Chào khán giả'); await pg.click('.dlg .btns >> text=Lưu'); await pg.wait_for_timeout(300)
        L = await pg.evaluate("myMoLoad()"); print('saved', len(L) == 1 and L[0]['name'] == 'Chào khán giả' and len(L[0]['frames']) == n)
        print('listed', await pg.evaluate("$('#myMoSel').options.length===1 && $('#myMoSel').textContent.includes('Chào')"))
        # new film: one frame, different starting pose -> apply rebuilds the same limb angles
        await pg.evaluate("(async()=>{S.frames.splice(1); S.cur=0; buildStrip(); const f=curFrame(); f.pp={}; ppApplyAbs(f,BUILTIN_POSES.spread.abs,ppSelChar()); updateFrameUI();})()"); await pg.wait_for_timeout(300)
        await pg.click('#myMoApply'); await pg.wait_for_timeout(800)
        n2 = await pg.evaluate("S.frames.length"); print('applied frames', n2 == n)
        got = [await pg.evaluate(ANG, i) for i in range(n2)]
        err = max(abs(((got[i][r] - saved[i][r] + 180) % 360) - 180) for i in range(n) for r in saved[i] if r in got[i])
        print('same limb angles', err < 1.5, round(err, 2))
        if err>=1.5: print([(i,r,round(saved[i][r]),round(got[i][r])) for i in range(n) for r in saved[i] if r in got[i] and abs(((got[i][r]-saved[i][r]+180)%360)-180)>1.5][:12]); print(await pg.evaluate('S.frames.map(f=>f.ppKey)'))
        # mirrored: left/right swapped and angles reflected
        await pg.evaluate("S.frames.splice(1); S.cur=0; buildStrip(); curFrame().pp={}; updateFrameUI()"); await pg.check('#gestMir')
        await pg.click('#myMoApply'); await pg.wait_for_timeout(800)
        k = n // 2; gm = await pg.evaluate(ANG, k)
        merr = max(abs(((gm['armL'] - (180 - saved[k]['armR']) + 180) % 360) - 180), abs(((gm['armR'] - (180 - saved[k]['armL']) + 180) % 360) - 180))
        print('mirrored', merr < 1.5, round(merr, 2)); await pg.uncheck('#gestMir')
        # survives reload (any project)
        await pg.reload(); await pg.wait_for_timeout(1200)
        print('kept after reload', await pg.evaluate("myMoLoad().length===1"))
        await pg.evaluate("openTab('pp','frames'); myMoSync()")
        await pg.evaluate("$('#myMoDel').click()"); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Xoá'); await pg.wait_for_timeout(200)
        print('deleted', await pg.evaluate("myMoLoad().length===0"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
