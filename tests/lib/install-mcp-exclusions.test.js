'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { createInstallPlanFromRequest } = require('../../scripts/lib/install/runtime');
const { applyInstallPlan, previewInstallPlan } = require('../../scripts/lib/install/apply');
const { readInstallState } = require('../../scripts/lib/install-state');

const EXCLUDED_SERVER = { command: 'excluded-mcp', args: ['--stdio'] };
const INCLUDED_SERVER = { command: 'included-mcp', args: ['--stdio'] };

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// The retained targets (claude, claude-project, codex) copy MCP configs as files,
// so no adapter emits an MCP merge-json operation. These cases cover the generic
// apply-layer filter by appending a merge-json operation to a real claude-project
// plan. Lifecycle (repair/doctor/uninstall) coverage lived on the removed Cursor
// adapter and is intentionally not carried over.
function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-exclusions-'));
  const previousDisabled = process.env.ECC_DISABLED_MCPS;
  delete process.env.ECC_DISABLED_MCPS;
  t.after(() => {
    if (previousDisabled === undefined) delete process.env.ECC_DISABLED_MCPS;
    else process.env.ECC_DISABLED_MCPS = previousDisabled;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const sourceRoot = path.join(root, 'source');
  const homeDir = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  const targetRoot = path.join(projectRoot, '.claude');
  const configPath = path.join(targetRoot, 'mcp.json');
  const statePath = path.join(targetRoot, 'ecc', 'install-state.json');
  const json = (relativePath, value) => writeJson(path.join(sourceRoot, relativePath), value);
  json('package.json', { version: '1.0.0' });
  json('manifests/install-modules.json', {
    version: 1,
    modules: [{
      id: 'platform-configs', kind: 'platform', description: 'MCP apply fixture',
      paths: ['scripts/after-mcp.js'], targets: ['claude-project'], dependencies: [],
      defaultInstall: false, cost: 'light', stability: 'stable',
    }],
  });
  json('manifests/install-profiles.json', {
    version: 1,
    profiles: { minimal: { description: 'MCP fixture', modules: ['platform-configs'] } },
  });
  const mcpConfig = { mcpServers: { excluded: EXCLUDED_SERVER, included: INCLUDED_SERVER } };
  json('.mcp.json', mcpConfig);
  fs.mkdirSync(path.join(sourceRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'scripts/after-mcp.js'), 'module.exports = "after MCP";\n');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  const mcpOperation = {
    kind: 'merge-json',
    moduleId: 'platform-configs',
    sourceRelativePath: '.mcp.json',
    sourcePath: path.join(sourceRoot, '.mcp.json'),
    destinationPath: configPath,
    strategy: 'merge-json',
    ownership: 'managed',
    scaffoldOnly: false,
    mergePayload: structuredClone(mcpConfig),
  };
  const plan = () => {
    const base = createInstallPlanFromRequest({
      mode: 'manifest', target: 'claude-project', profileId: null, moduleIds: ['platform-configs'],
      includeComponentIds: [], excludeComponentIds: [], hookConsent: 'declined',
    }, { sourceRoot, homeDir, projectRoot, env: {} });
    return {
      ...base,
      operations: [...base.operations, structuredClone(mcpOperation)],
      statePreview: {
        ...base.statePreview,
        operations: [...base.statePreview.operations, structuredClone(mcpOperation)],
      },
    };
  };
  return {
    configPath,
    statePath,
    plan,
    readConfig: () => JSON.parse(fs.readFileSync(configPath, 'utf8')),
    writeConfig: value => writeJson(configPath, value),
  };
}

test('preview and apply share MCP filtering without changing the plan or other JSON merges', t => {
  const fixture = createFixture(t);
  const originalPlan = fixture.plan();
  const mcpOperation = originalPlan.operations.find(operation => operation.kind === 'merge-json');
  const ordinaryPath = path.join(path.dirname(fixture.configPath), 'preferences.json');
  const ordinaryMerge = { ...mcpOperation, destinationPath: ordinaryPath };
  const plan = {
    ...originalPlan,
    operations: [...originalPlan.operations, ordinaryMerge],
    statePreview: {
      ...originalPlan.statePreview,
      operations: [...originalPlan.statePreview.operations, ordinaryMerge],
    },
  };
  const before = structuredClone(plan);
  const expectedMcp = { mcpServers: { included: INCLUDED_SERVER } };
  const expectedOrdinary = { mcpServers: { excluded: EXCLUDED_SERVER, included: INCLUDED_SERVER } };
  const payloadFor = (operations, destinationPath) => operations.find(operation => (
    operation.destinationPath === destinationPath
  )).mergePayload;
  process.env.ECC_DISABLED_MCPS = 'excluded';
  try {
    const preview = previewInstallPlan(plan);
    assert.ok(!fs.existsSync(fixture.statePath));
    assert.ok(!fs.existsSync(fixture.configPath));
    for (const operations of [preview.operations, preview.statePreview.operations]) {
      assert.deepEqual(payloadFor(operations, fixture.configPath), expectedMcp);
      assert.deepEqual(payloadFor(operations, ordinaryPath), expectedOrdinary);
    }
    assert.deepEqual(plan, before, 'Preview must not mutate the original plan');
    applyInstallPlan(plan);
  } finally {
    delete process.env.ECC_DISABLED_MCPS;
  }
  assert.deepEqual(plan, before, 'Apply must not mutate the original plan');
  assert.deepEqual(fixture.readConfig(), expectedMcp);
  assert.deepEqual(JSON.parse(fs.readFileSync(ordinaryPath, 'utf8')), expectedOrdinary);
  const operations = readInstallState(fixture.statePath).operations;
  assert.deepEqual(payloadFor(operations, fixture.configPath), expectedMcp);
  assert.deepEqual(payloadFor(operations, ordinaryPath), expectedOrdinary);
});

for (const [name, payload, expected] of [
  ['missing mcpServers', { theme: 'dark' }, { userSetting: true, theme: 'dark' }],
  ['null mcpServers', { mcpServers: null }, { userSetting: true, mcpServers: null }],
  ['array mcpServers', { mcpServers: [] }, { userSetting: true, mcpServers: [] }],
  ['scalar mcpServers', { mcpServers: 'custom' }, { userSetting: true, mcpServers: 'custom' }],
  ['empty mcpServers', { mcpServers: {} }, { userSetting: true, mcpServers: {} }],
  ['null payload', null, null],
  ['array payload', ['custom'], ['custom']],
  ['string payload', 'custom', 'custom'],
  ['number payload', 42, 42],
  ['boolean payload', false, false],
]) {
  test(`MCP exclusions preserve ordinary JSON merge behavior (${name})`, t => {
    const fixture = createFixture(t);
    fixture.writeConfig({ userSetting: true });
    const originalPlan = fixture.plan();
    const replacePayload = operations => operations.map(operation => (
      operation.destinationPath === fixture.configPath
        ? { ...operation, mergePayload: payload }
        : operation
    ));
    const plan = {
      ...originalPlan,
      operations: replacePayload(originalPlan.operations),
      statePreview: {
        ...originalPlan.statePreview,
        operations: replacePayload(originalPlan.statePreview.operations),
      },
    };
    const before = structuredClone(plan);
    const payloadFor = operations => operations.find(operation => (
      operation.destinationPath === fixture.configPath
    )).mergePayload;
    process.env.ECC_DISABLED_MCPS = 'excluded';

    const preview = previewInstallPlan(plan);
    assert.deepEqual(payloadFor(preview.operations), payload);
    assert.deepEqual(payloadFor(preview.statePreview.operations), payload);
    assert.deepEqual(fixture.readConfig(), { userSetting: true });
    assert.ok(!fs.existsSync(fixture.statePath));
    assert.deepEqual(plan, before, 'Preview must not mutate the original plan');

    applyInstallPlan(plan);
    assert.deepEqual(fixture.readConfig(), expected);
    assert.deepEqual(payloadFor(readInstallState(fixture.statePath).operations), payload);
    assert.deepEqual(plan, before, 'Apply must not mutate the original plan');
  });
}
