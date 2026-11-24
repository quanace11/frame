import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# 📮 Hộp thư + 📤 file nhân vật + 📱 chế độ gọn. Tablet và máy tính = 2 trình duyệt, GitHub GIẢ (refs, contents, blobs, ETag/304).
# Tablet cắt nhân vật (cầu thủ mẫu), tạo dáng, 📤 gửi vào Hộp thư → máy tính thấy thông báo, nhận Thành layer (giữ dáng, hiện mọi
# frame) / Thành ảnh vào frame 2; file nhân vật nhập thẳng vào Kho; file bị nén mất dữ liệu → nhập như ảnh; máy tính gửi ảnh sang
# tablet; Hộp thư không đụng nhánh main (☁ đồng bộ dự án không chạy lại); kiểm tra hộp thư bằng 304; chế độ gọn ẩn/hiện đúng.
import asyncio, subprocess, time, json, base64, hashlib, re
from urllib.parse import unquote
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '9193'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)
time.sleep(1)
TOK = 'github_pat_TEST_not_real_77'

class Box:
    def __init__(s): s.refs = {'main': 'c0main'}; s.files = {}; s.blobs = {}; s.ver = 0; s.n304 = 0; s.lists = 0; s.puts = 0
B = Box()
def nf(): return len([k for k in B.files if k != '.keep'])
def gsha(b): return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
def handle(method, url, body, headers):
    if headers.get('authorization') != 'Bearer ' + TOK: return 401, {'message': 'Bad credentials'}, {}
    m = re.match(r'https://api\.github\.com/repos/me/frame-data([^?]*)(?:\?(.*))?$', url)
    if not m: return 404, {'message': 'Not Found'}, {}
    p, qs = unquote(m.group(1)), m.group(2) or ''
    if p.startswith('/git/ref/heads/') and method == 'GET':
        br = p.split('/')[-1]
        return (200, {'object': {'sha': B.refs[br]}}, {}) if br in B.refs else (404, {'message': 'Not Found'}, {})
    if p == '/git/refs' and method == 'POST':
        br = body['ref'].split('/')[-1]
        if br in B.refs: return 422, {'message': 'Reference already exists'}, {}
        B.refs[br] = body['sha']; return 201, {}, {}
    if p.startswith('/contents/hop-thu/') and method == 'PUT':
        if body.get('branch') != 'hop-thu' or 'hop-thu' not in B.refs: return 404, {'message': 'branch'}, {}
        data = base64.b64decode(body['content']); h = gsha(data); B.blobs[h] = data
        name = p.split('/')[-1]; B.files[name] = h; B.ver += 1; B.puts += 1; B.refs['hop-thu'] = 'c%d' % B.ver
        return 201, {'content': {'sha': h}, 'commit': {'sha': B.refs['hop-thu']}}, {}
    if p == '/contents/hop-thu' and method == 'GET':
        B.lists += 1
        if 'ref=hop-thu' not in qs or 'hop-thu' not in B.refs or not B.files: return 404, {'message': 'Not Found'}, {'ETag': '"e%d"' % B.ver}
        et = '"e%d"' % B.ver
        if headers.get('if-none-match') == et: B.n304 += 1; return 304, None, {'ETag': et}
        return 200, [{'type': 'file', 'name': n, 'path': 'hop-thu/' + n, 'sha': h, 'size': len(B.blobs[h])} for n, h in B.files.items()], {'ETag': et}
    if p.startswith('/git/blobs/') and method == 'GET':
        return 200, {'content': base64.encodebytes(B.blobs[p.split('/')[-1]]).decode(), 'encoding': 'base64'}, {}
    if p.startswith('/contents/hop-thu/') and method == 'DELETE':
        name = p.split('/')[-1]
        if B.files.get(name) != body.get('sha'): return 409, {'message': 'sha'}, {}
        del B.files[name]; B.ver += 1; return 200, {}, {}
    return 404, {'message': 'Not Found ' + method + ' ' + p}, {}
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match, Accept', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE', 'Access-Control-Expose-Headers': 'ETag, Retry-After'}
async def route(r):
    q = r.request
    if q.method == 'OPTIONS': return await r.fulfill(status=204, headers=CORS)
    code, out, extra = handle(q.method, q.url, json.loads(q.post_data) if q.post_data else None, q.headers)
    if code == 304: return await r.fulfill(status=304, headers={**CORS, **extra})
    await r.fulfill(status=code, body=json.dumps(out), headers={**CORS, **extra, 'Content-Type': 'application/json'})

def init(dev):
    return f"""localStorage.setItem('fs-sync-gh-repo','me/frame-data'); localStorage.setItem('fs-sync-gh-token','{TOK}');
      localStorage.setItem('fs-sync-auto','off'); localStorage.setItem('fs-dev-id','{dev}');
      document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide')));"""
