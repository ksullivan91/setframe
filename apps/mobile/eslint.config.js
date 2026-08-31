import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * The point of this config is ONE rule: react-hooks/rules-of-hooks.
 *
 * A conditional hook shipped to TestFlight and crashed the app on launch —
 * a query placed below an early return, which React only detects at runtime
 * on the second render. ESLint catches it statically in milliseconds, and had
 * never run here: this app had no config at all, so `npm run lint` could not
 * start.
 *
 * Deliberately narrow. A repo this far along cannot absorb a full recommended
 * ruleset in one go, and a lint run nobody can get to zero is a lint run
 * nobody reads. Rules earn their way in.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'ios/**', 'android/**', '.expo/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.base],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      /* Off, not on: the codebase has many deliberate, commented dependency
         omissions, and turning this to error today would bury the rule above
         in noise. */
      'react-hooks/exhaustive-deps': 'off',
    },
  },
);
