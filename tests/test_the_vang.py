import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8961'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 🟨 Trọng tài (tay giơ thẻ vàng/đỏ, hiệu ứng động + còi), ✋ Tay → Thẻ vàng/Thẻ đỏ, 😵 Ngã ngất, 🛣 Đường pit
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8961/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        # the pit-lane background: drawn, not blank, mostly track colour in the middle band
        await pg.evaluate("sceneDialog()"); await pg.wait_for_timeout(200); await pg.click('[data-scene="pitlane"]'); await pg.wait_for_timeout(300)
        r = await pg.evaluate("""(()=>{ const c=makeCanvas(270,480), x=c.getContext('2d'); drawScene(x,'pitlane',270,480); const d=x.getImageData(0,0,270,480).data;
          let red=0, n=0; for(let y=200;y<360;y+=4) for(let xx=0;xx<150;xx+=4){ const i=(y*270+xx)*4; n++; if(d[i]>150&&d[i+1]<110&&d[i+2]<90) red++; } return red/n })()""")
        print('track share', r)
        if r < 0.5: errs.append('pit lane: track missing %s' % r)
        # the referee card: every frame of both items draws something, the hand rises (frame 0 empty-ish at the top, last frame has the card up)
        r = await pg.evaluate("""(()=>{ const out={}; for(const k of ['yellow','red']){ const L=[]; for(let t=0;t<assetAnimN('ref',k);t++){ const c=assetRender('ref',k,0.5,{...assetOpt,t}); const d=c.getContext('2d').getImageData(0,0,c.width,c.height/2).data; let a=0; for(let i=3;i<d.length;i+=4) if(d[i]>20) a++; L.push(a); } out[k]=L; }
          out.sfx=ASSET_CATS.ref.items.yellow[2].sfx; out.hand=['cardY','cardR'].every(k=>!!ASSET_CATS.hand.items[k]); return out })()""")
        print('card', r)
        if r['yellow'][0] > r['yellow'][-1] * 0.2 or r['yellow'][-1] < 500: errs.append('card does not rise %s' % r['yellow'])
        if r['sfx'] != 'whistle' or not r['hand']: errs.append('card sfx/hand items %s' % r)
        # stamp it on the frame: 10 frames, a whistle, one undo step
        await pg.evaluate("assetToFrame('ref','yellow')"); await pg.wait_for_timeout(200)
        await pg.evaluate("(async()=>{ await commitFloating(); })()"); await pg.wait_for_timeout(800)
        r = await pg.evaluate("[S.frames.length, (S.audio.sfx||[]).map(s=>s.kind)]"); print('stamped', r)
        if r[0] != 10 or 'whistle' not in r[1]: errs.append('stamp %s' % r)
        await pg.evaluate("selectFrame(9)"); await pg.wait_for_timeout(300); await pg.screenshot(path='the_vang.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(400)
        r = await pg.evaluate("S.frames.length"); print('after undo', r)
        if r != 1: errs.append('undo stamp %s' % r)
        # 😵 faint on the sample footballer: ends lying down (torso turned ~88°), body lower, frames added, a bonk
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        r = await pg.evaluate("""(async()=>{ const tor=S.pp.parts.find(q=>q.role==='torso'), head=S.pp.parts.find(q=>q.role==='head');
          const box=f=>{ const M=ppMats(ppPoseFor(f)); const h=mApply(M[head.id], head.px, head.py-40), t=mApply(M[tor.id], tor.px, tor.py); return [h.x,h.y,t.x,t.y]; };
          const n0=S.frames.length, b0=box(curFrame()); await ppGesture('faint'); const L=S.frames.at(-1), q=L.pp[tor.id]||{};
          return {added:S.frames.length-n0, r:q.r||0, b0, b1:box(L), sfx:(S.audio.sfx||[]).map(s=>s.kind)} })()""")
        print('faint', r)
        rot = abs(r['r'] * 57.3) if abs(r['r']) < 7 else abs(r['r'])
        if r['added'] < 10: errs.append('faint frames %s' % r)
        if not (70 < rot < 110): errs.append('faint not lying %s' % rot)
        if not (r['b1'][1] > r['b0'][1] + 100): errs.append('head did not go down %s' % r)
        if 'bonk' not in r['sfx']: errs.append('faint sfx %s' % r['sfx'])
        await pg.evaluate("selectFrame(S.frames.length-1)"); await pg.wait_for_timeout(300); await pg.screenshot(path='nga_ngat.png')
        await b.close()
        print('ERR', errs)
asyncio.run(main())
