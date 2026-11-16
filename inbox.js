(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const cloudInbox = document.body.dataset.inboxMode === 'cloud';
  let letters = [], selectedId = null, unreadOnly = false, pendingDelete = null, busy = false;
  const status = $('#inbox-status');
  const date = value => new Date(value).toLocaleString('zh-CN', {year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false});
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  async function api(path = '', options = {}) {
    const response = await fetch((cloudInbox ? '/api/admin/letters' : '/api/letters') + path, {
      ...options, headers: cloudInbox ? {} : {'X-Local-Inbox': 'preview'}, signal: AbortSignal.timeout(10000)
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('信箱暂时没有打开，请刷新试试。'); }
    if (response.status === 401 && cloudInbox) { location.replace('/login'); throw new Error('请重新登录收信箱。'); }
    if (!response.ok) throw new Error(data.error || '信箱暂时没打开，请稍后重试。');
    return data;
  }
  function failure(error) {
    status.classList.add('inbox-error');
    status.textContent = error.name === 'TypeError' || error.name === 'TimeoutError'
      ? '暂时没有连上信箱，请稍后刷新。' : error.message;
  }
  function counts() {
    $('#all-count').textContent = letters.length;
    $('#unread-count').textContent = letters.filter(letter => !letter.is_read).length;
    $('#export-letters').disabled = !letters.length;
  }
  function renderList() {
    counts();
    $('#filter-all').setAttribute('aria-pressed', String(!unreadOnly));
    $('#filter-unread').setAttribute('aria-pressed', String(unreadOnly));
    const list = $('#letter-list');
    list.replaceChildren();
    const filtered = letters.filter(letter => !unreadOnly || !letter.is_read);
    if (!filtered.length) {
      list.append(element('li', unreadOnly ? '未读信件都看完啦。' : '还没有来信，试着给小家写一封吧。', 'list-empty'));
      return;
    }
    filtered.forEach(letter => {
      const item = element('li');
      const button = element('button', undefined, 'letter-row');
      button.type = 'button';
      button.setAttribute('aria-current', String(letter.id === selectedId));
      const name = element('strong');
      if (!letter.is_read) {
        const dot = element('span', undefined, 'unread-dot');
        dot.setAttribute('aria-hidden', 'true'); name.append(dot);
        const marker = element('span', '未读：', 'sr-only'); name.append(marker);
      }
      name.append(document.createTextNode(letter.nickname));
      const timestamp = element('time', date(letter.created_at));
      timestamp.dateTime = letter.created_at;
      button.append(name, element('p', letter.message.replace(/\s+/g, ' ')), timestamp);
      button.addEventListener('click', () => openLetter(letter.id));
      item.append(button); list.append(item);
    });
  }
  function renderReader() {
    const reader = $('#inbox-reader');
    reader.replaceChildren();
    const letter = letters.find(item => item.id === selectedId);
    if (!letter) {
      const empty = element('div', undefined, 'reader-empty');
      const icon = element('span', '✉'); icon.setAttribute('aria-hidden', 'true');
      empty.append(icon, element('h2', letters.length ? '选一封来信，慢慢读。' : '小信箱已经准备好啦。'),
        element('p', letters.length ? '每一封，都藏着一份想分享的心情。' : '收到来信后，就能在这里慢慢读。'));
      reader.append(empty); return;
    }
    const line = element('div', undefined, 'letter-topline');
    line.append(element('span', 'TO / 歇一会儿'), element('span', 'a little hello.'));
    const head = element('div', undefined, 'letter-reader-head');
    const from = element('div'); const title = element('h2', letter.nickname + ' 的来信');
    title.id = 'reader-title'; title.tabIndex = -1;
    const timestamp = element('time', date(letter.created_at)); timestamp.dateTime = letter.created_at;
    from.append(title, timestamp);
    const remove = element('button', '删除', 'text-button delete-letter'); remove.type = 'button';
    remove.addEventListener('click', () => { pendingDelete = letter.id; $('#delete-dialog').showModal(); });
    head.append(from, remove);
    reader.append(line, head, element('p', letter.message, 'reader-body'), element('p', '来自小家的一次相遇 ♡', 'reader-sign'));
  }
  async function openLetter(id) {
    if (busy) return;
    const letter = letters.find(item => item.id === id);
    if (!letter) return;
    busy = true;
    try {
      if (!letter.is_read) {
        await api('/' + id, {method: 'PATCH'});
        letter.is_read = 1;
      }
      selectedId = id; renderList(); renderReader();
      status.classList.remove('inbox-error'); status.textContent = '这封信，已经替你好好收着了。';
      $('#reader-title').focus({preventScroll: true});
      if (matchMedia('(max-width:760px)').matches) $('#inbox-reader').scrollIntoView({behavior:'smooth', block:'start'});
    } catch (error) { failure(error); }
    finally { busy = false; }
  }
  async function load() {
    if (busy) return;
    busy = true; $('#refresh-inbox').disabled = true;
    status.classList.remove('inbox-error'); status.textContent = '正在打开小信箱…';
    try {
      const collected = []; let cursor = '';
      do {
        const data = await api(cursor ? '?after=' + encodeURIComponent(cursor) : '');
        collected.push(...data.letters); cursor = data.next || '';
      } while (cursor);
      letters = collected.sort((a,b) => b.created_at.localeCompare(a.created_at));
      if (!letters.some(letter => letter.id === selectedId)) selectedId = null;
      renderList(); renderReader();
      status.textContent = letters.length ? `收好 ${letters.length} 封来信，其中 ${letters.filter(letter => !letter.is_read).length} 封还没拆开。` : '信箱空空的，正等着第一声「你好」。';
    } catch (error) { failure(error); }
    finally { busy = false; $('#refresh-inbox').disabled = false; }
  }
  $('#refresh-inbox').addEventListener('click', load);
  $('#filter-all').addEventListener('click', () => { unreadOnly = false; renderList(); });
  $('#filter-unread').addEventListener('click', () => { unreadOnly = true; renderList(); });
  $('#cancel-delete').addEventListener('click', () => $('#delete-dialog').close());
  $('#delete-dialog').addEventListener('close', () => { pendingDelete = null; });
  $('#confirm-delete').addEventListener('click', async () => {
    if (!pendingDelete || busy) return;
    const id = pendingDelete;
    busy = true; $('#confirm-delete').disabled = true;
    try {
      await api('/' + id, {method: 'DELETE'});
      letters = letters.filter(letter => letter.id !== id);
      if (selectedId === id) selectedId = null;
      $('#delete-dialog').close(); renderList(); renderReader();
      status.classList.remove('inbox-error'); status.textContent = '这封信已从信箱删除。';
      $('#refresh-inbox').focus();
    } catch (error) { $('#delete-dialog').close(); failure(error); }
    finally { busy = false; $('#confirm-delete').disabled = false; }
  });
  $('#export-letters').addEventListener('click', () => {
    const text = letters.map(letter => `来自：${letter.nickname}\n时间：${date(letter.created_at)}\n状态：${letter.is_read ? '已读' : '未读'}\n\n${letter.message}`).join('\n\n————————————\n\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], {type:'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = `小家的来信-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.classList.remove('inbox-error'); status.textContent = '信件已整理好，请查看浏览器的下载文件。';
  });
  $('#logout-inbox')?.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', {method:'POST'});
      if (!response.ok) throw new Error('退出未完成，请再试一次。');
      location.replace('/login');
    } catch (error) { failure(error); }
  });
  load();
})();
