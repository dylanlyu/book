const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CLAUDE_HOOKS_CONFIG_PATH,
  getClaudeSettingsPath,
} = require('../install/claude-settings');
const { METADATA_FILENAME } = require('../hooks-config');

const PLATFORM_SOURCE_PATH_OWNERS = Object.freeze({
  '.claude-plugin': 'claude',
  '.codex': 'codex'
});

// Source paths that home installs must never copy into a harness home
// directory. `.agents` is ECC's repo-local skills/plugins staging area:
// project targets such as kimi and antigravity consume it, but neither
// Claude Code nor Codex reads a `.agents` directory under ~/.claude or
// ~/.codex, so copying it there produces unread files that doctor flags as
// drift and repair keeps restoring.
const HOME_INSTALL_EXCLUDED_SOURCE_PATHS = Object.freeze(['.agents']);

function normalizeRelativePath(relativePath) {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
}

function isForeignPlatformPath(sourceRelativePath, adapterTarget) {
  const normalizedPath = normalizeRelativePath(sourceRelativePath);

  for (const [prefix, ownerTarget] of Object.entries(PLATFORM_SOURCE_PATH_OWNERS)) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return ownerTarget !== adapterTarget;
    }
  }

  return false;
}

function isExcludedSourcePath(sourceRelativePath, excludedSourcePaths = []) {
  const normalizedPath = normalizeRelativePath(sourceRelativePath);
  return excludedSourcePaths.some(excluded => {
    const prefix = normalizeRelativePath(excluded);
    return prefix !== '' && (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  });
}

function resolveBaseRoot(scope, input = {}) {
  if (scope === 'home') {
    return input.homeDir || os.homedir();
  }

  if (scope === 'project') {
    const projectRoot = input.projectRoot || input.repoRoot;
    if (!projectRoot) {
      throw new Error('projectRoot or repoRoot is required for project install targets');
    }
    return projectRoot;
  }

  throw new Error(`Unsupported install target scope: ${scope}`);
}

function buildValidationIssue(severity, code, message, extra = {}) {
  return {
    severity,
    code,
    message,
    ...extra
  };
}

function createManagedOperation({ kind = 'copy-path', moduleId, sourceRelativePath, destinationPath, strategy = 'preserve-relative-path', ownership = 'managed', scaffoldOnly = true, ...rest }) {
  return {
    kind,
    moduleId,
    sourceRelativePath: normalizeRelativePath(sourceRelativePath),
    destinationPath,
    strategy,
    ownership,
    scaffoldOnly,
    ...rest
  };
}

function defaultValidateAdapterInput(config, input = {}) {
  if (config.kind === 'project' && !input.projectRoot && !input.repoRoot) {
    return [buildValidationIssue('error', 'missing-project-root', 'projectRoot or repoRoot is required for project install targets')];
  }

  if (config.kind === 'home' && !input.homeDir && !os.homedir()) {
    return [buildValidationIssue('error', 'missing-home-dir', 'homeDir is required for home install targets')];
  }

  return [];
}

function createRemappedOperation(adapter, moduleId, sourceRelativePath, destinationPath, options = {}) {
  return createManagedOperation({
    kind: options.kind || 'copy-path',
    moduleId,
    sourceRelativePath,
    destinationPath,
    strategy: options.strategy || 'preserve-relative-path',
    ownership: options.ownership || 'managed',
    scaffoldOnly: Object.hasOwn(options, 'scaffoldOnly') ? options.scaffoldOnly : true,
    ...options.extra
  });
}

function planClaudeHooksOperations(adapter, module, input) {
  const operations = [
    createRemappedOperation(
      adapter,
      module.id,
      CLAUDE_HOOKS_CONFIG_PATH,
      getClaudeSettingsPath(adapter.resolveRoot(input)),
      {
        kind: 'update-claude-settings',
        strategy: 'merge-hook-ids',
      }
    ),
  ];

  if (!input.repoRoot) {
    return operations;
  }

  const sourceHooksRoot = path.join(input.repoRoot, 'hooks');
  if (!fs.existsSync(sourceHooksRoot)) {
    return operations;
  }

  return [
    ...operations,
    ...fs.readdirSync(sourceHooksRoot, { withFileTypes: true })
      // hooks.json is merged into settings.json above, and its metadata sidecar
      // is consumed with it, so neither is scaffolded into the target hooks dir.
      .filter(entry => entry.name !== 'hooks.json' && entry.name !== METADATA_FILENAME)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(entry => adapter.createScaffoldOperation(
        module.id,
        path.join('hooks', entry.name),
        input
      )),
  ];
}

function createInstallTargetAdapter(config) {
  const adapter = {
    id: config.id,
    target: config.target,
    kind: config.kind,
    nativeRootRelativePath: config.nativeRootRelativePath || null,
    supports(target) {
      return target === config.target || target === config.id;
    },
    resolveRoot(input = {}) {
      const baseRoot = resolveBaseRoot(config.kind, input);
      if (typeof config.resolveRoot === 'function') {
        return config.resolveRoot(input, baseRoot);
      }
      return path.join(baseRoot, ...config.rootSegments);
    },
    getInstallStatePath(input = {}) {
      const root = adapter.resolveRoot(input);
      return path.join(root, ...config.installStatePathSegments);
    },
    resolveDestinationPath(sourceRelativePath, input = {}) {
      const normalizedSourcePath = normalizeRelativePath(sourceRelativePath);
      const targetRoot = adapter.resolveRoot(input);

      if (config.nativeRootRelativePath && normalizedSourcePath === normalizeRelativePath(config.nativeRootRelativePath)) {
        return targetRoot;
      }

      return path.join(targetRoot, normalizedSourcePath);
    },
    determineStrategy(sourceRelativePath) {
      const normalizedSourcePath = normalizeRelativePath(sourceRelativePath);

      if (config.nativeRootRelativePath && normalizedSourcePath === normalizeRelativePath(config.nativeRootRelativePath)) {
        return 'sync-root-children';
      }

      return 'preserve-relative-path';
    },
    createScaffoldOperation(moduleId, sourceRelativePath, input = {}) {
      const normalizedSourcePath = normalizeRelativePath(sourceRelativePath);
      return createManagedOperation({
        moduleId,
        sourceRelativePath: normalizedSourcePath,
        destinationPath: adapter.resolveDestinationPath(normalizedSourcePath, input),
        strategy: adapter.determineStrategy(normalizedSourcePath)
      });
    },
    excludesSourcePath(sourceRelativePath) {
      return isExcludedSourcePath(sourceRelativePath, config.excludedSourcePaths);
    },
    planOperations(input = {}) {
      if (typeof config.planOperations === 'function') {
        return config.planOperations(input, adapter);
      }

      if (Array.isArray(input.modules)) {
        return input.modules.flatMap(module => {
          const paths = Array.isArray(module.paths) ? module.paths : [];
          return paths
            .filter(p => !isForeignPlatformPath(p, config.target) && !adapter.excludesSourcePath(p))
            .map(sourceRelativePath => adapter.createScaffoldOperation(
              module.id,
              sourceRelativePath,
              input
            ));
        });
      }

      const module = input.module || {};
      const paths = Array.isArray(module.paths) ? module.paths : [];
      return paths
        .filter(p => !isForeignPlatformPath(p, config.target) && !adapter.excludesSourcePath(p))
        .map(sourceRelativePath => adapter.createScaffoldOperation(
          module.id,
          sourceRelativePath,
          input
        ));
    },
    supportsModule(module, input = {}) {
      if (typeof config.supportsModule === 'function') {
        return config.supportsModule(module, input, adapter);
      }

      return true;
    },
    validate(input = {}) {
      if (typeof config.validate === 'function') {
        return config.validate(input, adapter);
      }

      return defaultValidateAdapterInput(config, input);
    }
  };

  return Object.freeze(adapter);
}

module.exports = {
  HOME_INSTALL_EXCLUDED_SOURCE_PATHS,
  isExcludedSourcePath,
  buildValidationIssue,
  createInstallTargetAdapter,
  createManagedOperation,
  createRemappedOperation,
  isForeignPlatformPath,
  normalizeRelativePath,
  planClaudeHooksOperations,
};
