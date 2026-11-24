# Lưu / mở dự án an toàn + UX hộp thoại:
# đang lưu dở mà mở dự án khác không ghi lẫn, mở dự án hỏng thì quay lại dự án cũ, Xoá dự án nói thật là không hoàn tác được,
# mở ZIP thành dự án mới, phím tắt không chạy sau hộp thoại, nút hộp thoại không chạy 2 lần, chạm đúp 🗑 chỉ xoá 1 frame,
# bút bị hệ thống huỷ (pointercancel) thì bỏ nét dở.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9201'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
PEN='''async ([pts, cancel])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk(cancel?'pointercancel':'pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
LINE = [[300 + i * 8, 300 + i * 5] for i in range(30)]
fails = []
def check(name, ok):
    print(('ok  ' if ok else 'FAIL'), name)
    if not ok: fails.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9201/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
        ink = "(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n})()"

        # 1. đang lưu dở mà mở dự án khác
        await pg.evaluate(PEN, [LINE, False]); await pg.wait_for_timeout(200)
        A = await pg.evaluate("(async()=>{await flushSave(); return {id: curProjId, fr: S.frames.map(f=>f.id)}})()")
        B = await pg.evaluate("(async()=>{await createProject(1080,1920,'Dự án B'); return {id: curProjId}})()")
        await pg.evaluate(PEN, [LINE, False]); await pg.wait_for_timeout(100)
        B['fr'] = await pg.evaluate("S.frames.map(f=>f.id)")
        r = await pg.evaluate("""(async([a,b])=>{
          clearTimeout(saveT); saveT=null; saveProject();          // a save is running (PNG of the new line still being made)…
          await openProject(a);                                    // …and another project is opened right away
          await flushSave();
          const ra=await idbGet('project:'+a), rb=await idbGet('project:'+b);
          return {cur: curProjId, ra: ra.frames.map(f=>f.id), rb: rb.frames.map(f=>f.id), rbPng: !!rb.frames[0].png, nb: rb.name, na: ra.name};
        })(arguments[0])""".replace('arguments[0]', '[%r,%r]' % (A['id'], B['id'])))
        check('mở dự án khi đang lưu: dự án A giữ frame của A', r['ra'] == A['fr'] and r['cur'] == A['id'])
        check('mở dự án khi đang lưu: dự án B giữ frame + nét của B', r['rb'] == B['fr'] and r['rbPng'] and r['nb'] == 'Dự án B')

        # 2. mở dự án hỏng → quay lại dự án đang mở, không ghi đè
        r = await pg.evaluate("""(async()=>{
          const L=await projIndex(); L.push({id:'bad1', name:'Hỏng', updated:1, frames:1}); await idbPut('projects', L);
          await idbPut('project:bad1', {v:2, W:1080, H:1920, bgs:[], frames:null, name:'Hỏng'});
          const a=curProjId; await openProject('bad1'); await new Promise(r=>setTimeout(r,300)); await flushSave();
          const bad=await idbGet('project:bad1');
          return {back: curProjId===a, badKept: bad && bad.frames===null, ov: document.querySelectorAll('.ov').length};
        })()""")
        check('mở dự án hỏng thì quay lại dự án cũ', r['back'] and r['badKept'] and r['ov'] == 0)

        # 3. Xoá dự án: nói thật là không hoàn tác được
        await pg.evaluate("void projectsDialog()"); await pg.wait_for_timeout(300)
        await pg.click('.prow:not(.on) [data-pa="del"] >> nth=0'); await pg.wait_for_timeout(200)
        txt = await pg.evaluate("[...document.querySelectorAll('.ov')].pop().textContent")
        check('hộp Xoá dự án ghi Không hoàn tác được', 'Không hoàn tác được' in txt and 'Hoàn tác để lấy lại' not in txt)
        await pg.click('.ov >> nth=-1 >> .btns >> text=Huỷ'); await pg.wait_for_timeout(100)
        await pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.remove())")

        # 4. phím tắt không chạy sau hộp thoại
        await pg.evaluate("(async()=>{await addFrame(); await selectFrame(0);})()"); await pg.wait_for_timeout(200)
        await pg.evaluate("void modal({title:'Thử', buttons:[{label:'OK', value:1}]})"); await pg.wait_for_timeout(100)
        u0 = await pg.evaluate("undoStack.length")
        await pg.keyboard.press('ArrowRight'); await pg.keyboard.press(' '); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        r = await pg.evaluate("({cur:S.cur, playing:!!playing, u:undoStack.length})")
        check('phím tắt không chạy khi đang mở hộp thoại', r['cur'] == 0 and not r['playing'] and r['u'] == u0)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(200)
        check('đóng hộp thoại rồi phím tắt chạy lại', await pg.evaluate("S.cur") == 1)

        # 5. nút hộp thoại chạm 2 lần chỉ chạy 1 lần; lỗi thì báo, không treo
        await pg.evaluate("window.nAct=0; void modal({title:'Thử', buttons:[{label:'Làm', value:1, action: async()=>{nAct++; await new Promise(r=>setTimeout(r,300));}}]})"); await pg.wait_for_timeout(100)
        await pg.evaluate("(()=>{const b=[...document.querySelectorAll('.ov .btns button')].pop(); b.click(); b.disabled=false; b.click();})()")
        await pg.wait_for_timeout(500)
        check('nút hộp thoại chạm đúp chỉ chạy 1 lần', await pg.evaluate("nAct") == 1 and await pg.evaluate("document.querySelectorAll('.ov').length") == 0)
        await pg.evaluate("void modal({title:'Thử', buttons:[{label:'Lỗi', value:1, action: async()=>{throw new Error('hỏng')}}]})"); await pg.wait_for_timeout(100)
        await pg.click('.ov .btns >> text=Lỗi'); await pg.wait_for_timeout(200)
        r = await pg.evaluate("({ov: document.querySelectorAll('.ov').length, dis: [...document.querySelectorAll('.ov .btns button')].some(b=>b.disabled), t: document.getElementById('toast').textContent})")
        check('action lỗi: hộp vẫn mở, nút bấm lại được, có báo lỗi', r['ov'] == 1 and not r['dis'] and 'hỏng' in r['t'])
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)

        # 6. chạm đúp 🗑 ngay sau khi vẽ chỉ xoá 1 frame
        await pg.evaluate("(async()=>{await addFrame(); await selectFrame(1);})()"); await pg.wait_for_timeout(200)
        await pg.evaluate(PEN, [LINE, False]); await pg.wait_for_timeout(50)
        ids = await pg.evaluate("S.frames.map(f=>f.id)")
        r = await pg.evaluate("(async()=>{const a=delFrame(), b=delFrame(); await a; await b; return S.frames.map(f=>f.id)})()")
        check('chạm đúp 🗑 chỉ xoá 1 frame', len(r) == len(ids) - 1 and ids[1] not in r)
        r = await pg.evaluate("(async()=>{await undo(); return S.frames.map(f=>f.id)})()")
        check('hoàn tác xoá frame trả đúng thứ tự', r == ids)

        # 7. bút bị huỷ thì bỏ nét dở
        await pg.evaluate("(async()=>{await addFrame();})()"); await pg.wait_for_timeout(900)   # (+ Frame = 1 auto-undo step after 400 ms)
        u0 = await pg.evaluate("undoStack.length"); n0 = await pg.evaluate(ink)
        await pg.evaluate(PEN, [LINE, True]); await pg.wait_for_timeout(700)
        check('pointercancel của bút không để lại nét', await pg.evaluate(ink) == n0 and await pg.evaluate("undoStack.length") == u0 and await pg.evaluate("stroke") is None)

        # 8. mở ZIP thành dự án mới, dự án cũ còn nguyên
        r = await pg.evaluate("""(async()=>{
          await flushSave(); const old=curProjId, oldFr=S.frames.map(f=>f.id), n0=(await projIndex()).length;
          const enc=new TextEncoder(), c=makeCanvas(); c.getContext('2d').fillRect(10,10,50,50);
          const png=new Uint8Array(await (await toBlob(c)).arrayBuffer());
          const t={app:'frame-studio',version:1,width:1080,height:1920,frames:[{index:1,char_layer:'layers/char_001.png',duration_ms:200,vector:[]},{index:2,char_layer:'layers/char_002.png',duration_ms:200,vector:[]}],backgrounds:[]};
          const zip=makeZip([{name:'timing.json',data:enc.encode(JSON.stringify(t))},{name:'layers/char_001.png',data:png},{name:'layers/char_002.png',data:png}]);
          await importZip(new File([zip], 'Phim cua toi.zip'));
          const L=await projIndex(), recOld=await idbGet('project:'+old), rec=await idbGet('project:'+curProjId);
          return {neu: curProjId!==old, n: L.length-n0, oldKept: !!recOld && recOld.frames.map(f=>f.id).join()===oldFr.join(), fr: S.frames.length, name: S.projName, saved: !!rec && rec.frames.length===2, ov: document.querySelectorAll('.ov').length};
        })()""")
        check('mở ZIP thành dự án mới, dự án cũ còn', r['neu'] and r['n'] == 1 and r['oldKept'] and r['fr'] == 2 and r['saved'] and r['name'] == 'Phim cua toi' and r['ov'] == 0)
        await pg.screenshot(path='luu_du_an.png')
        await b.close()
        print('FAILS', fails)
        print('ERR', errs + fails)
asyncio.run(main())
