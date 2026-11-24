#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PenPad - biến tablet Android + bút cảm ứng thành bảng vẽ cho PC (miễn phí).

  Tablet (Chrome)  --WebSocket qua cáp USB (adb reverse) hoặc Wi-Fi-->  PC (file này)
  PC giả lập bút Windows Ink (có lực nhấn + độ nghiêng) bằng InjectSyntheticPointerInput.

Không cần cài thêm thư viện: chỉ cần Python 3.8+.
Chạy:  python penpad_server.py            (USB, an toàn nhất)
       python penpad_server.py --wifi     (thêm Wi-Fi, có mã bảo vệ)
       python penpad_server.py --mouse    (ép dùng chế độ chuột, không lực nhấn)
"""
import argparse
import asyncio
import base64
import ctypes
import hashlib
import json
import os
import secrets
import shutil
import socket
import struct
import subprocess
import sys
import urllib.parse

VERSION = "1.1"
HERE = os.path.dirname(os.path.abspath(__file__))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
OUT, HOVER, CONTACT = 0, 1, 2  # trạng thái bút trong giao thức

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------
# Bàn phím: phân tích tổ hợp phím kiểu "ctrl+shift+z"
# --------------------------------------------------------------------------
VK = {
    "ctrl": 0x11, "control": 0x11, "shift": 0x10, "alt": 0x12, "win": 0x5B,
    "space": 0x20, "tab": 0x09, "esc": 0x1B, "escape": 0x1B, "enter": 0x0D,
    "backspace": 0x08, "delete": 0x2E, "del": 0x2E, "insert": 0x2D,
    "home": 0x24, "end": 0x23, "pageup": 0x21, "pagedown": 0x22,
    "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
    "[": 0xDB, "]": 0xDD, "-": 0xBD, "=": 0xBB, "+": 0xBB, ",": 0xBC,
    ".": 0xBE, "/": 0xBF, ";": 0xBA, "'": 0xDE, "`": 0xC0, "\\": 0xDC,
}
for _i in range(1, 13):
    VK["f%d" % _i] = 0x6F + _i
EXTENDED = {0x2E, 0x2D, 0x24, 0x23, 0x21, 0x22, 0x26, 0x28, 0x25, 0x27, 0x5B}
MODS = {"ctrl", "control", "shift", "alt", "win"}


def parse_combo(combo):
    c = combo.strip().lower()
    if not c:
        return []
    if c == "+":
        return ["+"]
    trailing_plus = c.endswith("++")
    if trailing_plus:
        c = c[:-2]
    parts = [p.strip() for p in c.split("+") if p.strip()]
    if trailing_plus:
        parts.append("+")
    return parts


# --------------------------------------------------------------------------
# Backend gốc
# --------------------------------------------------------------------------
class Backend:
    name = "dummy"

    def __init__(self):
        self._held = set()

    def monitors(self):
        return [{"x": 0, "y": 0, "w": 1920, "h": 1080, "primary": True}]

    def pen(self, state, x, y, pressure, tx, ty, barrel, eraser):
        pass

    def _key_raw(self, name, down):
        pass

    def key(self, combo, action):
        parts = parse_combo(combo)
        if not parts:
            return
        if action in ("tap", "down"):
            for p in parts:
                self._key_raw(p, True)
        if action in ("tap", "up"):
            for p in reversed(parts):
                self._key_raw(p, False)
        if action == "down":
            self._held.add(combo)
        elif action == "up":
            self._held.discard(combo)

    def release_all(self):
        for combo in list(self._held):
            self.key(combo, "up")
        self._held.clear()


class DummyBackend(Backend):
    name = "dummy"

    def __init__(self):
        super().__init__()
        self._last = None

    def pen(self, state, x, y, pressure, tx, ty, barrel, eraser):
        if state != self._last:
            log("[thử] bút:", ["rời", "lơ lửng", "chạm"][state], x, y, "lực", pressure)
            self._last = state

    def key(self, combo, action):
        log("[thử] phím:", combo, action)
        super().key(combo, action)


# --------------------------------------------------------------------------
# Windows
# --------------------------------------------------------------------------
class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int32), ("y", ctypes.c_int32)]


class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_int32), ("top", ctypes.c_int32),
                ("right", ctypes.c_int32), ("bottom", ctypes.c_int32)]


class POINTER_INFO(ctypes.Structure):
    _fields_ = [
        ("pointerType", ctypes.c_uint32),
        ("pointerId", ctypes.c_uint32),
        ("frameId", ctypes.c_uint32),
        ("pointerFlags", ctypes.c_uint32),
        ("sourceDevice", ctypes.c_void_p),
        ("hwndTarget", ctypes.c_void_p),
        ("ptPixelLocation", POINT),
        ("ptHimetricLocation", POINT),
        ("ptPixelLocationRaw", POINT),
        ("ptHimetricLocationRaw", POINT),
        ("dwTime", ctypes.c_uint32),
        ("historyCount", ctypes.c_uint32),
        ("InputData", ctypes.c_int32),
        ("dwKeyStates", ctypes.c_uint32),
        ("PerformanceCount", ctypes.c_uint64),
        ("ButtonChangeType", ctypes.c_int),
    ]


class POINTER_PEN_INFO(ctypes.Structure):
    _fields_ = [
        ("pointerInfo", POINTER_INFO),
        ("penFlags", ctypes.c_uint32),
        ("penMask", ctypes.c_uint32),
        ("pressure", ctypes.c_uint32),
        ("rotation", ctypes.c_uint32),
        ("tiltX", ctypes.c_int32),
        ("tiltY", ctypes.c_int32),
    ]


class POINTER_TOUCH_INFO(ctypes.Structure):
    _fields_ = [
        ("pointerInfo", POINTER_INFO),
        ("touchFlags", ctypes.c_uint32),
        ("touchMask", ctypes.c_uint32),
        ("rcContact", RECT),
        ("rcContactRaw", RECT),
        ("orientation", ctypes.c_uint32),
        ("pressure", ctypes.c_uint32),
    ]


class _PTI_UNION(ctypes.Union):
    _fields_ = [("touchInfo", POINTER_TOUCH_INFO), ("penInfo", POINTER_PEN_INFO)]


class POINTER_TYPE_INFO(ctypes.Structure):
    _anonymous_ = ("u",)
    _fields_ = [("type", ctypes.c_uint32), ("u", _PTI_UNION)]


PT_PEN = 3
POINTER_FEEDBACK_DEFAULT = 1
PF_INRANGE, PF_INCONTACT, PF_FIRSTBUTTON = 0x2, 0x4, 0x10
PF_DOWN, PF_UPDATE, PF_UP = 0x10000, 0x20000, 0x40000
PEN_FLAG_BARREL, PEN_FLAG_INVERTED, PEN_FLAG_ERASER = 0x1, 0x2, 0x4
PEN_MASK_PRESSURE, PEN_MASK_TILT_X, PEN_MASK_TILT_Y = 0x1, 0x4, 0x8
CHANGE_NONE, CHANGE_FIRST_DOWN, CHANGE_FIRST_UP = 0, 1, 2


class WindowsBase(Backend):
    def __init__(self):
        super().__init__()
        self.user32 = ctypes.WinDLL("user32", use_last_error=True)
        self._dpi_aware()
        self.user32.keybd_event.argtypes = [ctypes.c_ubyte, ctypes.c_ubyte, ctypes.c_uint32, ctypes.c_void_p]

    def _dpi_aware(self):
        try:
            self.user32.SetProcessDpiAwarenessContext.restype = ctypes.c_int
            if self.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4)):
                return
        except Exception:
            pass
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
            return
        except Exception:
            pass
        try:
            self.user32.SetProcessDPIAware()
        except Exception:
            pass

    def monitors(self):
        mons = []
        PROC = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p,
                                  ctypes.POINTER(RECT), ctypes.c_void_p)

        def cb(hmon, hdc, lprc, data):
            r = lprc.contents
            mons.append({"x": r.left, "y": r.top, "w": r.right - r.left,
                         "h": r.bottom - r.top, "primary": r.left == 0 and r.top == 0})
            return 1

        self.user32.EnumDisplayMonitors(None, None, PROC(cb), None)
        mons.sort(key=lambda m: (not m["primary"], m["x"], m["y"]))
        return mons or super().monitors()

    def _key_raw(self, name, down):
        vk = VK.get(name)
        if vk is None:
            if len(name) == 1 and name.isalnum():
                vk = ord(name.upper())
            else:
                return
        flags = (0x1 if vk in EXTENDED else 0) | (0 if down else 0x2)
        self.user32.keybd_event(vk, 0, flags, None)


class WindowsPen(WindowsBase):
    name = "windows-pen"

    def __init__(self):
        super().__init__()
        u = self.user32
        u.CreateSyntheticPointerDevice.restype = ctypes.c_void_p
        u.CreateSyntheticPointerDevice.argtypes = [ctypes.c_uint32, ctypes.c_uint32, ctypes.c_uint32]
        u.InjectSyntheticPointerInput.restype = ctypes.c_int
        u.InjectSyntheticPointerInput.argtypes = [ctypes.c_void_p, ctypes.POINTER(POINTER_TYPE_INFO), ctypes.c_uint32]
        self.dev = u.CreateSyntheticPointerDevice(PT_PEN, 1, POINTER_FEEDBACK_DEFAULT)
        if not self.dev:
            raise OSError("CreateSyntheticPointerDevice lỗi %d" % ctypes.get_last_error())
        self.state = OUT
        self.frame = 0
        self.last = (0, 0, 0, 0, 0, 0)
        self.errors = 0

    def _inject(self, flags, x, y, pressure, tx, ty, penflags, change=CHANGE_NONE):
        info = POINTER_TYPE_INFO()
        info.type = PT_PEN
        pen = info.penInfo
        pi = pen.pointerInfo
        pi.pointerType = PT_PEN
        pi.pointerId = 0
        self.frame = (self.frame + 1) & 0xFFFFFFFF
        pi.frameId = self.frame
        pi.pointerFlags = flags
        pi.ptPixelLocation.x = x
        pi.ptPixelLocation.y = y
        pi.ButtonChangeType = change
        pen.penFlags = penflags
        pen.penMask = PEN_MASK_PRESSURE | PEN_MASK_TILT_X | PEN_MASK_TILT_Y
        pen.pressure = pressure
        pen.tiltX = tx
        pen.tiltY = ty
        if not self.user32.InjectSyntheticPointerInput(self.dev, ctypes.byref(info), 1):
            self.errors += 1
            if self.errors <= 5 or self.errors % 500 == 0:
                log("! Inject lỗi %d (lần %d)" % (ctypes.get_last_error(), self.errors))

    def pen(self, state, x, y, pressure, tx, ty, barrel, eraser):
        pf = (PEN_FLAG_BARREL if barrel else 0) | ((PEN_FLAG_INVERTED | PEN_FLAG_ERASER) if eraser else 0)
        prev = self.state
        if state == OUT:
            if prev == OUT:
                return
            lx, ly = self.last[0], self.last[1]
            if prev == CONTACT:
                self._inject(PF_INRANGE | PF_UP, lx, ly, 0, 0, 0, pf, CHANGE_FIRST_UP)
            self._inject(PF_UPDATE, lx, ly, 0, 0, 0, 0)
        elif state == HOVER:
            if prev == CONTACT:
                self._inject(PF_INRANGE | PF_UP, x, y, 0, tx, ty, pf, CHANGE_FIRST_UP)
            else:
                self._inject(PF_INRANGE | PF_UPDATE, x, y, 0, tx, ty, pf)
        else:  # CONTACT
            if prev == OUT:
                self._inject(PF_INRANGE | PF_UPDATE, x, y, 0, tx, ty, pf)
            if prev != CONTACT:
                self._inject(PF_INRANGE | PF_INCONTACT | PF_FIRSTBUTTON | PF_DOWN,
                             x, y, pressure, tx, ty, pf, CHANGE_FIRST_DOWN)
            else:
                self._inject(PF_INRANGE | PF_INCONTACT | PF_FIRSTBUTTON | PF_UPDATE,
                             x, y, pressure, tx, ty, pf)
        self.state = state
        self.last = (x, y, pressure, tx, ty, pf)


class WindowsMouse(WindowsBase):
    name = "windows-mouse"

    def __init__(self):
        super().__init__()
        self.state = OUT
        self.btn = None

    def pen(self, state, x, y, pressure, tx, ty, barrel, eraser):
        u = self.user32
        if state != OUT:
            u.SetCursorPos(x, y)
        if state == CONTACT and self.state != CONTACT:
            self.btn = "r" if barrel else "l"
            u.mouse_event(0x0008 if self.btn == "r" else 0x0002, 0, 0, 0, 0)
        elif state != CONTACT and self.state == CONTACT:
            u.mouse_event(0x0010 if self.btn == "r" else 0x0004, 0, 0, 0, 0)
        self.state = state


# --------------------------------------------------------------------------
# macOS / Linux: chế độ chuột qua pynput (pip install pynput), không lực nhấn
# --------------------------------------------------------------------------
class PynputMouse(Backend):
    name = "pynput-mouse"

    def __init__(self):
        super().__init__()
        from pynput.mouse import Controller, Button
        from pynput.keyboard import Controller as KController, Key
        self.m, self.Button = Controller(), Button
        self.k, self.Key = KController(), Key
        self.state = OUT
        self.btn = None
        self._size = (1920, 1080)
        try:
            import tkinter
            t = tkinter.Tk()
            t.withdraw()
            self._size = (t.winfo_screenwidth(), t.winfo_screenheight())
            t.destroy()
        except Exception:
            pass

    def monitors(self):
        return [{"x": 0, "y": 0, "w": self._size[0], "h": self._size[1], "primary": True}]

    def pen(self, state, x, y, pressure, tx, ty, barrel, eraser):
        if state != OUT:
            self.m.position = (x, y)
        if state == CONTACT and self.state != CONTACT:
            self.btn = self.Button.right if barrel else self.Button.left
            self.m.press(self.btn)
        elif state != CONTACT and self.state == CONTACT:
            self.m.release(self.btn)
        self.state = state

    def _key_raw(self, name, down):
        K = self.Key
        special = {"ctrl": K.ctrl, "control": K.ctrl, "shift": K.shift, "alt": K.alt,
                   "win": K.cmd, "space": K.space, "tab": K.tab, "esc": K.esc,
                   "escape": K.esc, "enter": K.enter, "backspace": K.backspace,
                   "delete": K.delete, "del": K.delete, "up": K.up, "down": K.down,
                   "left": K.left, "right": K.right, "home": K.home, "end": K.end,
                   "pageup": K.page_up, "pagedown": K.page_down}
        key = special.get(name) or (getattr(K, name, None) if name.startswith("f") and name[1:].isdigit() else None)
        if key is None:
            if len(name) != 1:
                return
            key = name
        (self.k.press if down else self.k.release)(key)


def make_backend(args):
    if args.dry:
        return DummyBackend()
    if sys.platform == "win32":
        if not args.mouse:
            try:
                return WindowsPen()
            except Exception as e:
                log("! Không tạo được bút ảo Windows Ink (%s). Cần Windows 10 bản 1809 trở lên." % e)
                log("  Chuyển sang chế độ chuột (không có lực nhấn).")
        return WindowsMouse()
    try:
        return PynputMouse()
    except Exception as e:
        log("! macOS/Linux cần:  pip install pynput   (%s)" % e)
        log("  Đang chạy chế độ thử, không điều khiển máy.")
        return DummyBackend()


# --------------------------------------------------------------------------
# ADB: tự chạy "adb reverse" để tablet vào http://localhost:PORT qua cáp USB
# --------------------------------------------------------------------------
def find_adb():
    exe = "adb.exe" if sys.platform == "win32" else "adb"
    cands = [os.path.join(HERE, "platform-tools", exe), os.path.join(HERE, exe)]
    if sys.platform == "win32":
        la = os.environ.get("LOCALAPPDATA", "")
        cands.append(os.path.join(la, "Android", "Sdk", "platform-tools", exe))
    for c in cands:
        if os.path.isfile(c):
            return c
    return shutil.which("adb")


def run(cmd, timeout=15):
    kw = {}
    if sys.platform == "win32":
        kw["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kw)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as e:
        return -1, str(e)


async def adb_watch(port, open_browser):
    adb = find_adb()
    if not adb:
        log("! Không thấy adb. Tải 'SDK Platform-Tools' của Google, giải nén thành thư mục")
        log("  'platform-tools' đặt cạnh file này, rồi chạy lại. (Hoặc dùng --wifi.)")
        return
    log("• adb:", adb)
    loop = asyncio.get_running_loop()
    done, warned, opened = set(), set(), set()
    while True:
        code, out = await loop.run_in_executor(None, run, [adb, "devices"])
        seen = set()
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 2:
                continue
            serial, st = parts[0], parts[1]
            seen.add(serial)
            if st == "unauthorized" and serial not in warned:
                log("! Tablet %s chưa cho phép gỡ lỗi: bấm 'Cho phép' trên màn hình tablet." % serial)
                warned.add(serial)
            if st != "device" or serial in done:
                continue
            c, o = await loop.run_in_executor(
                None, run, [adb, "-s", serial, "reverse", "tcp:%d" % port, "tcp:%d" % port])
            if c != 0:
                log("! adb reverse lỗi:", o.strip())
                continue
            done.add(serial)
            log("✓ Đã nối tablet %s qua USB. Trên tablet mở Chrome: http://localhost:%d" % (serial, port))
            if open_browser and serial not in opened:
                opened.add(serial)
                url = "http://localhost:%d/" % port
                c, o = await loop.run_in_executor(None, run, [
                    adb, "-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW",
                    "-d", url, "-p", "com.android.chrome"])
                if c != 0 or "Error" in o:
                    await loop.run_in_executor(None, run, [
                        adb, "-s", serial, "shell", "am", "start", "-a",
                        "android.intent.action.VIEW", "-d", url])
        for s in list(done):
            if s not in seen:
                done.discard(s)
                log("• Tablet %s đã rút cáp." % s)
        await asyncio.sleep(3)


# --------------------------------------------------------------------------
# HTTP + WebSocket tối giản (chỉ dùng thư viện chuẩn)
# --------------------------------------------------------------------------
async def ws_read(reader):
    h = await reader.readexactly(2)
    op = h[0] & 0x0F
    masked = h[1] & 0x80
    ln = h[1] & 0x7F
    if ln == 126:
        ln = struct.unpack(">H", await reader.readexactly(2))[0]
    elif ln == 127:
        ln = struct.unpack(">Q", await reader.readexactly(8))[0]
    if ln > 16 << 20:
        raise ConnectionError("frame quá lớn")
    mask = await reader.readexactly(4) if masked else b""
    data = await reader.readexactly(ln) if ln else b""
    if masked and ln:
        m = (mask * (ln // 4 + 1))[:ln]
        data = (int.from_bytes(data, "little") ^ int.from_bytes(m, "little")).to_bytes(ln, "little")
    return op, data


def ws_frame(op, data):
    n = len(data)
    if n < 126:
        hdr = bytes([0x80 | op, n])
    elif n < 65536:
        hdr = bytes([0x80 | op, 126]) + struct.pack(">H", n)
    else:
        hdr = bytes([0x80 | op, 127]) + struct.pack(">Q", n)
    return hdr + data


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#16181d"/><path d="M22 74c10-2 14-10 22-24s16-24 30-28" stroke="#8cbeff" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="74" cy="22" r="7" fill="#fff"/></svg>"""


