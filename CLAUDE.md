# Frame Studio — hướng dẫn cho Claude / người cùng làm

Web app vẽ và làm hoạt hình (Shorts 9:16) chạy trên tablet. Là PWA, host bằng GitHub Pages: https://quanace11.github.io/frame/
Chủ dự án: Quan (frontend dev, nói tiếng Việt). **Toàn bộ chữ trên giao diện viết bằng tiếng Việt**, dễ hiểu cho người mới.

## Cấu trúc repo
| Đường dẫn | Là gì |
|---|---|
| `src/index.html` | **Mã nguồn duy nhất của app.** Một file HTML gồm CSS + JS, không framework, không bundler. Chỉ sửa ở đây. |
| `tools/build.py` | Build `src/index.html` thành `index.html` ở thư mục gốc: chèn version vào `__APP_VERSION__`, thêm thẻ manifest/icon, tạo `sw.js`, `manifest.webmanifest`, `icons/`. Cần Pillow. |
| `index.html`, `sw.js` | **File được build ra, không commit** (đã gitignore). GitHub Action `.github/workflows/pages.yml` tự build và đăng lên Pages mỗi lần push lên `main`. Ở máy thì build để chạy test. |
| `manifest.webmanifest`, `icons/` | Cũng do build tạo ra, ít khi đổi, vẫn commit. Không sửa tay. |
| `ort.wasm.min.js`, `ort-wasm-simd-threaded.*` | onnxruntime-web 1.31.1 (WASM, numThreads=1) |
| `u2netp-model.js` | Model tách nền u2netp, nhúng base64 (`window.U2NETP_B64`) |
| `migan-1/2/3.js` | Model vá hình MI-GAN, base64 chia 3 phần, mỗi phần < 16 MB (`window.MIGAN_B64_1..3`) |
| `tests/` | Test hồi quy bằng Playwright (python). `tests/assets/` chứa ảnh/âm thanh mẫu tự tạo. |

## Quy trình làm việc
```bash
# 1. sửa src/index.html
python3 tools/build.py                 # 2. build ra thư mục gốc
python3 tests/run_all.py               # 3. chạy toàn bộ test (hoặc: run_all.py test5 test22)
git checkout -b feat/<tên> && git commit && git push   # 4. làm trên nhánh, merge vào main
```
- Cài đặt: `pip install playwright pillow` và có Chrome (đặt `CHROME=/đường/dẫn` nếu không phải `/usr/bin/google-chrome`).
- Test chạy trên **bản đã build ở thư mục gốc**, nên phải build trước rồi mới test. Ảnh chụp màn hình lưu vào `tests/out/` (đã gitignore).
- Kiểm tra cú pháp nhanh: tách `<script>` ra file rồi chạy `node --check`.
- Mỗi lần push lên `main`, Action **Pages** build rồi đăng app (mất khoảng 1 phút). Sau đó app đã cài trên tablet tự hiện "Có bản cập nhật mới" (service worker: network-first cho index.html, cache-first cho model lớn).
- Test mới đặt tên theo tính năng `tests/test_<tên>.py` (không đánh số, để 2 nhánh không trùng tên; `run_all.py` nhận cả 2 kiểu). Viết theo mẫu `tests/test21.py`: đầu file có header chuẩn (ROOT/ASSETS/OUT/CHROME), mở `http.server` ở một cổng riêng, dòng cuối in `ERR []`.
- Test nào chạm vào bảng có tab thì thêm init script xoá class `.tabhide` (xem test22).

## Ràng buộc quan trọng
- **Giữ app trong một file** (`src/index.html`). Không thêm CDN, vì app phải chạy offline. Model và runtime để ở thư mục gốc.
- **Không vẽ hay nhúng nhân vật, logo hoặc tác phẩm có bản quyền**, kể cả người thật. Asset trong Kho hình đều vẽ bằng code (hàm `aEye`, `aMouth`, `aHand`...). Asset mới cũng phải là thiết kế gốc.
- **Ưu tiên tablet:**
  - Pointer Events: bút có lực nhấn và chống chạm lòng bàn tay.
  - Cử chỉ: 2 ngón để zoom, pan và xoay; chạm 2 ngón = hoàn tác, chạm 3 ngón = làm lại.
  - Nút bấm tối thiểu 42–44 px. Hỗ trợ cả màn hình ngang và dọc.
