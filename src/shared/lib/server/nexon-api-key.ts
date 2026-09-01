import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret =
    process.env.NEXON_API_KEY_ENCRYPTION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('NEXON_API_KEY_ENCRYPTION_SECRET is not configured');
  }

  return createHash('sha256')
    .update(`maple-diary:nexon-api-key:${secret}`, 'utf8')
    .digest();
}

export function encryptNexonApiKey(apiKey: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ['v1', iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptNexonApiKey(payload: string) {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split('.');
  if (version !== 'v1' || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Invalid encrypted NEXON API key');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
