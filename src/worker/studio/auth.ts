import { hashPassword, passwordProblem, verifyPassword } from '../../shared/password';

// Studio sign-in: username + password (accounts are created with `npm run studio:user`).
// A session is a random token in an HttpOnly cookie; D1 keeps only its SHA-256, so a
// leaked database can't be replayed as a login.

export const SESSION_COOKIE = 'noah_studio';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
// Per IP the limit is tight; per username it is looser, so a stranger can't easily
// lock Noah out by typing wrong passwords for her username.
const MAX_FAILURES_IP = 10;
const MAX_FAILURES_USER = 50;
const FAILURE_WINDOW = 15 * 60;

export interface StudioUser {
  id: number;
  username: string;
}

const now = () => Math.floor(Date.now() / 1000);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieToken(req: Request): string | null {
  const cookie = req.headers.get('Cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,100})`));
  return match ? match[1] : null;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/studio; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export async function currentUser(db: D1Database, req: Request): Promise<StudioUser | null> {
  const token = cookieToken(req);
  if (!token) return null;
  return db
    .prepare(
      `SELECT u.id, u.username FROM studio_sessions s JOIN studio_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(await sha256(token), now())
    .first<StudioUser>();
}

export async function hasAccounts(db: D1Database): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 FROM studio_users LIMIT 1').first());
}

// A hash of nothing in particular: unknown usernames still pay for one PBKDF2 run,
// so response times don't reveal which usernames exist.
let decoy: Promise<string> | null = null;

export type SignIn = { ok: true; token: string } | { ok: false; reason: 'invalid' | 'locked' };

export async function signIn(db: D1Database, username: string, password: string, ip: string): Promise<SignIn> {
  const keys = [`ip:${ip}`, `user:${username.toLowerCase()}`];
  const t = now();
  const blocked = await db
    .prepare(
      `SELECT 1 FROM studio_login_failures
       WHERE window_start > ? AND ((key = ? AND count >= ?) OR (key = ? AND count >= ?))`
    )
    .bind(t - FAILURE_WINDOW, keys[0], MAX_FAILURES_IP, keys[1], MAX_FAILURES_USER)
    .first();
  if (blocked) return { ok: false, reason: 'locked' };

  const user = await db
    .prepare('SELECT id, password_hash FROM studio_users WHERE username = ?')
    .bind(username)
    .first<{ id: number; password_hash: string }>();
  decoy ??= hashPassword('decoy password, never used');
  const valid = await verifyPassword(password, user?.password_hash ?? (await decoy));

  if (!user || !valid) {
    await db.batch(
      keys.map((key) =>
        db
          .prepare(
            `INSERT INTO studio_login_failures (key, count, window_start) VALUES (?, 1, ?)
             ON CONFLICT (key) DO UPDATE SET
               count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
               window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`
          )
          .bind(key, t, t - FAILURE_WINDOW, t - FAILURE_WINDOW)
      )
    );
    return { ok: false, reason: 'invalid' };
  }

  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  await db.batch([
    db.prepare('DELETE FROM studio_login_failures WHERE key IN (?, ?)').bind(keys[0], keys[1]),
    db.prepare('DELETE FROM studio_sessions WHERE expires_at <= ?').bind(t),
    db.prepare('INSERT INTO studio_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), user.id, t + SESSION_SECONDS)
  ]);
  return { ok: true, token };
}

export async function signOut(db: D1Database, req: Request) {
  const token = cookieToken(req);
  if (token) await db.prepare('DELETE FROM studio_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

/** Changes the password and signs out every other browser. Returns an error message, or null. */
export async function changePassword(db: D1Database, req: Request, user: StudioUser, current: string, next: string, repeat: string) {
  const row = await db.prepare('SELECT password_hash FROM studio_users WHERE id = ?').bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(current, row.password_hash))) return 'Your current password isn’t right.';
  if (next !== repeat) return 'The two new passwords don’t match.';
  const problem = passwordProblem(next);
  if (problem) return problem;
  const keep = await sha256(cookieToken(req) ?? '');
  await db.batch([
    db.prepare('UPDATE studio_users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), user.id),
    db.prepare('DELETE FROM studio_sessions WHERE user_id = ? AND token_hash <> ?').bind(user.id, keep)
  ]);
  return null;
}