- **Không dùng `alert`/`confirm`.** Dùng `modal()`, `toast()`, `progress()`.
- **Bộ nhớ:** frame được giải phóng theo LRU (`MAX_LOADED`) xuống PNG trong IndexedDB. Luôn `await ensureLoaded(f)` trước khi đọc `f.canvas`.
- **Undo:** mọi chỉnh sửa đi qua `pushEntry(...)`, với puppet là `ppEntry`/`ppEdit`. Thay đổi pixel phải ghi `bytes`.
  - Ngoài ra có **undo tự động** (`histSnap`/`histCheck`/`histApply`): mỗi `scheduleSave()` hẹn kiểm tra sau 400 ms; nếu trạng thái nhẹ (thứ tự/thời lượng frame, nền, mảnh puppet, tư thế, chữ/camera, âm thanh, rig, ảnh mờ, nền video) đổi mà không có `pushEntry` nào thì tự đẩy 1 bước `snap`. Vì vậy thay đổi mới chỉ cần gọi `scheduleSave()` là hoàn tác được. Pixel và nét vector **không** nằm trong snapshot: vẫn phải tự `pushEntry`. Đừng sửa canvas của mảnh tại chỗ (hãy tạo canvas mới) để snapshot giữ được bản cũ. Lịch sử tối đa `UNDO_MAX` = 400 bước.
- **Lưu trữ:** IndexedDB key-value `frame-studio`, gồm `projects` và `project:<id>`. Khi thêm field mới cho mảnh puppet, nhớ thêm vào cả 3 chỗ serialize: `saveProject` (khoảng dòng 3309), xuất ZIP (`ppMeta.parts.push`) và nhập ZIP.

## Bản đồ code (`src/index.html`, tìm theo tiêu đề `/* ===== ... */`)
- **Nền tảng và giao diện**
  - Basics / Settings (`S`, `SETTINGS_KEYS` lưu vào localStorage)
  - Objects (frames, nền, lazy load)
  - **View**: `vs`/`vtx`/`vty`/`vr`, `viewMat()`, `scrToDoc()`, `fitView()`, `rotateView90()`
  - Render, Strokes, Fill, Lasso/floating (`floatFromImage`), Undo, Timeline, Playback
  - **Đặt trước/sau cho hình đang nổi** (thanh Chọn vùng, hàng "Đặt"): `floating.place` = `top` (lớp Nhân vật) / `under` (vẽ `destination-over` vào lớp Màu, sau nét + màu) / `bg` (🖼 Lên nền: đè lên hình trong lớp Nền) / `bottom` (⏬ Dưới cùng: `destination-over` vào lớp Nền, sau cả hình đã có trong nền; `floatBgUsed` để cảnh báo). `floatDraws`/`floatPutDown` vẽ, `floatTarget` giữ bản "trước" của lớp khác (`fl.extra`) cho undo/Huỷ. `floatToPart` biến hình thành mảnh ghép gốc ("Hình N") để đặt trước/sau nhân vật; `ppCharZ` (⏫/⏬) đưa cả nhân vật lên trước/ra sau. Test55.
  - **Kéo đổi chỗ frame** (`frPointerDown` → `frDragStart/Move/Drop`, `moveFramesTo` + entry `ford`): chuột kéo ngay; cảm ứng giữ 0,5 s rồi kéo (giữ mà không kéo = chọn nhiều như cũ). Frame đang chọn nhiều thì cả nhóm đi cùng.
  - **Cỡ / Độ đậm** (trong Strokes): `setSize`/`setOp`/`syncSizeOp`/`wireSizeOp` (nút − + giữ để lặp, bấm số = `sizeOpPop`). Thanh cỡ không tuyến tính (`sizeToPos`/`posToSize`). Độ đậm lưu riêng cho mỗi bút/kiểu tẩy trong `S.brushOp` (`curOp()`), mặc định = `B.op0`/`B.alpha`; bút dab vượt `op0` thì tăng flow (`flowK`). Tẩy cũng dùng độ đậm (xoá nhạt).
