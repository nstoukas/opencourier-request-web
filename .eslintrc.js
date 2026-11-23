// The lint for request-web (row 129), run by `yarn lint`. Before this the repo had no ESLint at all.
// `next/core-web-vitals` is Next's own recommended set (React, hooks and Next rules), the config
// create-next-app writes; `i18next/no-literal-string` is the hard coded text check adminweb runs.
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  plugins: ['i18next'],
  rules: {
    // `jsx-text-only`: only text written between JSX tags, the words a restaurant reads. Attributes
    // (className, data-testid, href) and plain strings in code are not counted. Every such text goes
    // in src/i18n/resources (en.ts and el.ts) and is shown with `t('...')`. An intended literal (a
    // symbol, say) carries `// eslint-disable-next-line i18next/no-literal-string` and a reason.
    'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
  },
  overrides: [
    {
      // Tests write sentences on purpose (they look for them on screen) and build stand in markup,
      // such as a plain <a> passed to a component, so neither rule applies there.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'i18next/no-literal-string': 'off',
        '@next/next/no-html-link-for-pages': 'off',
      },
    },
  ],
}
