import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
// Use shared DB connection to ensure consistent config and lazy loading
import connectToDatabase from './lib/server-reldb';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logging/logger';
import { authorizeCredentials } from './lib/auth/authorize';
import { createLoginGuard } from './lib/security/loginGuard';
import { clientIp } from './lib/security/accessGate';

// Wrong passwords are counted per account and per address, so guessing is slow
const loginGuard = createLoginGuard();

// Checked when the account does not exist, so unknown and known accounts take equally long
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', 10));

const nextAuth = NextAuth({
  trustHost: true,
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        try {
          return await authorizeCredentials(credentials, clientIp(request.headers), {
            findUser: async (email) => {
              const result = await connectToDatabase().query(
                'SELECT * FROM user_profiles WHERE lower(email) = $1 AND active = true',
                [email]
              );
              return result.rows[0];
            },
            compare: (password, hash) => bcrypt.compare(password, hash),
            guard: loginGuard,
            dummyHash: getDummyHash(),
          });
        } catch (error) {
          logger.error("Auth error:", { component: "auth", error: error });
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export const { handlers, auth, signIn, signOut } = nextAuth;
