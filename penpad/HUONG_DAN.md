# PenPad – Biến Redmi Pad Pro + bút thành bảng vẽ cho PC (miễn phí)

PenPad có 2 chế độ, tự đổi:
- **Frame Studio** (khi Frame Studio trên máy tính đang nối): tablet **hiện frame đang vẽ**, có bảng chọn
  **bút / tẩy / đổ màu / hút màu**, loại bút, **màu**, **cỡ nét**, độ đậm, lớp, hoàn tác, chuyển frame, onion.
  Nét bút trên tablet vẽ thẳng vào frame (có lực nhấn). Xem mục "Dùng với Frame Studio" bên dưới.
- **Bảng vẽ cho cả máy tính** (mọi app khác: Krita, Photoshop…): như bảng Wacom không màn hình.

Tablet hoạt động như **bảng Wacom không màn hình**: bạn vẽ trên tablet và nhìn lên màn hình PC.
PC nhận tín hiệu như một **bút Windows Ink thật**, có **lực nhấn** (1024 mức), **độ nghiêng**, nút bên thân bút và đầu tẩy (nếu bút có).

## Cài đặt một lần

**1. Trên PC (Windows 10 bản 1809 trở lên / Windows 11)**
- Cài **Python 3** tại python.org. Khi cài nhớ tick **"Add python.exe to PATH"**.
- Tải **SDK Platform-Tools for Windows** của Google (tìm "android platform-tools download"),
  giải nén để có thư mục `platform-tools` **nằm ngay cạnh** file `penpad_server.py`:
  ```
  PenPad\
    penpad_server.py
    index.html
    Chay_PenPad_USB.bat
    platform-tools\adb.exe   ← ở đây
  ```

**2. Trên Redmi Pad Pro (HyperOS)**
- Cài đặt → Giới thiệu máy → chạm **"Phiên bản HyperOS"** 7 lần → bật Tùy chọn nhà phát triển.
- Cài đặt → Cài đặt bổ sung → **Tùy chọn nhà phát triển** → bật **Gỡ lỗi USB**.
- Nên cài **Google Chrome** (trình duyệt mặc định của Xiaomi có thể không gửi lực nhấn của bút).

## Mỗi lần dùng

1. Cắm cáp USB từ tablet vào PC (dùng cáp có truyền dữ liệu, không phải cáp chỉ sạc).
2. Nhấp đúp **`Chay_PenPad_USB.bat`**.
3. Lần đầu, tablet hiện hộp thoại "Cho phép gỡ lỗi USB?" → tick "Luôn cho phép" → **Cho phép**.
4. Chrome trên tablet sẽ tự mở `http://localhost:8765`. Nếu không tự mở thì bạn gõ địa chỉ này vào.
5. Bấm nút **⛶** để vào toàn màn hình. Mẹo: Chrome ⋮ → *Thêm vào màn hình chính* → lần sau mở
   từ icon PenPad là vào thẳng toàn màn hình.

Đưa bút lại gần thì con trỏ di theo. Chạm bút xuống để vẽ. Ngón tay bị bỏ qua để tránh chạm nhầm lòng bàn tay.

**Không có cáp?** Chạy `Chay_PenPad_WiFi.bat`, rồi trên tablet mở địa chỉ có `?k=...` hiện trong cửa sổ
(PC và tablet phải chung Wi-Fi; Windows hỏi tường lửa thì chọn cho phép mạng Private). Qua Wi-Fi sẽ trễ hơn USB một chút.

## Dùng với Frame Studio

