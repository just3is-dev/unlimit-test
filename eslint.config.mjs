// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // Import sorting — four groups, separated by blank lines:
      //   1. Node built-ins  (fs, path, …)
      //   2. External packages  (@nestjs/…, ai, zod, …)
      //   3. Internal aliases  (@/…)
      //   4. Relative imports  (./…, ../…)
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^node:'],
            ['^[^@.]', '^@(?!/)'],  // external: bare names + @scoped (but not @/)
            ['^@/'],                // internal aliases
            ['^\\.'],              // relative
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // TypeScript essentials
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Vanilla JS rules that conflict with TS
      'no-unused-vars': 'off',
    },
  },
];
