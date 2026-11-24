import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, json
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9231'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# 👥 Ảnh nhóm (vd. 4 cầu thủ ngồi trên tàu): 🖼 Cả hình làm thân, rồi khoanh riêng từng cánh tay NẰM TRONG vùng thân.
# Khớp vai = chỗ vòng khoanh cắt qua hình (không phải giữa cánh tay), thân không giữ bản sao tay, cẳng tay khoanh sau
# tự gắn vào tay trên, vùng nằm hẳn trên hình (huy hiệu trên áo) vẫn giữ ở cả 2 như mắt/miệng.
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
IMG = os.path.join(OUT, 'anh_nhom.png')
im = Image.new('RGBA', (800, 600), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([100, 350, 700, 550], fill=(200, 30, 40, 255))                     # xe / tàu
d.rectangle([180, 200, 260, 350], fill=(40, 90, 220, 255)); d.ellipse([190, 130, 250, 195], fill=(250, 200, 150, 255))   # người A
d.rectangle([260, 90, 284, 230], fill=(250, 200, 150, 255)); d.ellipse([254, 62, 290, 98], fill=(30, 170, 60, 255))      # tay A giơ lên, nắm đấm xanh lá
d.rectangle([200, 280, 230, 300], fill=(255, 220, 0, 255))                      # huy hiệu trên áo A
d.rectangle([450, 220, 530, 350], fill=(120, 40, 200, 255)); d.ellipse([460, 150, 520, 215], fill=(250, 200, 150, 255))  # người B
d.rectangle([380, 225, 452, 245], fill=(250, 200, 150, 255)); d.rectangle([320, 225, 392, 245], fill=(240, 180, 130, 255)); d.ellipse([296, 222, 326, 248], fill=(0, 160, 200, 255))   # tay B chỉ sang trái
im.save(IMG)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:9231/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        await pg.evaluate("wizImport='hand'")
        await pg.set_input_files('#imgFile', IMG); await pg.wait_for_timeout(500)
        await pg.click('[data-cm=none]'); await pg.wait_for_timeout(600)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(400)
        ok('🖼 Cả hình làm thân shown', await pg.evaluate("!!HC && !$('#hcWhole').hidden"))
        k = await pg.evaluate('Math.min(W*0.9/800, H*0.9/600)'); ox, oy = await pg.evaluate(f'[(W-800*{k})/2, (H-600*{k})/2]')
        D = lambda x, y: (ox + x * k, oy + y * k)
        P = lambda pts: json.dumps([{'x': D(x, y)[0], 'y': D(x, y)[1]} for x, y in pts])
        R = lambda x0, y0, x1, y1: P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
        await pg.click('#hcWhole'); await pg.wait_for_timeout(100)
        ok('whole picture = body, next loops are arms', await pg.evaluate("HC.regs.length===1 && HC.regs[0].role==='torso' && HC.role==='other' && $('#hcWhole').hidden"))
        await pg.evaluate(f'hcAdd({R(245, 55, 305, 216)})')     # tay A (khoanh qua vai một chút)
        await pg.evaluate(f'hcAdd({R(386, 215, 462, 255)})')    # tay trên B
        await pg.evaluate(f'hcAdd({R(292, 212, 398, 258)})')    # cẳng tay B (chồng lên tay trên ở khuỷu)
        await pg.evaluate(f'hcAdd({R(195, 275, 235, 305)})')    # huy hiệu: nằm hẳn trên áo
        ok('arms stay "other" one after another', await pg.evaluate("HC.regs.map(r=>r.role).join()") == 'torso,other,other,other,other', await pg.evaluate("HC.regs.map(r=>r.role).join()"))
        ok('forearm hooked onto its upper arm by itself', await pg.evaluate("hcParentOf(HC.regs[3])===HC.regs[2] && hcParentOf(HC.regs[1])===HC.regs[0] && hcParentOf(HC.regs[2])===HC.regs[0]"))
        J = lambda i: pg.evaluate(f"(()=>{{const j=hcJoint(HC.regs[{i}]); return [(j.x-{ox})/{k}, (j.y-{oy})/{k}]}})()")
        ja, jb, jf = await J(1), await J(2), await J(3)
        ok('arm A turns round its shoulder (where the loop crosses the drawing)', 240 <= ja[0] <= 290 and 200 <= ja[1] <= 222, ja)
        ok('upper arm B turns round its shoulder', 448 <= jb[0] <= 466 and 220 <= jb[1] <= 250, jb)
        ok('forearm B turns round the elbow', 380 <= jf[0] <= 400 and 220 <= jf[1] <= 250, jf)
        ok('arms in the picture sit in front, the badge is a feature', await pg.evaluate("hcEdge(HC.regs[1],HC.regs[0]).within && hcFront(HC.regs[1],HC.regs[0]) && !hcEdge(HC.regs[4],HC.regs[0]).within"))
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null', timeout=8000); await pg.wait_for_timeout(300)
        for _ in range(3):
            if not await pg.evaluate("!!document.querySelector('.ov')"): break
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        parts = await pg.evaluate("S.pp.parts.map(p=>({id:p.id, name:p.name, parent:p.parent}))")
        ok('5 pieces, all hanging from the picture', len(parts) == 5 and sum(1 for q in parts if not q['parent']) == 1, parts)
        al = lambda i, x, y: pg.evaluate(f"(()=>{{const p=S.pp.parts[{i}], X=Math.round({D(x,y)[0]}-p.ox), Y=Math.round({D(x,y)[1]}-p.oy); if(X<0||Y<0||X>=p.c.width||Y>=p.c.height) return -1; return p.c.getContext('2d').getImageData(X,Y,1,1).data[3]}})()")
        ids = await pg.evaluate("S.pp.parts.map(p=>p.id)"); order = await pg.evaluate("(()=>{const r=S.pp.parts.find(p=>!p.parent); return S.pp.parts.indexOf(r)})()")
        # parts are in the order of the loops (root first)
        ok('body keeps no copy of the raised fist', await al(0, 272, 80) <= 0 and await al(1, 272, 80) == 255, [await al(0, 272, 80), await al(1, 272, 80)])
        ok('body keeps no copy of the pointing arm', await al(0, 310, 235) <= 0 and await al(0, 420, 235) <= 0 and await al(3, 310, 235) == 255 and await al(2, 420, 235) == 255,
           [await al(0, 310, 235), await al(0, 420, 235), await al(3, 310, 235), await al(2, 420, 235)])
        ok('body keeps the rest of the picture', await al(0, 220, 250) == 255 and await al(0, 400, 450) == 255 and await al(0, 490, 300) == 255)
        ok('badge kept on the shirt too', await al(0, 215, 290) == 255 and await al(4, 215, 290) == 255)
        # turn arm A by -90° (up → left): the fist leaves its place and shows up left of the shoulder
        await pg.evaluate(f"(()=>{{const f=curFrame(), id='{ids[1]}'; f.pp[id]={{...(f.pp[id]||{{}}), r:-90}}; }})()")
        px = lambda x, y: pg.evaluate(f"(()=>{{const c=makeCanvas(), x=c.getContext('2d'); drawFrameBase(x, curFrame(), bgOf(curFrame())); return [...x.getImageData(Math.round({D(x,y)[0]}),Math.round({D(x,y)[1]}),1,1).data]}})()")
        old, new = await px(272, 80), await px(ja[0] + (80 - ja[1]), ja[1] - (272 - ja[0]))   # (x, y) round the joint by -90°: (dy, -dx)
        ok('turned arm: fist gone from the old place', old[1] > 200 and old[0] > 200, old)
        ok('turned arm: fist round the shoulder on the left', new[1] > 120 and new[0] < 90, new)
        await pg.screenshot(path='cat_anh_nhom.png')
        ok('no page errors', not errs, errs)
        await b.close()
asyncio.run(main())
print('ERR', FAILS)
