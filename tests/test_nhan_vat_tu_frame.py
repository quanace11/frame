import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8878'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# A character cut on frame 3 of an existing film shows from frame 3 on (frames 1–2 are left as they were),
# and 〰 Đường đi that repeats frames keeps the scene of the frame it starts on (a blank frame after it does not blink in).
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
PUPPIX = "(i=>{const f=S.frames[i],c=makeCanvas(W,H),x=c.getContext('2d');drawPuppet(x,f.pp,f.lip);const d=x.getImageData(0,0,W,H).data;let n=0;for(let k=3;k<d.length;k+=40)if(d[k]>0)n++;return n})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8878/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        for _ in range(3): await pg.evaluate("addFrame()"); await pg.wait_for_timeout(150)
        bg = await pg.evaluate("S.frames[0].bgId")
        await pg.evaluate("S.frames.forEach((f,i)=>{f.bgId=i===3?null:S.frames[0].bgId}); S.cur=2; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(200)
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        px = [await pg.evaluate(f"{PUPPIX}({i})") for i in range(4)]
        print('earlier frames untouched', px[0] == 0 and px[1] == 0, px)
        print('shown from the current frame on', px[2] > 100 and px[3] > 100)
        await pg.evaluate("ppRetween()"); print('still hidden after re-tweening', await pg.evaluate(f"{PUPPIX}(0)") == 0)
        await pg.evaluate("openTab('pp','frames')"); await pg.wait_for_timeout(200)
        await pg.fill('#ppPathN', '10'); await pg.click('#ppPathBtn')
        a = await pg.evaluate(D2S, [400, 1300]); z = await pg.evaluate(D2S, [800, 1300])
        await pg.evaluate(PEN, [[a[0] + (z[0]-a[0])*i/30, a[1]] for i in range(31)]); await pg.wait_for_timeout(1500)
        n = await pg.evaluate("S.frames.length"); print('path made 10 frames from frame 3', n == 12)
        bgs = await pg.evaluate("S.frames.map(f=>f.bgId)")
        print('added frames keep the scene of the start frame', all(x == bg for x in bgs[4:]), bgs)
        print('earlier frames still without the character', await pg.evaluate(f"{PUPPIX}(0)") == 0 and await pg.evaluate(f"!(S.frames[0].lip&&S.frames[0].lip.mv)"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
