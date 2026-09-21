const fs = require('fs');
const os = require('os');
const path = require('path');

const { LEGACY_INSTALL_TARGETS, parseInstallArgs } = require('./install/request');
const {
  buildCopyFileOperation,
  createManifestInstallPlan,
  createStatePreview,
  dedupeCopyFileOperations,
  getManifestVersion,
  getPackageVersion,
  getRepoCommit,
  getSourceRoot,
  listFilesRecursive,
} = require('./install/plan');
const { SUPPORTED_INSTALL_TARGETS, listLegacyCompatibilityLanguages, resolveLegacyCompatibilitySelection } = require('./install-manifests');
const { getInstallTargetAdapter } = require('./install-targets/registry');
const { resolveInvocationEnvironment } = require('./invocation-environment');

const LANGUAGE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CLAUDE_ECC_NAMESPACE = 'ecc';

function readDirectoryNames(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function listAvailableLanguages(sourceRoot = getSourceRoot()) {
  return [...new Set([...listLegacyCompatibilityLanguages(), ...readDirectoryNames(path.join(sourceRoot, 'rules')).filter(name => name !== 'common')])].sort();
}

function validateLegacyTarget(target) {
  if (LEGACY_INSTALL_TARGETS.includes(target)) {
    return;
  }
  // A target can be fully supported yet not installable via the bare-language
  // positional syntax (which is legacy-only). Guide the user to the right mode
  // instead of implying the target is unknown (#2282).
  if (SUPPORTED_INSTALL_TARGETS.includes(target)) {
    throw new Error(
      `Target '${target}' is supported, but the bare-language install syntax only accepts ${LEGACY_INSTALL_TARGETS.join(', ')}. ` +
        `Install '${target}' with a component selection instead, e.g. \`install.sh --target ${target} --profile full\` ` +
        `(or --modules <id,...> / --skills <id,...>).`
    );
  }
  throw new Error(`Unknown install target: ${target}. Expected one of ${SUPPORTED_INSTALL_TARGETS.join(', ')}`);
}

function applyInstallPlan(plan, dependencies = {}) {
  const { applyInstallPlan: applyPlan } = require('./install/apply');
  return applyPlan(plan, dependencies);
}

function previewInstallPlan(plan) {
  const { previewInstallPlan: previewPlan } = require('./install/apply');
  return previewPlan(plan);
}

function addRecursiveCopyOperations(operations, options) {
  const sourceDir = path.join(options.sourceRoot, options.sourceRelativeDir);
  if (!fs.existsSync(sourceDir)) {
    return 0;
  }

  const relativeFiles = listFilesRecursive(sourceDir);

  for (const relativeFile of relativeFiles) {
    const sourceRelativePath = path.join(options.sourceRelativeDir, relativeFile);
    const sourcePath = path.join(options.sourceRoot, sourceRelativePath);
    const destinationRelativePath = typeof options.destinationRelativePathTransform === 'function' ? options.destinationRelativePathTransform(relativeFile, sourceRelativePath) : relativeFile;
    if (!destinationRelativePath) {
      continue;
    }
    const destinationPath = path.join(options.destinationDir, destinationRelativePath);
    operations.push(
      buildCopyFileOperation({
        moduleId: options.moduleId,
        sourcePath,
        sourceRelativePath,
        destinationPath,
        strategy: options.strategy || 'preserve-relative-path',
        contentTransform: options.contentTransform,
      })
    );
  }

  return relativeFiles.length;
}

function isDirectoryNonEmpty(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory() && fs.readdirSync(dirPath).length > 0;
}

function planClaudeStyleLegacyInstall(context, { adapterId, adapterRootInput, rulesDir: rulesDirOverride }) {
  const adapter = getInstallTargetAdapter(adapterId);
  const targetRoot = adapter.resolveRoot(adapterRootInput);
  const rulesDir = rulesDirOverride || path.join(targetRoot, 'rules', CLAUDE_ECC_NAMESPACE);
  const installStatePath = adapter.getInstallStatePath(adapterRootInput);
  const operations = [];
  const warnings = [];

  if (isDirectoryNonEmpty(rulesDir)) {
    warnings.push(`Destination ${rulesDir}/ already exists and files may be overwritten`);
  }

  addRecursiveCopyOperations(operations, {
    moduleId: 'legacy-claude-rules',
    sourceRoot: context.sourceRoot,
    sourceRelativeDir: path.join('rules', 'common'),
    destinationDir: path.join(rulesDir, 'common')
  });

  for (const language of context.languages) {
    if (!LANGUAGE_NAME_PATTERN.test(language)) {
      warnings.push(`Invalid language name '${language}'. Only alphanumeric, dash, and underscore are allowed`);
      continue;
    }

    const sourceDir = path.join(context.sourceRoot, 'rules', language);
    if (!fs.existsSync(sourceDir)) {
      warnings.push(`rules/${language}/ does not exist, skipping`);
      continue;
    }

    addRecursiveCopyOperations(operations, {
      moduleId: 'legacy-claude-rules',
      sourceRoot: context.sourceRoot,
      sourceRelativeDir: path.join('rules', language),
      destinationDir: path.join(rulesDir, language)
    });
  }

  return {
    mode: 'legacy',
    sourceRoot: context.sourceRoot,
    adapter,
    target: adapterId,
    targetRoot,
    installRoot: rulesDir,
    installStatePath,
    operations,
    warnings,
    selectedModules: ['legacy-claude-rules']
  };
}

function planClaudeLegacyInstall(context) {
  return planClaudeStyleLegacyInstall(context, {
    adapterId: 'claude',
    adapterRootInput: { homeDir: context.homeDir },
    rulesDir: context.claudeRulesDir || null
  });
}

function planClaudeProjectLegacyInstall(context) {
  return planClaudeStyleLegacyInstall(context, {
    adapterId: 'claude-project',
    adapterRootInput: { repoRoot: context.projectRoot },
    rulesDir: null
  });
}

function createLegacyInstallPlan(options = {}) {
  const sourceRoot = options.sourceRoot || getSourceRoot();
  const projectRoot = options.projectRoot || process.cwd();
  const homeDir = options.homeDir || process.env.HOME || os.homedir();
  const target = options.target || 'claude';

  validateLegacyTarget(target);

  const context = {
    sourceRoot,
    projectRoot,
    homeDir,
    languages: Array.isArray(options.languages) ? options.languages : [],
    claudeRulesDir: options.claudeRulesDir || process.env.CLAUDE_RULES_DIR || null
  };

  const plan = target === 'claude'
    ? planClaudeLegacyInstall(context)
    : planClaudeProjectLegacyInstall(context);

  const source = {
    repoVersion: getPackageVersion(sourceRoot),
    repoCommit: getRepoCommit(sourceRoot),
    manifestVersion: getManifestVersion(sourceRoot)
  };

  const statePreview = createStatePreview({
    adapter: plan.adapter,
    targetRoot: plan.targetRoot,
    installStatePath: plan.installStatePath,
    request: {
      profile: null,
      modules: [],
      legacyLanguages: context.languages,
      legacyMode: true
    },
    resolution: {
      selectedModules: plan.selectedModules,
      skippedModules: []
    },
    operations: plan.operations,
    source
  });

  return {
    mode: 'legacy',
    sourceRoot,
    target: plan.target,
    adapter: {
      id: plan.adapter.id,
      target: plan.adapter.target,
      kind: plan.adapter.kind
    },
    targetRoot: plan.targetRoot,
    installRoot: plan.installRoot,
    installStatePath: plan.installStatePath,
    warnings: plan.warnings,
    languages: context.languages,
    operations: plan.operations,
    statePreview
  };
}

function createLegacyCompatInstallPlan(options = {}) {
  const sourceRoot = options.sourceRoot || getSourceRoot();
  const projectRoot = options.projectRoot || process.cwd();
  const target = options.target || 'claude';
  const includeComponentIds = Array.isArray(options.includeComponentIds) ? [...options.includeComponentIds] : [];
  const excludeComponentIds = Array.isArray(options.excludeComponentIds) ? [...options.excludeComponentIds] : [];

  validateLegacyTarget(target);

  const selection = resolveLegacyCompatibilitySelection({
    repoRoot: sourceRoot,
    target,
    legacyLanguages: options.legacyLanguages || []
  });

  return createManifestInstallPlan({
    sourceRoot,
    projectRoot,
    homeDir: options.homeDir,
    env: resolveInvocationEnvironment(options),
    target,
    profileId: null,
    moduleIds: selection.moduleIds,
    includeComponentIds,
    excludeComponentIds,
    legacyLanguages: selection.legacyLanguages,
    legacyMode: true,
    exemptValidationCodes: options.exemptValidationCodes || [],
    requestProfileId: null,
    requestModuleIds: [],
    requestIncludeComponentIds: includeComponentIds,
    requestExcludeComponentIds: excludeComponentIds,
    mode: 'legacy-compat'
  });
}

module.exports = {
  SUPPORTED_INSTALL_TARGETS,
  LEGACY_INSTALL_TARGETS,
  applyInstallPlan,
  previewInstallPlan,
  createLegacyCompatInstallPlan,
  createManifestInstallPlan,
  createLegacyInstallPlan,
  dedupeCopyFileOperations,
  getSourceRoot,
  listAvailableLanguages,
  parseInstallArgs
};
