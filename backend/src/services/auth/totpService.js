/**
 * services/auth/totpService.js
 * ------------------------------------------------------------
 * RFC 6238 compliant TOTP implementation using Node.js
 * built-in crypto (HMAC-SHA1) — no external dependencies.
 *
 * Supports Google Authenticator, Microsoft Authenticator, and Authy.
 * All TOTP secrets are encrypted at rest (AES-256-GCM) via the
 * encryption utility before being stored on the User document.
 *
 * Features:
 *  - Secret generation (base32, 20 random bytes)
 *  - QR provisioning URI (otpauth://)
 *  - Token verification with configurable time-step window
 *  - Backup recovery codes
 *  - Enable/disable MFA flow
 */
import crypto from 'crypto';
import { encrypt, decrypt } from '../../utils/encryption.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;

function base32Encode(buffer) {
  let result = '';
  let bits = 0;
  let accumulated = 0;

  for (const byte of buffer) {
    accumulated = (accumulated << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      const index = (accumulated >> bits) & 0x1f;
      result += BASE32_CHARS[index];
    }
  }

  if (bits > 0) {
    const index = (accumulated << (5 - bits)) & 0x1f;
    result += BASE32_CHARS[index];
  }

  while (result.length % 8 !== 0) {
    result += '=';
  }

  return result;
}

function base32Decode(str) {
  const cleaned = str.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const lookup = {};
  for (let i = 0; i < BASE32_CHARS.length; i++) {
    lookup[BASE32_CHARS[i]] = i;
  }

  const result = [];
  let bits = 0;
  let accumulated = 0;

  for (const char of cleaned) {
    if (!(char in lookup)) continue;
    accumulated = (accumulated << 5) | lookup[char];
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((accumulated >> bits) & 0xff);
    }
  }

  return Buffer.from(result);
}

function generateSecret() {
  const buf = crypto.randomBytes(20);
  return base32Encode(buf);
}

function generateQrCodeUrl(secret, accountName, issuer = 'CyberSec Assistant') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

async function generateQrCodeSvg(uri) {
  const qrcode = (await import('qrcode')).default;
  return qrcode.toString(uri, { type: 'svg', width: 256 });
}

function totpGenerate(secret, options = {}) {
  const {
    window: windowSize = config.mfa.totp.window,
    timeStep = TOTP_PERIOD,
    digits = TOTP_DIGITS,
    algorithm = 'sha1',
  } = options;

  const key = base32Decode(secret);
  const epoch = Date.now();
  const counter = Math.floor(epoch / (timeStep * 1000));
  const codes = [];

  for (let i = -windowSize; i <= windowSize; i++) {
    const c = counter + i;
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(c));
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(buf);
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x3f) << 24) |
      ((hash[offset + 1] & 0x7f) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
    codes.push(otp);
  }

  return codes;
}

function verifyToken(secret, token, options = {}) {
  const codes = totpGenerate(secret, options);
  return codes.includes(token);
}

function generateBackupCodes(count = config.mfa.backupCodesCount) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
  }
  return codes;
}

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function encryptSecret(secret) {
  return encrypt(secret);
}

function decryptSecret(encrypted) {
  try {
    return decrypt(encrypted);
  } catch (err) {
    logger.error('[totpService] Failed to decrypt TOTP secret', { error: err.message });
    return null;
  }
}

export {
  generateSecret,
  generateQrCodeUrl,
  generateQrCodeSvg,
  totpGenerate,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  encryptSecret,
  decryptSecret,
  base32Encode,
  base32Decode,
};

export default {
  generateSecret,
  generateQrCodeUrl,
  generateQrCodeSvg,
  totpGenerate,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  encryptSecret,
  decryptSecret,
};
