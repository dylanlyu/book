'use strict';

const { stripPluginNamespace } = require('./plugin-namespace');

function transformInstallContent(operation, content) {
  if (!operation.contentTransform) {
    return content;
  }
  if (operation.contentTransform === 'claude-manual-plugin-namespace') {
    return stripPluginNamespace(content);
  }
  throw new Error(`Unknown install content transform: ${operation.contentTransform}`);
}

module.exports = { transformInstallContent };
