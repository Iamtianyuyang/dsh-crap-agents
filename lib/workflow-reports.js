// Preserve report evidence at the instant a Gauntlet stage tool finishes. The
// tools/result observer is synchronous, so later stages cannot overwrite this
// stage's evidence before it has been copied. It never changes the tool result.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { STAGES } from './stages.js';
import { PRESET_ID } from './preset.js';

export const SNAPSHOT_VERSION = 1;
export const REPORT_FILE_LIMIT = 4 * 1024 * 1024;
export const SNAPSHOT_LIMIT = 16 * 1024 * 1024;
const OUTPUT_LIMIT = REPORT_FILE_LIMIT;
const STAGE_BY_TOOL = new Map(STAGES.map((stage) => [stage.toolName, stage.key]));
const REPORT_FILES = {
  crap: 'crap.json', static: 'static.json', mutation: 'mutation.json', gate: 'gate.json',
  tests: 'tests.json', survey: 'survey.json',
  loopSpecifier: 'loop-specifier.json', loopCoder: 'loop-coder.json', loopCleaner: 'loop-cleaner.json',
  loopHardener: 'loop-hardener.json', loopFull: 'loop-full.json', loopQuality: 'loop-quality.json',
};
const LOOP_KEYS = { specifier: 'loopSpecifier', coder: 'loopCoder', cleaner: 'loopCleaner', hardener: 'loopHardener', full: 'loopFull', quality: 'loopQuality' };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const errorMessage = (error) => error instanceof Error ? error.message : String(error);

export function safeWorkflowCallId(callId) {
  if (typeof callId !== 'string' || !callId || callId.length > 1024) throw new Error('Stage call ID is missing or too long');
  const safe = encodeURIComponent(callId).replace(/\./g, '%2E');
  if (safe.length > 240 || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(safe)) throw new Error('Stage call ID cannot be used as a snapshot directory');
  return safe;
}

export function workflowSnapshotPath(cwd, callId) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) throw new Error('Session working directory must be absolute');
  return path.join(cwd, 'gauntlet-out', 'workflow', safeWorkflowCallId(callId), 'reports.json');
}

function mergeConfig(base, override) {
  if (!isObject(override)) return override;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    // Define own properties rather than invoking Object.prototype setters.
    Object.defineProperty(merged, key, { value: isObject(value) ? mergeConfig(isObject(merged[key]) ? merged[key] : {}, value) : value, writable: true, enumerable: true, configurable: true });
  }
  return merged;
}

function readReport(file, budget, fileLimit) {
  let descriptor;
  let metadata = {};
  try {
    descriptor = fs.openSync(file, 'r');
    const stat = fs.fstatSync(descriptor);
    metadata = { bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    if (!stat.isFile()) throw new Error('Report path is not a regular file');
    if (stat.size > fileLimit) throw new Error(`Report exceeds the ${fileLimit} byte per-file snapshot limit`);
    if (budget.used + stat.size > budget.limit) throw new Error(`Reports exceed the ${budget.limit} byte total snapshot read limit`);
    // Read only the stat size plus one byte. This bounds allocation and detects
    // a file growing between stat and read rather than parsing a truncated copy.
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(descriptor, buffer, length, buffer.length - length, length);
      if (!count) break;
      length += count;
    }
    budget.used += length;
    if (length !== stat.size) throw new Error('Report changed while its stage snapshot was being captured');
    const value = JSON.parse(buffer.subarray(0, length).toString('utf8').replace(/^\uFEFF/, ''));
    return { status: 'ready', path: file, ...metadata, value };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return { status: 'missing', path: file };
    return { status: 'error', path: file, ...metadata, error: errorMessage(error) };
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch (_) { /* Reading evidence must not affect the stage. */ }
    }
  }
}

export function readWorkflowReports(cwd, { fileLimit = REPORT_FILE_LIMIT, totalLimit = SNAPSHOT_LIMIT } = {}) {
  const budget = { used: 0, limit: totalLimit };
  const config = readReport(path.join(cwd, 'gauntlet.config.json'), budget, fileLimit);
  const local = readReport(path.join(cwd, 'gauntlet.local.json'), budget, fileLimit);
  const reports = { config, local };
  for (const [name, envelope] of [['config', config], ['local', local]]) {
    if (envelope.status === 'ready' && !isObject(envelope.value)) reports[name] = { ...envelope, status: 'error', error: 'Gauntlet configuration must be a JSON object' };
  }
  let merged = mergeConfig({ outDir: 'gauntlet-out', paths: { qa: 'qa' } }, reports.config.status === 'ready' ? reports.config.value : {});
  merged = mergeConfig(merged, reports.local.status === 'ready' ? reports.local.value : {});
  const validPath = (value) => typeof value === 'string' && !!value.trim() && !value.includes('\0');
  let configError = reports.config.status === 'error' ? reports.config.error : reports.local.status === 'error' ? reports.local.error : null;
  if (!configError && (!validPath(merged.outDir) || !isObject(merged.paths) || !validPath(merged.paths.qa))) configError = 'Invalid Gauntlet outDir or paths.qa configuration';
  reports.config = {
    ...reports.config, committed: config.value, value: merged, localOverrides: reports.local.status === 'ready',
    ...(configError ? { status: 'error', error: configError }
      : reports.config.status === 'missing' && reports.local.status === 'ready' ? { status: 'ready' } : {}),
  };
  const dependentError = () => ({ status: 'error', path: null, error: `Report path is unavailable: ${configError}` });
  for (const [name, file] of Object.entries(REPORT_FILES)) reports[name] = configError ? dependentError() : readReport(path.resolve(cwd, merged.outDir, file), budget, fileLimit);
  for (const [name, file] of [['constraints', 'constraints.json'], ['qa', 'qa-report.json'], ['equivalence', 'equivalence.json']]) reports[name] = configError ? dependentError() : readReport(path.resolve(cwd, merged.paths.qa, file), budget, fileLimit);
  const profile = reports.gate.status === 'ready' && isObject(reports.gate.value) ? reports.gate.value.profile : null;
  reports.loop = LOOP_KEYS[profile] ? { ...reports[LOOP_KEYS[profile]], profile } : configError ? dependentError() : { status: 'missing', path: null };
  return reports;
}

