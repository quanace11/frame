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
- **Lưu trữ:** IndexedDB key-value `frame-studio`, gồm `projects` và `project:<id>`. Khi thêm field mới cho mảnh puppet, nhớ thêm vào cả 3 chỗ serialize: `saveProject` (khoảng dòng 3309), xuất ZIP (`ppMeta.parts.push`) và nhập ZIP. Thêm cả vào `charLibSave` (Kho nhân vật).

## Bản đồ code (`src/index.html`, tìm theo tiêu đề `/* ===== ... */`)
- **Nền tảng và giao diện**
  - Basics / Settings (`S`, `SETTINGS_KEYS` lưu vào localStorage)
  - Objects (frames, nền, lazy load)
  - **View**: `vs`/`vtx`/`vty`/`vr`, `viewMat()`, `scrToDoc()`, `fitView()`, `rotateView90()`
  - Render, Strokes, Fill, Lasso/floating (`floatFromImage`), Undo, Timeline, Playback
  - **Đặt trước/sau cho hình đang nổi** (thanh Chọn vùng, hàng "Đặt"): `floating.place` = `top` (lớp Nhân vật) / `under` (vẽ `destination-over` vào lớp Màu, sau nét + màu) / `bg` (🖼 Lên nền: đè lên hình trong lớp Nền) / `bottom` (⏬ Dưới cùng: `destination-over` vào lớp Nền, sau cả hình đã có trong nền; `floatBgUsed` để cảnh báo). `floatDraws`/`floatPutDown` vẽ, `floatTarget` giữ bản "trước" của lớp khác (`fl.extra`) cho undo/Huỷ. `floatToPart` biến hình thành mảnh ghép gốc ("Hình N") để đặt trước/sau nhân vật; `ppCharZ` (⏫/⏬) đưa cả nhân vật lên trước/ra sau. Test55.
  - **Chọn vùng lấy cả người + 🎞 Chuyển động** (`tests/test_truot.py`): Chọn vùng ở lớp Nét/Màu tự về lớp Nhân vật (không nhảy sang Sửa nét); `liftSelection` lấy nét pixel + màu (`cc`) + nét vector ≥ 75% trong vùng (`floatLiftVec`, vẽ vào hình nổi, `floating.vecBefore` cho undo/Huỷ, `floatVecEntry`/`floatVecRestore`). `liftAll` (nút ✋ Dời cả hình khi chạm nét pixel ở Sửa nét) = chọn cả frame (`frameContentBox`). Nút 🎞 Chuyển động (`twStart` → `floating.tw` = chỗ bắt đầu, kéo tới chỗ cuối, `twPoseAt` nội suy vị trí/cỡ/xoay theo `TW.path` line/bump/arc/hop + `TW.ease`) → `twMake`: vẽ vào N frame (thiếu thì thêm frame = bản sao frame gốc không có hình), 1 bước undo. Sửa nét: kéo nét đã khoanh / Nhiều chấm thì màu trong vùng khoanh đi theo (`colLiftPoly`, `vselLoop`).
  - **Kiểu chọn vùng** (`S.selMode`, thanh `#lassobar` hiện khi đang Chọn vùng mà chưa có hình nổi, `tests/test_chon_vung_kieu.py`): `pic` 👤 Cả hình vẽ (nét + màu + vector, như cũ) / `part` 🧩 Từng mảng (`partMask`: chia thành mảng cùng màu, chỉ lấy mảng ≥ 75% trong vòng + nét tối/viền mềm sát chúng, vd. lấy đầu mà không lấy TV/áo) / `layer` 📄 Chỉ 1 lớp (`floating.only`, chọn lớp ngay trên thanh; `only='col'` thì không khoét nét) / `all` 🔲 Tất cả + nền (`floating.bc` = mảnh lớp Nền, bản "trước" giữ sẵn trong `fl.extra` lúc khoét, `floatDraws` đặt lại vào Nền; không dùng được 🎞 Chuyển động). Cắt bằng mask chung `cutPiece`.
  - **Kéo đổi chỗ frame** (`frPointerDown` → `frDragStart/Move/Drop`, `moveFramesTo` + entry `ford`): chuột kéo ngay; cảm ứng giữ 0,5 s rồi kéo (giữ mà không kéo = chọn nhiều như cũ). Frame đang chọn nhiều thì cả nhóm đi cùng.
  - **Công cụ timeline kiểu Animate** (mục `Animate-style timeline tools`, `tests/test_animate_timeline.py`): `S.fps` + nút − N khung + (`expStep`, `fpsDialog`, thời lượng vẫn lưu ms trong `f.dur`); thanh tua `#scrub` (`scrubDraw`, kéo = `selectFrame`); phát chậm `playSpeed` (đồng hồ ảo `pNow()`, tắt tiếng khi ≠ 1×); phát đoạn `playRange` từ frame chọn nhiều (▶ Phát đoạn); ✨ Vẽ giữa `inbetween(n, ease)`: nội suy nét vector cùng `id` giữa frame này và frame sau (`ibVec`, lấy mẫu lại `ibResample`), puppet tween qua `ppKey=false`, pixel giữ A/B, 1 bước undo (`add`). Onion: tới 8 frame, `S.onionPal` (`ONION_PALS`), `onionTrue` màu thật, `onionCol` hiện lớp Màu, `onionKeys` bỏ frame giữ y hệt (`onionSame`). Phím , . F5/Shift+F5 F6 F7 Enter.
  - **Cỡ / Độ đậm** (trong Strokes): `setSize`/`setOp`/`syncSizeOp`/`wireSizeOp` (nút − + giữ để lặp, bấm số = `sizeOpPop`). Thanh cỡ không tuyến tính (`sizeToPos`/`posToSize`). Độ đậm lưu riêng cho mỗi bút/kiểu tẩy trong `S.brushOp` (`curOp()`), mặc định = `B.op0`/`B.alpha`; bút dab vượt `op0` thì tăng flow (`flowK`). Tẩy cũng dùng độ đậm (xoá nhạt). Cỡ thật = `bsz()`: khi `S.sizeScreen` (mặc định bật, "Giữ cỡ bút khi phóng to") thì `S.size * fitS / vs`, nên phóng to vẽ được nét mảnh. Nét vector lưu độ đậm ở `st.a` (thiếu = 100%); `drawVec(ctx, v, true)` bỏ qua `a` (tường đổ màu). Test `test_brush_zoom`.
