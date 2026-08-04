/**
 * utils/jwt.js
 * ------------------------------------------------------------
 * Access + refresh token helpers built on jsonwebtoken.
 * Access tokens are short-lived; refresh tokens can be
 * revoked by removing them from the user's refreshTokens list.
 *
 * Includes jti claim for token revocation support.
 * Includes signTwoFactorToken for secure 2FA flow (no userId
 * in request body — uses a short-lived signed token instead).
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';

const ALGORITHM = 'HS256';

export const signAccessToken = (payload) => {
  const jti = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
  return jwt.sign({ ...payload, jti }, config.jwt.secret, { expiresIn: config.jwt.expire, algorithm: ALGORITHM });
};

export const signRefreshToken = (payload) => {
  const jti = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
  return jwt.sign({ ...payload, jti }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpire, algorithm: ALGORITHM });
};

/**
 * Signs a short-lived (5-minute) token for the 2FA verification flow.
 * This replaces passing userId in the request body, which was an
 * authentication bypass vulnerability.
 * @param {string} userId - The user ID to encode
 * @returns {string} Signed JWT token
 */
export const signTwoFactorToken = (userId) => {
  const jti = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
  return jwt.sign({ sub: userId, jti, purpose: '2fa' }, config.jwt.secret, { expiresIn: '5m', algorithm: ALGORITHM });
};

/**
 * Verifies a 2FA token and returns the decoded payload.
 * @param {string} token - The 2FA token to verify
 * @returns {object} Decoded payload with `sub` (userId)
 */
export const verifyTwoFactorToken = (token) => {
  const decoded = jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });
  if (decoded.purpose !== '2fa') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
};

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });
export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret, { algorithms: [ALGORITHM] });

export default { signAccessToken, signRefreshToken, signTwoFactorToken, verifyTwoFactorToken, verifyAccessToken, verifyRefreshToken };