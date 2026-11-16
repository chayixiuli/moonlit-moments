"""Local preview with a persistent mailbox. Bind to loopback only; no public hosting."""
import argparse
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
DATA = ROOT / '.local'
DB = DATA / 'mailbox.sqlite3'
STATIC = {'index.html', 'rest.css', 'rest.js', 'mailbox.js',
          'inbox.html', 'inbox.js', 'mailbox.css'}


def connect():
    conn = sqlite3.connect(str(DB), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def setup():
    DATA.mkdir(exist_ok=True)
    with connect() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS letters (
            id TEXT PRIMARY KEY, client_id TEXT UNIQUE NOT NULL,
            nickname TEXT NOT NULL, message TEXT NOT NULL,
            created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0)''')


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def safe_request(self):
        hosts = {'127.0.0.1:' + str(self.server.server_port),
                 'localhost:' + str(self.server.server_port)}
        if self.headers.get('Host') not in hosts:
            self.reply(403, {'error': '请从本地预览地址打开。'})
            return False
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://' + host for host in hosts}:
            self.reply(403, {'error': '不接受其他网站的请求。'})
            return False
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.reply(403, {'error': '请从本地预览页面操作。'})
            return False
        return True

    def reply(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def admin_request(self):
        if self.headers.get('X-Local-Inbox') != 'preview':
            self.reply(403, {'error': '请使用本地收信预览。'})
            return False
        return True

    def read_json(self):
        if self.headers.get_content_type() != 'application/json':
            raise ValueError('请使用页面上的信箱寄信。')
        size = int(self.headers.get('Content-Length', '0'))
        if size < 1 or size > 12000:
            raise ValueError('信件太长了，请精简到 1000 字以内。')
        body = json.loads(self.rfile.read(size).decode('utf-8'))
        if not isinstance(body, dict):
            raise ValueError('信件格式不正确，请重新试试。')
        return body

    def do_GET(self):
        if not self.safe_request():
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/api/letters':
            if not self.admin_request():
                return
            with connect() as conn:
                rows = conn.execute('SELECT id, nickname, message, created_at, is_read '
                                    'FROM letters ORDER BY created_at DESC, rowid DESC').fetchall()
            self.reply(200, {'letters': [dict(row) for row in rows]})
            return
        if not self.static_allowed(path):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if self.safe_request():
            path = unquote(urlsplit(self.path).path)
            if not self.static_allowed(path):
                self.send_error(404)
                return
            super().do_HEAD()

    @staticmethod
    def static_allowed(path):
        parts = Path(path.lstrip('/')).parts
        if any(part.startswith('.') for part in parts) or '\\' in path:
            return False
        if path in ('/', '') or path.lstrip('/') in STATIC:
            return True
        target = (ROOT / path.lstrip('/')).resolve()
        return bool(parts and parts[0] == 'assets' and target.is_file()
                    and ROOT / 'assets' in target.parents)

    def do_POST(self):
        if not self.safe_request():
            return
        if urlsplit(self.path).path != '/api/letters':
            self.reply(404, {'error': '没有找到这个信箱。'})
            return
        try:
            body = self.read_json()
            nickname, message = body.get('nickname', ''), body.get('message', '')
            if not isinstance(nickname, str) or not isinstance(message, str):
                raise ValueError('请填写文字内容。')
            nickname, message = nickname.strip(), message.strip()
            if not message:
                raise ValueError('写几句话，再把信放进来吧。')
            if len(nickname) > 24 or len(message) > 1000:
                raise ValueError('称呼最多 24 字，来信最多 1000 字。')
            client_id = str(uuid.UUID(body.get('client_id', '')))
            letter_id = str(uuid.uuid4())
            with connect() as conn:
                conn.execute('INSERT OR IGNORE INTO letters '
                             '(id, client_id, nickname, message, created_at) VALUES (?, ?, ?, ?, ?)',
                             (letter_id, client_id, nickname or '一位来坐坐的朋友', message,
                              datetime.now(timezone.utc).isoformat()))
                row = conn.execute('SELECT id FROM letters WHERE client_id = ?',
                                   (client_id,)).fetchone()
            self.reply(201, {'id': row['id']})
        except (ValueError, TypeError, UnicodeError, AttributeError):
            self.reply(400, {'error': '请检查信件内容：称呼最多 24 字，来信 1—1000 字。'})
        except sqlite3.Error:
            self.reply(503, {'error': '信箱暂时没有收好，请保留文字，稍后再试。'})

    def change_letter(self, delete=False):
        if not self.safe_request() or not self.admin_request():
            return
        parts = urlsplit(self.path).path.strip('/').split('/')
        if len(parts) != 3 or parts[:2] != ['api', 'letters']:
            self.reply(404, {'error': '没有找到这封信。'})
            return
        try:
            letter_id = str(uuid.UUID(parts[2]))
        except ValueError:
            self.reply(404, {'error': '没有找到这封信。'})
            return
        with connect() as conn:
            if delete:
                result = conn.execute('DELETE FROM letters WHERE id = ?', (letter_id,))
            else:
                result = conn.execute('UPDATE letters SET is_read = 1 WHERE id = ?', (letter_id,))
        self.reply(200 if result.rowcount else 404,
                   {'ok': True} if result.rowcount else {'error': '这封信已不在信箱里。'})

    def do_PATCH(self):
        self.change_letter()

    def do_DELETE(self):
        self.change_letter(delete=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4175)
    args = parser.parse_args()
    os.chdir(str(ROOT))
    setup()
    print('Local: http://127.0.0.1:{}/'.format(args.port), flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