- **Nét vector**
  - Vector line layer: `vecStart`/`vecMove`/`vecEnd`. Chế độ kéo chấm `S.vdm` gồm `point` / `soft` / `move` / `multi`.
  - **Nhiều chấm** (`multi`): khoanh chọn chấm (`vecMultiLasso`, chặt: bỏ chấm sát viền vùng khoanh, `distToPoly`), chấm cam = chọn/đi theo, chấm xanh = đứng yên. Chạm 1 chấm = thêm/bỏ; chạm nhanh 2 lần cùng chấm = bỏ cả nét (`vpLastTap`); nút ➖ Khoanh bớt (`vpMinus`) = khoanh để bỏ chọn. Cả nét: khoanh chỉ lấy nét có ≥ 75% chiều dài trong vùng (`strokeInsideFrac`). Zoom tối đa `ZOOM_MAX` = 48× vừa khung. Test56.
  - Motion generator; Rig xương + biểu cảm; Gap filling (diffusion + MI-GAN)
- **Cut-out puppet** (`S.pp.parts`: `{id, role, parent, z, ox, oy, px, py, c, alts[], asset?}`)
  - Mỗi frame có `f.pp[partId] = {r, dx, dy, sx, sy, v, h}`. FK dùng ma trận 2×3 (`ppMats`).
  - Vai trò (`PP_ROLES`): `head`, `torso`, `armL/R`, `foreL/R`, `legL/R`, `shinL/R`, `mouth`, `eyes`.
  - Cắt tự động 2 bước: `ppFitJoints` (+ `ppFitLimbs`: tìm bàn tay/bàn chân là đầu mút xa nhất khi đi bên trong hình; tay áp sát thân thì tìm theo viền) → `ppLabBegin` chia vùng (`ppAutoLabels`: lan từ xương, qua nét viền tốn thêm) và cho người dùng tô sửa (`ppSetup.hand`, bút / chạm cả mảng / khoanh, giá trị theo `PP_R10`, 10 = bỏ đi) → `ppAutoCut`. Nút "Sửa lại vùng cắt" mở lại từ `ppLastCut` (chỉ trong phiên), cắt lại giữ tư thế theo vai trò.
  - **🛷 Trượt gối** (tab Tạo frame, `ppSlide(dir)`): nhân vật lao vào, chậm dần (`EASE.out`) rồi dừng đúng chỗ đang đứng (`f.lip.mv`), bụi + cỏ ở phía sau (`slidePuffItem`, vẽ vào lớp pixel nên phải ở chỗ không bị nhân vật che), ngả thân ra sau, camera đẩy vào (key smooth ở frame n-3), SFX `slide` + `crowd`. Dùng `gagApply` (thêm `plan.copyOf` = frame để sao chép, `plan.edit(j, f)` trả về entry pose/đường đi) nên là 1 bước undo. `tests/test_truot_goi.py`.
  - **🧍 Kho nhân vật** (tab Mảnh & hình, nút ở ô "Chưa có nhân vật"): `charLibSave` lưu nhân vật chứa mảnh đang chọn (`charParts` theo `ppCharOf`: mảnh, khớp, vai trò, `alts`, `asset`) vào IDB `char-lib` (danh sách + ảnh nhỏ) + `char:<id>`; `charLibAdd` thêm vào dự án với id mới, tên `(NVn)`, ẩn ở frame trước frame đang chọn; hoàn tác qua undo tự động. Dùng chung mọi dự án trên máy (chưa đồng bộ ☁). `tests/test_kho_nhan_vat.py`.
  - `ppPresetPose` (đi, chạy, nhảy...), `ppTween`/`ppRetween` (frame giữa tự cập nhật theo keyframe 🔑).
  - **〰 Uốn mềm khớp** (`S.ppSoft`): `drawPuppet` vẽ tay/chân bằng lưới tam giác (`ppDrawSoft`), điểm gần khớp trộn ma trận 2 mảnh (`ppSkinMat`, `ppSoftJoints`): khuỷu/gối trộn 2 phía, vai/hông chỉ phía tay/chân. `ppGeom` cache trục xương + bề rộng chi (WeakMap, không lưu).
  - **🌊 Phát mượt** (`S.ppSmooth`): khi phát/xuất video, cache frame không có puppet + nét vector, rồi vẽ trực tiếp tư thế nội suy `ppPoseAt(i, tInFrame, wrap)` (cubic đơn điệu, frame dài giữ dáng rồi chuyển trong 0.16 s cuối, ease `hold` thì nhảy) qua `drawFrameFx(..., over=ppLiveOver(...))`. `tests/test_khop_mem.py`.
  - **〰 Đường đi** (tab Tạo frame, `ppPathMode` → `ppApplyPath`): vẽ đường, nhân vật đang chọn đi theo qua N frame (thiếu frame thì lặp tư thế từ frame hiện tại, vd. chu kỳ đi bộ). Lưu dạng lớp phủ `f.lip.mv = {rootId: {x, y}}` (giống `eb`) nên tween lại/nhép miệng không xoá; `drawPuppet` cộng vào dx/dy của mảnh gốc, tương tác dùng `ppPoseFor(f)`, phát mượt dùng `ppLipAt`. 1 bước undo (`multi`: `add` + `lipe`). `tests/test_duong_di.py`.
