import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8796'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
# Character builder (Đầu To style): dialog → puppet with roles, quick faces, gestures, edit keeps poses, lip count; drawing aids: ink taper + bold outline
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='.tabhide{display:flex!important}';document.head.append(st);});")
        await pg.goto('http://localhost:8796/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # every option and every face renders something
        bad = await pg.evaluate('''(()=>{const bad=[];const nz=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=16)if(d[i])n++;return n;};
          for(const [k,[,opts]] of Object.entries(CB_CHOICES))for(const v of Object.keys(opts)){const c=cbPreview({...CB_DEFAULT,[k]:v},150,270);if(nz(c)<500)bad.push(k+'='+v);}
          for(const e of Object.keys(CB_EXPR)){const c=cbPreview(CB_DEFAULT,150,270,e);if(nz(c)<500)bad.push('expr '+e);}return bad;})()''')
        print('bad options', bad); assert not bad
        t = await pg.evaluate("(()=>{const t=performance.now();cbPreview(cbRandom(),300,540);return performance.now()-t;})()")
        print('preview ms', round(t)); assert t < 1500
        # dialog: pick options, random, create
        await pg.click('#cbBtn'); await pg.wait_for_timeout(300)
        await pg.click('[data-cbk="hair"][data-v="curly"]'); await pg.click('[data-cbk="pattern"][data-v="stripes"]'); await pg.click('[data-cbe="rage"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='cb_dialog.png')
        await pg.click('.dlg .btns >> text=Tạo nhân vật cử động được'); await pg.wait_for_function('S.pp && S.pp.parts.length===12', timeout=15000); await pg.wait_for_timeout(300)
        info = await pg.evaluate("S.pp.parts.map(p=>p.role).sort().join(',')")
        print('roles', info); assert info == 'armL,armR,eyes,foreL,foreR,head,legL,legR,mouth,shinL,shinR,torso'
        assert await pg.evaluate("S.pp.parts.find(p=>p.role==='eyes').alts.length") == 11
        assert await pg.evaluate("S.pp.parts.find(p=>p.role==='torso').asset.cb.hair") == 'curly'
        assert await pg.evaluate("!document.getElementById('cbExprWrap').hidden")
        await pg.screenshot(path='cb_made.png')
        # quick face on this frame, undo/redo
        await pg.evaluate("cbSetExpr('shock')"); await pg.wait_for_timeout(200)
        v = await pg.evaluate("(()=>{const f=curFrame(),e=S.pp.parts.find(p=>p.role==='eyes'),m=S.pp.parts.find(p=>p.role==='mouth');return [e.asset.keys[f.pp[e.id].v], m.asset.keys[f.pp[m.id].v]];})()")
        print('face', v); assert v == ['shock', 'o']
        await pg.evaluate('undo()'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("(()=>{const f=curFrame(),e=S.pp.parts.find(p=>p.role==='eyes');return !(f.pp[e.id]&&f.pp[e.id].v);})()")
        await pg.evaluate('redo()')
        # built-in gesture + walk preset work on the built character
        await pg.evaluate("ppGesture('cheer')"); await pg.wait_for_timeout(1500)
        n = await pg.evaluate('S.frames.length'); print('frames after gesture', n); assert n > 5
        await pg.evaluate("selectFrame(3)"); await pg.wait_for_timeout(400)
        arm = await pg.evaluate("Math.round(ppCurAbs(curFrame(), ppSelChar()).armR)"); print('armR angle', arm); assert arm < 0
        await pg.screenshot(path='cb_cheer.png')
        # talk preset uses only the 2 lip shapes (closed/half/open), not every mouth picture
        vs = await pg.evaluate("(()=>{const m=ppByRole('mouth');const out=new Set();for(let k=0;k<6;k++){const P=ppPresetPose('talk',k,6,{},600);out.add((P[m.id]||{}).v||0);}return [...out].sort();})()")
        print('talk mouths', vs); assert max(vs) <= 2
        # edit: change shirt colour, poses stay
        before = await pg.evaluate("JSON.stringify(S.frames[3].pp)")
        await pg.click('#cbEdit'); await pg.wait_for_timeout(300)
        await pg.click('[data-cbc="c1"][data-v="#1f6fe0"]')
        await pg.click('.dlg .btns >> text=Cập nhật nhân vật'); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("S.pp.parts.find(p=>p.role==='torso').asset.cb.c1") == '#1f6fe0'
        assert await pg.evaluate("JSON.stringify(S.frames[3].pp)") == before
        assert await pg.evaluate("S.pp.parts.length") == 12
        # second character added next to the first
        await pg.evaluate("void cbCreate(cbRandom())"); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Thêm nhân vật'); await pg.wait_for_function('S.pp.parts.length===24', timeout=15000); await pg.wait_for_timeout(300)
        assert await pg.evaluate("S.pp.parts.length") == 24
        await pg.screenshot(path='cb_two.png')
        # drawing aids: ink taper makes the stroke ends thinner than the middle
        await pg.evaluate("setTool('brush'); setLayer('char'); selectFrame(0); S.size=30; S.pressure=false; S.taper=true; updateToggles()"); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const c=curFrame().canvas.getContext('2d');c.clearRect(0,0,W,H);})()")
        pts = [[300 + i * 10, 300] for i in range(50)]
        await pg.evaluate(PEN, [pts]); await pg.wait_for_timeout(300)
        th = await pg.evaluate('''(()=>{const c=curFrame().canvas.getContext('2d');const col=x=>{let n=0;for(let y=0;y<H;y+=1){if(c.getImageData(x,y,1,1).data[3]>128)n++;}return n;};
          const r=document.getElementById('view').getBoundingClientRect();const a=scrToDoc(r.left+310,r.top+300),m=scrToDoc(r.left+545,r.top+300);return [col(Math.round(a.x)),col(Math.round(m.x))];})()''')
        print('taper end/mid', th); assert th[0] < th[1] * 0.7 and th[1] > 10
        # bold outline: adds dark pixels around a filled shape, undo restores
        await pg.evaluate("(()=>{const c=curFrame().canvas.getContext('2d');c.clearRect(0,0,W,H);c.fillStyle='#ffd21f';c.beginPath();c.arc(540,900,150,0,7);c.fill();markEdited(curFrame());})()")
        await pg.click('#boldBtn'); await pg.wait_for_timeout(200); await pg.click('[data-bor="14"]')
        await pg.click('.dlg .btns >> text=Thêm viền'); await pg.wait_for_timeout(800)
        px = await pg.evaluate("Array.from(curFrame().canvas.getContext('2d').getImageData(540+158,900,1,1).data)")
        print('outline px', px); assert px[3] > 200 and px[0] < 80
        await pg.evaluate('undo()'); await pg.wait_for_timeout(300)
        assert await pg.evaluate("curFrame().canvas.getContext('2d').getImageData(540+158,900,1,1).data[3]") == 0
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
