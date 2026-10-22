import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPreset, buildStagePresets } from '../lib/preset.js';

const modulePath = process.env.DSH_SYSTEM_PROMPT_MODULE || path.join(
  process.env.DSH_INSTALL || path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'DeepSeek Harness'),
  'resources', 'app', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-system-prompt', 'lib', 'index.js',
);

test('Leader and all seven stage personas render with the real DSH runtime before a model request',
  { skip: !fs.existsSync(modulePath) && 'Set DSH_SYSTEM_PROMPT_MODULE to the installed dsh-system-prompt entry' }, async () => {
    const { renderPrompt } = await import(pathToFileURL(modulePath).href);
    const all = [buildPreset({ platform: process.platform, skillsDir: '/skills', leaderPrompt: 'Leader protocol' }),
      ...buildStagePresets({ platform: process.platform, skillsDir: '/skills' })];
    for (const preset of all) {
      const { prefix, suffix = '' } = preset.plugins.find((p) => p.id === 'persona').config;
      const rendered = renderPrompt({ sections: [
        { name: 'deployment:persona-prefix', text: prefix },
        { name: 'deployment:persona-suffix', text: suffix },
      ], variables: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } });
      assert.ok(rendered.includes(prefix), preset.id);
    }
  });