1. Chạy PenPad như trên (cắm cáp, nhấp đúp `Chay_PenPad_USB.bat`).
2. Trên máy tính mở Frame Studio (https://quanace11.github.io/frame/) bằng Chrome/Edge →
   **☰ Menu → 🖊 Tablet làm bảng vẽ (PenPad)** → bật **Nối với PenPad**.
   Lần đầu trình duyệt có thể hỏi *cho phép kết nối tới thiết bị/ứng dụng trên máy này* → bấm **Cho phép**.
   App nhớ lựa chọn này: lần sau mở Frame Studio là tự nối.
3. Trên tablet, trang PenPad tự chuyển sang chế độ Frame Studio: bên trái là bảng nút, bên phải là frame.

Trên tablet:
- **Bút** vẽ, **đầu tẩy** của bút (nếu có) tự xoá rồi trả về công cụ cũ.
- **Chạm 2 ngón = hoàn tác**, **3 ngón = làm lại** (giống Frame Studio). **Chụm 2 ngón** để phóng to vùng đang vẽ, ⤢ Vừa khung để trả lại.
- Ngón tay không vẽ (chống chạm lòng bàn tay); muốn vẽ bằng ngón thì bật trong ⚙ Cài đặt.
- Trên màn hình máy tính có vòng tròn xanh chỉ chỗ đầu bút.

## Cài trong app vẽ để có lực nhấn

| App | Cài đặt |
|---|---|
| **Krita** (miễn phí) | Settings → Configure Krita → Tablet settings → chọn **Windows 8+ Pointer Input (Windows Ink)** → khởi động lại Krita |
| **Photoshop** | Mặc định dùng Windows Ink, cứ thế vẽ |
| **Clip Studio Paint** | File → Preferences → Tablet → chọn **TabletPC** |
| **MediBang / FireAlpaca** | Bật chế độ bút Windows Ink / TabletPC trong cài đặt |
| **Paint, OneNote, Whiteboard** | Có lực nhấn sẵn |

Nếu app vẽ được **chạy bằng quyền Administrator** thì PenPad cũng phải chạy bằng quyền Admin,
vì Windows chặn chương trình thường điều khiển cửa sổ Admin.

## Thanh phím tắt bên trái

Mặc định gồm Hoàn tác, Làm lại, Cọ, Tẩy, Cọ nhỏ/to, **Kéo** (giữ Space để di khung vẽ), **Lấy màu** (giữ Alt), Phóng to/Thu nhỏ, Lưu.
Bấm ⚙ để sửa. Mỗi dòng có dạng `Tên=phím`, ví dụ:
```
Hoàn tác=ctrl+z
Làm lại=ctrl+shift+z
Xoay canvas=r:hold
Lớp mới=ctrl+shift+n
Kéo=space:toggle
```
`:hold` nghĩa là phím được giữ khi bạn đè ngón tay, `:toggle` nghĩa là chạm một lần để bật, chạm lần nữa để tắt.

Trong ⚙ còn có: chọn màn hình PC (nếu bạn có 2 màn), độ nhạy lực nhấn, kéo giãn vùng vẽ, chuyển thanh phím sang phải, cho phép vẽ bằng ngón tay.

## Gặp lỗi

- **Cửa sổ báo "Không thấy adb"**: thư mục `platform-tools` chưa đặt đúng chỗ (xem bước 1).
- **"chưa cho phép gỡ lỗi"**: mở khoá tablet rồi bấm *Cho phép*. Nếu không thấy hộp thoại, rút cáp ra cắm lại,
  hoặc trong Tùy chọn nhà phát triển chọn *Thu hồi uỷ quyền gỡ lỗi USB* rồi cắm lại.
- **Vẽ được nhưng không có lực nhấn**: dùng Chrome thay cho trình duyệt Xiaomi, và chỉnh app vẽ sang Windows Ink (bảng trên).
- **Nét bị lệch hoặc không phủ hết màn hình**: vào ⚙ chọn đúng màn hình. Để nguyên Windows Scale (125%, 150%...)
  cũng được, PenPad tự xử lý.
- **Cửa sổ ghi "Chế độ: Chuột"**: Windows quá cũ (trước 1809) nên chỉ di chuột được, không có lực nhấn.

## An toàn
PenPad chỉ nhận lệnh từ trang PenPad trên tablet và từ Frame Studio (https://quanace11.github.io hoặc localhost) trên chính máy này.
Trang web khác mở trên máy tính không kết nối được (để không ai gõ phím giả vào máy bạn).
Chạy Frame Studio ở địa chỉ khác thì thêm: `python penpad_server.py --allow-origin https://địa-chỉ-của-bạn`.

## Dùng thử không cần tablet
`python penpad_server.py --dry` rồi mở `http://localhost:8765` bằng trình duyệt trên PC. Chế độ này chỉ in ra, không điều khiển máy.

Các tuỳ chọn khác: `--port 9000`, `--mouse` (ép chế độ chuột), `--no-open` (không tự mở Chrome trên tablet).
