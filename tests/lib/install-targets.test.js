/**
 * Tests for scripts/lib/install-targets/registry.js
 */

const assert = require('assert');
const path = require('path');

const { getInstallTargetAdapter, listInstallTargetAdapters, planInstallTargetScaffold } = require('../../scripts/lib/install-targets/registry');

function normalizedRelativePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

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
  console.log('\n=== Testing install-target adapters ===\n');

  let passed = 0;
  let failed = 0;

  if (
    test('lists supported target adapters', () => {
      const adapters = listInstallTargetAdapters();
      const targets = adapters.map(adapter => adapter.target);
      assert.ok(targets.includes('claude'), 'Should include claude target');
      assert.ok(targets.includes('claude-project'), 'Should include claude-project target');
      assert.ok(targets.includes('codex'), 'Should include codex target');
    })
  )
    passed++;
  else failed++;

  if (
    test('resolves claude adapter root and install-state path from home dir', () => {
      const adapter = getInstallTargetAdapter('claude');
      const homeDir = '/Users/example';
      const root = adapter.resolveRoot({ homeDir, repoRoot: '/repo/ecc' });
      const statePath = adapter.getInstallStatePath({ homeDir, repoRoot: '/repo/ecc' });

      assert.strictEqual(root, path.join(homeDir, '.claude'));
      assert.strictEqual(statePath, path.join(homeDir, '.claude', 'ecc', 'install-state.json'));
    })
  )
    passed++;
  else failed++;

  if (
    test('plans namespaced Claude rules and flat discoverable skills', () => {
      const repoRoot = path.join(__dirname, '..', '..');
      const homeDir = '/Users/example';

      const plan = planInstallTargetScaffold({
        target: 'claude',
        repoRoot,
        homeDir,
        modules: [
          {
            id: 'rules-core',
            paths: ['rules']
          },
          {
            id: 'workflow-quality',
            paths: ['skills/tdd-workflow']
          }
        ]
      });

      assert.ok(
        plan.operations.some(operation => normalizedRelativePath(operation.sourceRelativePath) === 'rules' && operation.destinationPath === path.join(homeDir, '.claude', 'rules', 'ecc')),
        'Should install bundled Claude rules under rules/ecc'
      );
      assert.ok(
        plan.operations.some(
          operation => normalizedRelativePath(operation.sourceRelativePath) === 'skills/tdd-workflow' && operation.destinationPath === path.join(homeDir, '.claude', 'skills', 'tdd-workflow')
        ),
        'Should install bundled Claude skills under skills'
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('exposes validate and planOperations on adapters', () => {
      const claudeAdapter = getInstallTargetAdapter('claude');
      const claudeProjectAdapter = getInstallTargetAdapter('claude-project');

      assert.strictEqual(typeof claudeAdapter.planOperations, 'function');
      assert.strictEqual(typeof claudeAdapter.validate, 'function');
      assert.deepStrictEqual(claudeAdapter.validate({ homeDir: '/Users/example', repoRoot: '/repo/ecc' }), []);

      assert.strictEqual(typeof claudeProjectAdapter.planOperations, 'function');
      assert.strictEqual(typeof claudeProjectAdapter.validate, 'function');
      assert.deepStrictEqual(claudeProjectAdapter.validate({ projectRoot: '/workspace/app', repoRoot: '/repo/ecc' }), []);
    })
  )
    passed++;
  else failed++;

  if (
    test('throws on unknown target adapter', () => {
      assert.throws(() => getInstallTargetAdapter('ghost-target'), /Unknown install target adapter/);
    })
  )
    passed++;
  else failed++;

  if (
    test('every schema target enum value has a matching adapter (regression guard)', () => {
      const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'ecc-install-config.schema.json');
      const schema = JSON.parse(require('fs').readFileSync(schemaPath, 'utf8'));
      const schemaTargets = schema.properties.target.enum;
      const adapters = listInstallTargetAdapters();
      const adapterTargets = adapters.map(a => a.target);

      for (const target of schemaTargets) {
        assert.ok(adapterTargets.includes(target), `Schema target "${target}" has no matching adapter. ` + `Available adapter targets: ${adapterTargets.join(', ')}`);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('every adapter target is listed in the schema enum (regression guard)', () => {
      const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'ecc-install-config.schema.json');
      const schema = JSON.parse(require('fs').readFileSync(schemaPath, 'utf8'));
      const schemaTargets = schema.properties.target.enum;
      const adapters = listInstallTargetAdapters();

      for (const adapter of adapters) {
        assert.ok(schemaTargets.includes(adapter.target), `Adapter target "${adapter.target}" is not in schema enum. ` + `Schema targets: ${schemaTargets.join(', ')}`);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('every adapter target is in SUPPORTED_INSTALL_TARGETS (regression guard)', () => {
      const { SUPPORTED_INSTALL_TARGETS } = require('../../scripts/lib/install-manifests');
      const adapters = listInstallTargetAdapters();

      for (const adapter of adapters) {
        assert.ok(
          SUPPORTED_INSTALL_TARGETS.includes(adapter.target),
          `Adapter target "${adapter.target}" is not in SUPPORTED_INSTALL_TARGETS. ` + `Supported: ${SUPPORTED_INSTALL_TARGETS.join(', ')}`
        );
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('resolves claude-project adapter root and install-state path from project root', () => {
      const adapter = getInstallTargetAdapter('claude-project');
      const projectRoot = '/workspace/app';
      const root = adapter.resolveRoot({ projectRoot });
      const statePath = adapter.getInstallStatePath({ projectRoot });

      assert.strictEqual(adapter.id, 'claude-project');
      assert.strictEqual(adapter.target, 'claude-project');
      assert.strictEqual(adapter.kind, 'project');
      assert.strictEqual(root, path.join(projectRoot, '.claude'));
      assert.strictEqual(statePath, path.join(projectRoot, '.claude', 'ecc', 'install-state.json'));
    })
  )
    passed++;
  else failed++;

  if (
    test('claude-project adapter supports lookup by target and adapter id', () => {
      const byTarget = getInstallTargetAdapter('claude-project');
      const byId = getInstallTargetAdapter('claude-project');

      assert.strictEqual(byTarget.id, 'claude-project');
      assert.strictEqual(byId.id, 'claude-project');
      assert.ok(byTarget.supports('claude-project'));
    })
  )
    passed++;
  else failed++;

  if (
    test('plans project-scoped namespaced Claude rules and flat skills', () => {
      const repoRoot = path.join(__dirname, '..', '..');
      const projectRoot = '/workspace/app';

      const plan = planInstallTargetScaffold({
        target: 'claude-project',
        repoRoot,
        projectRoot,
        modules: [
          {
            id: 'rules-core',
            paths: ['rules']
          },
          {
            id: 'workflow-quality',
            paths: ['skills/tdd-workflow']
          }
        ]
      });

      assert.strictEqual(plan.adapter.id, 'claude-project');
      assert.strictEqual(plan.targetRoot, path.join(projectRoot, '.claude'));
      assert.strictEqual(plan.installStatePath, path.join(projectRoot, '.claude', 'ecc', 'install-state.json'));
      assert.ok(
        plan.operations.some(operation => normalizedRelativePath(operation.sourceRelativePath) === 'rules' && operation.destinationPath === path.join(projectRoot, '.claude', 'rules', 'ecc')),
        'Should install bundled rules under project-scope rules/ecc'
      );
      assert.ok(
        plan.operations.some(
          operation => normalizedRelativePath(operation.sourceRelativePath) === 'skills/tdd-workflow' && operation.destinationPath === path.join(projectRoot, '.claude', 'skills', 'tdd-workflow')
        ),
        'Should install bundled skills under project-scope skills'
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('claude-project skips foreign platform source paths', () => {
      const repoRoot = path.join(__dirname, '..', '..');
      const projectRoot = '/workspace/app';

      const plan = planInstallTargetScaffold({
        target: 'claude-project',
        repoRoot,
        projectRoot,
        modules: [
          {
            id: 'platform-configs',
            paths: ['.codex', 'rules']
          }
        ]
      });

      assert.ok(
        plan.operations.some(operation => normalizedRelativePath(operation.sourceRelativePath) === 'rules' && operation.destinationPath === path.join(projectRoot, '.claude', 'rules', 'ecc')),
        'Should still include non-foreign rules path (guards against empty-plan regression)'
      );
      assert.ok(
        !plan.operations.some(operation => normalizedRelativePath(operation.sourceRelativePath) === '.codex' || normalizedRelativePath(operation.sourceRelativePath).startsWith('.codex/')),
        'Should skip foreign Codex platform paths'
      );
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
