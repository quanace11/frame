# Frame Studio — bản cài lên tablet (PWA)

Phiên bản: 2026.11.20-1413

## 1. Đưa lên GitHub Pages (miễn phí, ~5 phút)
1. Vào https://github.com/new → tạo repo, ví dụ `frame-studio`, chọn **Public**.
2. Bấm **uploading an existing file** → kéo **toàn bộ nội dung thư mục này** (index.html, sw.js, manifest.webmanifest, icons/, các file .js/.mjs/.wasm, .nojekyll) vào → **Commit changes**.
   - Hoặc dùng git:
     ```
     git init && git add . && git commit -m "Frame Studio 2026.11.20-1413"
     git branch -M main && git remote add origin https://github.com/<tên-bạn>/frame-studio.git && git push -u origin main
     ```
3. Repo → **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main** / **(root)** → Save.
4. Chờ 1–2 phút, link sẽ là: `https://<tên-bạn>.github.io/frame-studio/`

(Netlify cũng được: kéo thả cả thư mục vào https://app.netlify.com/drop.)

## 2. Cài lên tablet
- **iPad (Safari)**: mở link → nút Chia sẻ ⬆ → **Thêm vào Màn hình chính** → Thêm.
- **Android (Chrome)**: mở link → menu ⋮ → **Cài đặt ứng dụng** (hoặc "Thêm vào màn hình chính").

Mở app từ biểu tượng trên màn hình chính: toàn màn hình, chạy được khi không có mạng.
Lưu ý: tính năng AI (tách nền, vá AI) tải mô hình ở **lần dùng đầu tiên** (cần mạng), sau đó dùng offline được.

## 3. Cập nhật
Khi có bản mới: thay các file trong repo bằng bản mới (upload đè hoặc `git add . && git commit -m update && git push`).
Lần mở app tiếp theo sẽ hiện **"Có bản cập nhật mới — Tải lại ngay"**. Hoặc vào Menu → **🔄 Kiểm tra cập nhật**.
Bài vẽ và dự án nằm trên tablet nên **không mất khi cập nhật**.

## 4. Chuyển bài từ bản trong claude.ai sang app
Mỗi nơi lưu bài riêng. Ở bản claude.ai: Menu → **Xuất ZIP** → lưu file.
Ở app trên tablet: 📁 Dự án → **＋ Dự án mới** → Menu → **Mở dự án từ ZIP**.

## 5. Sao lưu
Thỉnh thoảng Menu → Xuất ZIP để giữ bản sao (phòng khi xoá app hoặc dữ liệu trình duyệt).
