import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DIST = os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# GIF / PNG-sequence / single PNG export
srv = subprocess.Popen(['python3','-m','http.server','8835'], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(srv.kill)   # never leave the server behind when the test crashes (a later run would test a stale build)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1366,'height':1024}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8835/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ')
        for _ in range(3): await pg.click('#addBtn'); await pg.wait_for_timeout(60)
        await pg.evaluate("""(async()=>{ const cols=['#e53935','#1e88e5','#43a047','#111111']; for(let i=0;i<4;i++){ const f=S.frames[i]; await ensureLoaded(f); const x=f.canvas.getContext('2d'); x.fillStyle=cols[i]; x.fillRect(100+i*150,300,300,300); f.ver++; f.dur=200; }
          window._got=[]; deliverFile = async (blob,name)=>{ _got.push({name, blob}); return true; }; })()""")
        await pg.click('#gifBtn'); await pg.wait_for_timeout(200)
        await pg.click('.dlg .btns >> text=GIF động'); await pg.wait_for_timeout(3000)
        r = await pg.evaluate("""(async()=>{ const g=_got.at(-1); const u8=new Uint8Array(await g.blob.arrayBuffer()); let gce=0; for(let i=0;i<u8.length-2;i++) if(u8[i]==0x21&&u8[i+1]==0xF9&&u8[i+2]==4) gce++;
           const img=new Image(); img.src=URL.createObjectURL(g.blob); await img.decode(); const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
           const k=img.width/W, d=x.getImageData(Math.round(250*k),Math.round(450*k),1,1).data, w=x.getImageData(Math.round(50*k),Math.round(50*k),1,1).data;
           return {name:g.name, w:img.width, h:img.height, gce, red:[...d].slice(0,3), white:[...w].slice(0,3), head:String.fromCharCode(...u8.slice(0,6)), delay:u8[ [...u8].findIndex((v,i)=>v==0x21&&u8[i+1]==0xF9)+4 ]}; })()""")
        print('gif', r['name'].endswith('.gif'), r['head'], r['w'], r['h'], 'frames', r['gce'], 'delay cs', r['delay'])
        print('colours ok', abs(r['red'][0]-229)<12 and r['red'][1]<80, r['white'][0]>245)
        # decode every GIF frame with Pillow (independent decoder)
        import base64, io
        from PIL import Image
        b64 = await pg.evaluate("(async()=>{const g=_got.find(x=>x.name.endsWith('.gif')); const u=new Uint8Array(await g.blob.arrayBuffer()); let s=''; for(const v of u) s+=String.fromCharCode(v); return btoa(s)})()")
        im = Image.open(io.BytesIO(base64.b64decode(b64))); px=[]
        for i in range(im.n_frames): im.seek(i); im.load(); px.append(im.convert('RGB').getpixel((int(250*480/1080)+i*int(150*480/1080), int(450*480/1080))))
        print('pillow frames', im.n_frames, 'each frame has its square', [max(c)-min(c) > 80 or max(c) < 60 for c in px])
        # PNG sequence zip
        await pg.click('#gifBtn'); await pg.click('.dlg .btns >> text=Mọi frame (ZIP PNG)'); await pg.wait_for_timeout(3000)
        z = await pg.evaluate("(async()=>{ const g=_got.at(-1); const m=await readZip(g.blob); return [g.name, [...m.keys()]]; })()") if await pg.evaluate("typeof readZip==='function'") else await pg.evaluate("(async()=>{const g=_got.at(-1); return [g.name, (await g.blob.text()).match(/frame_\\d{4}\\.png/g).filter((v,i,a)=>a.indexOf(v)===i)]})()")
        print('zip', z[0].endswith('.zip'), sorted(z[1])[:5])
        await pg.evaluate("selectFrame(1)"); await pg.wait_for_timeout(200)
        n0 = await pg.evaluate('_got.length')
        await pg.click('#gifBtn'); await pg.click('.dlg .btns >> text=Ảnh frame này'); await pg.wait_for_function(f'_got.length > {n0}', timeout=10000)
        one = await pg.evaluate("(async()=>{const g=_got.at(-1); const bm=await createImageBitmap(g.blob); return [g.name, bm.width, bm.height]})()")
        print('single png', one)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
