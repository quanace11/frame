import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9741'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🧩 Kho bộ phận: save a character's parts into folders, add an "AI" sheet of heads / a fist, swap them per frame (fitted on the
# joints, undo), a leaning torso moves the joints of its children, mirror, build a new character from the library, keep after reload.
SHEET = """(async (kind) => {   // a fake AI picture on white paper: 3 heads, or one fist arm hanging down
  const c = document.createElement('canvas'); c.width = 600; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 300);
  if (kind === 'head') for (let i = 0; i < 3; i++) { const cx = 100 + i * 200; x.fillStyle = '#f2c79a'; x.strokeStyle = '#222'; x.lineWidth = 4;
    x.beginPath(); x.ellipse(cx, 130, 60 + i * 15, 75, 0, 0, 7); x.fill(); x.stroke(); x.fillRect(cx - 18, 200, 36, 40); x.fillStyle = '#222';
    x.beginPath(); x.arc(cx - 20, 115, 7, 0, 7); x.arc(cx + 20, 115, 7, 0, 7); x.fill(); x.beginPath(); x.arc(cx, 160, 10 + i * 8, 0, Math.PI); x.fill(); }
  else { x.fillStyle = '#d33'; x.fillRect(285, 20, 30, 170); x.fillStyle = '#f2c79a'; x.beginPath(); x.arc(300, 215, 32, 0, 7); x.fill(); }
  const b = await new Promise(r => c.toBlob(r, 'image/png')); return new File([b], kind + '.png', { type: 'image/png' });
})"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9741/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("(async()=>{for(let k=0;k<3;k++){const f=newFrameObj(S.bgs[0].id); S.frames.push(f); loaded.push(f);} S.cur=0; buildStrip(); updateFrameUI(); setTool('puppet'); await kitAdd(); ppSyncBar();})()"); await pg.wait_for_timeout(800)
        # 1. 💾 the whole character → one item per part, each in its folder
        await pg.evaluate("ppSel=ppByRole('torso').id"); n = await pg.evaluate("plSaveChar()")
        L = await pg.evaluate("plList().then(L=>L.map(e=>[e.g,e.role]))")
        print('saved all parts', n == 10 and sorted(set(g for g, r in L)) == ['armL','armR','head','legL','legR','torso'] and ['armL','foreL'] == sorted(r for g, r in L if g == 'armL'))
        t = await pg.evaluate("plList().then(async L=>{const r=await plLoad(L.find(e=>e.role==='torso').id); return [!!r.a, Object.keys(r.a||{}).sort().join(), !!r.c.width]})")
        print('torso knows its joints', t == [True, 'armL,armR,head,legL,legR', True])
        # 2. ＋ Ảnh: a sheet with 3 heads → 3 items; a fist arm → a hand item with the joint on top
        ids = await pg.evaluate(f"(async()=>{{const f=await ({SHEET})('head'); await plImportFiles([f],'head'); const g=await ({SHEET})('fist'); await plImportFiles([g],'foreR'); return (await plList()).map(e=>[e.id,e.role,e.name])}})()")
        heads = [i for i, r, nm in ids if r == 'head' and nm.startswith('Đầu ')]; fist = [i for i, r, nm in ids if r == 'foreR' and nm.startswith('Bàn tay')][0]
        print('sheet split', len(heads) == 3)
        fj = await pg.evaluate(f"plLoad('{fist}').then(r=>[r.j.y < r.c.height*0.15, r.t && r.t.y > r.c.height*0.85])")
        print('fist joints guessed', fj == [True, True])
        # 3. swap the head on frame 2 only: fitted on the neck, same neck → top-of-head height, undo puts it back
        await pg.evaluate("S.cur=1; updateFrameUI(); ppSel=ppByRole('head').id; ppSyncBar()")
        na = await pg.evaluate("(ppByRole('head').alts||[]).length")
        await pg.evaluate(f"plApply('{heads[1]}','one')"); await pg.wait_for_timeout(300)
        r = await pg.evaluate("(()=>{const h=ppByRole('head'), a=h.alts[h.alts.length-1], v=S.frames[1].pp[h.id].v; return [h.alts.length, v===h.alts.length, !(S.frames[0].pp[h.id]||{}).v, Math.abs((h.py-(h.oy+a.dy+plTopY(a.c)))/(h.py-(h.oy+plTopY(h.c)))-1)<0.04, a.lib]})()")
        print('head swapped on this frame', r[:4] == [na + 1, True, True, True] and r[4] == heads[1])
        # the neck of the new picture sits on the joint (bottom-middle of the picture ≈ the head's pivot)
        nk = await pg.evaluate("(()=>{const h=ppByRole('head'), a=h.alts[h.alts.length-1]; const bx=h.ox+a.dx+a.c.width/2, by=h.oy+a.dy+a.c.height; return [Math.abs(bx-h.px)<a.c.width*0.1, Math.abs(by-h.py)<a.c.height*0.2]})()")
        print('neck on the joint', nk == [True, True])
        await pg.evaluate(f"plApply('{heads[2]}','one')"); await pg.wait_for_timeout(300)
        print('second head, one more picture', await pg.evaluate(f"ppByRole('head').alts.length==={na + 2}"))
        # a wider head (big hair / ears) still gets the same neck → top height, not a smaller head
        wh = await pg.evaluate("(()=>{const h=ppByRole('head'), a=h.alts[h.alts.length-1]; return [Math.abs((h.py-(h.oy+a.dy+plTopY(a.c)))/(h.py-(h.oy+plTopY(h.c)))-1)<0.04, Math.abs(plWidth(a.c)/plWidth(h.alts[h.alts.length-2].c)-1)>0.1, plWidth(a.c)/plWidth(h.alts[h.alts.length-2].c)]})()")
        print('wide head keeps the height', wh[:2] == [True, True], wh)
        await pg.evaluate(f"plApply('{heads[1]}','one')"); await pg.wait_for_timeout(300)
        print('same item reused', await pg.evaluate(f"ppByRole('head').alts.length==={na + 2} && ppByRole('head').alts[S.frames[1].pp[ppByRole('head').id].v-1].lib==='{heads[1]}'"))
        await pg.wait_for_timeout(300); await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        print('undo', await pg.evaluate(f"ppByRole('head').alts[S.frames[1].pp[ppByRole('head').id].v-1].lib==='{heads[2]}'"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300); await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        print('undo all', await pg.evaluate(f"(ppByRole('head').alts||[]).length==={na} && !(S.frames[1].pp[ppByRole('head').id]||{{}}).v"))
        # 4. quick strip in 🤸 Tạo dáng: the head folder, one tap = this frame
        await pg.evaluate("openTab('pp','pose'); ppSyncBar()"); await pg.wait_for_timeout(500)
        k = await pg.evaluate("document.querySelectorAll('#plStrip [data-plid]').length"); print('strip lists head folder', k == 4)
        await pg.click(f'#plStrip [data-plid="{heads[0]}"]'); await pg.wait_for_timeout(600)
        print('strip tap swaps', await pg.evaluate(f"(h=>h.alts[S.frames[1].pp[h.id].v-1].lib==='{heads[0]}')(ppByRole('head'))"))
        await pg.wait_for_timeout(300); await pg.screenshot(path='kho_bo_phan_strip.png')
        # 5. fist on the right hand, mirrored copy for the left
        await pg.evaluate(f"plApply('{fist}','all')"); await pg.wait_for_timeout(300)
        print('fist on right hand every key', await pg.evaluate(f"(h=>S.frames.every(f=>{{const q=f.pp[h.id]; return q&&h.alts[q.v-1]&&h.alts[q.v-1].lib==='{fist}'}}))(ppByRole('foreR'))"))
        await pg.evaluate(f"plMirror('{fist}')")
        print('mirrored to left', await pg.evaluate("plList().then(L=>L.some(e=>e.g==='armL'&&e.role==='foreL'&&/lật/.test(e.name)))"))
        # 6. a leaning torso: its head joint sits 24 px to the right → the head follows while that picture shows
        tid = await pg.evaluate("plList().then(L=>L.find(e=>e.role==='torso').id)")
        await pg.evaluate(f"(async()=>{{const r=await plLoad('{tid}'); const a=JSON.parse(JSON.stringify(r.a)); a.head.x+=24; await plUpdate('{tid}',{{a}});}})()")
        before = await pg.evaluate("(()=>{const h=ppByRole('head'), M=ppMats(ppPoseFor(curFrame())); return mApply(M[h.id],h.px,h.py)})()")
        await pg.evaluate(f"ppSel=ppByRole('torso').id; plApply('{tid}','one')"); await pg.wait_for_timeout(300)
        after = await pg.evaluate("(()=>{const h=ppByRole('head'), M=ppMats(ppPoseFor(curFrame())); return mApply(M[h.id],h.px,h.py)})()")
        dx = after['x'] - before['x']; print('leaning torso carries the head', 18 < dx < 30 and abs(after['y'] - before['y']) < 3, round(dx, 1))
        await pg.screenshot(path='kho_bo_phan_lean.png')
        # 7. still a normal part: bending / 🫨 jiggle draw with the swapped pictures without errors
        await pg.evaluate("(()=>{const f=curFrame(), q=ppQ(f, ppByRole('foreR').id); q.r=40; f.ver++; render();})()")
        # 8. 🧍 build a new character from the library (the 3 imported heads, the kit's pieces)
        L2 = await pg.evaluate("plList().then(L=>L.map(e=>[e.id,e.role]))")
        pick = {}
        for i, r in reversed(L2):
            pick[r] = i
        pick['head'] = heads[0]
        await pg.evaluate(f"S.cur=0; plBuild({pick!r}).then(r=>window._b=r); void 0"); await pg.wait_for_timeout(1500)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)   # 📍 where it shows: from this frame on
        rid = await pg.evaluate("window._b")
        await pg.wait_for_timeout(500)
        bt = await pg.evaluate(f"""(()=>{{const mine=S.pp.parts.filter(p=>ppCharOf(p)==='{rid}'), by={{}}; mine.forEach(p=>by[p.role]=p);
          const ok = by.head.parent===by.torso.id && by.foreL.parent===by.armL.id && by.shinR.parent===by.legR.id && !by.torso.parent;
          const el = Math.hypot(by.foreL.px-by.armL.tip.x, by.foreL.py-by.armL.tip.y);
          const low = Math.max(...mine.map(p=>p.oy+p.c.height));
          return [mine.length, ok, el < 2, Math.abs(low-H*0.95) < 2, mine.every(p=>p.hard)]}})()""")
        print('built character', bt == [10, True, True, True, True], bt)
        await pg.evaluate("(()=>{const f=curFrame(); f.ver++; render();})()"); await pg.screenshot(path='kho_bo_phan_build.png')
        # 9. library dialog
        await pg.evaluate("void plDialog('head')"); await pg.wait_for_timeout(600)
        print('dialog grid', await pg.evaluate("document.querySelectorAll('.pl-item').length===4"))
        await pg.screenshot(path='kho_bo_phan_dialog.png'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # 9b. 📍 torso drawn by hand: pin a library head on the neck, a fist on the elbow; a real tap on the frame replaces the fist
        await pg.evaluate("ppSel=null")
        await pg.evaluate(f"plPinBegin('{heads[1]}')"); await pg.wait_for_timeout(200)
        await pg.evaluate("plPinAt({x:W*0.3,y:H*0.3})"); await pg.wait_for_timeout(300)
        pn = await pg.evaluate("""(()=>{const r=S.pp.parts.find(p=>p.pinr), h=S.pp.parts.find(p=>p.parent===r.id&&p.role==='head');
          return [!!r, !!h, h&&Math.abs(h.px-W*0.3)<1&&Math.abs(h.py-H*0.3)<1, r.c.width===1, ppCharOf(h)===r.id]})()""")
        print('pinned head on the neck', pn == [True, True, True, True, True])
        await pg.evaluate(f"plPinBegin('{fist}')"); await pg.evaluate("plPinAt({x:W*0.42,y:H*0.45})"); await pg.wait_for_timeout(300)
        g = await pg.evaluate("(()=>{const r=S.pp.parts.find(p=>p.pinr); const m=S.pp.parts.filter(p=>ppCharOf(p)===r.id); const h=m.find(p=>p.role==='head'), f=m.find(p=>p.role==='foreR'); return [m.length, f.parent===r.id, h.z>f.z, !!f.tip&&f.tip.y>f.py]})()")
        print('fist pinned in the same group', g == [3, True, True, True])
        # a finger / pen tap on the frame places it: the second fist replaces the first
        await pg.evaluate(f"setTool('puppet'); plPinBegin('{fist}')"); await pg.wait_for_timeout(300)
        box = await pg.evaluate("(()=>{const r=view.getBoundingClientRect(); const M=viewMat(); return {x:r.left+(M[0]*W*0.6+M[2]*H*0.45+M[4])/DPR, y:r.top+(M[1]*W*0.6+M[3]*H*0.45+M[5])/DPR}})()")
        await pg.mouse.click(box['x'], box['y']); await pg.wait_for_timeout(600)
        g2 = await pg.evaluate("(()=>{const r=S.pp.parts.find(p=>p.pinr); const m=S.pp.parts.filter(p=>ppCharOf(p)===r.id); const f=m.filter(p=>p.role==='foreR'); const J=(fr)=>{const M=ppMats(ppPoseFor(fr)); return mApply(M[f[0].id],f[0].px,f[0].py)}; const a=J(curFrame()), b=J(S.frames[2]); return [m.length, f.length, Math.abs(a.x-W*0.6)<W*0.03&&Math.abs(a.y-H*0.45)<H*0.02, Math.abs(b.x-W*0.42)<2, plPin===null]})()")
        print('tap moves the same kind on this frame only', g2 == [3, 1, True, True, True], g2)
        # the 🧩 strip swaps pictures on pinned parts too
        await pg.evaluate("ppSel=S.pp.parts.find(p=>p.pinr&&false)||S.pp.parts.find(p=>p.role==='head'&&ppPart(p.parent)&&ppPart(p.parent).pinr).id")
        await pg.evaluate(f"plApply('{heads[2]}','one')"); await pg.wait_for_timeout(300)
        print('swap on pinned head', await pg.evaluate(f"(h=>h.alts.length===1&&curFrame().pp[h.id].v===1)(ppPart(ppSel))"))
        await pg.evaluate("render()"); await pg.screenshot(path='kho_bo_phan_ghim.png')
        # view tags: a side-view hand only shows when the view is Nghiêng (or Mọi góc)
        await pg.evaluate(f"(async()=>{{PL.vw='side'; const g=await ({SHEET})('fist'); await plImportFiles([g],'foreR'); PL.vw='';}})()"); await pg.wait_for_timeout(300)
        vv = await pg.evaluate("plList().then(L=>{const s=L.filter(e=>e.vw==='side'); PL.vw='front'; const a=L.filter(e=>e.g==='armR'&&plVwOk(e)).length; PL.vw='side'; const b=L.filter(e=>e.g==='armR'&&plVwOk(e)).length; PL.vw=''; return [s.length, a, b]})")
        print('view tags filter', vv[0] == 1 and vv[2] == vv[1] + 1, vv)
        # 10. saved: the pictures keep their library id and joint offsets after reload
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1000)
        await pg.reload(); await pg.wait_for_timeout(1800)
        print('pinned group kept', await pg.evaluate("S.pp.parts.some(p=>p.pinr&&!p.parent)"))
        kept = await pg.evaluate("(()=>{const t=S.pp.parts.find(p=>p.role==='torso'&&(p.alts||[]).some(a=>a.j)); const a=t&&t.alts.find(a=>a.j); return [!!a, a&&a.j.head&&a.j.head.x>15, !!(a&&a.lib)]})()")
        print('kept after reload', kept == [True, True, True])
        print('library kept', await pg.evaluate("PL.list=null, plList().then(L=>L.length===16)"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
