import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# ☁ Sync between devices through a private GitHub repo. GitHub is MOCKED (an in-memory git: blobs, trees, commits, refs,
# fast-forward check), two browser contexts = tablet + laptop. Checks push/pull, the open project refreshing, unchanged
# pictures not re-uploaded, both-edited → both kept, delete travelling, token never leaving localStorage, public repo refused.
import asyncio, subprocess, time, json, base64, hashlib, re
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8857'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
DBG = False
TOK = 'github_pat_TEST_not_real_42'
class Git:
    def __init__(s): s.blobs = {}; s.trees = {}; s.commits = {}; s.head = None; s.private = True; s.uploads = 0; s.auth_bad = 0
    def gsha(s, b): return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
    def put_tree(s, d): k = hashlib.sha1(json.dumps(sorted(d.items())).encode()).hexdigest(); s.trees[k] = dict(d); return k
    def commit(s, tree, parents): k = hashlib.sha1((tree + ','.join(parents) + str(len(s.commits))).encode()).hexdigest(); s.commits[k] = {'tree': tree, 'parents': parents}; return k
    def files(s):
        if not s.head: return {}
        t = s.trees[s.commits[s.head]['tree']]; return {p: s.blobs[h] for p, h in t.items()}
G = Git()
def handle_api(method, path, body, headers):
    if headers.get('authorization') != 'Bearer ' + TOK: G.auth_bad += 1; return 401, {'message': 'Bad credentials'}
    m = re.match(r'/repos/me/frame-data(.*)$', path.split('?')[0])
    if not m: return 404, {'message': 'Not Found'}
    p = m.group(1)
    if p == '' and method == 'GET': return 200, {'private': G.private, 'permissions': {'push': True}}
    if p == '/git/ref/heads/main':
        return (200, {'object': {'sha': G.head}}) if G.head else (409, {'message': 'Git Repository is empty.'})
    if p == '/contents/index.json' and method == 'PUT':
        b = base64.b64decode(body['content']); h = G.gsha(b); G.blobs[h] = b
        G.head = G.commit(G.put_tree({'index.json': h}), []); return 201, {}
    if p.startswith('/git/commits/') and method == 'GET': return 200, {'tree': {'sha': G.commits[p.split('/')[-1]]['tree']}}
    if p.startswith('/git/trees/') and method == 'GET':
        return 200, {'tree': [{'path': k, 'type': 'blob', 'sha': v} for k, v in G.trees[p.split('/')[-1]].items()], 'truncated': False}
    if p == '/git/blobs' and method == 'POST':
        b = base64.b64decode(body['content']); h = G.gsha(b); G.blobs[h] = b; G.uploads += 1; return 201, {'sha': h}
    if p.startswith('/git/blobs/') and method == 'GET': return 200, G.blobs[p.split('/')[-1]]
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
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, accept', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT'}
async def route(r):
    q = r.request
    if q.method == 'OPTIONS': return await r.fulfill(status=204, headers=CORS)
    print('REQ', q.method, q.url, q.headers.get('authorization')) if DBG else None
    code, out = handle_api(q.method, q.url.replace('https://api.github.com', ''), json.loads(q.post_data) if q.post_data else None, q.headers)
    if isinstance(out, bytes): await r.fulfill(status=code, body=out, headers={**CORS, 'Content-Type': 'application/octet-stream'})
    else: await r.fulfill(status=code, body=json.dumps(out), headers={**CORS, 'Content-Type': 'application/json'})
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
        async def setup(pg, repo='me/frame-data', tok=TOK):
            await pg.click('#menuBtn'); await pg.click('[data-m=sync]'); await pg.wait_for_timeout(200)
            await pg.fill('#syRepo', repo); await pg.fill('#syTok', tok)
            await pg.click('.dlg .btns >> text=Lưu & đồng bộ'); await pg.wait_for_timeout(300)
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
        await A.click('.dlg .btns >> text=Tắt đồng bộ'); await A.wait_for_timeout(200); G.private = True
        # wrong token → clear message
        await setup(A, tok='nope'); await A.wait_for_timeout(300); print('bad token message', 'Token sai' in await A.inner_text('#syMsg'), await A.inner_text('#syMsg')); await A.click('.dlg .btns >> text=Tắt đồng bộ'); await A.wait_for_timeout(200)
        await setup(A); await A.wait_for_function("!syncBusy && syncLast > 0", timeout=20000)
        idx = json.loads(G.files()['index.json'])
        print('empty repo initialised + tablet project pushed', [x['name'] for x in idx['projects']] == ['Phim của tôi'])
        print('badge shows synced', (await A.inner_text('#syncState')).strip() == '☁ ✓')
        allbytes = b''.join(G.files().values())
        print('token never in the repo', TOK.encode() not in allbytes)
        print('token not in the project record', await A.evaluate(f"(async()=>!JSON.stringify(await idbGet('project:'+curProjId)).includes('{TOK}'))()"))
        up0 = G.uploads; await sync(A); print('nothing new → nothing uploaded, no new commit', G.uploads == up0)
        # laptop joins: gets the tablet's project, keeps its own empty one too
        await setup(Bd); await Bd.wait_for_function("!syncBusy && syncLast > 0", timeout=20000)
        names = await Bd.evaluate("projIndex().then(L=>L.map(x=>x.name).sort())")
        print('laptop has both projects', names == ['Dự án 1', 'Phim của tôi'], names)
        pid = await A.evaluate("curProjId")
        await Bd.evaluate(f"openProject('{pid}')"); await Bd.wait_for_timeout(800)
        print('laptop opens it: 2 frames with the drawing', await Bd.evaluate("S.frames.length") == 2, await Bd.evaluate(INK, [0, 250, 550, 750, 850]) > 200)
        # laptop edits: one more stroke in frame 1 and a 3rd frame
        await Bd.evaluate("selectFrame(0)"); await Bd.wait_for_timeout(300)
        await draw(Bd, [(300, 300), (500, 350), (700, 400)]); await Bd.click('#addBtn'); await Bd.wait_for_timeout(2200)
        up1 = G.uploads; await sync(Bd)
        print('only changed pictures uploaded', G.uploads - up1 <= 5, G.uploads - up1)
        # tablet comes back to the app → the open project refreshes
        await A.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await A.wait_for_timeout(100)
        await A.evaluate("syncLast=0"); await sync(A); await A.wait_for_timeout(600)
        print('tablet got the laptop edit (3 frames)', await A.evaluate("S.frames.length") == 3, 'same project open', await A.evaluate("curProjId") == pid)
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
        # delete on the laptop → gone on the tablet
        other = await Bd.evaluate("projIndex().then(L=>L.find(x=>x.name==='Dự án 1').id)")
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
        await A.screenshot(path='sync_badge.png')
        await A.click('#syncState'); await A.wait_for_timeout(200); await A.screenshot(path='sync_dialog.png')
        print('bad auth calls', G.auth_bad)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
