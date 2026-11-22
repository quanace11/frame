import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8965'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# UX kiểu Animate trên tablet: bảng Ghép nằm bên phải ở màn ngang rộng (khung vẽ không bị bé), ảnh mới không đè lên nhau,
# ngón tay kéo được 8 chấm, mở Dòng layer thì thu dòng hình frame
PT='''async ([pts,typ])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:9,pointerType:typ,isPrimary:true,clientX:r.left+x,clientY:r.top+y,pressure:0.5,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',...pts[0])); for(const p of pts.slice(1)){v.dispatchEvent(mk('pointermove',...p)); await new Promise(r=>setTimeout(r,16));}
  v.dispatchEvent(mk('pointerup',...pts.at(-1)));}'''
FIG='''async ([col,name])=>{const c=document.createElement('canvas');c.width=300;c.height=600;const x=c.getContext('2d');x.fillStyle=col;x.beginPath();x.arc(150,90,80,0,7);x.fill();x.fillRect(90,170,120,250);x.fillRect(95,420,40,170);x.fillRect(165,420,40,170);await imgToLayer(c,null,name)}'''
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        errs=[]
        for W, H in [(1366, 1024), (1024, 1366)]:
            land = W > H
            ctx = await b.new_context(viewport={'width':W,'height':H}, has_touch=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8965/index.html'); await pg.wait_for_timeout(1000)
            await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
            for col, nm in [('#e53935','A'),('#1e88e5','B'),('#43a047','C')]:
                await pg.evaluate(FIG, [col, nm]); await pg.wait_for_timeout(150)
            cx = await pg.evaluate('lyrOrder().map(r=>Math.round(r.ox + r.c.width/2))')
            ok(f'{W}: new layers stand side by side', len(set(cx)) == 3 and min(abs(a-b) for i,a in enumerate(cx) for b in cx[i+1:]) > 150, cx)
            await pg.click('#lgBtn'); await pg.wait_for_timeout(400)
            ok(f'{W}: Dòng layer folds the frame pictures', await pg.evaluate("document.getElementById('tl').classList.contains('collapsed')"))
            pr = await pg.evaluate("(()=>{const s=stage.getBoundingClientRect(),p=document.getElementById('ppbar').getBoundingClientRect(),l=document.getElementById('lyrPanel').getBoundingClientRect();return {sw:s.width,sh:s.height,pl:p.left-s.left,pw:p.width,ph:p.height,lr:l.right-s.left}})()")
            # the frame on screen: height in css px
            fh = await pg.evaluate('H*vs/DPR'); fx = await pg.evaluate('[vtx/DPR, (W*vs+vtx)/DPR]')
            if land:
                ok('landscape: Ghép docks on the right', pr['pl'] > pr['sw'] * 0.6 and pr['ph'] > pr['sh'] * 0.8, pr)
                ok('landscape: frame sits between the panels', fx[0] >= pr['lr'] - 2 and fx[1] <= pr['pl'] + 2, [fx, pr])
            ok(f'{W}: frame keeps a usable size', fh > pr['sh'] * (0.85 if land else 0.45), [fh, pr['sh']])
            # a finger on the corner handle (outside the picture) scales instead of panning
            rid = await pg.evaluate('ppSel'); d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
            q = await pg.evaluate(f'(()=>{{const b=ppBoxOf(curFrame(),"{rid}");return xbDoc(b,"br")}})()'); a = await d2s(q['x'], q['y'])
            v0 = await pg.evaluate('[vtx,vty,vs]')
            await pg.evaluate(PT, [[[a[0]+i*3, a[1]+i*3] for i in range(15)], 'touch']); await pg.wait_for_timeout(250)
            sx = await pg.evaluate(f'(curFrame().pp["{rid}"]||{{}}).sx||1')
            ok(f'{W}: finger on a corner handle scales the layer', sx > 1.1 and await pg.evaluate('[vtx,vty,vs]') == v0, sx)
            await pg.screenshot(path=f'animate_ux_{W}.png')
            await ctx.close()
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
