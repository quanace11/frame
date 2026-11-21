import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 👁 auto blink: eyes close every few seconds on existing frames, undo/redo, survives retween, save/reload, lip sync clear keeps it
srv = subprocess.Popen(['python3','-m','http.server','8841'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
CNT = "S.frames.filter(f=>f.lip&&f.lip.eb&&Object.values(f.lip.eb).some(a=>a>=1)).length"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1024,'height':1366})
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']}))")
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8841/index.html'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Làm video nhanh'); await pg.wait_for_timeout(400)
        async with pg.expect_file_chooser() as fc: await pg.click('[data-wz=char]')
        ch = await fc.value; await ch.set_files(os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(600)
        await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200); await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('.dlg').forEach(d=>d.remove())")
        # no eyes yet → friendly toast, nothing changes
        await pg.click('#ppBlinkBtn'); await pg.wait_for_timeout(200)
        print('no eyes → no dialog', await pg.evaluate("!document.querySelector('.dlg')"), await pg.evaluate(CNT) == 0)
        await pg.evaluate("ppSel = ppByRole('head').id; assetToPart('eyes', ['open','half','closed'])"); await pg.wait_for_timeout(500)
        print('eyes part', await pg.evaluate("ppEyeParts().length"), 'alts', await pg.evaluate("ppEyeParts()[0].alts.length"))
        # 4 s of frames (40 × 0.1s); frame 0 key, last key with a head turn so frames in between are auto tweened
        await pg.evaluate("(async()=>{ const f0=curFrame(); f0.dur=100; await ppInsertFrames(Array.from({length:39},()=>ppClone(f0.pp)),100); })(); 0"); await pg.wait_for_timeout(1500)
        print('frames', await pg.evaluate('S.frames.length'))
        await pg.click('#ppBlinkBtn'); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=Vừa'); await pg.wait_for_timeout(300)
        c = await pg.evaluate(CNT); print('blinks in 4s', c, 1 <= c <= 3, 'button on', await pg.evaluate("ppBlinkBtn.classList.contains('on')"))
        i = await pg.evaluate("S.frames.findIndex(f=>f.lip&&f.lip.eb&&Object.values(f.lip.eb).some(a=>a>=1))")
        diff = await pg.evaluate("""(i=>{ const f=S.frames[i], a=makeCanvas(W,H), b2=makeCanvas(W,H); drawPuppet(a.getContext('2d'), f.pp, f.lip); drawPuppet(b2.getContext('2d'), f.pp, null);
           const x=a.getContext('2d').getImageData(0,0,W,H).data, y=b2.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let k=3;k<x.length;k+=4) if(Math.abs(x[k-3]-y[k-3])+Math.abs(x[k-1]-y[k-1])>60) n++; return n; })""", i)
        print('blink frame draws closed eyes', diff > 30, diff)
        # retween (edit a key) keeps the blink overlay
        await pg.evaluate("S.frames[39].ppKey=true; const h=ppByRole('head'); (S.frames[39].pp[h.id]=S.frames[39].pp[h.id]||{}).r=12; ppRetween(); histRebase()")   # test-only edit: not an undo step of its own
        print('retween keeps blink', await pg.evaluate(CNT) == c)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); print('undo removes', await pg.evaluate(CNT) == 0)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300); print('redo restores', await pg.evaluate(CNT) == c)
        # clearing the voice keeps the blink
        await pg.evaluate("S.audio = S.audio || {}; S.audio.voice = {buf:new ArrayBuffer(8), frameId:S.frames[0].id}; S.frames[5].lip = {...(S.frames[5].lip||{}), pid: ppByRole('head').id, lv: 1}"); await pg.evaluate("voiceDel(0)")
        print('voice clear keeps blink', await pg.evaluate(CNT) == c, 'mouth lip cleared', await pg.evaluate("!S.frames.some(f=>f.lip&&f.lip.pid)"))
        # save + reload
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(2500)
        print('after reload', await pg.evaluate(CNT) == c)
        # turn off
        await pg.evaluate("setTool('puppet')"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.getElementById('ppBlinkBtn').click()"); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=Bỏ chớp mắt'); await pg.wait_for_timeout(200)
        print('off', await pg.evaluate(CNT) == 0)
        await pg.screenshot(path='t41.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
