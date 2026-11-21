"""Run every regression test against the BUILT app at the repo root.
Usage:  python3 tools/build.py && python3 tests/run_all.py [test5 test21 ...]
Needs:  pip install playwright  (+ a Chrome/Chromium; set CHROME=/path if not /usr/bin/google-chrome)"""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
names = sys.argv[1:] or sorted((f[:-3] for f in os.listdir(HERE) if re.fullmatch(r'test(\d+|_\w+)\.py', f)), key=lambda s: (0, int(s[4:])) if s[4:].isdigit() else (1, s))
bad = []
for n in names:
    r = subprocess.run([sys.executable, '-I', os.path.join(HERE, n + '.py')], capture_output=True, text=True, timeout=900)
    out = (r.stdout + r.stderr).strip().splitlines()
    last = out[-1] if out else ''
    ok = r.returncode == 0 and re.search(r"ERR(ORS)? \[\]$", last)
    print(('OK  ' if ok else 'FAIL'), n, '|', last[:150]); ok or bad.append(n)
print('\nAll passed' if not bad else f'\nFailed: {bad}'); sys.exit(1 if bad else 0)
