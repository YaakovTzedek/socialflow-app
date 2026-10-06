import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Meta signs every webhook delivery with the app secret: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body).
 * Verified against the RAW body (re-serialised JSON would not match). Without a secret nothing verifies.
 */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string | undefined | null): boolean {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const got = header.slice('sha256='.length).trim().toLowerCase();
  if (got.length !== expected.length || !/^[0-9a-f]+$/.test(got)) return false;
  return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}
