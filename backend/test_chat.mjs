import { sanitizePrompt } from './src/utils/sanitizePrompt.js';  
import gemini from './src/services/security/gemini.js';  
console.log('SANITIZE', JSON.stringify(sanitizePrompt('  hello\x00world\n')));  
console.log('CONFIGURED', gemini.isConfigured());  
