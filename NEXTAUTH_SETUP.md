# NextAuth.js Setup Guide for MeDeMAP

## Overview

MeDeMAP now uses **NextAuth.js v5** (Auth.js) for authentication - a production-grade, fully self-hosted solution that stores everything in your existing PostgreSQL database at `your-db-host`.

**What you get:**
- Industry-standard security (battle-tested by millions of apps)
- Fully self-hosted (no external services)
- Uses your existing PostgreSQL database
- JWT sessions with HTTP-only cookies
- Role-based access control
- YAML-based profile permissions

---

## Quick Setup (10 minutes)

### Step 1: Add Environment Variables (2 min)

Add to your `.env.local`:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl

# Database (your existing PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_NAME=cmc
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

Or in Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Run Database Schema (3 min)

Connect to your PostgreSQL database and run:

```bash
psql -h your-db-host -U postgres -d cmc -f database/auth-schema.sql
```

Or copy the contents of `database/auth-schema.sql` and run in your favorite PostgreSQL client (pgAdmin, DBeaver, etc.).

This creates:
- `user_profiles` table with password hashing
- Indexes for performance
- Auto-update triggers

### Step 3: Create Admin User (2 min)

```bash
node scripts/create-admin-user.js admin@medemap.local YourSecurePassword123
```

You should see:
```
Admin user created successfully!
   ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Email: admin@medemap.local
   Role: admin

You can now login at /login
```

### Step 4: Test Authentication (3 min)

```bash
npm run dev
```

1. Go to `http://localhost:3000/login`
2. Login with your admin credentials
3. You should be redirected to the home page
4. Click the user avatar (top right) to see your profile

---

## Architecture

### How It Works

```
User Login
  ↓
NextAuth.js validates credentials against PostgreSQL
  ↓
Creates JWT token (stored in HTTP-only cookie)
  ↓
User accesses protected route
  ↓
Middleware checks JWT
  ↓
Loads user profile + permissions from PostgreSQL
  ↓
Filters available YAML profiles based on allowed_profiles
```

### Database Schema

**`user_profiles` table:**
```sql
id                UUID PRIMARY KEY
email             VARCHAR(255) UNIQUE
password_hash     VARCHAR(255)        -- bcrypt hashed
role              VARCHAR(50)         -- admin, researcher, journalist, viewer
allowed_profiles  TEXT[]              -- Array of profile IDs from YAML
active            BOOLEAN
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### File Structure

```
MeDeMAP-app/
├── auth.config.ts              # NextAuth configuration
├── auth.ts                     # NextAuth instance
├── middleware.ts               # Route protection
├── types/next-auth.d.ts        # TypeScript types
├── lib/auth/
│   └── server.ts               # Auth utilities (getCurrentUser, etc.)
├── app/
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth API routes
│   ├── login/page.tsx          # Login UI
│   └── components/
│       ├── SessionProvider.tsx  # Client-side session
│       ├── UserMenu.tsx        # User avatar dropdown
│       └── ProfileSelector.tsx # Profile selector (unchanged)
├── database/
│   └── auth-schema.sql         # PostgreSQL schema
├── scripts/
│   └── create-admin-user.js    # User creation utility
└── config/profiles/            # YAML profiles (unchanged)
```

---

## User Management

### Creating Users

**Method 1: Using the script (Recommended)**

```bash
node scripts/create-admin-user.js user@example.com password123
```

**Method 2: SQL (Manual)**

```sql
-- Generate password hash first (in Node.js):
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('mypassword', 10);

INSERT INTO user_profiles (email, password_hash, role, allowed_profiles, active)
VALUES (
  'researcher@uni.edu',
  '$2a$10$...',  -- Your generated hash
  'researcher',
  '{democracy-focus,full-access}',
  true
);
```

### User Roles

| Role | Access |
|------|--------|
| `admin` | All profiles, can access `/admin` routes |
| `researcher` | Assigned profiles only (typically full-access) |
| `journalist` | Public profiles + assigned profiles |
| `viewer` | Public profiles only |

### Assigning Profile Access

**Update user's allowed profiles:**

```sql
UPDATE user_profiles
SET allowed_profiles = '{democracy-focus,media-freedom,full-access}'
WHERE email = 'user@example.com';
```

**Grant admin role:**

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'user@example.com';
```

### Deactivate User

```sql
UPDATE user_profiles
SET active = false
WHERE email = 'user@example.com';
```

