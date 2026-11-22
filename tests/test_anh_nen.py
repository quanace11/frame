import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8966'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🖼 Ảnh làm nền: ảnh vào lớp Nền tự phủ kín khung 9:16 (phần tràn bị cắt), ⛶ Phủ kín khung, Nhập ảnh khi đang ở lớp Nền không thành layer
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
MK='''([w,h])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#2a8';x.fillRect(0,0,w,h);x.fillStyle='#e33';x.fillRect(0,0,w/2,h);return c}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8966/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # the Nền ▾ menu has the new row
        await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(150)
        ok('Nền ▾ has 🖼 Ảnh làm nền', await pg.evaluate("!!document.querySelector('.bgm-img')"))
        await pg.keyboard.press('Escape'); await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(100)
        # a wide landscape photo into Nền covers the 9:16 frame
        await pg.evaluate(f'(()=>{{setLayer("bg"); floatFromImage(({MK})([2000,1000]))}})()'); await pg.wait_for_timeout(150)
        sc = await pg.evaluate('[floating.scale, floating.c.width, floating.c.height, floating.o.kind]')
        ok('picture into Nền covers the frame', sc[3] == 'bg' and abs(sc[0] * sc[2] - 1920) < 2 and sc[0] * sc[1] >= 1080, sc)
        await pg.click('#selDone'); await pg.wait_for_timeout(200)
        a = await pg.evaluate('(()=>{const c=bgOf(curFrame()).canvas,d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]<250)n++;return [c.width,c.height,n]})()')
        ok('Nền canvas fully covered, overflow cut off', a[0] == 1080 and a[1] == 1920 and a[2] == 0, a)
        # ⛶ Phủ kín khung on a small floating picture
        await pg.evaluate(f'(()=>{{setLayer("char"); floatFromImage(({MK})([300,300]))}})()'); await pg.wait_for_timeout(150)
        s0 = await pg.evaluate('floating.scale'); await pg.click('#selCover'); await pg.wait_for_timeout(100)
        s1 = await pg.evaluate('[floating.scale, floating.cx, floating.cy]')
        ok('⛶ Phủ kín khung scales to cover', s0 < 1.1 and abs(s1[0] * 300 - 1920) < 2 and s1[1] == 540 and s1[2] == 960, [s0, s1])
        await pg.click('#selCancel'); await pg.wait_for_timeout(100)
        ok('import into layer is off while on Nền', await pg.evaluate("(()=>{setLayer('bg'); return S.impLayer && S.layer==='bg'})()"))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
