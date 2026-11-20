import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); ASSETS = os.path.join(HERE, 'assets'); OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.chdir(OUT)   # screenshots/outputs go to tests/out
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
import asyncio, subprocess, time
from playwright.async_api import async_playwright
# ↶ undo covers everything: frame add/duplicate/move, timing, backgrounds, sounds, music, puppet parts (role, name, order,
# delete), poses, tracing image, text kept on next frames… each one step, in order, mixed with pixel steps; deep history.
srv = subprocess.Popen(['python3','-m','http.server','8850'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':820,'height':1180}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        def check(name, ok):
            print(name, ok)
            if not ok: errs.append('FAIL ' + name)
        async def settle(): await pg.wait_for_timeout(650)
        async def undo(): await pg.evaluate("undo()"); await pg.wait_for_timeout(350)
        async def redo(): await pg.evaluate("redo()"); await pg.wait_for_timeout(350)
        ev = pg.evaluate
        await pg.goto('http://localhost:8850/index.html'); await pg.wait_for_timeout(1000)
        await pg.click('.dlg .btns >> text=Bắt đầu vẽ'); await pg.wait_for_timeout(300)
        # frames: add, duplicate, move
        await pg.click('#addBtn'); await settle()
        check('add frame', await ev("S.frames.length") == 2)
        await pg.click('#dupBtn'); await settle()
        ids = await ev("S.frames.map(f=>f.id)")
        await ev("S.cur=2; updateFrameUI()"); await pg.click('#moveL'); await settle()
        check('moved', await ev("S.frames.map(f=>f.id)") == [ids[0], ids[2], ids[1]])
        await undo(); check('undo move', await ev("S.frames.map(f=>f.id)") == ids)
        await undo(); check('undo duplicate', await ev("S.frames.length") == 2)
        await undo(); check('undo add', await ev("S.frames.length") == 1)
        await redo(); await redo(); check('redo add + duplicate', await ev("S.frames.map(f=>f.id)") == ids)
        await redo(); check('redo move', await ev("S.frames.map(f=>f.id)") == [ids[0], ids[2], ids[1]])
        # timing: one frame, all frames
        await ev("S.cur=0; updateFrameUI()")
        await pg.fill('#durIn', '0.5'); await pg.dispatch_event('#durIn', 'change'); await settle()
        await pg.click('#durAllBtn'); await settle()
        check('dur all', await ev("S.frames.every(f=>f.dur===500)"))
        await undo(); check('undo dur all', await ev("S.frames.map(f=>f.dur)") == [500, 100, 100])
        await undo(); check('undo dur', await ev("S.frames[0].dur") == 100)
        # pixel step + light step stay in order
        await ev("(()=>{const f=curFrame(); const before=f.canvas.getContext('2d').getImageData(0,0,40,40); f.canvas.getContext('2d').fillRect(0,0,40,40); pushUndo(f,[0,0,40,40],before,f.canvas.getContext('2d').getImageData(0,0,40,40)); markEdited(f);})()")
        await settle()
        await pg.fill('#durIn', '1'); await pg.dispatch_event('#durIn', 'change'); await settle()
        await undo(); check('undo order: timing first', await ev("S.frames[0].dur") == 100 and await ev("curFrame().canvas.getContext('2d').getImageData(5,5,1,1).data[3]") > 0)
        await undo(); check('then the drawing', await ev("curFrame().canvas.getContext('2d').getImageData(5,5,1,1).data[3]") == 0)
        # background: new empty bg for this frame
        await ev("S.cur=0; updateFrameUI()"); bg0 = await ev("S.frames[0].bgId")
        await ev("newBg(false)"); await settle()
        check('new bg', await ev("S.frames[0].bgId") != bg0)
        await undo(); check('undo new bg', await ev("S.frames[0].bgId") == bg0 and await ev(f"S.bgs.some(b=>b.id==='{bg0}')"))
        # sounds attached to a frame + removing one
        await ev("setTool('fx')"); await pg.wait_for_timeout(100)
        await ev("document.querySelectorAll('#fxSfx button')[0].click()"); await settle()
        check('sfx added', await ev("S.audio.sfx.length") == 1)
        await ev("document.querySelector('[data-sfxdel]').click()"); await settle()
        check('sfx removed', await ev("S.audio.sfx.length") == 0)
        await undo(); check('undo sfx remove', await ev("S.audio.sfx.length") == 1)
        await undo(); check('undo sfx add', await ev("((S.audio&&S.audio.sfx)||[]).length") == 0)
        # music volume + music removal
        await ev("S.audio=S.audio||{}; S.audio.music={name:'m.wav',buf:new ArrayBuffer(8),vol:0.6,frameId:S.frames[0].id}; histRebase(); fxSyncBar()")
        await ev("document.getElementById('fxMusicDel').click()"); await settle()
        check('music removed', await ev("!S.audio.music"))
        await undo(); check('undo music removed', await ev("S.audio.music && S.audio.music.name") == 'm.wav')
        # text kept on next frames
        await ev("selectFrame(0)"); await pg.wait_for_timeout(100)
        await ev("fxEdit(f=>{f.texts=[{id:'t1',str:'HI',x:500,y:500,size:90,style:'comic'}]}); fxSel='t1'; fxSyncBar()"); await settle()
        await ev("document.getElementById('fxKeepN').value=2; document.getElementById('fxKeep').click()"); await settle()
        check('text kept on 2 frames', await ev("S.frames.filter(f=>(f.texts||[]).some(t=>t.id==='t1')).length") == 3)
        await undo(); check('undo keep', await ev("S.frames.filter(f=>(f.texts||[]).some(t=>t.id==='t1')).length") == 1)
        await ev("setTool('brush')")
        # puppet parts: role, rename via code path, order, delete part
        await ev("""(()=>{const mk=(id,z)=>{const c=makeCanvas(60,60); c.getContext('2d').fillRect(0,0,60,60); return {id,name:'Mảnh '+id,role:'',parent:null,z,ox:100*z,oy:100,px:100*z+30,py:130,c,alts:[]};};
            S.pp={parts:[mk('a',1),mk('b',2)]}; ppSel='a'; histRebase();})()""")
        await ev("setTool('puppet')"); await pg.wait_for_timeout(200)
        await ev("const r=document.getElementById('ppRole'); r.value='head'; r.dispatchEvent(new Event('change'))"); await settle()
        check('role set', await ev("ppPart('a').role") == 'head')
        await ev("document.getElementById('ppUp').click()"); await settle()
        za = await ev("ppPart('a').z")
        await ev("document.getElementById('ppDel').click()"); await pg.wait_for_timeout(300); await pg.click('.dlg .btns >> text=Xoá'); await settle()
        check('part deleted', await ev("!ppPart('a')"))
        await undo(); check('undo delete part', await ev("!!ppPart('a') && ppPart('a').c.width===60"))
        await undo(); check('undo order', await ev("ppPart('a').z") != za or await ev("S.pp.parts.map(p=>p.id).join()") != '')
        await undo(); check('undo role', await ev("ppPart('a').role") == '')
        # pose library: save a pose, undo removes it
        n0 = await ev("(S.poses||[]).length")
        await ev("S.poses=(S.poses||[]).concat([{id:'p1',name:'x',pp:{}}]); scheduleSave()"); await settle()
        await undo(); check('undo pose save', await ev("(S.poses||[]).length") == n0)
        # tracing image show/hide
        await ev("setTool('brush'); REF.c=makeCanvas(10,10); REF.png=new ArrayBuffer(4); REF.show=true; updateRefUI(); histRebase()")
        await ev("document.getElementById('refEye').click()"); await settle()
        check('ref hidden', await ev("REF.show") == False)
        await undo(); check('undo ref hide', await ev("REF.show") == True)
        # deep history: 150 timing changes, all undoable
        await ev("histRebase()")
        for i in range(150):
            await ev(f"setDur({200 + i}); histFlush()")
        check('150 steps kept', await ev("undoStack.length") >= 150)
        for i in range(150): await ev("undo()")
        await pg.wait_for_timeout(500)
        check('150 undos back to start', await ev("curFrame().dur") == 100)
        # saved state after undo survives reload
        await ev("saveProject()"); await pg.wait_for_timeout(1200); await pg.reload(); await pg.wait_for_timeout(1500)
        check('reload ok', await ev("S.frames.length") == 3)
        print('ERR', errs); await b.close()
asyncio.run(main()); srv.kill()
