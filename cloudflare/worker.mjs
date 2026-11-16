const encoder = new TextEncoder();
const SESSION_COOKIE = '__Host-rest-inbox';
const SESSION_SECONDS = 7200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers
  }});
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new HttpError(403, '请从小家的页面操作。');
  }
}

async function readJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, '请通过页面提交文字。');
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > 12000) throw new HttpError(413, '内容太长了，请精简后再试。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '请填写内容后再试。');
  const chunks = []; let length = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 12000) { await reader.cancel(); throw new HttpError(413, '内容太长了，请精简后再试。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new HttpError(400, '内容格式不正确，请重新试试。'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, '内容格式不正确。');
  return body;
}

function requireDb(env) {
  if (!env.DB) throw new HttpError(503, '信箱还在准备中，文字可以先留着，稍后再来。');
}

function requireSecret(env) {
  if (typeof env.ADMIN_PASSWORD !== 'string' || env.ADMIN_PASSWORD.length < 16) {
    throw new HttpError(503, '收信箱尚未开放，请先设置管理员密码。');
  }
}

async function rateLimit(request, env, kind) {
  const limiter = kind === 'login' ? env.LOGIN_RATE_LIMITER : env.MAIL_RATE_LIMITER;
  if (!limiter) throw new HttpError(503, '信箱还在准备中，请稍后再试。');
  const ip = request.headers.get('CF-Connecting-IP') || 'local-preview';
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(kind + ':' + ip));
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const result = await limiter.limit({key});
  if (!result.success) throw new HttpError(429, kind === 'login' ? '尝试有点频繁，请过一分钟再登录。' : '小信箱正在整理来信，过一分钟再投递吧。');
}

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode('rest-inbox-session-v1:' + env.ADMIN_PASSWORD),
    {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}

function hex(bytes) { return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''); }

async function passwordMatches(candidate, expected) {
  const [a, b] = await Promise.all([candidate, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}

async function createSession(env, origin) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${expires}.${crypto.randomUUID()}`;
  const signature = hex(await crypto.subtle.sign('HMAC', await hmacKey(env), encoder.encode(origin + ':' + payload)));
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

async function authorized(request, env) {
  requireSecret(env);
  const token = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
  if (!token || token.length > 180) return false;
  const [expires, nonce, signature, extra] = token.split('.');
  if (extra || !/^\d{10}$/.test(expires) || !UUID.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + SESSION_SECONDS) return false;
  const bytes = Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await hmacKey(env), bytes,
    encoder.encode(new URL(request.url).origin + ':' + expires + '.' + nonce));
}

async function sendLetter(request, env) {
  sameOrigin(request); requireDb(env);
  await rateLimit(request, env, 'mail');
  const body = await readJson(request);
  if (typeof body.message !== 'string' || typeof (body.nickname ?? '') !== 'string' || !UUID.test(body.client_id || '')) {
    throw new HttpError(400, '请填写文字内容后再试。');
  }
  const nickname = (body.nickname || '').trim(), message = body.message.trim();
  if (!message || Array.from(message).length > 1000 || Array.from(nickname).length > 24) {
    throw new HttpError(400, '称呼最多 24 字，来信 1—1000 字。');
  }
  // Only the public submission route is available without signing in.
  // A retry with identical content returns the same receipt, without storing twice.
  const clientId = body.client_id.toLowerCase();
  await env.DB.prepare('INSERT OR IGNORE INTO letters (id, client_id, nickname, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), clientId, nickname || '一位来坐坐的朋友', message, new Date().toISOString()).run();
  const letter = await env.DB.prepare('SELECT id, nickname, message FROM letters WHERE client_id = ?').bind(clientId).first();
  if (letter.message !== message || letter.nickname !== (nickname || '一位来坐坐的朋友')) {
    throw new HttpError(409, '这张信纸已经寄出，请重新打开页面再写一封。');
  }
  return json({id: letter.id}, 201);
}

async function adminApi(request, env, url) {
  sameOrigin(request);
  if (!await authorized(request, env)) throw new HttpError(401, '请先登录小家的收信箱。');
  requireDb(env);
  if (url.pathname === '/api/admin/letters' && request.method === 'GET') {
    const after = url.searchParams.get('after') || '';
    if (after && !UUID.test(after)) throw new HttpError(400, '分页标记无效。');
    const {results} = await env.DB.prepare('SELECT id, nickname, message, created_at, is_read FROM letters WHERE id > ? ORDER BY id LIMIT 201')
      .bind(after).all();
    const letters = results.slice(0, 200);
    return json({letters, next: results.length > 200 ? letters[letters.length - 1].id : null});
  }
  const id = url.pathname.match(/^\/api\/admin\/letters\/([a-f0-9-]+)$/i)?.[1];
  if (!UUID.test(id || '')) throw new HttpError(404, '没有找到这封信。');
  let result;
  if (request.method === 'PATCH') result = await env.DB.prepare('UPDATE letters SET is_read = 1 WHERE id = ?').bind(id).run();
  else if (request.method === 'DELETE') result = await env.DB.prepare('DELETE FROM letters WHERE id = ?').bind(id).run();
  else throw new HttpError(405, '不支持这个操作。');
  if (!result.meta.changes) throw new HttpError(404, '这封信已不在信箱里。');
  return json({ok: true});
}

function protectedAsset(request, env, path) {
  const url = new URL(request.url); url.pathname = path;
  return env.ASSETS.fetch(new Request(url, {method: request.method === 'HEAD' ? 'HEAD' : 'GET'})).then(response => {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store'); headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(response.body, {status: response.status, headers});
  });
}

async function route(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/api/letters') {
    if (request.method !== 'POST') throw new HttpError(405, '这个入口只接收来信。');
    return sendLetter(request, env);
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    sameOrigin(request); requireSecret(env); await rateLimit(request, env, 'login');
    const body = await readJson(request);
    if (typeof body.password !== 'string' || body.password.length > 256 || !await passwordMatches(body.password, env.ADMIN_PASSWORD)) {
      throw new HttpError(401, '密码不正确，再试一次吧。');
    }
    return json({ok: true}, 200, {'Set-Cookie': await createSession(env, url.origin)});
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    sameOrigin(request);
    return json({ok: true}, 200, {'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
  }
  if (path.startsWith('/api/admin/')) return adminApi(request, env, url);
  if (path.startsWith('/api/')) throw new HttpError(404, '没有找到这个入口。');
  if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, '不支持这个操作。');
  if (path === '/') { url.pathname = '/index.html'; return env.ASSETS.fetch(new Request(url, request)); }
  if (['/inbox.js', '/login.js'].includes(path)) return env.ASSETS.fetch(request);
  if (['/inbox', '/inbox/', '/inbox.html'].includes(path)) {
    if (!await authorized(request, env)) return new Response(null, {status: 303, headers: {Location: '/login', 'Cache-Control': 'no-store'}});
    return protectedAsset(request, env, '/inbox.html');
  }
  if (['/login', '/login/', '/login.html'].includes(path)) return protectedAsset(request, env, '/login.html');
  if (path.startsWith('/inbox') || path.startsWith('/login')) throw new HttpError(404, '没有找到这个页面。');
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) {
      if (error instanceof HttpError) return json({error: error.message}, error.status, error.status === 429 ? {'Retry-After': '60'} : {});
      // Do not log requests, passwords, letter contents, or database error payloads.
      return json({error: '信箱暂时没打开，请保留文字，稍后再试。'}, 503);
    }
  }
};
