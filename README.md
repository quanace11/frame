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
Repo phải để Public. Vào Settings → Pages → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save.

## Phát triển
- Mã nguồn nằm ở `src/index.html`.
- Build: `python3 tools/build.py`.
- Test: `python3 tests/run_all.py`.

Chi tiết cấu trúc, quy trình và quy ước code xem trong [CLAUDE.md](CLAUDE.md).
