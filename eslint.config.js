import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/'] },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginAstro.configs['jsx-a11y-recommended'],
  {
    // A scrolling role="log" transcript must be a keyboard stop so text-only
    // content can be scrolled without a mouse (WCAG 2.1.1).
    files: ['**/*.astro'],
    rules: {
      'astro/jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { roles: ['tabpanel', 'log'] },
      ],
    },
  },
];