async def wait(pg, js, ms=12000):
    t = time.time()
    while time.time() - t < ms / 1000:
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(150)
    return False
async def pywait(cond, sec=10):
    t = time.time()
    while time.time() - t < sec:
        if cond(): return True
        await asyncio.sleep(0.15)
    return False
async def start(pg):
    await pg.goto('http://localhost:9193/index.html'); await pg.wait_for_timeout(900)
    await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
INK = "async (i)=>{const f=S.frames[i]; await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(0,0,W,H).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]>100) n++; return n}"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        errs = []
        tbx = await b.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True); await tbx.route('https://api.github.com/**', route)
        await tbx.add_init_script(init('tab001'))
        tb = await tbx.new_page(); tb.on('pageerror', lambda e: errs.append('tablet: ' + str(e)))
        pcx = await b.new_context(viewport={'width': 1366, 'height': 900}); await pcx.route('https://api.github.com/**', route)
        await pcx.add_init_script(init('pc0001'))
        pc = await pcx.new_page(); pc.on('pageerror', lambda e: errs.append('pc: ' + str(e)))
        await start(tb); await start(pc)

        # 📱 chế độ gọn on the tablet
        await tb.evaluate('gonSet(true)'); await tb.wait_for_timeout(300)
        vis = "(s)=>{const e=document.querySelector(s); return !!e && !!e.offsetParent}"
        print('gọn: frame bar hidden', not await tb.evaluate(vis, '#tl'), 'lasso hidden', not await tb.evaluate(vis, '#rail [data-tool=lasso]'),
              'Gửi + Hộp thư shown', await tb.evaluate(vis, '#sendBtn') and await tb.evaluate(vis, '#mailBtn'), 'Ghép kept', await tb.evaluate(vis, '#rail [data-tool=puppet]'))
        await tb.screenshot(path='o_gon.png')

        # tablet: a cut-out character (cầu thủ mẫu) in a pose of its own
        await tb.evaluate('kitAdd(kitOpt)'); await tb.wait_for_timeout(400)
        await tb.evaluate("(()=>{const a=S.pp.parts.find(q=>q.role==='armL'); curFrame().pp[a.id]={...(curFrame().pp[a.id]||{}), r:1.1}; window.__arm=a.role})()")
        print('tablet has character', await tb.evaluate('S.pp.parts.length') >= 8)
        await tb.click('#sendBtn'); await tb.wait_for_selector('.dlg >> text=📮 Gửi vào Hộp thư')
        await tb.fill('#fscName', 'Cầu thủ A'); await tb.click('.dlg .btns >> text=📮 Gửi vào Hộp thư')
        print('sent: 1 file in mailbox', await pywait(lambda: nf() == 1))
        print('mailbox on its own branch, main untouched', B.refs.get('main') == 'c0main' and 'hop-thu' in B.refs)
        name = next((k for k in B.files if k != '.keep'), '')
        print('file name says tablet + char', bool(re.match(r'^\d+_tab001_[a-z-]+_Cầu-thủ-A\.fschar\.png$', name)), name)

        # computer: 2 frames, the banner shows, open → Thành layer on every frame
        await pc.evaluate('addFrame()'); await pc.wait_for_timeout(200); await pc.evaluate('selectFrame(1)')
        print('pc banner', await wait(pc, "!document.getElementById('mboxBanner').hidden && document.getElementById('mboxBanTxt').textContent.includes('Cầu thủ A')"))
        await pc.click('#mboxOpen'); await pc.wait_for_selector('.dlg >> text=🧍 Thành layer')
        await pc.select_option('#fscShow', 'all'); await pc.click('.dlg .btns >> text=🧍 Thành layer')
        await pc.wait_for_timeout(600)
        print('layer added', await pc.evaluate('S.pp && S.pp.parts.filter(q=>!q.parent).length') == 1, await pc.evaluate('S.pp.parts.length') >= 8)
        arm = await pc.evaluate("S.frames.map(f=>{const a=S.pp.parts.find(q=>q.role==='armL'); return f.pp[a.id] && f.pp[a.id].r})")
        print('pose kept on every frame', all(abs((x or 0) - 1.1) < 1e-6 for x in arm), arm)
        print('shown on frame 1 too', await pc.evaluate("(()=>{const f=S.frames[0]; return S.pp.parts.every(q=>!(f.pp[q.id]||{}).h)})()"))
        print('mail taken out of the box', await pywait(lambda: nf() == 0))
        print('undo removes layer', await pc.evaluate("(async()=>{await undo(); await new Promise(r=>setTimeout(r,300)); return !S.pp || S.pp.parts.length===0 || S.pp.parts.every(q=>(S.frames[1].pp[q.id]||{}).h)})()"))
        await pc.evaluate('redo()'); await pc.wait_for_timeout(300)

        # second send → Thành ảnh vào frame 2, lớp Nhân vật, at the same place
        await tb.evaluate("(async()=>{const pk=await fscPack(fscCharRoot(),'Cầu thủ B'); await mboxSend(pk.u8,'Cầu thủ B.fschar.png'); window.__flat=JSON.parse(new TextDecoder().decode(await fscZip((()=>{const d=pngChunk(pk.u8,'fsCh');return d.subarray(4)})(),true))).flat})()")
        flat = await tb.evaluate('window.__flat')
        await pc.evaluate('selectFrame(0)')
        print('pc banner 2', await wait(pc, "!document.getElementById('mboxBanner').hidden && document.getElementById('mboxBanTxt').textContent.includes('Cầu thủ B')"))
        await pc.click('#mboxOpen'); await pc.wait_for_selector('.dlg >> text=🖼 Thành ảnh')
        await pc.fill('#fscAt', '2'); await pc.click('.dlg .btns >> text=🖼 Thành ảnh'); await pc.wait_for_timeout(500)
        fl = await pc.evaluate('floating && {cur:S.cur, x: floating.cx - floating.c.width/2, y: floating.cy - floating.c.height/2, s: floating.scale, layer:S.layer}')
        print('image floating on frame 2 at the tablet spot', bool(fl) and fl['cur'] == 1 and abs(fl['x'] - flat['x']) < 1 and abs(fl['y'] - flat['y']) < 1 and fl['s'] == 1 and fl['layer'] == 'char', fl, flat)
        n0 = await pc.evaluate(INK, 1); await pc.evaluate('commitFloating()'); await pc.wait_for_timeout(200)
        print('put down into frame 2', await pc.evaluate(INK, 1) > n0 + 1000)

        # 📤 file path: same file → 💾 kho; file squashed by a chat app (no data chunk) → only an image
        arr = await tb.evaluate("(async()=>{const pk=await fscPack(fscCharRoot(),'Cầu thủ C'); return Array.from(pk.u8)})()")
        await pc.evaluate("(a)=>{window.__u8=new Uint8Array(a); fscReceive(window.__u8,'Cau-thu-C.fschar.png')}", arr)
        await pc.wait_for_selector('.dlg >> text=💾 Lưu vào kho'); await pc.click('.dlg .btns >> text=💾 Lưu vào kho'); await pc.wait_for_timeout(400)
        print('saved to Kho nhân vật', await pc.evaluate("charLib().then(L=>L.length===1 && L[0].name==='Cầu thủ C' && L[0].n>=8)"))
        await pc.evaluate("(async()=>{const bm=await createImageBitmap(new Blob([window.__u8])); const c=makeCanvas(bm.width,bm.height); c.getContext('2d').drawImage(bm,0,0); const u=new Uint8Array(await (await toBlob(c)).arrayBuffer()); fscReceive(u,'Cau-thu-C.fschar.png')})()")
        print('squashed file → image dialog', await wait(pc, "!!document.querySelector('.dlg') && document.querySelector('.dlg h3').textContent.startsWith('📮 Ảnh')"))
        await pc.click('.dlg .btns >> text=Huỷ')

        # computer → tablet: a picture to cut
        await pc.evaluate("(async()=>{const c=makeCanvas(300,400); const x=c.getContext('2d'); x.fillStyle='#e53935'; x.fillRect(50,50,200,300); await mboxSend(new Uint8Array(await (await toBlob(c)).arrayBuffer()),'anh-mau.png')})()")
        print('tablet banner (image)', await wait(tb, "!document.getElementById('mboxBanner').hidden && document.getElementById('mboxBanTxt').textContent.startsWith('📮 Ảnh')"))
        print('tablet badge', await tb.evaluate("document.getElementById('mailBadge').textContent==='1' && !document.getElementById('mailBadge').hidden"))
        await tb.click('#mboxOpen'); await tb.wait_for_selector('.dlg >> text=🖼 Đặt vào frame'); await tb.click('.dlg .btns >> text=🖼 Đặt vào frame'); await tb.wait_for_timeout(400)
        print('image placed on tablet', await tb.evaluate('!!floating'), 'box empty', await pywait(lambda: nf() == 0))

        await asyncio.sleep(6); n0, l0 = B.n304, B.lists; await asyncio.sleep(12)
        print('idle poll answered 304 (free)', B.lists > l0 and B.n304 - n0 == B.lists - l0, B.n304 - n0, B.lists - l0)
        print('still no write to main', B.refs.get('main') == 'c0main')
        await tb.evaluate('commitFloating()'); await tb.click('#gonExit'); await tb.wait_for_timeout(300)
        print('gọn off: frame bar back', await tb.evaluate(vis, '#tl'), 'Gửi hidden', not await tb.evaluate(vis, '#sendBtn'))
        await b.close()
    print('ERR', errs)

asyncio.run(main())
