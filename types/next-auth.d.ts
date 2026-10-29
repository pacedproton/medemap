import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      allowedProfiles: string[];
    } & DefaultSession['user'];
  }

  interface User {
    role: string;
    allowedProfiles: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    allowedProfiles: string[];
  }
}
