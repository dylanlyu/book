/**
 * Tests for scripts/lib/harness-capabilities.js
 */

const assert = require('assert');

const { SUPPORTED_INSTALL_TARGETS } = require('../../scripts/lib/install-manifests');
const { listInstallTargetAdapters } = require('../../scripts/lib/install-targets/registry');
const {
  GUIDED_HARNESS_IDS,
  HARNESS_CAPABILITIES,
  getHarnessCapability,
  listGuidedHarnesses,
  listHarnessCapabilities,
  normalizeHarnessSelection,
} = require('../../scripts/lib/harness-capabilities');

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    return true;
  } catch (error) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing harness capability catalog ===\n');

  let passed = 0;
  let failed = 0;

  if (test('represents all 5 registered targets exactly once across 4 harnesses', () => {
    const catalogTargetIds = HARNESS_CAPABILITIES.flatMap(harness => harness.targetIds);
    const adapterTargetIds = listInstallTargetAdapters().map(adapter => adapter.target);

    assert.strictEqual(HARNESS_CAPABILITIES.length, 4);
    assert.strictEqual(new Set(catalogTargetIds).size, 5);
    assert.deepStrictEqual([...catalogTargetIds].sort(), [...SUPPORTED_INSTALL_TARGETS].sort());
    assert.deepStrictEqual([...catalogTargetIds].sort(), [...adapterTargetIds].sort());
  })) passed++; else failed++;

  if (test('only Claude and Codex are guided-ready', () => {
    assert.deepStrictEqual(GUIDED_HARNESS_IDS, ['claude', 'codex']);
    assert.deepStrictEqual(
      listGuidedHarnesses().map(harness => harness.id),
      ['claude', 'codex']
    );
    assert.ok(HARNESS_CAPABILITIES
      .filter(harness => !harness.guidedReady)
      .every(harness => harness.availability === 'advanced'));
  })) passed++; else failed++;

  if (test('models reviewed guided install modes, roots, and scopes', () => {
    const claude = getHarnessCapability('claude');
    assert.deepStrictEqual(claude.targetIds, ['claude', 'claude-project']);
    assert.strictEqual(claude.channel, 'native-plugin');
    assert.strictEqual(claude.installMode, 'native-plugin');
    assert.match(claude.destination, /selected Claude plugin scope/i);
    assert.deepStrictEqual(claude.scopes, [
      { id: 'user', targetId: 'claude', root: '~/.claude' },
      { id: 'project', targetId: 'claude-project', root: './.claude' },
      { id: 'local', targetId: 'claude-project', root: './.claude' },
    ]);

    const codex = getHarnessCapability('codex');
    assert.deepStrictEqual(codex.targetIds, ['codex']);
    assert.strictEqual(codex.channel, 'native-plugin');
    assert.strictEqual(codex.installMode, 'native-plugin');
    assert.match(codex.destination, /~\/\.codex/);
    assert.deepStrictEqual(codex.scopes, [
      { id: 'native', targetId: 'codex', root: '~/.codex' },
    ]);
  })) passed++; else failed++;

  if (test('keeps every advanced target attached to its registered root and scope', () => {
    const expected = {
      antigravity: ['project', './.agent'],
      joycode: ['project', './.joycode'],
    };

    for (const [id, [scopeId, root]] of Object.entries(expected)) {
      const harness = getHarnessCapability(id);
      assert.strictEqual(harness.guidedReady, false, id);
      assert.strictEqual(harness.availability, 'advanced', id);
      assert.deepStrictEqual(harness.scopes, [
        { id: scopeId, targetId: id, root },
      ], id);
    }
  })) passed++; else failed++;

  if (test('describes hook capability for each guided harness', () => {
    assert.strictEqual(getHarnessCapability('claude').hooks.mode, 'profile-selection');
    assert.strictEqual(getHarnessCapability('codex').hooks.mode, 'native-trust');
  })) passed++; else failed++;

  if (test('does not advertise unregistered or removed harnesses', () => {
    for (const id of ['copilot', 'kiro', 'pi', 'cursor', 'opencode', 'kimi']) {
      assert.strictEqual(getHarnessCapability(id), null);
      assert.throws(
        () => normalizeHarnessSelection(id),
        /Unknown guided harness selection/
      );
    }
  })) passed++; else failed++;

  if (test('normalizes wizard selections into canonical guided order', () => {
    assert.deepStrictEqual(
      normalizeHarnessSelection(' Claude Code, claude '),
      ['claude']
    );
    assert.deepStrictEqual(
      normalizeHarnessSelection(['2', 'claude-project', 'Codex']),
      ['claude', 'codex']
    );
    assert.deepStrictEqual(normalizeHarnessSelection('all'), ['claude', 'codex']);
    assert.deepStrictEqual(normalizeHarnessSelection('*'), ['claude', 'codex']);
  })) passed++; else failed++;

  if (test('rejects empty, ambiguous, advanced, and unknown wizard selections clearly', () => {
    assert.throws(() => normalizeHarnessSelection(''), /At least one guided harness/);
    assert.throws(() => normalizeHarnessSelection([]), /At least one guided harness/);
    assert.throws(() => normalizeHarnessSelection('none'), /At least one guided harness/);
    assert.throws(() => normalizeHarnessSelection('all,codex'), /cannot be combined/i);
    assert.throws(() => normalizeHarnessSelection('joycode'), /advanced.*not guided-ready/i);
    assert.throws(() => normalizeHarnessSelection('grok'), /Unknown guided harness selection/);
  })) passed++; else failed++;

  if (test('exports deeply frozen records while list helpers return safe array copies', () => {
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES));
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES[0]));
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES[0].targetIds));
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES[0].scopes));
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES[0].scopes[0]));
    assert.ok(Object.isFrozen(HARNESS_CAPABILITIES[0].hooks));
    assert.ok(Object.isFrozen(GUIDED_HARNESS_IDS));

    const first = listHarnessCapabilities();
    first.pop();
    assert.strictEqual(listHarnessCapabilities().length, 4);

    const guided = listGuidedHarnesses();
    guided.reverse();
    assert.deepStrictEqual(
      listGuidedHarnesses().map(harness => harness.id),
      ['claude', 'codex']
    );
  })) passed++; else failed++;

  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}

module.exports = { runTests };
