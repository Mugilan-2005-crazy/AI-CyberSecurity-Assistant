/**
 * utils/jwt.js
 * ------------------------------------------------------------
 * Access + refresh token helpers built on jsonwebtoken.
 * Access tokens are short-lived; refresh tokens can be
 * revoked by removing them from the user's refreshTokens list.
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expire });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpire });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);
export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

export default { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
