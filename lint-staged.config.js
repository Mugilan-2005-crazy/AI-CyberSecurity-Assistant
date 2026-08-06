const frontendConfig = {
  'frontend/src/**/*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
};

const backendConfig = {
  'backend/src/**/*.js': [
    'eslint --fix',
  ],
};

module.exports = {
  ...frontendConfig,
  ...backendConfig,
};