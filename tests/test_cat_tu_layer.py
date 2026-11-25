import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9243'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Cắt từ: chọn hình để khoanh = cả frame / chỉ 1 lớp vẽ (Nét, Vẽ tay, Màu) / 1 layer ảnh (vd. hình đã đồ nét thành layer).
# Cắt layer: nhân vật mới thay layer cũ ở mọi frame (đi theo chỗ layer đứng), layer cũ ẩn; frame không đổi.
# Layer 1 mảnh không bị 🪄 tự chia (không có mảnh để chia theo).
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
MK = """(()=>{const c=document.createElement('canvas'); c.width=400; c.height=500; const x=c.getContext('2d');
  x.fillStyle='#e08a14'; x.fillRect(0,0,280,500); x.fillStyle='#2a5ad8'; x.fillRect(280,40,120,60); return c})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9243/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate(f"imgToLayer({MK}, null, 'Hình đồ')"); await pg.wait_for_timeout(400)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)   # ppAskNew: từ frame này
        rid = await pg.evaluate("lyrRoots()[0].id")
        box = await pg.evaluate(f"(()=>{{const p=ppPart('{rid}'); return [p.ox,p.oy,p.c.width,p.c.height]}})()")
        ok('picture layer made', box[2] > 100, box)
        await pg.evaluate("(async()=>{await addFrame(); await addFrame(); await selectFrame(0)})()"); await pg.wait_for_timeout(300)
        await pg.evaluate(f"S.frames[2].pp={{...S.frames[2].pp, '{rid}':{{dx:100}}}}; S.frames[1].lip={{...(S.frames[1].lip||{{}}), off:{{}}}}; S.frames[2].lip={{...(S.frames[2].lip||{{}}), off:{{}}}}")
        X = lambda fx: box[0] + fx * box[2]; Y = lambda fy: box[1] + fy * box[3]
        # frame 1: a vector line over the picture + a pixel scribble far away
        await pg.evaluate(f"""(async()=>{{const f=curFrame(); await ensureLoaded(f);
          f.vec=[{{id:newId(), c:'#000', w:6, pts:[{{x:{X(0.2)},y:{Y(0.3)}}},{{x:{X(0.5)},y:{Y(0.5)}}},{{x:{X(0.3)},y:{Y(0.8)}}}]}}];
          const x=f.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(20,20,60,60); markEdited(f); render()}})()""")
        await pg.wait_for_timeout(200)
        await pg.evaluate("setTool('puppet')"); await pg.evaluate("hcBegin()"); await pg.wait_for_timeout(400)
        st = await pg.evaluate("HC && {sk:HC.sk, n:HC.regs.length, srcs:HC.srcs.map(o=>o[0]), row:!$('#hcSrcRow').hidden}")
        ok('frame cut, one-piece layer not auto-split', st and st['sk'] == 'frame' and st['n'] == 0, st)
        ok('Cắt từ lists the drawing layers + the picture layer', st and st['row'] and st['srcs'] == ['frame', 'vec', 'char', 'L:' + rid], st)
        await pg.select_option('#hcSrc', 'vec'); await pg.wait_for_timeout(300)
        ok('switched to Nét only', await pg.evaluate("HC.sk==='vec' && $('#hcSrc').value==='vec'"))
        R = lambda x0, y0, x1, y1: f'[{{x:{x0},y:{y0}}},{{x:{x1},y:{y0}}},{{x:{x1},y:{y1}}},{{x:{x0},y:{y1}}}]'
        await pg.evaluate(f"hcAdd({R(X(0.1), Y(0.2), X(0.6), Y(0.9))})")
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null', timeout=8000); await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("""(()=>{const f=S.frames[0], d=f.canvas.getContext('2d').getImageData(20,20,60,60).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]) n++;
          return {vec:f.vec.length, pix:n, roots:lyrRoots().length}})()""")
        ok('Nét cut out, Vẽ tay kept', r['vec'] == 0 and r['pix'] == 3600 and r['roots'] == 2, r)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        ok('1 undo step brings the line back', await pg.evaluate("S.frames[0].vec.length===1 && lyrRoots().length===1"))
        # cut the picture layer itself from 🗂 Layer → ✂
        await pg.evaluate(f"S.lyrOpen=true; ppSel='{rid}'; lyrSync(true)"); await pg.wait_for_timeout(200)
        ok('✂ in the layer panel', await pg.evaluate("!$('#lyrCut').disabled"))
        await pg.click('#lyrCut'); await pg.wait_for_timeout(400)
        ok('cutting the layer', await pg.evaluate(f"!!HC && HC.sk==='L:{rid}' && HC.img && !!HC.from && !$('#hcFollow').hidden"))
        await pg.evaluate(f"hcAdd({R(X(-0.05), Y(-0.05), X(0.78), Y(1.05))})")
        await pg.click('[data-hcr=armL]'); await pg.evaluate(f"hcAdd({R(X(0.62), Y(0.0), X(1.05), Y(0.3))})")
        await pg.screenshot(path='cat_tu_layer.png')
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null', timeout=8000); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const old=ppPart('{rid}'), roots=lyrRoots().filter(q=>q.id!=='{rid}'), nr=roots[0], arm=S.pp.parts.find(q=>q.parent===nr.id);
          return {{oldHidden:!!old.lh, n:roots.length, kids:arm?1:0, dx2:(S.frames[2].pp[nr.id]||{{}}).dx||0, dx0:(S.frames[0].pp[nr.id]||{{}}).dx||0, vec:S.frames[0].vec.length,
            ov:!document.querySelector('.ov')}}}})()""")
        ok('new character replaces the layer', r['oldHidden'] and r['n'] == 1 and r['kids'] == 1, r)
        ok('it follows where the layer stood on every frame', abs(r['dx2'] - 100) < 1 and abs(r['dx0']) < 1, r)
        ok('frame drawing untouched, no dialog left', r['vec'] == 1 and r['ov'], r)
        print('ERR', errs)
        await b.close()
asyncio.run(main())
if FAILS: sys.exit(1)