### Change Password

```bash
# Generate new hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('newpassword', 10).then(console.log)"

# Update in database
psql -h your-db-host -U postgres -d cmc -c \
  "UPDATE user_profiles SET password_hash = 'generated-hash' WHERE email = 'user@example.com';"
```

---

## Integration with Your App

### Server-Side Auth

```typescript
import { getCurrentUser, isAdmin, requireAuth } from '@/lib/auth/server';

// Get current user
const user = await getCurrentUser();
if (user) {
  console.log(user.email, user.role, user.allowed_profiles);
}

// Require authentication (throws if not authenticated)
const user = await requireAuth();

// Check if admin
if (await isAdmin()) {
  // Admin-only logic
}
```

### Client-Side Auth

```typescript
'use client';
import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return <div>Hello {session.user.email}</div>;
}
```

### Protecting Routes

Routes are automatically protected via `middleware.ts`:

- `/login` - Public
- `/api/auth/*` - Public (NextAuth endpoints)
- `/admin/*` - Requires admin role
- `/profile/*` - Requires authentication
- `/api/profiles/*` - Requires authentication

### Profile Access Control

Profiles are automatically filtered based on:

1. **Public profiles** (`public: true` in YAML): Available to all authenticated users
2. **Private profiles**: Require profile ID in user's `allowed_profiles` array
3. **Admin users**: Automatic access to all profiles

---

## Production Deployment

### Environment Variables

Update for production:

```env
NEXTAUTH_URL=https://medemap.cmclab.science
NEXTAUTH_SECRET=your-very-long-random-secret-min-32-chars

# Use your existing production database
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-production-password
DB_NAME=cmc
```

### Security Checklist

- [ ] Generate strong `NEXTAUTH_SECRET` (min 32 characters)
- [ ] Use HTTPS in production (`NEXTAUTH_URL`)
- [ ] Strong passwords for all users (min 12 characters)
- [ ] Regularly audit `user_profiles` table
- [ ] Backup database regularly
- [ ] Monitor failed login attempts
- [ ] Keep NextAuth.js updated

### SSL/TLS

NextAuth.js automatically uses secure cookies when `NEXTAUTH_URL` starts with `https://`. No additional configuration needed.

---

## Troubleshooting

### "Invalid credentials" error

- Check email exists in `user_profiles` table
- Verify `active = true`
- Ensure password hash was generated with bcrypt
- Check database connection settings in `.env.local`

### "NEXTAUTH_SECRET not set" error

- Add `NEXTAUTH_SECRET` to `.env.local`
- Restart dev server after adding

### User can't access profile

- Check `user_profiles.allowed_profiles` contains profile ID
- Verify profile ID matches YAML file name
- Check if profile is `public: false` (requires explicit permission)
- Admins bypass this check

### Session not persisting

- Check cookies are enabled in browser
- Verify `NEXTAUTH_URL` matches your actual URL
- In production, ensure HTTPS is enabled

### Database connection errors

- Verify PostgreSQL is running at `your-db-host:5432`
- Check credentials in `.env.local`
- Ensure `user_profiles` table exists (run schema)
- Check firewall allows connection from your server

### TypeScript errors

```bash
npm run build
```

If you see type errors related to `next-auth`:
- Restart TypeScript server in IDE
- Check `types/next-auth.d.ts` exists
- Verify NextAuth.js version is v5 (`npm ls next-auth`)

---

## Advanced

### Adding More Authentication Providers

NextAuth.js supports OAuth (Google, GitHub, etc.):

```typescript
// auth.config.ts
import Google from 'next-auth/providers/google';

export default {
  providers: [
    Credentials({ /* ... */ }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  // ...
}
```

### Session Customization

```typescript
// auth.config.ts
export default {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh token every 24 hours
  },
  // ...
}
```

### Rate Limiting

Consider adding rate limiting for login attempts:

```bash
npm install @upstash/ratelimit @upstash/redis
```

See: https://authjs.dev/guides/basics/securing

---

## Resources

- [NextAuth.js Documentation](https://authjs.dev/)
- [Security Best Practices](https://authjs.dev/guides/basics/securing)
- [Next.js App Router Integration](https://authjs.dev/getting-started/installation?framework=next.js)
- [NextAuth.js Discord](https://discord.authjs.dev)

---

**Questions?** Review this guide or check the [NextAuth.js docs](https://authjs.dev/).