DEFAULT_HOST_ORIGINS = {"https://quanace11.github.io"}


class Ctx:
    def __init__(self, backend, token, port, extra_origins=()):
        self.backend = backend
        self.token = token
        self.port = port
        self.mons = backend.monitors()
        self.hosts = set()   # writer của app trên PC (Frame Studio) đang nối
        self.pads = set()    # writer của tablet đang nối
        self.host_origins = DEFAULT_HOST_ORIGINS | set(o.rstrip("/") for o in extra_origins)

    def send(self, writers, frame, limit=None):
        for w in list(writers):
            try:
                if limit is not None and w.transport.get_write_buffer_size() > limit:
                    continue  # tablet nhận chậm: bỏ ảnh này, ảnh sau sẽ tới
                w.write(frame)
            except Exception:
                writers.discard(w)

    def host_msg(self):
        return ws_frame(1, json.dumps({"t": "host", "on": bool(self.hosts)}).encode())


class Session:
    def __init__(self, ctx):
        self.ctx = ctx
        self.mon = 0

    def on_binary(self, data):
        kind = 1
        if len(data) % 10 == 1:          # byte đầu: 1 = bút cho cả máy tính, 2 = bút cho app (Frame Studio)
            kind, data = data[0], data[1:]
        if kind == 2:
            self.ctx.send(self.ctx.hosts, ws_frame(2, data))
            return
        mons = self.ctx.mons
        m = mons[min(self.mon, len(mons) - 1)]
        sx, sy = (m["w"] - 1) / 65535.0, (m["h"] - 1) / 65535.0
        be = self.ctx.backend
        for off in range(0, len(data) - 9, 10):
            st, fl, x, y, p, tx, ty = struct.unpack_from("<BBHHHbb", data, off)
            if st > CONTACT:
                continue
            be.pen(st, m["x"] + int(round(x * sx)), m["y"] + int(round(y * sy)),
                   min(p, 1024), max(-90, min(90, tx)), max(-90, min(90, ty)),
                   bool(fl & 1), bool(fl & 2))

    def on_text(self, text, writer):
        try:
            msg = json.loads(text)
        except Exception:
            return
        if not isinstance(msg, dict):
            return
        t = msg.get("t")
        if t == "app":                     # lệnh cho app trên PC (chọn bút, màu, cỡ, hoàn tác…)
            inner = msg.get("m")
            if isinstance(inner, dict):
                self.ctx.send(self.ctx.hosts, ws_frame(1, json.dumps(inner).encode()))
        elif t == "cfg":
            mon = msg.get("monitor", 0)
            if isinstance(mon, int) and 0 <= mon < len(self.ctx.mons):
                if mon != self.mon:
                    self.ctx.backend.pen(OUT, 0, 0, 0, 0, 0, False, False)
                self.mon = mon
        elif t == "key":
            combo = str(msg.get("combo", ""))[:40]
            action = msg.get("a", "tap")
            if action in ("tap", "down", "up"):
                self.ctx.backend.key(combo, action)
        elif t == "ping":
            writer.write(ws_frame(1, json.dumps({"t": "pong", "ts": msg.get("ts")}).encode()))


