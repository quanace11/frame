import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math
from playwright.async_api import async_playwright
# Brush types, eraser types, smoothing, colour picker popover
srv = subprocess.Popen(['python3','-m','http.server','8801'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts, pr])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect(); let t=performance.now();
  const mk=(ty,x,y,p)=>new PointerEvent(ty,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:p,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1],pr[0])); for(let i=1;i<pts.length;i++){v.dispatchEvent(mk('pointermove',pts[i][0],pts[i][1],pr[i])); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1],0));}'''
def wave(x0, y0, L=420, n=50, amp=40):
    pts=[[x0+L*i/n, y0+amp*math.sin(i/n*math.pi*2)] for i in range(n+1)]
    pr=[0.2+0.8*math.sin(i/n*math.pi) for i in range(n+1)]
    return pts, pr
COUNT='''(()=>{const c=curFrame().canvas, d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n})()'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8801/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("S.size=14; S.smooth=0.3")
        keys = await pg.evaluate("Object.keys(BRUSHES)")
        print('brushes', len(keys))
        # draw one wave per brush, each in its own row; each must add pixels and one undo entry
        D2S = "(([x,y])=>{const m=viewMat();return [(m[0]*x+m[2]*y+m[4])/DPR,(m[1]*x+m[3]*y+m[5])/DPR]})"
        tl = await pg.evaluate(D2S, [60, 80]); br = await pg.evaluate(D2S, [1020, 1840])
        L = br[0]-tl[0]-10; dy = (br[1]-tl[1])/10
        ok = True; prev = await pg.evaluate(COUNT)
        for i,k in enumerate(keys):
            await pg.evaluate(f"S.brush='{k}'; setTool('brush'); setColor(BIG_PALETTE[{48+i}])")
            pts, pr = wave(tl[0]+5, tl[1] + dy*(i+0.6), L=L, amp=dy*0.3)
            await pg.evaluate(PEN, [pts, pr]); await pg.wait_for_timeout(60)
            n = await pg.evaluate(COUNT)
            if not n > prev: ok = False; print('no pixels for', k)
            prev = n
        print('every brush draws', ok)
        print('stroke cleared', await pg.evaluate('stroke===null'))
        await pg.screenshot(path='t26_brushes.png')
        # undo removes last stroke
        before = await pg.evaluate(COUNT); await pg.evaluate('undo()'); after = await pg.evaluate(COUNT)
        print('undo works', after < before); await pg.evaluate('redo()')
        # erasers
        for j,k in enumerate(['hard','soft','air']):
            await pg.evaluate(f"S.eraserType='{k}'; setTool('eraser')")
            c0 = await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,1080,1920).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s})()")
            ex = tl[0]+L*(0.2+0.3*j); await pg.evaluate(PEN, [[[ex, tl[1]],[ex+5, (tl[1]+br[1])/2],[ex+10, br[1]]], [0.8,0.8,0.8]]); await pg.wait_for_timeout(60)
            c1 = await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,1080,1920).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s})()")
            print('eraser', k, 'removes', c1 < c0)
        print('brush label', await pg.evaluate("document.getElementById('brushName').textContent"))
        # smoothing catch-up: stroke must reach the last point even with strong smoothing
        await pg.evaluate("S.brush='pen'; S.smooth=0.9; setTool('brush'); setColor('#ff0000')")
        end = [tl[0]+L*0.8, br[1]-30]
        doc = await pg.evaluate(f"(()=>scrToDoc({end[0]}*DPR,{end[1]}*DPR))()")
        await pg.evaluate(PEN, [[[end[0]-200,end[1]],[end[0]-140,end[1]],[end[0]-80,end[1]],[end[0]-20,end[1]],end], [0.7]*5]); await pg.wait_for_timeout(60)
        a = await pg.evaluate(f"curFrame().canvas.getContext('2d').getImageData({int(doc['x'])-2},{int(doc['y'])},1,1).data[3]")
        print('smoothed stroke reaches end', a > 0)
        await pg.evaluate("S.smooth=0.3")
        # brush popover
        await pg.click('#brushBtn'); await pg.wait_for_timeout(200)
        print('brush popover cards', await pg.evaluate("document.querySelectorAll('.pop .br').length"))
        await pg.screenshot(path='t26_brushpop.png')
        await pg.click('.pop [data-b=water]'); print('pick water', await pg.evaluate("S.brush"))
        await pg.click('.pop [data-e=soft]'); print('pick soft eraser', await pg.evaluate("S.tool+' '+S.eraserType"))
        await pg.click('#brushBtn'); print('popover toggled closed', await pg.evaluate("!document.querySelector('.pop')"))
        # colour popover
        await pg.evaluate("setTool('brush')")
        await pg.click('#curColor'); await pg.wait_for_timeout(200)
        print('palette size', await pg.evaluate("document.querySelectorAll('.pop .cp-pal button').length"))
        print('recent shown', await pg.evaluate("document.querySelectorAll('.pop .cp-recent button').length>0"))
        await pg.click('.pop .cp-pal button >> nth=40'); c = await pg.evaluate('S.color'); print('palette click', c == await pg.evaluate('BIG_PALETTE[40]'))
        await pg.fill('.pop .cp-hex', '#12ab34'); print('hex input', await pg.evaluate('S.color'))
        box = await pg.evaluate("(()=>{const r=document.querySelector('.pop .cp-sv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        await pg.mouse.click(box[0]+box[2]-6, box[1]+6); print('sv square -> saturated', await pg.evaluate("hexToHsv(S.color).s>0.94 && hexToHsv(S.color).v>0.94"))
        hb = await pg.evaluate("(()=>{const r=document.querySelector('.pop .cp-hue').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        await pg.mouse.click(hb[0]+hb[2]*240/360, hb[1]+hb[3]/2); print('hue -> blue', abs(await pg.evaluate("hexToHsv(S.color).h")-240) < 6)
        await pg.screenshot(path='t26_colorpop.png')
        # eyedropper: picks the red stroke and returns to brush
        await pg.click('.pop .cp-pick'); print('pick tool', await pg.evaluate('S.tool'), 'popover closed', await pg.evaluate("!document.querySelector('.pop')"))
        await pg.evaluate('''(([x,y])=>{const v=document.getElementById('view'),r=v.getBoundingClientRect();
          v.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:.5,buttons:1,bubbles:true}));
          v.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,bubbles:true}));})''', [end[0]-60, end[1]])
        print('picked', await pg.evaluate('S.color'), 'back to', await pg.evaluate('S.tool'))
        # tap on canvas while popover open only closes it
        await pg.click('#curColor'); n0 = await pg.evaluate(COUNT)
        await pg.evaluate(PEN, [[[tl[0]+40,tl[1]+40],[tl[0]+120,tl[1]+40]],[0.5,0.5]]); await pg.wait_for_timeout(60)
        print('canvas tap closes popover without drawing', await pg.evaluate("!document.querySelector('.pop')"), (await pg.evaluate(COUNT)) == n0)
        # settings persist
        await pg.evaluate("saveSettings()")
        st = await pg.evaluate("JSON.parse(localStorage.getItem('fs-settings'))")
        print('persist', st.get('brush'), st.get('eraserType'), len(st.get('recentColors', [])) > 0)
        # portrait layout: popover fits on screen
        await pg.set_viewport_size({'width':800,'height':1280}); await pg.wait_for_timeout(300)
        await pg.click('#curColor'); await pg.wait_for_timeout(200)
        fit = await pg.evaluate("(()=>{const r=document.querySelector('.pop').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()")
        print('popover fits portrait', fit); await pg.screenshot(path='t26_portrait.png')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
