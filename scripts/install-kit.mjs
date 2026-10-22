#!/usr/bin/env node
// Install (or update) the gauntlet kit into a project as <target>/.gauntlet/
//   node scripts/install-kit.mjs <target-repo-dir>
// Thin alias for kit/install-kit.mjs (same argv), kept for the documented repo-relative path.
await import('../kit/install-kit.mjs');
