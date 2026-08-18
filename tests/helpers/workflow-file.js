'use strict';

const fs = require('fs');

/**
 * GitHub Actions are shipped disabled in this repo: every workflow lives at
 * `<name>.yml.disabled` so GitHub ignores it. Workflow assertions still need to
 * read the file, and they must keep working if the workflows are re-enabled, so
 * resolve either form instead of hardcoding one.
 */
function resolveWorkflowPath(workflowPath) {
  if (fs.existsSync(workflowPath)) {
    return workflowPath;
  }

  const disabledPath = `${workflowPath}.disabled`;
  if (fs.existsSync(disabledPath)) {
    return disabledPath;
  }

  throw new Error(`Workflow file not found: ${workflowPath} (and no .disabled variant)`);
}

module.exports = { resolveWorkflowPath };
