import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9141'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🎬 Đẩy mượt = a STRAIGHT zoom: the point zoomed into (a head off-centre) goes straight to the middle of the screen while
# it grows; before, centre and zoom were lerped apart and the head first drifted outwards, then swung back ("lượn").
# Screen position of the target P is measured with camApply's own maths (centre clamped inside the picture).
PATH = '''([px, py, z1, ease])=>{
  S.frames.forEach(f=>f.cam=null); const f=S.frames[0]; f.dur=2000; 
  f.cam={z:z1, x:px, y:py, tr:'smooth', d:1.5, e:ease};
  const out=[]; for(let k=0;k<=30;k++){ const c=camAt(0, k*0.05), z=Math.max(1,c.z), hw=W/(2*z), hh=H/(2*z);
    const cx=clamp(c.x,hw,W-hw), cy=clamp(c.y,hh,H-hh); out.push([(px-cx)*z+W/2, (py-cy)*z+H/2, c.z]); }
  return out; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9141/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        W, H = await pg.evaluate('[W,H]')
        for (px, py, z1, ease) in [(W*0.62, H*0.32, 3, 'inout'), (W*0.4, H*0.6, 4, 'linear'), (W*0.55, H*0.25, 2.5, 'crash')]:
            pts = await pg.evaluate(PATH, [px, py, z1, ease])
            sx, sy = pts[0][0], pts[0][1]; ex, ey = pts[-1][0], pts[-1][1]
            L = ((ex-sx)**2 + (ey-sy)**2) ** 0.5
            # every sample stays on the straight line start → end (small slack for the edge clamp) and never goes back
            off = max(abs((ex-sx)*(y-sy) - (ey-sy)*(x-sx)) / max(L, 1e-6) for x, y, _ in pts)
            prog = [((x-sx)*(ex-sx) + (y-sy)*(ey-sy)) / max(L*L, 1e-6) for x, y, _ in pts]
            back = any(prog[i+1] < prog[i] - 0.01 for i in range(len(prog)-1))
            over = max(prog) > 1.02 or min(prog) < -0.02
            zs = [z for _, _, z in pts]
            print('%s: dời %.0f px, lệch khỏi đường thẳng %.1f px, đi lùi %s, vượt %s, zoom %.2f→%.2f' % (ease, L, off, back, over, zs[0], zs[-1]))
            if off > 0.03 * L + 3: errs.append('%s: target swings off the straight line by %.1f px' % (ease, off))
            if ease != 'crash' and (back or over):   # 'crash' overshoots a little on purpose, then settles
                errs.append('%s: target goes back / overshoots %s' % (ease, [round(v, 2) for v in prog]))
            if abs(ex - W/2) > 2 or abs(ey - H/2) > 2: errs.append('%s: target not centred at the end' % ease)
            if ease != 'crash' and any(zs[i+1] < zs[i] - 1e-6 for i in range(len(zs)-1)): errs.append('%s: zoom not growing' % ease)
        # a pan (same zoom) is still a plain slide, and zoom-out (Kéo ra) ends exactly on its key
        r = await pg.evaluate("(()=>{const f=S.frames[0]; f.cam={z:2,x:W*0.6,y:H*0.5,tr:'smooth',d:1,s:{z:2,x:W*0.4,y:H*0.5},e:'linear'}; const m=camAt(0,0.5); f.cam={z:1,x:W/2,y:H/2,tr:'smooth',d:1,s:{z:3,x:W*0.3,y:H*0.3},e:'linear'}; const e=camAt(0,1); return [m.x/W, m.z, e.z, e.x/W]})()")
        print('pan / kéo ra', r)
        if abs(r[0] - 0.5) > 0.01 or abs(r[1] - 2) > 1e-6 or abs(r[2] - 1) > 1e-6 or abs(r[3] - 0.5) > 1e-6: errs.append('pan / zoom-out wrong %s' % r)
        print('ERR', errs)
        await b.close()
asyncio.run(main())
