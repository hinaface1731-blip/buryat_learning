// Локальная проверка сборки так, как её отдаёт GitHub Pages: dist/ под /buryat_learning/,
// путь без расширения → .html, остальное → 404.html. (expo serve отдаёт сайт с корня и с baseUrl не работает.)
//
//   npm run serve:web   → http://localhost:8081/buryat_learning/

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const DIST = path.resolve(__dirname, '..', 'dist');
const BASE = '/buryat_learning';
const PORT = Number(process.env.PORT ?? 8081);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const send = (file, code) => {
      res.writeHead(code, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    };
    if (url === BASE || url.startsWith(`${BASE}/`)) {
      const target = path.join(DIST, url.slice(BASE.length));
      if (target.startsWith(DIST)) {
        for (const candidate of [target, `${target}.html`, path.join(target, 'index.html')]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return send(candidate, 200);
        }
      }
    }
    // 404.html копирует только predeploy; после простого build:web есть лишь исходная страница.
    const notFound = path.join(DIST, '404.html');
    send(fs.existsSync(notFound) ? notFound : path.join(DIST, '+not-found.html'), 404);
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}${BASE}/`));
