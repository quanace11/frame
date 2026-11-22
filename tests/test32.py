import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Autosave: only changed PNGs are written (blob keys), save keeps retrying after an error, playback cache is bounded + freed
srv = subprocess.Popen(['python3','-m','http.server','8829'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
KEYS='''async()=>{const db=await idbOpen();return await new Promise(r=>{const q=db.transaction('kv').objectStore('kv').getAllKeys();q.onsuccess=()=>r(q.result.filter(k=>k.startsWith('blob:')))})}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8829/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        box = await pg.evaluate("(()=>{const r=document.getElementById('view').getBoundingClientRect();return [r.width,r.height]})()"); cx,cy = box[0]/2, box[1]/2
        await pg.evaluate(PEN,[[[cx-60,cy-60],[cx,cy-20],[cx+60,cy]]]); await pg.wait_for_timeout(2500)
        rec = await pg.evaluate("idbGet('project:'+curProjId).then(p=>({v:p.v, ref:!!(p.frames[0].png&&p.frames[0].png.ref)}))")
        print('record v2 with refs', rec)
        k1 = await pg.evaluate(KEYS); print('blob keys', len(k1))
        # count writes on the next stroke: only the edited frame's PNG should be rewritten
        await pg.evaluate("window._w=[]; const o=idbBlobPut; idbBlobPut=(r,k,bl,pid,gc)=>{_w.push(bl.map(x=>x[0])); return o(r,k,bl,pid,gc)}; 0")
        await pg.click('#addBtn') if await pg.query_selector('#addBtn') else None
        await pg.wait_for_timeout(2500)
        await pg.evaluate(PEN,[[[cx-40,cy+80],[cx+20,cy+100]]]); await pg.wait_for_timeout(2500)
        w = await pg.evaluate("_w"); print('writes per save', [len(x) for x in w], 'last only 1', len(w[-1])==1)
        # failure -> retry instead of giving up
        await pg.evaluate("window._fail=1; const o2=idbBlobPut; idbBlobPut=async(...a)=>{ if(_fail-->0) throw new Error('quota'); return o2(...a) }; 0")
        await pg.evaluate(PEN,[[[cx,cy+150],[cx+20,cy+190]]]); await pg.wait_for_timeout(2200)
        print('after error', await pg.evaluate("[storageOk, document.getElementById('saveState').textContent]"))
        await pg.wait_for_timeout(4000)
        print('retried ok', await pg.evaluate("[storageOk, document.getElementById('saveState').textContent]"))
        # reload: drawing still there
        n = await pg.evaluate("S.frames.length")
        await pg.reload(); await pg.wait_for_timeout(1500)
        a = await pg.evaluate("(async()=>{await ensureLoaded(S.frames[0]); const d=S.frames[0].canvas.getContext('2d').getImageData(0,0,W,H).data; let c=0; for(let i=3;i<d.length;i+=4) if(d[i]) c++; return c})()")
        print('reload frames', await pg.evaluate("S.frames.length")==n, 'pixels kept', a>100)
        # delete a frame -> its blob is garbage-collected
        if n > 1:
            fid = await pg.evaluate("S.frames[1].id")
            await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200); await pg.evaluate("delFrame(); 0"); await pg.wait_for_timeout(300);
            await pg.wait_for_timeout(2500)
            ks = await pg.evaluate(KEYS); print('gc removed deleted frame', not any(fid in k for k in ks))
        # duplicate copies blobs, delete project removes them
        pid = await pg.evaluate("curProjId")
        await pg.evaluate("(async()=>{const p=await idbGet('project:'+curProjId); window._nid=newId(); await copyProjectBlobs(curProjId,_nid,p); await idbPut('project:'+_nid,p);})()")
        ok = await pg.evaluate("(async()=>{const p=await idbGet('project:'+_nid); const b=await idbGet(p.frames[0].png.ref); return p.frames[0].png.ref.includes(_nid) && !!b})()")
        print('dup copies blobs', ok)
        nid = await pg.evaluate("_nid"); await pg.evaluate("deleteProjectBlobs(_nid)"); ks = await pg.evaluate(KEYS)
        print('delete removes blobs', not any(k.startswith('blob:'+nid) for k in ks))
        # old (v1) records with inline PNGs still open, and get upgraded on the next save
        await pg.evaluate("(async()=>{const p=await idbGet('project:'+curProjId); await resolveProjectRefs(p,'x'); p.v=1; window._oid=newId(); await idbPut('project:'+_oid,p); const L=await projIndex(); L.push({id:_oid,name:'cu',updated:1,frames:p.frames.length}); await idbPut('projects',L); await openProject(_oid);})()")
        await pg.wait_for_timeout(500)
        a = await pg.evaluate("(async()=>{await ensureLoaded(S.frames[0]); const d=S.frames[0].canvas.getContext('2d').getImageData(0,0,W,H).data; let c=0; for(let i=3;i<d.length;i+=4) if(d[i]) c++; return c})()")
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(800)
        print('v1 opens', a>100, 'upgraded', await pg.evaluate("idbGet('project:'+_oid).then(p=>p.v===2&&!!p.frames[0].png.ref)"))
        # playback cache: lower resolution for long films, freed after stop
        print('play size short/long', await pg.evaluate("[playCacheSize(10), playCacheSize(600)]"))
        await pg.evaluate("startPlay()"); await pg.wait_for_timeout(600); await pg.evaluate("stopPlay()")
        print('cache built', await pg.evaluate("S.frames.some(f=>f.play)"))
        await pg.evaluate("freePlayCache()"); print('cache freed', await pg.evaluate("!S.frames.some(f=>f.play)"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
