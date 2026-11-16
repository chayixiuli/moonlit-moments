(() => {
  'use strict';
  const form = document.querySelector('#letter-form');
  const message = document.querySelector('#letter-message');
  const nickname = document.querySelector('#letter-nickname');
  const submit = document.querySelector('#send-letter');
  const status = document.querySelector('#letter-status');
  const success = document.querySelector('#letter-success');
  const count = document.querySelector('#letter-count');
  const newId = () => crypto.randomUUID();
  let clientId = newId(), lastContent = '', sending = false;
  message.addEventListener('input', () => {
    count.textContent = `${message.value.length} / 1000`;
    message.setCustomValidity('');
    status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    if (!message.value.trim()) {
      message.setCustomValidity('写几句话，再把信放进来吧。');
      message.reportValidity();
      return;
    }
    const content = {nickname: nickname.value.trim(), message: message.value.trim()};
    const signature = JSON.stringify(content);
    if (signature !== lastContent) { clientId = newId(); lastContent = signature; }
    sending = true;
    submit.disabled = true;
    nickname.readOnly = message.readOnly = true;
    submit.textContent = '正在把信放好…';
    status.textContent = '';
    try {
      const response = await fetch('/api/letters', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...content, client_id: clientId}),
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || '信还没有寄出，请稍后再试。');
      form.hidden = true;
      success.hidden = false;
      document.querySelector('#letter-success-title').focus();
    } catch (error) {
      status.textContent = error instanceof SyntaxError || error.name === 'TypeError'
        ? '信箱暂时没有连接上，文字还在，可以稍后再试。'
        : error.name === 'TimeoutError'
          ? '这次等待有点久，文字还在。再试一次也不会重复收信。'
          : error.message;
    } finally {
      sending = false;
      submit.disabled = false;
      nickname.readOnly = message.readOnly = false;
      submit.innerHTML = '把信放进小信箱 <span aria-hidden="true">↗</span>';
    }
  });
  document.querySelector('#write-again').addEventListener('click', () => {
    form.reset();
    message.setCustomValidity('');
    clientId = newId(); lastContent = '';
    count.textContent = '0 / 1000';
    success.hidden = true;
    form.hidden = false;
    message.focus();
  });
})();
