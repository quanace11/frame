"""Build the app into dist/ (what GitHub Pages serves).

    python3 tools/build.py            # -> dist/
    python3 tools/build.py --check    # build + syntax-check the joined script with node (if installed)

src/index.html is the page shell. Every
    <link rel="stylesheet" href="css/X.css">   becomes an inline <style>,
    <script src="js/…/X.js"></script>         (all of them, in order) become ONE inline <script>,
so the published app is still a single index.html that works offline (no CDN, no extra requests).
The JS files share one script scope exactly like before the split: order in src/index.html matters.

vendor/ (onnxruntime) and models/ (AI models) are copied to the ROOT of dist/, so the published URLs
(./ort.wasm.min.js, ./u2netp-model.js, ./migan-1.js …) did not change and installed apps keep their cache.
Needs Pillow (icons)."""
import os, re, sys, json, time, shutil, subprocess
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.abspath(os.environ.get('FS_DIST') or os.path.join(ROOT, 'dist'))   # FS_DIST: build somewhere else (test19)
VERSION = time.strftime('%Y.%m.%d-%H%M')

def read(p):
    t = open(p, encoding='utf-8').read()
    return t[:-1] if t.endswith('\n') else t

# ---------- index.html ----------
def build_html():
    html = read(os.path.join(SRC, 'index.html'))
    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
                  lambda m: '<style>' + ('\n' if m.group(1) != 'css/fonts.css' else '') + read(os.path.join(SRC, m.group(1))) + ('\n' if m.group(1) != 'css/fonts.css' else '') + '</style>', html)
    tags = re.findall(r'^<script src="(js/[^"]+)"></script>\n?', html, flags=re.M)
    if not tags: sys.exit('build: no <script src="js/…"> in src/index.html')
    for t in tags:
        if not os.path.isfile(os.path.join(SRC, t)): sys.exit('build: missing ' + t)
    js = '\n'.join(read(os.path.join(SRC, t)) for t in tags)
    first = True
    def repl(m):
        nonlocal first
        if first: first = False; return '<script>\n' + js + '\n</script>\n'
        return ''
    html = re.sub(r'^<script src="js/[^"]+"></script>\n?', repl, html, flags=re.M)
    html = html.replace('__APP_VERSION__', VERSION)
    head = '''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#141519">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-title" content="Frame Studio">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
'''
    html = html.replace('<title>Frame Studio</title>', '<title>Frame Studio</title>\n' + head, 1)
    return html, js

# ---------- icons + manifest ----------
def icon(size, maskable=False):
    s = size / 512
    if maskable:
        im = Image.new('RGBA', (size, size), (20, 21, 25, 255)); d = ImageDraw.Draw(im)
    else:
        im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(110 * s), fill=(20, 21, 25, 255))
    Y = (255, 178, 30, 255); W_ = int(26 * s)
    d.ellipse((206*s, 86*s, 306*s, 186*s), outline=Y, width=W_)                   # head
    d.line((256*s, 190*s, 256*s, 330*s), fill=Y, width=W_)                        # body
    d.line((256*s, 230*s, 150*s, 170*s), fill=Y, width=W_)                        # arm up (waving)
    d.line((256*s, 230*s, 360*s, 290*s), fill=Y, width=W_)                        # arm
    d.line((256*s, 330*s, 190*s, 430*s), fill=Y, width=W_); d.line((256*s, 330*s, 330*s, 420*s), fill=Y, width=W_)
    for (x, y) in [(150, 170), (360, 290), (190, 430), (330, 420), (256, 230), (256, 330)]:
        d.ellipse(((x-17)*s, (y-17)*s, (x+17)*s, (y+17)*s), fill=(255, 255, 255, 255))
    d.rounded_rectangle((330*s, 96*s, 430*s, 156*s), radius=int(12*s), fill=(255, 59, 154, 255))   # little "frame" tag
    return im

MANIFEST = {"name": "Frame Studio", "short_name": "Frame Studio", "description": "Làm hoạt hình Shorts từ ảnh nhân vật trên tablet",
            "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
            "background_color": "#141519", "theme_color": "#141519", "lang": "vi",
            "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
                      {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
                      {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}

# ---------- service worker ----------
SW = """// Frame Studio service worker — version {V}
const VERSION = '{V}';
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
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {{
    e.respondWith(fetch(req).then(r => {{ const cp = r.clone(); caches.open(CORE).then(c => c.put('./index.html', cp)); return r; }}).catch(() => caches.match('./index.html', {{ ignoreSearch: true }})));
    return;
  }}
  // everything else (AI models, wasm): cache first, saved the first time it is used
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(r => {{
    if (r && (r.ok || r.type === 'opaque')) {{ const cp = r.clone(); const big = /migan|u2netp|\\.wasm$/.test(url.pathname); caches.open(big ? RUNTIME : CORE).then(c => c.put(req, cp)); }}
    return r;
  }})));
}});
"""

def place(src, dst):
    """copy a big file into dist/ (hard link when possible: no 50 MB copy on every build)"""
    if os.path.exists(dst):
        if os.path.samefile(src, dst) or (os.path.getsize(src) == os.path.getsize(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)): return
        os.remove(dst)
    try: os.link(src, dst)
    except OSError: shutil.copy2(src, dst)

def main():
    html, js = build_html()
    if '--check' in sys.argv and shutil.which('node'):
        tmp = os.path.join(DIST, '.app-check.js'); os.makedirs(DIST, exist_ok=True)
        open(tmp, 'w', encoding='utf-8').write(js)
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.remove(tmp)
        if r.returncode: sys.exit('build: JS syntax error\n' + r.stderr)
    os.makedirs(os.path.join(DIST, 'icons'), exist_ok=True)
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(html + '\n')
    open(os.path.join(DIST, 'sw.js'), 'w', encoding='utf-8').write(SW.format(V=VERSION))
    json.dump(MANIFEST, open(os.path.join(DIST, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    icon(192).save(os.path.join(DIST, 'icons/icon-192.png')); icon(512).save(os.path.join(DIST, 'icons/icon-512.png'))
    icon(512, True).save(os.path.join(DIST, 'icons/icon-maskable-512.png')); icon(180, True).convert('RGB').save(os.path.join(DIST, 'icons/apple-touch-icon.png'))
    open(os.path.join(DIST, '.nojekyll'), 'w').write('')
    for d in ('vendor/onnxruntime', 'models'):
        for f in sorted(os.listdir(os.path.join(ROOT, d))):
            place(os.path.join(ROOT, d, f), os.path.join(DIST, f))
    print('built', VERSION, '->', os.path.relpath(DIST, ROOT))

if __name__ == '__main__':
    main()
