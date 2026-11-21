import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time, wave, math, struct
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8877'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# 🎙 Record a voice in the app: fake mic = 1 s silence, 1 s tone, silence; trimmed, saved as a voice clip on the current frame, mouth picked, lip sync runs.
sr = 48000; fake = os.path.join(OUT, 'fake_mic.wav')
with wave.open(fake, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h', int(12000 * math.sin(2 * math.pi * 220 * i / sr)) if sr <= i < 2 * sr else 0) for i in range(4 * sr)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + fake + '%noloop'])
        ctx = await b.new_context(viewport={'width':1280,'height':900}); await ctx.grant_permissions(['microphone'])
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8877/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        # 3 frames of 2 s, two characters' mouths (pieces with role "Miệng")
        await pg.evaluate("""(async()=>{for(let k=0;k<2;k++){const f=newFrameObj(S.bgs[0].id); S.frames.push(f); loaded.push(f);} S.frames.forEach(f=>f.dur=2000);
          S.pp={parts:[]}; S.frames.forEach(f=>f.pp={});
          for(const [i,n] of [[0,'Miệng A'],[1,'Miệng B']]){const c=makeCanvas(60,30); c.getContext('2d').fillRect(0,0,60,30); const pt={id:newId(),name:n,role:'mouth',parent:null,z:i,ox:300+i*300,oy:600,px:330+i*300,py:615,c,alts:[]}; await encodePart(pt); S.pp.parts.push(pt);}
          S.cur=1; buildStrip(); updateFrameUI(); setTool('fx'); openTab('fx','audio'); fxSyncBar();})()""")
        await pg.wait_for_timeout(400)
        await pg.click('#fxVoiceRec'); await pg.wait_for_timeout(300)
        print('two speakers', await pg.evaluate("document.querySelectorAll('#vrMouth option').length===2"))
        await pg.select_option('#vrMouth', index=1)
        await pg.click('#vrGo'); await pg.wait_for_timeout(3300); await pg.screenshot(path='thu_giong_dang_thu.png')
        await pg.click('#vrGo'); await pg.wait_for_function("!document.querySelector('#vrPlay').hidden", timeout=10000)
        await pg.screenshot(path='thu_giong.png')
        print('msg', await pg.evaluate("document.querySelector('#vrMsg').textContent"))
        await pg.click('.dlg .btns >> text=✓ Dùng giọng này'); await pg.wait_for_timeout(1500)
        info = await pg.evaluate("""(async()=>{const c=voiceClips(); if(c.length!==1) return null; const ac=new OfflineAudioContext(1,44100,44100); const bb=await ac.decodeAudioData(c[0].buf.slice(0));
          return {dur:bb.duration, frame:S.frames.findIndex(f=>f.id===c[0].frameId), mouth:ppPart(c[0].mouth).name, name:c[0].name}})()""")
        print('clip', info)
        print('trimmed to the speech', info and 0.9 < info['dur'] < 1.6)
        print('starts at current frame', info and info['frame'] == 1)
        print('picked speaker', info and info['mouth'] == 'Miệng B')
        print('lip synced', await pg.evaluate("(()=>{const id=voiceClips()[0].mouth; return S.frames.some(f=>f.lip&&f.lip.m&&f.lip.m[id]>0) && !S.frames[0].lip?.m?.[id]})()"))
        # untrimmed keeps everything; Huỷ adds nothing
        await pg.click('#fxVoiceRec'); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Huỷ'); await pg.wait_for_timeout(300)
        print('cancel adds nothing', await pg.evaluate("voiceClips().length===1"))
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
