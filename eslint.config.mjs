// Flat config, replacing .eslintrc.cjs. ESLint 8 reached end of life and
// ESLint 10 drops eslintrc support entirely, so the project is on ESLint 9:
// eslint-plugin-react still declares support only up to ^9.7, and forcing 10
// would leave the React rules unenforced, which is worse than being a major
// behind.
//
// Rules carried over from the old config unchanged; only the format differs.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const SOURCES = ['src/**/*.js', 'src/**/*.jsx'];

const PROJECT_RULES = {
  // ESLint 9 changed the `caughtErrors` default from 'none' to 'all'. The code
  // already marks a deliberately ignored error as `_` or `_err`, so state that
  // convention rather than reporting every one of them.
  'no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^React$',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  'no-undef': 'error',
  'no-empty': 'warn',
  'no-control-regex': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/prop-types': 'off',
  'react/no-unescaped-entities': 'off',
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/purity': 'warn',
  eqeqeq: ['warn', 'always'],
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/target/**',
      'vendor/**',
      'data/**',
      'diagnostics/**',
      'tmpasar/**',
    ],
  },

  // The plugin presets carry no `files` of their own, so scope them to the
  // sources this project actually lints.
  { files: SOURCES, ...js.configs.recommended },
  { files: SOURCES, ...react.configs.flat.recommended },
  { files: SOURCES, ...reactHooks.configs.flat.recommended },

  {
    files: SOURCES,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: PROJECT_RULES,
  },

  // Globals are declared per pattern rather than once for everything: flat
  // config merges, so a later block cannot take `node` away again. Components
  // are browser-only, as they were under the old `overrides` entry.
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.jsx'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