def origin_ok(role, origin, host_hdr, ctx, is_local):
    """Chặn trang web lạ mở trên PC kết nối vào PenPad (gõ phím giả / điều khiển bút)."""
    if not origin:                       # không phải trình duyệt (vd. script thử trên chính máy này)
        return is_local
    o = origin.rstrip("/").lower()
    if role == "host":
        if not is_local:
            return False
        u = urllib.parse.urlsplit(o)
        return o in ctx.host_origins or u.hostname in ("localhost", "127.0.0.1")
    return o == ("http://" + host_hdr).lower()   # trang tablet phải là trang do chính PenPad phục vụ


async def handle(reader, writer, ctx):
    peer = writer.get_extra_info("peername") or ("?",)
    host = str(peer[0])
    is_local = host in ("127.0.0.1", "::1") or host.startswith("::ffff:127.")
    try:
        head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 15)
    except Exception:
        writer.close()
        return
    lines = head.decode("latin1").split("\r\n")
    try:
        method, target, _ = lines[0].split(" ", 2)
    except ValueError:
        writer.close()
        return
    headers = {}
    for l in lines[1:]:
        if ":" in l:
            k, v = l.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    path, _, query = target.partition("?")
    q = urllib.parse.parse_qs(query)
    authorized = is_local or not ctx.token or secrets.compare_digest(q.get("k", [""])[0], ctx.token)

    def respond(code, ctype, body):
        reason = {200: "OK", 403: "Forbidden", 404: "Not Found"}.get(code, "OK")
        writer.write(("HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
                      "Cache-Control: no-store\r\nConnection: close\r\n\r\n"
                      % (code, reason, ctype, len(body))).encode() + body)

    if path == "/ws" and "websocket" in headers.get("upgrade", "").lower():
        role = "host" if q.get("role", [""])[0] == "host" else "pad"
        origin = headers.get("origin", "")
        if not authorized or not origin_ok(role, origin, headers.get("host", ""), ctx, is_local):
            respond(403, "text/plain", b"Forbidden")
            try:
                await writer.drain()
            except Exception:
                pass
            writer.close()
            log("! Từ chối kết nối (%s, %s, origin %s)" % (role, host, origin or "-"))
            return
        key = headers.get("sec-websocket-key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                      "Connection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % accept).encode())
        sock = writer.get_extra_info("socket")
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass
        if role == "host":
            await host_session(reader, writer, ctx, origin)
        else:
            await ws_session(reader, writer, ctx, host)
        return

    if path in ("/", "/index.html"):
        try:
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                respond(200, "text/html; charset=utf-8", f.read())
        except OSError:
            respond(404, "text/plain", b"Thieu file index.html")
    elif path == "/manifest.webmanifest":
        start = "/" + ("?k=" + ctx.token if ctx.token and authorized and not is_local else "")
        man = {"name": "PenPad", "short_name": "PenPad", "display": "fullscreen",
               "start_url": start, "background_color": "#0e0f12", "theme_color": "#0e0f12",
               "icons": [{"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml"}]}
        respond(200, "application/manifest+json", json.dumps(man).encode())
    elif path == "/icon.svg":
        respond(200, "image/svg+xml", ICON_SVG.encode())
    else:
        respond(404, "text/plain", b"Not found")
    try:
        await writer.drain()
    except Exception:
        pass
    writer.close()


