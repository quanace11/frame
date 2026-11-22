import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8866'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# Soft joints (elbow/knee/shoulder/hip bend in a curve, like bones + mesh warp) and smooth playback (puppet pose
# interpolated between frames while playing / exporting). Drawn character on white -> auto cut -> bend + walk.
RENDER='''([pose, soft])=>{ const o=S.ppSoft; S.ppSoft=soft; const c=makeCanvas(W,H),x=c.getContext('2d'); drawPuppet(x,pose); S.ppSoft=o; return c; }'''
COVER='''([pose, soft, box])=>{ const o=S.ppSoft; S.ppSoft=soft; const c=makeCanvas(W,H),x=c.getContext('2d'); drawPuppet(x,pose); S.ppSoft=o;
  const [x0,y0,x1,y1]=box.map(Math.round), d=x.getImageData(x0,y0,x1-x0,y1-y0).data; const a=new Uint8Array(d.length/4); for(let k=0;k<a.length;k++) a[k]=d[k*4+3]; return Array.from(a); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8866/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        print('on by default', await pg.evaluate("S.ppSoft===true && S.ppSmooth===true"))
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        print('checkboxes reflect settings', await pg.evaluate("$('#ppSoftChk').checked && $('#ppSmoothChk').checked"))
        joints = await pg.evaluate("(()=>{const by={};S.pp.parts.forEach(p=>by[p.id]=p);return S.pp.parts.map(p=>p.role+':'+ppSoftJoints(p,by).length).join(' ')})()")
        print('soft joints', joints)
        # 1) at rest the soft drawing covers exactly what the rigid one does (no hairline seams between mesh cells)
        box = await pg.evaluate("(()=>{let x0=W,y0=H,x1=0,y1=0;S.pp.parts.forEach(p=>{x0=Math.min(x0,p.ox);y0=Math.min(y0,p.oy);x1=Math.max(x1,p.ox+p.c.width);y1=Math.max(y1,p.oy+p.c.height)});return [x0,y0,x1,y1]})()")
        ra = await pg.evaluate(COVER, [{}, False, box]); sa = await pg.evaluate(COVER, [{}, True, box])
        seam = sum(1 for r, s in zip(ra, sa) if r > 200 and s < 150); solid = sum(1 for r in ra if r > 200)
        print('rest pose: no seams', seam < solid * 0.001, seam, solid)
        # 2) bend both elbows and knees 75°: soft version keeps the joint filled (rigid pieces leave a notch on the outside)
        pose = await pg.evaluate("(()=>{const P={};for(const [r,a] of [['foreL',75],['foreR',-75],['shinL',-70],['shinR',70],['armL',20],['armR',-20]]){const p=S.pp.parts.find(q=>q.role===r); if(p) P[p.id]={r:a};} return P})()")
        el = await pg.evaluate("(pose)=>{const p=S.pp.parts.find(q=>q.role==='foreL'), M=ppMats(pose), c=mApply(M[p.id],p.px,p.py); return c}", pose)
        g = await pg.evaluate("(()=>{const p=S.pp.parts.find(q=>q.role==='foreL'); return ppGeom(p).wid})()")
        R = g * 1.2; eb = [el['x']-R, el['y']-R, el['x']+R, el['y']+R]
        def holes(a):
            return sum(1 for v in a if v < 100)
        hr = holes(await pg.evaluate(COVER, [pose, False, eb])); hs = holes(await pg.evaluate(COVER, [pose, True, eb]))
        print('bent elbow drawn', hs <= hr * 1.05 + 20, hr, hs)
        for soft in (False, True):
            url = await pg.evaluate("([pose,soft])=>{const o=S.ppSoft;S.ppSoft=soft;const c=makeCanvas(W,H),x=c.getContext('2d');x.fillStyle='#bfe3ff';x.fillRect(0,0,W,H);drawPuppet(x,pose);S.ppSoft=o;return c.toDataURL()}", [pose, soft])
            open('khopmem_bend_%s.png' % ('soft' if soft else 'rigid'), 'wb').write(base64.b64decode(url.split(',')[1]))
        # 3) smooth playback: pose between two frames is in between, holds stay still, ease "hold" snaps
        await pg.evaluate("ppPreset='walk'"); await pg.evaluate("ppMakePreset()"); await pg.wait_for_timeout(1200)
        n = await pg.evaluate("S.frames.length"); print('walk frames', n)
        mid = await pg.evaluate("""(()=>{const leg=S.pp.parts.find(q=>q.role==='legL').id, a=(S.frames[1].pp[leg]||{}).r||0, b=(S.frames[2].pp[leg]||{}).r||0, m=(ppPoseAt(1, S.frames[1].dur/2000, false)[leg]||{}).r||0;
          return [a,b,m]})()""")
        print('in-between pose', min(mid[0], mid[1]) - 0.01 <= mid[2] <= max(mid[0], mid[1]) + 0.01 and abs(mid[2]-mid[0]) > 0.5, [round(v,2) for v in mid])
        print('start of frame = its own pose', await pg.evaluate("JSON.stringify(ppPoseAt(1,0,false))===JSON.stringify(S.frames[1].pp)"))
        print('long frame holds, then blends', await pg.evaluate("(()=>{const f=S.frames[1],d=f.dur;f.dur=1000;const leg=S.pp.parts.find(q=>q.role==='legL').id;const a=(ppPoseAt(1,0.5,false)[leg]||{}).r, b=(ppPoseAt(1,0.95,false)[leg]||{}).r, r0=(f.pp[leg]||{}).r; f.dur=d; return Math.abs(a-r0)<1e-6 && Math.abs(b-r0)>0.1})()"))
        print('ease hold snaps', await pg.evaluate("(()=>{const f=S.frames[0],e=f.ppEase;f.ppEase='hold';const k=S.frames.slice(1).map(g=>g.ppKey);S.frames.slice(1).forEach(g=>g.ppKey=false);const r=ppPoseAt(1,0.09,false)===S.frames[1].pp;S.frames.slice(1).forEach((g,i)=>g.ppKey=k[i]);f.ppEase=e;return r})()"))
        print('last frame loops back to first', await pg.evaluate(f"(()=>{{const leg=S.pp.parts.find(q=>q.role==='legL').id,i={n}-1,a=(ppPoseAt(i,S.frames[i].dur/1000*0.99,true)[leg]||{{}}).r||0,z=(S.frames[0].pp[leg]||{{}}).r||0,l=(S.frames[i].pp[leg]||{{}}).r||0;return Math.abs(a-z)<Math.abs(l-z)}})()"))
        # 4) playback cache leaves the puppet out and draws it live; frames keep changing between frame flips
        await pg.evaluate("S.cur=0; startPlay()"); await pg.wait_for_timeout(500)
        print('playing with live puppet', await pg.evaluate("playing && S.frames[0].playKey.endsWith('s')"))
        await pg.screenshot(path='khopmem_play.png')
        await pg.evaluate("stopPlay()")
        url = await pg.evaluate("(()=>{const c=makeCanvas(W,H),x=c.getContext('2d'),base=makeCanvas(W,H);drawFrameBase(base.getContext('2d'),S.frames[1],bgOf(S.frames[1]),true);drawFrameFx(x,1,base,0.15,0.05,null,ppLiveOver(1,0.05,false));return c.toDataURL()})()")
        print('export frame composes', len(url) > 5000)
        # 5) toggles persist
        await pg.click('[data-t=pose]'); await pg.click('#ppSoftChk'); await pg.click('#ppSmoothChk')
        print('toggle off saved', await pg.evaluate("(()=>{const o=JSON.parse(localStorage.getItem('fs-settings'));return o.ppSoft===false&&o.ppSmooth===false})()"))
        await pg.evaluate("S.cur=0; startPlay()"); await pg.wait_for_timeout(300)
        print('smooth off -> baked cache', await pg.evaluate("!S.frames[0].playKey.endsWith('s')")); await pg.evaluate("stopPlay()")
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
