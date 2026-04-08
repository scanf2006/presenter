module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|handleQueuePrev|handleQueueNext)$' }],
    'no-undef': 'error',
    'no-empty': 'warn',
    'no-control-regex': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
  },
  overrides: [
    {
      files: ['src/**/*.jsx'],
      env: { browser: true, node: false },
    },
    {
      files: ['electron/**/*.js'],
      env: { browser: false, node: true },
      rules: {
        'no-empty': 'off',
      },
    },
  ],
};
