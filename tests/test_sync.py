import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# ☁ Làm tiếp trên máy khác: sync through a private GitHub repo, the second device joins with a session code (mã phiên). GitHub is MOCKED (an in-memory git: blobs, trees, commits, refs,
# fast-forward check), two browser contexts = tablet + laptop. Checks push/pull, the open project refreshing, unchanged
# pictures not re-uploaded, both-edited → both kept, delete travelling, token never leaving localStorage, public repo refused.
import asyncio, subprocess, time, json, base64, hashlib, re
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8857'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
DBG = False
TOK = 'github_pat_TEST_not_real_42'
class Git:
    def __init__(s): s.blobs = {}; s.trees = {}; s.commits = {}; s.head = None; s.private = True; s.uploads = 0; s.auth_bad = 0; s.writes = []; s.limit = None; s.limited = 0
    def gsha(s, b): return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
    def put_tree(s, d): k = hashlib.sha1(json.dumps(sorted(d.items())).encode()).hexdigest(); s.trees[k] = dict(d); return k
    def commit(s, tree, parents): k = hashlib.sha1((tree + ','.join(parents) + str(len(s.commits))).encode()).hexdigest(); s.commits[k] = {'tree': tree, 'parents': parents, 'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + len(s.commits) * 60))}; return k
    def log(s, path):   # commits that changed one file, newest first (like GET /commits?path=)
        out, c = [], s.head
        while c:
            cm = s.commits[c]; par = cm['parents'][0] if cm['parents'] else None
            a = s.trees[cm['tree']].get(path); b = s.trees[s.commits[par]['tree']].get(path) if par else None
            if a != b: out.append({'sha': c, 'commit': {'committer': {'date': cm['date']}}})
            c = par
        return out
    def files(s):
        if not s.head: return {}
        t = s.trees[s.commits[s.head]['tree']]; return {p: s.blobs[h] for p, h in t.items()}
G = Git()
def handle_api(method, path, body, headers):
    if headers.get('authorization') != 'Bearer ' + TOK: G.auth_bad += 1; return 401, {'message': 'Bad credentials'}
    m = re.match(r'/repos/me/frame-data([^?]*)', path)
    if not m: return 404, {'message': 'Not Found'}
    if method != 'GET' and G.limit:   # GitHub's secondary rate limit on content writes: n per window seconds
        n, win = G.limit; now = time.time(); G.writes = [t for t in G.writes if now - t < win]
        if len(G.writes) >= n: G.limited += 1; return 403, {'message': 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.'}, {'retry-after': '1'}
        G.writes.append(now)
    p = m.group(1); qs = path.split('?')[1] if '?' in path else ''
    if p == '/commits' and method == 'GET':
        from urllib.parse import parse_qs; return 200, G.log(parse_qs(qs)['path'][0])
    if p == '' and method == 'GET': return 200, {'private': G.private, 'permissions': {'push': True}}
    if p == '/git/ref/heads/main':
        return (200, {'object': {'sha': G.head}}) if G.head else (409, {'message': 'Git Repository is empty.'})
    if p == '/contents/index.json' and method == 'PUT':
        b = base64.b64decode(body['content']); h = G.gsha(b); G.blobs[h] = b
        G.head = G.commit(G.put_tree({'index.json': h}), []); return 201, {}
    if p.startswith('/git/commits/') and method == 'GET':
        c = G.commits[p.split('/')[-1]]; return 200, {'tree': {'sha': c['tree']}, 'parents': [{'sha': x} for x in c['parents']], 'committer': {'date': c['date']}}
    if p.startswith('/git/trees/') and method == 'GET':
        return 200, {'tree': [{'path': k, 'type': 'blob', 'sha': v} for k, v in G.trees[p.split('/')[-1]].items()], 'truncated': False}
    if p == '/git/blobs' and method == 'POST':
        b = base64.b64decode(body['content']); h = G.gsha(b); G.blobs[h] = b; G.uploads += 1; return 201, {'sha': h}
    if p.startswith('/git/blobs/') and method == 'GET':   # like the real API: JSON with base64 content split into lines
        b = base64.encodebytes(G.blobs[p.split('/')[-1]]).decode(); return 200, {'content': b, 'encoding': 'base64'}
    if p == '/git/trees' and method == 'POST':
        d = dict(G.trees[body['base_tree']])
        for e in body['tree']:
            if e['sha'] is None: d.pop(e['path'], None)
            else:
                if e['sha'] not in G.blobs: return 422, {'message': 'tree.sha is not a valid blob'}
                d[e['path']] = e['sha']
        return 201, {'sha': G.put_tree(d)}
    if p == '/git/commits' and method == 'POST': return 201, {'sha': G.commit(body['tree'], body['parents'])}
    if p == '/git/refs/heads/main' and method == 'PATCH':
        if G.commits[body['sha']]['parents'] != [G.head]: return 422, {'message': 'Update is not a fast forward'}
        G.head = body['sha']; return 200, {}
    return 404, {'message': 'Not Found ' + method + ' ' + p}
# same CORS rules as api.github.com: no Cache-Control / Pragma request headers allowed
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, Accept-Encoding, X-GitHub-OTP, X-Requested-With, User-Agent', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE', 'Access-Control-Expose-Headers': 'ETag, Link, Location, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'}
async def route(r):
    q = r.request
    if q.method == 'OPTIONS': return await r.fulfill(status=204, headers=CORS)
    print('REQ', q.method, q.url, q.headers.get('authorization')) if DBG else None
    res = handle_api(q.method, q.url.replace('https://api.github.com', ''), json.loads(q.post_data) if q.post_data else None, q.headers)
    code, out, extra = res if len(res) == 3 else (*res, {})
    await r.fulfill(status=code, body=json.dumps(out), headers={**CORS, **extra, 'Content-Type': 'application/json'})
PEN = """async ([pts])=>{const v=document.getElementById('view');
  const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'pen',clientX:x,clientY:y,pressure:0.6,buttons:1,bubbles:true,cancelable:true});
  v.dispatchEvent(mk('pointerdown',pts[0][0],pts[0][1])); for(const [x,y] of pts.slice(1)){v.dispatchEvent(mk('pointermove',x,y)); await new Promise(r=>setTimeout(r,4));}
  v.dispatchEvent(mk('pointerup',pts.at(-1)[0],pts.at(-1)[1]));}"""
D2S = "([x,y])=>{const c=Math.cos(vr)*vs,s=Math.sin(vr)*vs;const r=document.getElementById('view').getBoundingClientRect();return [r.left+(c*x-s*y+vtx)/DPR, r.top+(s*x+c*y+vty)/DPR]}"
INK = "async ([i,x0,y0,x1,y1])=>{const f=S.frames[i]; await ensureLoaded(f); const d=f.canvas.getContext('2d').getImageData(x0,y0,x1-x0,y1-y0).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]>100) n++; return n}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        errs = []
        async def device(name):
            ctx = await b.new_context(viewport={'width': 1180, 'height': 900}); await ctx.route('https://api.github.com/**', route)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e)))
            await pg.add_init_script("localStorage.setItem('fs-help','1')")
            await pg.goto('http://localhost:8857/index.html'); await pg.wait_for_timeout(900)
            return pg
        async def draw(pg, pts):
            await pg.evaluate(PEN, [[await pg.evaluate(f"({D2S})([{x},{y}])") for x, y in pts]]); await pg.wait_for_timeout(200)
        async def setup(pg, repo='me/frame-data', tok=TOK):   # first device: make the session code
            await pg.click('#menuBtn'); await pg.click('[data-m=sync]'); await pg.wait_for_timeout(200)
            await pg.click('.dlg summary'); await pg.fill('#syRepo', repo); await pg.fill('#syTok', tok)
            await pg.click('#syMake'); await pg.wait_for_timeout(300)
        async def close_dlg(pg): await pg.click('.dlg .btns >> text=Đóng'); await pg.wait_for_timeout(150)
        async def join(pg, code):   # second device: paste the code
            await pg.click('#menuBtn'); await pg.click('[data-m=sync]'); await pg.wait_for_timeout(200)
            await pg.screenshot(path='sync_join.png'); await pg.fill('#syCode', code); await pg.click('#syJoin'); await pg.wait_for_timeout(300)
        async def sync(pg): return await pg.evaluate("syncNow({manual:true})")
        A = await device('tablet'); Bd = await device('laptop')
        print('sync off by default: no cloud badge', await A.is_hidden('#syncState'))
        # tablet draws 2 frames
        await draw(A, [(300, 600), (500, 700), (700, 800)]); await A.click('#addBtn'); await A.wait_for_timeout(200)
        await draw(A, [(300, 1000), (500, 1100), (700, 1200)])
        await A.evaluate("S.projName='Phim của tôi'; scheduleSave()"); await A.wait_for_timeout(2000)
        # a public repo is refused, the token is not kept
        G.private = False; await setup(A)
        print('public repo refused', 'Public' in await A.inner_text('#syMsg'), 'token not kept', await A.evaluate("localStorage.getItem('fs-sync-gh-token')") is None)
        await close_dlg(A); G.private = True
        # wrong token → clear message
        await setup(A, tok='nope'); await A.wait_for_timeout(300); print('bad token message', 'Token sai' in await A.inner_text('#syMsg'), await A.inner_text('#syMsg')); await close_dlg(A)
        await setup(A); await A.wait_for_function("!syncBusy && syncLast > 0", timeout=20000); await A.wait_for_timeout(300)
        code = await A.input_value('#syCode')
        print('the new session code is shown', code.startswith('FS1-'), 'and decodes', await A.evaluate(f"JSON.stringify(syncCodeParse('{code}'))") == json.dumps({'repo': 'me/frame-data', 'tok': TOK}, separators=(',', ':')))
        await close_dlg(A)
        idx = json.loads(G.files()['index.json'])
        print('empty repo initialised + tablet project pushed', [x['name'] for x in idx['projects']] == ['Phim của tôi'])
        print('badge shows synced', (await A.inner_text('#syncState')).strip() == '☁ ✓')
        allbytes = b''.join(G.files().values())
        print('token never in the repo', TOK.encode() not in allbytes)
        print('token not in the project record', await A.evaluate(f"(async()=>!JSON.stringify(await idbGet('project:'+curProjId)).includes('{TOK}'))()"))
        up0 = G.uploads; await sync(A); print('nothing new → nothing uploaded, no new commit', G.uploads == up0)
        # laptop joins with the code: a wrong code is refused, the right one opens the tablet's project right away
        await join(Bd, 'FS1-abc'); print('wrong code refused', 'không đúng' in await Bd.inner_text('#syMsg')); await close_dlg(Bd)
        await join(Bd, code); await Bd.wait_for_function("!syncBusy && syncLast > 0", timeout=20000); await Bd.wait_for_timeout(500)
        names = await Bd.evaluate("projIndex().then(L=>L.map(x=>x.name).sort())")
        pid = await A.evaluate("curProjId")
        print('laptop has the tablet project, its blank one dropped', names == ['Phim của tôi'], names, 'and it is open', await Bd.evaluate("curProjId") == pid)
        print('laptop: 2 frames with the drawing', await Bd.evaluate("S.frames.length") == 2, await Bd.evaluate(INK, [0, 250, 550, 750, 850]) > 200)
        # laptop edits: one more stroke in frame 1 and a 3rd frame
        await Bd.evaluate("selectFrame(0)"); await Bd.wait_for_timeout(300)
        await draw(Bd, [(300, 300), (500, 350), (700, 400)]); await Bd.click('#addBtn'); await Bd.wait_for_timeout(2200)
        up1 = G.uploads; await sync(Bd)
        print('only changed pictures uploaded', G.uploads - up1 <= 5, G.uploads - up1)
        # tablet presses F5 → it opens with the newest version, no button needed
        await A.reload(); await A.wait_for_timeout(500); await A.wait_for_function("!syncBusy && syncLast > 0", timeout=20000); await A.wait_for_timeout(800)
        print('F5 on the tablet got the laptop edit (3 frames)', await A.evaluate("S.frames.length") == 3, 'same project open', await A.evaluate("curProjId") == pid)
        print('tablet frame 1 has the laptop stroke', await A.evaluate(INK, [0, 250, 250, 750, 450]) > 200)
        # both edit the same project before syncing → both versions kept
        await draw(A, [(300, 1400), (600, 1450)]); await A.wait_for_timeout(2000)
        await draw(Bd, [(300, 1600), (600, 1650)]); await Bd.wait_for_timeout(2000)
        await sync(A); await sync(Bd)
        names = await Bd.evaluate("projIndex().then(L=>L.map(x=>x.name).sort())")
        print('conflict keeps both on laptop', 'Phim của tôi (từ máy khác)' in names and 'Phim của tôi' in names, names)
        await sync(A)
        namesA = await A.evaluate("projIndex().then(L=>L.map(x=>x.name).sort())")
        print('tablet sees the same list', sorted(namesA) == sorted(names), namesA)
        # 🕘 Bản cũ: the 2-frame version comes back as a new project, the current one untouched
        await A.click('#syncState'); await A.wait_for_timeout(200); await A.click('.dlg .btns >> text=🕘 Bản cũ'); await A.wait_for_selector('[data-sh]', timeout=5000)
        n_rows = await A.locator('[data-sh]').count(); print('history lists versions', n_rows >= 2, n_rows)
        await A.screenshot(path='sync_history.png')
        await A.locator('[data-sh]').last.click(); await A.wait_for_timeout(1500)
        nm = await A.evaluate("S.projName"); print('old version restored as a new project', '(bản ' in nm and await A.evaluate("curProjId") != pid, nm, 'with 2 frames', await A.evaluate("S.frames.length") == 2)
        print('the real project still has 3 frames', await A.evaluate(f"idbGet('project:{pid}').then(p=>p.frames.length)") == 3)
        await A.evaluate(f"openProject('{pid}')"); await A.wait_for_timeout(600)
        await sync(A); await sync(Bd)
        # delete on the laptop → gone on the tablet
        other = await Bd.evaluate("projIndex().then(L=>L.find(x=>x.name.includes('(bản ')).id)")
        await Bd.evaluate(f"(async()=>{{ await idbDel('project:{other}'); await deleteProjectBlobs('{other}'); const L=(await projIndex()).filter(x=>x.id!=='{other}'); await idbPut('projects',L); await syncNoteDeleted('{other}'); }})()")
        await sync(Bd); await sync(A)
        print('delete travels', await A.evaluate(f"projIndex().then(L=>!L.find(x=>x.id==='{other}'))"), 'files removed from repo', not any(k.startswith(f'p/{other}/') for k in G.files()))
        # another device committed meanwhile → no lost write (fast-forward retry)
        await draw(A, [(200, 200), (260, 260)]); await A.wait_for_timeout(2000)
        await A.evaluate("""(()=>{ const f=window.fetch; let once=true; window.fetch=async(u,o)=>{ if(once && o && o.method==='PATCH'){ once=false; return new Response(JSON.stringify({message:'Update is not a fast forward'}),{status:422,headers:{'Content-Type':'application/json'}}); } return f(u,o); }; })()""")
        r = await sync(A); print('retries after a refused update', r is not None and r['pushed'] >= 1)
        await sync(Bd); await A.wait_for_timeout(2500); await Bd.wait_for_timeout(500); await sync(A); await sync(Bd)
        h0 = G.head; await A.wait_for_timeout(2500); await sync(A); await sync(Bd); await sync(A)
        print('settled: no ping-pong commits between the two devices', G.head == h0)
        # a big first upload hits GitHub's write limit: the app waits and goes on, and the work still arrives
        await A.evaluate("createProject(1080,1920,'Phim dài')"); await A.wait_for_timeout(600)
        for k in range(24):
            if k: await A.click('#addBtn'); await A.wait_for_timeout(80)
            await draw(A, [(200 + k * 20, 400), (500, 600 + k * 10)])
        await A.wait_for_timeout(2000)
        G.limit = (12, 2.5); await A.evaluate("GH_PACE=0"); r = await A.evaluate("syncNow({manual:true})")
        print('big upload finished despite the limit', r is not None and r['pushed'] >= 1, 'GitHub said slow down', G.limited > 0, G.limited)
        long_id = await A.evaluate("curProjId"); G.limit = None
        print('long film is in the repo', any(x['id'] == long_id for x in json.loads(G.files()['index.json'])['projects']))
        # another device that already has its own work joins → it opens the newest work from the other device
        C = await device('tablet2'); await draw(C, [(300, 600), (600, 900)]); await C.wait_for_timeout(2000)
        await join(C, code); await C.wait_for_function("!syncBusy && syncLast > 0", timeout=30000); await C.wait_for_timeout(600)
        print('joining device opens the newest work from the other device', await C.evaluate("curProjId") == long_id, await C.evaluate("S.frames.length") == 24)
        print('its own work is kept too', 'Dự án 1' in await C.evaluate("projIndex().then(L=>L.map(x=>x.name))"))
        await A.screenshot(path='sync_badge.png')
        await A.click('#syncState'); await A.wait_for_timeout(200); await A.screenshot(path='sync_dialog.png')
        print('bad auth calls', G.auth_bad)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
