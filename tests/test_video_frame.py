import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎬 Video → frame: a 3 s clip (1 s red, 1 s blue, 1 s green + a 440 Hz tone) split into frames whose picture sits in each
# frame's own Nền layer (lazy JPEG, freed again), trimmed range + fps, sound kept as a clip, one undo step, insert in the
# middle, background eviction keeps edits, save / reload
srv = subprocess.Popen(['python3','-m','http.server','8913'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
CLIP = os.path.join(ASSETS, 'clip_rgb.webm')
PX = '''async ([i, px, py]) => { const f = S.frames[i]; await ensureLoaded(f); const bg = bgOf(f); if (bg) await ensureLoaded(bg);
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }); drawFrameBase(x, f, bg);
  return Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3)); }'''
def near(c, ref, tol=60): return all(abs(a - b) <= tol for a, b in zip(c, ref))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:8913/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        W, H = await pg.evaluate("[W,H]")
        check('entry in the Nền menu', await pg.evaluate("!!document.getElementById('vidFramesBtn')"))
        # ---------- dialog: range 0.5–2.5 s, 6 fps → 12 frames ----------
        await pg.set_input_files('#vidFramesFile', CLIP)
        await pg.click('.dlg .btns >> text=Theo frame')   # 🎬 Thêm video asks: by video or by frame
        await pg.wait_for_selector('#vfV', timeout=15000)
        await pg.fill('#vfA', '0.5'); await pg.dispatch_event('#vfA', 'change')
        await pg.fill('#vfB', '2.5'); await pg.dispatch_event('#vfB', 'change')
        await pg.click('[data-vffps="6"]')
        info = await pg.text_content('#vfInfo'); print('info', info)
        check('info: 12 frames, replaces the empty frame', '12 frame' in info and 'thay frame trống' in info)
        await pg.screenshot(path='video_frame_dialog.png')
        await pg.click('.dlg .btns >> text=Tách thành frame')
        await pg.wait_for_function("S.frames.length===12 && !document.querySelector('.ov')", timeout=30000); await pg.wait_for_timeout(600)
        st = await pg.evaluate("({n:S.frames.length, bgs:new Set(S.frames.map(f=>f.bgId)).size, sum:S.frames.reduce((s,f)=>s+f.dur,0), durs:S.frames.map(f=>f.dur), nb:S.bgs.length})")
        print(st)
        check('12 frames, each its own background, old background gone', st['n'] == 12 and st['bgs'] == 12 and st['nb'] == 12)
        check('durations follow the video clock (2 s)', st['sum'] == 2000 and set(st['durs']) <= {166, 167})
        c0 = await pg.evaluate(PX, [0, W/2, H/2]); c5 = await pg.evaluate(PX, [5, W/2, H/2]); c11 = await pg.evaluate(PX, [11, W/2, H/2])
        print('colours', c0, c5, c11)
        check('frame 1 = red part, frame 6 = blue part, frame 12 = green part', near(c0, [255, 0, 0]) and near(c5, [0, 0, 255]) and near(c11, [0, 255, 0]))
        check('picture sits in the Nền layer (frame layer empty)', await pg.evaluate("(async()=>{ const f=S.frames[3]; await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data; for(let k=3;k<d.length;k+=400) if(d[k]) return false; return true; })()"))
        th = await pg.evaluate("(()=>{ const t=S.frames[7].thumb; const d=t.getContext('2d').getImageData(t.width>>1,t.height>>1,1,1).data; return [d[0],d[1],d[2]]; })()")
        check('thumbnail shows the video', near(th, [0, 0, 255]))
        aud = await pg.evaluate("""(async()=>{ const c=S.audio && S.audio.voice; if(!c) return null; const ac=new OfflineAudioContext(1,44100,44100); const ab=await ac.decodeAudioData(c.buf.slice(0));
          const d=ab.getChannelData(0); let e=0; for(let i=0;i<d.length;i+=7) e+=Math.abs(d[i]); return {dur:ab.duration, loud:e/(d.length/7), start:c.frameId===S.frames[0].id, mouth:c.mouth||null}; })()""")
        print('audio', aud)
        check('sound kept: ~2 s clip from the first new frame', aud and abs(aud['dur'] - 2.0) < 0.06 and aud['loud'] > 0.05 and aud['start'] and not aud['mouth'])
        # ---------- memory: visiting all frames keeps only a few backgrounds in memory ----------
        await pg.evaluate("(async()=>{ for(let i=0;i<S.frames.length;i++) await selectFrame(i); await new Promise(r=>setTimeout(r,400)); await evictSoon(); })()"); await pg.wait_for_timeout(500)
        mem = await pg.evaluate("({lb:loadedBg.length, live:S.bgs.filter(b=>b.canvas).length, max:MAX_BG})"); print('mem', mem)
        check('backgrounds freed (LRU)', mem['lb'] <= mem['max'] and mem['live'] <= mem['max'])
        # an edit on a background survives being freed and loaded again
        await pg.evaluate("(async()=>{ const b=bgOf(S.frames[0]); await ensureLoaded(b); const x=b.canvas.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,60,60); b.ver++; await selectFrame(0); for(let i=0;i<S.frames.length;i++) await selectFrame(i); await new Promise(r=>setTimeout(r,300)); await evictSoon(); })()")
        await pg.wait_for_timeout(300)
        check('edited background was freed', await pg.evaluate("bgOf(S.frames[0]).canvas===null"))
        check('edit kept after reload from PNG', near(await pg.evaluate(PX, [0, 20, 20]), [0, 0, 0], 10) and near(await pg.evaluate(PX, [0, W/2, H/2]), [255, 0, 0]))
        # ---------- undo / redo: one step ----------
        await pg.evaluate("undoStack.length=0; redoStack.length=0; histRebase()")
        # make the import again from scratch to test undo: undo back to 12, then insert mid
        await pg.evaluate("selectFrame(2)"); await pg.wait_for_timeout(200)
        await pg.set_input_files('#vidFramesFile', CLIP)
        await pg.click('.dlg .btns >> text=Theo frame')   # 🎬 Thêm video asks: by video or by frame
        await pg.wait_for_selector('#vfV', timeout=15000)
        await pg.fill('#vfA', '0'); await pg.dispatch_event('#vfA', 'change')
        await pg.fill('#vfB', '1'); await pg.dispatch_event('#vfB', 'change')
        await pg.click('[data-vffps="6"]'); await pg.click('[data-vffit="contain"]')
        info = await pg.text_content('#vfInfo'); print('info2', info)
        check('info: inserts after frame 3', '6 frame' in info and 'sau frame 3' in info)
        await pg.click('.dlg .btns >> text=Tách thành frame')
        await pg.wait_for_function("S.frames.length===18 && !document.querySelector('.ov')", timeout=30000); await pg.wait_for_timeout(900)
        check('inserted after frame 3, current = first new frame', await pg.evaluate("S.cur===3 && S.frames[3].bgId!==S.frames[2].bgId"))
        check('frame 4 = red part', near(await pg.evaluate(PX, [3, W/2, H/2]), [255, 0, 0]))
        # a wide video: contain = white bars above/below, cover = fills the frame
        fit = await pg.evaluate("""(()=>{ const v=document.createElement('canvas'); v.width=200; v.height=100; const g=v.getContext('2d'); g.fillStyle='#f00'; g.fillRect(0,0,200,100);
          v.videoWidth=200; v.videoHeight=100; const out={}; for (const k of ['contain','cover']) { const c=makeCanvas(), x=c.getContext('2d',{willReadFrequently:true}); vfDraw(x, v, k, k==='cover'?0.5:0);
          out[k]=[Array.from(x.getImageData(W/2,20,1,1).data.slice(0,3)), Array.from(x.getImageData(W/2,H/2,1,1).data.slice(0,3))]; } return out; })()""")
        print('fit', fit)
        check('contain: white bars, cover: fills (and fade lightens)', fit['contain'][0] == [255, 255, 255] and fit['contain'][1] == [255, 0, 0] and near(fit['cover'][0], [255, 128, 128], 3))
        check('second sound clip starts at frame 4', await pg.evaluate("S.audio.voices && S.audio.voices.length===1 && voiceStart(S.audio.voices[0])===3"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(800)
        check('undo: back to 12 frames, sound removed', await pg.evaluate("S.frames.length===12 && !(S.audio.voices||[]).length && S.bgs.length===12"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(800)
        check('redo: 18 frames again', await pg.evaluate("S.frames.length===18 && S.bgs.length===18"))
        # ---------- save / reload (backgrounds load lazily) ----------
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(2500)
        check('reloaded: 18 frames, only a few backgrounds in memory', await pg.evaluate("S.frames.length===18 && S.bgs.filter(b=>b.canvas).length<=MAX_BG"))
        check('reloaded pictures', near(await pg.evaluate(PX, [11, W/2, H/2]), [0, 0, 255]) and near(await pg.evaluate(PX, [17, W/2, H/2]), [0, 255, 0]))
        await pg.screenshot(path='video_frame_after.png')
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
