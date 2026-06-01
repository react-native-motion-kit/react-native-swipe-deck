const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');
const { getConfig } = require('react-native-builder-bob/metro-config');

const root = path.resolve(__dirname, '..');

const config = getConfig(getDefaultConfig(__dirname), {
  root,
  project: __dirname,
});

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
