export type Access = 'public' | 'auth' | 'admin';

const PUBLIC = ['/api/auth', '/login', '/verify'];
const ADMIN = ['/admin'];
const AUTH = ['/profile', '/api/profiles'];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

function normalize(pathname: string): string {
  let p = pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw path if it is not valid percent-encoding
  }
  const stack: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return `/${stack.join('/')}`;
}

/** Everything is public unless it falls under an admin or session-only prefix. */
export function accessFor(pathname: string): Access {
  const p = normalize(pathname);
  if (PUBLIC.some((b) => under(p, b))) return 'public';
  if (ADMIN.some((b) => under(p, b))) return 'admin';
  if (AUTH.some((b) => under(p, b))) return 'auth';
  return 'public';
}
