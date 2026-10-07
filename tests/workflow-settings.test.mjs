import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { posix } from 'node:path';
import { QUALITY_FIELDS, loadHostQualitySettings, saveHostQualitySettings, validateQualityChanges, registerQualitySettings } from '../lib/workflow-settings.js';

let client;
vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: ({ factory }) => { client = factory((name) => name === 'react' ? { createElement: () => null } : {}); } } },
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const configName = '/workspace/gauntlet.config.json';
const localName = '/workspace/gauntlet.local.json';
function memoryFs(initial = {}) {
  const files = new Map(); let next = 0;
  const put = (name, value) => files.set(name, { text: typeof value === 'string' ? value : JSON.stringify(value), version: 'v' + ++next });
  for (const [name, value] of Object.entries(initial)) put('/workspace/' + name, value);
  const fs = {
    files, put, writes: [], beforeWrite: null,
    async resolve(name, { cwd } = {}) { return { targetKey: posix.normalize(name.startsWith('/') ? name : cwd + '/' + name) }; },
    contains(root, target) { return target.targetKey === root.targetKey || target.targetKey.startsWith(root.targetKey + '/'); },
    processPath(target) { return target.targetKey; },
    async stat(target) { const file = files.get(target.targetKey); return file ? { type: 'file', version: file.version, size: new TextEncoder().encode(file.text).byteLength } : undefined; },
    async readBytes(target) { return new TextEncoder().encode(files.get(target.targetKey).text); },
    async writeText(target, text, expected) {
      if (fs.beforeWrite) await fs.beforeWrite();
      const file = files.get(target.targetKey);
      if (expected.kind === 'createIfAbsent' && file) throw Object.assign(new Error('already exists'), { code: 'FS_NOT_OBSERVED' });
      if (expected.kind === 'replaceIfVersion' && (!file || file.version !== expected.version)) throw Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' });
      fs.writes.push({ path: target.targetKey, expected, text }); put(target.targetKey, text);
    },
  };
  return fs;
}

test('browser and server field contracts match the exact kit defaults', () => {
  const source = readFileSync(new URL('../kit/lib/util.mjs', import.meta.url), 'utf8');
  const declaration = source.slice(source.indexOf('const DEFAULT_CONFIG ='), source.indexOf('function deepMerge'));
  const context = {};
  vm.runInNewContext(declaration + '\nthis.defaults = DEFAULT_CONFIG.thresholds;', context);
  assert.deepEqual(Object.fromEntries(QUALITY_FIELDS.map((field) => [field.key, field.defaultValue])), plain(context.defaults));
  assert.deepEqual(plain(client.QUALITY_FIELDS), QUALITY_FIELDS);
  assert.equal(QUALITY_FIELDS.filter((field) => field.group === 'main').length, 6);
  assert.equal(QUALITY_FIELDS.filter((field) => field.unit === 'ratio').length, 4);
});

test('loads effective defaults plus committed and local thresholds without mutating the source objects', async () => {
  const base = { thresholds: { crapMax: 6, complexityMax: 9, unknownFutureMetric: 100 }, commands: { test: ['base'] } };
  const local = { thresholds: { crapMax: 4 }, commands: { test: ['local'] }, custom: true };
  const fs = memoryFs({ 'gauntlet.config.json': base, 'gauntlet.local.json': local });
  const loaded = await loadHostQualitySettings(fs, '/workspace');
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.values.crapMax, 4);
  assert.equal(loaded.values.complexityMax, 9);
  assert.equal(loaded.values.mutationScoreMin, 1);
  assert.deepEqual(loaded.base, base);
  assert.deepEqual(loaded.local, local);
  assert.deepEqual(loaded.revision, { base: 'v1', local: 'v2' });
});

