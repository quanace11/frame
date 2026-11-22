import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, base64
from playwright.async_api import async_playwright
# Làm nhanh / Nhân vật ghép: chia vùng tự động (tay áp sát thân, tay giơ lên), bước tô sửa vùng, cắt lại giữ tư thế
srv = subprocess.Popen(['python3','-m','http.server','8802'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
PEN='''async ([pts])=>{const v=document.getElementById('view');const r=v.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:r.left+x,clientY:r.top+y,pressure:0.6,buttons:1,button:0,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1]));
  for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}'''
D2S='''([x,y])=>[(x*vs+vtx)/DPR,(y*vs+vty)/DPR]'''
# share of opaque pixels inside a doc-space box that carry region value v (hand-painted or automatic)
FRAC='''([x0,y0,x1,y1,v])=>{const st=ppSetup;let n=0,k=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*W+x;if(!st.bin[i])continue;n++;const e=st.hand&&st.hand[i]>=0?st.hand[i]:st.auto[i];if(ppRoleMap(e,st.split)===v)k++;}return n?k/n:0}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8802/index.html'); await pg.wait_for_timeout(800)
        await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile',os.path.join(ASSETS,'limbs.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.click('[data-cm=color]'); await pg.wait_for_timeout(1200)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(500)
        J = await pg.evaluate('ppSetup.J')
        # arm drawn against the body (viewer-left) is found from its outline; the raised arm (viewer-right) from its tip
        print('arm L x', round(J['shL']['x']), round(J['elL']['x']), round(J['haL']['x']), 'hand y', round(J['haL']['y']))
        print('arm R hand', round(J['haR']['x']), round(J['haR']['y']), 'head x', round(J['head']['x']))
        print('raised arm R found above the shoulder', J['haR']['y'] < J['shR']['y'], 'head on the centre line', abs(J['head']['x'] - J['root']['x']) < 30)
        await pg.click('#ppCutAuto'); await pg.wait_for_selector('#ppLabSec:not([hidden])')
        print('stage', await pg.evaluate('ppSetup.stage'), 'chips', await pg.locator('#ppLabParts [data-plp]').count())
        # sleeve of the left arm: doc x 330..400, y 780..1080 -> should mostly be armL (6)
        print('sleeve armL', round(await pg.evaluate(FRAC,[340,800,395,1060,6]),2), 'torso body', round(await pg.evaluate(FRAC,[480,800,640,1100,0]),2), 'raised forearm armR', round(await pg.evaluate(FRAC,[830,560,870,700,8]),2))
        await pg.screenshot(path='lab_stage.png')
        # 1) bucket: tap the torso fill with "Đầu" selected -> whole torso patch becomes head; then undo
        await pg.click('[data-plp="1"]'); await pg.click('[data-plt=bucket]')
        s = await pg.evaluate(D2S,[560,900]); await pg.evaluate(PEN,[[s,s]]); await pg.wait_for_timeout(200)
        print('bucket torso->head', round(await pg.evaluate(FRAC,[480,800,640,1100,1]),2))
        await pg.click('#ppLabUndo'); await pg.wait_for_timeout(100)
        print('after undo head share', round(await pg.evaluate(FRAC,[480,800,640,1100,1]),2))
        # 2) brush: paint the top of the left sleeve as Tay trái (shoulder cap)
        await pg.click('[data-plp="6"]'); await pg.click('[data-plt=brush]')
        pts=[await pg.evaluate(D2S,[x,690]) for x in range(340,400,6)]; await pg.evaluate(PEN,[pts]); await pg.wait_for_timeout(200)
        print('brush cap armL', round(await pg.evaluate(FRAC,[345,680,395,700,6]),2))
        # 3) lasso: mark a box of the leg as "Bỏ đi" then put it back with undo
        await pg.click('[data-plp="10"]'); await pg.click('[data-plt=lasso]')
        ring=[await pg.evaluate(D2S,q) for q in [[420,1300],[540,1300],[540,1400],[420,1400],[420,1300]]]; await pg.evaluate(PEN,[ring]); await pg.wait_for_timeout(200)
        print('lasso none', round(await pg.evaluate(FRAC,[440,1310,520,1390,10]),2))
        await pg.evaluate('undo()'); await pg.wait_for_timeout(100)   # two-finger tap path also lands here
        print('global undo -> none share', round(await pg.evaluate(FRAC,[440,1310,520,1390,10]),2))
        # back to joints keeps the painting; cut
        await pg.click('#ppLabBack'); print('joint stage', await pg.evaluate("ppSetup.stage"), 'kept', await pg.evaluate('ppSetup.hand.some(v=>v===6)'))
        await pg.click('#ppCutAuto'); await pg.wait_for_selector('#ppLabSec:not([hidden])')
        await pg.click('#ppLabCut'); await pg.wait_for_function('!ppSetup', timeout=60000)
        parts = await pg.evaluate("S.pp.parts.map(p=>p.role)")
        print('parts', len(parts), sorted(parts))
        arm = await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='armL');return [Math.round(p.px),Math.round(p.py),p.c.width,p.c.height]})()")
        print('armL pivot/size', arm)
        # pose a frame, then reopen the regions and cut again: pose must survive
        await pg.evaluate("()=>{ppSel=S.pp.parts.find(x=>x.role==='armR').id; ppSyncBar(); const r=document.getElementById('ppRot'); r.value=40; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));}")
        print('recut enabled', await pg.evaluate("!document.getElementById('ppRecut').disabled"))
        await pg.evaluate("openTab('pp','parts')"); await pg.click('#ppRecut'); await pg.wait_for_selector('#ppLabSec:not([hidden])')
        print('recut keeps painting', await pg.evaluate('ppSetup.hand.some(v=>v===6)'))
        await pg.click('[data-plp="9"]') if await pg.locator('[data-plp="9"]').count() else None
        await pg.click('#ppLabSplit'); await pg.wait_for_timeout(100)
        print('split chips', await pg.locator('#ppLabParts [data-plp]').count())
        await pg.click('#ppLabCut'); await pg.wait_for_function('!ppSetup', timeout=60000)
        print('after recut parts', await pg.evaluate("S.pp.parts.length"), 'modal', await pg.locator('.dlg').count())
        print('pose kept', await pg.evaluate("(()=>{const p=S.pp.parts.find(x=>x.role==='armR');const q=curFrame().pp[p.id];return q&&q.r})()"))
        u = await pg.evaluate("(()=>{const c=makeCanvas(),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);drawPuppet(x,curFrame().pp);return c.toDataURL()})()")
        open('lab_after.png','wb').write(base64.b64decode(u.split(',')[1]))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