- **Kho hình** (`ASSET_CATS`, `assetDialog`, `assetToPart`, `assetToFrame`)
  - Mắt, miệng, biểu cảm, tay, hiệu ứng.
  - Hiệu ứng động (`ANIM_CATS`: 💫 Choáng, 🥊 Đánh nhau, 💥 Chữ âm thanh): mỗi hình là vòng lặp nhiều frame, hàm vẽ nhận `o.t`, số frame + âm thanh ở `items[k][2]` = `{n, sfx}`. `assetToFrameAnim` đặt frame 0, bấm ✓ thì `assetStampAnim` vẽ tiếp lên các frame sau (thiếu thì thêm frame), gắn SFX và ghi undo.
  - Gắn vào mảnh thì tạo mảnh con có `alts` (hình thay thế theo frame). Bộ nhép miệng = 3 hình, dùng với `fxLipSync`.
- **Cử chỉ** (`GESTURES`, `ppGesture`)
  - Keyframe theo vai trò và góc tuyệt đối của tay (`ppApplyAbs`), nên áp được cho mọi nhân vật đã gán vai trò.
  - Trong `BUILTIN_POSES`/`GESTURES`, góc tính theo độ trên màn hình: 0 = sang phải, 90 = xuống dưới.
  - Keyframe cử chỉ có thể có `sy: {role: tỉ lệ}` (ép ngắn mảnh, vd. ống chân chĩa ra sau khi quỳ nhìn từ trước); chân bị ép thì thân tự hạ xuống đúng chừng đó (`drop`) để gối chạm đất ở chỗ bàn chân cũ. Chân có trong `a` giữ góc màn hình khi thân nghiêng. 🙏 Quỳ gối xin tha (`beg`), 🙇 Quỳ gối vái lạy (`kowtow`). `tests/test_quy_goi.py`.
  - **⭐ Chuyển động của tôi** (tab Tạo frame, như Motion preset): `myMoSave` lưu các frame từ frame hiện tại thành góc tay/chân tuyệt đối theo vai trò (`ppCurAbs`) + đầu/thân/nhún tương đối (`myMoCapture`), thời lượng, keyframe; `myMoApply` dựng lại trên nhân vật đang chọn (có Tay kia = lật). Lưu chung mọi dự án ở localStorage `fs-motions`. `tests/test_chuyen_dong_cua_toi.py`.
