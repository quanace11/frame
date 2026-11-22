import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎞 Ghép theo video: the whole video stays a video on the 🎞 Video row of the 🎚 timeline. 3 s clip (1 s red, 1 s blue, 1 s green
# + tone). Add (film stretched to the video), ✂ split at the red playhead, drag to reorder, trim an edge, 🔗 join, mute, the
# sound mixed by scheduleAudio, ➕ frame at the playhead, undo / redo, save / reload, fast export, the "Thêm video" chooser.
srv = subprocess.Popen(['python3','-m','http.server','8931'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
CLIP = os.path.join(ASSETS, 'clip_rgb.webm')
COL = '''async (t) => { const T = frameStartTimes(); let i = 0; while (i < S.frames.length - 1 && T[i + 1] <= t) i++;
  const c = makeCanvas(), x = c.getContext('2d', { willReadFrequently: true }), base = makeCanvas(); await renderFinalFrame(x, i, base, t - T[i]);
  return Array.from(x.getImageData(W >> 1, H >> 1, 1, 1).data.slice(0, 3)); }'''
LOUD = '''async () => { const T = frameStartTimes(), tot = T[T.length - 1], ac = new OfflineAudioContext(1, Math.ceil(44100 * tot), 44100);
  const stop = await scheduleAudio(ac, ac.destination, 0, tot, 0); const b = await ac.startRendering(); const d = b.getChannelData(0);
  const seg = (a, z) => { let e = 0, n = 0; for (let i = Math.floor(a * 44100); i < Math.min(d.length, z * 44100); i += 5) { e += Math.abs(d[i]); n++; } return n ? e / n : 0; };
  return [seg(0.1, 0.9), seg(1.1, 1.9), seg(2.1, Math.min(2.9, tot - 0.05))]; }'''
def near(c, ref, tol=70): return all(abs(a - b) <= tol for a, b in zip(c, ref))
RED, BLUE, GREEN = [255, 0, 0], [0, 0, 255], [0, 255, 0]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:8931/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # ---------- the chooser of 🎬 Thêm video ----------
        await pg.set_input_files('#vidFramesFile', CLIP); await pg.wait_for_selector('.dlg .btns >> text=Theo video')
        check('chooser offers both ways', await pg.locator('.dlg .btns >> text=Theo frame').count() == 1)
        await pg.click('.dlg .btns >> text=Theo video')
        await pg.wait_for_function("vtOn() && S.bgVideo.clips.length===1 && bgVid.ready && !document.querySelector('.ov')", timeout=20000); await pg.wait_for_timeout(1500)
        st = await pg.evaluate("({len:S.bgVideo.clips[0].len, tot:frameStartTimes()[S.frames.length], n:S.frames.length, atl:atlOpen(), aud:hasAudio()})"); print(st)
        check('one 3 s piece, film stretched to the video, timeline open', abs(st['len'] - 3.0) < 0.1 and abs(st['tot'] - st['len']) < 0.01 and st['n'] == 1 and st['atl'])
        c = [await pg.evaluate(COL, t) for t in (0.5, 1.5, 2.5)]; print('colours', c)
        check('plays the video directly: red, blue, green', near(c[0], RED) and near(c[1], BLUE) and near(c[2], GREEN))
        ld = await pg.evaluate(LOUD); print('loud', ld)
        check('video sound mixed like a music clip', all(v > 0.05 for v in ld))
        await pg.screenshot(path='ghep_video_add.png')
        # ---------- ✂ split at 1 s ----------
        await pg.evaluate("atl.ph = 1.0; atlSel = null; atlSplit()"); await pg.wait_for_timeout(700)
        cl = await pg.evaluate("S.bgVideo.clips.map(c=>[c.off, Math.round(vtLen(c)*100)/100])"); print('split', cl)
        check('split into 1 s + 2 s', len(cl) == 2 and cl[0] == [0, 1.0] and abs(cl[1][0] - 1.0) < 0.01 and abs(cl[1][1] - 2.0) < 0.1)
        # ---------- drag the red piece to the end (reorder) ----------
        box = await pg.locator('#atlCv').bounding_box()
        y = await pg.evaluate("atlLay.rows.find(r=>r.k==='video').y + ATL_LANE/2")
        x0 = await pg.evaluate("atlX(0.5)"); x1 = await pg.evaluate("atlX(2.7)")
        await pg.mouse.move(box['x'] + x0, box['y'] + y); await pg.mouse.down()
        for k in range(1, 11): await pg.mouse.move(box['x'] + x0 + (x1 - x0) * k / 10, box['y'] + y); await pg.wait_for_timeout(30)
        await pg.mouse.up(); await pg.wait_for_timeout(900)
        order = await pg.evaluate("S.bgVideo.clips.map(c=>c.off)"); print('order', order)
        check('reordered: the red piece is now last', len(order) == 2 and abs(order[0] - 1.0) < 0.01 and order[1] == 0)
        c = [await pg.evaluate(COL, t) for t in (0.5, 1.5, 2.5)]; print('colours', c)
        check('blue, green, then red', near(c[0], BLUE) and near(c[1], GREEN) and near(c[2], RED))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(900)
        check('undo: order back (red first)', near(await pg.evaluate(COL, 0.5), RED) and await pg.evaluate("S.bgVideo.clips[0].off===0"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(900)
        check('redo: red last again', near(await pg.evaluate(COL, 2.5), RED))
        # ---------- trim the right edge of the red piece by 0.5 s ----------
        await pg.evaluate("atlSel = S.bgVideo.clips[1].id; atlDraw()")
        xe = await pg.evaluate("atlX(3.0) - 3"); xt = await pg.evaluate("atlX(2.5) - 3")
        await pg.mouse.move(box['x'] + xe, box['y'] + y); await pg.mouse.down()
        for k in range(1, 9): await pg.mouse.move(box['x'] + xe + (xt - xe) * k / 8, box['y'] + y); await pg.wait_for_timeout(30)
        await pg.mouse.up(); await pg.wait_for_timeout(900)
        st = await pg.evaluate("({end:vtEnd(), tot:frameStartTimes()[S.frames.length], len:S.bgVideo.clips[1].len})"); print('trim', st)
        check('trimmed to 2.5 s, film follows', abs(st['end'] - 2.5) < 0.06 and abs(st['tot'] - st['end']) < 0.01)
        # ---------- 🔗 join: split the blue-green piece, join it back ----------
        await pg.evaluate("atl.ph = 0.8; atlSel = null; atlSplit()"); await pg.wait_for_timeout(600)
        check('3 pieces after a 2nd cut', await pg.evaluate("S.bgVideo.clips.length===3"))
        await pg.evaluate("atlSel = S.bgVideo.clips[0].id; atlDraw(); atlJoin()"); await pg.wait_for_timeout(600)
        cl = await pg.evaluate("S.bgVideo.clips.map(c=>[c.off, Math.round(c.len*100)/100])"); print('join', cl)
        check('joined back into one 2 s piece', len(cl) == 2 and abs(cl[0][0] - 1.0) < 0.01 and abs(cl[0][1] - 2.0) < 0.06)
        # ---------- ⧉ duplicate + 🗑 delete ----------
        await pg.evaluate("atlSel = S.bgVideo.clips[1].id; atlDraw(); atlDup()"); await pg.wait_for_timeout(500)
        check('duplicate: 3 pieces, film longer', await pg.evaluate("S.bgVideo.clips.length===3 && Math.abs(frameStartTimes()[S.frames.length]-3.0)<0.06"))
        await pg.evaluate("document.getElementById('atlDel').click()"); await pg.wait_for_timeout(500)
        check('delete: back to 2 pieces', await pg.evaluate("S.bgVideo.clips.length===2"))
        # ---------- fit + mute of one piece ----------
        await pg.evaluate("atlSel = S.bgVideo.clips[0].id; atlDraw()")
        vis = await pg.evaluate("[!document.getElementById('atlVFit').hidden, !document.getElementById('atlVMute').hidden]")
        check('video buttons show for a video piece', vis == [True, True])
        await pg.click('#atlVMute'); await pg.wait_for_timeout(500)
        ld = await pg.evaluate(LOUD); print('loud muted first', ld)
        check('muted piece is silent, the other still has sound', ld[0] < 0.01 and ld[1] < 0.01 and ld[2] > 0.05)
        # ---------- ➕ frame at the red playhead ----------
        await pg.evaluate("atl.ph = 1.2; atlDraw()"); await pg.click('#atlFrHere'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("({n:S.frames.length, cur:S.cur, t1:frameStartTimes()[1], tot:frameStartTimes()[S.frames.length], end:vtEnd()})"); print('frame', st)
        check('new frame starts at 1.2 s, film still ends with the video', st['n'] == 2 and st['cur'] == 1 and abs(st['t1'] - 1.2) < 0.01 and abs(st['tot'] - st['end']) < 0.01)
        # draw on frame 2: only from 1.2 s on
        await pg.evaluate("(()=>{ const x=curFrame().canvas.getContext('2d'); x.fillStyle='#ff0'; x.fillRect(0,0,W,H); markEdited(curFrame()); })()")
        c = [await pg.evaluate(COL, t) for t in (0.5, 1.5)]; print('drawn', c)
        check('drawing on frame 2 covers the video only after 1.2 s', near(c[0], BLUE) and near(c[1], [255, 255, 0], 20))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='ghep_video_timeline.png')
        # ---------- playback runs the video ----------
        await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(300)
        await pg.evaluate("startPlay()"); await pg.wait_for_timeout(1500)
        pl = await pg.evaluate("({el:!!bgVid.el, paused:bgVid.el && bgVid.el.paused, t:bgVid.el && bgVid.el.currentTime})"); print('play', pl)
        check('playing: the video element plays', pl['el'] and not pl['paused'] and pl['t'] > 0.5)
        await pg.evaluate("stopPlay()"); await pg.wait_for_timeout(300)
        # ---------- save / reload ----------
        before = await pg.evaluate("JSON.stringify(S.bgVideo.clips)")
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.wait_for_function("vtOn() && bgVid.ready", timeout=20000); await pg.wait_for_timeout(500)
        st = await pg.evaluate("({clips:JSON.stringify(S.bgVideo.clips), buf:S.bgVideo.srcs[0].buf.byteLength, n:S.bgVideo.srcs.length})")
        check('reloaded: same pieces + the file', st['clips'] == before and st['buf'] > 1000 and st['n'] == 1)
        check('reloaded picture', near(await pg.evaluate(COL, 0.5), BLUE))
        # ---------- ⚡ fast export works with the video row ----------
        r = await pg.evaluate("(async()=>{ try { const b = await exportVideoFast(()=>{}, ()=>false); if (!b) return 'unsupported'; window._fx = Array.from(new Uint8Array(await b.arrayBuffer())); return b.size; } catch (e) { return 'ERR ' + e.message; } })()")
        print('fast export', r)
        if isinstance(r, int):
            open('ghep_video_fast.mp4', 'wb').write(bytes(await pg.evaluate("window._fx")))
            try:
                cols = []
                for t in (0.5, 1.5, 2.3):
                    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', 'ghep_video_fast.mp4', '-frames:v', '1', '-vf', 'crop=4:4:iw/2:ih/2,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
                    cols.append(list(raw[:3]))
                print('mp4 colours', cols)
                check('exported mp4: blue, green, red', len(cols[0]) == 3 and near(cols[0], BLUE) and near(cols[1], GREEN) and near(cols[2], RED))
            except FileNotFoundError: print('no ffmpeg: colours not checked')
        check('fast export ok (or not supported here)', r == 'unsupported' or (isinstance(r, int) and r > 1000))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
