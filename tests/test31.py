import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# AI tạo nhân vật (Gemini) — the Google API is MOCKED here (no real key, no network): checks the request shape,
# that the key stays in localStorage only (header, never URL / project), clear error messages, library + quick-make cut.
import asyncio, subprocess, time, json, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8800'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
KEY = 'TEST-KEY-not-real-123'
IMG = base64.b64encode(open(os.path.join(ASSETS, 'cartoon.png'), 'rb').read()).decode()
OKBODY = {'candidates': [{'content': {'parts': [{'text': 'Here you go'}, {'inlineData': {'mimeType': 'image/png', 'data': IMG}}]}, 'finishReason': 'STOP'}]}
def err(code, status, msg, reason=None):
    e = {'code': code, 'status': status, 'message': msg}
    if reason: e['details'] = [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': reason}]
    return code, {'error': e}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        reqs = []; plan = []
        async def handle(route):
            r = route.request; reqs.append({'url': r.url, 'method': r.method, 'headers': r.headers, 'body': r.post_data})
            code, body = plan.pop(0) if plan else (200, OKBODY)
            await route.fulfill(status=code, content_type='application/json', body=json.dumps(body), headers={'Access-Control-Allow-Origin': '*'})
        await pg.route('https://generativelanguage.googleapis.com/**', handle)
        await pg.goto('http://localhost:8800/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('text=Bắt đầu vẽ')
        await pg.click('#aiCharBtn'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='ai_dialog.png')
        # no key yet → clear message, no request sent
        await pg.click('#aiGoBtn'); print('no key msg', 'Chưa có key' in await pg.inner_text('#aiErr'), 'requests', len(reqs))
        # set the key in the key dialog
        await pg.click('#aiKeyBtn'); await pg.fill('#aiKeyIn', KEY)
        print('key input hidden (password)', await pg.get_attribute('#aiKeyIn', 'type') == 'password')
        await pg.click('.dlg .btns >> text=Lưu'); await pg.wait_for_timeout(200)
        print('key in localStorage', await pg.evaluate("localStorage.getItem('fs-gemini-key')") == KEY)
        # no photo → message
        await pg.click('#aiGoBtn'); print('no photo msg', 'Chọn ảnh' in await pg.inner_text('#aiErr'))
        async with pg.expect_file_chooser() as fc:
            await pg.click('#aiPhotoBtn')
        await (await fc.value).set_files(os.path.join(ASSETS, 'portrait.png')); await pg.wait_for_timeout(300)
        async def run(expect):
            await pg.click('#aiGoBtn')
            await pg.wait_for_function("document.getElementById('aiBusy').hidden", timeout=20000)
            t = await pg.inner_text('#aiErr') if await pg.is_visible('#aiErr') else ''
            return t
        # error cases
        cases = [(err(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID'), 'Key Gemini không đúng'),
                 (err(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded'), 'quota'),
                 (err(403, 'PERMISSION_DENIED', 'Method doesn\'t allow unregistered callers'), 'không được dùng Gemini API'),
                 (err(404, 'NOT_FOUND', 'models/x is not found'), 'Không tìm thấy model'),
                 (err(503, 'UNAVAILABLE', 'The model is overloaded'), 'bận'),
                 ((200, {'promptFeedback': {'blockReason': 'SAFETY'}}), 'từ chối'),
                 ((200, {'candidates': [{'content': {'parts': [{'text': 'I cannot do that'}]}, 'finishReason': 'STOP'}]}), 'không trả về hình')]
        for (resp, want) in cases:
            plan.append(resp); t = await run(want); print('error', resp[0], want, want in t)
        print('result still empty after errors', await pg.evaluate("!document.getElementById('aiResPv').getAttribute('src')"))
        # imageConfig not supported → retried once without it
        n0 = len(reqs); plan.append(err(400, 'INVALID_ARGUMENT', 'Invalid JSON payload received. Unknown name "imageConfig" at generation_config')); plan.append((200, OKBODY))
        t = await run('')
        print('retry without imageConfig', len(reqs) - n0 == 2, 'imageConfig' not in reqs[-1]['body'], 'no error', t == '')
        await pg.screenshot(path='ai_result.png')
        # request shape
        r = reqs[-1]; body = json.loads(r['body']); parts = body['contents'][0]['parts']
        print('POST generateContent', r['method'] == 'POST', r['url'].endswith('/models/gemini-2.5-flash-image:generateContent'))
        print('key in header only', r['headers'].get('x-goog-api-key') == KEY, KEY not in r['url'])
        imgs = [q for q in parts if 'inline_data' in q]; txt = ' '.join(q.get('text', '') for q in parts)
        print('two images (style ref first, then photo)', len(imgs) == 2, parts[0]['text'].startswith('Image 1'), all(q['inline_data']['data'] for q in imgs))
        print('prompt', 'exact style of image 1' in txt, 'logos' in txt, 'IMAGE' in body['generationConfig']['responseModalities'])
        # saved in library (IndexedDB) and shown
        print('library items', await pg.evaluate("(async()=>(await aiLib()).length)()"), await pg.locator('.ai-item').count())
        # key never stored in project data / IndexedDB
        await pg.evaluate("saveProject()")
        await pg.wait_for_timeout(500)
        leak = await pg.evaluate(f"""(async()=>{{const db=await idbOpen();const all=await new Promise(r=>{{const q=db.transaction('kv').objectStore('kv').getAll();q.onsuccess=()=>r(q.result)}});
          return all.some(v=>{{try{{return JSON.stringify(v).includes('{KEY}')}}catch(e){{return false}}}})}})()""")
        print('key not in IndexedDB', not leak)
        # custom style reference is used instead of the built-in one
        async with pg.expect_file_chooser() as fc:
            await pg.click('#aiRefBtn')
        await (await fc.value).set_files(os.path.join(ASSETS, 'mit.png')); await pg.wait_for_timeout(300)
        b0 = json.loads(reqs[-1]['body'])['contents'][0]['parts'][1]['inline_data']['data']
        await run(''); b1 = json.loads(reqs[-1]['body'])['contents'][0]['parts'][1]['inline_data']['data']
        print('custom style ref sent', b0 != b1, 'library', await pg.locator('.ai-item').count())
        await pg.click('#aiRefReset'); await pg.wait_for_timeout(200)
        # quick-make cut opens the import dialog in "Nhân vật ghép" mode
        await pg.click('#aiCutBtn'); await pg.wait_for_timeout(1500)
        print('quick cut opens pp mode', await pg.evaluate("!!document.querySelector('.imp-tabs .chip.on[data-mode=pp]')"))
        await pg.screenshot(path='ai_cut.png')
        # library persists after reload; delete works
        await pg.reload(); await pg.wait_for_timeout(1000)
        if await pg.is_visible('text=Bắt đầu vẽ'): await pg.click('text=Bắt đầu vẽ')
        await pg.click('#aiCharBtn'); await pg.wait_for_timeout(400)
        n = await pg.locator('.ai-item').count(); await pg.click('.ai-item [data-a=del] >> nth=0'); await pg.wait_for_timeout(300)
        print('persisted + delete', n, '->', await pg.locator('.ai-item').count())
        print('key kept after reload', 'Đã có key' in await pg.inner_text('#aiKeyState'))
        # delete key
        await pg.click('#aiKeyBtn'); await pg.click('.dlg .btns >> text=Xoá key'); await pg.wait_for_timeout(200)
        print('key removed', await pg.evaluate("localStorage.getItem('fs-gemini-key')") is None)
        await b.close()
    print('ERR', errs)
try: asyncio.run(main())
finally: srv.terminate()
