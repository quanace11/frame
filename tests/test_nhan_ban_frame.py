import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# Every way of copying frames goes through frameCopyOf (timeline.js): Nhân bản frame, Lặp đoạn, Chọn nhiều → Nhân bản,
# 📺 Phát lại. Before, they were 4 copies of the same code and Chọn nhiều/Lặp đoạn lost the 🌈 look (scrolling bg,
# speed lines, film colour, ghost) that Phát lại kept.
# Cử chỉ / tư thế mẫu / ⭐ chuyển động (ppInsertFrames) and ⚡ combos (gagApply) also lost f.lip: a character moved
# with 〰 Đường đi jumped back to where it started.
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9121'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
SAME = '''([i,j])=>{const a=S.frames[i], b=S.frames[j]; const k=['bgs','sl','flt','ghost','lip','texts']; const bad=k.filter(x=>JSON.stringify(a[x]??null)!==JSON.stringify(b[x]??null));
  const px=f=>{const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let q=3;q<d.length;q+=4) if(d[q]) n++; return n};
  if (px(a)!==px(b)) bad.push('pixels'); if (a.id===b.id) bad.push('same id'); return bad;}'''
async def main():
    errs = []
    def check(name, ok, info=''):
        print(('ok  ' if ok else 'FAIL'), name, info); ok or errs.append(name)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1366, 'height': 1024}); pe = []; pg.on('pageerror', lambda e: pe.append(str(e)))
        await pg.goto('http://localhost:9121/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate(PEN, [[[200 + i * 5, 300 + (i % 5) * 7] for i in range(40)]]); await pg.wait_for_timeout(200)
        # give frame 1 a look, a mouth state and a text
        await pg.evaluate("""(()=>{const f=S.frames[0]; f.bgs={d:'l',v:2}; f.sl={k:'h',c:'#fff'}; f.flt='bw'; f.ghost={n:3}; f.lip={m:{x:0.5}}; f.texts=[{id:'t1',str:'A',x:100,y:100,size:40,color:'#fff',style:'caption',rot:0}]; f.cam={z:2,x:500,y:900,tr:'smooth',d:1};})()""")
        # 1. Nhân bản frame: look kept, camera key NOT copied (one frame alone must not restart a camera move)
        await pg.click('#dupBtn'); await pg.wait_for_timeout(600)
        n = await pg.evaluate('S.frames.length'); bad = await pg.evaluate(SAME, [0, 1])
        check('dup frame copies picture + look + mouth + text', n == 2 and not bad, f'{n} {bad}')
        check('dup frame does not copy the camera key', await pg.evaluate('!S.frames[1].cam'))
        # 2. Chọn nhiều → Nhân bản: whole run, camera key too
        await pg.evaluate("(async()=>{msel.clear(); msel.add(S.frames[0].id); msel.add(S.frames[1].id); await mselDuplicate();})()"); await pg.wait_for_timeout(500)
        n = await pg.evaluate('S.frames.length'); bad = await pg.evaluate(SAME, [0, 2])
        check('multi-select duplicate keeps the look', n == 4 and not bad, f'{n} {bad}')
        check('multi-select duplicate keeps the camera key', await pg.evaluate("JSON.stringify(S.frames[2].cam)===JSON.stringify(S.frames[0].cam)"))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        check('undo removes the duplicates in one step', await pg.evaluate('S.frames.length') == 2)
        # 3. Lặp đoạn (loop frames 1-2 once)
        await pg.evaluate("repeatRange(0, 1, 1, 'loop')"); await pg.wait_for_timeout(600)
        n = await pg.evaluate('S.frames.length'); bad = await pg.evaluate(SAME, [0, 2])
        check('repeat range keeps the look', n == 4 and not bad, f'{n} {bad}')
        await pg.click('#undoBtn'); await pg.wait_for_timeout(300)
        check('undo removes the repeat', await pg.evaluate('S.frames.length') == 2)
        # 4. 📺 Phát lại: copies + replay colour + label
        await pg.evaluate("(async()=>{msel.clear(); S.lookOpt.rs=2; await selectFrame(1); await replayMake();})()"); await pg.wait_for_timeout(600)
        r = await pg.evaluate("[S.frames.length, S.frames[2].flt, S.frames[2].bgs && S.frames[2].bgs.d, S.frames[2].dur===S.frames[0].dur*2, S.frames[2].texts.some(t=>t.str.includes('PHÁT LẠI'))]")
        check('replay: slowed copies with the look + label', r == [4, 'replay', 'l', True, True], str(r))
        # 5. 👋 gesture + 💫 combo on a character moved along a path: new frames keep its place (lip.mv) and the text
        r = await pg.evaluate("""(async()=>{ await selectFrame(S.frames.length-1); await kitAdd(); const root=S.pp.parts.find(q=>!q.parent).id; const f=curFrame(); f.lip={mv:{[root]:{x:300,y:-40}}};
          const n0=S.frames.length; await ppGesture('hello'); const g=S.frames.slice(n0-1);
          await selectFrame(S.frames.length-1); const n1=S.frames.length; await gagRun('dizzy', {x:W/2, y:H/3}); const d=S.frames.slice(n1);
          const ok=fs=>fs.length>1 && fs.every(f=>f.lip&&f.lip.mv&&f.lip.mv[root]&&f.lip.mv[root].x===300);
          return [g.length, ok(g), g.every(f=>(f.texts||[]).length===(S.frames[n0-1].texts||[]).length), d.length, ok(d)]; })()""")
        check('gesture frames keep the path position + texts', r[1] and r[2], str(r))
        check('combo frames keep the path position', r[4], str(r))
        check('no page errors', not pe, str(pe[:2]))
        await b.close()
    print('ERR', errs)
asyncio.run(main()); srv.kill()
