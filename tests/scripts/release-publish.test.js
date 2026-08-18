'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolveWorkflowPath } = require('../helpers/workflow-file');

const repoRoot = path.resolve(__dirname, '..', '..');

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

function load(relativePath) {
  return fs.readFileSync(resolveWorkflowPath(path.join(repoRoot, relativePath)), 'utf8').replace(/\r\n/g, '\n');
}

console.log('\n=== Testing release publish workflow ===\n');

for (const workflow of ['.github/workflows/release.yml', '.github/workflows/reusable-release.yml']) {
  const content = load(workflow);
  const jobsIndex = content.search(/^jobs:\s*$/m);
  const workflowHeader = jobsIndex >= 0 ? content.slice(0, jobsIndex) : content;

  test(`${workflow} does not publish to the npm registry`, () => {
    assert.doesNotMatch(content, /npm publish/);
    assert.doesNotMatch(content, /registry-url:/);
    assert.doesNotMatch(content, /registry\.npmjs\.org/);
  });

  test(`${workflow} requests no npm credentials`, () => {
    assert.doesNotMatch(content, /NPM_TOKEN/);
    assert.doesNotMatch(content, /NODE_AUTH_TOKEN/);
  });

  test(`${workflow} grants no OIDC token now that provenance signing is gone`, () => {
    assert.doesNotMatch(workflowHeader, /id-token:\s*write/);
    assert.doesNotMatch(content, /id-token:\s*write/);
  });

  test(`${workflow} ignores dependency lifecycle scripts while packing`, () => {
    assert.match(content, /npm ci --ignore-scripts/);
  });

  test(`${workflow} still packs the distributable tarball`, () => {
    assert.match(content, /name: Pack npm artifact/);
    assert.match(content, /npm pack --json/);
    assert.match(content, /package_file: \$\{\{ steps\.pack\.outputs\.package_file \}\}/);
  });

  test(`${workflow} attaches the tarball to the GitHub Release`, () => {
    assert.match(content, /files: \$\{\{ needs\.verify\.outputs\.package_file \}\}/);
    assert.match(content, /fail_on_unmatched_files:\s*true/);
  });

  test(`${workflow} keeps the GitHub Release as the only publish step`, () => {
    assert.match(content, /name: Create GitHub Release/);
    assert.doesNotMatch(content, /name: Publish npm package/);
  });
}

if (failed > 0) {
  console.log(`\nFailed: ${failed}`);
  process.exit(1);
}

console.log(`\nPassed: ${passed}`);
