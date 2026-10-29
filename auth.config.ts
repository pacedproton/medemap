import type { NextAuthConfig } from 'next-auth';

// Edge-compatible config (no Node.js dependencies like bcrypt)
// Actual credential checking happens in auth.ts (Node.js runtime)
export default {
  providers: [],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.allowedProfiles = user.allowedProfiles;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.allowedProfiles = token.allowedProfiles as string[];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
