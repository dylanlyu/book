/**
 * Tests for scripts/lib/install-lifecycle.js
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildDoctorReport, discoverInstalledStates, normalizeTargets, repairInstalledStates, uninstallInstalledStates } = require('../../scripts/lib/install-lifecycle');
const { createInstallState, readInstallState, writeInstallState } = require('../../scripts/lib/install-state');
const {
  assertClaudeSettingsPath,
  materializeManagedHooks,
} = require('../../scripts/lib/install/claude-settings');
const { readHooksConfig } = require('../../scripts/lib/hooks-config');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CURRENT_PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
const CURRENT_MANIFEST_VERSION = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifests', 'install-modules.json'), 'utf8')).version;

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

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeState(filePath, options) {
  const state = createInstallState(options);
  writeInstallState(filePath, state);
  return state;
}

function currentManagedHooks(targetRoot) {
  return materializeManagedHooks(
    readHooksConfig(path.join(REPO_ROOT, 'hooks', 'hooks.json')),
    targetRoot
  );
}

function managedHookEntry(id, command) {
  return {
    id,
    matcher: '.*',
    hooks: [{ type: 'command', command }],
  };
}

function writeClaudeState(homeDir, overrides = {}) {
  const targetRoot = overrides.targetRoot || path.join(homeDir, '.claude');
  const installStatePath = overrides.installStatePath
    || path.join(targetRoot, 'ecc', 'install-state.json');
  const options = {
    adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
    targetRoot,
    installStatePath,
    request: {
      profile: null,
      modules: [],
      includeComponents: [],
      excludeComponents: [],
      legacyLanguages: [],
      legacyMode: true,
      hookConsent: 'enabled',
      ...(overrides.request || {}),
    },
    resolution: {
      selectedModules: ['legacy-claude-install'],
      skippedModules: [],
      ...(overrides.resolution || {}),
    },
    operations: overrides.operations || [],
    source: {
      repoVersion: CURRENT_PACKAGE_VERSION,
      repoCommit: 'abc123',
      manifestVersion: CURRENT_MANIFEST_VERSION,
      ...(overrides.source || {}),
    },
  };

  writeState(installStatePath, options);
  return {
    targetRoot,
    installStatePath,
    state: options,
  };
}

function createCursorStateOptions(projectRoot, overrides = {}) {
  const targetRoot = overrides.targetRoot || path.join(projectRoot, '.claude');
  const installStatePath = overrides.installStatePath || path.join(targetRoot, 'ecc', 'install-state.json');

  return {
    adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
    targetRoot,
    installStatePath,
    request: {
      profile: null,
      modules: [],
      includeComponents: [],
      excludeComponents: [],
      legacyLanguages: ['typescript'],
      legacyMode: true,
      ...(overrides.request || {})
    },
    resolution: {
      selectedModules: ['legacy-claude-project-install'],
      skippedModules: [],
      ...(overrides.resolution || {})
    },
    operations: overrides.operations || [],
    source: {
      repoVersion: CURRENT_PACKAGE_VERSION,
      repoCommit: 'abc123',
      manifestVersion: CURRENT_MANIFEST_VERSION,
      ...(overrides.source || {})
    }
  };
}

function writeCursorState(projectRoot, overrides = {}) {
  const options = createCursorStateOptions(projectRoot, overrides);
  writeState(options.installStatePath, options);
  return {
    targetRoot: options.targetRoot,
    installStatePath: options.installStatePath,
    state: options
  };
}

function withTemporarilyMovedPath(filePath, callback) {
  if (!fs.existsSync(filePath)) {
    try {
      return callback(null);
    } finally {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    }
  }

  const backupPath = `${filePath}.backup-${process.pid}-${Date.now()}`;
  fs.renameSync(filePath, backupPath);

  try {
    return callback(backupPath);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { recursive: true, force: true });
    }
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, filePath);
    }
  }
}

function managedOperation(kind, destinationPath, overrides = {}) {
  // Uninstall preserves managed files whose recorded digest cannot be verified,
  // so fixtures record the digest of the file they just wrote.
  let contentSha256;
  try {
    const stat = fs.lstatSync(destinationPath);
    if (stat.isFile()) {
      contentSha256 = crypto.createHash('sha256').update(fs.readFileSync(destinationPath)).digest('hex');
    }
  } catch (_error) {
    contentSha256 = undefined;
  }

  return {
    kind,
    moduleId: kind === 'update-claude-settings' ? 'hooks-runtime' : 'test-module',
    sourceRelativePath: kind === 'update-claude-settings'
      ? 'hooks/hooks.json'
      : 'rules/common/coding-style.md',
    destinationPath,
    strategy: kind,
    ownership: 'managed',
    scaffoldOnly: false,
    ...(contentSha256 ? { contentSha256 } : {}),
    ...overrides
  };
}

function runTests() {
  console.log('\n=== Testing install-lifecycle.js ===\n');

  let passed = 0;
  let failed = 0;

  if (
    test('normalizes default targets and dedupes adapter aliases', () => {
      const defaultTargets = normalizeTargets();

      assert.ok(defaultTargets.includes('claude'));
      assert.ok(defaultTargets.includes('claude-project'));
      assert.ok(defaultTargets.includes('codex'));
      assert.deepStrictEqual(normalizeTargets(['claude-project', 'claude-project', 'claude-home', 'claude']), ['claude-project', 'claude']);
    })
  )
    passed++;
  else failed++;

  if (
    test('discovers installed states for multiple targets in the current context', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const claudeStatePath = path.join(homeDir, '.claude', 'ecc', 'install-state.json');
        const cursorStatePath = path.join(projectRoot, '.claude', 'ecc', 'install-state.json');

        writeState(claudeStatePath, {
          adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
          targetRoot: path.join(homeDir, '.claude'),
          installStatePath: claudeStatePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-rules'],
            skippedModules: []
          },
          operations: [],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        writeState(cursorStatePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot: path.join(projectRoot, '.claude'),
          installStatePath: cursorStatePath,
          request: {
            profile: 'core',
            modules: [],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['rules-core', 'platform-configs'],
            skippedModules: []
          },
          operations: [],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'def456',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const records = discoverInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude', 'claude-project']
        });

        assert.strictEqual(records.length, 2);
        assert.strictEqual(records[0].exists, true);
        assert.strictEqual(records[1].exists, true);
        assert.strictEqual(records[0].state.target.id, 'claude-home');
        assert.strictEqual(records[1].state.target.id, 'claude-project');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('discovers missing and invalid install-state records', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        let records = discoverInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].exists, false);
        assert.strictEqual(records[0].state, null);
        assert.strictEqual(records[0].error, null);

        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, '{not-json', 'utf8');

        records = discoverInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(records[0].exists, true);
        assert.strictEqual(records[0].state, null);
        assert.ok(records[0].error.includes('Failed to read install-state'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports missing managed files as an error', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        fs.mkdirSync(targetRoot, { recursive: true });

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: ['platform-configs'],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['platform-configs'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'copy-file',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude/hooks.json',
              destinationPath: path.join(targetRoot, 'hooks.json'),
              strategy: 'sync-root-children',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(report.results.length, 1);
        assert.strictEqual(report.results[0].status, 'error');
        assert.ok(report.results[0].issues.some(issue => issue.code === 'missing-managed-files'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports target mismatches, missing sources, unverified operations, and version drift', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const actualTargetRoot = path.join(projectRoot, '.claude');
        const actualStatePath = path.join(actualTargetRoot, 'ecc', 'install-state.json');
        const recordedTargetRoot = path.join(projectRoot, '.old-claude-project');
        const recordedStatePath = path.join(recordedTargetRoot, 'state.json');
        const copyDestination = path.join(actualTargetRoot, 'rules', 'missing-source.md');
        const customDestination = path.join(actualTargetRoot, 'custom.txt');

        fs.mkdirSync(path.dirname(copyDestination), { recursive: true });
        fs.writeFileSync(copyDestination, 'managed copy\n');
        fs.writeFileSync(customDestination, 'custom\n');

        writeState(
          actualStatePath,
          createCursorStateOptions(projectRoot, {
            targetRoot: recordedTargetRoot,
            installStatePath: recordedStatePath,
            request: {
              profile: 'missing-profile',
              legacyLanguages: [],
              legacyMode: false
            },
            resolution: {
              selectedModules: [],
              skippedModules: []
            },
            source: {
              repoVersion: '0.0.1',
              manifestVersion: CURRENT_MANIFEST_VERSION + 100
            },
            operations: [
              managedOperation('copy-file', copyDestination, {
                sourceRelativePath: 'missing/source.md',
                strategy: 'copy-file'
              }),
              managedOperation('custom-kind', customDestination)
            ]
          })
        );

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
        const codes = report.results[0].issues.map(issue => issue.code);

        assert.strictEqual(report.results[0].status, 'error');
        assert.ok(codes.includes('missing-target-root'));
        assert.ok(codes.includes('target-root-mismatch'));
        assert.ok(codes.includes('install-state-path-mismatch'));
        assert.ok(codes.includes('missing-source-files'));
        assert.ok(codes.includes('unverified-managed-operations'));
        assert.ok(codes.includes('manifest-version-mismatch'));
        assert.ok(codes.includes('repo-version-mismatch'));
        assert.ok(codes.includes('resolution-unavailable'));
        assert.strictEqual(report.summary.checkedCount, 1);
        assert.ok(report.summary.errorCount >= 3);
        assert.ok(report.summary.warningCount >= 4);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor verifies render-template and merge-json operations by content', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const templatePath = path.join(targetRoot, 'generated.txt');
        const jsonPath = path.join(targetRoot, 'settings.json');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(templatePath, 'generated\n');
        fs.writeFileSync(
          jsonPath,
          JSON.stringify(
            {
              keep: true,
              nested: {
                managed: true,
                extra: true
              }
            },
            null,
            2
          )
        );

        writeCursorState(projectRoot, {
          operations: [
            managedOperation('render-template', templatePath, {
              renderedContent: 'generated\n'
            }),
            managedOperation('merge-json', jsonPath, {
              mergePayload: {
                nested: {
                  managed: true
                }
              }
            })
          ]
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(report.results[0].status, 'ok');
        assert.strictEqual(report.results[0].issues.length, 0);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor classifies remove, unverified template/json, and invalid JSON operation health', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const templatePath = path.join(targetRoot, 'template.txt');
        const missingPayloadJsonPath = path.join(targetRoot, 'missing-payload.json');
        const invalidJsonPath = path.join(targetRoot, 'invalid.json');
        const removedPath = path.join(targetRoot, 'already-removed.txt');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(templatePath, 'generated\n');
        fs.writeFileSync(missingPayloadJsonPath, '{"managed":true}\n');
        fs.writeFileSync(invalidJsonPath, '{not-json', 'utf8');

        writeCursorState(projectRoot, {
          operations: [
            managedOperation('remove', removedPath),
            managedOperation('render-template', templatePath),
            managedOperation('merge-json', missingPayloadJsonPath),
            managedOperation('merge-json', invalidJsonPath, {
              mergePayload: { managed: true }
            })
          ]
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
        const codes = report.results[0].issues.map(issue => issue.code);

        assert.strictEqual(report.results[0].status, 'warning');
        assert.ok(codes.includes('unverified-managed-operations'));
        assert.ok(codes.includes('drifted-managed-files'));
        assert.ok(!report.results[0].issues.some(issue => issue.code === 'missing-managed-files'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports invalid install-state files as errors', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const statePath = path.join(projectRoot, '.claude', 'ecc', 'install-state.json');
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, '{"schemaVersion":"wrong"}\n');

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(report.results[0].status, 'error');
        assert.ok(report.results[0].issues.some(issue => issue.code === 'invalid-install-state'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports a healthy legacy install when managed files are present', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(homeDir, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const managedFile = path.join(targetRoot, 'rules', 'common', 'coding-style.md');
        const sourceContent = fs.readFileSync(path.join(REPO_ROOT, 'rules', 'common', 'coding-style.md'), 'utf8');
        fs.mkdirSync(path.dirname(managedFile), { recursive: true });
        fs.writeFileSync(managedFile, sourceContent);

        writeState(statePath, {
          adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-rules'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'copy-file',
              moduleId: 'legacy-claude-rules',
              sourceRelativePath: 'rules/common/coding-style.md',
              destinationPath: managedFile,
              strategy: 'preserve-relative-path',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude']
        });

        assert.strictEqual(report.results.length, 1);
        assert.strictEqual(report.results[0].status, 'ok');
        assert.strictEqual(report.results[0].issues.length, 0);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair dry-run reports planned copy repairs without writing files', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const destinationPath = path.join(targetRoot, 'rules', 'coding-style.md');
        writeCursorState(projectRoot, {
          operations: [
            managedOperation('copy-file', destinationPath, {
              sourceRelativePath: 'rules/common/coding-style.md',
              strategy: 'copy-file'
            })
          ]
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project'],
          dryRun: true
        });

        assert.strictEqual(result.dryRun, true);
        assert.strictEqual(result.results[0].status, 'planned');
        assert.deepStrictEqual(result.results[0].plannedRepairs, [destinationPath]);
        assert.ok(!fs.existsSync(destinationPath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('Claude repair and dry-run preserve user-owned flat skills during legacy migration', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(homeDir, '.claude');
        const installStatePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const flatSkillPath = path.join(targetRoot, 'skills', 'tdd-workflow', 'SKILL.md');
        const legacySkillPath = path.join(targetRoot, 'skills', 'ecc', 'tdd-workflow', 'SKILL.md');
        fs.mkdirSync(path.dirname(flatSkillPath), { recursive: true });
        fs.mkdirSync(path.dirname(legacySkillPath), { recursive: true });
        fs.writeFileSync(flatSkillPath, '# User-owned flat skill\n');
        fs.writeFileSync(legacySkillPath, '# Previously managed nested skill\n');

        writeState(installStatePath, {
          adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
          targetRoot,
          installStatePath,
          request: {
            profile: null,
            modules: ['workflow-quality'],
            includeComponents: [],
            excludeComponents: [],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['platform-configs', 'workflow-quality'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'copy-file',
              moduleId: 'workflow-quality',
              sourcePath: path.join(REPO_ROOT, 'skills', 'tdd-workflow', 'SKILL.md'),
              sourceRelativePath: path.join('skills', 'tdd-workflow', 'SKILL.md'),
              destinationPath: legacySkillPath,
              strategy: 'preserve-relative-path',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const dryRun = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude'],
          dryRun: true
        });
        assert.ok(!dryRun.results[0].plannedRepairs.includes(flatSkillPath));
        assert.ok(dryRun.results[0].warnings.some(warning => warning.includes('user-owned')));
        assert.strictEqual(fs.readFileSync(flatSkillPath, 'utf8'), '# User-owned flat skill\n');
        assert.strictEqual(fs.readFileSync(legacySkillPath, 'utf8'), '# Previously managed nested skill\n');

        const repaired = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude']
        });
        assert.strictEqual(repaired.results[0].status, 'repaired');
        assert.ok(repaired.results[0].warnings.some(warning => warning.includes('user-owned')));
        assert.strictEqual(fs.readFileSync(flatSkillPath, 'utf8'), '# User-owned flat skill\n');
        assert.strictEqual(fs.readFileSync(legacySkillPath, 'utf8'), fs.readFileSync(path.join(REPO_ROOT, 'skills', 'tdd-workflow', 'SKILL.md'), 'utf8'));
        const repairedState = JSON.parse(fs.readFileSync(installStatePath, 'utf8'));
        assert.ok(repairedState.operations.some(operation => operation.destinationPath === legacySkillPath));
        assert.ok(!repairedState.operations.some(operation => operation.destinationPath === flatSkillPath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('Claude repair migration derives roots from the adapter and removes only the managed legacy file', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');

      try {
        const targetRoot = path.join(homeDir, '.claude');
        const adapterStatePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const recordedStatePath = path.join(outsideRoot, 'recorded-state.json');
        const flatSkillPath = path.join(targetRoot, 'skills', 'tdd-workflow', 'SKILL.md');
        const legacySkillPath = path.join(targetRoot, 'skills', 'ecc', 'tdd-workflow', 'SKILL.md');
        fs.mkdirSync(path.dirname(legacySkillPath), { recursive: true });
        fs.writeFileSync(legacySkillPath, '# Previously managed nested skill\n');

        writeState(adapterStatePath, {
          adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
          targetRoot: outsideRoot,
          installStatePath: recordedStatePath,
          request: {
            profile: null,
            modules: ['workflow-quality'],
            includeComponents: [],
            excludeComponents: [],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['platform-configs', 'workflow-quality'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'copy-file',
              moduleId: 'workflow-quality',
              sourcePath: path.join(REPO_ROOT, 'skills', 'tdd-workflow', 'SKILL.md'),
              sourceRelativePath: path.join('skills', 'tdd-workflow', 'SKILL.md'),
              destinationPath: legacySkillPath,
              strategy: 'preserve-relative-path',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });
        fs.writeFileSync(recordedStatePath, 'outside sentinel\n');

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.strictEqual(fs.readFileSync(flatSkillPath, 'utf8'), fs.readFileSync(path.join(REPO_ROOT, 'skills', 'tdd-workflow', 'SKILL.md'), 'utf8'));
        assert.ok(!fs.existsSync(legacySkillPath));
        assert.strictEqual(fs.readFileSync(recordedStatePath, 'utf8'), 'outside sentinel\n');
        const refreshedState = readInstallState(adapterStatePath);
        assert.strictEqual(refreshedState.target.root, targetRoot);
        assert.strictEqual(refreshedState.target.installStatePath, adapterStatePath);
        assert.ok(refreshedState.operations.some(operation => operation.destinationPath === flatSkillPath));
        assert.ok(!refreshedState.operations.some(operation => operation.destinationPath === legacySkillPath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair copies missing managed files from recorded source paths', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const destinationPath = path.join(targetRoot, 'rules', 'coding-style.md');
        const sourcePath = path.join(REPO_ROOT, 'rules', 'common', 'coding-style.md');
        writeCursorState(projectRoot, {
          operations: [
            managedOperation('copy-file', destinationPath, {
              sourceRelativePath: 'rules/common/coding-style.md',
              strategy: 'copy-file'
            })
          ]
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.ok(fs.readFileSync(destinationPath).equals(fs.readFileSync(sourcePath)));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair reads source content and mode from one no-follow descriptor', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const sourcePath = path.join(REPO_ROOT, 'rules', 'common', 'coding-style.md');
      const originalStatSync = fs.statSync;

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const destinationPath = path.join(targetRoot, 'rules', 'coding-style.md');
        writeCursorState(projectRoot, {
          operations: [
            managedOperation('copy-file', destinationPath, {
              sourceRelativePath: 'rules/common/coding-style.md',
              strategy: 'copy-file'
            })
          ]
        });

        fs.statSync = function rejectSeparateSourceMetadataLookup(candidatePath, ...args) {
          if (path.resolve(candidatePath) === path.resolve(sourcePath)) {
            throw new Error('source metadata must come from the opened descriptor');
          }
          return originalStatSync.call(fs, candidatePath, ...args);
        };

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.ok(fs.readFileSync(destinationPath).equals(fs.readFileSync(sourcePath)));
      } finally {
        fs.statSync = originalStatSync;
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair reports invalid states, missing sources, unsupported operations, and no-op refreshes', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const invalidProjectRoot = createTempDir('install-lifecycle-invalid-');
      const missingSourceProjectRoot = createTempDir('install-lifecycle-missing-source-');
      const unsupportedProjectRoot = createTempDir('install-lifecycle-unsupported-');
      const okProjectRoot = createTempDir('install-lifecycle-ok-');

      try {
        const invalidStatePath = path.join(invalidProjectRoot, '.claude', 'ecc', 'install-state.json');
        fs.mkdirSync(path.dirname(invalidStatePath), { recursive: true });
        fs.writeFileSync(invalidStatePath, '{"schemaVersion":"wrong"}\n');

        let result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot: invalidProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Invalid install-state'));

        const missingDestination = path.join(missingSourceProjectRoot, '.claude', 'rules', 'missing.md');
        fs.mkdirSync(path.dirname(missingDestination), { recursive: true });
        fs.writeFileSync(missingDestination, 'managed\n');
        writeCursorState(missingSourceProjectRoot, {
          operations: [
            managedOperation('copy-file', missingDestination, {
              sourceRelativePath: 'missing/source.md',
              strategy: 'copy-file'
            })
          ]
        });
        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot: missingSourceProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Missing source file(s)'));

        const unsupportedDestination = path.join(unsupportedProjectRoot, '.claude', 'custom.txt');
        writeCursorState(unsupportedProjectRoot, {
          operations: [managedOperation('custom-kind', unsupportedDestination)]
        });
        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot: unsupportedProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Unsupported repair operation kind'));

        writeCursorState(okProjectRoot, { operations: [] });
        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot: okProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'ok');
        assert.strictEqual(result.results[0].stateRefreshed, true);
        assert.strictEqual(result.summary.errorCount, 0);
      } finally {
        cleanup(homeDir);
        cleanup(invalidProjectRoot);
        cleanup(missingSourceProjectRoot);
        cleanup(unsupportedProjectRoot);
        cleanup(okProjectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair dry-run reports ok when no managed operations need changes', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        writeCursorState(projectRoot, { operations: [] });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project'],
          dryRun: true
        });

        assert.strictEqual(result.results[0].status, 'ok');
        assert.strictEqual(result.results[0].stateRefreshed, true);
        assert.deepStrictEqual(result.results[0].plannedRepairs, []);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('withTemporarilyMovedPath cleans up newly created paths when nothing was pre-existing', () => {
      const filePath = path.join(REPO_ROOT, '.codex', 'dist');
      const backupPath = `${filePath}.backup-${process.pid}-test`;

      try {
        fs.rmSync(filePath, { recursive: true, force: true });
        fs.rmSync(backupPath, { recursive: true, force: true });

        const result = withTemporarilyMovedPath(filePath, receivedBackupPath => {
          assert.strictEqual(receivedBackupPath, null);
          fs.mkdirSync(path.join(filePath, 'plugins'), { recursive: true });
          fs.mkdirSync(path.join(filePath, 'tools'), { recursive: true });
          fs.writeFileSync(path.join(filePath, 'index.js'), '// temp build\n');
          return 'callback-result';
        });

        assert.strictEqual(result, 'callback-result');
        assert.ok(!fs.existsSync(filePath), 'Temporary path should be removed after the callback');
      } finally {
        fs.rmSync(filePath, { recursive: true, force: true });
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair surfaces missing source errors from execution when destination is absent', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const destinationPath = path.join(projectRoot, '.claude', 'rules', 'missing.md');
        writeCursorState(projectRoot, {
          operations: [
            managedOperation('copy-file', destinationPath, {
              sourceRelativePath: 'missing/source.md',
              strategy: 'copy-file'
            })
          ]
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Missing source file for repair'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair rejects absolute and parent-relative source metadata outside the repository', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const outsideRoot = createTempDir('install-lifecycle-source-outside-');
      const outsideSourcePath = path.join(outsideRoot, 'secret.txt');
      fs.writeFileSync(outsideSourcePath, 'outside secret\n');

      try {
        const unsafeSources = [outsideSourcePath, path.relative(REPO_ROOT, outsideSourcePath)];

        for (const sourceRelativePath of unsafeSources) {
          const projectRoot = createTempDir('install-lifecycle-project-');
          try {
            const destinationPath = path.join(projectRoot, '.claude', 'copied-secret.txt');
            writeCursorState(projectRoot, {
              operations: [
                managedOperation('copy-file', destinationPath, {
                  sourceRelativePath,
                  strategy: 'copy-file'
                })
              ]
            });

            const doctor = buildDoctorReport({
              repoRoot: REPO_ROOT,
              homeDir,
              projectRoot,
              targets: ['claude-project']
            });
            const result = repairInstalledStates({
              repoRoot: REPO_ROOT,
              homeDir,
              projectRoot,
              targets: ['claude-project']
            });

            assert.strictEqual(doctor.results[0].status, 'error');
            assert.ok(doctor.results[0].issues.some(issue => issue.code === 'unsafe-repair-source'));
            assert.strictEqual(result.results[0].status, 'error');
            assert.ok(result.results[0].error.includes('unsafe repair source metadata'));
            assert.ok(!result.results[0].error.includes(outsideSourcePath));
            assert.ok(!fs.existsSync(destinationPath));
          } finally {
            cleanup(projectRoot);
          }
        }
      } finally {
        cleanup(homeDir);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor and repair reject unsafe destinations before health inspection reads them', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const outsideRoot = createTempDir('install-lifecycle-destination-outside-');
      const copySource = fs.readFileSync(path.join(REPO_ROOT, 'rules', 'common', 'coding-style.md'), 'utf8');
      const cases = [
        {
          name: 'matching copy',
          kind: 'copy-file',
          content: copySource,
          overrides: { strategy: 'copy-file' }
        },
        {
          name: 'drifted copy',
          kind: 'copy-file',
          content: 'outside drift\n',
          overrides: { strategy: 'copy-file' }
        },
        {
          name: 'rendered template',
          kind: 'render-template',
          content: 'managed template\n',
          overrides: {
            renderedContent: 'managed template\n',
            strategy: 'render-template'
          }
        },
        {
          name: 'merged JSON',
          kind: 'merge-json',
          content: '{"managed":true,"outside":"sentinel"}\n',
          overrides: {
            mergePayload: { managed: true },
            strategy: 'merge-json'
          }
        }
      ];

      try {
        for (const testCase of cases) {
          const projectRoot = createTempDir('install-lifecycle-project-');
          const destinationPath = path.join(outsideRoot, `${testCase.name}.txt`);
          const originalExistsSync = fs.existsSync;

          try {
            fs.writeFileSync(destinationPath, testCase.content);
            writeCursorState(projectRoot, {
              operations: [managedOperation(testCase.kind, destinationPath, testCase.overrides)]
            });

            fs.existsSync = function existsSyncWithoutOutsideInspection(candidatePath) {
              if (path.resolve(candidatePath) === path.resolve(destinationPath)) {
                throw new Error(`unsafe destination inspected: ${testCase.name}`);
              }
              return originalExistsSync.call(fs, candidatePath);
            };

            const doctor = buildDoctorReport({
              repoRoot: REPO_ROOT,
              homeDir,
              projectRoot,
              targets: ['claude-project']
            });
            const repair = repairInstalledStates({
              repoRoot: REPO_ROOT,
              homeDir,
              projectRoot,
              targets: ['claude-project']
            });

            assert.strictEqual(doctor.results[0].status, 'error');
            assert.ok(doctor.results[0].issues.some(issue => issue.code === 'unsafe-managed-destination'));
            assert.strictEqual(repair.results[0].status, 'error');
            assert.ok(repair.results[0].error.includes('unsafe managed destination'));
            assert.strictEqual(originalExistsSync.call(fs, destinationPath), true, `${testCase.name} destination should remain untouched`);
          } finally {
            fs.existsSync = originalExistsSync;
            cleanup(projectRoot);
          }
        }
      } finally {
        cleanup(homeDir);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports drifted managed files as a warning', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const sourcePath = path.join(REPO_ROOT, '.codex', 'AGENTS.md');
        const destinationPath = path.join(targetRoot, 'settings.json');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, '{"drifted":true}\n');

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: ['platform-configs'],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['platform-configs'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'copy-file',
              moduleId: 'platform-configs',
              sourcePath,
              sourceRelativePath: '.codex/AGENTS.md',
              destinationPath,
              strategy: 'sync-root-children',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(report.results.length, 1);
        assert.strictEqual(report.results[0].status, 'warning');
        assert.ok(report.results[0].issues.some(issue => issue.code === 'drifted-managed-files'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('doctor reports manifest resolution drift for non-legacy installs', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        fs.mkdirSync(targetRoot, { recursive: true });

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: 'core',
            modules: [],
            legacyLanguages: [],
            legacyMode: false
          },
          resolution: {
            selectedModules: ['rules-core'],
            skippedModules: []
          },
          operations: [],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const report = buildDoctorReport({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(report.results.length, 1);
        assert.strictEqual(report.results[0].status, 'warning');
        assert.ok(report.results[0].issues.some(issue => issue.code === 'resolution-drift'));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair restores render-template outputs from recorded rendered content', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(homeDir, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'plugin.json');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, '{"drifted":true}\n');

        writeState(statePath, {
          adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-rules'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'render-template',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude-plugin/plugin.json.template',
              destinationPath,
              strategy: 'render-template',
              ownership: 'managed',
              scaffoldOnly: false,
              renderedContent: '{"ok":true}\n'
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.strictEqual(fs.readFileSync(destinationPath, 'utf8'), '{"ok":true}\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair reapplies merge-json operations without clobbering unrelated keys', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'hooks.json');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(
          destinationPath,
          JSON.stringify(
            {
              existing: true,
              nested: {
                enabled: false
              }
            },
            null,
            2
          )
        );

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-project-install'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'merge-json',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude/hooks.json',
              destinationPath,
              strategy: 'merge-json',
              ownership: 'managed',
              scaffoldOnly: false,
              mergePayload: {
                nested: {
                  enabled: true
                },
                managed: 'yes'
              }
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(destinationPath, 'utf8')), {
          existing: true,
          nested: {
            enabled: true
          },
          managed: 'yes'
        });
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair re-applies managed remove operations when files reappear', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'legacy-note.txt');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'stale');

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-project-install'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'remove',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude/legacy-note.txt',
              destinationPath,
              strategy: 'remove',
              ownership: 'managed',
              scaffoldOnly: false
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'repaired');
        assert.ok(!fs.existsSync(destinationPath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair rejects a symlink inserted while creating a missing destination parent', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');
      const targetRoot = path.join(projectRoot, '.claude');
      const destinationParent = path.join(targetRoot, 'late-parent');
      const destinationPath = path.join(destinationParent, 'managed.md');
      const outsideDestinationPath = path.join(outsideRoot, 'managed.md');
      const originalMkdirSync = fs.mkdirSync;
      let canonicalDestinationParent;
      let insertedSymlink = false;
      let result;

      try {
        writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });
        canonicalDestinationParent = path.join(fs.realpathSync(targetRoot), path.basename(destinationParent));

        fs.mkdirSync = function mkdirSyncWithLateSymlink(directoryPath, options) {
          if (!insertedSymlink && path.resolve(directoryPath) === canonicalDestinationParent) {
            originalMkdirSync.call(fs, path.dirname(canonicalDestinationParent), { recursive: true });
            fs.symlinkSync(outsideRoot, canonicalDestinationParent, process.platform === 'win32' ? 'junction' : 'dir');
            insertedSymlink = true;
            return undefined;
          }
          return originalMkdirSync.call(fs, directoryPath, options);
        };

        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
      } finally {
        fs.mkdirSync = originalMkdirSync;
      }

      try {
        assert.strictEqual(insertedSymlink, true);
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('outside the install root'));
        assert.ok(!fs.existsSync(outsideDestinationPath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair rejects an in-root final symlink without overwriting its victim', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const victimPath = path.join(targetRoot, 'victim.md');
        const destinationPath = path.join(targetRoot, 'managed.md');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(victimPath, 'victim sentinel\n');
        try {
          fs.symlinkSync(victimPath, destinationPath);
        } catch {
          console.log('    (symlink unsupported on this platform; skipping)');
          return;
        }
        writeCursorState(projectRoot, {
          operations: [
            managedOperation('render-template', destinationPath, {
              renderedContent: 'managed replacement\n',
              strategy: 'render-template'
            })
          ]
        });

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('final symlink'));
        assert.strictEqual(fs.readFileSync(victimPath, 'utf8'), 'victim sentinel\n');
        assert.strictEqual(fs.lstatSync(destinationPath).isSymbolicLink(), true);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair uses no-follow writes when a final destination becomes a symlink', () => {
      if (!fs.constants.O_NOFOLLOW) {
        console.log('    (O_NOFOLLOW unsupported on this platform; skipping)');
        return;
      }

      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');
      const targetRoot = path.join(projectRoot, '.claude');
      const destinationPath = path.join(targetRoot, 'managed.md');
      const outsideDestinationPath = path.join(outsideRoot, 'managed.md');
      const originalOpenSync = fs.openSync;
      let canonicalDestinationPath;
      let insertedSymlink = false;
      let result;

      try {
        fs.writeFileSync(outsideDestinationPath, 'outside sentinel\n');
        writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });
        canonicalDestinationPath = path.join(fs.realpathSync(targetRoot), path.basename(destinationPath));

        fs.openSync = function openSyncWithLateSymlink(filePath, flags, mode) {
          if (!insertedSymlink && path.resolve(filePath) === canonicalDestinationPath) {
            fs.symlinkSync(outsideDestinationPath, canonicalDestinationPath);
            insertedSymlink = true;
          }
          return originalOpenSync.call(fs, filePath, flags, mode);
        };

        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
      } finally {
        fs.openSync = originalOpenSync;
      }

      try {
        assert.strictEqual(insertedSymlink, true);
        assert.strictEqual(result.results[0].status, 'error');
        assert.strictEqual(fs.readFileSync(outsideDestinationPath, 'utf8'), 'outside sentinel\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair revalidates a pinned write before a swapped parent can truncate outside files', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');
      const targetRoot = path.join(projectRoot, '.claude');
      const destinationParent = path.join(targetRoot, 'late-parent');
      const backupParent = path.join(targetRoot, 'late-parent-backup');
      const destinationPath = path.join(destinationParent, 'managed.md');
      const outsideDestinationPath = path.join(outsideRoot, 'managed.md');
      const originalOpenSync = fs.openSync;
      let canonicalDestinationPath;
      let insertedSymlink = false;
      let result;

      const symlinkProbe = path.join(targetRoot, 'parent-symlink-probe');
      try {
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.symlinkSync(outsideRoot, symlinkProbe, process.platform === 'win32' ? 'junction' : 'dir');
        fs.rmSync(symlinkProbe, { force: true });
      } catch {
        console.log('    (symlink unsupported on this platform; skipping)');
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
        return;
      }

      try {
        fs.mkdirSync(destinationParent, { recursive: true });
        fs.writeFileSync(destinationPath, 'drifted managed content\n');
        fs.writeFileSync(outsideDestinationPath, 'outside sentinel\n');
        canonicalDestinationPath = fs.realpathSync(destinationPath);
        writeCursorState(projectRoot, {
          // No recorded digest: the destination must look drifted so repair rewrites it.
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file', contentSha256: undefined })]
        });

        fs.openSync = function openSyncWithLateParentSwap(filePath, flags, mode) {
          const isDestinationWrite = path.resolve(filePath) === canonicalDestinationPath && typeof flags === 'number' && (flags & fs.constants.O_WRONLY) === fs.constants.O_WRONLY;
          if (!insertedSymlink && isDestinationWrite) {
            fs.renameSync(destinationParent, backupParent);
            fs.symlinkSync(outsideRoot, destinationParent, process.platform === 'win32' ? 'junction' : 'dir');
            insertedSymlink = true;
          }
          return originalOpenSync.call(fs, filePath, flags, mode);
        };

        result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
      } finally {
        fs.openSync = originalOpenSync;
      }

      try {
        assert.strictEqual(insertedSymlink, true);
        assert.strictEqual(result.results[0].status, 'error');
        assert.strictEqual(fs.readFileSync(outsideDestinationPath, 'utf8'), 'outside sentinel\n');
        assert.strictEqual(fs.readFileSync(path.join(backupParent, 'managed.md'), 'utf8'), 'drifted managed content\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('repair refreshes only the adapter-derived install-state path', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const adapterStatePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const recordedStatePath = path.join(outsideRoot, 'recorded-state.json');
        const stateOptions = createCursorStateOptions(projectRoot, {
          installStatePath: recordedStatePath
        });
        writeState(adapterStatePath, stateOptions);
        fs.writeFileSync(recordedStatePath, 'outside sentinel\n');

        const result = repairInstalledStates({
          repoRoot: REPO_ROOT,
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'ok');
        assert.ok(fs.existsSync(adapterStatePath));
        assert.strictEqual(fs.readFileSync(recordedStatePath, 'utf8'), 'outside sentinel\n');
        const refreshedState = readInstallState(adapterStatePath);
        assert.strictEqual(refreshedState.target.root, targetRoot);
        assert.strictEqual(refreshedState.target.installStatePath, adapterStatePath);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall restores JSON merged files from recorded previous content', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'hooks.json');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(
          destinationPath,
          JSON.stringify(
            {
              existing: true,
              managed: true
            },
            null,
            2
          )
        );

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-project-install'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'merge-json',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude/hooks.json',
              destinationPath,
              strategy: 'merge-json',
              ownership: 'managed',
              scaffoldOnly: false,
              mergePayload: {
                managed: true
              },
              previousContent: JSON.stringify(
                {
                  existing: true
                },
                null,
                2
              )
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(destinationPath, 'utf8')), {
          existing: true
        });
        assert.ok(!fs.existsSync(statePath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall restores rendered template files from recorded previous content', () => {
      const tempDir = createTempDir('install-lifecycle-');

      try {
        const targetRoot = path.join(tempDir, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'plugin.json');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, '{"generated":true}\n');

        writeInstallState(
          statePath,
          createInstallState({
            adapter: { id: 'claude-home', target: 'claude', kind: 'home' },
            targetRoot,
            installStatePath: statePath,
            request: {
              profile: 'core',
              modules: ['platform-configs'],
              includeComponents: [],
              excludeComponents: [],
              legacyLanguages: [],
              legacyMode: false
            },
            resolution: {
              selectedModules: ['platform-configs'],
              skippedModules: []
            },
            source: {
              repoVersion: '1.8.0',
              repoCommit: 'abc123',
              manifestVersion: 1
            },
            operations: [
              {
                kind: 'render-template',
                moduleId: 'platform-configs',
                sourceRelativePath: '.claude/plugin.json.template',
                destinationPath,
                strategy: 'render-template',
                ownership: 'managed',
                scaffoldOnly: false,
                renderedContent: '{"generated":true}\n',
                previousContent: '{"existing":true}\n'
              }
            ]
          })
        );

        const result = uninstallInstalledStates({
          homeDir: tempDir,
          projectRoot: tempDir,
          targets: ['claude']
        });

        assert.strictEqual(result.summary.uninstalledCount, 1);
        assert.strictEqual(fs.readFileSync(destinationPath, 'utf8'), '{"existing":true}\n');
        assert.ok(!fs.existsSync(statePath));
      } finally {
        cleanup(tempDir);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall restores files removed during install when previous content is recorded', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'legacy-note.txt');
        fs.mkdirSync(targetRoot, { recursive: true });

        writeState(statePath, {
          adapter: { id: 'claude-project', target: 'claude-project', kind: 'project' },
          targetRoot,
          installStatePath: statePath,
          request: {
            profile: null,
            modules: [],
            legacyLanguages: ['typescript'],
            legacyMode: true
          },
          resolution: {
            selectedModules: ['legacy-claude-project-install'],
            skippedModules: []
          },
          operations: [
            {
              kind: 'remove',
              moduleId: 'platform-configs',
              sourceRelativePath: '.claude/legacy-note.txt',
              destinationPath,
              strategy: 'remove',
              ownership: 'managed',
              scaffoldOnly: false,
              previousContent: 'restore me\n'
            }
          ],
          source: {
            repoVersion: CURRENT_PACKAGE_VERSION,
            repoCommit: 'abc123',
            manifestVersion: CURRENT_MANIFEST_VERSION
          }
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.strictEqual(fs.readFileSync(destinationPath, 'utf8'), 'restore me\n');
        assert.ok(!fs.existsSync(statePath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall dry-run reports deduped managed removals without deleting files', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const destinationPath = path.join(targetRoot, 'rules', 'coding-style.md');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'managed\n');
        const { installStatePath } = writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' }), managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project'],
          dryRun: true
        });

        assert.strictEqual(result.dryRun, true);
        assert.strictEqual(result.results[0].status, 'planned');
        assert.deepStrictEqual(result.results[0].plannedRemovals, [destinationPath, installStatePath]);
        assert.ok(fs.existsSync(destinationPath));
        assert.ok(fs.existsSync(installStatePath));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall reports invalid install states as errors', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const statePath = path.join(projectRoot, '.claude', 'ecc', 'install-state.json');
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, '{not-json', 'utf8');

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Failed to read install-state'));
        assert.strictEqual(result.summary.errorCount, 1);
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall removes only the adapter-derived install-state path', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const adapterStatePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const recordedStatePath = path.join(outsideRoot, 'recorded-state.json');
        const stateOptions = createCursorStateOptions(projectRoot, {
          installStatePath: recordedStatePath
        });
        writeState(adapterStatePath, stateOptions);
        fs.writeFileSync(recordedStatePath, 'outside sentinel\n');

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.ok(!fs.existsSync(adapterStatePath));
        assert.strictEqual(fs.readFileSync(recordedStatePath, 'utf8'), 'outside sentinel\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall removes copied files and cleans empty parent directories', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const destinationPath = path.join(targetRoot, 'rules', 'nested', 'managed.md');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'managed\n');
        writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.ok(result.results[0].removedPaths.includes(destinationPath));
        assert.ok(!fs.existsSync(destinationPath));
        assert.ok(!fs.existsSync(path.dirname(destinationPath)));
        assert.ok(fs.existsSync(targetRoot));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall cleanup stops at the adapter-derived target root', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const cleanupBoundaryRoot = createTempDir('install-lifecycle-boundary-');
      const projectRoot = path.join(cleanupBoundaryRoot, 'project');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const adapterStatePath = path.join(targetRoot, 'ecc', 'install-state.json');
        const destinationPath = path.join(targetRoot, 'rules', 'nested', 'managed.md');
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'managed\n');
        const stateOptions = createCursorStateOptions(projectRoot, {
          targetRoot: cleanupBoundaryRoot,
          installStatePath: adapterStatePath,
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });
        writeState(adapterStatePath, stateOptions);

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.ok(fs.existsSync(projectRoot));
        assert.ok(fs.existsSync(targetRoot));
        assert.ok(!fs.existsSync(destinationPath));
      } finally {
        cleanup(homeDir);
        cleanup(cleanupBoundaryRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall handles merge-json subset removal and full-file deletion', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const partialProjectRoot = createTempDir('install-lifecycle-partial-');
      const fullProjectRoot = createTempDir('install-lifecycle-full-');

      try {
        let targetRoot = path.join(partialProjectRoot, '.claude');
        let destinationPath = path.join(targetRoot, 'settings.json');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(
          destinationPath,
          JSON.stringify(
            {
              keep: true,
              managed: true,
              nested: {
                keep: true,
                remove: true
              },
              list: ['a', 'b']
            },
            null,
            2
          )
        );
        writeCursorState(partialProjectRoot, {
          operations: [
            managedOperation('merge-json', destinationPath, {
              mergePayload: {
                managed: true,
                nested: { remove: true },
                list: ['a', 'b']
              }
            })
          ]
        });

        let result = uninstallInstalledStates({
          homeDir,
          projectRoot: partialProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(destinationPath, 'utf8')), {
          keep: true,
          nested: {
            keep: true
          }
        });

        targetRoot = path.join(fullProjectRoot, '.claude');
        destinationPath = path.join(targetRoot, 'settings.json');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(destinationPath, JSON.stringify({ managed: true }, null, 2));
        writeCursorState(fullProjectRoot, {
          operations: [
            managedOperation('merge-json', destinationPath, {
              mergePayload: { managed: true }
            })
          ]
        });

        result = uninstallInstalledStates({
          homeDir,
          projectRoot: fullProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.ok(!fs.existsSync(destinationPath));
      } finally {
        cleanup(homeDir);
        cleanup(partialProjectRoot);
        cleanup(fullProjectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall handles merge-json edge shapes and absent destinations', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projects = [
        createTempDir('install-lifecycle-current-primitive-'),
        createTempDir('install-lifecycle-missing-key-'),
        createTempDir('install-lifecycle-nested-delete-'),
        createTempDir('install-lifecycle-array-root-'),
        createTempDir('install-lifecycle-primitive-root-'),
        createTempDir('install-lifecycle-absent-dest-'),
        createTempDir('install-lifecycle-previous-json-')
      ];

      try {
        const cases = [
          {
            projectRoot: projects[0],
            initial: '"plain"',
            payload: { managed: true },
            expected: 'plain'
          },
          {
            projectRoot: projects[1],
            initial: { keep: true },
            payload: { missing: true },
            expected: { keep: true }
          },
          {
            projectRoot: projects[2],
            initial: { keep: true, nested: { remove: true } },
            payload: { nested: { remove: true } },
            expected: { keep: true }
          },
          {
            projectRoot: projects[3],
            initial: ['a', 'b'],
            payload: ['a', 'b'],
            removed: true
          },
          {
            projectRoot: projects[4],
            initial: true,
            payload: true,
            removed: true
          },
          {
            projectRoot: projects[5],
            payload: { managed: true },
            absent: true
          },
          {
            projectRoot: projects[6],
            initial: { generated: true },
            payload: { generated: true },
            previousJson: { restored: true },
            expected: { restored: true }
          }
        ];

        for (const testCase of cases) {
          const targetRoot = path.join(testCase.projectRoot, '.claude');
          const destinationPath = path.join(targetRoot, 'settings.json');
          fs.mkdirSync(targetRoot, { recursive: true });
          if (!testCase.absent) {
            fs.writeFileSync(destinationPath, typeof testCase.initial === 'string' ? `${testCase.initial}\n` : JSON.stringify(testCase.initial, null, 2));
          }
          writeCursorState(testCase.projectRoot, {
            operations: [
              managedOperation('merge-json', destinationPath, {
                mergePayload: testCase.payload,
                previousJson: testCase.previousJson
              })
            ]
          });

          const result = uninstallInstalledStates({
            homeDir,
            projectRoot: testCase.projectRoot,
            targets: ['claude-project']
          });

          assert.strictEqual(result.results[0].status, 'uninstalled');
          if (testCase.removed || testCase.absent) {
            assert.ok(!fs.existsSync(destinationPath));
          } else {
            assert.deepStrictEqual(JSON.parse(fs.readFileSync(destinationPath, 'utf8')), testCase.expected);
          }
        }
      } finally {
        cleanup(homeDir);
        for (const projectRoot of projects) {
          cleanup(projectRoot);
        }
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall removes generated render-template files and no-backup remove operations are no-ops', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const templatePath = path.join(targetRoot, 'generated', 'plugin.json');
        const removedPath = path.join(targetRoot, 'already-removed.txt');
        fs.mkdirSync(path.dirname(templatePath), { recursive: true });
        fs.writeFileSync(templatePath, '{"generated":true}\n');

        writeCursorState(projectRoot, {
          operations: [
            managedOperation('render-template', templatePath, {
              renderedContent: '{"generated":true}\n'
            }),
            managedOperation('remove', removedPath)
          ]
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.ok(result.results[0].removedPaths.includes(templatePath));
        assert.ok(!fs.existsSync(templatePath));
        assert.ok(!fs.existsSync(path.dirname(templatePath)));
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall preserves an in-root final symlink without deleting its victim', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const victimPath = path.join(targetRoot, 'victim.md');
        const destinationPath = path.join(targetRoot, 'managed.md');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(victimPath, 'victim sentinel\n');
        try {
          fs.symlinkSync(victimPath, destinationPath);
        } catch {
          console.log('    (symlink unsupported on this platform; skipping)');
          return;
        }
        writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        // Managed symlinks are retained: their provenance cannot be revalidated,
        // and removing one could destroy whatever it points at.
        assert.strictEqual(result.results[0].status, 'partial');
        assert.ok(result.results[0].retainedPaths.includes(destinationPath));
        assert.ok(fs.lstatSync(destinationPath).isSymbolicLink());
        assert.strictEqual(fs.readFileSync(victimPath, 'utf8'), 'victim sentinel\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall rejects a symlink inserted after initial destination validation', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');
      const outsideRoot = createTempDir('install-lifecycle-outside-');
      const targetRoot = path.join(projectRoot, '.claude');
      const destinationParent = path.join(targetRoot, 'late-parent');
      const backupParent = path.join(targetRoot, 'late-parent-backup');
      const destinationPath = path.join(destinationParent, 'managed.md');
      const outsideDestinationPath = path.join(outsideRoot, 'managed.md');
      const originalExistsSync = fs.existsSync;
      let canonicalDestinationParent;
      let canonicalDestinationPath;
      let insertedSymlink = false;
      let result;

      try {
        fs.mkdirSync(destinationParent, { recursive: true });
        fs.writeFileSync(destinationPath, 'managed\n');
        fs.writeFileSync(outsideDestinationPath, 'outside sentinel\n');
        writeCursorState(projectRoot, {
          operations: [managedOperation('copy-file', destinationPath, { strategy: 'copy-file' })]
        });
        canonicalDestinationPath = fs.realpathSync(destinationPath);
        canonicalDestinationParent = path.dirname(canonicalDestinationPath);

        fs.existsSync = function existsSyncWithLateSymlink(candidatePath) {
          if (!insertedSymlink && path.resolve(candidatePath) === canonicalDestinationPath) {
            fs.renameSync(canonicalDestinationParent, backupParent);
            fs.symlinkSync(outsideRoot, canonicalDestinationParent, process.platform === 'win32' ? 'junction' : 'dir');
            insertedSymlink = true;
          }
          return originalExistsSync.call(fs, candidatePath);
        };

        result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });
      } finally {
        fs.existsSync = originalExistsSync;
      }

      try {
        assert.strictEqual(insertedSymlink, true);
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('outside the install root'));
        assert.strictEqual(fs.readFileSync(outsideDestinationPath, 'utf8'), 'outside sentinel\n');
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
        cleanup(outsideRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall restores previous JSON snapshots for template and remove operations', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const projectRoot = createTempDir('install-lifecycle-project-');

      try {
        const targetRoot = path.join(projectRoot, '.claude');
        const templatePath = path.join(targetRoot, 'plugin.json');
        const removedPath = path.join(targetRoot, 'legacy.json');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(templatePath, '{"generated":true}\n');

        writeCursorState(projectRoot, {
          operations: [
            managedOperation('render-template', templatePath, {
              previousJson: { existing: true },
              renderedContent: '{"generated":true}\n'
            }),
            managedOperation('remove', removedPath, {
              previousJson: { restored: true }
            })
          ]
        });

        const result = uninstallInstalledStates({
          homeDir,
          projectRoot,
          targets: ['claude-project']
        });

        assert.strictEqual(result.results[0].status, 'uninstalled');
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(templatePath, 'utf8')), {
          existing: true
        });
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(removedPath, 'utf8')), {
          restored: true
        });
      } finally {
        cleanup(homeDir);
        cleanup(projectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (
    test('uninstall reports unsupported operations and missing merge payloads as errors', () => {
      const homeDir = createTempDir('install-lifecycle-home-');
      const unsupportedProjectRoot = createTempDir('install-lifecycle-unsupported-');
      const missingPayloadProjectRoot = createTempDir('install-lifecycle-missing-payload-');

      try {
        let targetRoot = path.join(unsupportedProjectRoot, '.claude');
        let destinationPath = path.join(targetRoot, 'custom.txt');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(destinationPath, 'custom\n');
        writeCursorState(unsupportedProjectRoot, {
          operations: [managedOperation('custom-kind', destinationPath)]
        });

        let result = uninstallInstalledStates({
          homeDir,
          projectRoot: unsupportedProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Unsupported uninstall operation kind'));

        targetRoot = path.join(missingPayloadProjectRoot, '.claude');
        destinationPath = path.join(targetRoot, 'settings.json');
        fs.mkdirSync(targetRoot, { recursive: true });
        fs.writeFileSync(destinationPath, '{"managed":true}\n');
        writeCursorState(missingPayloadProjectRoot, {
          operations: [managedOperation('merge-json', destinationPath)]
        });

        result = uninstallInstalledStates({
          homeDir,
          projectRoot: missingPayloadProjectRoot,
          targets: ['claude-project']
        });
        assert.strictEqual(result.results[0].status, 'error');
        assert.ok(result.results[0].error.includes('Missing merge payload for uninstall'));
      } finally {
        cleanup(homeDir);
        cleanup(unsupportedProjectRoot);
        cleanup(missingPayloadProjectRoot);
      }
    })
  )
    passed++;
  else failed++;

  if (test('doctor inspects update-claude-settings hooks by event and id', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = currentManagedHooks(targetRoot);
      const stopEntry = managedHooks.Stop[0];
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: {
          Stop: [
            { id: 'user:stop', matcher: 'Bash', hooks: [{ type: 'command', command: 'user' }] },
            ...managedHooks.Stop,
          ],
          ...Object.fromEntries(Object.entries(managedHooks).filter(([event]) => event !== 'Stop')),
        },
      }));
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      let report = buildDoctorReport({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      assert.strictEqual(report.results[0].status, 'ok');

      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: {
          ...managedHooks,
          Stop: [
            { id: 'user:stop', matcher: 'Bash', hooks: [{ type: 'command', command: 'user' }] },
            { ...stopEntry, description: 'drifted' },
            ...managedHooks.Stop.slice(1),
          ],
        },
      }));
      report = buildDoctorReport({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      assert.strictEqual(report.results[0].status, 'warning');
      assert.ok(report.results[0].issues.some(issue => issue.code === 'drifted-managed-files'));

      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: {
          ...managedHooks,
          Stop: managedHooks.Stop.filter(entry => entry.id !== stopEntry.id),
        },
      }));
      report = buildDoctorReport({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      assert.strictEqual(report.results[0].status, 'error');
      assert.ok(report.results[0].issues.some(issue => issue.code === 'missing-managed-files'));
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('doctor and repair surface malformed Claude settings errors', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = currentManagedHooks(targetRoot);
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, '{ invalid json\n');
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const report = buildDoctorReport({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      const issue = report.results[0].issues.find(candidate => (
        candidate.code === 'invalid-claude-settings'
      ));
      assert.strictEqual(report.results[0].status, 'error');
      assert.ok(issue, 'doctor should report an invalid Claude settings issue');
      assert.match(issue.message, /Failed to inspect Claude settings/);

      const repair = repairInstalledStates({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      assert.strictEqual(repair.results[0].status, 'error');
      assert.match(repair.results[0].error, /Failed to inspect Claude settings/);
      assert.strictEqual(fs.readFileSync(settingsPath, 'utf8'), '{ invalid json\n');
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('repair restores managed Claude hooks while preserving user settings and hooks', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const userHook = {
        id: 'user:stop',
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'user-command' }],
      };
      const managedHooks = currentManagedHooks(targetRoot);
      const stopEntry = managedHooks.Stop[0];
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: {
          ...managedHooks,
          Stop: [
            userHook,
            { ...stopEntry, description: 'drifted' },
            ...managedHooks.Stop.slice(1),
          ],
        },
      }));
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const result = repairInstalledStates({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(result.results[0].status, 'repaired');
      assert.ok(result.results[0].repairedPaths.includes(settingsPath));
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {
        theme: 'dark',
        hooks: {
          ...managedHooks,
          Stop: [userHook, ...managedHooks.Stop],
        },
      });
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('repair creates missing Claude settings with private permissions', () => {
    if (process.platform === 'win32') {
      console.log('    (POSIX file modes unsupported on this platform; skipping)');
      return;
    }
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = currentManagedHooks(targetRoot);
      fs.mkdirSync(targetRoot, { recursive: true });
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const result = repairInstalledStates({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(result.results[0].status, 'repaired');
      const descriptor = fs.openSync(settingsPath, 'r');
      try {
        assert.strictEqual(fs.fstatSync(descriptor).mode & 0o777, 0o600);
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(descriptor, 'utf8')).hooks, managedHooks);
      } finally {
        fs.closeSync(descriptor);
      }
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('repair removes retired managed hooks using the recorded ownership snapshot', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const currentHooks = currentManagedHooks(targetRoot);
      const retiredHook = managedHookEntry('ecc:retired', 'node retired.js');
      const recordedHooks = {
        ...currentHooks,
        Stop: [...currentHooks.Stop, retiredHook],
      };
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: recordedHooks,
      }));
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            managedHooks: recordedHooks,
          }),
        ],
      });

      const result = repairInstalledStates({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(result.results[0].status, 'repaired');
      const repaired = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(!repaired.hooks.Stop.some(entry => entry.id === 'ecc:retired'));
      assert.deepStrictEqual(repaired.hooks, currentHooks);
      const state = readInstallState(path.join(targetRoot, 'ecc', 'install-state.json'));
      const settingsOperation = state.operations.find(operation => (
        operation.kind === 'update-claude-settings'
      ));
      assert.deepStrictEqual(settingsOperation.managedHooks, currentHooks);
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('uninstall removes only unchanged managed Claude hooks and reports drift as partial', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = {
        SessionStart: [managedHookEntry('ecc:start', 'node managed-start.js')],
        Stop: [managedHookEntry('ecc:stop', 'node managed-stop.js')],
      };
      const userHook = {
        id: 'user:stop',
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'user-command' }],
      };
      const driftedHook = managedHookEntry('ecc:stop', 'node user-edited-stop.js');
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: {
          SessionStart: managedHooks.SessionStart,
          Stop: [userHook, driftedHook],
        },
      }));
      const { installStatePath } = writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const result = uninstallInstalledStates({
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(result.results[0].status, 'partial');
      assert.deepStrictEqual(result.results[0].retainedPaths, [settingsPath]);
      assert.ok(fs.existsSync(installStatePath));
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {
        theme: 'dark',
        hooks: {
          Stop: [userHook, driftedHook],
        },
      });
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('uninstall clears empty hook containers but preserves unrelated Claude settings', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = {
        Stop: [managedHookEntry('ecc:stop', 'node managed-stop.js')],
      };
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(settingsPath, formatJson({
        theme: 'dark',
        hooks: managedHooks,
      }));
      const { installStatePath } = writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const result = uninstallInstalledStates({
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(result.results[0].status, 'uninstalled');
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {
        theme: 'dark',
      });
      assert.ok(!fs.existsSync(installStatePath));
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('Claude settings lifecycle refuses a final-symlink destination', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const victimPath = path.join(targetRoot, 'victim.json');
      const settingsPath = path.join(targetRoot, 'settings.json');
      const managedHooks = {
        Stop: [managedHookEntry('ecc:stop', 'node managed-stop.js')],
      };
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(victimPath, formatJson({ sentinel: true, hooks: managedHooks }));
      try {
        fs.symlinkSync(victimPath, settingsPath, 'file');
      } catch {
        console.log('    (file symlink unsupported on this platform; skipping)');
        return;
      }
      writeClaudeState(homeDir, {
        operations: [
          managedOperation('update-claude-settings', settingsPath, {
            sourceRelativePath: 'hooks/hooks.json',
            strategy: 'update-claude-settings',
            managedHooks,
          }),
        ],
      });

      const doctor = buildDoctorReport({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      const repair = repairInstalledStates({
        repoRoot: REPO_ROOT,
        homeDir,
        projectRoot,
        targets: ['claude'],
      });
      const uninstall = uninstallInstalledStates({
        homeDir,
        projectRoot,
        targets: ['claude'],
      });

      assert.strictEqual(doctor.results[0].status, 'error');
      assert.ok(doctor.results[0].issues.some(issue => (
        issue.code === 'unsafe-managed-destination'
      )));
      assert.strictEqual(repair.results[0].status, 'error');
      assert.match(repair.results[0].error, /final symlink/);
      assert.strictEqual(uninstall.results[0].status, 'error');
      assert.match(uninstall.results[0].error, /final symlink/);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(victimPath, 'utf8')), {
        sentinel: true,
        hooks: managedHooks,
      });
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  if (test('Claude settings path validation refuses a non-canonical destination', () => {
    const homeDir = createTempDir('install-lifecycle-claude-home-');
    const projectRoot = createTempDir('install-lifecycle-project-');

    try {
      const targetRoot = path.join(homeDir, '.claude');
      const destinationPath = path.join(targetRoot, 'settings.local.json');
      fs.mkdirSync(targetRoot, { recursive: true });
      assert.throws(
        () => assertClaudeSettingsPath(destinationPath, targetRoot),
        /outside the canonical settings file/
      );
      assert.ok(!fs.existsSync(destinationPath));
    } finally {
      cleanup(homeDir);
      cleanup(projectRoot);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
