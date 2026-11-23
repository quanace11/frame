/* ========= Menu & help ========= */
function helpHtml() {
  return `<ul>
<li><b>Bút</b> (Apple Pencil / S-Pen) để vẽ. <b>Ngón tay</b>: 1 ngón kéo khung, 2 ngón chụm để zoom.</li>
<li>Nút <b>Bút tròn ▾</b> trên thanh trên: chọn loại bút (bút mực, bút chì, bút dạ, thư pháp, sáp màu, cọ mềm, bút phun, màu nước), kiểu tẩy và mức <b>chống run tay</b>. Chạm <b>ô màu lớn</b> để mở bảng màu đầy đủ: kéo chọn màu bất kỳ, gõ mã màu, chọn lại màu vừa dùng, hoặc 💧 hút màu từ hình.</li>
<li><b>Chạm 2 ngón</b> = Hoàn tác · <b>Chạm 3 ngón</b> = Làm lại.</li>
<li><b>Lớp Nền</b> vẽ cảnh một lần; frame nhân bản dùng chung nền. <b>Nền mới</b> = đổi cảnh; <b>Tách nền</b> = sửa nền riêng cho frame này. Chấm màu dưới frame cho biết nhóm nền.</li>
<li><b>Lớp Nhân vật</b> là phần chuyển động, riêng từng frame.</li>
<li><b>Nhập ảnh</b>: đặt ảnh mờ dưới để đồ theo, hoặc để AI tách nhân vật khỏi nền, hoặc tự chuyển ảnh thành nét viền rồi tô lại.</li>
<li><b>🪄 AI vẽ đẹp</b> (thanh trên): vẽ phác thật nhanh rồi để AI làm phần tốn công. <b>✨ Làm đẹp nét phác</b> = vẽ lại thành nét sạch + tô màu, giữ đúng dáng và chỗ đứng; <b>🎨 Tô màu</b> = giữ nét của bạn, AI tô vào lớp Màu; <b>🎞 Vẽ frame giữa</b> = AI vẽ dáng ở giữa frame này và frame sau, chen thành frame mới. Kết quả là hình nổi phủ cả frame (nét → lớp Nhân vật, màu → lớp Màu): kéo cho khớp, bấm Xong (1 bước hoàn tác). Dùng chung key Gemini với 🤖 AI nhân vật.</li>
<li><b>🤖 AI nhân vật</b> (thanh trên): chọn ảnh chụp 1 người, AI (Google Gemini) vẽ lại thành nhân vật hoạt hình theo ảnh mẫu phong cách, lưu vào <b>Nhân vật AI</b>; bấm <b>✂ Cắt mảnh</b> để thành Nhân vật ghép. Cần key Gemini của bạn (Menu → 🔑 Key Gemini), key chỉ lưu trên máy này.</li>
<li><b>☁ Đồng bộ tablet ↔ laptop</b> (Menu): bài được giữ trong một repo GitHub riêng tư của bạn. Cài 1 lần trên mỗi máy (tên repo + token), sau đó app tự gửi bài khi bạn sửa xong hoặc chuyển sang app khác, và tự lấy bài mới khi mở lại. Hai máy cùng sửa 1 dự án thì app giữ cả 2 bản.</li>
<li><b>🤪 Biếm hoạ</b>: Nhập ảnh → tab "Biếm hoạ". Chọn ảnh chụp 1 người, app tự tách người, phóng to đầu, thu nhỏ thân, phồng giữa mặt và tô màu kiểu hoạt hình. Chỉnh Đầu to / Cỡ thân / Vị trí cổ rồi đưa vào vùng chọn hoặc thành Nhân vật ghép để làm động.</li>
<li><b>🎞 Chuyển động</b> (trượt gối, chạy vào, bay đi…): dùng <b>Chọn vùng</b> khoanh cả người (nét, màu và nét vector đi cùng nhau) → bấm <b>🎞 Chuyển động</b> → hình mờ là chỗ bắt đầu, kéo hình tới chỗ kết thúc (Xoay = nghiêng, Cỡ = lại gần) → chọn số frame, Đường (Thẳng, Rung nhẹ, Vòng cung, Nảy), Tốc độ (Chậm dần hợp với trượt) → <b>✓ Tạo frame</b>. App tự thêm frame còn thiếu. Hoàn tác 1 lần là bỏ hết.</li>
<li><b>Lớp Nét</b> (vector): vẽ bằng Bút khi chọn lớp Nét, hoặc nhập ảnh → "Chuyển thành nét vẽ". Công cụ <b>Sửa nét</b>: chạm chọn, kéo để dời, kéo chấm để uốn, khoanh để chọn nhiều, chỉnh Xoay/Cỡ/Dày. Tẩy ở lớp Nét xoá cả nét. <b>Chốt → pixel</b> để gộp vào lớp Nhân vật.</li>
<li><b>🎬 Tạo chuyển động</b> (trong Sửa nét): chọn nét tay/chân/miệng → chọn kiểu Vẫy, Nhép miệng, Nhún, Lắc → xem thử → Tạo. Muốn vừa vẫy tay vừa nói: tạo vẫy tay trước, quay lại frame đầu, chọn miệng, chọn "Áp lên các frame sau có sẵn".</li>
<li><b>🦴 Xương & biểu cảm</b> (trong Sửa nét): app tự gắn bộ xương, kéo chấm cho khớp; gán Mắt/Miệng/Lông mày (hoặc Tự đoán); chọn Thân (đi, chạy, nhảy, lăn lộn, vẫy tay, ăn mừng, ngã, thở) và/hoặc Mặt (chớp mắt, nói, cười, khóc, gào thét, giận, ngạc nhiên, buồn) → Tạo frame.</li>
<li><b>🔑 Keyframe</b>: chỉ cần đặt tư thế ở vài frame chính (🔑), các frame ∿ ở giữa app tự tính và tự cập nhật khi bạn sửa keyframe. Chọn kiểu chuyển (mượt, nảy, vượt đà…).</li>
<li><b>Kéo tay chân (IK)</b>: kéo bàn tay/bàn chân, cánh tay tự gập theo. <b>Tư thế</b>: chọn tư thế có sẵn (⭐) hoặc lưu tư thế của bạn. <b>↔ Lật nhân vật</b>: quay hướng.</li>
<li><b>✎ Vẽ lại mảnh</b> (tab Tạo dáng hoặc Mảnh & hình): chạm chọn mảnh (vd. giày, ống chân) rồi vẽ bằng 🖌 Bút, ⌫ Tẩy, 🪣 Đổ màu, 💧 Hút màu. Vẽ ra ngoài mép mảnh được (mảnh tự to ra). Sửa 1 lần là mọi frame đều đổi, mảnh vẫn cử động theo khớp. ↶ hoặc chạm 2 ngón = hoàn tác.</li>
<li><b>Hình của mảnh</b>: mỗi mảnh có nhiều hình (miệng há/ngậm, mắt mở/nhắm, tay xoè/nắm) — ＋ Nhập hình (ảnh AI), ⧉ Nhân bản rồi ✎ Vẽ lại mảnh để sửa; chạm hình nhỏ để đổi ở frame đang xem. Mẫu Nói/Chớp mắt tự đổi hình nếu có.</li>
<li><b>Nhiều nhân vật</b>: nhập ảnh nhân vật thứ 2 → Nhân vật ghép → chọn ＋ Thêm nhân vật. Mẫu và tư thế áp cho nhân vật đang chọn.</li>
<li><b>Xoay & toàn màn hình</b>: tablet xoay ngang/dọc đều dùng được. Xoay khung vẽ bằng 2 ngón (tự hít góc thẳng) hoặc nút <b>⟲ Xoay 90°</b>; <b>Vừa khung</b> để thẳng lại. <b>Ẩn công cụ</b> để vẽ toàn màn hình (còn cụm nút nhỏ góc trên); <b>▾ Ẩn dòng frame</b> để thu gọn thanh frame. Nút <b>Thu gọn</b> (cuối thanh công cụ, cuối thanh trên) và <b>⌄ Thu nhỏ</b> (thanh frame) gập từng thanh thành 1 nút nhỏ trên khung vẽ, chạm nút đó để mở lại. Bảng nổi (Ghép, Chữ & FX, Sửa nét) bấm ✕ để gập thành nút <b>☰</b>. Trạng thái gập được nhớ cho lần sau.</li>
<li>Bảng công cụ che khung? Bấm <b>✕</b> để đóng bảng (công cụ vẫn bật), bấm <b>☰ Mở bảng</b> góc dưới hoặc chạm lại biểu tượng công cụ để mở lại.</li>
<li><b>Nền</b>: vẽ/nhập nền 1 lần ở lớp Nền (dùng chung cho các frame), hoặc <b>🎞 Nền video</b> để đặt một đoạn video chạy phía sau nhân vật. Muốn vẽ đè lên video (đồ theo chuyển động thật): <b>🖼 Nền ▾ → 🎬 Video → frame</b>, chọn đoạn + số khung mỗi giây, mỗi khung thành 1 frame có hình ở lớp Nền, giữ được cả tiếng. Không cần vẽ nền từng frame — khi xuất video app tự ghép tất cả.</li>
<li><b>🌈 Hiệu ứng</b> (tab trong ✨ Chữ & FX): 🏃 <b>Nền chạy</b> (nền trượt liên tục để nhân vật chạy tại chỗ mà như lao trên sân), 💨 <b>Đường tốc độ</b> ngang/dọc và 💥 tia tập trung kiểu truyện tranh, 🎨 <b>Màu phim</b> (đen trắng hồi tưởng, phim cũ, đêm, giận đỏ, lạnh, mơ), 📺 <b>Phát lại chậm</b>: đứng ở frame cuối pha bóng rồi bấm, app chép lại pha đó chiếu chậm 2–4×, có chữ PHÁT LẠI.</li>
<li><b>✨ Chữ & FX</b>: thêm chữ truyện tranh/bóng thoại/hét/phụ đề (kéo để dời), camera zoom + chạm đặt tâm (tự lia mượt giữa các camera key), rung, chớp sáng; <b>🎞 Chuyển cảnh</b> (mờ qua đen/trắng, hoà cảnh, 📺 tắt/bật màn hình TV có tiếng tách, lau ngang, đẩy sang, phóng mờ, glitch, khép tròn): chọn Đầu frame / Sau frame rồi chạm 1 kiểu, hiện cả khi phát, xuất video và GIF; nhạc nền, lồng tiếng + 🗣 tự nhép miệng; âm thanh hiệu ứng có sẵn. <b>🎬 Video</b> xuất MP4/WebM có tiếng.</li>
<li><b>✨ Chữ động</b> (Chữ & FX → 🔤 Chữ): chạm 1 chữ → chọn <b>Vào</b> (bật ra, gõ từng chữ, bay lên, rơi nảy, thu từ to, xoay vào, hiện dần), <b>Lặp</b> (rung, đập nhịp, bồng bềnh, lắc lư), <b>Ra</b> (mờ đi, thu nhỏ, bay đi) → ▶ Xem thử. Dùng <b>Giữ cho N frame</b> hoặc mở <b>🗂 Dòng layer</b> rồi kéo đầu thanh vàng 🔤 của chữ để chữ ở lâu hơn; chữ chạy khi phát, video và GIF.</li>
<li><b>👻 Bóng mờ lướt</b> (Chữ & FX → 🎥 Camera): bật ở frame nhân vật lao nhanh (cú sút, cú đá): vài bản mờ của các frame trước hiện phía sau. Chọn số bóng và màu (Thật/Xanh/Vàng/Đỏ), hoặc <b>Cho N frame</b>.</li>
<li><b>🥁 Nhịp nhạc</b> (Chữ & FX → 🎵 Âm thanh): thêm nhạc nền, app tự tìm nhịp (vạch vàng dưới frame). <b>🎯 Frame sau vào đúng nhịp</b> = cú sút/cú ngã rơi đúng nhịp; <b>🥁 Khớp nhịp…</b> = mỗi frame dài ½/1/2/4 nhịp.</li>
<li><b>📁 Dự án</b>: lưu nhiều bài, mở/đổi tên/nhân bản/xoá.</li>
<li><b>🧩 Nhân vật ghép</b> (công cụ Ghép): Nhập ảnh → Nhân vật ghép → kéo khớp → Cắt tự động. Chạm mảnh, kéo để xoay quanh khớp. Cách làm hoạt hình: đặt tư thế A → Nhân bản frame → đặt tư thế B → quay lại A → <b>Tạo frame giữa</b>. Có mẫu Đi/Chạy/Nhảy/Vẫy/Gật/Lắc đầu/Thở, Nói/Chớp mắt (khoanh tách mảnh Miệng/Mắt rồi đặt vai trò).</li>
<li><b>🎨 Tách nét + màu</b>: Nhập ảnh → tab <b>🎨 Tách nét + màu</b>. App tự lấy nét viền tối vào lớp <b>Nhân vật</b> và màu gốc của từng vùng vào lớp <b>Màu</b> (tô lấn dưới nét). Hợp với ảnh 🤖 AI nhân vật. Ở tab 🧩 Nhân vật ghép có công tắc <b>Làm sạch</b> để nét rõ, màu phẳng trước khi cắt mảnh.</li>
<li><b>🧽 Sửa tay phần tách nền</b>: trong Nhập ảnh (Tách nhân vật, 🎨 Tách nét + màu, 🧩 Nhân vật ghép, 🤪 Biếm hoạ), dưới ảnh xem trước có <b>🧽 Xoá</b> (xoá phần nền còn sót) và <b>🖌 Lấy lại</b> (tô lên chỗ app tự xoá nhầm), cỡ cọ bấm <b>− +</b>. Chụm/mở 2 ngón để phóng to, kéo 2 ngón để dời ảnh, chạm 2 ngón = hoàn tác (hoặc nút ↶ ↷).</li>
<li><b>Tô màu giữ nét</b>: vẽ nét ở lớp <b>Nhân vật</b> hoặc <b>Nét</b>, rồi dùng <b>Đổ màu</b> — màu vào lớp <b>Màu</b> riêng nằm dưới nét, tô lấn tới giữa nét. Tẩy hay sửa nét thì màu vẫn nằm yên chỗ cũ, không loang. Muốn sửa màu bằng bút/tẩy thì chọn lớp Màu. Chọn vùng ở lớp Nhân vật thì màu bên dưới đi theo.</li>
<li><b>💧 Dò màu</b>: khi đang Đổ màu, bấm 💧 Dò màu (cạnh bảng màu) rồi chạm vào chỗ nào trên hình để lấy đúng màu đó — app tự quay lại Đổ màu, chạm vùng cần tô là xong. Máy tính: giữ Alt + bấm.</li>
<li><b>🧲 Hút nét</b>: bật để khi đồ lại, nét vẽ lệch tự hút vào nét cũ gần nhất (nét frame này, frame trước khi bật Onion, ảnh mờ). Chỉnh bán kính trong Menu.</li>
<li><b>Nét pixel → vector</b>: chọn vùng (hoặc vừa nhập "Ảnh nét (pixel)") → bấm <b>→ Nét vector</b>; hoặc Menu → chuyển cả lớp Nhân vật.</li>
<li><b>Onion</b>: đỏ = frame trước, xanh = frame sau, để vẽ khớp chuyển động. Giữ nút Onion: số frame (tới 8), đổi màu, 🎨 màu thật, hiện cả lớp Màu, bỏ qua frame giữ y hệt.</li>
<li><b>Thanh tua</b> (ngay trên dòng frame): kéo ngón tay dọc thanh để lật nhanh qua các frame. Mỗi ô dài bằng thời gian frame đó hiện.</li>
<li><b>Giữ hình − N khung +</b>: thêm/bớt 1 khung cho frame (vẽ "đôi" ở 12fps = mỗi hình giữ 2 khung). Chạm số để đổi fps. <b>1×</b> cạnh nút Lặp = phát chậm ½× / ¼× để soi. ☑ Chọn nhiều → <b>▶ Phát đoạn</b> = chỉ phát đoạn đã chọn.</li>
<li><b>✨ Vẽ giữa</b>: vẽ dáng đầu ở 1 frame, dáng cuối ở frame sau → quay lại frame đầu → ✨ Vẽ giữa: app tự tạo các frame chuyển tiếp (Đều / Chậm dần / Nhanh dần). Nét vector vẽ lại ở frame sau được tự ghép đôi theo chỗ và hình dạng (không cần Nhân bản frame). Bật <b>✏️ Nét bút thường cũng chuyển dần</b> để nét vẽ bằng bút (lớp Nhân vật) cũng chuyển dần.</li>
<li><b>Phím tắt</b>: , . = frame trước/sau · F5 = giữ thêm 1 khung (Shift+F5 bớt) · F6 = nhân bản frame · F7 = frame trống · Enter/Space = phát.</li>
<li>Làm chuyển động nhanh: <b>Nhân bản frame</b> → <b>Chọn vùng</b> khoanh tay/đầu → kéo, chỉnh <b>Xoay/Cỡ</b> → <b>Xong</b>.</li>
<li>Khung giữ lâu (punchline): đặt <b>Thời lượng frame</b> 2–3 giây.</li>
<li><b>Menu → Xuất ZIP</b> rồi gửi cho Claude dựng video. Bài tự lưu trên máy này, nhưng nên xuất ZIP để sao lưu.</li>
</ul>`;
}
$('#menuBtn').addEventListener('click', () => {
  if (playing) stopPlay();
  const html = `
<div class="menu-grid">
  <button class="btn primary" data-m="wizard">🚀 Làm video nhanh (từng bước)</button>
  <button class="btn" data-m="projects">📁 Dự án của bạn</button>
  <button class="btn" data-m="sync">☁ Làm tiếp trên máy khác</button>
  <button class="btn" data-m="update">🔄 Kiểm tra cập nhật</button>
  <button class="btn primary" data-m="video">🎬 Xuất video (MP4)</button>
  <button class="btn" data-m="gif">🖼 Xuất GIF / ảnh PNG</button>
  <button class="btn" data-m="cover">📸 Ảnh bìa Shorts (chữ to)</button>
  <button class="btn" data-m="scenes">🎬 Cảnh: chia phim dài, dời cả cảnh</button>
  <button class="btn primary" data-m="export">⬇ Xuất ZIP (gửi Claude)</button>
  <button class="btn" data-m="open">📂 Mở dự án từ ZIP</button>
  <button class="btn" data-m="scene">🏞 Nền vẽ sẵn (phòng, lớp học, phố, biển…)</button>
  <button class="btn" data-m="vidframes">🎬 Thêm video (ghép theo video / theo frame)</button>
  <button class="btn" data-m="img">🖼 Nhập ảnh (đồ theo / tách nhân vật / lấy nét)</button>
  <button class="btn" data-m="aichar">🤖 AI tạo nhân vật từ ảnh</button>
  <button class="btn" data-m="aifx">🪄 AI vẽ đẹp (làm sạch nét, tô màu, frame giữa)</button>
  <button class="btn" data-m="aikey">🔑 Key Gemini (AI)</button>
  <button class="btn" data-m="help">❓ Hướng dẫn</button>
  <button class="btn" data-m="tovec">✏️ Nét pixel lớp Nhân vật → nét vector</button>
  <button class="btn" data-m="delall" style="color:var(--danger)">🗑 Xoá hết frame</button>
  <button class="btn" data-m="new916">＋ Dự án mới 9:16 (Shorts)</button>
  <button class="btn" data-m="new169">＋ Dự án mới 16:9</button>
</div>
<div class="set-row"><span>👆 Nút to cho ngón tay (chấm màu, lớp, nút công cụ)</span><input type="checkbox" class="switch" id="sBigUi" ${S.bigUi ? 'checked' : ''}></div>
<div class="set-row"><span>⚡ Xuất video nhanh (không phải chờ hết phim)</span><input type="checkbox" class="switch" id="sFastV" ${S.fastVideo !== false ? 'checked' : ''}></div>
<div class="set-row"><span>📝 Nhân vật ghép mờ như giấy can khi cầm Bút / Tẩy / Đổ màu (để đồ qua, đổ màu lên trên)</span><input type="checkbox" class="switch" id="sTrace" ${S.ppTrace !== false ? 'checked' : ''}></div>
<div class="set-row"><span>Ngón tay cũng vẽ (khi không có bút)</span><input type="checkbox" class="switch" id="sFinger" ${S.fingerDraw ? 'checked' : ''}></div>
<div class="set-row"><span>Xoay khung bằng 2 ngón</span><input type="checkbox" class="switch" id="sRotG" ${S.rotGesture !== false ? 'checked' : ''}></div>
<div class="set-row"><span>🧲 Bán kính hút nét (px)</span><input type="range" id="sSnapR" min="6" max="80" value="${S.snapR}"></div>
<div class="set-row"><span>Làm mượt nét (chống run tay)</span><input type="range" id="sSmooth" min="0" max="80" value="${Math.round(S.smooth * 100)}"></div>
<div class="set-row"><span>Độ mờ onion skin</span><input type="range" id="sOnion" min="5" max="70" value="${Math.round(S.onionAlpha * 100)}"></div>
<div class="set-row"><span>Onion skin: số frame trước / sau</span><button class="chip small" id="sOnionN">${S.onionPrev ?? 1} / ${S.onionNext ?? 1} ▸</button></div>
<div class="set-row"><span>Thời lượng mặc định frame mới (giây)</span><input type="number" id="sDur" min="0.02" max="10" step="0.02" value="${S.defaultDur}"></div>
<div class="set-row"><span>Kích thước khung</span><span class="lbl">${W} × ${H}</span></div>`;
  modal({ title: 'Menu', html, buttons: [{ label: 'Đóng', value: null, primary: true }], onOpen: (ov, close) => {
    ov.querySelector('#sFinger').addEventListener('change', e => { S.fingerDraw = e.target.checked; saveSettings(); });
    ov.querySelector('#sBigUi').addEventListener('change', e => { S.bigUi = e.target.checked; applyBigUi(); saveSettings(); });
    ov.querySelector('#sFastV').addEventListener('change', e => { S.fastVideo = e.target.checked; saveSettings(); });
    ov.querySelector('#sTrace').addEventListener('change', e => { S.ppTrace = e.target.checked; saveSettings(); requestRender(); });
    ov.querySelector('#sRotG').addEventListener('change', e => { S.rotGesture = e.target.checked; saveSettings(); });
    ov.querySelector('#sSnapR').addEventListener('input', e => { S.snapR = +e.target.value; snapField = null; saveSettings(); });
    ov.querySelector('#sSmooth').addEventListener('input', e => { S.smooth = e.target.value / 100; saveSettings(); });
    ov.querySelector('#sOnionN').addEventListener('click', () => { close(null); onionDialog(); });
    ov.querySelector('#sOnion').addEventListener('input', e => { S.onionAlpha = e.target.value / 100; saveSettings(); requestRender(); });
    ov.querySelector('#sDur').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { S.defaultDur = v; saveSettings(); } });
    ov.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', async () => {
      const m = b.dataset.m; close(null);
      if (m === 'wizard') wizard();
      else if (m === 'update') checkUpdate();
      else if (m === 'scene') sceneDialog();
      else if (m === 'vidframes') $('#vidFramesFile').click();
      else if (m === 'video') exportVideo();
      else if (m === 'gif') exportImagesDialog();
      else if (m === 'cover') coverDialog();
      else if (m === 'scenes') shotsDialog();
      else if (m === 'projects') projectsDialog();
      else if (m === 'sync') syncDialog();
      else if (m === 'export') exportZip();
      else if (m === 'open') $('#zipFile').click();
      else if (m === 'img') $('#imgFile').click();
      else if (m === 'aichar') aiCharDialog();
      else if (m === 'aifx') aiFxDialog();
      else if (m === 'aikey') aiKeyDialog();
      else if (m === 'help') modal({ title: 'Hướng dẫn nhanh', html: helpHtml() });
      else if (m === 'tovec') convertPixelsToVector(false);
      else if (m === 'delall') deleteAllFrames();
      else if (m === 'new916' || m === 'new169') {
        stopPlay(); floating = null; hideSelbar(); await createProject(m === 'new916' ? 1080 : 1920, m === 'new916' ? 1920 : 1080); toast('Đã tạo dự án mới — dự án cũ vẫn giữ trong 📁 Dự án');
      }
    }));
  } });
});

