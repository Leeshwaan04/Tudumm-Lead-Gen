/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    './eslint-base.js',
    'next/core-web-vitals',
  ],
  rules: {
    // Next.js specific overrides
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'error',
    '@next/next/no-page-custom-font': 'warn',

    // Allow console in pages/api routes
    'no-console': 'off',

    // React
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Import: relax for Next.js dynamic imports
    'import/no-anonymous-default-export': 'warn',
  },
}
