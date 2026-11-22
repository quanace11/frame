# Frame Studio

App vẽ và làm hoạt hình Shorts 9:16 trên tablet: vẽ từng frame, nét vector, tách nhân vật từ ảnh thành nhân vật ghép (cut-out), kho mắt/miệng/tay, cử chỉ có sẵn, chữ, camera, âm thanh, nhép miệng và xuất MP4. Chạy offline sau khi cài (PWA).

**Link app:** https://quanace11.github.io/frame/

## Cài lên tablet
- **iPad (Safari):** mở link → nút Chia sẻ ⬆ → **Thêm vào Màn hình chính**.
- **Android (Chrome):** mở link → menu ⋮ → **Cài đặt ứng dụng**.

Tính năng AI (tách nền, vá hình) tải mô hình ở lần dùng đầu nên lần đó cần mạng. Sau đó dùng offline được.

## Cập nhật
Mỗi lần có bản mới trên nhánh `main`, app sẽ hiện **"Có bản cập nhật mới — Tải lại ngay"**. Có thể kiểm tra tay ở Menu → 🔄 Kiểm tra cập nhật.
Bài vẽ lưu trên tablet nên không mất khi cập nhật. Nên thỉnh thoảng vào Menu → **Xuất ZIP** để sao lưu.

## Bật GitHub Pages (chỉ làm 1 lần)
Settings → Pages → Build and deployment → Source: **GitHub Actions**. Mỗi lần push lên `main`, Action **Pages** tự build và đăng.

## Phát triển
- Mã nguồn: `src/` (`index.html` + `css/` + `js/<nhóm>/<tính năng>.js`). Build nối lại thành 1 file chạy offline.
- Build: `python3 tools/build.py` → `dist/` (mở `dist/index.html` qua một web server, vd. `python3 -m http.server -d dist`).
- Lint: `npm ci --prefix tools/lint && node tools/lint/lint.mjs`.
- Test: `pip install playwright pillow` rồi `python3 tests/run_all.py` (Chrome thật, 4 test song song). Mỗi PR tự chạy lint + test.

Chi tiết cấu trúc, quy trình và quy ước code xem trong [CLAUDE.md](CLAUDE.md).
