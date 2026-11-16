import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker from './worker.mjs';

const schema = await readFile(new URL('./migrations/0001_letters.sql', import.meta.url), 'utf8');
const PASSWORD = 'test-only-password-not-for-deployment';
const ORIGIN = 'https://rest.example';
function setup() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(schema);
  const env = {
    ADMIN_PASSWORD: PASSWORD,
    DB: {prepare(sql) { let args = []; return {
      bind(...values) { args = values; return this; },
      async run() { const result = sqlite.prepare(sql).run(...args); return {meta:{changes:Number(result.changes)}}; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return {results:sqlite.prepare(sql).all(...args)}; }
    }; }},
    ASSETS: {async fetch(request) {return new Response('Asset: ' + new URL(request.url).pathname);}},
    MAIL_RATE_LIMITER: {async limit() {return {success:true};}},
    LOGIN_RATE_LIMITER: {async limit() {return {success:true};}}
  };
  const call = (path, options = {}) => worker.fetch(new Request(ORIGIN + path, options), env);
  const body = (data, headers = {}) => ({method:'POST',headers:{'Content-Type':'application/json','Origin':ORIGIN,...headers},body:JSON.stringify(data)});
  const send = (message = '一份暖暖的心情。', client_id = crypto.randomUUID()) => call('/api/letters',body({nickname:'小晴',message,client_id}));
  const login = async () => {
    const result = await call('/api/auth/login',body({password:PASSWORD}));
    assert.equal(result.status,200); return result.headers.get('Set-Cookie').split(';')[0];
  };
  return {env,sqlite,call,body,send,login};
}

