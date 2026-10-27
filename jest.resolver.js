const path = require('node:path');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

module.exports = (request, options) => {
  const packagePath = options.basedir.split(`${path.sep}node_modules${path.sep}`).at(-1);

  if (
    !options.basedir.includes(`${path.sep}.pnpm${path.sep}`) ||
    !options.basedir.includes('react-native-worklets') ||
    packagePath.includes('react-native-worklets')
  ) {
    return reanimatedResolver(request, options);
  }

  // A pnpm peer-context name is not the package making this request.
  return reanimatedResolver(request, {
    ...options,
    basedir: packagePath,
    defaultResolver: (name, resolverOptions) =>
      options.defaultResolver(name, { ...resolverOptions, basedir: options.basedir }),
  });
};
