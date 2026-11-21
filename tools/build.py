# Build: src/index.html -> index.html (+ sw.js, manifest, icons) at repo root.
# Usage: python3 tools/build.py
import os, shutil, json, time, zipfile
from PIL import Image, ImageDraw
import sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # repo root = what GitHub Pages serves
SRC=os.path.join(ROOT,'src'); DIST=ROOT
VERSION=time.strftime('%Y.%m.%d-%H%M')
os.makedirs(DIST+'/icons', exist_ok=True)
# --- icons ---
def icon(size, maskable=False):
    im=Image.new('RGBA',(size,size),(20,21,25,255)); d=ImageDraw.Draw(im); s=size/512
    pad = 0 if maskable else 0
    if not maskable:
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im)
        d.rounded_rectangle((0,0,size-1,size-1), radius=int(110*s), fill=(20,21,25,255))
    Y=(255,178,30,255); W_=int(26*s)
    d.ellipse((206*s,86*s,306*s,186*s), outline=Y, width=W_)                     # head
    d.line((256*s,190*s,256*s,330*s), fill=Y, width=W_)                          # body
    d.line((256*s,230*s,150*s,170*s), fill=Y, width=W_)                          # arm up (waving)
    d.line((256*s,230*s,360*s,290*s), fill=Y, width=W_)                          # arm
    d.line((256*s,330*s,190*s,430*s), fill=Y, width=W_); d.line((256*s,330*s,330*s,420*s), fill=Y, width=W_)
    for (x,y) in [(150,170),(360,290),(190,430),(330,420),(256,230),(256,330)]: d.ellipse(((x-17)*s,(y-17)*s,(x+17)*s,(y+17)*s), fill=(255,255,255,255))
    d.rounded_rectangle((330*s,96*s,430*s,156*s), radius=int(12*s), fill=(255,59,154,255))   # little "frame" tag
    return im
icon(192).save(DIST+'/icons/icon-192.png'); icon(512).save(DIST+'/icons/icon-512.png')
icon(512, True).save(DIST+'/icons/icon-maskable-512.png'); icon(180, True).convert('RGB').save(DIST+'/icons/apple-touch-icon.png')
# --- manifest ---
json.dump({"name":"Frame Studio","short_name":"Frame Studio","description":"Làm hoạt hình Shorts từ ảnh nhân vật trên tablet","start_url":"./","scope":"./","display":"standalone","orientation":"any",
  "background_color":"#141519","theme_color":"#141519","lang":"vi",
  "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
           {"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]},
  open(DIST+'/manifest.webmanifest','w',encoding='utf-8'), ensure_ascii=False, indent=2)
# --- index.html ---
html=open(SRC+'/index.html',encoding='utf-8').read().replace('__APP_VERSION__', VERSION)
head='''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#141519">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-title" content="Frame Studio">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
'''
html=html.replace('<title>Frame Studio</title>', '<title>Frame Studio</title>\n'+head, 1)
open(DIST+'/index.html','w',encoding='utf-8').write(html)
# --- service worker ---
sw = f"""// Frame Studio service worker — version {VERSION}
const VERSION = '{VERSION}';
const CORE = 'fs-core-' + VERSION, RUNTIME = 'fs-runtime';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './ort.wasm.min.js', './ort-wasm-simd-threaded.mjs'];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES))); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fs-core-') && k !== CORE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('message', e => {{ if (e.data === 'skipWaiting') self.skipWaiting(); }});
self.addEventListener('fetch', e => {{
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // GitHub sync / Gemini API: always live, never from the cache
  // the page itself: network first (so updates arrive), fall back to cache when offline
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')))) {{
    e.respondWith(fetch(req).then(r => {{ const cp = r.clone(); caches.open(CORE).then(c => c.put('./index.html', cp)); return r; }}).catch(() => caches.match('./index.html', {{ ignoreSearch: true }})));
    return;
  }}
  // everything else (AI models, wasm, fonts): cache first, saved the first time it is used
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(r => {{
    if (r && (r.ok || r.type === 'opaque')) {{ const cp = r.clone(); const big = /migan|u2netp|\\.wasm$/.test(url.pathname); caches.open(big ? RUNTIME : CORE).then(c => c.put(req, cp)); }}
    return r;
  }})));
}});
"""
open(DIST+'/sw.js','w',encoding='utf-8').write(sw)
open(DIST+'/.nojekyll','w').write('')
print('built', VERSION)
