import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8876'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
# 🧍 Character library: save a cut-out character, add it to another project (twice), undo, keep after reload, delete.
SIG = "S.pp?S.pp.parts.map(p=>[p.role,p.c.width,p.c.height,(p.alts||[]).length]).sort((a,b)=>(a[0]+a[1]).localeCompare(b[0]+b[1])):[]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("new MutationObserver(()=>document.querySelectorAll('.tabhide').forEach(e=>e.classList.remove('tabhide'))).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class']})")
        await pg.goto('http://localhost:8876/index.html'); await pg.wait_for_timeout(800); await pg.click('text=Bắt đầu vẽ')
        await pg.set_input_files('#imgFile', os.path.join(ASSETS, 'drawn_char.png')); await pg.wait_for_timeout(400)
        await pg.click('[data-mode=pp]'); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.querySelector('#impBusy').hidden", timeout=180000); await pg.wait_for_timeout(500)
        await pg.click('.dlg .btns >> text=Dùng'); await pg.wait_for_timeout(600)
        await pg.click('#ppCutAuto'); await pg.click('#ppLabCut'); await pg.wait_for_function('S.pp && S.pp.parts.length', timeout=180000); await pg.wait_for_timeout(300)
        # give the head an extra picture (like a mouth/eye set) so alts are saved too
        await pg.evaluate("ppSel=ppByRole('head').id; openTab('pp','parts'); ppSyncBar()")
        await pg.click('#ppVarDup'); await pg.wait_for_timeout(300)
        sig0 = await pg.evaluate(SIG); n0 = len(sig0); print('parts', n0)
        await pg.click('#ppLibSave'); await pg.wait_for_timeout(200); await pg.fill('#chName', 'Bé Na'); await pg.click('.dlg .btns >> text=💾 Lưu'); await pg.wait_for_timeout(500)
        L = await pg.evaluate("charLib().then(L=>L.map(e=>[e.name,e.n,!!e.thumb]))"); print('saved', L == [['Bé Na', n0, True]])
        # another project with 3 frames, editing frame 2: the character appears from there on
        await pg.evaluate("(async()=>{newProject(W,H);})()"); await pg.wait_for_timeout(300)
        await pg.evaluate("(async()=>{for(let k=0;k<2;k++){const f=newFrameObj(S.bgs[0].id); S.frames.push(f); loaded.push(f);} S.cur=1; buildStrip(); updateFrameUI(); setTool('puppet'); ppSyncBar();})()"); await pg.wait_for_timeout(300)
        print('empty project', await pg.evaluate("S.pp===null && !$('#ppEmpty').hidden"))
        await pg.click('#ppLibBtn0'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='kho_nhan_vat.png')
        await pg.click('.ch-item [data-a=add]'); await pg.wait_for_timeout(1200)
        sig1 = await pg.evaluate(SIG); print('same pieces', sig1 == sig0)
        print('hidden before cur', await pg.evaluate("S.pp.parts.every(p=>S.frames[0].pp[p.id]&&S.frames[0].pp[p.id].h) && S.pp.parts.every(p=>!(S.frames[1].pp[p.id]||{}).h)"))
        print('roles linked', await pg.evaluate("(()=>{const ids=new Set(S.pp.parts.map(p=>p.id)); return S.pp.parts.filter(p=>!p.parent).length===1 && S.pp.parts.every(p=>!p.parent||ids.has(p.parent)) && !!ppByRole('armL') && !!ppPart(ppByRole('armL').parent)})()"))
        await pg.wait_for_timeout(600)
        # second copy: new ids, its own NV2 name, one more root
        await pg.evaluate("charLib().then(L=>charLibAdd(L[0].id))"); await pg.wait_for_timeout(1200)
        print('two characters', await pg.evaluate(f"S.pp.parts.length==={2*n0} && S.pp.parts.filter(p=>!p.parent).length===2 && new Set(S.pp.parts.map(p=>p.id)).size==={2*n0} && S.pp.parts.some(p=>/\\(NV2\\)$/.test(p.name))"))
        await pg.wait_for_timeout(700)
        await pg.evaluate("undo()"); await pg.wait_for_timeout(500)
        print('undo removes copy', await pg.evaluate(f"S.pp.parts.length==={n0}"))
        await pg.evaluate("saveProject()"); await pg.wait_for_timeout(800)
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('project kept', await pg.evaluate(f"!!S.pp && S.pp.parts.length==={n0}"))
        print('library kept', await pg.evaluate("charLib().then(L=>L.length===1)"))
        await pg.evaluate("setTool('puppet'); openTab('pp','parts'); ppSyncBar()")
        await pg.click('#ppLibBtn'); await pg.wait_for_timeout(500)
        await pg.click('.ch-item [data-a=del]'); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Xoá'); await pg.wait_for_timeout(400)
        k = await pg.evaluate("charLib().then(async L=>[L.length, await idbGet('char:x')])")
        print('deleted', k[0] == 0)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
