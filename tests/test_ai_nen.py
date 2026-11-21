import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
# 🤖 AI vẽ nền — the Google API is MOCKED (no real key, no network): request shape (9:16, prompt, key in header only),
# background filled cover-fit + one undo step, sketch mode sends the frame, safety refusal message, recent library reuse.
import asyncio, subprocess, time, json, base64, io
from PIL import Image
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8878'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
KEY = 'TEST-KEY-not-real-456'
def png(col):
    im = Image.new('RGB', (576, 1024), col); bio = io.BytesIO(); im.save(bio, 'PNG'); return base64.b64encode(bio.getvalue()).decode()
def ok(col): return 200, {'candidates': [{'content': {'parts': [{'inlineData': {'mimeType': 'image/png', 'data': png(col)}}]}, 'finishReason': 'STOP'}]}
CENTER = "(()=>{const b=bgOf(curFrame()); return Array.from(b.canvas.getContext('2d').getImageData(W>>1,H>>1,1,1).data.slice(0,3))})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        reqs = []; plan = []
        async def handle(route):
            r = route.request; reqs.append({'url': r.url, 'headers': r.headers, 'body': json.loads(r.post_data or '{}')})
            code, body = plan.pop(0) if plan else ok((40, 160, 90))
            await route.fulfill(status=code, content_type='application/json', body=json.dumps(body), headers={'Access-Control-Allow-Origin': '*'})
        await pg.route('https://generativelanguage.googleapis.com/**', handle)
        await pg.goto('http://localhost:8878/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(200); await pg.click('.bgm-ai'); await pg.wait_for_timeout(300)
        await pg.fill('#abDesc', 'lớp học buổi chiều nắng vàng')
        await pg.click('#abGo'); print('no key msg', 'Chưa có key' in await pg.inner_text('#abErr'), len(reqs) == 0)
        await pg.evaluate(f"localStorage.setItem('fs-gemini-key','{KEY}')")
        await pg.click('[data-abs=water]')
        before = await pg.evaluate(CENTER)
        await pg.click('#abGo'); await pg.wait_for_function("!document.querySelector('#abUse').disabled", timeout=10000)
        await pg.screenshot(path='ai_nen.png')
        r = reqs[-1]; body = r['body']; txt = ' '.join(pt.get('text', '') for pt in body['contents'][0]['parts'])
        print('aspect 9:16', body['generationConfig'].get('imageConfig', {}).get('aspectRatio') == '9:16')
        print('prompt has desc + style + no people', 'lớp học buổi chiều' in txt and 'watercolour' in txt and 'no people' in txt)
        print('key only in header', r['headers'].get('x-goog-api-key') == KEY and KEY not in r['url'])
        await pg.click('#abUse'); await pg.wait_for_timeout(600)
        after = await pg.evaluate(CENTER); print('background painted', after == [40, 160, 90] and before != after, after)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        print('undo restores', await pg.evaluate(CENTER) == before)
        # sketch mode: the frame goes with the request as image 1
        await pg.click('#bgMenuBtn'); await pg.wait_for_timeout(200); await pg.click('.bgm-ai'); await pg.wait_for_timeout(300)
        await pg.check('#abSketch'); plan.append(ok((200, 60, 60)))
        await pg.click('#abGo'); await pg.wait_for_function("!document.querySelector('#abUse').disabled", timeout=10000)
        parts = reqs[-1]['body']['contents'][0]['parts']
        print('sketch sent', any('inline_data' in pt for pt in parts) and 'sketch' in ' '.join(pt.get('text', '') for pt in parts))
        # safety refusal → clear message
        plan.append((200, {'promptFeedback': {'blockReason': 'SAFETY'}, 'candidates': []}))
        await pg.click('#abGo'); await pg.wait_for_function("document.querySelector('#abErr').style.display==='block'", timeout=10000)
        print('refusal msg', 'từ chối' in await pg.inner_text('#abErr'))
        # library: 2 saved, tap the older (green) one → used
        print('library', await pg.evaluate("document.querySelectorAll('.ab-item').length") == 2)
        await pg.click('.ab-item >> nth=1 >> [data-a=use]'); await pg.wait_for_timeout(600)
        print('reuse from library', await pg.evaluate(CENTER) == [40, 160, 90])
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
