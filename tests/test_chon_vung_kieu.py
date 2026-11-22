import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8893'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# Chọn vùng has 4 modes (thanh trên khi đang Chọn vùng):
#  👤 Cả hình vẽ (lines + colour + vector, as before), 🧩 Từng mảng (only patches mostly inside the loop: head without the TV / shirt),
#  📄 Chỉ 1 lớp (only the chosen layer), 🔲 Tất cả + nền (also the background). All of them undo in one step.
PEN='''async (pts)=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(ty,x,y)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
# a player seen from the back: yellow hair + skin face (colour layer) with black outlines (lines layer), red shirt under the head,
# a black TV behind the head in the same picture, a green box in the background layer
SETUP = '''(()=>{const f=curFrame(); const x=f.canvas.getContext('2d'), k=colOf(f,true).getContext('2d'); x.clearRect(0,0,W,H); k.clearRect(0,0,W,H);
  k.fillStyle='#111'; k.fillRect(560,520,340,180);                       // TV (colour) …
  x.lineWidth=6; x.strokeStyle='#111'; x.strokeRect(560,520,340,180);     // … and its outline
  k.fillStyle='#d32f2f'; k.fillRect(400,790,200,310); x.strokeRect(400,790,200,310);   // shirt
  k.fillStyle='#f1c27d'; k.beginPath(); k.arc(500,700,80,0,Math.PI*2); k.fill();         // face
  k.fillStyle='#fdd835'; k.beginPath(); k.arc(500,700,80,Math.PI,0); k.fill();            // hair
  x.beginPath(); x.arc(500,700,80,0,Math.PI*2); x.stroke();
  const b=bgOf(f).getContext ? null : bgOf(f); const bx=bgOf(f).canvas.getContext('2d'); bx.fillStyle='#43a047'; bx.fillRect(440,860,60,60); bgOf(f).ver++;
  f.colVer++; f.ver++; requestRender();})()'''
A = "((cv,x,y)=>cv.getContext('2d').getImageData(x,y,1,1).data[3])"
async def lasso(pg, x0, y0, x1, y1):
    c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + 2]]; pts = []
    for a, b in zip(c[:-1], c[1:]):
        for i in range(10): pts.append([a[0] + (b[0]-a[0])*i/10, a[1] + (b[1]-a[1])*i/10])
    pts.append(c[-1]); spts = [await pg.evaluate(D2S, q) for q in pts]
    await pg.evaluate(PEN, spts); await pg.wait_for_timeout(250)
async def drag(pg, a, z):
    a = await pg.evaluate(D2S, a); z = await pg.evaluate(D2S, z)
    await pg.evaluate(PEN, [[a[0] + (z[0]-a[0])*i/12, a[1] + (z[1]-a[1])*i/12] for i in range(13)]); await pg.wait_for_timeout(200)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8893/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("S.onion=false; S.sizeScreen=false; S.showBg=true; updateToggles()"); await pg.evaluate(SETUP); await pg.wait_for_timeout(100)
        F = "curFrame()"; COL = f"{F}.col"; LN = f"{F}.canvas"; BG = f"bgOf({F}).canvas"

        # mode bar
        await pg.evaluate("setTool('lasso')")
        print('mode bar shown with lasso', await pg.evaluate("!document.getElementById('lassobar').hidden && selMode()==='pic'"))
        await pg.click('[data-selm=part]')
        print('part mode on + saved', await pg.evaluate("S.selMode==='part' && JSON.parse(localStorage.getItem('fs-settings')).selMode==='part' && document.querySelector('[data-selm=part]').classList.contains('on')"))

        await pg.screenshot(path='chon_vung_bar.png')
        # 1. 🧩 Từng mảng: loop around the head also touches the TV and the shirt
        await lasso(pg, 400, 600, 620, 820)
        print('bar hides while picture floats', await pg.evaluate("!!floating && document.getElementById('lassobar').hidden"))
        print('head taken (hair, face, outline)', await pg.evaluate(f"{A}({COL},500,650)===0 && {A}({COL},500,740)===0 && {A}({LN},500,620)===0"))
        print('TV left in place (inside the loop)', await pg.evaluate(f"{A}({COL},600,650)>200 && {A}({COL},610,610)>200"))
        print('shirt left in place (inside the loop)', await pg.evaluate(f"{A}({COL},500,810)>200 && {A}({LN},450,790)>200"))
        print('background untouched', await pg.evaluate(f"{A}({BG},470,880)>200"))
        await pg.screenshot(path='chon_vung_part.png')
        await drag(pg, [500, 700], [250, 700]); await pg.click('#selDone'); await pg.wait_for_timeout(200)
        print('head moved, TV + shirt stay', await pg.evaluate(f"(()=>{{const d=curFrame().col.getContext('2d').getImageData(250,650,1,1).data;return d[0]>200&&d[1]>180&&d[2]<120}})() && {A}({COL},250,740)>200 && {A}({COL},600,650)>200 && {A}({COL},500,900)>200"))
        await pg.screenshot(path='chon_vung_part_moved.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo puts the head back', await pg.evaluate(f"{A}({COL},500,740)>200 && {A}({COL},250,740)===0 && {A}({LN},500,620)>200"))

        # 2. 📄 Chỉ 1 lớp → Màu: the lines stay
        await pg.click('[data-selm=layer]')
        print('layer chips shown', await pg.evaluate("!document.getElementById('lassoLayers').hidden"))
        await pg.click('[data-sell=col]')
        print('layer Màu chosen, still lasso', await pg.evaluate("S.layer==='col' && S.tool==='lasso'"))
        await lasso(pg, 380, 770, 620, 1120)
        print('only colour lifted', await pg.evaluate(f"!!floating && floating.only==='col' && {A}({COL},500,900)===0 && {A}({LN},400,900)>200"))
        await pg.click('#selCancel'); await pg.wait_for_timeout(100)
        print('cancel restores colour', await pg.evaluate(f"!floating && {A}({COL},500,900)>200"))
        await pg.click('[data-sell=char]')
        await lasso(pg, 380, 770, 620, 1120)
        print('only lines lifted', await pg.evaluate(f"!!floating && !floating.cc && {A}({LN},400,900)===0 && {A}({COL},500,900)>200"))
        await pg.click('#selCancel'); await pg.wait_for_timeout(100)

        # 3. 🔲 Tất cả + nền: the background box comes too
        await pg.click('[data-selm=all]')
        print('all mode back on lớp Nhân vật', await pg.evaluate("S.layer==='char'"))
        await lasso(pg, 380, 770, 620, 1120)
        print('bg piece lifted', await pg.evaluate(f"!!floating && !!floating.bc && {A}({BG},470,880)===0"))
        await drag(pg, [500, 900], [800, 1300]); await pg.click('#selDone'); await pg.wait_for_timeout(200)
        print('bg moved with it', await pg.evaluate(f"{A}({BG},770,1280)>200 && {A}({BG},470,880)===0 && {A}({COL},800,1300)>200"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo puts bg back', await pg.evaluate(f"{A}({BG},470,880)>200 && {A}({BG},770,1280)===0 && {A}({COL},500,900)>200"))
        await lasso(pg, 380, 770, 620, 1120); await pg.click('#selCancel'); await pg.wait_for_timeout(100)
        print('cancel restores bg', await pg.evaluate(f"{A}({BG},470,880)>200"))

        # 5. colour in lớp Nền, lines in lớp Nhân vật (a picture whose colour went into the background): 🧩 moves both
        await pg.evaluate("""(()=>{const f=curFrame(); f.canvas.getContext('2d').clearRect(0,0,W,H); f.col.getContext('2d').clearRect(0,0,W,H);
          const bx=bgOf(f).canvas.getContext('2d'); bx.fillStyle='#fff'; bx.fillRect(0,0,W,H); bx.fillStyle='#fdd835'; bx.beginPath(); bx.arc(500,1400,80,Math.PI,0); bx.fill();
          bx.fillStyle='#f1c27d'; bx.beginPath(); bx.arc(500,1400,80,0,Math.PI); bx.fill(); bx.fillStyle='#d32f2f'; bx.fillRect(380,1490,240,300);
          const x=f.canvas.getContext('2d'); x.lineWidth=6; x.strokeStyle='#111'; x.beginPath(); x.arc(500,1400,80,0,Math.PI*2); x.stroke(); x.strokeRect(380,1490,240,300);
          bgOf(f).ver++; f.ver++; f.colVer++; requestRender();})()""")
        await pg.click('[data-selm=part]'); await pg.wait_for_timeout(100)
        await lasso(pg, 400, 1300, 600, 1520)
        print('bg colour lifted with the lines', await pg.evaluate(f"!!floating && !!floating.bc && {A}({BG},500,1350)===0 && {A}({BG},500,1440)===0 && {A}({LN},500,1320)===0"))
        print('shirt + white paper left', await pg.evaluate(f"{A}({BG},500,1510)>200 && {A}({BG},420,1310)>200"))
        await drag(pg, [500, 1400], [250, 1400]); await pg.click('#selDone'); await pg.wait_for_timeout(200)
        print('head colour moved', await pg.evaluate(f"(()=>{{const d=bgOf(curFrame()).canvas.getContext('2d').getImageData(250,1350,1,1).data;return d[0]>200&&d[1]>180&&d[2]<120}})() && {A}({LN},250,1320)>200"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('undo puts bg colour back', await pg.evaluate(f"(()=>{{const d=bgOf(curFrame()).canvas.getContext('2d').getImageData(500,1350,1,1).data;return d[0]>200&&d[1]>180&&d[2]<120}})() && {A}({LN},500,1320)>200"))
        # 6. lines in lớp Nền while lớp Nền is the chosen layer, colour in lớp Màu: 🧩 still takes both
        await pg.evaluate("""(()=>{const f=curFrame(); f.canvas.getContext('2d').clearRect(0,0,W,H); const bx=bgOf(f).canvas.getContext('2d'); bx.fillStyle='#fff'; bx.fillRect(0,0,W,H);
          bx.lineWidth=6; bx.strokeStyle='#111'; bx.beginPath(); bx.arc(500,1400,80,0,Math.PI*2); bx.stroke();
          const k=f.col.getContext('2d'); k.fillStyle='#fdd835'; k.beginPath(); k.arc(500,1400,78,0,Math.PI*2); k.fill(); bgOf(f).ver++; f.ver++; f.colVer++; setLayer('bg'); requestRender();})()""")
        await lasso(pg, 400, 1300, 600, 1520)
        print('lines in Nền + colour in Màu both lifted', await pg.evaluate(f"!!floating && {A}({COL},500,1400)===0 && (()=>{{const d=bgOf(curFrame()).canvas.getContext('2d').getImageData(500,1321,1,1).data;return !(d[3]>200&&d[0]<80)}})()"))
        await pg.click('#selCancel'); await pg.wait_for_timeout(100)
        print('cancel restores both', await pg.evaluate(f"{A}({COL},500,1400)>200 && (()=>{{const d=bgOf(curFrame()).canvas.getContext('2d').getImageData(500,1321,1,1).data;return d[3]>200&&d[0]<80}})()"))
        await pg.evaluate("setLayer('char')")

        # 4. 👤 default still works as before
        await pg.click('[data-selm=pic]')
        await lasso(pg, 380, 770, 620, 1120)
        print('pic mode: lines + colour, no bg', await pg.evaluate(f"!!floating && !!floating.cc && !floating.bc && {A}({BG},470,880)>200 && {A}({LN},400,900)===0"))
        await pg.click('#selCancel')
        print('ERR', errs)
        await b.close()
asyncio.run(main()); srv.terminate()
