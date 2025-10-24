import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // Browser JS files
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended', 'plugin:prettier/recommended'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Node.js files
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    extends: ['js/node', 'plugin:prettier/recommended'],
  },
  // Optional: Prettier for all files (if you want to enforce formatting)
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'prettier/prettier': 'error',
    },
  },
]);
