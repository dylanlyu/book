'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

const configureEccDocs = [
  'skills/configure-ecc/SKILL.md',
];

const localizedWizardContract = {
  'skills/configure-ecc/SKILL.md': [
    'Ask exactly one scope question',
    'Ask exactly one hook-mode question',
    'Show exactly one confirmation summary',
  ],
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function readConfigureEccDoc(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function countEntries(relativePath, predicate) {
  return fs.readdirSync(path.join(repoRoot, relativePath), { withFileTypes: true })
    .filter(predicate)
    .length;
}

console.log('\n=== Testing configure-ecc install path guidance ===\n');

for (const relativePath of configureEccDocs) {
  test(`${relativePath} delegates to guided plugin setup`, () => {
    const content = readConfigureEccDoc(relativePath);

    assert.ok(content.includes('ecc setup'));
    assert.ok(content.includes('npx book-universal setup'));
    assert.ok(content.includes('--mode claude-plugin'));
    assert.ok(content.includes('--scope <scope>'));
    assert.ok(content.includes('--hooks <hooks>'));
    assert.ok(content.includes('--move-scope'));
    assert.ok(!content.includes('rm -rf /tmp/everything-claude-code'));
    assert.ok(!content.includes('cp -R "$ECC_ROOT'));
  });

  test(`${relativePath} defines the Claude in-harness wizard contract`, () => {
    const content = readConfigureEccDoc(relativePath);

    for (const instruction of localizedWizardContract[relativePath]) {
      assert.ok(content.includes(instruction), `missing: ${instruction}`);
    }
    assert.ok(content.includes('claude plugin list --json'));
    assert.ok(content.includes('user | project | local'));
    assert.ok(content.includes('off | minimal | standard | strict'));
    assert.ok(content.includes('$CLAUDE_PLUGIN_ROOT'));
    assert.ok(content.includes('scripts/setup.js'));
    assert.ok(content.includes('--yes --json'));
    assert.ok(content.includes('<installed-version>'));
    assert.ok(content.includes('ECC_VERSION_PATTERN'));
    assert.ok(content.includes('argument array'));
  });

  test(`${relativePath} verifies before showing the welcome`, () => {
    const content = readConfigureEccDoc(relativePath);
    const applyIndex = content.indexOf('--yes --json');
    const verificationIndex = content.indexOf('claude plugin list --json', applyIndex);
    const welcomeIndex = content.indexOf('renderTerminalWelcome');

    assert.ok(applyIndex > -1, 'missing non-interactive apply command');
    assert.ok(verificationIndex > -1, 'missing post-setup plugin verification');
    assert.ok(welcomeIndex > verificationIndex, 'welcome must follow verification');
  });

  test(`${relativePath} keeps provider capabilities truthful`, () => {
    const content = readConfigureEccDoc(relativePath);

    assert.ok(content.includes('codex plugin add book@dylanlyu --json'));
    assert.ok(content.includes('Codex'));
  });

  test(`${relativePath} verifies Codex before its concrete welcome`, () => {
    const content = readConfigureEccDoc(relativePath);
    const codexVerifyIndex = content.indexOf('codex plugin list --json');
    const codexWelcomeIndex = content.indexOf(
      '["<installedPath>/scripts/welcome.js", "--action", "configured", "--version", "<installed-version>"]'
    );

    assert.ok(codexVerifyIndex > -1, 'missing Codex verification');
    assert.ok(codexWelcomeIndex > codexVerifyIndex, 'Codex welcome must follow verification');
    assert.ok(
      content.includes('argument array'),
      'Codex welcome must use an executable plus argument array'
    );
    assert.ok(
      !content.includes('node "<installedPath>/scripts/welcome.js"'),
      'Codex JSON values must not be shown in a shell command'
    );
  });
}

test('Codex legacy sync docs do not require an unrelated package install', () => {
  const content = readConfigureEccDoc('.codex-plugin/README.md');

  assert.ok(content.includes('bash scripts/sync-ecc-to-codex.sh'));
  assert.ok(!content.includes('npm install && bash scripts/sync-ecc-to-codex.sh'));
});

if (failed > 0) {
  console.log(`\nFailed: ${failed}`);
  process.exit(1);
}

console.log(`\nPassed: ${passed}`);
