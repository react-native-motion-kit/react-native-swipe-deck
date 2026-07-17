const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { transformSync } = require('@babel/core');
const { describe, expect, it } = require('@jest/globals');

describe('direction worklets', () => {
  it('initializes helper closures before resolving a swipe', () => {
    const filename = resolve(__dirname, '../core/directions.ts');
    const transformed = transformSync(readFileSync(filename, 'utf8'), {
      babelrc: false,
      configFile: false,
      filename,
      plugins: [require.resolve('react-native-worklets/plugin')],
      presets: [require.resolve('@react-native/babel-preset')],
    });
    const moduleExports = {};

    Function('exports', transformed.code)(moduleExports);

    expect(
      moduleExports.resolveSwipeDirection({
        directionPolicy: { left: true, right: true, up: true },
        swipeThreshold: 120,
        translationX: 200,
        translationY: -20,
        velocityThreshold: 800,
        velocityX: 0,
        velocityY: 0,
      }),
    ).toBe('right');
  });
});
