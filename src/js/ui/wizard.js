/* ========= Beginner wizard ========= */
async function wizard() {
  if (playing) stopPlay();
  const hasChar = !!(S.pp && S.pp.parts.length), hasAnim = S.frames.length > 1, hasFx = S.frames.some(f => (f.texts && f.texts.length) || f.cam || f.shake) || hasAudio(), exported = !!S.exported;
  const step = (n, title, done, desc, btns) => `<div class="wstep ${done ? 'done' : ''}"><h4>${done ? '✅' : n + '.'} ${title}</h4><div class="lbl" style="font-size:13px;line-height:1.45">${desc}</div><div class="wb">${btns}</div></div>`;
  const B = (id, label, primary) => `<button class="btn ${primary ? 'primary' : ''}" data-wz="${id}">${label}</button>`;
  const html = `<p style="margin-top:0">Làm theo 5 bước, mỗi bước bấm 1 nút. Mở lại bảng này bất cứ lúc nào bằng nút <b>🚀</b> ở thanh trên.</p><div id="wizSteps">
  ${step(1, 'Đưa nhân vật vào', hasChar, 'Tạo ảnh nhân vật bằng AI (đứng thẳng, nhìn thẳng, tay hơi dang, nền trơn) rồi nhập vào. App tự xoá nền, tự đặt khớp — bạn chỉ cần kéo chỉnh chấm trắng rồi bấm <b>✂ Cắt tự động</b>. App tô mỗi phần một màu: chỗ nào chia sai (tay dính vào thân…) thì chọn tên phần rồi tô lại, xong bấm <b>✓ Cắt thành mảnh</b>.', B('char', '📷 Chọn ảnh nhân vật', !hasChar) + B('aichar', '🤖 AI vẽ từ ảnh chụp'))}
  ${step(2, 'Cho nhân vật cử động', hasAnim, 'Chọn một hành động có sẵn — app tự tạo các frame. Muốn tự tạo dáng: dùng tab 🤸 Tạo dáng, kéo tay chân, rồi 🎞 Tạo frame giữa.', [['walk', '🚶 Đi bộ'], ['run', '🏃 Chạy'], ['wave', '👋 Vẫy tay'], ['jump', '🦘 Nhảy'], ['cheer', '🙌 Ăn mừng'], ['nod', '🙂 Gật đầu'], ['talk', '🗣 Nói']].map(([k, l]) => B('act:' + k, l)).join('') + B('pose', '🤸 Tự tạo dáng'))}
  ${step(3, 'Thêm nền, chữ, camera, âm thanh', hasFx, 'Nền vẽ sẵn (phòng, lớp học, phố, biển…), chữ kiểu truyện tranh, zoom vào mặt, rung khung, nhạc nền, lồng tiếng — app tự nhép miệng theo giọng.', B('scene', '🏞 Nền vẽ sẵn') + B('text', '🔤 Thêm chữ') + B('zoom', '🎥 Zoom vào') + B('music', '🎵 Nhạc nền') + B('voice', '🎤 Lồng tiếng') + B('sfx', '🔊 Âm thanh vui') + B('ball', '⚽ Bóng bay') + B('gag', '⚡ Combo hài'))}
  ${step(4, 'Xem lại', false, 'Bấm Phát để xem. Sửa frame nào thì chạm frame đó ở dưới.', B('play', '▶ Phát thử'))}
  ${step(5, 'Xuất video', exported, 'Xuất video có tiếng để đăng YouTube Shorts / TikTok.', B('video', '🎬 Xuất video', hasAnim))}</div>`;
  modal({ title: '🚀 Làm video nhanh', html, buttons: [{ label: 'Đóng', value: null }], onOpen: (ov, close) => {
    ov.querySelector('.dlg').classList.add('wide');
    ov.querySelectorAll('[data-wz]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.wz; close();
      if (k === 'char') { wizImport = true; $('#imgFile').click(); }
      else if (k === 'aichar') aiCharDialog();
      else if (k.startsWith('act:')) {
        if (!S.pp) { toast('Làm bước 1 trước: đưa nhân vật vào'); return; }
        const a = k.slice(4); setTool('puppet'); openTab('pp', 'frames');
        if (a === 'cheer') { ppApplyPose('b:cheer'); ppPreset = 'jump'; } else ppPreset = a;
        const d = PP_PRESETS[ppPreset]; $('#ppPN').value = d[1]; $('#ppPDur').value = d[2];
        await ppMakePreset(); setTimeout(startPlay, 300);
      }
      else if (k === 'pose') { if (!S.pp) { toast('Làm bước 1 trước'); return; } setTool('puppet'); openTab('pp', 'pose'); toast('Chạm tay/chân rồi kéo để xoay; chọn "Kéo tay chân (IK)" để kéo bàn tay', 4000); }
      else if (k === 'scene') sceneDialog();
      else if (k === 'text') { setTool('fx'); openTab('fx', 'text'); fxAddText(); }
      else if (k === 'zoom') { setTool('fx'); openTab('fx', 'cam'); fxCamPick = true; fxSyncBar(); toast('Chạm lên mặt nhân vật để camera zoom vào frame này', 4000); }
      else if (k === 'music') { setTool('fx'); openTab('fx', 'audio'); $('#musicFile').click(); }
      else if (k === 'voice') { setTool('fx'); openTab('fx', 'audio'); $('#voiceFile').click(); }
      else if (k === 'ball') { setTool('fx'); openTab('fx', 'gag'); ballModeSet(true); }
      else if (k === 'gag') { setTool('fx'); openTab('fx', 'gag'); toast('Chọn 1 combo (😱 Sốc, 🤕 Bóng vào mặt, 🥅 VÀO!…) rồi chạm lên khung', 3500); }
      else if (k === 'sfx') { setTool('fx'); openTab('fx', 'audio'); toast('Chạm một âm thanh để gắn vào frame đang xem', 3000); }
      else if (k === 'play') startPlay();
      else if (k === 'video') exportVideoAsk();
    }));
  } });
}
let wizImport = false;

