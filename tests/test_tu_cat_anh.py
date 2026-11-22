import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8970'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✂ Tự cắt từng phần từ ảnh nhập: khoanh trên ảnh (frame không đổi), ◯ Khớp tròn chia chỗ chồng tại khớp (thân không giữ mẩu tay,
# tay không giữ mẩu thân), Gắn vào mảnh khác, mảnh cứng (không uốn mềm), 🦴 Tạo dáng: kéo tay = xoay quanh khớp, kéo thân = dời cả người,
# Lật mảnh = lật theo trục xương.
FAILS=[]
def ok(name, cond, extra=''):
    print(('OK  ' if cond else 'FAIL'), name, extra)
    if not cond: FAILS.append(name)
IMG = os.path.join(OUT, 'tu_cat_nv.png')
im = Image.new('RGBA', (800, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([220, 250, 380, 550], fill=(230, 140, 20, 255)); d.ellipse([230, 100, 370, 240], fill=(250, 200, 150, 255))
d.rectangle([380, 270, 560, 310], fill=(40, 90, 220, 255)); d.rectangle([560, 270, 720, 310], fill=(40, 180, 80, 255))
im.save(IMG)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8970/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.click('.tool[data-tool=puppet]'); await pg.wait_for_timeout(200)
        await pg.evaluate("wizImport='hand'")   # = nút 🖼 Nhập ảnh để tự cắt (mở chọn file)
        await pg.set_input_files('#imgFile', IMG); await pg.wait_for_timeout(500)
        ok('import opens on ✂ Tự cắt từng phần', await pg.evaluate("document.querySelector('[data-mode=hand]').classList.contains('on')"))
        await pg.click('[data-cm=none]'); await pg.wait_for_timeout(600)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(400)
        ok('cutting the picture, not the frame', await pg.evaluate("!!HC && HC.img && !$('#hcBar').hidden"))
        k = await pg.evaluate('Math.min(W*0.9/800, H*0.9/900)'); ox, oy = await pg.evaluate(f'[(W-800*{k})/2, (H-900*{k})/2]')
        D = lambda x, y: (ox + x * k, oy + y * k)
        def R(x0, y0, x1, y1):
            a, c = D(x0, y0), D(x1, y1); return f'[{{x:{a[0]},y:{a[1]}}},{{x:{c[0]},y:{a[1]}}},{{x:{c[0]},y:{c[1]}}},{{x:{a[0]},y:{c[1]}}}]'
        await pg.evaluate(f'hcAdd({R(200,230,440,570)})')                       # thân (khoanh lấn qua vai tới x=440)
        await pg.evaluate(f'hcAdd({R(220,85,380,265)})')                        # đầu
        await pg.click('[data-hcr=armL]'); await pg.evaluate(f'hcAdd({R(360,255,580,325)})')   # tay trên (lấn vào thân)
        ok('after upper arm comes forearm', await pg.evaluate("HC.role==='foreL'"))
        await pg.evaluate(f'hcAdd({R(545,255,740,325)})')
        ok('last piece selected, hook row shown', await pg.evaluate("HC.sel===HC.regs[3] && !$('#hcSelRow').hidden && $('#hcPar').value==='2'"))
        # tap a piece on the canvas selects it
        pt = await pg.evaluate(f'''(()=>{{const r=view.getBoundingClientRect(), M=viewMat(); const q={{x:{D(300,400)[0]},y:{D(300,400)[1]}}};
          return [r.left+(M[0]*q.x+M[2]*q.y+M[4])/DPR, r.top+(M[1]*q.x+M[3]*q.y+M[5])/DPR]}})()''')
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(200)
        ok('tap selects the body', await pg.evaluate("HC.sel===HC.regs[0] && HC.regs.length===4"), await pg.evaluate("HC.regs.indexOf(HC.sel)"))
        # hook the head onto the body explicitly, put the arm behind the body
        await pg.evaluate("HC.sel=HC.regs[2]; hcSync()"); await pg.click('#hcBack')
        ok('arm set behind', await pg.evaluate("HC.regs[2].front===false"))
        await pg.evaluate("HC.sel=HC.regs[3]; hcSync()"); await pg.select_option('#hcPar', '0')
        ok('forearm hooked onto the body', await pg.evaluate("hcParentOf(HC.regs[3])===HC.regs[0]"))
        await pg.select_option('#hcPar', '2')
        await pg.screenshot(path='tu_cat_anh_1.png')
        await pg.click('#hcDone'); await pg.wait_for_function('HC===null && !document.querySelector(".ov")', timeout=8000); await pg.wait_for_timeout(300)
        parts = await pg.evaluate("S.pp.parts.map(p=>({id:p.id, role:p.role, parent:p.parent, z:p.z, hard:p.hard}))")
        by = {q['role']: q for q in parts}
        ok('4 rigid parts linked', sorted(by) == ['armL','foreL','head','torso'] and all(q['hard'] for q in parts) and by['foreL']['parent'] == by['armL']['id'] and by['armL']['parent'] == by['torso']['id'], parts)
        ok('arm behind the body', by['armL']['z'] < by['torso']['z'], parts)
        ok('frame drawing untouched', await pg.evaluate("(()=>{const d=curFrame().canvas.getContext('2d').getImageData(0,0,W,H).data; for(let i=3;i<d.length;i+=4) if(d[i]) return false; return true})()"))
        al = lambda role, x, y: pg.evaluate(f"(()=>{{const p=S.pp.parts.find(q=>q.role==='{role}'), X=Math.round({D(x,y)[0]}-p.ox), Y=Math.round({D(x,y)[1]}-p.oy); if(X<0||Y<0||X>=p.c.width||Y>=p.c.height) return -1; return p.c.getContext('2d').getImageData(X,Y,1,1).data[3]}})()")
        ok('body keeps no stub of the arm past the joint', await al('torso', 432, 290) == 0, await al('torso', 432, 290))
        ok('arm has its whole shoulder', await al('armL', 432, 290) == 255 and await al('armL', 400, 290) == 255)
        ok('arm leaves the body outside the joint disc', await al('armL', 365, 258) == 0, await al('armL', 365, 258))
        ok('both keep the round joint', await al('torso', 392, 290) == 255 and await al('armL', 392, 290) == 255)
        ok('🦴 Tạo dáng is on', await pg.evaluate("ppDrag==='bone' && document.querySelector('[data-ppd=bone]').classList.contains('on')"))
        # drag the forearm: it turns round the elbow; drag the body: the whole character moves
        sp = lambda x, y: pg.evaluate(f'''(()=>{{const r=view.getBoundingClientRect(), M=viewMat(); const q={{x:{D(x,y)[0]},y:{D(x,y)[1]}}};
          return [r.left+(M[0]*q.x+M[2]*q.y+M[4])/DPR, r.top+(M[1]*q.x+M[3]*q.y+M[5])/DPR]}})()''')
        a, c = await sp(700, 290), await sp(600, 420)
        await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(c[0], c[1], steps=8); await pg.mouse.up(); await pg.wait_for_timeout(200)
        st = await pg.evaluate(f"[(curFrame().pp['{by['foreL']['id']}']||{{}}).r||0, (curFrame().pp['{by['torso']['id']}']||{{}}).dx||0]")
        ok('drag forearm = turn round elbow', st[0] > 30 and st[1] == 0, st)
        a, c = await sp(300, 450), await sp(250, 470)
        await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(c[0], c[1], steps=6); await pg.mouse.up(); await pg.wait_for_timeout(200)
        dx = await pg.evaluate(f"(curFrame().pp['{by['torso']['id']}']||{{}}).dx||0")
        ok('drag body = move whole character', dx < -30, dx)
        # flip the upper arm: mirrored across its own bone, the elbow stays put
        tip = await pg.evaluate(f"""(()=>{{const p=ppPart('{by['armL']['id']}'), f=curFrame(); const M0=ppMats(ppPoseFor(f))[p.id], a=mApply(M0,p.tip.x,p.tip.y);
          ppSel=p.id; $('#ppFlip').click(); const M1=ppMats(ppPoseFor(f))[p.id], b=mApply(M1,p.tip.x,p.tip.y); return [a.x-b.x, a.y-b.y, !!f.pp[p.id].fl]}})()""")
        ok('flip keeps the elbow (mirror on the bone)', abs(tip[0]) < 1 and abs(tip[1]) < 1 and tip[2], tip)
        await pg.screenshot(path='tu_cat_anh_2.png')
        for _ in range(4): await pg.click('#undoBtn'); await pg.wait_for_timeout(500)
        ok('undo back to no character', await pg.evaluate("!S.pp || !S.pp.parts.length"))
        if FAILS: print('FAILS', FAILS)
        print('ERR', errs + [f'FAIL {x}' for x in FAILS]); await b.close()
asyncio.run(main())
