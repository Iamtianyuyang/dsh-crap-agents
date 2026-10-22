import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStagePresets, stagePresetName } from '../lib/preset.js';
import { STAGES } from '../lib/stages.js';

const presets = buildStagePresets({ platform: 'linux', skillsDir: '/skills' });

test('stage presets are named by stage number and job, in pipeline order', () => {
  assert.deepEqual(presets.map((p) => p.name), [
    '⓪ 摸底 · Gauntlet',
    '① 写规格 · Gauntlet',
    '② TDD 编码 · Gauntlet',
    '③ 清理重构 · Gauntlet',
    '④ 变异加固 · Gauntlet',
    '⑤ QA 实测 · Gauntlet',
    '⑥ 证据包 · Gauntlet',
  ]);
  assert.deepEqual(presets.map((p) => p.order), [11, 12, 13, 14, 15, 16, 17]);
});

// The picker card shows about ten characters of the name: the stage number and job must come first.
test('the part of a name that survives truncation tells the stages apart', () => {
  const visible = presets.map((p) => p.name.slice(0, 6));
  assert.equal(new Set(visible).size, presets.length, visible.join(' | '));
});

test('each description opens with what the stage does and still marks it internal', () => {
  for (const [i, p] of presets.entries()) {
    const stage = STAGES[i];
    assert.ok(p.description.startsWith(stage.summary), `${p.id}: ${p.description}`);
    assert.match(p.description, new RegExp(`内部阶段.*${stage.toolName}.*不要直接选`), p.id);
  }
  assert.equal(new Set(presets.map((p) => p.description)).size, presets.length);
});

test('display fields do not leak into the persona the model sees', () => {
  for (const [i, p] of presets.entries()) {
    const persona = p.plugins.find((x) => x.id === 'persona').config.prefix;
    assert.ok(persona.includes(STAGES[i].title), p.id);
    assert.ok(!persona.includes(stagePresetName(STAGES[i], i)), p.id);
  }
});
