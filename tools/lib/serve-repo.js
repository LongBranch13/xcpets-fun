/* Serve the repo checkout to a Playwright page without a real HTTP server: every http://localhost:8099/<path> request is
 * fulfilled from the repo root on disk (extra = { '/path': 'html body' } for in-memory harness pages). Before this, the
 * wallet tests needed a separately started `python3 -m http.server 8099`, which CI never had (and the box had one serving
 * an old worktree), so the scripts 404'd in CI and V2Wallet was undefined. No socket is opened, so no port is used. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.txt': 'text/plain' };
module.exports = async function serveRepo(pg, extra = {}, origin = 'http://localhost:8099') {
  await pg.route(u => u.href.startsWith(origin + '/'), r => {
    const p = decodeURIComponent(new URL(r.request().url()).pathname);
    if (Object.prototype.hasOwnProperty.call(extra, p)) return r.fulfill({ contentType: 'text/html', body: extra[p] });
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
};
