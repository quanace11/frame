import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# 🎬 Video → frame keeps the picture sharp: a detailed 1080×1920 clip split into frames is stored close to the source
# (JPEG quality VF.q, high-quality scaling), export bitrate ≥ 16 Mbps, the play cache is as big as the frame on screen
# (not capped at 900 px), and a clip smaller than the frame gets a "will be blurry" note in the dialog
srv = subprocess.Popen(['python3','-m','http.server','8971'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
CLIP = os.path.join(ASSETS, 'clip_sharp.webm')
PSNR_MIN = 47.5   # q 0.86 gave ~45.9 dB, q 0.92 ~48.7
# PSNR + sharpness (Laplacian variance) of frame i's stored Nền picture against the video drawn fresh at the same time
CMP = '''async (i) => {
  const f = S.frames[i], bg = bgOf(f); await ensureLoaded(bg);
  const url = URL.createObjectURL(window.__clip), v = await vfOpenVideo(url); await vfSeek(v, VF.__times[i]);
  const ref = makeCanvas(), rx = ref.getContext('2d', { willReadFrequently: true }); vfDraw(rx, v, 'cover', 0); v.remove(); URL.revokeObjectURL(url);
  const a = rx.getImageData(0, 0, W, H).data, bc = makeCanvas(), bx = bc.getContext('2d', { willReadFrequently: true }); bx.drawImage(bg.canvas, 0, 0);
  const b = bx.getImageData(0, 0, W, H).data;
  let se = 0, n = 0; for (let k = 0; k < a.length; k += 4) { const d = (a[k] - b[k]) * .299 + (a[k + 1] - b[k + 1]) * .587 + (a[k + 2] - b[k + 2]) * .114; se += d * d; n++; }   // luma: the detail the eye calls sharp
  return { psnr: 10 * Math.log10(255 * 255 / (se / n)) }; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        await pg.goto('http://localhost:8971/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        # keep the clip + the frame times so the page can redraw the reference picture
        await pg.evaluate("""(()=>{ const inp=document.getElementById('vidFramesFile'); inp.addEventListener('change', e=>{ if (e.target.files[0]) window.__clip=e.target.files[0]; }, true);
          const t0=vfTimes; vfTimes=(a,b,fps)=>(VF.__times=t0(a,b,fps)); })()""")
        await pg.set_input_files('#vidFramesFile', CLIP)
        await pg.click('.dlg .btns >> text=Theo frame')
        await pg.wait_for_selector('#vfV', timeout=15000)
        await pg.click('[data-vffit="cover"]'); await pg.click('[data-vffps="6"]')
        info = await pg.text_content('#vfInfo'); print('info', info)
        check('full-size clip: no blur warning', '⚠' not in info)
        await pg.click('.dlg .btns >> text=Tách thành frame')
        await pg.wait_for_function("S.frames.length>=5 && !document.querySelector('.ov')", timeout=30000); await pg.wait_for_timeout(400)
        r = await pg.evaluate(CMP, 2); print('quality', r)
        check('stored picture close to the video (luma PSNR ≥ 47.5 dB)', r['psnr'] >= PSNR_MIN)
        check('JPEG quality ≥ 0.92', await pg.evaluate("VF.q >= 0.92"))
        check('export bitrate ≥ 16 Mbps', await pg.evaluate("VX_BITRATE >= 16e6"))
        ph = await pg.evaluate("(()=>{ const v0=vs; vs=v0*0+1600/H; const r=playCacheSize(S.frames.length); vs=v0; return r; })()")
        print('play cache height on a 1600 px tall frame', ph)
        check('play cache as sharp as the screen (not capped at 900 px)', ph >= 1500)
        note = await pg.evaluate("[vfUpNote(1920,1080,'cover'), vfUpNote(1920,1080,'contain'), vfUpNote(1080,1920,'cover')]"); print('notes', note)
        check('landscape on Lấp đầy warns ×1,8 and suggests Vừa khung', '×1,8' in note[0] and 'Vừa khung' in note[0])
        check('landscape on Vừa khung: no warning (fits)', note[1] == '' and note[2] == '')
        await b.close()
        print('ERR', errs)
asyncio.run(main())
