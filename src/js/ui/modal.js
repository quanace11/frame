/* ========= Modal ========= */
function modal({ title, html = '', buttons = [{ label: 'OK', value: true, primary: true }], onOpen, dismissable = true }) {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = '<div class="dlg"><h3></h3><div class="body"></div><div class="btns"></div></div>';
    ov.querySelector('h3').textContent = title; ov.querySelector('.body').innerHTML = html;
    const bx = ov.querySelector('.btns');
    let done = false;
    const close = v => { if (done) return; done = true; ov.remove(); res(v); };
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '') + (b.cls ? ' ' + b.cls : ''); el.textContent = b.label;
      el.addEventListener('click', async ev => { if (b.action) { const r = await b.action(ev); if (r === false) return; } close(b.value); });
      bx.append(el);
    });
    if (dismissable) ov.addEventListener('pointerdown', e => { if (e.target === ov) close(null); });
    document.body.append(ov);
    onOpen && onOpen(ov, close);
  });
}
function progress(text) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = '<div class="dlg" style="max-width:340px;text-align:center"><h3>Đang xử lý…</h3><div class="body"></div></div>';
  const b = ov.querySelector('.body'); b.textContent = text; document.body.append(ov);
  return { set: t => b.textContent = t, close: () => ov.remove() };
}

