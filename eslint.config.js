// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the Towventure monorepo.
 *
 * The determinism block (see AGENTS.md §3.1) is enforced mechanically: no
 * `Math.random`, `Date`, or float-producing globals are allowed inside the
 * shared sim/run hot path. Review is the backstop; this is the tripwire.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'packages/*/drizzle/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript's checker owns undefined-symbol errors; ESLint's global
      // table just gets in the way in an isomorphic monorepo.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // The load-bearing wall: the deterministic sim & run reducers.
    files: ['packages/shared/src/sim/**/*.ts', 'packages/shared/src/run/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'No Date in deterministic sim/run code (AGENTS.md §3.1).' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG in sim/rng.ts, never Math.random (AGENTS.md §3.1).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'No Date.now in deterministic sim/run code (AGENTS.md §3.1).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'Use the seeded RNG in sim/rng.ts, never Math.random (AGENTS.md §3.1).',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.config.ts', '**/*.config.js', '**/scripts/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
);
