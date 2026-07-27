/**
 * middleware/languageDetector.js
 * ------------------------------------------------------------
 * Detects user language preference from:
 *  1. Request header (Accept-Language, x-user-language)
 *  2. User profile (if authenticated)
 *  3. Fallback to 'en'
 *
 * Attaches req.language for downstream use.
 */
import config from '../config/index.js';

const SUPPORTED_LANGUAGES = ['en', 'ta', 'tanglish', 'hi'];

const detectFromHeader = (header) => {
  if (!header) return null;
  const parts = header.split(',').map((p) => p.trim().split(';')[0].trim().toLowerCase());
  for (const part of parts) {
    if (SUPPORTED_LANGUAGES.includes(part)) return part;
    if (part.startsWith('ta')) return 'ta';
    if (part.startsWith('hi')) return 'hi';
  }
  return null;
};

export const detectLanguage = (req, _res, next) => {
  let language = 'en';

  if (req.headers['x-user-language'] && SUPPORTED_LANGUAGES.includes(req.headers['x-user-language'])) {
    language = req.headers['x-user-language'];
  } else if (req.headers['accept-language']) {
    const detected = detectFromHeader(req.headers['accept-language']);
    if (detected) language = detected;
  }

  if (req.user?.language && SUPPORTED_LANGUAGES.includes(req.user.language)) {
    language = req.user.language;
  }

  req.language = language;
  next();
};

export default { detectLanguage };
