#!/usr/bin/env node
// 从上游 multica-crap-agents 同步 kit/。kit/ 在本仓库里从不直接修改，只通过本脚本更新。
//   node scripts/sync-kit.mjs <multica-crap-agents 仓库目录>
//   node scripts/sync-kit.mjs --init     只为当前 kit/ 记录清单（第一次接入时用）
//
// kit/.sync.json 记录上次同步时每个文件的 sha256。同步前先核对：本仓库的 kit/ 若与清单不符
// （有人在这里直接改了 kit），拒绝同步——先把改动做到上游，再来同步。
// install-kit.mjs 是本插件独有的文件（上游没有），同步时保留、不进清单。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(ROOT, 'kit');
const MANIFEST = path.join(KIT, '.sync.json');
const LOCAL_ONLY = new Set(['install-kit.mjs', '.sync.json']);

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    const rel = path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/');
    if (!LOCAL_ONLY.has(rel)) out.push(rel);
  }
  return out.sort();
}

// LF-normalise text so a CRLF checkout on Windows hashes the same as upstream.
const hash = (file) => {
  const buf = fs.readFileSync(file);
  const text = buf.includes(0) ? buf : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
  return crypto.createHash('sha256').update(text).digest('hex');
};
const snapshot = (dir) => Object.fromEntries(listFiles(dir).map((f) => [f, hash(path.join(dir, f))]));
const version = (dir) => fs.readFileSync(path.join(dir, 'VERSION'), 'utf8').trim();

function writeManifest(files, from) {
  fs.writeFileSync(MANIFEST, JSON.stringify({ version: version(KIT), from, files }, null, 2) + '\n');
}

function localEdits() {
  if (!fs.existsSync(MANIFEST)) return null;
  const recorded = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files;
  const now = snapshot(KIT);
  const names = new Set([...Object.keys(recorded), ...Object.keys(now)]);
  return [...names].filter((f) => recorded[f] !== now[f]).sort();
}

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/sync-kit.mjs <multica-crap-agents 目录> | --init');
  process.exit(2);
}

if (arg === '--init') {
  writeManifest(snapshot(KIT), 'init');
  console.log(`recorded kit ${version(KIT)} (${listFiles(KIT).length} files) -> kit/.sync.json`);
  process.exit(0);
}

const upstreamKit = path.join(path.resolve(arg), 'kit');
if (!fs.existsSync(path.join(upstreamKit, 'gauntlet.mjs'))) {
  console.error(`上游 kit 不存在：${upstreamKit}`);
  process.exit(1);
}

const edits = localEdits();
if (edits === null) {
  console.error('kit/.sync.json 不存在：先确认本仓库 kit/ 与某个上游版本一致，再运行 --init。');
  process.exit(1);
}
if (edits.length) {
  console.error('本仓库的 kit/ 在上次同步后被直接修改过，拒绝同步（先把这些改动做到上游）：');
  for (const f of edits) console.error(`  ${f}`);
  process.exit(1);
}

const before = version(KIT);
for (const f of listFiles(KIT)) fs.rmSync(path.join(KIT, f));
fs.cpSync(upstreamKit, KIT, { recursive: true, filter: (p) => !LOCAL_ONLY.has(path.basename(p)) });
// cpSync leaves now-empty directories from removed files behind; prune them.
for (const e of fs.readdirSync(KIT, { withFileTypes: true, recursive: true }).reverse()) {
  const p = path.join(e.parentPath ?? e.path, e.name);
  if (e.isDirectory() && fs.readdirSync(p).length === 0) fs.rmdirSync(p);
}
const commit = spawnSync('git', ['-C', path.resolve(arg), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout?.trim();
writeManifest(snapshot(KIT), `multica-crap-agents@${commit || 'unknown'}`);
console.log(`kit ${before} -> ${version(KIT)}（${listFiles(KIT).length} 个文件，来自 ${upstreamKit}）`);