- **Nét vector**
  - Vector line layer: `vecStart`/`vecMove`/`vecEnd`. Chế độ kéo chấm `S.vdm` gồm `point` / `soft` / `move` / `multi`.
  - **Nhiều chấm** (`multi`): khoanh chọn chấm (`vecMultiLasso`, chặt: bỏ chấm sát viền vùng khoanh, `distToPoly`), chấm cam = chọn/đi theo, chấm xanh = đứng yên. Chạm 1 chấm = thêm/bỏ; chạm nhanh 2 lần cùng chấm = bỏ cả nét (`vpLastTap`); nút ➖ Khoanh bớt (`vpMinus`) = khoanh để bỏ chọn. Cả nét: khoanh chỉ lấy nét có ≥ 75% chiều dài trong vùng (`strokeInsideFrac`). Zoom tối đa `ZOOM_MAX` = 48× vừa khung. Test56.
  - Motion generator; Rig xương + biểu cảm; Gap filling (diffusion + MI-GAN)
- **Cut-out puppet** (`S.pp.parts`: `{id, role, parent, z, ox, oy, px, py, c, alts[], asset?}`)
  - Mỗi frame có `f.pp[partId] = {r, dx, dy, sx, sy, v, h}`. FK dùng ma trận 2×3 (`ppMats`).
  - Vai trò (`PP_ROLES`): `head`, `torso`, `armL/R`, `foreL/R`, `legL/R`, `shinL/R`, `mouth`, `eyes`.
  - Cắt tự động 2 bước: `ppFitJoints` (+ `ppFitLimbs`: tìm bàn tay/bàn chân là đầu mút xa nhất khi đi bên trong hình; tay áp sát thân thì tìm theo viền) → `ppLabBegin` chia vùng (`ppAutoLabels`: lan từ xương, qua nét viền tốn thêm) và cho người dùng tô sửa (`ppSetup.hand`, bút / chạm cả mảng / khoanh, giá trị theo `PP_R10`, 10 = bỏ đi) → `ppAutoCut`. Nút "Sửa lại vùng cắt" mở lại từ `ppLastCut` (chỉ trong phiên), cắt lại giữ tư thế theo vai trò.
  - `ppPresetPose` (đi, chạy, nhảy...), `ppTween`/`ppRetween` (frame giữa tự cập nhật theo keyframe 🔑).
  - **〰 Uốn mềm khớp** (`S.ppSoft`): `drawPuppet` vẽ tay/chân bằng lưới tam giác (`ppDrawSoft`), điểm gần khớp trộn ma trận 2 mảnh (`ppSkinMat`, `ppSoftJoints`): khuỷu/gối trộn 2 phía, vai/hông chỉ phía tay/chân. `ppGeom` cache trục xương + bề rộng chi (WeakMap, không lưu).
  - **🌊 Phát mượt** (`S.ppSmooth`): khi phát/xuất video, cache frame không có puppet + nét vector, rồi vẽ trực tiếp tư thế nội suy `ppPoseAt(i, tInFrame, wrap)` (cubic đơn điệu, frame dài giữ dáng rồi chuyển trong 0.16 s cuối, ease `hold` thì nhảy) qua `drawFrameFx(..., over=ppLiveOver(...))`. `tests/test_khop_mem.py`.
- **Kho hình** (`ASSET_CATS`, `assetDialog`, `assetToPart`, `assetToFrame`)
  - Mắt, miệng, biểu cảm, tay, hiệu ứng.
  - Hiệu ứng động (`ANIM_CATS`: 💫 Choáng, 🥊 Đánh nhau, 💥 Chữ âm thanh): mỗi hình là vòng lặp nhiều frame, hàm vẽ nhận `o.t`, số frame + âm thanh ở `items[k][2]` = `{n, sfx}`. `assetToFrameAnim` đặt frame 0, bấm ✓ thì `assetStampAnim` vẽ tiếp lên các frame sau (thiếu thì thêm frame), gắn SFX và ghi undo.
  - Gắn vào mảnh thì tạo mảnh con có `alts` (hình thay thế theo frame). Bộ nhép miệng = 3 hình, dùng với `fxLipSync`.
