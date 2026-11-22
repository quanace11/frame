import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, io, wave, struct, math, base64
from playwright.async_api import async_playwright
# ✨ animated text (pop / typing / exit fade, set on the whole run of copies, still pictures at rest, GIF split),
# 👻 afterimage (ghosts of the previous frames under the character, tint, scene stop, save/reload, undo),
# 🥁 music beats (tempo + phase from a click track, ticks, 🎯 snap next frame to the beat, 🥁 fit frames to beats)
srv = subprocess.Popen(['python3','-m','http.server','8897'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PIX = '''async ([t, pts]) => { const T = frameStartTimes(); let i = T.findIndex((v, k) => k < S.frames.length && t < T[k + 1]); if (i < 0) i = S.frames.length - 1;
  const f = S.frames[i]; await ghostLoad(f); await ensureLoaded(f); const base = makeCanvas(); drawFrameBase(base.getContext('2d'), f, bgOf(f));
  const out = makeCanvas(), x = out.getContext('2d', { willReadFrequently: true });
  drawFrameFx(x, i, base, t, t - T[i]);
  return pts.map(([px, py]) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data.slice(0, 3))); }'''
def click_track(bpm=120, off=0.25, secs=12, sr=22050):
    n = int(secs * sr); d = [0.0] * n; per = 60 / bpm; t = off
    while t < secs - 0.1:
        s0 = int(t * sr)
        for j in range(int(0.04 * sr)):
            if s0 + j < n: d[s0 + j] += 0.8 * math.exp(-j / (0.006 * sr)) * math.sin(2 * math.pi * 1000 * j / sr) + 0.5 * math.exp(-j / (0.01 * sr)) * math.sin(2 * math.pi * 80 * j / sr)
        t += per
    bio = io.BytesIO(); w = wave.open(bio, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(v * 32767)))) for v in d)); w.close()
    return base64.b64encode(bio.getvalue()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8897/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        await pg.evaluate("S.frames.forEach(f=>f.dur=500); S.cur=0; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','text')")
        await pg.wait_for_timeout(300)
        W, H = await pg.evaluate("[W,H]")
        # ---------- ✨ animated text ----------
        await pg.evaluate("""fxEdit(f=>{f.texts=[{id:'tx1',str:'GOAL',x:W/2,y:H/2,size:160,color:'#ffe14d',style:'comic',rot:0}]}); fxSel='tx1'; fxSyncBar()""")
        await pg.evaluate("document.getElementById('fxKeepN').value=2"); await pg.click('#fxKeep')
        check('text kept on 3 frames', await pg.evaluate("S.frames.slice(0,3).every(f=>(f.texts||[]).some(t=>t.id==='tx1')) && !(S.frames[3].texts||[]).length"))
        check('anim selects filled', await pg.evaluate("document.querySelectorAll('#txIn option').length") == 8 and not await pg.evaluate("document.getElementById('txIn').disabled"))
        await pg.select_option('#txIn', 'pop'); await pg.wait_for_timeout(500)
        check('pop set on every copy', await pg.evaluate("S.frames.slice(0,3).every(f=>f.texts.find(t=>t.id==='tx1').an==='pop')"))
        check('run info', '1–3' in await pg.inner_text('#txInfo'))
        k0 = await pg.evaluate("txAnim(S.frames[0].texts[0],0,0).k"); k1 = await pg.evaluate("txAnim(S.frames[0].texts[0],0,0.2).k"); k2 = await pg.evaluate("txAnim(S.frames[1].texts[0],1,0.1).k")
        print('pop scale', k0, k1, k2)
        check('pop: starts at 0, overshoots, rests at 1', k0 < 0.01 and k1 > 1.02 and abs(k2 - 1) < 1e-6)
        C = [[W/2, H/2], [W/2 - 120, H/2]]
        a = await pg.evaluate(PIX, [0.0, C]); z = await pg.evaluate(PIX, [0.7, C])
        print('text pixels t0 / rest', a, z)
        check('pop: hidden at the very start, drawn later', all(min(v) > 245 for v in a) and any(v[2] < 120 for v in z))
        still = await pg.evaluate("""(()=>{const c=makeCanvas(),x=c.getContext('2d',{willReadFrequently:true}); x.fillStyle='#fff';x.fillRect(0,0,W,H); trSkip=true; drawTexts(x,S.frames[0],null,0,0); trSkip=false; let n=0; const d=x.getImageData(0,0,W,H).data; for(let i=0;i<d.length;i+=4) if(d[i+2]<120) n++; return n})()""")
        check('still pictures (PNG/cover) show the text at rest', still > 500)
        # typing
        await pg.select_option('#txIn', 'type'); await pg.wait_for_timeout(200)
        chs = await pg.evaluate("[0, 0.08, 0.16, 0.24, 0.3].map(t=>txAnim(S.frames[0].texts[0],0,t).ch)")
        print('typing chars', chs)
        check('typing: letters appear one by one', chs == [0, 1, 2, 3, 4])
        # exit fade at the end of the run + loop
        await pg.select_option('#txOut', 'fade'); await pg.select_option('#txLp', 'pulse'); await pg.wait_for_timeout(200)
        al = await pg.evaluate("[txAnim(S.frames[2].texts[0],2,0.1).a, txAnim(S.frames[2].texts[0],2,0.45).a, txAnim(S.frames[2].texts[0],2,0.499).a]")
        print('exit alpha', al)
        check('exit fade: full then fading to 0', al[0] > 0.99 and 0.05 < al[1] < 0.5 and al[2] < 0.03)
        wins = await pg.evaluate("txWins(frameStartTimes())")
        check('GIF time windows for the moving text', len(wins) == 1 and abs(wins[0]['t0']) < 1e-6 and abs(wins[0]['t1'] - 1.5) < 1e-6)
        n = await pg.evaluate("""(async()=>{let n=0; const ge=gifEncoder; gifEncoder=(w,h)=>{const e=ge(w,h); const add=e.add; e.add=(d,c)=>{n++; return add(d,c)}; return e}; const dl=deliverFile; deliverFile=async()=>{}; await exportGif(320); gifEncoder=ge; deliverFile=dl; return n})()""")
        print('gif pictures', n)
        check('GIF split while the text moves', n > 20)
        # preview plays just the run
        await pg.click('#txPrev'); await pg.wait_for_timeout(300)
        check('preview plays the text run', await pg.evaluate("playing && playRange && playRange[0]===0 && playRange[1]===3"))
        await pg.evaluate("stopPlay()")
        await pg.screenshot(path='chu_dong_bar.png')
        await pg.select_option('#txIn', ''); await pg.select_option('#txOut', ''); await pg.select_option('#txLp', '')
        check('anim cleared on every copy', await pg.evaluate("S.frames.slice(0,3).every(f=>{const t=f.texts.find(t=>t.id==='tx1'); return !t.an&&!t.ao&&!t.lp})"))
        await pg.evaluate("S.frames.forEach(f=>f.texts=[])")
        # ---------- 👻 afterimage ----------
        await pg.evaluate("""(async()=>{for (let i=0;i<3;i++){const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H); x.fillStyle='#000'; x.fillRect(100+i*300,400,150,150); f.ver++; queueThumbFor(f);} S.cur=2; updateFrameUI(); openTab('fx','cam'); fxSyncBar();})()""")
        await pg.wait_for_timeout(300)
        P = [[175, 475], [475, 475], [775, 475]]
        g0 = await pg.evaluate(PIX, [1.2, P])
        check('no ghost: old places stay white', all(min(v) > 245 for v in g0[:2]) and max(g0[2]) < 10)
        await pg.click('[data-ghn="2"]'); await pg.click('[data-ght=""]'); await pg.click('#ghBtn'); await pg.wait_for_timeout(500)
        check('ghost stored on frame 3', await pg.evaluate("S.frames[2].ghost && S.frames[2].ghost.n===2 && !S.frames[2].ghost.c"))
        g1 = await pg.evaluate(PIX, [1.2, P]); print('ghost pixels', g1)
        check('ghosts: older lighter, newer darker, current solid', 245 > g1[0][0] > g1[1][0] > 100 and max(g1[2]) < 10)
        check('button shows on', await pg.evaluate("document.getElementById('ghBtn').classList.contains('on')"))
        await pg.click('[data-ght="#4fc3ff"]'); await pg.wait_for_timeout(300)
        g2 = await pg.evaluate(PIX, [1.2, P]); print('tinted', g2)
        await pg.evaluate("requestRender()"); await pg.wait_for_timeout(200); await pg.screenshot(path='chu_dong_ghost.png')
        check('tint: ghosts turn blue', g2[1][2] > g2[1][0] + 40 and await pg.evaluate("S.frames[2].ghost.c==='#4fc3ff'"))
        await pg.evaluate("S.frames[1].scene='Cảnh 2'")
        g3 = await pg.evaluate(PIX, [1.2, P])
        check('ghosts stop at a scene start', min(g3[0]) > 245 and g3[1][2] < 250)
        await pg.evaluate("delete S.frames[1].scene")
        # edit view also shows it (render runs without errors) + playback cache
        await pg.evaluate("requestRender()"); await pg.wait_for_timeout(200)
        await pg.evaluate("startPlay()"); await pg.wait_for_timeout(600); await pg.evaluate("stopPlay()")
        await pg.wait_for_timeout(700)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        check('undo the tint', await pg.evaluate("S.frames[2].ghost && !S.frames[2].ghost.c"))
        await pg.evaluate("document.getElementById('ghNextN').value=2; S.cur=0; updateFrameUI()"); await pg.click('#ghNext')
        check('ghost for N frames', await pg.evaluate("!!S.frames[0].ghost && !!S.frames[1].ghost && !!S.frames[2].ghost && !S.frames[3].ghost"))
        # ---------- 🥁 beats ----------
        openA = await pg.evaluate("openTab('fx','audio'); fxSyncBar(); document.getElementById('beatInfo').textContent")
        check('beat info asks for music first', 'nhạc' in openA)
        await pg.evaluate("""(b64)=>{const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); S.audio=S.audio||{}; S.audio.music={name:'click.wav', buf:u.buffer, vol:0.6, frameId:S.frames[0].id}; waveKey=''; updateWaves(); fxSyncBar();}""", click_track())
        for _ in range(40):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("!!musicBeats()"): break
        bt = await pg.evaluate("musicBeats()")
        print('bpm', bt and bt['bpm'], bt and bt['times'][:4])
        check('tempo found ~120', bt and abs(bt['bpm'] - 120) < 2)
        check('beats on the clicks', bt and all(min(abs(t - (0.25 + 0.5 * round((t - 0.25) / 0.5))), 1) < 0.03 for t in bt['times'][:20]))
        check('info shows bpm', '120' in await pg.inner_text('#beatInfo') or '119' in await pg.inner_text('#beatInfo') or '121' in await pg.inner_text('#beatInfo'))
        # frame 1 (0–0.5 s) → next frame starts on the nearest beat (0.75 or 0.25 …)
        await pg.evaluate("S.cur=0; S.frames[0].dur=700; updateFrameUI(); scheduleSave()"); await pg.wait_for_timeout(700); await pg.click('#beatSnap'); await pg.wait_for_timeout(500)
        d0 = await pg.evaluate("S.frames[0].dur"); print('snap dur', d0)
        check('snap: next frame starts on a beat', abs(d0 - 750) < 25)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(100)
        check('undo snap', await pg.evaluate("S.frames[0].dur") == 700)
        await pg.wait_for_timeout(600)
        c = await pg.evaluate("beatFit(0, 3, 1)"); T = await pg.evaluate("frameStartTimes()")
        print('fit', c, T)
        check('fit: every frame ends on a beat', c == 4 and all(abs(T[k + 1] - (0.25 + 0.5 * k)) < 0.03 for k in range(4)))
        await pg.evaluate("beatFit(0, 3, 2)"); T = await pg.evaluate("frameStartTimes()")
        check('fit 2 beats: 1 s each', all(abs(T[k + 1] - (0.75 + 1.0 * k)) < 0.03 for k in range(4)))
        await pg.wait_for_timeout(600)
        await pg.evaluate("beatFit(0, 3, 0.5)"); T = await pg.evaluate("frameStartTimes()")
        check('fit half beats', all(abs(T[k + 1] - (0.25 + 0.25 * k)) < 0.03 for k in range(4)))
        await pg.wait_for_timeout(600); await pg.evaluate("undo()"); await pg.wait_for_timeout(100); T = await pg.evaluate("frameStartTimes()")
        check('undo fit', abs(T[1] - 0.75) < 0.03)
        await pg.screenshot(path='chu_dong_beat.png')
        check('beat ticks drawn on the timeline', await pg.evaluate("""(()=>{const cv=S.frames[1].el.querySelector('.wave'); if(!cv||cv.hidden) return false; const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; for(let i=0;i<d.length;i+=4) if(d[i]>240&&d[i+1]>190&&d[i+2]<90) return true; return false})()"""))
        # ---------- save / reload ----------
        await pg.evaluate("S.frames[0].texts=[{id:'tz',str:'HI',x:300,y:300,size:90,style:'comic',an:'drop',lp:'shake',ao:'up'}]; saveProject()"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(1500)
        check('saved ghost + text anim survive reload', await pg.evaluate("!!S.frames[2].ghost && S.frames[2].ghost.n===2 && S.frames[0].texts[0].an==='drop' && S.frames[0].texts[0].ao==='up'"))
        print('ERR', errs); await b.close()
try: asyncio.run(main())
finally: srv.terminate()
