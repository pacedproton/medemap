import { normalizeEmail, type LoginGuard } from '../security/loginGuard';

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  allowed_profiles: string[];
}

export interface AuthorizeDeps {
  findUser: (email: string) => Promise<AuthUser | undefined>;
  compare: (password: string, hash: string) => Promise<boolean>;
  guard: LoginGuard;
  /** a valid hash checked when the account does not exist, so both cases take equally long */
  dummyHash: string;
}

const MAX_EMAIL = 254;
const MAX_PASSWORD = 256;

export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>> | undefined,
  ip: string,
  deps: AuthorizeDeps
) {
  const rawEmail = credentials?.email;
  const password = credentials?.password;
  if (typeof rawEmail !== 'string' || typeof password !== 'string') return null;
  if (!rawEmail || !password || rawEmail.length > MAX_EMAIL || password.length > MAX_PASSWORD) return null;

  const email = normalizeEmail(rawEmail);
  if (deps.guard.isLocked(email, ip).locked) return null;

  const user = await deps.findUser(email);
  const ok = await deps.compare(password, user?.password_hash ?? deps.dummyHash);
  if (!user || !ok) {
    deps.guard.recordFailure(email, ip);
    return null;
  }

  deps.guard.recordSuccess(email);
  return {
    id: user.id,
    email: user.email,
    name: user.email,
    role: user.role,
    allowedProfiles: user.allowed_profiles,
  };
}
