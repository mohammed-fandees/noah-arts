// Password hashing shared by the Worker (sign-in) and scripts/studio-user.ts (creating accounts).
// PBKDF2-SHA256 through WebCrypto, which both Cloudflare Workers and Node provide.

/** Cloudflare Workers cap PBKDF2 at 100 000 iterations. */
const ITERATIONS = 100_000;
const PREFIX = 'pbkdf2-sha256';

export const PASSWORD_MIN_LENGTH = 10;

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iter, salt, hash] = stored.split('$');
  const iterations = Number(iter);
  if (prefix !== PREFIX || !Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS || !salt || !hash) return false;
  let expected: Uint8Array;
  try {
    expected = fromB64(hash);
  } catch {
    return false;
  }
  const actual = await derive(password, fromB64(salt), iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 200) return 'That password is too long.';
  return null;
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
