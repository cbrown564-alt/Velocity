import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.agents/**',
      '.venv/**',
      'coverage/**',
      'dist/**',
      'mcp-server/dist/**',
      'node_modules/**',
      'playwright-report/**',
      'reports/**',
      'stryker-tmp/**',
      'test_data/**',
      'test-results/**',
      'tmp/**',
      'packages/readstat-wasm/dist/**',
      'packages/readstat-wasm/lib/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-case-declarations': 'error',
      'no-empty': 'error',
      'no-useless-escape': 'error',
      'no-useless-assignment': 'error',
      'prefer-const': 'error',
      'preserve-caught-error': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'tests/**/*.spec.ts', 'mcp-server/**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        ...globals.vitest,
      },
    },
  },
  eslintConfigPrettier,
);
