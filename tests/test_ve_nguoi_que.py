import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','9886'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
# ✏ Vẽ người que: scribble a stick figure over a cut-out character, each stroke poses the limb it starts from
# (arm / leg from the shoulder / hip, bent stroke = bent elbow, hips → neck = lean, circle = head direction). 1 undo per stroke.
import math
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:9886/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.evaluate("skSet(true)"); await pg.wait_for_timeout(200)
        print('no character: mode stays off', await pg.evaluate("!skMode"))
        await pg.evaluate('kitDialog()'); await pg.wait_for_timeout(300)
        await pg.click('.dlg .btns >> text=Thêm cầu thủ'); await pg.wait_for_timeout(600)
        await pg.evaluate("setTool('puppet'); openTab('pp','pose')"); await pg.wait_for_timeout(200)
        await pg.click('#skBtn'); await pg.wait_for_timeout(200)
        print('mode on', await pg.evaluate("skMode && document.getElementById('skBtn').textContent.includes('Xong')"))
        # world joints of the player (shoulder, elbow, hand of the screen-right arm)
        J = await pg.evaluate("""(()=>{ const f=curFrame(), M=ppMats(ppPoseFor(f)), by=r=>S.pp.parts.find(p=>p.role===r), w=(p,x,y)=>mApply(M[p.id],x,y);
          const aR=by('armR'), fR=by('foreR'), lL=by('legL'), sL=by('shinL'), t=ppTipOf(fR);
          return {sh:w(aR,aR.px,aR.py), el:w(aR,fR.px,fR.py), ha:w(fR,t.x,t.y), hip:w(lL,lL.px,lL.py), kn:w(lL,sL.px,sL.py)} })()""")
        L = math.hypot(J['ha']['x'] - J['sh']['x'], J['ha']['y'] - J['sh']['y'])
        # 1) real pen drag: right arm straight up from the shoulder (drawn through the input pipeline)
        sh = J['sh']; up = [{'x': sh['x'] + 4, 'y': sh['y'] - L * k / 10} for k in range(0, 11)]
        scr = await pg.evaluate("pts => { const r=view.getBoundingClientRect(), c=Math.cos(vr)*vs, s=Math.sin(vr)*vs; return pts.map(q=>[r.left+(c*q.x-s*q.y+vtx)/DPR, r.top+(s*q.x+c*q.y+vty)/DPR]) }", up)
        n0 = await pg.evaluate("undoStack.length")
        await pg.mouse.move(*scr[0]); await pg.mouse.down()
        for x, y in scr[1:]: await pg.mouse.move(x, y, steps=2)
        await pg.mouse.up(); await pg.wait_for_timeout(300)
        ang = await pg.evaluate("(()=>{ const a=ppCurAbs(curFrame(), ppSelChar()); return [a.armR, a.foreR] })()")
        print('arm raised straight up', abs(ang[0] + 90) < 8 and abs(ang[1] + 90) < 8, ang)
        print('1 undo step, frame is a keyframe', await pg.evaluate(f"undoStack.length==={n0}+1 && ppIsKey(curFrame())"))
        # 2) bent stroke from the left hip: thigh forward-out, shin down (a step)
        hip = J['hip']; Ll = math.hypot(J['kn']['x'] - hip['x'], J['kn']['y'] - hip['y'])
        knee = {'x': hip['x'] - Ll * 0.7, 'y': hip['y'] + Ll * 0.7}
        pts = [{'x': hip['x'] + (knee['x'] - hip['x']) * t / 8, 'y': hip['y'] + (knee['y'] - hip['y']) * t / 8} for t in range(9)] + [{'x': knee['x'], 'y': knee['y'] + Ll * t / 8} for t in range(1, 9)]
        await pg.evaluate("pts => skStroke(pts)", pts); await pg.wait_for_timeout(200)
        a = await pg.evaluate("(()=>{ const a=ppCurAbs(curFrame(), ppSelChar()); return [a.legL, a.shinL, a.armR] })()")
        print('bent stroke from the hip bends the knee', abs(a[0] - 135) < 10 and abs(a[1] - 90) < 10, a)
        print('other limbs unchanged', abs(a[2] + 90) < 8)
        # 3) the stroke drawn the other way (foot → hip) works too
        await pg.evaluate("pts => skStroke(pts.slice().reverse())", pts); await pg.wait_for_timeout(200)
        a2 = await pg.evaluate("(()=>{ const a=ppCurAbs(curFrame(), ppSelChar()); return [a.legL, a.shinL] })()")
        print('drawn from the foot up = same pose', abs(a2[0] - 135) < 10 and abs(a2[1] - 90) < 10, a2)
        # 4) lean: hips → neck tilted 20° right; feet keep their screen angle
        legs0 = await pg.evaluate("(()=>{ const a=ppCurAbs(curFrame(), ppSelChar()); return [a.legR, a.shinR] })()")
        tor = await pg.evaluate("(()=>{ const c=skChains(curFrame(), ppSelChar()); return [c.torso.at, c.torso.far] })()")
        h0, n_ = tor; Lt = math.hypot(n_['x'] - h0['x'], n_['y'] - h0['y']); A = math.radians(-90 + 20)
        lean = [{'x': h0['x'] + math.cos(A) * Lt * t / 10, 'y': h0['y'] + math.sin(A) * Lt * t / 10} for t in range(11)]
        await pg.evaluate("pts => skStroke(pts)", lean); await pg.wait_for_timeout(200)
        r = await pg.evaluate("(()=>{ const c=skChains(curFrame(), ppSelChar()); const a=ppCurAbs(curFrame(), ppSelChar()); return [Math.atan2(c.torso.far.y-c.torso.at.y, c.torso.far.x-c.torso.at.x)*180/Math.PI, a.legR, a.shinR] })()")
        print('body leans as drawn', abs(r[0] - (-70)) < 5, r[0])
        print('feet keep their angle when the body leans', abs(r[1] - legs0[0]) < 3 and abs(r[2] - legs0[1]) < 3)
        # 5) circle above-left of the head = head turns that way
        hd = await pg.evaluate("(()=>{ const c=skChains(curFrame(), ppSelChar()); return [c.head.at, c.head.far] })()")
        at, far = hd; R = math.hypot(far['x'] - at['x'], far['y'] - at['y']); A = math.atan2(far['y'] - at['y'], far['x'] - at['x']) - math.radians(25)
        cx, cy = at['x'] + math.cos(A) * R, at['y'] + math.sin(A) * R
        circ = [{'x': cx + math.cos(t / 20 * 2 * math.pi) * R * 0.5, 'y': cy + math.sin(t / 20 * 2 * math.pi) * R * 0.5} for t in range(21)]
        await pg.evaluate("pts => skStroke(pts)", circ); await pg.wait_for_timeout(200)
        hd2 = await pg.evaluate("(()=>{ const c=skChains(curFrame(), ppSelChar()); return [c.head.at, c.head.far] })()")
        a3 = math.degrees(math.atan2(hd2[1]['y'] - hd2[0]['y'], hd2[1]['x'] - hd2[0]['x']))
        print('circle turns the head toward it', abs(a3 - math.degrees(A)) < 6, a3, math.degrees(A))
        # 6) a stroke far from any character does nothing
        nU = await pg.evaluate("undoStack.length")
        await pg.evaluate("skStroke([{x:20,y:20},{x:60,y:40},{x:100,y:60}])")
        print('far stroke ignored', await pg.evaluate(f"undoStack.length==={nU}"))
        await pg.screenshot(path='ve_nguoi_que.png')
        # undo goes back stroke by stroke
        print("stack", await pg.evaluate(f"undoStack.length-{n0}"))
        for _ in range(5): await pg.evaluate("undo()"); await pg.wait_for_timeout(150)
        a4 = await pg.evaluate("(()=>{ const a=ppCurAbs(curFrame(), ppSelChar()); return a.armR })()")
        print('undo back to the start', abs(a4 - ang[0]) > 30, a4)
        await pg.click('#skBtn'); await pg.wait_for_timeout(100)
        print('mode off', await pg.evaluate("!skMode"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