async def host_session(reader, writer, ctx, origin):
    """App trên PC (Frame Studio): chuyển trạng thái + ảnh frame của nó sang tablet."""
    ctx.hosts.add(writer)
    ctx.send(ctx.pads, ctx.host_msg())
    log("✓ Frame Studio đã nối (%s) – tablet sẽ hiện frame đang vẽ" % origin)
    try:
        while True:
            op, data = await ws_read(reader)
            if op == 1:
                big = len(data) > 20000          # ảnh frame: bỏ qua tablet nào đang nhận chậm
                ctx.send(ctx.pads, ws_frame(1, data), 1_500_000 if big else None)
            elif op == 8:
                writer.write(ws_frame(8, b""))
                break
            elif op == 9:
                writer.write(ws_frame(10, data))
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        ctx.hosts.discard(writer)
        ctx.send(ctx.pads, ctx.host_msg())
        try:
            writer.close()
        except Exception:
            pass
        log("• Frame Studio ngắt kết nối")


async def ws_session(reader, writer, ctx, host):
    sess = Session(ctx)
    be = ctx.backend
    ctx.mons = be.monitors()
    writer.write(ws_frame(1, json.dumps({"t": "hello", "v": VERSION, "backend": be.name,
                                         "monitors": ctx.mons, "host": bool(ctx.hosts)}).encode()))
    ctx.pads.add(writer)
    if ctx.hosts:
        ctx.send(ctx.hosts, ws_frame(1, b'{"t":"want"}'))
    log("✓ Tablet đã kết nối (%s) – chế độ: %s" % (host, be.name))
    try:
        while True:
            op, data = await ws_read(reader)
            try:
                if op == 2:
                    sess.on_binary(data)
                elif op == 1:
                    sess.on_text(data.decode("utf-8", "replace"), writer)
                elif op == 8:
                    writer.write(ws_frame(8, b""))
                    break
                elif op == 9:
                    writer.write(ws_frame(10, data))
            except Exception as e:
                log("! Lỗi xử lý:", e)
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        ctx.pads.discard(writer)
        try:
            be.pen(OUT, 0, 0, 0, 0, 0, False, False)
            be.release_all()
            ctx.send(ctx.hosts, ws_frame(1, b'{"t":"penout"}'))
        except Exception:
            pass
        try:
            writer.close()
        except Exception:
            pass
        log("• Tablet ngắt kết nối (%s)" % host)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


