import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function trackingKey(value: string): Buffer {
  if (!/^[a-f\d]{64}$/i.test(value || '')) throw new Error('TRACKING_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.');
  return Buffer.from(value, 'hex');
}

export function encryptAuthCode(code: string, key: string, userId: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', trackingKey(key), iv);
  cipher.setAAD(Buffer.from(String(userId)));
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64')).join('.');
}

export function decryptAuthCode(value: string, key: string, userId: number): string {
  const parts = value.split('.').map(p => Buffer.from(p, 'base64'));
  if (parts.length !== 3) throw new Error('Credencial de rastreamento inválida.');
  const decipher = createDecipheriv('aes-256-gcm', trackingKey(key), parts[0]);
  decipher.setAAD(Buffer.from(String(userId)));
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8');
}

export function allowedSteamIds(value: string): string[] {
  return [...new Set((value || '').split(',').map(x => x.trim()).filter(x => /^7656119\d{10}$/.test(x)))];
}

// Chave curta do link compartilhável: sem ela o número sequencial da partida
// não basta para ver a miniatura pública.
export function matchShareKey(id: number, key: string): string {
  return createHmac('sha256', trackingKey(key)).update(`match-share:${id}`).digest('hex').slice(0, 16);
}

export function validShareKey(id: number, candidate: string, key: string): boolean {
  const expected = Buffer.from(matchShareKey(id, key));
  const given = Buffer.from(candidate || '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
