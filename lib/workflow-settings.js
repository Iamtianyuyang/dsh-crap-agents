// Session-scoped quality settings. All filesystem work uses the host provider
// and its atomic version guards; only gauntlet.local.json can be written.
export const QUALITY_FIELDS = [
  ['crapMax', 8, false, 'count', 'main'], ['complexityMax', 10, true, 'count', 'main'],
  ['functionLinesMax', 60, true, 'count', 'main'], ['paramsMax', 7, true, 'count', 'main'],
  ['lineCoverageMin', 0.9, false, 'ratio', 'main'], ['mutationScoreMin', 1, false, 'ratio', 'main'],
  ['nestingMax', 4, true, 'count', 'advanced'], ['duplicationMax', 0.03, false, 'ratio', 'advanced'],
  ['warningsMax', 0, true, 'count', 'advanced'], ['tidyMax', 0, true, 'count', 'advanced'],
  ['staticScopeMin', 1, false, 'ratio', 'advanced'], ['cppcheckMax', 0, true, 'count', 'advanced'],
].map(([key, defaultValue, integer, unit, group]) => Object.freeze({ key, defaultValue, integer, unit, group, min: 0, max: unit === 'ratio' ? 1 : Number.MAX_SAFE_INTEGER }));
const FIELD_MAP = new Map(QUALITY_FIELDS.map((field) => [field.key, field]));
const FILE_LIMIT = 1024 * 1024;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (code, message) => Object.assign(new Error(message), { code });

