// Deliberately lightweight Node/ESM lint, copied from Robinson-AI-Systems/neon-mcp eslint.config.js @ d396fb4; behavior is proven by tests.
export default [{
  files: ['**/*.{js,mjs}'],
  ignores: ['node_modules/**', 'coverage/**', 'vendor/**', '.cache/**'],
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-undef': 'off',
    'no-constant-condition': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-dupe-keys': 'error',
    'no-self-compare': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }]
  }
}];
