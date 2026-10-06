#!/usr/bin/env node
// 把这份 kit（本文件所在目录）装成 <target>/.gauntlet/。
//   bash:       node "$DSH_GAUNTLET_KIT_DIR/install-kit.mjs" [target-repo-dir]
//   PowerShell: node "$env:DSH_GAUNTLET_KIT_DIR/install-kit.mjs" [target-repo-dir]
// 与 scripts/install-kit.mjs 等价，但以 kit 自身为源，供 dsh 插件离线调用。
// 本文件是插件独有的（上游 kit 没有），scripts/sync-kit.mjs 同步时会保留它。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NODE_MIN = (() => {
  const [a, b] = process.versions.node.split('.').map(Number);
  return a > 20 || (a === 20 && b >= 1) || (a === 18 && b >= 17);
})();
if (!NODE_MIN) {
  console.error(`需要 Node.js 18.17+（或 20.1+），当前是 ${process.version}`);
  process.exit(2);
}

const src = path.dirname(fileURLToPath(import.meta.url)); // kit/
const target = path.resolve(process.argv[2] || '.');
const dst = path.join(target, '.gauntlet');

if (!fs.existsSync(path.join(src, 'gauntlet.mjs'))) {
  console.error(`kit not found at ${src}`);
  process.exit(1);
}
if (path.resolve(dst).startsWith(path.resolve(src))) {
  console.error('refusing to install the kit into itself');
  process.exit(1);
}

fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, {
  recursive: true,
  // 装进去的工具里不需要这个安装器，也不需要同步清单
  filter: (p) => !['install-kit.mjs', '.sync.json'].includes(path.basename(p)),
});
const version = fs.readFileSync(path.join(src, 'VERSION'), 'utf8').trim();
console.log(`installed gauntlet kit ${version} -> ${dst}`);
console.log(`next: cd ${target} && node .gauntlet/gauntlet.mjs survey`);
