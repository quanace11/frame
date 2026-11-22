import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# 🪄 AI vẽ đẹp (Gemini MOCKED: no key, no network) + ✨ Vẽ giữa that pairs strokes drawn again on the key frame
# and moves pen (pixel) lines too.
import asyncio, subprocess, time, json, base64, io
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8871'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
# the "AI answer": a clean red ball with a dark outline on white paper, at frame shape (9:16)
im = Image.new('RGB', (540, 960), 'white'); d = ImageDraw.Draw(im)
d.ellipse((170, 380, 370, 580), fill=(220, 40, 40), outline=(20, 20, 20), width=8)
buf = io.BytesIO(); im.save(buf, 'PNG'); IMG = base64.b64encode(buf.getvalue()).decode()
OKBODY = {'candidates': [{'content': {'parts': [{'inlineData': {'mimeType': 'image/png', 'data': IMG}}]}, 'finishReason': 'STOP'}]}
INK = '''(c)=>{ const d=c.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>90) n++; return n; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        reqs = []
        async def handle(route):
            r = route.request; reqs.append({'url': r.url, 'headers': r.headers, 'body': json.loads(r.post_data or '{}')})
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(OKBODY), headers={'Access-Control-Allow-Origin': '*'})
        await pg.route('https://generativelanguage.googleapis.com/**', handle)
        await pg.goto('http://localhost:8871/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ'); await pg.wait_for_timeout(200)
        await pg.evaluate("(()=>{window.inkN=" + INK + "})()")

        # ---- ✨ auto-paired vector strokes: B is drawn again (new ids), one line drawn backwards, the loop starts elsewhere
        await pg.evaluate('''(async()=>{
          const A=curFrame(); const circ=(cx,cy,r,o)=>Array.from({length:33},(_,k)=>{const a=(k/32)*Math.PI*2+o; return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});
          A.vec=[{id:'a1',c:'#111111',w:6,pts:[{x:200,y:300},{x:400,y:300}]}, {id:'a2',c:'#111111',w:6,pts:circ(540,900,100,0)}, {id:'a3',c:'#ff0000',w:6,pts:[{x:300,y:1500},{x:300,y:1700}]}];
          await addFrame(); const B=curFrame();
          B.vec=[{id:'b3',c:'#ff0000',w:6,pts:[{x:400,y:1500},{x:400,y:1700}]}, {id:'b1',c:'#111111',w:6,pts:[{x:600,y:400},{x:400,y:400}]}, {id:'b2',c:'#111111',w:6,pts:circ(640,900,100,Math.PI*0.75)}];
          markEdited(B); await selectFrame(0); })()''')
        pr = await pg.evaluate("(()=>{const P=ibPairs(S.frames[0].vec,S.frames[1].vec); return {n:P.pairs.length, auto:P.auto, map:P.pairs.map(p=>p.sa.id+'>'+p.sb.id).sort(), only:P.onlyA.length+P.onlyB.length}})()")
        print('auto pairs', pr, pr['map'] == ['a1>b1', 'a2>b2', 'a3>b3'] and pr['only'] == 0)
        n = await pg.evaluate("inbetween(1,'linear')"); await pg.wait_for_timeout(200)
        mid = await pg.evaluate("S.frames[1].vec.map(s=>({id:s.id,p0:s.pts[0],p1:s.pts.at(-1),cx:s.pts.reduce((a,q)=>a+q.x,0)/s.pts.length,r:Math.max(...s.pts.map(q=>Math.hypot(q.x-590,q.y-900))),rmin:Math.min(...s.pts.map(q=>Math.hypot(q.x-590,q.y-900)))}))")
        line = next(s for s in mid if s['id'] == 'a1'); loop = next(s for s in mid if s['id'] == 'a2'); red = next(s for s in mid if s['id'] == 'a3')
        print('1 frame added', n == 1, await pg.evaluate('S.frames.length') == 3)
        print('reversed line lands halfway, not crossed', abs(line['p0']['x'] - 300) < 3 and abs(line['p0']['y'] - 350) < 3 and abs(line['p1']['x'] - 500) < 3)
        print('loop stays round while it moves', abs(loop['r'] - 100) < 6 and abs(loop['rmin'] - 100) < 6, round(loop['r'], 1), round(loop['rmin'], 1))
        print('red line halfway', abs(red['cx'] - 350) < 2)
        await pg.evaluate('undo()'); print('one undo removes it', await pg.evaluate('S.frames.length') == 2)

        # ---- ✏️ pen lines move too: a vertical pen line at x=300 → x=500, the in-between is drawn at x≈400 as pixels
        await pg.evaluate('''(async()=>{ for(const i of [0,1]){ const f=S.frames[i]; await ensureLoaded(f); f.vec=[]; const x=f.canvas.getContext('2d'); x.clearRect(0,0,W,H);
          x.strokeStyle='#111'; x.lineWidth=8; x.lineCap='round'; x.beginPath(); const X=i?500:300; x.moveTo(X,600); x.lineTo(X+40,1100); x.stroke(); markEdited(f);} await selectFrame(0); })()''')
        await pg.evaluate('inbetweenDialog(), 0'); await pg.wait_for_timeout(500)
        print('pen option offered + on (no vector strokes)', await pg.evaluate("!!document.querySelector('#ibPix') && document.querySelector('#ibPix').checked"))
        await pg.fill('#ibN', '1'); await pg.click('.dlg .btns >> text=Tạo frame giữa'); await pg.wait_for_function('S.frames.length===3', timeout=20000); await pg.wait_for_timeout(300)
        col = await pg.evaluate('''(async()=>{const f=S.frames[1]; await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(0,850,W,1).data; const xs=[]; for(let x=0;x<W;x++) if(d[x*4+3]>90) xs.push(x); return xs;})()''')
        print('in-between pen line at the middle', bool(col) and 380 < sum(col)/len(col) < 440 and min(col) > 340, col[:1], col[-1:])
        print('in-between stays a pen drawing (no vector)', await pg.evaluate('S.frames[1].vec.length') == 0)
        await pg.evaluate('undo()'); await pg.wait_for_timeout(100)

        # ---- 🪄 AI vẽ đẹp: no key → message, no request
        await pg.click('#aiFxBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path='ai_fx_dialog.png')
        await pg.click('#axGo'); print('no key msg', 'Chưa có key' in await pg.inner_text('#axErr'), len(reqs) == 0)
        await pg.click('.dlg .btns >> text=Đóng'); await pg.wait_for_timeout(200)
        await pg.evaluate("localStorage.setItem('fs-gemini-key','TEST-KEY-xyz')")
        # empty frame → message
        await pg.evaluate("(async()=>{await addFrame();})()"); await pg.wait_for_timeout(200)
        await pg.click('#aiFxBtn'); await pg.wait_for_timeout(300); await pg.click('#axGo'); await pg.wait_for_timeout(200)
        print('empty frame msg', 'Frame còn trống' in await pg.inner_text('#axErr'), len(reqs) == 0)
        await pg.click('.dlg .btns >> text=Đóng'); await pg.wait_for_timeout(200)
        await pg.evaluate("undo()"); await pg.evaluate("selectFrame(0)"); await pg.wait_for_timeout(200)
        # ✨ clean the sketch on frame 1
        sketch = await pg.evaluate("inkN(S.frames[0].canvas)")
        await pg.click('#aiFxBtn'); await pg.wait_for_timeout(300)
        await pg.click('#axGo'); await pg.wait_for_function("document.getElementById('axBusy').hidden && !document.getElementById('axPut').disabled", timeout=20000)
        rq = reqs[-1]; parts = rq['body']['contents'][0]['parts']; imgs = [x for x in parts if 'inline_data' in x]
        print('key only in header', rq['headers'].get('x-goog-api-key') == 'TEST-KEY-xyz' and 'TEST-KEY' not in rq['url'])
        print('sketch + style sent, frame shape', len(imgs) == 2 and rq['body']['generationConfig']['imageConfig']['aspectRatio'] == '9:16', 'rough sketch' in parts[-1]['text'] and 'logos' in parts[-1]['text'])
        await pg.click('#axPut'); await pg.wait_for_timeout(300)
        fl = await pg.evaluate("floating ? {cc:!!floating.cc, s:floating.scale, w:floating.c.width} : null")
        print('floating picture over the whole frame', bool(fl) and fl['cc'] and abs(fl['s'] * fl['w'] - 1080) < 4, fl)
        print('old sketch hidden under it', await pg.evaluate("inkN(S.frames[0].canvas)") == 0)
        await pg.screenshot(path='ai_fx_placed.png')
        await pg.evaluate("commitFloating()"); await pg.wait_for_timeout(200)
        res = await pg.evaluate('''(()=>{const f=S.frames[0], c=f.col.getContext('2d').getImageData(540,960,1,1).data, l=f.canvas.getContext('2d').getImageData(540,960,1,1).data, e=f.canvas.getContext('2d').getImageData(540,960-200,1,1).data;
          return {colRed:c[0]>180&&c[1]<90&&c[3]>200, lineEmptyInside:l[3]<40, lines:inkN(f.canvas), paper:f.canvas.getContext('2d').getImageData(60,60,1,1).data[3]+f.col.getContext('2d').getImageData(60,60,1,1).data[3]}})()''')
        print('lines → Nhân vật, red → Màu, paper left out', res['colRed'] and res['lineEmptyInside'] and res['lines'] > 1000 and res['paper'] == 0, res)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('one undo brings the sketch back', await pg.evaluate("inkN(S.frames[0].canvas)") == sketch)

        # ---- 🎨 colour only: lines stay, colour goes to Màu
        await pg.click('#aiFxBtn'); await pg.wait_for_timeout(300); await pg.click('[data-ax=color]'); await pg.wait_for_timeout(200)
        print('replace option hidden for colour', await pg.evaluate("document.getElementById('axRepRow').hidden"))
        await pg.click('#axGo'); await pg.wait_for_function("document.getElementById('axBusy').hidden && !document.getElementById('axPut').disabled", timeout=20000)
        await pg.click('#axPut'); await pg.wait_for_timeout(300); await pg.evaluate("commitFloating()"); await pg.wait_for_timeout(200)
        print('colour only: pen lines unchanged, red in Màu', await pg.evaluate("inkN(S.frames[0].canvas)") == sketch and await pg.evaluate("S.frames[0].col.getContext('2d').getImageData(540,960,1,1).data[0]>180"))
        await pg.evaluate("undo()"); await pg.wait_for_timeout(200)

        # ---- 🎞 AI in-between: both key frames sent, a new frame goes between them
        await pg.click('#aiFxBtn'); await pg.wait_for_timeout(300); await pg.click('[data-ax=ib]'); await pg.wait_for_timeout(300)
        print('two key frames shown', await pg.evaluate("!document.getElementById('axSrcB').hidden"))
        await pg.click('#axGo'); await pg.wait_for_function("document.getElementById('axBusy').hidden && !document.getElementById('axPut').disabled", timeout=20000)
        parts = reqs[-1]['body']['contents'][0]['parts']
        print('both key frames sent', len([x for x in parts if 'inline_data' in x]) == 2 and 'in-between' in parts[-1]['text'])
        await pg.click('#axPut'); await pg.wait_for_timeout(500)
        print('new frame 2 between them', await pg.evaluate("S.frames.length===3 && S.cur===1 && !!floating"))
        await pg.evaluate("commitFloating()"); await pg.wait_for_timeout(200)
        print('in-between has the AI picture', await pg.evaluate("inkN(S.frames[1].canvas)") > 1000)
        await pg.evaluate("undo()"); await pg.evaluate("undo()"); await pg.wait_for_timeout(200)
        print('undo twice removes it', await pg.evaluate("S.frames.length") == 2)
        print('menu has the button', await pg.evaluate("!!document.getElementById('aiFxBtn')"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
