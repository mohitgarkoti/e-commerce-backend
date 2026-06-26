/**
 * AES-256-GCM Encryption / Decryption Utility
 * Uses Node.js built-in `crypto` module — no extra packages required.
 *
 * Format (stored / transmitted):
 *   { iv: base64(12 bytes), data: base64(ciphertext + 16-byte auth tag) }
 *
 * Compatible with frontend Web Crypto API (AES-GCM, tagLength: 128)
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV — GCM standard
const TAG_LENGTH = 16;  // 128-bit auth tag

/**
 * Returns the 32-byte key buffer from env.
 * Throws if ENCRYPTION_KEY is missing or invalid length.
 */
function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env variable must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts any value (string / object / number) with AES-256-GCM.
 * @param {*} plaintext — Value to encrypt. Objects are JSON-stringified.
 * @returns {{ iv: string, data: string }} — Base64-encoded IV and (ciphertext + tag)
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const raw = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Concatenate ciphertext + tag for a unified format (compatible with Web Crypto)
  const combined = Buffer.concat([encrypted, tag]);

  return {
    iv: iv.toString('base64'),
    data: combined.toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload produced by `encrypt()` or the frontend.
 * @param {{ iv: string, data: string }} payload
 * @returns {string} Decrypted UTF-8 string
 */
function decrypt(payload) {
  const key = getKey();
  const { iv, data } = payload;

  const ivBuffer   = Buffer.from(iv,   'base64');
  const dataBuffer = Buffer.from(data, 'base64');

  // Last TAG_LENGTH bytes are the GCM auth tag; the rest is ciphertext
  const ciphertext = dataBuffer.slice(0, dataBuffer.length - TAG_LENGTH);
  const tag        = dataBuffer.slice(dataBuffer.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Convenience: encrypt a single field value (returns a prefixed string for DB storage).
 * Format: "ENC|<base64iv>|<base64data>"
 * Uses pipe (|) as separator — base64 alphabet never contains '|'.
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function encryptField(value) {
  if (value === null || value === undefined || value === '') return value;
  // Skip if already encrypted
  if (typeof value === 'string' && value.startsWith('ENC|')) return value;
  try {
    const { iv, data } = encrypt(String(value));
    return `ENC|${iv}|${data}`;
  } catch {
    return value; // fallback — never crash on encrypt failure
  }
}

/**
 * Convenience: decrypt a field value encrypted with `encryptField()`.
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function decryptField(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('ENC|')) return value;
  try {
    // Split on '|' — safe because '|' is not in the base64 alphabet
    const parts = value.split('|');
    // parts[0] = 'ENC', parts[1] = iv, parts[2] = data
    const iv   = parts[1];
    const data = parts[2];
    return decrypt({ iv, data });
  } catch {
    return value; // fallback — return raw value if decryption fails
  }
}

module.exports = { encrypt, decrypt, encryptField, decryptField };
