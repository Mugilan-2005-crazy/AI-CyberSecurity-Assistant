/**
 * utils/tokens.js
 * ------------------------------------------------------------
 * Cryptographically-random token generator + hashing for
 * email verification and password reset links. We store only
 * the SHA-256 hash of the token in the DB; the raw token is
 * sent in the email link and never persisted.
 */
import crypto from 'crypto';

export const generateToken = () => crypto.randomBytes(32).toString('hex');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Opaque random secret used by modules that need a shared salt.
export const randomSecret = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

export default { generateToken, hashToken, randomSecret };
