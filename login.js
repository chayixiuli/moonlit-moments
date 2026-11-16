(() => {
  const form = document.querySelector('#login-form');
  const password = document.querySelector('#admin-password');
  const submit = document.querySelector('#login-submit');
  const status = document.querySelector('#login-status');
  let busy = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true; submit.disabled = true; password.readOnly = true;
    submit.textContent = '正在打开小信箱…'; status.textContent = '';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: password.value}), signal: AbortSignal.timeout(10000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '暂时没有打开信箱，请稍后再试。');
      password.value = ''; location.replace('/inbox');
    } catch (error) {
      status.textContent = ['TypeError', 'TimeoutError', 'SyntaxError'].includes(error.name) ? '信箱暂时没有连上，请稍后再试。' : error.message;
    } finally { busy = false; submit.disabled = false; password.readOnly = false; submit.innerHTML = '打开收信箱 <span aria-hidden="true">↗</span>'; }
  });
})();
