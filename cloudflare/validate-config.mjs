import {readFile} from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const id = config.d1_databases?.find(database => database.binding === 'DB')?.database_id;
if (!id || id === '00000000-0000-0000-0000-000000000000') {
  console.error('尚未配置线上信箱：请先创建 D1 数据库，将数据库 ID 填入 wrangler.jsonc，再部署。');
  process.exit(1);
}
console.log('D1 configuration is ready. ADMIN_PASSWORD must be set as a Cloudflare secret before opening the inbox.');