- **Cử chỉ** (`GESTURES`, `ppGesture`)
  - Keyframe theo vai trò và góc tuyệt đối của tay (`ppApplyAbs`), nên áp được cho mọi nhân vật đã gán vai trò.
  - Trong `BUILTIN_POSES`/`GESTURES`, góc tính theo độ trên màn hình: 0 = sang phải, 90 = xuống dưới.
- **Còn lại**
  - IK, Pose library, Projects
  - Text/camera/FX + SFX tổng hợp + lip sync + xuất video MP4 (MediaRecorder)
  - **⚽ Bóng & combo** (tab trong Chữ & FX): `ballMode` → kéo vẽ đường → `ballRun` (`ballPlan` chia đường theo tốc độ, `ballItem` vẽ bóng `aBall`/giày + vệt bay + bẹp cuối). Combo 1 chạm `GAGS` (sốc, bóng vào mặt, VÀO!, choáng, tức điên) → `gagApply(i0, {n, pix, fx, sfx})`: thiếu frame thì thêm, vẽ pixel + đổi camera/rung/chớp/chữ + gắn SFX, tất cả là **1 bước undo** (entry `multi` gồm `add`, pixel, `fxe`, `sfxadd`).
  - **Xoá frame / Xoá hết hoàn tác được**: `removeFrameAt` + entry `del`; Xoá hết dùng entry `wipe` (`wipeSnap`/`wipeSwap`). Frame bị xoá được "cất" bằng `parkObj` (giữ PNG, nhả canvas).
  - **🎨 Tách nét + màu** (tab trong Import dialog, `splitLineColor`): nét tối (`inkAlpha`) → lớp Nhân vật, màu gốc từng vùng (Màu phẳng: gom về vài màu chính mỗi vùng) → lớp Màu, lan dưới nét. `floatFromImage(line, col)` đặt cả 2 lớp (floating `cc`/`csnap`). Tab Nhân vật ghép có công tắc Làm sạch (`st.ppClean`). Test48.
  - **Caricature** (tab 🤪 Biếm hoạ trong Import dialog): `cariFindHead` (tìm cổ từ mask u2netp), `cariToon` (bilateral + k-means + nét DoG), `cariCompose` (đầu to/thân nhỏ/phồng mặt/viền ngoài). Kết quả cache trong `st.cariC`: đổi thanh hình dáng chỉ chạy lại `cariCompose`.
  - **AI tạo nhân vật** (nút 🤖 AI nhân vật, `aiCharDialog`): gửi ảnh mẫu phong cách (image 1, có sẵn vẽ bằng code `aiStyleRefCanvas` hoặc ảnh người dùng chọn, IndexedDB `ai-style-ref`) + ảnh chụp (photo 2) + câu lệnh tới Gemini `generateContent` (`geminiGenerate`, model mặc định `gemini-2.5-flash-image`). Kết quả lưu IndexedDB `ai-chars`, ✂ Cắt mảnh = `openImport` chế độ Nhân vật ghép. **Key Gemini chỉ nằm trong localStorage `fs-gemini-key`** (gửi qua header `x-goog-api-key`), không bao giờ commit/hardcode, không lưu vào dự án/ZIP. Test dùng API giả (test30).
  - Image → vector (centre-line tracing), Snap-to-line, Delete all
  - Input (cử chỉ, phím tắt), Toolbar, Modal, Persistence, ZIP, Import dialog
  - Video nền, Panel tabs, Wizard (🚀 Làm nhanh), Menu/Help, Init, PWA

## Ghi chú khi làm cùng nhau
- Làm trên nhánh `feat/...` hoặc `fix/...`, chạy test, rồi merge vào `main`. `main` luôn phải build được và test pass.
- Chỉ commit `src/` (và test). **Không commit `index.html`/`sw.js`**: trước đây mỗi nhánh đều commit 2 file này với số phiên bản mới, nên PR nào cũng xung đột với PR khác.
- File lớn (model) không đổi thì đừng commit lại.
