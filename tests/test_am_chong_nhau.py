import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Âm thanh chồng nhau phải phát trộn cùng lúc: ＋ Nhạc lần 2 không thay nhạc cũ, bản trộn (xuất video) có cả 2,
# và khi phát/quay thật mọi đoạn được hẹn giờ trên cùng 1 đồng hồ dù file giải mã chậm (trước đây đoạn giải mã sau bị trễ).
srv = subprocess.Popen(['python3','-m','http.server','9231'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
MIX = '''async (wins) => { const T = frameStartTimes(), tot = T[T.length - 1], b = await vxMixAudio(tot, 22050), d = b.getChannelData(0), sr = b.sampleRate;
  return wins.map(([a, e]) => { let s = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(d.length, Math.floor(e * sr)); i++) { s += d[i] * d[i]; n++; } return n ? Math.sqrt(s / n) : 0; }); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:9231/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        for _ in range(3): await pg.click('#addBtn')
        await pg.evaluate("S.frames.forEach(f=>f.dur=1000); selectFrame(0)"); await pg.wait_for_timeout(200)
        await pg.set_input_files('#musicFile', os.path.join(ASSETS, 'music.wav')); await pg.wait_for_timeout(400)
        one = (await pg.evaluate(MIX, [[0.6, 1.4]]))[0]
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(100)
        await pg.set_input_files('#musicFile', os.path.join(ASSETS, 'music.wav')); await pg.wait_for_timeout(400)
        st = await pg.evaluate("musicClips().map(c=>+clipStart(c,'music').toFixed(3))")
        print('music starts', st)
        check('second music is added (old one kept), starting at the current frame', st == [0, 1])
        both = (await pg.evaluate(MIX, [[1.05, 1.4]]))[0]; solo = (await pg.evaluate(MIX, [[0.6, 0.95]]))[0]
        print('rms solo/both', solo, both, one)
        check('overlap is mixed: louder than one music alone', both > solo * 1.3)
        # voice + sfx on top of the music are mixed too
        await pg.evaluate("selectFrame(1)")
        await pg.set_input_files('#voiceFile', os.path.join(ASSETS, 'voice.wav')); await pg.wait_for_timeout(400)
        three = (await pg.evaluate(MIX, [[1.05, 1.4]]))[0]
        check('voice over 2 musics is mixed in', three > both * 1.1)
        await pg.evaluate("S.audio.sfx=[{id:newId(),frameId:S.frames[1].id,kind:'pop',vol:0.9}]")
        await pg.wait_for_timeout(100)
        # real-time path: decoding is slow and the clock keeps running; every clip must still be on one shared clock
        r = await pg.evaluate('''(async () => {
          const t0 = performance.now(), starts = [];
          const ac = { get currentTime() { return (performance.now() - t0) / 1000; },
            createBufferSource() { return { connect(g) { return g; }, start(w, o, d) { starts.push([w, ac.currentTime]); }, stop() {} }; },
            createGain() { return { gain: {}, connect(x) { return x; } }; },
            decodeAudioData(ab) { return new Promise(res => setTimeout(() => res({ duration: 2 }), 300)); } };
          [...musicClips(), ...voiceClips()].forEach(c => decCache.delete(c.buf));
          await scheduleAudio(ac, {}, 0, 4);
          return starts; })()''')
        print('real-time starts', r)
        rel = [round(x[0] - r[0][0], 2) for x in r]
        check('music 1, music 2, voice, sfx scheduled at their own times on one clock', len(r) == 4 and rel == [0, 1, 1, 1])
        check('no clip is scheduled in the past (it would start late, out of sync)', all(w >= now for w, now in r))
        print('ERR', errs)
        await b.close()
asyncio.run(main())
