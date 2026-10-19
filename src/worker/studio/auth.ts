// The studio sits behind Cloudflare Access: Access signs every request it lets through
// with a JWT (Cf-Access-Jwt-Assertion). We verify it here too, so the studio stays closed
// even if the Access application is misconfigured or removed.

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string; // e.g. "noah.cloudflareaccess.com"
  ACCESS_AUD?: string; // the Access application's "Application Audience (AUD) tag"
  DEV_STUDIO_OPEN?: string; // "1" only in .dev.vars, for `wrangler dev`
}

export type AccessResult = { ok: true; email: string } | { ok: false; reason: 'not-configured' | 'denied' };

interface Jwk extends JsonWebKey {
  kid: string;
}

let certCache: { team: string; keys: Jwk[]; until: number } | null = null;

async function accessKeys(team: string): Promise<Jwk[]> {
  if (certCache && certCache.team === team && certCache.until > Date.now()) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs: ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { team, keys: body.keys, until: Date.now() + 60 * 60 * 1000 };
  return body.keys;
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

function tokenFrom(req: Request): string | null {
  const header = req.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = req.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

export async function checkAccess(req: Request, env: AccessEnv): Promise<AccessResult> {
  if (env.DEV_STUDIO_OPEN === '1') {
    const host = new URL(req.url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return { ok: true, email: 'local@dev' };
  }
  const team = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (!team || !aud) return { ok: false, reason: 'not-configured' };

  const token = tokenFrom(req);
  if (!token) return { ok: false, reason: 'denied' };
  try {
    const [h, p, s] = token.split('.');
    const header = json(h) as { alg: string; kid: string };
    const payload = json(p) as { aud: string | string[]; exp: number; nbf?: number; iss: string; email?: string };
    if (header.alg !== 'RS256') return { ok: false, reason: 'denied' };
    const jwk = (await accessKeys(team)).find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, reason: 'denied' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    const now = Math.floor(Date.now() / 1000);
    const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
    if (!valid || !audOk || payload.exp < now || (payload.nbf ?? 0) > now + 60 || payload.iss !== `https://${team}`) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: true, email: payload.email ?? 'studio' };
  } catch {
    return { ok: false, reason: 'denied' };
  }
}
