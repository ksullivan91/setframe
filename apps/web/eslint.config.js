export default [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['dist/**', 'coverage/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {},
  },
];