test('anonymous submission persists in SQLite and identical retries store once', async () => {
  const {send,sqlite} = setup(), id = crypto.randomUUID();
  const a = await send('你好呀\n<文字会原样保存>',id), b = await send('你好呀\n<文字会原样保存>',id);
  assert.equal(a.status,201); assert.equal(b.status,201);
  assert.equal((await a.json()).id,(await b.json()).id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM letters').get().n,1);
  assert.equal((await send('不同内容',id)).status,409);
});

test('invalid or empty letters, oversized streamed body, and cross-site submissions are rejected', async () => {
  const {call,body,send} = setup();
  assert.equal((await send('  ')).status,400);
  assert.equal((await send('字'.repeat(1001))).status,400);
  assert.equal((await call('/api/letters',body({message:'a',client_id:'invalid'}))).status,400);
  assert.equal((await call('/api/letters',body({message:'a'.repeat(13000)}))).status,413);
  assert.equal((await call('/api/letters',body({}, {Origin:'https://other.example'}))).status,403);
  assert.equal((await call('/api/letters',{method:'POST',headers:{'Content-Type':'text/plain'},body:'x'})).status,415);
});

test('old local preview header cannot read, mark, or delete cloud mail', async () => {
  const {call,send} = setup(); const id = (await (await send()).json()).id;
  const headers = {'X-Local-Inbox':'preview'};
  assert.equal((await call('/api/letters',{headers})).status,405);
  for (const method of ['GET','PATCH','DELETE']) assert.equal((await call('/api/admin/letters/'+id,{method,headers})).status,401);
  assert.equal((await call('/api/admin/letters',{headers})).status,401);
});

test('all HTML inbox aliases require login, while browser scripts remain available', async () => {
  const {call} = setup();
  for (const path of ['/inbox','/inbox/','/inbox.html']) {
    const response = await call(path); assert.equal(response.status,303); assert.equal(response.headers.get('Location'),'/login');
  }
  assert.equal((await call('/inbox.js')).status,200);
  assert.equal((await call('/login.js')).status,200);
  assert.equal((await call('/login')).status,200);
  assert.equal(await (await call('/')).text(),'Asset: /index.html');
});

test('unconfigured or weak passwords fail closed even on direct inbox HTML', async () => {
  const {env,call,body} = setup();
  for (const password of [undefined,'short']) {
    env.ADMIN_PASSWORD = password;
    assert.equal((await call('/inbox.html')).status,503);
    assert.equal((await call('/api/auth/login',body({password:'short'}))).status,503);
    assert.equal((await call('/api/admin/letters')).status,503);
  }
});

test('successful login issues signed secure cookie and rejects incorrect password', async () => {
  const {call,body} = setup();
  assert.equal((await call('/api/auth/login',body({password:'wrong-password'}))).status,401);
  const response = await call('/api/auth/login',body({password:PASSWORD}));
  const cookie = response.headers.get('Set-Cookie');
  for (const part of ['__Host-rest-inbox=','HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=7200']) assert.ok(cookie.includes(part));
  assert.ok(!cookie.includes(PASSWORD));
  assert.equal((await call('/inbox.html',{headers:{Cookie:cookie.split(';')[0]}})).status,200);
});

test('tampered cookies, origin changes, and password rotation invalidate sessions', async () => {
  const {env,call,login} = setup(); const cookie = await login();
  const tampered = cookie.slice(0,-1) + (cookie.endsWith('a') ? 'b' : 'a');
  assert.equal((await call('/api/admin/letters',{headers:{Cookie:tampered}})).status,401);
  assert.equal((await worker.fetch(new Request('https://different.example/api/admin/letters',{headers:{Cookie:cookie}}),env)).status,401);
  env.ADMIN_PASSWORD = 'a-new-test-password-after-rotation';
  assert.equal((await call('/api/admin/letters',{headers:{Cookie:cookie}})).status,401);
});

test('expired sessions cannot read mail', async () => {
  const {call,login} = setup();
  const now = Date.now;
  let cookie;
  try { Date.now = () => now() - 3 * 60 * 60 * 1000; cookie = await login(); }
  finally { Date.now = now; }
  assert.equal((await call('/api/admin/letters',{headers:{Cookie:cookie}})).status,401);
});

test('authenticated mailbox can list, mark, delete, and reject cross-origin mutation', async () => {
  const {call,send,login} = setup(); const id = (await (await send()).json()).id; const Cookie = await login();
  let list = await (await call('/api/admin/letters',{headers:{Cookie}})).json();
  assert.equal(list.letters.length,1); assert.equal(list.letters[0].is_read,0);
  assert.equal((await call('/api/admin/letters/'+id,{method:'PATCH',headers:{Cookie,Origin:ORIGIN}})).status,200);
  list = await (await call('/api/admin/letters',{headers:{Cookie}})).json(); assert.equal(list.letters[0].is_read,1);
  assert.equal((await call('/api/admin/letters/'+id,{method:'DELETE',headers:{Cookie,Origin:'https://other.example'}})).status,403);
  assert.equal((await call('/api/admin/letters/'+id,{method:'DELETE',headers:{Cookie,Origin:ORIGIN}})).status,200);
  assert.equal((await call('/api/admin/letters/'+id,{method:'DELETE',headers:{Cookie}})).status,404);
});

test('large inbox has cursor pagination without dropping or duplicating letters', async () => {
  const {sqlite,call,login} = setup();
  const insert = sqlite.prepare('INSERT INTO letters (id,client_id,nickname,message,created_at) VALUES (?,?,?,?,?)');
  for(let i=0;i<205;i++) insert.run(crypto.randomUUID(),crypto.randomUUID(),'朋友','你好',new Date().toISOString());
  const Cookie = await login();
  const first = await (await call('/api/admin/letters',{headers:{Cookie}})).json();
  assert.equal(first.letters.length,200); assert.ok(first.next);
  const second = await (await call('/api/admin/letters?after='+first.next,{headers:{Cookie}})).json();
  assert.equal(second.letters.length,5); assert.equal(second.next,null);
  assert.equal(new Set([...first.letters,...second.letters].map(letter=>letter.id)).size,205);
});

test('rate limits block submissions and login, and logout expires cookie', async () => {
  const {env,call,body,send} = setup();
  env.MAIL_RATE_LIMITER = env.LOGIN_RATE_LIMITER = {async limit(){return {success:false};}};
  const response = await send(); assert.equal(response.status,429); assert.equal(response.headers.get('Retry-After'),'60');
  assert.equal((await call('/api/auth/login',body({password:PASSWORD}))).status,429);
  const logout = await call('/api/auth/logout',{method:'POST',headers:{Origin:ORIGIN}});
  assert.equal(logout.status,200); assert.ok(logout.headers.get('Set-Cookie').includes('Max-Age=0'));
});

test('missing database and missing rate limiter do not silently accept mail', async () => {
  const {env,send} = setup(); const db = env.DB;
  env.DB = undefined; assert.equal((await send()).status,503);
  env.DB = db; env.MAIL_RATE_LIMITER = undefined; assert.equal((await send()).status,503);
});

test('deploy config protects HTML aliases and upload assets exclude local/private files', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.assets.html_handling,'none');
  assert.ok(config.assets.run_worker_first.includes('/inbox*'));
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
  const inbox = await readFile(new URL('../public/inbox.html',import.meta.url),'utf8');
  assert.ok(inbox.includes('data-inbox-mode="cloud"')); assert.ok(!inbox.includes('本地体验'));
  assert.ok(inbox.includes('logout-inbox'));
});