test('saving edits only changed thresholds in local while preserving all unrelated and unknown settings', async () => {
  const fs = memoryFs({ 'gauntlet.config.json': { thresholds: { complexityMax: 10 } }, 'gauntlet.local.json': { thresholds: { crapMax: 5, unknownFutureMetric: 42 }, tools: { archify: { dir: 'custom' } }, sources: ['**/*.js'] } });
  const loaded = await loadHostQualitySettings(fs, '/workspace');
  const baseBefore = fs.files.get(configName).text;
  const saved = await saveHostQualitySettings(fs, '/workspace', loaded.revision, { crapMax: 5, lineCoverageMin: 0.95 });
  assert.equal(saved.status, 'ready');
  assert.equal(saved.values.lineCoverageMin, 0.95);
  assert.deepEqual(saved.local.thresholds, { crapMax: 5, unknownFutureMetric: 42, lineCoverageMin: 0.95 });
  assert.deepEqual(saved.local.tools, loaded.local.tools);
  assert.deepEqual(saved.local.sources, loaded.local.sources);
  assert.equal(fs.files.get(configName).text, baseBefore);
  assert.equal(fs.writes.length, 1);
  assert.equal(fs.writes[0].path, localName);
  assert.deepEqual(fs.writes[0].expected, { kind: 'replaceIfVersion', version: loaded.revision.local });
  const unchanged = await saveHostQualitySettings(fs, '/workspace', saved.revision, { crapMax: 5 });
  assert.equal(unchanged.status, 'ready');
  assert.equal(fs.writes.length, 1);
});

test('missing files load usable defaults and create only the requested local overrides', async () => {
  const fs = memoryFs();
  const loaded = await loadHostQualitySettings(fs, '/workspace');
  assert.equal(loaded.status, 'missing');
  assert.deepEqual(loaded.revision, { base: null, local: null });
  const saved = await saveHostQualitySettings(fs, '/workspace', loaded.revision, { crapMax: 7 });
  assert.equal(saved.status, 'ready');
  assert.deepEqual(saved.local, { thresholds: { crapMax: 7 } });
  assert.deepEqual(fs.writes[0].expected, { kind: 'createIfAbsent' });
  assert.equal(fs.files.has(configName), false);
});

test('bad JSON, invalid structures, or invalid effective values are never silently replaced', async () => {
  for (const value of ['{broken', 'null', '[]', { thresholds: null }, { thresholds: [] }, { thresholds: { lineCoverageMin: 80 } }]) {
    const fs = memoryFs({ 'gauntlet.local.json': value });
    const before = fs.files.get(localName).text;
    assert.equal((await loadHostQualitySettings(fs, '/workspace')).status, 'error');
    const saved = await saveHostQualitySettings(fs, '/workspace', { base: null, local: 'v1' }, { crapMax: 4 });
    assert.equal(saved.status, 'error');
    assert.equal(fs.files.get(localName).text, before);
    assert.equal(fs.writes.length, 0);
  }
});

test('invalid, unknown, fractional-count, or nonnumeric changes never reach the writer', async () => {
  const invalid = [null, [], { crapMax: -1 }, { crapMax: NaN }, { crapMax: Infinity }, { crapMax: '5' }, { complexityMax: 2.5 }, { lineCoverageMin: 1.1 }, { mutationScoreMin: 99 }, { madeUp: 2 }];
  for (const changes of invalid) {
    assert.throws(() => validateQualityChanges(changes), { code: 'invalid-threshold' });
    assert.throws(() => client.validateQualityChanges(changes), (error) => error.code === 'invalid-threshold');
    const fs = memoryFs();
    assert.equal((await saveHostQualitySettings(fs, '/workspace', { base: null, local: null }, changes)).code, 'invalid-threshold');
    assert.equal(fs.writes.length, 0);
  }
});

test('changes to either config after loading reject the old revision without overwriting', async () => {
  for (const changedFile of [configName, localName]) {
    const fs = memoryFs({ 'gauntlet.config.json': {}, 'gauntlet.local.json': { custom: 'first' } });
    const loaded = await loadHostQualitySettings(fs, '/workspace');
    fs.put(changedFile, { custom: 'externally changed' });
    const saved = await saveHostQualitySettings(fs, '/workspace', loaded.revision, { crapMax: 4 });
    assert.equal(saved.code, 'conflict');
    assert.equal(fs.writes.length, 0);
    assert.equal(JSON.parse(fs.files.get(changedFile).text).custom, 'externally changed');
  }
});

