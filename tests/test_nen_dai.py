import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🌄 Nền dài: a background wider than the frame (editor: paint, layers, own undo), panned across frames by time (🎯 fit / speed + 🔁 loop),
# parallax layers, drawn under the frame's Nền layer in edit / play cache / export / thumbnails, automatic undo, save + reload
srv = subprocess.Popen(['python3','-m','http.server','9771'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
PX = '''async ([i, pts]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg); await panoReady();
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawFrameBase(x, f, bg);
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
RED, GRN, BLU, BLK = [255, 0, 0], [0, 160, 0], [0, 0, 255], [0, 0, 0]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:9771/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        W, H = await pg.evaluate("[W,H]")
        await pg.evaluate("S.frames.forEach(f=>f.dur=250); S.cur=0; buildStrip(); updateFrameUI();")
        # Nền ▾ has the entry
        await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(150)
        check('Nền ▾ has 🌄 Nền dài', await pg.locator('.bgm-pano').count() == 1)
        await pg.click('.bgm-pano'); await pg.wait_for_timeout(200)
        # no pano yet → intro dialog → ✎ Vẽ nền dài opens the editor
        await pg.click('.dlg .btns >> text=✎ Vẽ nền dài'); await pg.wait_for_timeout(400)
        check('editor open', await pg.locator('#pnWrap').count() == 1)
        check('new pano = 3 frames wide', await pg.evaluate(f"PE.w === {W*3} && PE.layers.length === 1"))
        # a real pen stroke with the brush on the canvas, then the editor's own undo
        box = await pg.locator('#pnCv').bounding_box()
        pt = await pg.evaluate("(() => { const V = PE.vw, r = PE.cv.getBoundingClientRect(); const s = (x, y) => [r.left + (V[0]*x + V[4]) / DPR, r.top + (V[3]*y + V[5]) / DPR]; return [s(W*0.3, H*0.4), s(W*0.7, H*0.4)]; })()")
        await pg.evaluate("setColor('#000000'); PE.size = 60;")
        await pg.mouse.move(*pt[0]); await pg.mouse.down()
        for k in range(1, 11): await pg.mouse.move(pt[0][0] + (pt[1][0]-pt[0][0])*k/10, pt[0][1])
        await pg.mouse.up(); await pg.wait_for_timeout(100)
        A = "(()=>{ const d = PE.layers[0].c.getContext('2d').getImageData(Math.round(W*0.5), Math.round(H*0.4), 1, 1).data; return d[3]; })()"
        check('stroke painted on the layer', await pg.evaluate(A) > 200 and await pg.evaluate("PE.undo.length === 1"))
        await pg.click('#pnUndo'); await pg.wait_for_timeout(50)
        check('editor undo removes the stroke', await pg.evaluate(A) == 0)
        await pg.click('#pnRedo'); await pg.wait_for_timeout(50)
        check('editor redo', await pg.evaluate(A) > 200)
        await pg.click('#pnUndo')
        # 🪣 fill on an empty layer fills it all (no "outside the shape" refusal)
        await pg.evaluate("PE.tool='fill'; setColor('#ff0000'); pnFill(PE.layers[0], {x: 10, y: 10})")
        check('fill covers the empty layer', await pg.evaluate(f"(()=>{{ const d = PE.layers[0].c.getContext('2d').getImageData({W*3-5}, {H-5}, 1, 1).data; return d[0]===255 && d[3]===255; }})()"))
        # back layer: red | green | blue blocks, one per frame width
        await pg.evaluate("""(()=>{ const c = makeCanvas(PE.w, H), x = c.getContext('2d'); [['#ff0000',0],['#00a000',1],['#0000ff',2]].forEach(([col,k])=>{ x.fillStyle=col; x.fillRect(k*W,0,W,H); });
          pnPush(pnSnapL()); PE.layers[0] = { ...PE.layers[0], c }; pnSync(); pnDraw(); })()""")
        # ＋ Lớp mới: front layer, back layer becomes slower (0.5); front gets k=0.5 too? no: front k 1 → set front to Xa (0.2) via the button row
        await pg.click('[data-pnb="add"]'); await pg.wait_for_timeout(100)
        check('2 layers, back slowed to 0.5', await pg.evaluate("PE.layers.length===2 && PE.layers[0].k===0.5 && PE.layers[1].k===1 && PE.sel===1"))
        # make the BACK layer the near one again (k=1) and the front layer a slow one with a black stripe at x = W .. 1.05W
        await pg.evaluate("PE.sel = 0; pnSync();"); await pg.click('[data-pnk="1"]')
        await pg.evaluate("PE.sel = 1; pnSync();"); await pg.click('[data-pnk="0.5"]')
        await pg.evaluate("(()=>{ const L = PE.layers[1], c = pnOwn(L), x = c.getContext('2d'); x.fillStyle='#000'; x.fillRect(W, H*0.45, W*0.05, H*0.1); })()")
        check('speeds set', await pg.evaluate("PE.layers[0].k===1 && PE.layers[1].k===0.5"))
        await pg.click('#pnPrev'); await pg.wait_for_timeout(300); await pg.screenshot(path='nen_dai_xem_thu.png')
        await pg.click('#pnPrev'); await pg.wait_for_timeout(100)
        await pg.screenshot(path='nen_dai_editor.png')
        await pg.click('#pnDone'); await pg.wait_for_function("!PE && document.querySelector('#pnList')", timeout=20000); await pg.wait_for_timeout(200)
        check('saved into the project', await pg.evaluate("S.panos.length===1 && S.panos[0].layers.length===2 && S.panos[0].layers.every(L=>L.png && PN_CV.has(L.id)) && !PE"))
        # the apply dialog opens by itself, new pano chosen; frames 1..4 (to the end of the scene), 🎯 fit, ▶
        check('apply dialog open', await pg.locator('#pnList [data-pnid].on').count() == 1)
        check('range = this frame to the end', await pg.evaluate("[$('#pnA').value, $('#pnB').value].join()") == '1,4')
        await pg.click('[data-pns="fit"]'); await pg.click('[data-pnd="1"]')
        await pg.screenshot(path='nen_dai_hop_thoai.png')
        await pg.click('.dlg .btns >> text=✓ Áp cho các frame này'); await pg.wait_for_timeout(700)
        xs = await pg.evaluate("S.frames.map(f=>f.pan && f.pan.x)")
        print('x', xs)
        span = W * 2
        check('fit: 0 → whole width by time', all(abs(xs[i] - span * i / 3) < 0.2 for i in range(4)))
        p0 = await pg.evaluate(PX, [0, [[W*0.5, H*0.2]]]); p3 = await pg.evaluate(PX, [3, [[W*0.5, H*0.2], [W*0.02, H*0.5]]]); p1 = await pg.evaluate(PX, [1, [[W*0.1, H*0.2], [W*0.5, H*0.2]]])
        print(p0, p1, p3)
        check('frame 1 shows the left end (red)', p0[0] == RED)
        check('frame 2 is between red and green', p1[0] == RED and p1[1] == GRN)
        check('last frame shows the right end (blue)', p3[0] == BLU)
        check('parallax: slow layer moved half as far (stripe at W → screen 0)', p3[1] == BLK)
        # drawn under the frame's own Nền layer: a mark drawn there stays on top
        await pg.evaluate("(async()=>{ const bg = bgOf(S.frames[3]); await ensureLoaded(bg); const x = bg.canvas.getContext('2d'); x.fillStyle='#ffff00'; x.fillRect(W*0.8, H*0.8, 40, 40); bg.ver++; })()")
        q = await pg.evaluate(PX, [3, [[W*0.8+20, H*0.8+20], [W*0.5, H*0.8+20]]])
        check('Nền layer drawn over the pano', q[0] == [255, 255, 0] and q[1] == BLU)
        # play cache + thumbnail
        await pg.evaluate("buildPlayCache()"); await pg.wait_for_timeout(400)
        check('play cache key has the pano', await pg.evaluate("S.frames[3].playKey.includes('n')"))
        await pg.evaluate("drawThumb(S.frames[3])"); await pg.wait_for_timeout(100)
        th = await pg.evaluate("(()=>{ const t = S.frames[3].thumb; return Array.from(t.getContext('2d').getImageData(Math.round(t.width*0.5), Math.round(t.height*0.2), 1, 1).data.slice(0,3)); })()")
        check('thumbnail shows the pano', th[2] > 200 and th[0] < 60)
        # automatic undo / redo of the apply
        await pg.evaluate("histFlush()")
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        check('undo removes the pan from the frames', await pg.evaluate("S.frames.every(f=>!f.pan) && S.panos.length===1"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(400)
        check('redo puts it back', await pg.evaluate("S.frames.every(f=>f.pan)"))
        # speed + 🔁 loop: wraps round (draw pieces from the end and the start)
        await pg.evaluate("S.frames.forEach(f=>f.dur=1000); panoApply(S.panos[0].id, 0, 3, {dir: 1, sp: 0.6, lp: true})")
        xs = await pg.evaluate("S.frames.map(f=>f.pan.x)")
        check('speed: 0.6 frame width per second', all(abs(xs[i] - 0.6 * W * i) < 0.2 for i in range(4)) and await pg.evaluate("S.frames.every(f=>f.pan.lp===1)"))
        await pg.evaluate(f"S.frames[2].pan = {{ ...S.frames[2].pan, x: {W*2.5} }}")
        q = await pg.evaluate(PX, [2, [[W*0.25, H*0.2], [W*0.75, H*0.2]]])
        check('loop: right end joins the left end', q[0] == BLU and q[1] == RED)
        # no loop: stops at the end
        end = await pg.evaluate("panoApply(S.panos[0].id, 0, 3, {dir: 1, sp: 0.6, lp: false})")
        xs = await pg.evaluate("S.frames.map(f=>f.pan.x)")
        check('no loop: stays at the end', abs(xs[3] - W * 1.8) < 0.2 and await pg.evaluate("S.frames.every(f=>!f.pan.lp)"))
        await pg.evaluate("panoApply(S.panos[0].id, 0, 3, {dir: -1, sp: 'fit'})")
        xs = await pg.evaluate("S.frames.map(f=>f.pan.x)")
        check('◀ direction starts at the right end', abs(xs[0] - span) < 0.2 and abs(xs[3]) < 0.2)
        # copying a frame keeps the pano
        check('frameCopyOf keeps pan', await pg.evaluate("(()=>{ const g = frameCopyOf(S.frames[1]); const ok = g.pan && g.pan.x === S.frames[1].pan.x; freeFrame(g); return ok; })()"))
        # editing again: ✎ Sửa keeps unchanged layers' ids, a changed layer gets a new id; undo brings the old picture back
        ids0 = await pg.evaluate("S.panos[0].layers.map(L=>L.id)")
        await pg.evaluate("panoEdit(S.panos[0])"); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{ const L = PE.layers[0], c = pnOwn(L), x = c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,W*3,H); PE.dirty = true; })()")
        await pg.click('#pnDone'); await pg.wait_for_function("!PE", timeout=20000); await pg.wait_for_timeout(300)
        ids1 = await pg.evaluate("S.panos[0].layers.map(L=>L.id)")
        check('changed layer new id, other kept', ids1[0] != ids0[0] and ids1[1] == ids0[1])
        q = await pg.evaluate(PX, [3, [[W*0.5, H*0.2]]])
        check('edit shows', q[0] == [255, 255, 255])
        await pg.evaluate("histFlush(); undo()"); await pg.wait_for_timeout(500)
        q = await pg.evaluate(PX, [3, [[W*0.5, H*0.2]]])
        check('undo brings the old picture back (decoded from PNG)', q[0] == RED and await pg.evaluate(f"S.panos[0].layers[0].id === '{ids0[0]}'"))
        # save + reload
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(2500)
        for _ in range(3):
            if await pg.locator('.dlg .btns >> text=Bắt đầu vẽ').count(): await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
        check('reload: pano + frames back', await pg.evaluate("S.panos.length===1 && S.panos[0].layers.length===2 && S.frames.every(f=>f.pan)"))
        q = await pg.evaluate(PX, [0, [[W*0.5, H*0.2]]]); print('reload px', q, await pg.evaluate("S.frames.map(f=>f.pan.x)"))
        check('reload: pixels back', q[0] == BLU)
        # the look tab shows it
        await pg.evaluate("setTool('fx'); openTab('fx','look'); selectFrame(0); lookSync()"); await pg.wait_for_timeout(200)
        check('look tab status', 'Nền dài' in (await pg.evaluate("$('#pnStat').textContent + $('#lkStat').textContent")).replace('nền dài', 'Nền dài'))
        # delete from the dialog: frames lose it, undo brings both back
        await pg.click('#pnOpen'); await pg.wait_for_timeout(300)
        await pg.click('#pnDelB'); await pg.wait_for_timeout(200); await pg.click('.dlg .btns >> text=Xoá'); await pg.wait_for_timeout(300)
        check('deleted', await pg.evaluate("S.panos.length===0 && S.frames.every(f=>!f.pan)"))
        await pg.evaluate("histFlush(); undo()"); await pg.wait_for_timeout(500)
        check('undo delete', await pg.evaluate("S.panos.length===1 && S.frames.every(f=>f.pan)"))
        await b.close()
        print('ERR', errs)
asyncio.run(main())
