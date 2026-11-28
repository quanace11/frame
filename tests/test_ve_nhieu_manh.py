import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9888'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🧩 Vẽ nhiều mảnh: ✎ Vẽ lại mảnh on 2–3 parts at once. A stroke across the elbow is split between the upper arm and
# the forearm (the piece showing under each bit; empty space → nearest bone); one undo step for both.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9888/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose')"); await pg.wait_for_timeout(200)
        # world points: middle of the upper arm, middle of the forearm, elbow (screen-right arm)
        P = await pg.evaluate("""(()=>{ const f=curFrame(), M=ppMats(ppPoseFor(f)), by=r=>S.pp.parts.find(p=>p.role===r), a=by('armR'), fo=by('foreR'), t=ppTipOf(fo);
          const sh=mApply(M[a.id],a.px,a.py), el=mApply(M[fo.id],fo.px,fo.py), ha=mApply(M[fo.id],t.x,t.y);
          return {up:{x:(sh.x+el.x)/2,y:(sh.y+el.y)/2}, lo:{x:(el.x+ha.x)/2,y:(el.y+ha.y)/2}, el, a:a.id, fo:fo.id, fname:fo.name} })()""")
        await pg.evaluate("ppPaintGo('brush')"); await pg.wait_for_timeout(100)
        await pg.click('[data-ppt="sel"]'); await pg.click('#ppPGBtn'); await pg.wait_for_timeout(100)
        def scr(pts): return pg.evaluate("pts => { const r=view.getBoundingClientRect(), c=Math.cos(vr)*vs, s=Math.sin(vr)*vs; return pts.map(q=>[r.left+(c*q.x-s*q.y+vtx)/DPR, r.top+(s*q.x+c*q.y+vty)/DPR]) }", pts)
        for q in (P['up'], P['lo']):
            (x, y), = await scr([q]); await pg.mouse.click(x, y); await pg.wait_for_timeout(150)
        g = await pg.evaluate("[...ppPG]")
        print('2 pieces picked by tapping', sorted(g) == sorted([P['a'], P['fo']]) and await pg.evaluate("document.getElementById('ppPGBtn').textContent.includes('(2)')"), g)
        await pg.click('[data-ppt="brush"]'); await pg.wait_for_timeout(100)
        await pg.evaluate("setColor('#ff0000'); S.size=14")
        before = await pg.evaluate(f"(()=>{{ const a=ppPart('{P['a']}'), f=ppPart('{P['fo']}'); window.__c0=[a.c,f.c]; return [a.c.width,a.c.height,f.c.width,f.c.height] }})()")
        n0 = await pg.evaluate("undoStack.length")
        # stroke from the upper arm down across the elbow onto the forearm, slightly outside the arm on the way (empty space)
        pts = [{'x': P['up']['x'] + (P['lo']['x'] - P['up']['x']) * t / 20 + (25 if 8 <= t <= 12 else 0), 'y': P['up']['y'] + (P['lo']['y'] - P['up']['y']) * t / 20} for t in range(21)]
        S_ = await scr(pts); await pg.mouse.move(*S_[0]); await pg.mouse.down()
        for x, y in S_[1:]: await pg.mouse.move(x, y, steps=2)
        await pg.mouse.up(); await pg.wait_for_timeout(400)
        red = await pg.evaluate(f"""['{P['a']}','{P['fo']}'].map(id=>{{ const c=ppPart(id).c, d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]>200&&d[i+1]<60&&d[i+2]<60&&d[i+3]>200) n++; return n }})""")
        print('the stroke went onto both pieces', red[0] > 30 and red[1] > 30, red)
        print('new canvases (old ones kept for undo)', await pg.evaluate(f"ppPart('{P['a']}').c!==window.__c0[0] && ppPart('{P['fo']}').c!==window.__c0[1]"))
        print('one undo step', await pg.evaluate(f"undoStack.length==={n0}+1 && !!undoStack.at(-1).multi && undoStack.at(-1).multi.length===2"))
        await pg.screenshot(path='ve_nhieu_manh.png')
        await pg.wait_for_timeout(700)   # the PNGs are encoded a moment later; no 2nd automatic undo step
        print('no extra automatic step', await pg.evaluate(f"undoStack.length==={n0}+1"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        print('undo restores both pieces', await pg.evaluate(f"ppPart('{P['a']}').c===window.__c0[0] && ppPart('{P['fo']}').c===window.__c0[1]"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        print('redo', await pg.evaluate(f"ppPart('{P['a']}').c!==window.__c0[0] && ppPart('{P['fo']}').c!==window.__c0[1]"))
        # eraser over the elbow rubs both pieces
        await pg.click('[data-ppt="erase"]'); await pg.evaluate("S.eSize=40")
        E = await scr([P['el'], {'x': P['el']['x'] + 2, 'y': P['el']['y'] + 30}])
        await pg.mouse.move(*E[0]); await pg.mouse.down(); await pg.mouse.move(*E[1], steps=4); await pg.mouse.up(); await pg.wait_for_timeout(300)
        print('eraser: one step for both pieces', await pg.evaluate("!!undoStack.at(-1).multi && undoStack.at(-1).multi.length===2"))
        # back to one piece
        await pg.click('[data-ppt="sel"]')
        print('👆 Chọn mảnh clears the group', await pg.evaluate("ppPG.size===0"))
        await pg.click('#ppPaintDone')
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
