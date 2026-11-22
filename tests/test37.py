import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Voice / music waveform drawn under the frame thumbnails, SFX badge on frames with a sound
srv = subprocess.Popen(['python3','-m','http.server','8834'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8834/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for _ in range(9): await pg.click('#addBtn'); await pg.wait_for_timeout(60)
        print('no audio → no wave', await pg.evaluate("[...document.querySelectorAll('.fr .wave')].every(c=>c.hidden)"))
        await pg.set_input_files('#voiceFile', os.path.join(ASSETS, 'voice.wav')); await pg.wait_for_timeout(1500)
        info = await pg.evaluate("""(()=>{const cs=[...document.querySelectorAll('.fr .wave')]; return cs.map(c=>{ if(c.hidden) return -1; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]>200&&d[i+1]>140&&d[i+2]<80) n++; return n; })})()""")
        print('wave visible', all(x >= 0 for x in info), 'voice drawn on some frames', sum(1 for x in info if x > 20))
        # SFX badge
        await pg.evaluate("selectFrame(3)"); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{S.audio.sfx=S.audio.sfx||[]; S.audio.sfx.push({id:newId(),frameId:curFrame().id,kind:Object.keys(SFX)[0],vol:.9}); fxSyncBar();})()")
        print('sfx badge on frame 4', await pg.evaluate("!!S.frames[3].el.querySelector('.sfxb') && !S.frames[2].el.querySelector('.sfxb')"))
        # changing a frame duration redraws
        k0 = await pg.evaluate("waveKey"); await pg.evaluate("S.frames[0].dur=500; updateFrameUI()"); print('redraw on duration change', await pg.evaluate("waveKey") != k0)
        await pg.screenshot(path='t34_wave.png')
        await pg.evaluate("voiceDel(0)")
        await pg.wait_for_timeout(200)
        print('removed → hidden', await pg.evaluate("[...document.querySelectorAll('.fr .wave')].every(c=>c.hidden)"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
