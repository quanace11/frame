import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8879'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Gestures 🙏 Quỳ gối xin tha / 🙇 Quỳ gối vái lạy on a standing cut-out: the body drops, thighs point down, shins are squashed
# (pointing away from the camera) so the knees end on the ground; bowing leans the body while the legs stay put.
BOX = "(i=>{const f=S.frames[i],c=makeCanvas(W,H),x=c.getContext('2d');drawPuppet(x,f.pp,f.lip);const d=x.getImageData(0,0,W,H).data;let y0=H,y1=0;for(let y=0;y<H;y+=2)for(let k=0;k<W;k+=3)if(d[(y*W+k)*4+3]>40){if(y<y0)y0=y;if(y>y1)y1=y}return [y0,y1]})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8879/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("openTab('pp','frames')"); await pg.wait_for_timeout(200)
        names = await pg.evaluate("[...document.querySelectorAll('#ppGests button')].map(b=>b.textContent)")
        print('buttons', '🙏 Quỳ gối xin tha' in names and '🙇 Quỳ gối vái lạy' in names)
        y0, y1 = await pg.evaluate(f"{BOX}(0)"); hgt = y1 - y0
        ids = await pg.evaluate("Object.fromEntries(S.pp.parts.filter(p=>p.role).map(p=>[p.role,p.id]))")
        await pg.click('#ppGests >> text=Quỳ gối xin tha'); await pg.wait_for_timeout(1200)
        n = await pg.evaluate("S.frames.length"); print('beg frames made', n > 15, n)
        k0, k1 = await pg.evaluate(f"{BOX}(4)")
        print('kneeling: shorter, head lower', k0 > y0 + 0.08 * hgt, k0 - y0, hgt)
        print('knees on the ground (bottom stays near the feet)', abs(k1 - y1) < 0.08 * hgt, k1, y1)
        sy = await pg.evaluate(f"S.frames[4].pp['{ids['shinL']}'].sy")
        print('shins squashed', abs(sy - 0.18) < 0.02)
        ab = await pg.evaluate(f"ppCurAbs(S.frames[4], ppSelChar())"); ab7 = await pg.evaluate(f"ppCurAbs(S.frames[7], ppSelChar())")
        print('thighs point down', 80 < ab['legL'] < 110 and 75 < ab['legR'] < 100, ab['legL'], ab['legR'])
        print('hands come up in front', (ab7['foreL'] < 0 and (ab7['foreR'] > 180 or ab7['foreR'] < -90)), ab7['foreL'], ab7['foreR'])
        print('stays kneeling at the end', abs(await pg.evaluate(f"{BOX}({n-1})[0]") - k0) < 0.05 * hgt)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400); print('undo', await pg.evaluate("S.frames.length") == 1)
        await pg.click('#ppGests >> text=Quỳ gối vái lạy'); await pg.wait_for_timeout(1200)
        n = await pg.evaluate("S.frames.length"); print('kowtow frames made', n > 20, n)
        # the deepest bow: torso leaned, legs keep their screen angle
        tr = await pg.evaluate(f"S.frames.map(f=>(f.pp['{ids['torso']}']||{{}}).r||0)")
        kb = max(range(n), key=lambda i: abs(tr[i]))
        ab = await pg.evaluate(f"ppCurAbs(S.frames[{kb}], ppSelChar())")
        print('bows (body leans, head down)', abs(tr[kb]) > 8 and await pg.evaluate(f"(S.frames[{kb}].pp['{ids['head']}']||{{}}).r||0") > 10)
        print('legs stay on the ground while bowing', 80 < ab['legL'] < 110 and 75 < ab['legR'] < 100, ab['legL'], ab['legR'])
        b0, b1 = await pg.evaluate(f"{BOX}({kb})"); print('knees still on the ground', abs(b1 - y1) < 0.08 * hgt, b1, y1)
        await pg.evaluate(f"S.cur={kb}; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='quy_goi.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
