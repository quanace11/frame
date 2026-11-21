import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, math, json
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8877'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# 🛷 Knee slide from a kneeling drawing with both hands on the head:
#  - joints: hands found at the head (forearms reach back up), elbows out, shoulders on the torso, hips low (kneeling)
#  - one tap: the character rushes in, slows down, stops where it stands, dust behind, leans back, camera pushes in, SFX; one undo step
def limb(d, a, b, w, fill, ol=7):
    ax, ay = a; bx, by = b; L = math.hypot(bx-ax, by-ay); nx, ny = -(by-ay)/L*w/2, (bx-ax)/L*w/2
    d.polygon([(ax+nx, ay+ny), (bx+nx, by+ny), (bx-nx, by-ny), (ax-nx, ay-ny)], fill=fill, outline='#3a2418', width=ol)
    for p in (a, b): d.ellipse([p[0]-w/2, p[1]-w/2, p[0]+w/2, p[1]+w/2], fill=fill, outline='#3a2418', width=ol)
def kneeling(path):   # original test drawing: kneeling, elbows out, hands on the sides of the head
    im = Image.new('RGB', (900, 1200), 'white'); d = ImageDraw.Draw(im)
    SK, SH, PA, SO = '#f0b48c', '#bfe4dc', '#2f7a7e', '#e6f2f2'
    limb(d, (640, 1095), (470, 1100), 70, SO); limb(d, (540, 900), (650, 1090), 110, SK)
    limb(d, (390, 1095), (160, 1100), 70, SO); d.ellipse([90, 1065, 190, 1135], fill=PA, outline='#3a2418', width=7)
    limb(d, (390, 900), (395, 1090), 110, SK)
    d.polygon([(330, 780), (580, 780), (620, 960), (500, 960), (450, 880), (420, 960), (320, 960)], fill=PA, outline='#3a2418', width=7)
    d.polygon([(340, 470), (560, 470), (575, 800), (330, 800)], fill=SH, outline='#3a2418', width=7)
    d.rectangle([415, 410, 485, 480], fill=SK, outline='#3a2418', width=7)
    for s in (-1, 1):
        sh, el, ha = (450 + s*100, 500), (450 + s*290, 540), (450 + s*150, 290)
        limb(d, el, ha, 62, SH); limb(d, sh, el, 70, SH)
    d.ellipse([320, 160, 580, 440], fill=SK, outline='#3a2418', width=7)
    d.chord([320, 140, 580, 330], 180, 360, fill='#5a3a26', outline='#3a2418', width=7)
    for s in (-1, 1): d.ellipse([450 + s*150 - 45, 245, 450 + s*150 + 45, 335], fill=SK, outline='#3a2418', width=7)
    for s in (-1, 1): d.ellipse([450 + s*50 - 14, 280, 450 + s*50 + 14, 308], fill='#2a1a10')
    d.arc([400, 330, 500, 400], 10, 170, fill='#3a2418', width=7)
    im.save(path)
async def main():
    kneeling(os.path.join(OUT, 'kneeling.png'))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8877/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(OUT, 'kneeling.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(800)
        J = await pg.evaluate("JSON.parse(JSON.stringify(ppSetup.J))")
        hgt = max(J['ftL']['y'], J['ftR']['y']) - J['head']['y']
        print('step 1 tells where the path / slide buttons are', await pg.evaluate("[...document.querySelectorAll('span')].some(e=>e.textContent.includes('Bước 1 — Đặt khớp')&&e.textContent.includes('Trượt gối')&&e.offsetParent)"))
        print('hands up at the head', all(J['ha'+s]['y'] < J['el'+s]['y'] - 0.08*hgt and J['ha'+s]['y'] < J['neck']['y'] for s in 'LR'), {k: J[k] for k in ('haL','haR','neck')})
        print('elbows out beside the shoulders', J['elL']['x'] < J['shL']['x'] - 0.1*hgt and J['elR']['x'] > J['shR']['x'] + 0.1*hgt)
        print('shoulders on the torso', abs(J['shL']['y'] - J['shR']['y']) < 0.05*hgt and J['shR']['x'] - J['shL']['x'] < 0.35*hgt)
        print('neck under the head, above the shoulders', J['head']['y'] + 0.15*hgt < J['neck']['y'] < J['shL']['y'])
        print('kneeling: hips low', J['hpL']['y'] > J['head']['y'] + 0.6*hgt, J['hpL']['y'], J['head']['y'], hgt)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const id=ppSelChar(),q=ppQ(S.frames[0],id);q.sx=q.sy=0.6;q.dy=200;requestRender()})()")
        await pg.evaluate("openTab('pp','frames')"); await pg.wait_for_timeout(200)
        await pg.fill('#slideN', '20'); await pg.click('[data-slide="1"]')
        await pg.wait_for_function('S.frames.length === 30', timeout=20000); await pg.wait_for_timeout(500)
        print('20 slide frames + 10 hold frames', await pg.evaluate("S.frames.length") == 30)
        root = await pg.evaluate("ppSelChar()")
        mv = await pg.evaluate(f"S.frames.map(f=>f.lip&&f.lip.mv&&f.lip.mv['{root}'])")
        xs = [m['x'] for m in mv]
        print('rushes in from the left', xs[0] < -500)
        print('stops where it stood', all(abs(x) < 0.5 for x in xs[19:]))
        steps = [xs[k+1] - xs[k] for k in range(19)]
        print('slows down (ease out)', all(s > 0 for s in steps) and steps[0] > steps[-1] * 4)
        tor = await pg.evaluate("S.pp.parts.find(p=>p.role==='torso').id")
        rs = await pg.evaluate(f"S.frames.map(f=>(f.pp['{tor}']||{{}}).r||0)")
        print('leans back at the end', abs(rs[0]) < 0.1 and abs(rs[29] + 12) < 0.1 and abs(rs[19] + 12) < 0.1)
        dust = await pg.evaluate("(async()=>{const o=[];for(const i of [0,10,16]){const f=S.frames[i];await ensureLoaded(f);const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data;let c=0;for(let k=3;k<d.length;k+=16)if(d[k]>0)c++;o.push(c)}return o})()")
        print('dust behind the slide', dust[1] > 200 and dust[2] > 200, dust)
        cam = await pg.evaluate("S.frames.map((f,i)=>f.cam?[i,f.cam.tr,f.cam.z]:null).filter(Boolean)")
        print('camera pushes in near the stop', len(cam) == 1 and cam[0][0] == 17 and cam[0][1] == 'smooth' and cam[0][2] > 1.3, cam)
        print('slide + crowd sounds', await pg.evaluate("JSON.stringify(S.audio.sfx.map(s=>s.kind))") == '["slide","crowd"]')
        await pg.evaluate("S.cur=12; updateFrameUI(); requestRender()"); await pg.wait_for_timeout(300); await pg.screenshot(path='truot_goi.png')
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('one undo removes it all', await pg.evaluate("S.frames.length===1 && !(S.frames[0].lip&&S.frames[0].lip.mv) && !(S.audio.sfx||[]).length && !S.frames[0].cam"))
        await pg.evaluate("redo()"); await pg.wait_for_timeout(500)
        print('redo', await pg.evaluate("S.frames.length===30 && S.audio.sfx.length===2"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
