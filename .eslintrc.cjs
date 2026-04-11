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
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^React$' }],
    'no-undef': 'error',
    'no-empty': 'warn',
    'no-control-regex': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/purity': 'warn',
    eqeqeq: ['warn', 'always'],
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
        'no-empty': 'warn',
      },
    },
  ],
};
