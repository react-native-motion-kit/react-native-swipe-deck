import { defineConfig } from '@rspress/core';
import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';
import * as path from 'node:path';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'en',
  title: 'React Native Swipe Deck',
  description: 'High-performance Tinder-style swipe deck documentation for React Native apps.',
  icon: '/logo.png',
  logo: '/logo.png',
  logoText: 'React Native Swipe Deck',
  llms: true,
  multiVersion: {
    default: '1.x',
    versions: ['1.x'],
  },
  search: {
    versioned: true,
  },
  ssg: true,
  markdown: {
    showLineNumbers: true,
    defaultWrapCode: false,
    link: {
      checkDeadLinks: {
        excludes: ['/llms.txt', '/llms-full.txt', '/ko/llms.txt', '/ko/llms-full.txt'],
      },
    },
    shiki: {
      transformers: [transformerNotationDiff(), transformerNotationHighlight()],
    },
  },
  themeConfig: {
    lastUpdated: true,
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/react-native-motion-kit/react-native-swipe-deck',
      },
      {
        icon: 'npm',
        mode: 'link',
        content: 'https://www.npmjs.com/package/@react-native-motion-kit/swipe-deck',
      },
    ],
    locales: [
      {
        lang: 'en',
        label: 'English',
      },
      {
        lang: 'ko',
        label: '한국어',
      },
    ],
    editLink: {
      docRepoBaseUrl:
        'https://github.com/react-native-motion-kit/react-native-swipe-deck/tree/main/docs/docs',
    },
  },
});
