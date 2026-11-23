import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, json
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9125'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Tự cắt từng phần, chỗ nối 2 mảnh chi (gối): tất trắng có viền tối bắt đầu ngay dưới gối. Trước đây đùi lấy hết da ống chân
# tới tận mép tất (viền tất bị coi là đường nối 2 mảnh, màu da "chỉ đùi có"), ống chân mất da, gập gối thì rách.
# Giữa 2 mảnh chi chỉ phía của khớp quyết định (ngoài đĩa khớp tròn).
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
IMG = os.path.join(OUT, 'cat_goi_nv.png'); INK = (35, 30, 40, 255); SKIN = (250, 205, 160, 255)
im = Image.new('RGBA', (600, 1000), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([200, 100, 400, 400], fill=(240, 120, 30, 255), outline=INK, width=6)          # thân
d.rectangle([250, 394, 310, 606], fill=SKIN, outline=INK, width=6)                       # đùi (hông 400 → gối 600)
d.rectangle([250, 594, 310, 900], fill=SKIN, outline=INK, width=6)                       # ống chân, không có viền ở gối
d.rounded_rectangle([250, 630, 310, 900], 26, fill=(255, 255, 255, 255), outline=INK, width=6)   # tất, mép trên cách gối 30 px
im.save(IMG)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9125/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        await pg.evaluate("wizImport='hand'"); await pg.set_input_files('#imgFile', IMG); await pg.wait_for_timeout(500)
        await pg.click('[data-cm=none]'); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(400)
        k = await pg.evaluate('Math.min(W*0.9/600, H*0.9/1000)'); ox, oy = await pg.evaluate(f'[(W-600*{k})/2, (H-1000*{k})/2]')
        D = lambda x, y: (ox + x * k, oy + y * k)
        def R(x0, y0, x1, y1): return json.dumps([{'x': D(x, y)[0], 'y': D(x, y)[1]} for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
        await pg.evaluate(f"HC.role='torso'; hcAdd({R(180, 80, 420, 420)})")
        await pg.evaluate(f"HC.role='legL'; hcAdd({R(230, 370, 330, 640)})")     # đùi: quá gối 40 px (lấn cả mép tất)
        await pg.evaluate(f"HC.role='shinL'; hcAdd({R(230, 560, 330, 920)})")    # ống chân: lấn lên trên gối 40 px
        # 📖 Mẹo cắt: hộp hướng dẫn có hình mẫu vẽ bằng code
        await pg.click('#hcTips'); await pg.wait_for_timeout(300)
        ink = await pg.evaluate("(()=>{const c=document.querySelector('#hcTipCv'); if(!c) return 0; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=16) if(d[i]<200) n++; return n})()")
        ok('📖 Mẹo cắt shows the drawn sample', ink > 500, ink)
        await pg.screenshot(path='cat_goi_meo.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok('tips close with Esc, cutting goes on', await pg.evaluate("!document.querySelector('.ov') && !!HC"))
        j = await pg.evaluate("(()=>{const r=HC.regs.find(q=>q.role==='shinL'), j=hcJoint(r); return [j.x, j.y]})()")
        ok('knee joint at the knee', abs(j[1] - D(0, 600)[1]) < 12 * k, [j, D(0, 600)])
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !document.querySelector(".ov")', timeout=8000); await pg.wait_for_timeout(300)
        al = lambda role, x, y: pg.evaluate(f"(()=>{{const p=S.pp.parts.find(q=>q.role==='{role}'), X=Math.round({D(x,y)[0]}-p.ox), Y=Math.round({D(x,y)[1]}-p.oy); if(X<0||Y<0||X>=p.c.width||Y>=p.c.height) return -1; return p.c.getContext('2d').getImageData(X,Y,1,1).data[3]}})()")
        ok('shin keeps its skin under the knee, outside the round joint', await al('shinL', 280, 626) == 255, await al('shinL', 280, 626))
        ok('thigh ends at its round joint (nothing of the shin past it)', await al('legL', 280, 645) in (0, -1), await al('legL', 280, 645))
        ok('thigh keeps its own skin', await al('legL', 280, 560) == 255)
        ok('shin keeps the sock', await al('shinL', 280, 700) == 255)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
