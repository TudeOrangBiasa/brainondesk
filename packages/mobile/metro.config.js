const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const conditions = config.resolver.unstable_conditionNames ?? ['require', 'import'];

if (!conditions.includes('@inkeep/source')) {
  config.resolver.unstable_conditionNames = ['@inkeep/source', ...conditions];
}

module.exports = config;