export function validateQualityChanges(changes) {
  if (!object(changes)) throw failure('invalid-threshold', 'Threshold changes must be an object');
  for (const [key, value] of Object.entries(changes)) {
    const field = FIELD_MAP.get(key);
    if (!field) throw failure('invalid-threshold', `Unknown quality threshold: ${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max || (field.integer && !Number.isSafeInteger(value))) {
      throw failure('invalid-threshold', `${key} must be ${field.integer ? 'an integer' : 'a finite number'} between ${field.min} and ${field.max}`);
    }
  }
  return { ...changes };
}

async function readConfig(fs, target, signal) {
  const info = await fs.stat(target, signal);
  if (info === undefined || info === null) return { status: 'missing', value: {}, version: null };
  if (info.type !== 'file') throw failure('invalid-config', 'Configuration must be a regular file');
  if (info.size > FILE_LIMIT) throw failure('invalid-config', `Configuration exceeds ${FILE_LIMIT} bytes`);
  const bytes = await fs.readBytes(target, signal, FILE_LIMIT);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')); }
  catch (error) { throw failure('invalid-config', `Invalid configuration JSON: ${error.message}`); }
  if (!object(value) || (Object.hasOwn(value, 'thresholds') && !object(value.thresholds))) throw failure('invalid-config', 'Configuration and its thresholds must be JSON objects');
  const after = await fs.stat(target, signal);
  if (!after || after.version !== info.version) throw failure('conflict', 'Configuration changed while it was being read; reload it');
  return { status: 'ready', value, version: info.version };
}

async function configTargets(fs, workspaceRoot, signal) {
  if (typeof workspaceRoot !== 'string' || !workspaceRoot) throw failure('unavailable', 'Session working directory is unavailable');
  const root = await fs.resolve(workspaceRoot, { signal });
  const base = await fs.resolve('gauntlet.config.json', { cwd: workspaceRoot, signal });
  const local = await fs.resolve('gauntlet.local.json', { cwd: workspaceRoot, signal });
  if (!fs.contains(root, base) || !fs.contains(root, local)) throw failure('invalid-config', 'Configuration resolves outside the session working directory');
  // The CLI searches ancestors for the committed config. A local override in
  // this child directory would be ignored by that CLI, so refuse the edit
  // instead of creating a plausible-looking but ineffective configuration.
  if (!(await fs.stat(base, signal))) {
    const visited = new Set([root.targetKey]);
    let ancestor = root;
    for (;;) {
      const parent = await fs.resolve('..', { cwd: fs.processPath(ancestor), signal });
      if (visited.has(parent.targetKey)) break;
      visited.add(parent.targetKey);
      const candidate = await fs.resolve('gauntlet.config.json', { cwd: fs.processPath(parent), signal });
      if (await fs.stat(candidate, signal)) throw Object.assign(failure('root-required', 'The CLI uses the parent project configuration at ' + fs.processPath(candidate) + '. Open a session in that project root to edit its quality settings.'), { projectRoot: fs.processPath(parent) });
      ancestor = parent;
    }
  }
  return { base, local };
}

export async function loadHostQualitySettings(fs, workspaceRoot, signal) {
  try {
    const targets = await configTargets(fs, workspaceRoot, signal);
    const [base, local] = await Promise.all([readConfig(fs, targets.base, signal), readConfig(fs, targets.local, signal)]);
    const values = Object.fromEntries(QUALITY_FIELDS.map((field) => [field.key, field.defaultValue]));
    for (const config of [base.value, local.value]) for (const field of QUALITY_FIELDS) {
      if (Object.hasOwn(config.thresholds || {}, field.key)) values[field.key] = config.thresholds[field.key];
    }
    validateQualityChanges(values);
    return {
      status: base.status === 'missing' && local.status === 'missing' ? 'missing' : 'ready', values,
      base: base.value, local: local.value, baseStatus: base.status, localStatus: local.status,
      revision: { base: base.version, local: local.version },
      paths: { base: fs.processPath(targets.base), local: fs.processPath(targets.local) },
    };
  } catch (error) { return { status: 'error', code: error.code || 'unavailable', error: error.message || String(error), ...(error.projectRoot ? { projectRoot: error.projectRoot } : {}) }; }
}

export async function saveHostQualitySettings(fs, workspaceRoot, revision, changes, signal) {
  try {
    const validated = validateQualityChanges(changes);
    if (!object(revision) || !['base', 'local'].every((key) => Object.hasOwn(revision, key) && (revision[key] === null || typeof revision[key] === 'string'))) throw failure('conflict', 'Both configuration revisions are required; reload before saving');
    const current = await loadHostQualitySettings(fs, workspaceRoot, signal);
    if (current.status === 'error') throw failure(current.code, current.error);
    if (current.revision.base !== revision.base || current.revision.local !== revision.local) throw failure('conflict', 'Project or local configuration changed; reload before saving');
    const changed = Object.fromEntries(Object.entries(validated).filter(([key, value]) => value !== current.values[key]));
    if (!Object.keys(changed).length) return current;
    const targets = await configTargets(fs, workspaceRoot, signal);
    const next = { ...current.local, thresholds: { ...current.local.thresholds, ...changed } };
    const content = JSON.stringify(next, null, 2) + '\n';
    if (new TextEncoder().encode(content).byteLength > FILE_LIMIT) throw failure('invalid-config', `Updated configuration exceeds ${FILE_LIMIT} bytes`);
    const expected = revision.local === null ? { kind: 'createIfAbsent' } : { kind: 'replaceIfVersion', version: revision.local };
    await fs.writeText(targets.local, content, expected, signal);
    return await loadHostQualitySettings(fs, workspaceRoot, signal);
  } catch (error) {
    const conflict = ['FS_STALE_VERSION', 'FS_NOT_OBSERVED', 'FS_ALREADY_EXISTS'].includes(error.code);
    return { status: 'error', code: conflict ? 'conflict' : error.code || 'unavailable', error: conflict ? 'Local configuration changed before the write completed; reload before saving' : error.message || String(error) };
  }
}

// Plain JavaScript registration using the public stage-3 Remote decorator.
// workspaceFileScope is the installed workspace-files lookup, which derives
// workspaceRoot from the selected session header rather than a caller path.
export function registerQualitySettings(ctx, TypertRemoteService, Remote) {
  const initializers = [];
  class GauntletQuality extends TypertRemoteService {
    constructor(scope) {
      super(scope, 'gauntletQuality');
      for (const initialize of initializers) initialize.call(this);
    }
    async load(workspaceFileScope, signal) {
      return loadHostQualitySettings(this.ctx.fs, workspaceFileScope.workspaceRoot, signal);
    }
    async save(workspaceFileScope, revision, changes, signal) {
      return saveHostQualitySettings(this.ctx.fs, workspaceFileScope.workspaceRoot, revision, changes, signal);
    }
  }
  for (const name of ['load', 'save']) Remote(GauntletQuality.prototype[name], { kind: 'method', name, private: false, static: false, addInitializer: (initialize) => initializers.push(initialize) });
  return new GauntletQuality(ctx);
}
