// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'content/sources/*'],
  },
  {
    // zod-схема и её тип намеренно носят одно имя.
    files: ['src/content/schema.ts'],
    rules: { '@typescript-eslint/no-redeclare': 'off' },
  },
]);
