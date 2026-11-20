import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8802'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Drawn full-body character on a white background, arms hanging beside the body (hands touch the shorts):
# import -> Nhân vật ghép -> joints -> auto cut -> walk. Checks the joints, the cut and that swinging arms leave no hole in the shirt.
HOLES='''(i)=>{ const f=S.frames[i], tor=S.pp.parts.find(p=>p.role==='torso'); const c=makeCanvas(W,H),x=c.getContext('2d'); drawPuppet(x,f.pp);
  const x0=Math.round(tor.ox+tor.c.width*0.25), x1=Math.round(tor.ox+tor.c.width*0.75), y0=Math.round(tor.oy+tor.c.height*0.25), y1=Math.round(tor.oy+tor.c.height*0.55);
  const d=x.getImageData(x0,y0,x1-x0,y1-y0).data; let t=0; for(let k=3;k<d.length;k+=4) if(d[k]<128) t++; return t/(d.length/4); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8802/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=cari]'); await pg.wait_for_timeout(300)
        print('cari on drawing: keeps own colours', await pg.evaluate("document.querySelector('[data-cs].on').dataset.cs") == 'orig')
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        print('plain background -> colour cut', await pg.evaluate("document.querySelector('[data-cm].on').dataset.cm") == 'color')
        await pg.wait_for_timeout(300); await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        J = await pg.evaluate("ppSetup.J")
        print('split limbs by default', await pg.evaluate("document.querySelector('#ppSplit').checked"))
        print('elbows on the arms, outside the shoulders', J['elL']['x'] < J['shL']['x'] - 5 and J['elR']['x'] > J['shR']['x'] + 5)
        hgt = max(J['ftL']['y'], J['ftR']['y']) - J['head']['y']
        print('hips at the legs, not the hands', J['hpL']['y'] > J['chest']['y'] + 0.3*hgt and J['hpL']['x'] < J['hpR']['x'] and abs((J['hpL']['x']+J['hpR']['x'])/2 - J['chest']['x']) < 0.06*hgt)
        await pg.click('#ppCutAuto'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        print('parts', await pg.evaluate("S.pp.parts.length"), 'arms in front of the body', await pg.evaluate("(()=>{const z=r=>S.pp.parts.find(p=>p.role===r).z; return z('armL')>z('torso') && z('armR')>z('torso')})()"))
        await pg.evaluate("ppPreset='walk'"); await pg.evaluate("ppMakePreset()"); await pg.wait_for_timeout(1200)
        worst = max([await pg.evaluate(HOLES, i) for i in range(await pg.evaluate('S.frames.length'))])
        print('no hole in the shirt while walking', worst < 0.02, round(worst, 4))
        url = await pg.evaluate("(()=>{const c=makeCanvas(W,H),x=c.getContext('2d');x.fillStyle='#8cf';x.fillRect(0,0,W,H);drawPuppet(x,S.frames[2].pp);return c.toDataURL()})()")
        open('drawn_walk2.png','wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
