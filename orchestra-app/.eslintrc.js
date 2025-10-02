module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Performance et optimisation
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',

    // Qualité du code
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // React spécifique
    'react/jsx-uses-react': 'off', // React 17+ n'a plus besoin d'import React
    'react/react-in-jsx-scope': 'off',
    'react/jsx-key': 'warn',
    'react/no-array-index-key': 'warn',

    // Console et debug
    'no-console': 'warn',
    'no-debugger': 'error',

    // Sécurité
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Style de code
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-template': 'warn',

    // TypeScript basic
    '@typescript-eslint/no-non-null-assertion': 'warn'
  },
  settings: {
    'import/resolver': {
      'typescript': {}
    }
  },
  overrides: [
    {
      files: ['**/*.tsx', '**/*.ts'],
      rules: {
        // Règles spécifiques TypeScript
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off'
      }
    }
  ]
};