import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public');
await mkdir(path.join(output, 'assets'), {recursive: true});
const files = ['index.html', 'rest.css', 'rest.js', 'mailbox.css', 'mailbox.js', 'inbox.html', 'inbox.js', 'login.html', 'login.js'];
for (const name of files) {
  let content = await readFile(path.join(root, name), 'utf8');
  if (name === 'inbox.html') content = content.replace('<body>', '<body data-inbox-mode="cloud">').replace('<span class="preview-badge">本地收信预览</span>', '<span class="preview-badge">主人收信箱</span>')
    .replace('本地体验：信件保存在这台电脑；上线前还会加上主人登录保护。', '这里的来信，只留给小家的主人慢慢读。')
    .replace('删除后，这封信就不在本地信箱里了。', '删除后，这封信就不在信箱里了。')
    .replace('<button class="text-button" id="refresh-inbox"', '<button class="text-button" id="logout-inbox" type="button">退出登录</button><button class="text-button" id="refresh-inbox"');
  await writeFile(path.join(output, name), content);
}
// Copy only the two illustrations displayed on the site. No local database,
// reference photos, source-history artwork, screenshots, or Python server files.
for (const name of ['home-pets.svg', 'pet-friends.svg']) {
  await copyFile(path.join(root, 'assets', name), path.join(output, 'assets', name));
}
await writeFile(path.join(output, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`);
console.log('Prepared public assets and private inbox routes.');
