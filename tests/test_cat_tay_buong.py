import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9887'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Tự cắt a cartoon player with thick outlines and arms hanging close to the shorts (tests/assets/footballer_outline.png,
# original design drawn by code). Before: the generic hand height landed on the thigh, the shorts' sides were cut out as
# the forearms and the forearm's outline as a long strip of the upper arm, so walking tore the shorts away with the hands.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9887/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'footballer_outline.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
        J = await pg.evaluate("ppSetup.J")
        print('hands found on the hands, not on the thighs', all(abs(J['ha' + s]['x'] - J['root']['x']) > 150 for s in 'LR') and all(J['ha' + s]['y'] < J['hpL']['y'] + 0.12 * 1920 for s in 'LR'), J['haL'], J['haR'])
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        sz = await pg.evaluate("Object.fromEntries(S.pp.parts.map(p=>[p.role,[p.c.width,p.c.height]]))")
        print('forearms hold no piece of the shorts', sz['foreL'][0] < 120 and sz['foreR'][0] < 120, sz['foreL'], sz['foreR'])
        below = await pg.evaluate("['L','R'].map(s=>{ const a=S.pp.parts.find(p=>p.role==='arm'+s), f=S.pp.parts.find(p=>p.role==='fore'+s); return Math.round(a.oy+a.c.height-f.py) })")
        print('upper arms carry no strip of outline down the forearm', max(below) < 70, below)
        print('shorts stay on the body', sz['torso'][1] > 480)
        # walk: the shorts' outer corners are filled in behind the thighs (no white notch at the hem)
        await pg.evaluate("openTab('pp','frames')"); await pg.click('[data-walk="1"]')
        await pg.wait_for_function('S.frames.length > 5', timeout=20000); await pg.wait_for_timeout(400)
        holes = await pg.evaluate("""(async()=>{ const out=[]; for (const i of [1,2,3]) { const f=S.frames[i]; await ensureLoaded(f); const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); x.fillStyle='#00ff00'; x.fillRect(0,0,W,H); drawPuppet(x, ppPoseFor(f), f);
            // torso piece's own pixels: count see-through pixels inside the torso's outline box (mid band of the shorts)
            const t=S.pp.parts.find(p=>p.role==='torso'), M=ppMats(ppPoseFor(f))[t.id], a=t.c.getContext('2d').getImageData(0,0,t.c.width,t.c.height).data; let n=0, k=0;
            for (let y=Math.round(t.c.height*0.86); y<Math.round(t.c.height*0.97); y++) { let l=-1,r=-1; for (let xx=0; xx<t.c.width; xx++) if (a[(y*t.c.width+xx)*4+3]>200) { if (l<0) l=xx; r=xx; } for (let xx=l; xx<=r && l>=0; xx++) { k++; if (a[(y*t.c.width+xx)*4+3]<100) n++; } }
            out.push(n/Math.max(1,k)); } return out })()""")
        print('shorts have no see-through notches', max(holes) < 0.02, holes)
        await pg.evaluate("S.cur=2; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='cat_tay_buong.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
