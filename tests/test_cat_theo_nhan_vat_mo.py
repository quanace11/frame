import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9163'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🪄 Cắt theo nhân vật mờ: hình đồ trên nhân vật ghép mờ (📝 Giấy can) được tự chia theo từng mảnh + khớp của nhân vật đó,
# ✓ Xong = nhân vật mới có xương; 🔁 Thay nhân vật gốc: đi theo dáng nhân vật gốc ở mọi frame, nhân vật gốc ẩn. 1 bước undo.
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
# alpha overlap of two characters drawn on frame i (IoU, sampled)
IOU = '''((i, a, b)=>{const f=S.frames[i], cv=n=>{const c=makeCanvas(), x=c.getContext('2d'); ppOnlyRoot=n; try{drawPuppet(x, f.pp, f.lip)}finally{ppOnlyRoot=null} return x.getImageData(0,0,W,H).data};
  const lh=[ppPart(a).lh, ppPart(b).lh]; ppPart(a).lh=null; ppPart(b).lh=null; const A=cv(a), B=cv(b); ppPart(a).lh=lh[0]; ppPart(b).lh=lh[1];
  let u=0, n=0; for(let k=3;k<A.length;k+=12){const p=A[k]>40, q=B[k]>40; if(p||q)u++; if(p&&q)n++} return u? n/u : 0})'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9163/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # an old character (⚽ Cầu thủ mẫu), arm raised on frame 1, a second frame where it moved and turned its arms
        await pg.evaluate('kitAdd()'); await pg.wait_for_timeout(500)
        await pg.evaluate('''(()=>{const P=r=>S.pp.parts.find(p=>p.role===r).id, f=curFrame(); f.pp[P('armR')]={r:-50}; f.pp[P('foreR')]={r:-30};
          const g=frameCopyOf(f); g.pp={...f.pp, [P('armR')]:{r:-110}, [P('foreR')]:{r:-60}, [P('armL')]:{r:40}, [P('legL')]:{r:20}}; g.ppKey=true;
          g.lip={...(g.lip||{}), mv:{[lyrRoots()[0].id]:{x:120,y:-40}}}; insertFrames(1,[g]); selectFrame(0); requestRender()})()''')
        await pg.wait_for_timeout(400)
        old = await pg.evaluate('lyrRoots()[0].id')
        # "trace" it: the character drawn on the Nét layer of frame 1 in another colour (outline + fill, like a real tracing)
        await pg.evaluate('''(()=>{const f=curFrame(), c=makeCanvas(), x=c.getContext('2d'); drawPuppet(x, f.pp, f.lip);
          x.globalCompositeOperation='source-in'; x.fillStyle='#2a6'; x.fillRect(0,0,W,H);
          const y=f.canvas.getContext('2d'); y.drawImage(c, 2, 1); markEdited(f); requestRender()})()''')
        await pg.click('.tool[data-tool=brush]'); await pg.wait_for_timeout(300)
        ok('tracing: chip on the canvas', await pg.evaluate("ppTracing() && !$('#traceCut').hidden"))
        await pg.screenshot(path='cat_theo_mo_1.png')
        await pg.click('#traceCut'); await pg.wait_for_timeout(600)
        st = await pg.evaluate('''(()=>({n:HC&&HC.regs.length, roles:HC&&HC.regs.map(r=>r.role), from:HC&&HC.from&&HC.from.rid, follow:!$('#hcFollow').hidden && $('#hcFollow').classList.contains('on'), chip:$('#traceCut').hidden}))()''')
        ok('auto regions = the 10 pieces', st['n'] == 10 and sorted(st['roles']) == sorted(['torso','head','armL','foreL','armR','foreR','legL','shinL','legR','shinR']), st)
        ok('from the faded character, 🔁 on, chip gone', st['from'] == old and st['follow'] and st['chip'], st)
        J = await pg.evaluate('''(()=>{const f=curFrame(), M=ppMats(hcPoseOf(f)); return HC.regs.map(r=>{const p=ppPart(r.pid), j=hcJoint(r), w=mApply(M[p.id],p.px,p.py), pr=hcParentOf(r); return {d:Math.hypot(j.x-w.x,j.y-w.y), par:pr?ppPart(pr.pid).id:null, want:p.parent||null, role:r.role}})})()''')
        ok('joints = the old pivots', all(q['d'] < 1 for q in J), J)
        ok('bones like the old character', all(q['par'] == q['want'] for q in J if q['role'] != 'torso'), J)
        await pg.screenshot(path='cat_theo_mo_2.png')
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !document.querySelector(".ov")', timeout=15000); await pg.wait_for_timeout(400)
        res = await pg.evaluate('''(()=>{const rs=lyrRoots(), nw=rs.find(r=>r.id!==%r); const ps=lyrParts(nw.id);
          let ink=0; const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data; for(let i=3;i<d.length;i+=16) if(d[i]>20) ink++;
          return {roots:rs.length, n:ps.length, hard:ps.every(p=>p.hard), oldHidden:!!ppPart(%r).lh, nw:nw.id, ink, roles:ps.map(p=>p.role).sort()}})()''' % (old, old))
        ok('new character with 10 pieces, old one hidden', res['roots'] == 2 and res['n'] == 10 and res['hard'] and res['oldHidden'], res)
        ok('traced drawing left the frame', res['ink'] < 30, res['ink'])
        nw = res['nw']
        i0 = await pg.evaluate(IOU + '(0, %r, %r)' % (old, nw))
        i1 = await pg.evaluate(IOU + '(1, %r, %r)' % (old, nw))
        ok('frame 1: new character sits on the old one', i0 > 0.8, i0)
        ok('frame 2: follows the old pose + path', i1 > 0.75, i1)
        mv = await pg.evaluate('S.frames[1].lip.mv[%r]' % nw)
        ok('path offset copied', mv and mv['x'] == 120 and mv['y'] == -40, mv)
        await pg.screenshot(path='cat_theo_mo_3.png')
        await pg.wait_for_timeout(600)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(700)
        st = await pg.evaluate('''[lyrRoots().length, !ppPart(%r).lh, (()=>{let n=0; const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data; for(let i=3;i<d.length;i+=16) if(d[i]>20) n++; return n})()]''' % old)
        ok('undo: one character again, shown, drawing back', st[0] == 1 and st[1] and st[2] > 200, st)
        # 🔁 off: new character stands on its own from this frame, the old one stays
        await pg.click('.tool[data-tool=brush]'); await pg.wait_for_timeout(300)
        await pg.click('#traceCut'); await pg.wait_for_timeout(600)
        await pg.click('#hcFollow'); await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !!document.querySelector(".ov")', timeout=15000)
        ok('🔁 off: asks where the new character shows', 'hiện ở frame nào' in await pg.text_content('.ov:last-child h3'), '')
        await pg.keyboard.press('Escape'); await pg.wait_for_function('!document.querySelector(".ov")', timeout=5000); await pg.wait_for_timeout(300)
        st = await pg.evaluate('[lyrRoots().length, !ppPart(%r).lh]' % old)
        ok('🔁 off: old character kept', st[0] == 2 and st[1], st)
        # manual cut (no faded character under the drawing) still starts empty
        await pg.evaluate("(()=>{for(const r of lyrRoots()) r.lh=true; const f=curFrame(), x=f.canvas.getContext('2d'); x.fillStyle='#d33'; x.fillRect(100,100,200,300); markEdited(f)})()")
        await pg.evaluate('hcBegin()'); await pg.wait_for_timeout(300)
        ok('no character under it: lasso by hand', await pg.evaluate("HC && HC.regs.length===0 && !HC.from && $('#hcFromBtn').hidden"))
        await pg.evaluate('hcCancel()')
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