- **Còn lại**
  - IK, Pose library, Projects
  - Text/camera/FX + SFX tổng hợp + lip sync + xuất video MP4 (MediaRecorder)
  - **🎥 Camera** (tab trong Chữ & FX): key trên frame `f.cam = {z, x, y, tr?, d?}`. `camAt(i, tIn)` tính theo **thời gian**: key cũ (không có `tr`) lia tới key sau (2 key liền nhau = đổi ngay); key mới `tr:'cut'` = đổi ngay tại frame đó, `tr:'smooth'` = bắt đầu đẩy từ frame đó, tới nơi sau `d` giây (1 frame tĩnh dài vẫn đẩy được). `camEdit(i)` = khung hiển thị khi sửa. Ở tab Camera: kéo ngoài khung = vẽ khung mới (`camFromRect`), kéo trong = dời, kéo chấm góc = zoom; `camKeySet` đặt key; nút 🔍 Cận cảnh / 🎬 Đẩy vào (`camPreset` rồi chạm). Test `test_camera_shots`.
  - **🎞 Chuyển cảnh** (tab trong Chữ & FX, `TR_KINDS`): `f.tr` = chuyển cảnh ở chỗ nối TRƯỚC frame (frame 1 = mở đầu phim), `f.tre` = chỗ nối SAU frame (frame cuối = kết thúc phim), `{k, d, snd}`, nằm trong undo tự động (`H_FKEYS`). Theo thời gian (`trList`: `side` both/out/in, cửa sổ có thể trùm nhiều frame). `drawFrameFx` → `trRender` vẽ frame vào buffer rồi `trDraw` (mờ qua đen/trắng, hoà cảnh, 📺 tắt/bật TV `trTv`, lau, đẩy, phóng mờ, glitch, khép tròn). Kiểu cần 2 hình (`two`) lấy hình frame kia qua `trSrc` (phát: `playTrSrc` = cache phát; xuất: `trSrcCache`). GIF chia frame trong chuyển cảnh thành ảnh 1/20 s; PNG/ảnh bìa bỏ qua (`trSkip`). Tiếng (`tvoff`/`tvon`/`glitch`/`whoosh`) lên lịch trong `scheduleAudio`. `tests/test_chuyen_canh.py`.
  - **⚽ Bóng & combo** (tab trong Chữ & FX): `ballMode` → kéo vẽ đường → `ballRun` (`ballPlan` chia đường theo tốc độ, `ballItem` vẽ bóng `aBall`/giày + vệt bay + bẹp cuối). Combo 1 chạm `GAGS` (sốc, bóng vào mặt, VÀO!, choáng, tức điên) → `gagApply(i0, {n, pix, fx, sfx})`: thiếu frame thì thêm, vẽ pixel + đổi camera/rung/chớp/chữ + gắn SFX, tất cả là **1 bước undo** (entry `multi` gồm `add`, pixel, `fxe`, `sfxadd`).
  - **Xoá frame / Xoá hết hoàn tác được**: `removeFrameAt` + entry `del`; Xoá hết dùng entry `wipe` (`wipeSnap`/`wipeSwap`). Frame bị xoá được "cất" bằng `parkObj` (giữ PNG, nhả canvas).
  - **🎨 Tách nét + màu** (tab trong Import dialog, `splitLineColor`): nét tối (`inkAlpha`) → lớp Nhân vật, màu gốc từng vùng (Màu phẳng: gom về vài màu chính mỗi vùng) → lớp Màu, lan dưới nét. `floatFromImage(line, col)` đặt cả 2 lớp (floating `cc`/`csnap`). Tab Nhân vật ghép có công tắc Làm sạch (`st.ppClean`). Test48.
  - **🧽 Sửa tay vùng tách nền** (trong `openImport`, tab cut/pp/split/cari): `st.ed` (Int8Array, -100 xoá … +100 lấy lại) cộng lên mask tự động qua `edApply(a)` (không sửa `a` vì có cache); cọ `edDab`, undo riêng `st.edUndo/edRedo` (chụp cả mảng), zoom/pan ảnh xem trước bằng CSS transform (`st.vz/vx/vy`, `zoomAt`), toạ độ ảnh lấy từ `getBoundingClientRect`. Chạm 2 ngón = hoàn tác. `tests/test_sua_nen_tay.py`.
  - **Caricature** (tab 🤪 Biếm hoạ trong Import dialog): `cariFindHead` (tìm cổ từ mask u2netp), `cariToon` (bilateral + k-means + nét DoG), `cariCompose` (đầu to/thân nhỏ/phồng mặt/viền ngoài). Kết quả cache trong `st.cariC`: đổi thanh hình dáng chỉ chạy lại `cariCompose`.
  - **AI tạo nhân vật** (nút 🤖 AI nhân vật, `aiCharDialog`): gửi ảnh mẫu phong cách (image 1, có sẵn vẽ bằng code `aiStyleRefCanvas` hoặc ảnh người dùng chọn, IndexedDB `ai-style-ref`) + ảnh chụp (photo 2) + câu lệnh tới Gemini `generateContent` (`geminiGenerate`, model mặc định `gemini-2.5-flash-image`). Kết quả lưu IndexedDB `ai-chars`, ✂ Cắt mảnh = `openImport` chế độ Nhân vật ghép. **Key Gemini chỉ nằm trong localStorage `fs-gemini-key`** (gửi qua header `x-goog-api-key`), không bao giờ commit/hardcode, không lưu vào dự án/ZIP. Test dùng API giả (test30).
  - **☁ Đồng bộ tablet ↔ laptop** (Menu → ☁, nút ☁ cạnh "Đã lưu", `syncDialog`/`syncNow`/`syncOnce`): qua **repo GitHub riêng tư** của người dùng bằng git data API (blobs/trees/commits/refs, 1 commit mỗi lần, ref PATCH không force → bị từ chối thì làm lại). Repo: `index.json` + `p/<id>/rec.json` (bản ghi IndexedDB, binary → `{$b: git sha}`, ref blob → `{$r, $v}`) + `p/<id>/b/<sha>` (ảnh không đổi thì không gửi lại). Trạng thái lần đồng bộ trước ở IDB `sync-state` (`items[id] = {l, r}`, `dels`): chỉ máy này sửa → gửi, chỉ máy kia → nhận (dự án đang mở thì mở lại), cả hai → giữ 2 bản "(từ máy khác)". Tự đồng bộ: 20 s sau khi lưu (`syncSoon`), khi mở app, khi ẩn/hiện app. **Token chỉ ở localStorage `fs-sync-gh-token`**, không vào dự án/ZIP/repo; repo Public bị từ chối. Service worker không cache request khác origin. `tests/test_sync.py` (GitHub giả, 2 máy).
  - **⚡ Xuất video nhanh** (`exportVideoFast`, trước phần MediaRecorder): WebCodecs `VideoEncoder` (H.264, `fastVideoCfg`) vẽ từng frame 30 fps không cần chờ thời gian thực, âm thanh trộn offline (`vxMixAudio` = `scheduleAudio(..., lead=0)`) rồi `AudioEncoder` (AAC, không có thì Opus), đóng gói bằng `mp4Mux` (tự viết, 1 sample/chunk, moov ở cuối). Có nền video, máy không hỗ trợ, hoặc tắt trong Menu (`S.fastVideo`) thì quay thường như cũ.
  - **🎤 Nhiều giọng**: `S.audio.voice` = giọng 1 (tương thích bản cũ), `S.audio.voices[]` = giọng thêm; luôn dùng `voiceClips()`/`voiceStart(c)`. Mỗi giọng có `mouth` (id mảnh Miệng của nhân vật nói, `voiceMouth`). Nhép miệng ghi `f.lip.m = {mouthId: 0|0.5|1}` (bản cũ `f.lip.pid/lv` vẫn vẽ được). Lưu: blob `m:v<id>`.
  - **📸 Ảnh bìa Shorts** (`coverDialog`, `drawCoverText`): frame + chữ to (3 kiểu, 3 chỗ), lưu PNG W×H hoặc thêm làm frame đầu 0,5 s.
  - **✨ Chữ động** (tab Chữ, `TX_IN`/`TX_LP`/`TX_OUT`): chữ có `t.an` (vào: pop/type/up/drop/zoom/spin/fade), `t.lp` (lặp: shake/pulse/float/wiggle), `t.ao` (ra: fade/shrink/up). `txAnim(t, i, tIn)` tính theo thời gian trên cả đoạn frame liền nhau có cùng `id` chữ (`txRun`, do "Giữ cho" tạo), `txSetAnim` đặt cho cả đoạn. Chỉ chạy khi `drawTexts` nhận chỉ số frame (drawFrameFx: phát/xuất); sửa, PNG, ảnh bìa (`trSkip`) = chữ đứng yên. GIF chia nhỏ theo `txWins`. ▶ Xem thử dùng `playRangeOnce`.
  - **👻 Bóng mờ lướt** (tab Camera, 残影): `f.ghost = {n, c?}` (H_FKEYS + 3 chỗ lưu). `drawGhosts` vẽ lớp Nhân vật + puppet + nét vector của n frame trước (dừng ở đầu cảnh) mờ dần, dưới nhân vật frame này; gọi trong `render`, `drawFrameBase`, `buildPlayCache` (`ghostKey` vào playKey). Trước khi xuất phải `await ghostLoad(f)`.
  - **🥁 Nhịp nhạc** (tab Âm thanh, như CapCut tự bắt nhịp): `musicBeats()` (cache theo buffer nhạc, `beatsFromSamples`: onset 2 dải → tempo bằng tự tương quan → pha) → vạch vàng trên sóng âm (`updateWaves`). `beatSnap` (🎯 frame sau vào đúng nhịp gần nhất), `beatFit(a, b, per)` (mỗi frame = ½/1/2/4 nhịp). Đổi `f.dur` → undo tự động. `tests/test_chu_dong.py` (cả 3 tính năng).
  - **🎬 Cảnh** (`shotsDialog`, `sceneList`): `f.scene` = tên ở frame đầu cảnh (frame 1 luôn là đầu cảnh 1). Dời cả cảnh (`sceneMove`, entry `ford`), nhân bản, chọn cả cảnh (msel). Huy hiệu hồng trên timeline. Khác `sceneDialog` (= nền vẽ sẵn).
  - **👆 Nút to** (`S.bigUi`, class `body.bigui`). Test `tests/test_more_features.py`.
  - Image → vector (centre-line tracing), Snap-to-line, Delete all
  - Input (cử chỉ, phím tắt), Toolbar, Modal, Persistence, ZIP, Import dialog
  - Video nền, Panel tabs, Wizard (🚀 Làm nhanh), Menu/Help, Init, PWA

## Ghi chú khi làm cùng nhau
- Làm trên nhánh `feat/...` hoặc `fix/...`, chạy test, rồi merge vào `main`. `main` luôn phải build được và test pass.
- Chỉ commit `src/` (và test). **Không commit `index.html`/`sw.js`**: trước đây mỗi nhánh đều commit 2 file này với số phiên bản mới, nên PR nào cũng xung đột với PR khác.
- File lớn (model) không đổi thì đừng commit lại.
