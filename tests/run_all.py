"""Run the regression tests against the BUILT app in dist/.

    python3 tests/run_all.py                 # build, then every test, 4 at a time
    python3 tests/run_all.py test5 test22    # only these
    python3 tests/run_all.py -j 1            # one at a time (slow machine)
    python3 tests/run_all.py --no-build      # use dist/ as it is
    python3 tests/run_all.py --shard 2/4     # CI: the 2nd quarter of the tests

Needs: pip install playwright pillow  (+ Chrome; set CHROME=/path if it is not /usr/bin/google-chrome).
Every test serves dist/ on its own port, so they can run side by side."""
import os, re, sys, time, subprocess
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
args = sys.argv[1:]; jobs = 4; shard = None; build = True; names = []
while args:
    a = args.pop(0)
    if a == '-j': jobs = int(args.pop(0))
    elif a.startswith('-j'): jobs = int(a[2:])
    elif a == '--shard': shard = args.pop(0)
    elif a == '--no-build': build = False
    else: names.append(a[:-3] if a.endswith('.py') else a)

def key(s): return (0, int(s[4:])) if s[4:].isdigit() else (1, s)
# tests are test<N>.py (old ones) or test_<name>.py (new ones: a name never clashes between branches)
if not names:
    names = sorted((f[:-3] for f in os.listdir(HERE) if re.fullmatch(r'test(\d+|_\w+)\.py', f)), key=key)
if shard:
    k, n = map(int, shard.split('/')); names = names[k - 1::n]

if build:
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), '--check'], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip())
    if r.returncode: sys.exit(1)

def run(n):
    t0 = time.time()
    try:
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, n + '.py')], capture_output=True, text=True, timeout=900)
        out = (r.stdout + r.stderr).strip().splitlines(); code = r.returncode
    except subprocess.TimeoutExpired:
        out, code = ['TIMEOUT'], -1
    last = out[-1] if out else ''
    ok = code == 0 and bool(re.search(r"ERR(ORS)? \[\]$", last))
    print(('OK  ' if ok else 'FAIL'), n, f'({time.time() - t0:.0f}s)', '|', last[:150], flush=True)
    if not ok:   # keep the whole output of a failed test: it is what you need to fix it
        os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
        open(os.path.join(HERE, 'out', n + '.log'), 'w', encoding='utf-8').write('\n'.join(out))
    return n, ok

t0 = time.time()
with ThreadPoolExecutor(max(1, jobs)) as ex:
    res = list(ex.map(run, names))
bad = [n for n, ok in res if not ok]
print(f'\n{len(names) - len(bad)}/{len(names)} passed in {time.time() - t0:.0f}s')
print('All passed' if not bad else f'Failed: {bad}  (logs: tests/out/<name>.log)')
sys.exit(1 if bad else 0)
