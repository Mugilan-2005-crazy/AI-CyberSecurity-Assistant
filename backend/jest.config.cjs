process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_NAME = 'Test Admin';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/cybersec_test';
process.env.CLIENT_ORIGIN = 'http://localhost';
process.env.PORT = '5001';
process.env.API_PREFIX = '/api';
process.env.VIRUSTOTAL_API_KEY = '';
process.env.ABUSEIPDB_API_KEY = '';
process.env.OTX_API_KEY = '';
process.env.NVD_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_TIMEOUT = '1000';

module.exports = {
   testEnvironment: 'node',
  globalTeardown: './tests/globalTeardown.mjs',
  forceExit: true,
  testTimeout: 30000,
  testMatch: ['**/tests/**/*.test.mjs'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/middleware/upload.js',
    '!src/middleware/languageDetector.js',
    '!src/utils/logger.js',
    '!src/utils/email.js',
    '!src/config/swagger.js',
    '!src/services/ai/**/*.js',
    '!src/services/rag/**/*.js',
    '!src/services/search/**/*.js',
    '!src/services/security/**/*.js',
    '!src/services/threatIntel/**/*.js',
    '!src/services/reportService.js',
    '!src/services/fileAnalysisService.js',
    '!src/services/documentService.js',
    '!tests/bootstrap.mjs',
  ],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 35,
      lines: 40,
      statements: 40,
    },
  },
};