test('the native atomic guard rejects updates and new-file races after the preflight read', async () => {
  for (const initiallyPresent of [false, true]) {
    const fs = memoryFs(initiallyPresent ? { 'gauntlet.local.json': {} } : {});
    const loaded = await loadHostQualitySettings(fs, '/workspace');
    fs.beforeWrite = () => fs.put(localName, { external: 'keep' });
    const saved = await saveHostQualitySettings(fs, '/workspace', loaded.revision, { crapMax: 4 });
    assert.equal(saved.code, 'conflict');
    assert.equal(fs.writes.length, 0);
    assert.deepEqual(JSON.parse(fs.files.get(localName).text), { external: 'keep' });
  }
});

test('a configuration alias outside the session root is rejected before any read or write', async () => {
  const fs = memoryFs();
  const resolve = fs.resolve;
  fs.resolve = (name, options) => name === 'gauntlet.local.json' ? { targetKey: '/outside/config.json' } : resolve(name, options);
  assert.equal((await loadHostQualitySettings(fs, '/workspace')).code, 'invalid-config');
  assert.equal((await saveHostQualitySettings(fs, '/workspace', { base: null, local: null }, { crapMax: 4 })).status, 'error');
  assert.equal(fs.writes.length, 0);
});

test('a parent project config is identified instead of creating overrides the CLI would ignore', async () => {
  const fs = memoryFs({ 'gauntlet.config.json': { thresholds: { crapMax: 3 } } });
  const loaded = await loadHostQualitySettings(fs, '/workspace/src');
  assert.equal(loaded.status, 'error');
  assert.equal(loaded.code, 'root-required');
  assert.equal(loaded.projectRoot, '/workspace');
  assert.match(loaded.error, /\/workspace\/gauntlet.config.json/);
  const saved = await saveHostQualitySettings(fs, '/workspace/src', { base: null, local: null }, { crapMax: 4 });
  assert.equal(saved.code, 'root-required');
  assert.equal(fs.writes.length, 0);
  assert.equal(fs.files.has('/workspace/src/gauntlet.local.json'), false);
});

test('browser helpers use the exact slash endpoint and propagate actionable conflicts', async () => {
  const fs = memoryFs(); const calls = [];
  const ctx = { connection: { rpc: { async call(route, endpoint, payload, signal) {
    calls.push({ route, endpoint, payload, signal });
    const { revision, changes } = payload.args;
    const value = endpoint.endsWith('/load') ? await loadHostQualitySettings(fs, '/workspace') : await saveHostQualitySettings(fs, '/workspace', revision, changes);
    return { ok: true, value };
  } } } };
  const loaded = await client.loadQualitySettings(ctx, 'parent');
  const saved = await client.saveQualitySettings(ctx, 'parent', loaded, { crapMax: 4 });
  assert.equal(saved.values.crapMax, 4);
  assert.equal(calls[0].route, '/api');
  assert.equal(calls[0].endpoint, 'gauntletQuality/load');
  assert.equal(calls[1].endpoint, 'gauntletQuality/save');
  assert.equal(calls[1].payload.args.workspaceFileScopeId, 'parent');
  assert.deepEqual(plain(calls[1].payload.args.revision), { base: null, local: null });
  await assert.rejects(() => client.saveQualitySettings(ctx, 'parent', loaded, { crapMax: 3 }), (error) => error.code === 'conflict');
  assert.equal((await client.loadQualitySettings({}, 'parent')).status, 'error');
});

test('host RPC registration uses workspace lookup parameters and public Remote initializers', async () => {
  const fs = memoryFs(); const names = [];
  class Service { constructor(ctx, name) { this.ctx = ctx; this.name = name; } }
  function Remote(_method, context) { names.push(context.name); context.addInitializer(function () { this.marked = true; }); }
  const service = registerQualitySettings({ fs }, Service, Remote);
  assert.deepEqual(names, ['load', 'save']);
  assert.equal(service.name, 'gauntletQuality');
  assert.equal(service.marked, true);
  const loaded = await service.load({ sessionId: 'parent', workspaceRoot: '/workspace' });
  assert.equal(loaded.status, 'missing');
  const saved = await service.save({ sessionId: 'parent', workspaceRoot: '/workspace' }, loaded.revision, { paramsMax: 3 });
  assert.equal(saved.values.paramsMax, 3);
});
