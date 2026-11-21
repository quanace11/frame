import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8781'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)+' @@ '+(e.stack or '')[:300]))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8781/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ')
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        # puppet with mouth part
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='head').id; ppSyncBar();}")
        await pg.click('#ppKeep'); await pg.click('#ppCutBtn')
        m = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='head');return [p.ox+p.c.width*0.5,p.oy+p.c.height*0.7]})()")
        await pg.evaluate(PEN,[[await d2s(m[0]+60*math.cos(t/10*6.283), m[1]+28*math.sin(t/10*6.283)) for t in range(11)]]); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const r=document.getElementById('ppRole'); r.value='mouth'; r.dispatchEvent(new Event('change'));}")
        await pg.set_input_files('#ppVarFile',os.path.join(ASSETS,'mouth_open.png')); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{const p=S.pp.parts.find(x=>x.role==='mouth'); const f=curFrame(); delete f.pp[p.id].v;}")
        # fx tool
        await pg.click('[data-tool=fx]'); await pg.wait_for_timeout(200)
        await pg.click('#fxAddTxt'); await pg.fill('#fxTxtIn','COME BACK!'); await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        print('texts', await pg.evaluate('curFrame().texts.map(t=>[t.str,t.style])'))
        t = await pg.evaluate('(()=>{const t=curFrame().texts[0];return [t.x,t.y]})()')
        await pg.evaluate(PEN,[[await d2s(*t), await d2s(t[0]+100,t[1]+50)]]); await pg.wait_for_timeout(200)
        print('moved', await pg.evaluate('(()=>{const t=curFrame().texts[0];return [Math.round(t.x),Math.round(t.y)]})()'))
        # voice + lip sync (adds frames)
        await pg.set_input_files('#voiceFile',os.path.join(ASSETS,'voice.wav')); await pg.wait_for_timeout(500)
        await pg.click('#fxLip'); await pg.wait_for_selector('text=Thêm frame', timeout=10000); await pg.click('.dlg .btns >> text=Thêm frame'); await pg.wait_for_timeout(2000)
        print('frames', await pg.evaluate('S.frames.length'), 'lip', await pg.evaluate('S.frames.map(f=>f.lip&&f.lip.m?Object.values(f.lip.m)[0]:"-").join(",")'))
        # music + sfx at frame 3, camera key zoom at frame 8
        await pg.set_input_files('#musicFile',os.path.join(ASSETS,'music.wav')); await pg.wait_for_timeout(500)
        await pg.click('.fr >> nth=3'); await pg.wait_for_timeout(200)
        await pg.click('text=🔊 Bụp'); await pg.wait_for_timeout(300)
        await pg.click('.fr >> nth=8'); await pg.wait_for_timeout(200)
        await pg.click('#fxPick'); head = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='head');return [p.px,p.py-150]})()")
        await pg.evaluate(PEN,[[await d2s(*head)]]); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{const s=document.getElementById('fxShake'); s.value=20; s.dispatchEvent(new Event('change'));}")
        print('cam', await pg.evaluate('[0,4,8,12].map(i=>{const c=camAt(i);return +c.z.toFixed(2)})'))
        await pg.screenshot(path='c1.png')
        # play briefly
        await pg.click('#playBtn'); await pg.wait_for_timeout(1200); await pg.screenshot(path='c2.png'); await pg.click('#playBtn')
        # export video
        t0=time.time(); await pg.click('#videoBtn')
        await pg.wait_for_selector('text=Video đã xong', timeout=120000); print('video secs', round(time.time()-t0,1), await pg.inner_text('.dlg .body'))
        async with pg.expect_download() as dl: await pg.click('text=Lưu video')
        d=await dl.value; path='out_video.'+d.suggested_filename.split('.')[-1]; await d.save_as(path); print('saved', path)
        # undo text move/persist
        await pg.wait_for_timeout(2200); await pg.reload(); await pg.wait_for_timeout(2500)
        print('reload: audio', await pg.evaluate('!!(S.audio&&S.audio.music&&S.audio.voice)'), 'sfx', await pg.evaluate('S.audio.sfx.length'), 'texts f0', await pg.evaluate('S.frames[0].texts.length'), 'cam keys', await pg.evaluate('S.frames.filter(f=>f.cam).length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
