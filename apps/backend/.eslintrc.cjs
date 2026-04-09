module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.spec.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['prettier'],
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  rules: {
    'prettier/prettier': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-control-regex': 'off'
  }
};

