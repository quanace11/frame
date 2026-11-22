import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8779'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8779/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ')
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        print('proj', await pg.evaluate('[curProjId!=null, S.projName]'))
        # puppet, split limbs
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.check('#ppSplit'); await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        print('parts', await pg.evaluate('S.pp.parts.map(p=>p.role)'))
        # IK: drag right forearm hand to a target
        await pg.click('[data-ppd=ik]')
        info = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='foreR');return {tip:p.tip, px:p.px,py:p.py}})()")
        tip=info['tip']; target=[tip['x']-180, tip['y']+150]
        path=[await d2s(tip['x']+(target[0]-tip['x'])*t/10, tip['y']+(target[1]-tip['y'])*t/10) for t in range(11)]
        await pg.evaluate(PEN,[path]); await pg.wait_for_timeout(200)
        hand = await pg.evaluate("(()=>{const f=curFrame(),p=S.pp.parts.find(x=>x.role==='foreR'),M=ppMats(f.pp);return mApply(M[p.id],p.tip.x,p.tip.y)})()")
        print('IK target', [round(v) for v in target], 'hand', [round(hand['x']),round(hand['y'])])
        # keyframes: frame1 = after IK (key). dup -> frame2 apply pose cheer
        await pg.click('#dupBtn'); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='torso').id; ppSyncBar(); const s=document.getElementById('ppPoseSel'); s.value='b:cheer';}")
        await pg.click('#ppPoseApply'); await pg.wait_for_timeout(200)
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(200)
        await pg.click('#ppTweenBtn'); await pg.wait_for_timeout(500)
        keys = await pg.evaluate('S.frames.map(f=>ppIsKey(f))'); print('keys', keys)
        armR = lambda: pg.evaluate("S.frames.map(f=>{const id=S.pp.parts.find(x=>x.role==='armR').id; return Math.round((f.pp[id]||{}).r||0)})")
        print('armR r before edit', await armR())
        # edit last key: rotate armR via slider on frame 5
        await pg.click('.fr >> nth=4'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='armR').id; ppSyncBar(); const r=document.getElementById('ppRot'); r.value=-120; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));}")
        print('armR r after editing key', await armR())
        # ease bounce on first key
        await pg.click('.fr >> nth=0'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{const e=document.getElementById('ppEase'); e.value='back'; e.dispatchEvent(new Event('change'));}")
        print('armR r with back ease', await armR())
        await pg.click('#undoBtn'); await pg.wait_for_timeout(200); print('after undo ease', await armR())
        # flip + save pose
        await pg.click('#ppFlipChar'); await pg.wait_for_timeout(200)
        print('flip torso', await pg.evaluate("(curFrame().pp[S.pp.parts.find(x=>!x.parent).id]||{}).fl"))
        # projects: create new, then reopen old
        await pg.wait_for_timeout(2000)
        old = await pg.evaluate('curProjId')
        await pg.evaluate("createProject(1080,1920,'Bài 2')"); await pg.wait_for_timeout(800)
        print('new proj frames', await pg.evaluate('S.frames.length'), await pg.evaluate('S.projName'), 'pp', await pg.evaluate('!!S.pp'))
        await pg.evaluate(f"openProject('{old}')"); await pg.wait_for_timeout(2000)
        print('reopened frames', await pg.evaluate('S.frames.length'), 'pp', await pg.evaluate('S.pp && S.pp.parts.length'), 'keys', await pg.evaluate('S.frames.map(f=>ppIsKey(f))'))
        print('index', await pg.evaluate('projIndex().then(l=>l.map(x=>x.name+":"+x.frames))'))
        await pg.click('#projBtn'); await pg.wait_for_timeout(500); await pg.screenshot(path='a1.png')
        await pg.reload(); await pg.wait_for_timeout(2000)
        print('after reload proj', await pg.evaluate('S.projName'), await pg.evaluate('S.frames.length'))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