async def main_async(args):
    backend = make_backend(args)
    token = secrets.token_urlsafe(6) if args.wifi else ""
    ctx = Ctx(backend, token, args.port, args.allow_origin)
    bind = "0.0.0.0" if args.wifi else "127.0.0.1"
    server = await asyncio.start_server(lambda r, w: handle(r, w, ctx), bind, args.port)
    log("=" * 60)
    log(" PenPad %s – bảng vẽ miễn phí cho tablet Android" % VERSION)
    log("=" * 60)
    log("• Chế độ bút:", {"windows-pen": "Windows Ink (có lực nhấn, độ nghiêng)",
                          "windows-mouse": "Chuột (không lực nhấn)",
                          "pynput-mouse": "Chuột (không lực nhấn)",
                          "dummy": "Thử nghiệm (không điều khiển máy)"}.get(backend.name, backend.name))
    for i, m in enumerate(ctx.mons):
        log("  Màn hình %d: %dx%d%s" % (i + 1, m["w"], m["h"], " (chính)" if m["primary"] else ""))
    log("• USB:  cắm cáp → tablet mở  http://localhost:%d" % args.port)
    if args.wifi:
        log("• Wi-Fi: tablet mở  http://%s:%d/?k=%s" % (lan_ip(), args.port, token))
        log("  (cùng mạng Wi-Fi; mã k= để người khác không điều khiển được máy bạn)")
    log("• Frame Studio: mở app trên máy này → Menu → 🖊 Tablet làm bảng vẽ → bật Nối với PenPad")
    log("• Nhấn Ctrl+C để tắt.")
    log("-" * 60)
    if not args.no_adb:
        asyncio.create_task(adb_watch(args.port, not args.no_open))
    async with server:
        await server.serve_forever()


def main():
    ap = argparse.ArgumentParser(description="PenPad server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PENPAD_PORT", "8765")))
    ap.add_argument("--wifi", action="store_true", help="cho phép kết nối qua Wi-Fi (có mã bảo vệ)")
    ap.add_argument("--mouse", action="store_true", help="ép dùng chế độ chuột")
    ap.add_argument("--no-adb", action="store_true", help="không tự chạy adb reverse")
    ap.add_argument("--no-open", action="store_true", help="không tự mở trình duyệt trên tablet")
    ap.add_argument("--allow-origin", action="append", default=[], metavar="URL",
                    help="cho thêm trang web được nối làm app (mặc định: https://quanace11.github.io, localhost)")
    ap.add_argument("--dry", action="store_true", help="chế độ thử: chỉ in ra, không điều khiển máy")
    args = ap.parse_args()
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        log("Đã tắt PenPad.")
    except OSError as e:
        log("! Không mở được cổng %d: %s (đang có PenPad khác chạy?)" % (args.port, e))


if __name__ == "__main__":
    main()
