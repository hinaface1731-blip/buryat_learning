// Публикует dist/ в ветку gh-pages: ветка каждый раз создаётся заново только из сборки.
// Пакет gh-pages не подошёл: он клонирует main и оставляет файлы с точкой, а унаследованный
// .gitignore отбрасывает assets/node_modules/ — там лежат шрифты сайта.
//
//   npm run deploy   (сборка выполняется в predeploy)

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const git = (args, cwd = DIST) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Нет dist/index.html: сначала соберите сайт (npm run build:web).');
  process.exit(1);
}

const remote = git(['remote', 'get-url', 'origin'], ROOT);
const source = git(['rev-parse', '--short', 'HEAD'], ROOT);

// Jekyll на GitHub Pages игнорирует папки с подчёркиванием, а сборка лежит в _expo/.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

fs.rmSync(path.join(DIST, '.git'), { recursive: true, force: true });
try {
  git(['init', '-q', '-b', 'gh-pages']);
  git(['add', '--force', '.']);
  git(['commit', '-q', '-m', `Сборка сайта из ${source}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
  execFileSync('git', ['push', '--force', remote, 'gh-pages'], { cwd: DIST, stdio: 'inherit' });
} finally {
  fs.rmSync(path.join(DIST, '.git'), { recursive: true, force: true });
}
console.log(`Опубликовано: ${source} → gh-pages`);
