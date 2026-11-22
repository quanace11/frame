import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8968'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Cắt từng bộ phận: vẽ nhân vật ở frame, khoanh từng bộ phận (vùng chồng qua khớp), khớp tự đặt giữa chỗ chồng, xương nối theo vai trò,
# ✓ Xong = 1 nhân vật + xoá hình đã cắt khỏi frame, 1 bước undo. Thêm: 📝 nhân vật ghép mờ như giấy can khi cầm Bút / Đổ màu.
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
DRAW = '''(()=>{const f=curFrame(), x=f.canvas.getContext('2d'); x.fillStyle='#d33'; x.fillRect(440,600,200,400);
  x.beginPath(); x.arc(540,500,90,0,7); x.fillStyle='#fc9'; x.fill(); x.fillStyle='#33d'; x.fillRect(470,1000,50,250); x.fillStyle='#3a3'; x.fillRect(470,1250,50,250);
  x.lineWidth=6; x.strokeStyle='#111'; x.strokeRect(440,600,200,400); markEdited(f); requestRender()})()'''
RECT = lambda x0,y0,x1,y1: f'[{{x:{x0},y:{y0}}},{{x:{x1},y:{y0}}},{{x:{x1},y:{y1}}},{{x:{x0},y:{y1}}}]'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8968/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate(DRAW); await pg.wait_for_timeout(500)
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        await pg.click('#ppEmpty .hcStart'); await pg.wait_for_timeout(200)
        ok('cut bar shown, starts at Thân', await pg.evaluate("!$('#hcBar').hidden && HC && HC.role==='torso'"))
        await pg.evaluate(f'hcAdd({RECT(425,585,655,1015)})')
        ok('next role = Đầu', await pg.evaluate("HC.role==='head' && document.querySelector('[data-hcr=torso]').classList.contains('done')"))
        # the head with a real pen lasso on screen (loop round past the neck into the body)
        pts = await pg.evaluate('''(()=>{const r=view.getBoundingClientRect(), M=viewMat(), s=q=>({x:r.left+(M[0]*q.x+M[2]*q.y+M[4])/DPR, y:r.top+(M[1]*q.x+M[3]*q.y+M[5])/DPR});
          const out=[]; for(let k=0;k<=24;k++){const a=k/24*Math.PI*2; out.push(s({x:540+120*Math.cos(a), y:520+120*Math.sin(a)}))} return out})()''')
        await pg.mouse.move(pts[0]['x'], pts[0]['y']); await pg.mouse.down()
        for q in pts[1:]: await pg.mouse.move(q['x'], q['y'], steps=2)
        await pg.mouse.up(); await pg.wait_for_timeout(200)
        ok('head lassoed with the pen', await pg.evaluate("HC.regs.length===2 && HC.regs[1].role==='head'"), await pg.evaluate('HC.regs.map(r=>r.role)'))
        await pg.click('[data-hcr=legL]'); await pg.evaluate(f'hcAdd({RECT(455,985,535,1275)})')
        ok('after thigh comes shin', await pg.evaluate("HC.role==='shinL'"))
        await pg.evaluate(f'hcAdd({RECT(455,1228,535,1515)})')
        J = await pg.evaluate("Object.fromEntries(HC.regs.map(r=>[r.role, hcJoint(r)]))")
        ok('knee joint in the middle of the overlap', abs(J['shinL']['x'] - 495) < 6 and 1238 < J['shinL']['y'] < 1265, J['shinL'])
        ok('neck joint where head + body overlap', 600 <= J['head']['y'] <= 640, J['head'])
        ok('hip joint where thigh + body overlap', 985 <= J['legL']['y'] <= 1015, J['legL'])
        await pg.screenshot(path='cat_bo_phan_1.png')
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !document.querySelector(".ov")', timeout=8000); await pg.wait_for_timeout(300)
        parts = await pg.evaluate("S.pp.parts.map(p=>({id:p.id, role:p.role, parent:p.parent, px:Math.round(p.px), py:Math.round(p.py)}))")
        by = {q['role']: q for q in parts}
        ok('4 parts with roles', sorted(by) == ['head','legL','shinL','torso'], parts)
        ok('bones linked by role', by['torso']['parent'] is None and by['head']['parent'] == by['torso']['id'] and by['legL']['parent'] == by['torso']['id'] and by['shinL']['parent'] == by['legL']['id'], parts)
        ok('bar closed', await pg.evaluate("$('#hcBar').hidden && HC===null"))
        a = await pg.evaluate("curFrame().canvas.getContext('2d').getImageData(540,800,1,1).data[3]")
        ok('cut drawing removed from the frame', a == 0, a)
        ok('the character is one layer', await pg.evaluate("lyrRoots().length===1 && lyrParts(lyrRoots()[0].id).length===4"))
        # bend the knee: the shin turns round its joint
        await pg.evaluate(f"(()=>{{const f=curFrame(); f.pp['{by['shinL']['id']}']={{r:40}}; requestRender()}})()")
        tip = await pg.evaluate(f"(()=>{{const M=ppMats(curFrame().pp)['{by['shinL']['id']}']; const p=mApply(M,495,{by['shinL']['py']}); return [Math.round(p.x),Math.round(p.y)]}})()")
        ok('knee stays put when the shin turns', abs(tip[0] - 495) <= 1 and abs(tip[1] - by['shinL']['py']) <= 1, tip)
        await pg.evaluate(f"(()=>{{const f=curFrame(); delete f.pp['{by['shinL']['id']}']; requestRender()}})()")
        await pg.wait_for_timeout(600)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("[!S.pp || !S.pp.parts.length, curFrame().canvas.getContext('2d').getImageData(540,800,1,1).data[3]]")
        ok('undo: character gone, drawing back', st[0] and st[1] == 255, st)
        await pg.click('#redoBtn'); await pg.wait_for_timeout(600)
        ok('redo: character back', await pg.evaluate("S.pp && S.pp.parts.length===4 && curFrame().canvas.getContext('2d').getImageData(540,800,1,1).data[3]===0"))
        # tracing paper: brush on Nét → the character is drawn faded and under the lines
        await pg.click('.tool[data-tool=brush]'); await pg.wait_for_timeout(200)
        ok('character faded while drawing', await pg.evaluate('ppTracing()'))
        await pg.screenshot(path='cat_bo_phan_2.png')
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        ok('not faded in Ghép', await pg.evaluate('!ppTracing()'))
        await pg.evaluate('S.ppTrace=false'); await pg.click('.tool[data-tool=fill]')
        ok('switch off in Menu keeps it solid', await pg.evaluate('!ppTracing()'))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
