// Test fixture for insecure cryptography detection
import { createHash, createCipher, createCipheriv } from 'crypto';

export function weakHashMd5(data: string): string {
  // SHOULD FIND: Insecure Cryptographic Usage (Medium severity - weak hash)
  const hash = createHash('md5');
  hash.update(data);
  return hash.digest('hex');
}

export function weakHashSha1(data: string): string {
  // SHOULD FIND: Insecure Cryptographic Usage (Medium severity - weak hash)
  const hash = createHash('sha1');
  hash.update(data);
  return hash.digest('hex');
}

export function brokenCipherDes(plaintext: string, password: string): string {
  // SHOULD FIND: Insecure Cryptographic Usage (High severity - broken cipher)
  const cipher = createCipher('des', password);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function brokenCipherEcb(plaintext: string, key: Buffer, iv: Buffer): string {
  // SHOULD FIND: Insecure Cryptographic Usage (High severity - ECB mode)
  const cipher = createCipheriv('aes-128-ecb', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function safeHashSha256(data: string): string {
  // SHOULD NOT FIND: SHA256 is cryptographically sound
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

export function safeHashSha512(data: string): string {
  // SHOULD NOT FIND: SHA512 is cryptographically sound
  const hash = createHash('sha512');
  hash.update(data);
  return hash.digest('hex');
}

export function safeCipherGcm(plaintext: string, key: Buffer, iv: Buffer): string {
  // SHOULD NOT FIND: AES-GCM is authenticated encryption (secure)
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
