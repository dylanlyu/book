#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { listInstallComponents, resolveInstallPlan } = require('../../scripts/lib/install-manifests');
const { createManifestInstallPlan } = require('../../scripts/lib/install-executor');

const ROOT = path.resolve(__dirname, '../..');
const OWNERS = [
  'module-governance', 'context-and-decisions', 'architecture-decision-records',
  'contract-first', 'change-impact', 'living-docs-governance', 'docs-governance',
];
let passed = 0;
let failed = 0;
function test(name, run) {
  try {
    run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}: ${error.message}`);
  }
}

for (const target of ['claude', 'codex']) {
  test(`opt-in ${target} installation includes every delegated knowledge owner`, () => {
    const plan = resolveInstallPlan({
      repoRoot: ROOT, profileId: 'minimal',
      includeComponentIds: ['capability:module-governance'], target,
    });
    const paths = new Set(plan.selectedModules.flatMap(module => module.paths));
    for (const owner of OWNERS) {
      assert.ok(paths.has(`skills/${owner}`), `missing ${owner}`);
    }
  });
}

for (const target of ['claude', 'claude-project', 'codex']) {
  test(`advertised ${target} capability produces copies of every delegated owner`, () => {
    assert.ok(listInstallComponents({ repoRoot: ROOT, target }).some(
      component => component.id === 'capability:module-governance'
    ));
    const plan = createManifestInstallPlan({
      sourceRoot: ROOT, target, homeDir: '/private/tmp/ecc-module-plan-preview',
      projectRoot: '/private/tmp/ecc-module-plan-preview', profileId: 'minimal',
      includeComponentIds: ['capability:module-governance'],
    });
    for (const owner of OWNERS) {
      assert.ok(plan.operations.some(operation => operation.kind === 'copy-file'
        && operation.sourceRelativePath.replace(/\\/g, '/').endsWith(`skills/${owner}/SKILL.md`)),
      `missing ${owner} copy on ${target}`);
    }
  });
}

test('Codex module workflow is the canonical implementation', () => {
  assert.strictEqual(
    fs.readFileSync(path.join(ROOT, 'skills/module-governance/SKILL.md'), 'utf8'),
    fs.readFileSync(path.join(ROOT, '.agents/skills/module-governance/SKILL.md'), 'utf8')
  );
});

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exitCode = failed ? 1 : 0;
