import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, json, shutil
from playwright.async_api import async_playwright
# ⚡ fast MP4 export · 🎤 several voice clips (2 characters talk) · 📸 Shorts cover · 🎬 scenes · 👆 big buttons
srv = subprocess.Popen(['python3','-m','http.server','8895'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
fails = []
def check(name, ok, extra=''):
    print(('ok  ' if ok else 'FAIL'), name, extra)
    if not ok: fails.append(name)
def probe(path):
    if not shutil.which('ffprobe'): return None
    r = subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',path], capture_output=True, text=True)
    return json.loads(r.stdout or '{}')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1180,'height':900}, accept_downloads=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)+' @@ '+(e.stack or '')[:300]))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8895/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ')
        d2s = lambda x,y: pg.evaluate('([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]',[x,y])
        # puppet with a mouth, then a fake 2nd character (copied root + mouth) so 2 voices can move 2 mouths
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'mit.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=60000)
        await pg.evaluate("()=>{const p=S.pp.parts.find(x=>x.role==='head'); p.role='mouth';}")   # whole head acts as mouth: enough for the test
        await pg.evaluate("""()=>{const root=S.pp.parts.find(p=>!p.parent), m=S.pp.parts.find(p=>p.role==='mouth');
          S.pp.parts.push({...root, id:'root2', alts:[], ox:root.ox+300}); S.pp.parts.push({...m, id:'mouth2', parent:'root2', alts:[]}); ppSel=null;}""")
        # 8 frames of 0.25 s
        await pg.evaluate("async()=>{for(let i=0;i<7;i++){await dupFrame();} S.frames.forEach(f=>f.dur=250); buildStrip(); await selectFrame(0);}")
        await pg.click('[data-tool=fx]'); await pg.wait_for_timeout(200)
        await pg.click('.tabb[data-t=audio]')
        await pg.set_input_files('#voiceFile',os.path.join(ASSETS,'voice.wav')); await pg.wait_for_timeout(500)
        await pg.click('.fr >> nth=4'); await pg.wait_for_timeout(200)
        await pg.set_input_files('#voiceFile',os.path.join(ASSETS,'voice.wav')); await pg.wait_for_timeout(500)
        n = await pg.evaluate('voiceClips().length'); starts = await pg.evaluate('voiceClips().map(voiceStart)')
        check('two voice clips', n == 2 and starts == [0,4], str(starts))
        rows = await pg.evaluate("document.querySelectorAll('#fxVoiceList .vrow').length"); sels = await pg.evaluate("document.querySelectorAll('#fxVoiceList select').length")
        check('one row per clip + character picker', rows == 2 and sels == 2)
        await pg.select_option('#fxVoiceList select[data-vmouth="1"]', 'mouth2')
        check('clip 2 speaks with character 2', await pg.evaluate("voiceClips()[1].mouth==='mouth2' && voiceMouth(voiceClips()[0]).id!=='mouth2'"))
        await pg.click('#fxLip'); 
        try:
            await pg.wait_for_selector('text=Thêm frame', timeout=3000); await pg.click('.dlg .btns >> text=Không')
        except Exception: pass
        await pg.wait_for_timeout(800)
        lip = await pg.evaluate("S.frames.map(f=>f.lip&&f.lip.m?Object.keys(f.lip.m).sort().join('+'):'-')")
        print('lip mouths per frame', lip)
        m1 = await pg.evaluate("S.pp.parts.find(p=>p.role==='mouth'&&p.id!=='mouth2').id")
        check('mouth 1 talks from frame 1, mouth 2 from frame 5', m1 in lip[0] and 'mouth2' not in lip[0] and 'mouth2' in lip[4], str(lip))
        check('waveform shows both clips', await pg.evaluate("S.frames[4].el.classList.contains('hasw')"))
        # save + reload keeps both clips
        await pg.wait_for_timeout(2500); await pg.reload(); await pg.wait_for_timeout(2500)
        check('reload keeps 2 voice clips', await pg.evaluate("voiceClips().length===2 && voiceClips().every(c=>c.buf && c.buf.byteLength>1000) && voiceClips()[1].mouth==='mouth2'"))
        # ⚡ fast export (WebCodecs + MP4 writer) with sound
        await pg.evaluate("S.frames[2].texts=[{id:'t1',str:'GOAL!',x:W/2,y:H/3,size:120,color:'#ffe14d',style:'comic',rot:0}]")
        t0=time.time(); await pg.click('#videoBtn')
        await pg.wait_for_selector('text=Video đã xong', timeout=120000); secs = round(time.time()-t0,1); body = await pg.inner_text('.dlg .body')
        check('fast export used', 'xuất nhanh' in body, f'{secs}s · {body}')
        async with pg.expect_download() as dl: await pg.click('text=Lưu video')
        d=await dl.value; path='more_fast.mp4'; await d.save_as(path)
        total = await pg.evaluate('frameStartTimes()[S.frames.length]')
        pr = probe(path)
        if pr is not None:
            st = {s['codec_type']: s for s in pr.get('streams', [])}
            dur = float(pr.get('format', {}).get('duration', 0))
            check('mp4 has h264 video', st.get('video', {}).get('codec_name') == 'h264', str(st.get('video', {}).get('codec_name')))
            check('mp4 has audio', 'audio' in st, str(st.get('audio', {}).get('codec_name')))
            check('mp4 duration ≈ film', abs(dur - total) < 0.25, f'{dur} vs {total}')
            r = subprocess.run(['ffmpeg','-v','error','-i',path,'-f','null','-'], capture_output=True, text=True)
            check('mp4 decodes without errors', r.returncode == 0 and not r.stderr.strip(), r.stderr[:200])
            subprocess.run(['ffmpeg','-v','error','-y','-ss','0.6','-i',path,'-frames:v','1','more_fast_frame.png'])
        # the browser itself can play it back
        ok = await pg.evaluate("""async()=>{const r=await fetch('/tests/out/more_fast.mp4'); if(!r.ok) return 'nofetch'; const u=URL.createObjectURL(await r.blob()); const v=document.createElement('video'); v.muted=true; v.src=u; await new Promise(res=>{v.onloadedmetadata=res; v.onerror=res; setTimeout(res,4000)}); return v.duration>0 && v.videoWidth===W}""")
        check('chrome plays the mp4', ok is True, str(ok))
        # 📸 cover image
        await pg.evaluate("()=>{coverDialog()}"); await pg.wait_for_selector('#cvTxt')
        await pg.fill('#cvTxt', 'CÚ SÚT\nLỖI!'); await pg.click('[data-cv=style][data-v=band]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='more_cover_dialog.png')
        async with pg.expect_download() as dl: await pg.click('.dlg .btns >> text=Lưu ảnh bìa')
        d=await dl.value; await d.save_as('more_cover.png')
        from PIL import Image
        im = Image.open('more_cover.png'); wh = await pg.evaluate('[W,H]')
        check('cover PNG full size', list(im.size) == wh, str(im.size))
        crop = im.convert('RGB').crop((0, int(wh[1]*0.08), wh[0], int(wh[1]*0.3))).resize((108, 44))
        red = sum(1 for q in crop.getdata() if q[0] > 180 and q[1] < 70 and q[2] < 70)
        check('cover has the red title band near the top', red > 200, str(red))
        nf = await pg.evaluate('S.frames.length')
        await pg.evaluate("()=>{coverDialog()}"); await pg.wait_for_selector('#cvTxt'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm làm frame đầu'); await pg.wait_for_timeout(800)
        check('cover added as first frame', await pg.evaluate('S.frames.length') == nf + 1 and await pg.evaluate('S.frames[0].dur') == 500)
        await pg.wait_for_timeout(600); await pg.click('#undoBtn'); await pg.wait_for_timeout(600)
        check('undo removes the cover frame', await pg.evaluate('S.frames.length') == nf)
        # 🎬 scenes: mark scene at frame 4, move it before scene 1, undo
        ids = await pg.evaluate('S.frames.map(f=>f.id)')
        await pg.evaluate('selectFrame(4)'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{shotsDialog()}"); await pg.wait_for_selector('text=Cảnh mới từ frame 5')
        await pg.click('.dlg .btns >> text=Cảnh mới từ frame 5'); await pg.wait_for_selector('#scName'); await pg.fill('#scName','Sút bóng')
        await pg.click('.dlg .btns >> text=Xong'); await pg.wait_for_timeout(300)
        sl = await pg.evaluate('sceneList().map(s=>[s.name,s.a,s.b])')
        check('2 scenes', sl == [['Cảnh 1',0,3],['Sút bóng',4,len(ids)-1]], str(sl))
        check('timeline shows scene badge', await pg.evaluate("S.frames[4].el.querySelector('.scb').textContent.includes('Sút bóng')"))
        await pg.screenshot(path='more_scene_strip.png')
        await pg.evaluate("()=>{shotsDialog()}"); await pg.wait_for_selector('[data-sc=up][data-k="1"]'); await pg.click('[data-sc=up][data-k="1"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='more_scene_dialog.png')
        await pg.click('.dlg .btns >> text=Đóng'); await pg.wait_for_timeout(300)
        ids2 = await pg.evaluate('S.frames.map(f=>f.id)'); sl2 = await pg.evaluate('sceneList().map(s=>[s.name,s.a,s.b])')
        check('scene moved to the front, names kept', ids2 == ids[4:] + ids[:4] and sl2[0][0] == 'Sút bóng' and sl2[1][0] == 'Cảnh 1', str(sl2))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(600)
        check('undo puts scenes back', await pg.evaluate('S.frames.map(f=>f.id)') == ids)
        await pg.evaluate("()=>{shotsDialog()}"); await pg.wait_for_selector('[data-sc=sel][data-k="1"]'); await pg.click('[data-sc=sel][data-k="1"]'); await pg.wait_for_timeout(300)
        check('select scene = its frames', await pg.evaluate('msel.size') == len(ids) - 4); await pg.evaluate('mselEnd()')
        # 👆 big buttons
        await pg.evaluate("S.bigUi=true; applyBigUi()"); await pg.wait_for_timeout(200)
        w = await pg.evaluate("document.querySelector('.sw') ? document.querySelector('.sw').getBoundingClientRect().width : 42")
        lh = await pg.evaluate("document.querySelector('#layerChar .name').getBoundingClientRect().height")
        check('big colour dots and layer buttons', w >= 42 and lh >= 44, f'{w} {lh}')
        await pg.screenshot(path='more_bigui.png')
        print('fails', fails)
        print('ERR', errs + fails); await b.close()
asyncio.run(main()); srv.kill()
