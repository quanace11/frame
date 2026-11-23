import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8947'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🔊 new sound effects: cười gian haha (laugh), còi tàu (horn), tàu chạy (chug) — rendered offline, not silent, chips to attach them
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def chk(name, ok): print(name, ok); ok or errs.append('FAILED ' + name)
        await pg.goto('http://localhost:8947/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for k in ['laugh', 'horn', 'chug']:
            r = await pg.evaluate('''async (k) => { const b = await sfxBuffer(k), d = b.getChannelData(0); let pk = 0, e = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; e += v * v; }
              const q = Math.floor(d.length / 4); let late = 0; for (let i = q * 3; i < d.length; i++) late = Math.max(late, Math.abs(d[i]));
              return { dur: b.duration, want: SFX[k].dur, pk, rms: Math.sqrt(e / d.length), late, finite: d.every(Number.isFinite) }; }''', k)
            chk(k + ' duration', abs(r['dur'] - r['want']) < 0.05); chk(k + ' audible', r['pk'] > 0.1 and r['rms'] > 0.01); chk(k + ' not clipping', r['pk'] <= 1.5); chk(k + ' finite', r['finite'])
        chk('laugh is a run of syllables', await pg.evaluate('''(async () => { const d = (await sfxBuffer('laugh')).getChannelData(0), n = Math.floor(d.length / 80); let on = false, runs = 0;
          for (let w = 0; w < 80; w++) { let m = 0; for (let i = w * n; i < (w + 1) * n; i++) m = Math.max(m, Math.abs(d[i])); const loud = m > 0.05; if (loud && !on) runs++; on = loud; } return runs >= 5; })()'''))
        labels = await pg.evaluate("[...document.querySelectorAll('#fxSfx button')].map(b => b.textContent)")
        chk('chips', all(any(x in l for l in labels) for x in ['Cười gian haha', 'Còi tàu hoả', 'Tàu chạy xình xịch']))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
