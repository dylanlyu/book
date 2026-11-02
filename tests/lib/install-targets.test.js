/**
 * Tests for scripts/lib/install-targets/registry.js
 */

const assert = require('assert');
const path = require('path');

const {
  getInstallTargetAdapter,
  listInstallTargetAdapters,
  planInstallTargetScaffold,
} = require('../../scripts/lib/install-targets/registry');
const { resolveInvocationEnvironment } = require('../../scripts/lib/invocation-environment');

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

  if (test('claude adapter honors CLAUDE_CONFIG_DIR over the default home directory', () => {
    const adapter = getInstallTargetAdapter('claude');
    const homeDir = '/Users/example';
    const claudeConfigDir = '/private/claude-profile';

    assert.strictEqual(
      adapter.resolveRoot({ homeDir, env: { CLAUDE_CONFIG_DIR: claudeConfigDir } }),
      path.resolve(claudeConfigDir)
    );
    assert.strictEqual(
      adapter.getInstallStatePath({ homeDir, env: { CLAUDE_CONFIG_DIR: claudeConfigDir } }),
      path.join(path.resolve(claudeConfigDir), 'ecc', 'install-state.json')
    );
  })) passed++; else failed++;

  if (test('claude adapter falls back to home/.claude when CLAUDE_CONFIG_DIR is unset or blank', () => {
    const adapter = getInstallTargetAdapter('claude');
    const homeDir = path.resolve('/Users/example');

    assert.strictEqual(
      adapter.resolveRoot({ homeDir, env: {} }),
      path.join(homeDir, '.claude')
    );
    assert.strictEqual(
      adapter.resolveRoot({ homeDir, env: { CLAUDE_CONFIG_DIR: '   ' } }),
      path.join(homeDir, '.claude')
    );
  })) passed++; else failed++;

  if (test('plans claude install under CLAUDE_CONFIG_DIR, keeping operations in the redirected root', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const homeDir = '/Users/example';
    const claudeConfigDir = '/private/claude-profile';

    const plan = planInstallTargetScaffold({
      target: 'claude',
      repoRoot,
      homeDir,
      env: { CLAUDE_CONFIG_DIR: claudeConfigDir },
      modules: [
        { id: 'rules-core', paths: ['rules'] },
        { id: 'docs-core', paths: ['docs'] },
      ],
    });

    assert.strictEqual(plan.targetRoot, path.resolve(claudeConfigDir));
    assert.ok(
      plan.operations.every(operation => (
        operation.destinationPath === plan.targetRoot
        || operation.destinationPath.startsWith(`${plan.targetRoot}${path.sep}`)
      )),
      'Should keep every managed operation inside the CLAUDE_CONFIG_DIR root'
    );
  })) passed++; else failed++;

  if (test('invocation environments are immutable snapshots', () => {
    const source = { ECC_TEST_CONFIG_DIR: '/custom/config' };
    const selected = resolveInvocationEnvironment({ env: source });
    const ambient = resolveInvocationEnvironment();
    assert.notStrictEqual(selected, source);
    assert.notStrictEqual(ambient, process.env);
    selected.ECC_TEST_CONFIG_DIR = '/mutated';
    assert.strictEqual(source.ECC_TEST_CONFIG_DIR, '/custom/config');
  })) passed++; else failed++;

  if (test('convertWindowsPathToWSL converts Windows paths on WSL', () => {
    const { convertWindowsPathToWSL, resetWSLDetection, setWSLForTesting } = require('../../scripts/lib/install-targets/helpers');
    setWSLForTesting(true);
    try {
      assert.strictEqual(convertWindowsPathToWSL('C:\\Users\\test\\.claude'), '/mnt/c/Users/test/.claude');
      assert.strictEqual(convertWindowsPathToWSL('D:/Projects'), '/mnt/d/Projects');
      assert.strictEqual(convertWindowsPathToWSL('C:\\Path\\With\\Backslashes'), '/mnt/c/Path/With/Backslashes');
    } finally {
      resetWSLDetection();
    }
  })) passed++; else failed++;

  if (test('convertWindowsPathToWSL returns original path when not on WSL', () => {
    const { convertWindowsPathToWSL, resetWSLDetection, setWSLForTesting } = require('../../scripts/lib/install-targets/helpers');
    setWSLForTesting(false);
    try {
      assert.strictEqual(convertWindowsPathToWSL('C:\\Users\\test\\.claude'), 'C:\\Users\\test\\.claude');
      assert.strictEqual(convertWindowsPathToWSL('/home/user/.claude'), '/home/user/.claude');
    } finally {
      resetWSLDetection();
    }
  })) passed++; else failed++;

  if (test('convertWindowsPathToWSL handles non-string input', () => {
    const { convertWindowsPathToWSL, resetWSLDetection, setWSLForTesting } = require('../../scripts/lib/install-targets/helpers');
    setWSLForTesting(true);
    try {
      assert.strictEqual(convertWindowsPathToWSL(null), null);
      assert.strictEqual(convertWindowsPathToWSL(undefined), undefined);
      assert.strictEqual(convertWindowsPathToWSL(123), 123);
    } finally {
      resetWSLDetection();
    }
  })) passed++; else failed++;

  if (test('claude adapter converts CLAUDE_CONFIG_DIR Windows path to WSL path on WSL', () => {
    const adapter = getInstallTargetAdapter('claude');
    const homeDir = '/home/user';
    const windowsConfigDir = 'C:\\Users\\test\\.claude';
    const expectedWslPath = '/mnt/c/Users/test/.claude';

    // Mock WSL detection
    const { setWSLForTesting } = require('../../scripts/lib/install-targets/helpers');
    setWSLForTesting(true);
    try {
      const resolved = adapter.resolveRoot({ homeDir, env: { CLAUDE_CONFIG_DIR: windowsConfigDir } });
      assert.strictEqual(resolved, path.resolve(expectedWslPath));
      const statePath = adapter.getInstallStatePath({ homeDir, env: { CLAUDE_CONFIG_DIR: windowsConfigDir } });
      assert.strictEqual(statePath, path.join(path.resolve(expectedWslPath), 'ecc', 'install-state.json'));
    } finally {
      setWSLForTesting(null);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