function textOutput(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('\n');
}

function boundedText(text, limit) {
  const bytes = Buffer.byteLength(text);
  if (bytes <= limit) return { text, bytes, truncated: false };
  // TextDecoder drops a partially cut UTF-8 sequence instead of introducing a
  // replacement character that could expand the result past the byte limit.
  const truncated = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.from(text).subarray(0, limit), { stream: true });
  return { text: truncated, bytes, truncated: true };
}

function serializeSnapshot(snapshot, limit) {
  let serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized) <= limit) return serialized;
  // JSON escaping and duplicated config/loop views may exceed the raw read
  // budget. Replace affected reports with explicit errors, never silently trim
  // their tables or claim that a truncated report is complete.
  const ordered = Object.entries(snapshot.reports).map(([key, report]) => ({ key, bytes: Buffer.byteLength(JSON.stringify(report)) })).sort((a, b) => b.bytes - a.bytes);
  for (const { key } of ordered) {
    const report = snapshot.reports[key];
    if (report.status !== 'ready' && report.value === undefined) continue;
    snapshot.reports[key] = { status: 'error', path: report.path, bytes: report.bytes, error: `Report omitted because serialized stage evidence exceeds the ${limit} byte snapshot limit` };
    serialized = JSON.stringify(snapshot);
    if (Buffer.byteLength(serialized) <= limit) return serialized;
  }
  throw new Error(`Stage snapshot metadata exceeds the ${limit} byte snapshot limit`);
}

/** Capture once per final tool call. Returns diagnostics; never throws. */
export function captureWorkflowSnapshot(execution, result, options = {}) {
  let file;
  let temporary;
  try {
    const stageKey = STAGE_BY_TOOL.get(execution?.name);
    if (!stageKey || result?.value?.kind === 'background') return { status: 'skipped' };
    const header = execution?.agent?.session?.header;
    file = workflowSnapshotPath(header?.cwd, execution?.callId);
    // Re-delivered events must not replace a historical snapshot with reports
    // produced by a subsequent stage or another attempt.
    if (fs.existsSync(file)) return { status: 'exists', path: file };
    const output = boundedText(textOutput(result?.content) || textOutput(result?.value?.output), options.outputLimit ?? OUTPUT_LIMIT);
    const prompt = boundedText(typeof execution.arguments?.prompt === 'string' ? execution.arguments.prompt : '', options.outputLimit ?? OUTPUT_LIMIT);
    const snapshot = {
      version: SNAPSHOT_VERSION, callId: execution.callId, stageKey, toolName: execution.name,
      parentSessionId: typeof header.id === 'string' ? header.id : undefined,
      childSessionId: result?.value?.kind === 'foreground' && typeof result.value.runId === 'string' ? result.value.runId : undefined,
      capturedAt: new Date().toISOString(), output: output.text, isError: result?.isError === true, prompt: prompt.text,
      ...(output.truncated ? { outputTruncated: true, outputOriginalBytes: output.bytes } : {}),
      ...(prompt.truncated ? { promptTruncated: true, promptOriginalBytes: prompt.bytes } : {}),
      limits: { reportFileBytes: options.fileLimit ?? REPORT_FILE_LIMIT, snapshotBytes: options.totalLimit ?? SNAPSHOT_LIMIT },
      reports: readWorkflowReports(header.cwd, options),
    };
    const serialized = serializeSnapshot(snapshot, options.totalLimit ?? SNAPSHOT_LIMIT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    temporary = path.join(path.dirname(file), `.reports-${process.pid}-${randomUUID()}.tmp`);
    fs.writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
    temporary = undefined;
    return { status: 'written', path: file };
  } catch (error) {
    return { status: 'error', ...(file ? { path: file } : {}), error: errorMessage(error) };
  } finally {
    if (temporary) {
      try { fs.unlinkSync(temporary); } catch (_) { /* Best-effort cleanup of this one temporary file. */ }
    }
  }
}

export function registerWorkflowSnapshots(ctx) {
  return ctx.on('tools/result', (execution, result) => {
    try {
      if (!execution?.agent || !STAGE_BY_TOOL.has(execution.name)) return;
      if (ctx.agentPresets.composedPreset(execution.agent.ctx) !== PRESET_ID) return;
      captureWorkflowSnapshot(execution, result);
    } catch (_) {
      // Cordis emits result observers without awaiting their return values. Keep
      // all work synchronous and prevent evidence capture errors from escaping.
    }
  });
}
