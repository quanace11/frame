import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎚 audio timeline (dòng âm thanh): clips with waveform, drag to move (snaps to frame starts), trim both edges,
# ✂ split at the red playhead, 🔗 join back, 🗑 delete, ⧉ copy, undo/redo, the mixed sound follows (video export path),
# save/reload keeps the timing and split pieces share one stored file.
srv = subprocess.Popen(['python3','-m','http.server','8911'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# RMS of the offline mix (same path as ⚡ video export) in windows [a, b] seconds
MIX = '''async (wins) => { const T = frameStartTimes(), tot = T[T.length - 1], b = await vxMixAudio(tot, 22050), d = b.getChannelData(0), sr = b.sampleRate;
  return wins.map(([a, e]) => { let s = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(d.length, Math.floor(e * sr)); i++) { s += d[i] * d[i]; n++; } return n ? Math.sqrt(s / n) : 0; }); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8911/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        await pg.evaluate("S.frames.forEach(f=>f.dur=500); S.cur=0; buildStrip(); updateFrameUI(); selectFrame(0)")
        await pg.wait_for_timeout(300)
        check('panel closed at first', await pg.evaluate("!atlOpen()"))
        # real file inputs (same as ＋ Nhạc / ＋ Giọng): music 2 s, voice 1.6 s
        await pg.set_input_files('#musicFile', os.path.join(ASSETS, 'music.wav')); await pg.wait_for_timeout(400)
        check('adding a sound opens the audio timeline', await pg.evaluate("atlOpen()"))
        await pg.set_input_files('#voiceFile', os.path.join(ASSETS, 'voice.wav')); await pg.wait_for_timeout(400)
        for _ in range(30):
            if await pg.evaluate("atlLay && atlLay.clips.length===2 && atlLay.clips.every(o=>!o.load)"): break
            await pg.wait_for_timeout(100)
        lay = await pg.evaluate("atlLay.clips.map(o=>[o.kind, +o.st.toFixed(3), +o.len.toFixed(3)])")
        print('clips', lay)
        check('music + voice shown as clips with their length', lay == [['music', 0, 2.0], ['voice', 0, 1.6]])
        cv = await pg.evaluate("(()=>{const r=document.getElementById('atlCv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        L, Tp = cv[0], cv[1]
        X = lambda t: pg.evaluate(f"atlX({t})")
        Y = lambda kind: pg.evaluate(f"atlLay.clips.find(o=>o.kind==='{kind}').y + ATL_LANE/2")
        pps = await pg.evaluate("atl.pps"); print('pps', pps)
        await pg.screenshot(path='atl_0.png')
        # waveform drawn inside the music clip
        wav = await pg.evaluate("""(()=>{const cv=document.getElementById('atlCv'),x=cv.getContext('2d'),o=atlLay.clips[0],d=DPR||1;const px=atlX(1)*d,py=(o.y+ATL_LANE/2+4)*d;const v=x.getImageData(Math.round(px),Math.round(py),1,1).data;return Array.from(v)})()""")
        check('waveform drawn in the clip', wav[2] > 150)

        async def drag(x0, y0, x1, steps=12):
            await pg.mouse.move(L + x0, Tp + y0); await pg.mouse.down()
            for i in range(1, steps + 1): await pg.mouse.move(L + x0 + (x1 - x0) * i / steps, Tp + y0); await pg.wait_for_timeout(10)
            await pg.mouse.up(); await pg.wait_for_timeout(150)
        # move the voice by ~0.49 s → snaps to frame 2's start (0.5 s)
        vy = await Y('voice'); await drag(await X(0.8), vy, await X(0.8) + 0.49 * pps)
        v = await pg.evaluate("(()=>{const c=voiceClips()[0];return [+clipStart(c,'voice').toFixed(3), S.frames.findIndex(f=>f.id===c.frameId), c.dt||0]})()")
        print('voice after move', v)
        check('drag moves the voice and snaps to the frame start', v == [0.5, 1, 0])
        await pg.wait_for_timeout(600)
        check('move = 1 undo step', await pg.evaluate("undoStack.length") >= 1)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo puts the voice back', await pg.evaluate("clipStart(voiceClips()[0],'voice')") == 0)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300)
        check('redo moves it again', abs(await pg.evaluate("clipStart(voiceClips()[0],'voice')") - 0.5) < 1e-6)
        # trim (snap off for exact numbers)
        await pg.click('#atlSnap'); check('snap toggles off', not await pg.evaluate("atl.snap"))
        my = await Y('music')
        await drag(await X(2.0) - 4, my, await X(2.0) - 4 - 0.5 * pps)
        m = await pg.evaluate("(()=>{const c=S.audio.music;return [c.off||0, c.len]})()"); print('music after right trim', m)
        check('right edge trims the end', m[0] == 0 and abs(m[1] - 1.5) < 0.03)
        await drag(await X(0) + 4, my, await X(0) + 4 + 0.25 * pps)
        m = await pg.evaluate("(()=>{const c=S.audio.music;return [+clipStart(c,'music').toFixed(3), c.off, c.len]})()"); print('music after left trim', m)
        check('left edge trims the start (file offset + start move together)', abs(m[0] - 0.25) < 0.03 and abs(m[1] - 0.25) < 0.03 and abs(m[2] - 1.25) < 0.03)
        await pg.click('#atlSnap')
        # exact numbers for the rest
        await pg.evaluate("(()=>{const c=S.audio.music; c.off=0.25; c.len=1.25; clipSetStart(c,'music',0.25); scheduleSave(); atlDraw()})()"); await pg.wait_for_timeout(600)
        # tap on the ruler at 1.1 s → playhead there + frame 3 shown
        await pg.mouse.click(L + await X(1.1), Tp + 10); await pg.wait_for_timeout(300)
        ph = await pg.evaluate("[+atlPh().toFixed(2), S.cur]"); print('playhead', ph)
        check('tap on the ruler puts the playhead there and shows that frame', ph == [1.1, 2])
        # select the music clip, ✂ split
        await pg.mouse.click(L + await X(0.6), Tp + my); await pg.wait_for_timeout(150)
        check('tap selects the clip', await pg.evaluate("atlSel===S.audio.music.id"))
        await pg.click('#atlSplit'); await pg.wait_for_timeout(600)
        sp = await pg.evaluate("musicClips().map(c=>[+clipStart(c,'music').toFixed(3), +(c.off||0).toFixed(3), +clipLen(c,'music').toFixed(3)])")
        print('after split', sp)
        check('✂ splits into 2 pieces at the playhead', sp == [[0.25, 0.25, 0.85], [1.1, 1.1, 0.4]])
        await pg.screenshot(path='atl_1_split.png')
        mixed = await pg.evaluate(MIX, [[0.6, 0.9], [1.2, 1.3]])
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        check('undo joins the split', await pg.evaluate("musicClips().length") == 1)
        await pg.evaluate("redo()"); await pg.wait_for_timeout(300)
        check('redo splits again', await pg.evaluate("musicClips().length") == 2)
        # move the 2nd piece later, then 🔗 = pull it back to touch, 🔗 again = one clip
        await pg.evaluate("(()=>{const c=S.audio.musics[0]; clipSetStart(c,'music',1.5); scheduleSave(); atlSel=S.audio.music.id; atlDraw()})()"); await pg.wait_for_timeout(600)
        await pg.click('#atlJoin'); await pg.wait_for_timeout(300)
        check('🔗 pulls the next piece up to touch', abs(await pg.evaluate("clipStart(S.audio.musics[0],'music')") - 1.1) < 1e-3)
        await pg.click('#atlJoin'); await pg.wait_for_timeout(600)
        j = await pg.evaluate("musicClips().map(c=>[+clipStart(c,'music').toFixed(3), c.off, c.len])"); print('after join', j)
        check('🔗 again merges the 2 pieces back into 1 clip', j == [[0.25, 0.25, 1.25]])
        # ⧉ copy, 🗑 delete
        await pg.click('#atlDup'); await pg.wait_for_timeout(500)
        check('⧉ copies right after', await pg.evaluate("musicClips().length===2 && Math.abs(clipStart(S.audio.musics[0],'music')-1.5)<1e-3"))
        await pg.click('#atlDel'); await pg.wait_for_timeout(500)
        check('🗑 deletes the selected clip', await pg.evaluate("musicClips().length") == 1)
        # mix (video export path): voice deleted → only the trimmed music [0.25, 1.5]
        await pg.evaluate("(()=>{atlSel=voiceClips()[0].id; atlDraw()})()"); await pg.click('#atlDel'); await pg.wait_for_timeout(500)
        check('voice deleted', await pg.evaluate("voiceClips().length") == 0)
        r = await pg.evaluate(MIX, [[0.0, 0.23], [0.3, 1.4], [1.55, 2.0]]); print('mix rms', r, 'split mix', mixed)
        check('export sound: silent before the clip, music inside, silent after the trim', r[0] < 0.002 and r[1] > 0.05 and r[2] < 0.002)
        check('split pieces both play', mixed[0] > 0.05 and mixed[1] > 0.05)
        # sound effect clip on its own track: drag moves it in time (pinned to a frame + dt)
        await pg.evaluate("(()=>{S.audio.sfx.push({id:'sx1',frameId:S.frames[0].id,kind:'pop',vol:0.9}); scheduleSave(); waveKey=''; updateWaves()})()"); await pg.wait_for_timeout(600)
        await pg.click('#atlSnap')
        sy = await Y('sfx'); await drag(await X(0.1), sy, await X(0.1) + 0.8 * pps)
        sx = await pg.evaluate("(()=>{const x=S.audio.sfx[0];return [+clipStart(x,'sfx').toFixed(2), S.frames.findIndex(f=>f.id===x.frameId), x.dt]})()"); print('sfx', sx)
        check('sfx drags to any time (frame + offset)', abs(sx[0] - 0.8) < 0.03 and sx[1] == 1 and abs(sx[2] - 0.3) < 0.03)
        # a clip follows its frame when an earlier frame gets longer
        await pg.evaluate("S.frames[0].dur=700; updateFrameUI()")
        check('clip follows its frame when frames are retimed', abs(await pg.evaluate("clipStart(S.audio.sfx[0],'sfx')") - 1.0) < 0.03)
        await pg.evaluate("S.frames[0].dur=500; updateFrameUI()")
        # split again so 2 clips share a file, save, reload
        await pg.evaluate("(()=>{atl.ph=1.0; S.cur=2; atlSel=S.audio.music.id; atlDraw(); atlSplit()})()"); await pg.wait_for_timeout(600)
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(1500)
        keys = await pg.evaluate("[...savedBlobs.keys()].filter(k=>/:m:/.test(k))"); print('audio blobs', keys)
        check('split pieces share one stored file', len(keys) == 1)
        await pg.reload(); await pg.wait_for_timeout(2000)
        rl = await pg.evaluate("musicClips().map(c=>[+clipStart(c,'music').toFixed(3), +(c.off||0).toFixed(3), +(c.len||0).toFixed(3), c.buf && c.buf.byteLength>0])")
        print('after reload', rl)
        check('timing + pieces survive reload', rl == [[0.25, 0.25, 0.75, True], [1.0, 1.0, 0.5, True]])
        check('pieces share one buffer after reload', await pg.evaluate("S.audio.music.buf===S.audio.musics[0].buf"))
        check('panel stays open after reload', await pg.evaluate("atlOpen()"))
        check('sfx timing survives reload', abs(await pg.evaluate("clipStart(S.audio.sfx[0],'sfx')") - 0.8) < 0.03)
        # pinch zoom with 2 fingers
        for _ in range(4): await pg.click('#atlZo')
        p0 = await pg.evaluate("atl.pps")
        await pg.evaluate("""(()=>{const cv=document.getElementById('atlCv'),r=cv.getBoundingClientRect(),y=r.top+30;const mk=(t,id,x)=>new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});
          cv.dispatchEvent(mk('pointerdown',41,r.left+200)); cv.dispatchEvent(mk('pointerdown',42,r.left+300));
          for(let i=1;i<=8;i++){cv.dispatchEvent(mk('pointermove',41,r.left+200-i*10)); cv.dispatchEvent(mk('pointermove',42,r.left+300+i*10));}
          cv.dispatchEvent(mk('pointerup',41,r.left+120)); cv.dispatchEvent(mk('pointerup',42,r.left+380));})()""")
        p1 = await pg.evaluate("atl.pps"); print('pinch pps', p0, p1)
        check('pinch zooms the audio timeline', p1 > p0 * 2)
        await pg.click('#atlFit'); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{atlSel=S.audio.musics[0].id; atlDraw()})()")
        await pg.screenshot(path='atl_2_reload.png')
        # narrow portrait phone/tablet: bar scrolls, no page overflow
        await pg.set_viewport_size({'width': 600, 'height': 960}); await pg.wait_for_timeout(400)
        ov = await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        check('no page overflow in portrait', ov)
        await pg.screenshot(path='atl_3_portrait.png')
        await b.close()
    srv.terminate()
    print('ERR', errs)
asyncio.run(main())
