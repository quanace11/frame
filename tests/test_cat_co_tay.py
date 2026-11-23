import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9171'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Tự cắt từng phần: 🖌 Tô thêm / 🧽 Tẩy bớt sửa vùng đang chọn bằng cọ tròn, ↶ Hoàn tác từng nét cọ, mảnh tạo ra theo vùng đã sửa.
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
IMG = os.path.join(OUT, 'cat_co_tay.png')
im = Image.new('RGBA', (800, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([220, 250, 380, 550], fill=(230, 140, 20, 255)); d.ellipse([230, 100, 370, 240], fill=(250, 200, 150, 255))
d.rectangle([380, 270, 560, 310], fill=(40, 90, 220, 255)); d.rectangle([560, 270, 720, 310], fill=(40, 180, 80, 255))
im.save(IMG)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9171/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        await pg.evaluate("wizImport='hand'"); await pg.set_input_files('#imgFile', IMG); await pg.wait_for_timeout(500)
        await pg.click('[data-cm=none]'); await pg.wait_for_timeout(600)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(400)
        k = await pg.evaluate('Math.min(W*0.9/800, H*0.9/900)'); ox, oy = await pg.evaluate(f'[(W-800*{k})/2, (H-900*{k})/2]')
        D = lambda x, y: (ox + x * k, oy + y * k)
        def R(x0, y0, x1, y1):
            a, c = D(x0, y0), D(x1, y1); return f'[{{x:{a[0]},y:{a[1]}}},{{x:{c[0]},y:{a[1]}}},{{x:{c[0]},y:{c[1]}}},{{x:{a[0]},y:{c[1]}}}]'
        await pg.evaluate(f'hcAdd({R(200,230,440,570)})')     # thân
        await pg.click('[data-hcr=armL]'); await pg.evaluate(f'hcAdd({R(360,255,600,325)})')   # tay trên, chưa lấy hết phần xanh dương… và lấn sang xanh lá
        await pg.click('[data-hcr=foreL]'); await pg.evaluate(f'hcAdd({R(590,255,740,325)})')
        sp = lambda x, y: pg.evaluate(f'''(()=>{{const r=view.getBoundingClientRect(), M=viewMat(); const q={{x:{D(x,y)[0]},y:{D(x,y)[1]}}};
          return [r.left+(M[0]*q.x+M[2]*q.y+M[4])/DPR, r.top+(M[1]*q.x+M[3]*q.y+M[5])/DPR]}})()''')
        inM = lambda i, x, y: pg.evaluate(f"(()=>{{const r=HC.regs[{i}]; return !!r.m[Math.round({D(x,y)[1]})*W+Math.round({D(x,y)[0]})]}})()")
        await pg.click('#hcRegs [data-hci="1"]'); await pg.wait_for_timeout(100)
        ok('paint chips on the selected piece', await pg.evaluate("!$('#hcSelRow').hidden && !!document.querySelector('[data-hct=add]')"))
        await pg.click('[data-hct=erase]'); await pg.wait_for_timeout(100)
        ok('erase tool on', await pg.evaluate("HC.tool==='erase' && document.querySelector('[data-hct=erase]').classList.contains('on')"))
        ok('before: arm loop reaches the green', await inM(1, 590, 290))
        a, c = await sp(590, 262), await sp(590, 318)
        await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(c[0], c[1], steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        ok('erase took the green out of the arm', not await inM(1, 590, 290) and await inM(1, 450, 290), await pg.evaluate("HC.regs[1].b"))
        ok('regions count unchanged, arm is a mask region now', await pg.evaluate("HC.regs.length===3 && !!HC.regs[1].mc"))
        await pg.click('[data-hct=add]'); await pg.wait_for_timeout(100)
        a, c = await sp(450, 335), await sp(520, 335)
        await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(c[0], c[1], steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        ok('brush added below the old loop', await inM(1, 485, 335) and await pg.evaluate(f"HC.regs[1].b[3] >= {D(0,335)[1]}"))
        ok('tap while painting does not select another piece', await pg.evaluate("HC.sel===HC.regs[1] && HC.regs.length===3"))
        await pg.click('#hcUndo'); await pg.wait_for_timeout(150)
        ok('undo takes back only the last stroke', not await inM(1, 485, 335) and not await inM(1, 590, 290) and await pg.evaluate("HC.regs.length===3"))
        await pg.click('#hcUndo'); await pg.wait_for_timeout(150)
        ok('second undo brings the erased part back', await inM(1, 590, 290) and await pg.evaluate("HC.regs.length===3"))
        await pg.click('[data-hct=erase]'); a, c = await sp(590, 262), await sp(590, 318)
        await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(c[0], c[1], steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        await pg.click('[data-hct=lasso]'); await pg.wait_for_timeout(100)
        ok('back to lasso', await pg.evaluate("HC.tool==='lasso'"))
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !document.querySelector(".ov")', timeout=8000); await pg.wait_for_timeout(300)
        al = lambda role, x, y: pg.evaluate(f"(()=>{{const p=S.pp.parts.find(q=>q.role==='{role}'), X=Math.round({D(x,y)[0]}-p.ox), Y=Math.round({D(x,y)[1]}-p.oy); if(X<0||Y<0||X>=p.c.width||Y>=p.c.height) return -1; return p.c.getContext('2d').getImageData(X,Y,1,1).data[3]}})()")
        ok('parts made from edited regions', await pg.evaluate("S.pp.parts.length===3"))
        ok('arm piece has blue, not the erased green', await al('armL', 450, 290) == 255 and await al('armL', 590, 290) in (0, -1))
        ok('forearm piece keeps the green', await al('foreL', 650, 290) == 255)
        await pg.screenshot(path='cat_co_tay.png')
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
