import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# Quick subtitles: paste lines → caption texts timed to the voice (voice.wav = 4 bursts) or spread evenly
srv = subprocess.Popen(['python3','-m','http.server','8837'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
SUBS = "S.frames.map(f=>{const t=(f.texts||[]).find(x=>x.sub); return t? t.str : '-'})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')))")
        await pg.goto('http://localhost:8837/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        await pg.evaluate("(async()=>{ for(let i=0;i<17;i++){ await addFrame(); } S.frames.forEach(f=>f.dur=100); buildStrip(); await selectFrame(0); })()"); await pg.wait_for_timeout(500)
        await pg.evaluate("setTool('fx')"); await pg.wait_for_timeout(200)
        # even split without voice
        await pg.evaluate("quickSubtitles(); 0"); await pg.wait_for_timeout(300)
        await pg.fill('#qsIn', 'Một\nHai\nBa'); await pg.click('.dlg .btns >> text=Tạo phụ đề'); await pg.wait_for_timeout(300)
        ev = await pg.evaluate(SUBS); print('even', ''.join(x[0] for x in ev))
        # with voice
        await pg.set_input_files('#voiceFile', os.path.join(ASSETS, 'voice.wav')); await pg.wait_for_timeout(800)
        await pg.evaluate("quickSubtitles(); 0"); await pg.wait_for_timeout(300)
        await pg.fill('#qsIn', 'Câu một\nCâu hai\nCâu ba\nCâu tư'); await pg.click('.dlg .btns >> text=Theo giọng'); await pg.wait_for_timeout(1000)
        sv = await pg.evaluate(SUBS); print('voice', [x[-3:] if x!='-' else '-' for x in sv])
        print('bursts', [sv[i][-3:] for i in (1, 6, 11, 15)], 'old even subs replaced', all('Câu' in x or x=='-' for x in sv))
        await pg.evaluate("selectFrame(6)"); await pg.wait_for_timeout(200); await pg.screenshot(path='t37_sub.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('undo restores even subs', ''.join(x[0] for x in await pg.evaluate(SUBS)) == ''.join(x[0] for x in ev))
        # long line wraps
        print('wrap', await pg.evaluate("wrapSub('Hôm nay mình sẽ kể cho các bạn nghe một câu chuyện rất là dài và vui', 62).split('\\n').length") >= 2)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
