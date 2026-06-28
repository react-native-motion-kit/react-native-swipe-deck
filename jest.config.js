const reactNativePackages = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
];

const pnpmReactNativePackages = [
  '(jest-)?react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
];

module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/example/node_modules', '<rootDir>/lib/'],
  preset: '@react-native/jest-preset',
  resolver: 'react-native-worklets/jest/resolver',
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  transformIgnorePatterns: [
    `node_modules/(?!(${reactNativePackages.join('|')}|\\.pnpm)/)`,
    `node_modules/.pnpm/(?!(${pnpmReactNativePackages.join('|')})@|@react-native\\+|@react-native-community\\+)`,
  ],
};
