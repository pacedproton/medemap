### 1. Generate Secret & Add Env Vars 

```bash
# Generate secret
openssl rand -base64 32
```

Add to `.env.local`:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=paste-generated-secret-here

DB_HOST=your-db-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=cmc
```

### 2. Run Database Schema 

```bash
psql -h your-db-host -U postgres -d cmc -f database/auth-schema.sql
```

Or use pgAdmin/DBeaver to run `database/auth-schema.sql`

### 3. Create Admin User

```bash
node scripts/create-admin-user.js admin@medemap.local SecurePass123
```

### 4. Test 

```bash
npm run dev
```

Go to `http://localhost:3000/login` → Login → Success!

---

## How It Works

### Authentication Flow

```
User → Login Form → NextAuth validates → PostgreSQL check
  → JWT created → Cookie set → Access granted
```

**Fully self-hosted** - no external services!

### Profile Access Control

```
User Login → Check user_profiles.allowed_profiles → Filter YAML configs
```

- **Public profiles**: Available to all authenticated users
- **Private profiles**: Require explicit permission in `allowed_profiles`
- **Admin role**: Access to all profiles automatically

---

## File Structure

```
MeDeMAP-app/
├── auth.config.ts            # NextAuth configuration
├── auth.ts                   # NextAuth instance
├── middleware.ts             # Route protection
├── config/profiles/          # YAML profile configs
│   ├── democracy-focus.yaml
│   ├── media-freedom.yaml
│   └── full-access.yaml
├── lib/auth/
│   └── server.ts            # Auth utilities
├── app/
│   ├── login/page.tsx       # Login UI
│   └── components/
│       ├── ProfileSelector.tsx  # Profile dropdown
│       └── UserMenu.tsx     # User avatar + logout
├── database/
│   └── auth-schema.sql     # PostgreSQL schema
└── scripts/
    └── create-admin-user.js # User creation utility
```

---

## Managing Users

### Add User

```bash
node scripts/create-admin-user.js researcher@uni.edu password123
```

Then update their role and permissions:
```sql
UPDATE user_profiles
SET
  role = 'researcher',
  allowed_profiles = '{democracy-focus,full-access}'
WHERE email = 'researcher@uni.edu';
```

### Change Role

```sql
UPDATE user_profiles SET role = 'admin' WHERE email = 'user@example.com';
```

### Grant Profile Access

```sql
UPDATE user_profiles
SET allowed_profiles = '{democracy-focus,media-freedom}'
WHERE email = 'user@example.com';
```

### Deactivate User

```sql
UPDATE user_profiles SET active = false WHERE email = 'user@example.com';
```

---

## User Roles

| Role | Access |
|------|--------|
| `admin` | All profiles, can manage users |
| `researcher` | Assigned profiles (typically full-access) |
| `journalist` | Public + assigned profiles |
| `viewer` | Public profiles only |

---

## Components Usage

### Add to Your Layout

```tsx
import SessionProvider from '@/app/components/SessionProvider';
import ProfileSelector from '@/app/components/ProfileSelector';
import UserMenu from '@/app/components/UserMenu';

export default function RootLayout({ children }) {
  return (
    <SessionProvider>
      <Toolbar>
        <ProfileSelector />
        <UserMenu />
      </Toolbar>
      {children}
    </SessionProvider>
  );
}
```

### Server-Side Auth

```typescript
import { getCurrentUser, requireAuth, isAdmin } from '@/lib/auth/server';

// Get current user
const user = await getCurrentUser();
console.log(user?.email, user?.role);

// Require authentication (throws if not logged in)
const user = await requireAuth();

// Check admin
if (await isAdmin()) {
  // Admin-only logic
}
```

### Client-Side Auth

```typescript
'use client';
import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session } = useSession();

  if (!session) return <div>Not logged in</div>;

  return <div>Hello {session.user.email}</div>;
}
```

### Check Profile Access

```typescript
import { canAccessProfile } from '@/lib/profiles/loader';

const hasAccess = await canAccessProfile('democracy-focus');
```

---

## Profile YAML Configs

Create data views in `config/profiles/*.yaml`:

```yaml
profile:
  id: my-profile
  name: "My Custom Profile"
  public: false  # Requires explicit permission

  groups:
    - democracy
    - supply_side

  tables:
    - basic_data

  indicators: []  # Empty = all indicators

  defaults:
    view: "map"
    chartType: "bar"
```

Grant access:
```sql
UPDATE user_profiles
SET allowed_profiles = array_append(allowed_profiles, 'my-profile')
WHERE email = 'user@example.com';
```

---

## Common Tasks

### Change Password

```bash
# Generate hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('newpassword', 10).then(console.log)"

# Update database
psql -h your-db-host -U postgres -d cmc -c \
  "UPDATE user_profiles SET password_hash = 'generated-hash' WHERE email = 'user@example.com';"
```

### List All Users

```sql
SELECT email, role, allowed_profiles, active FROM user_profiles;
```

### Make Profile Public

Edit YAML:
```yaml
profile:
  public: true  # Now all authenticated users can access
```

---

## Production Deployment

Update `.env` (or `.env.production`):

```env
NEXTAUTH_URL=https://medemap.cmclab.science
NEXTAUTH_SECRET=your-production-secret-min-32-chars
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=production-password
DB_NAME=cmc
```

Security checklist:
- [ ] Strong `NEXTAUTH_SECRET` (32+ chars)
- [ ] HTTPS enabled
- [ ] Strong passwords (12+ chars)
- [ ] Regular database backups
- [ ] Keep NextAuth.js updated

---

## Troubleshooting

**Can't login?**
- Check `.env.local` has all variables
- Restart dev server after adding env vars
- Verify user exists: `SELECT * FROM user_profiles WHERE email = 'your-email';`

**"User profile not found"?**
- Run `database/auth-schema.sql` to create table
- Create user: `node scripts/create-admin-user.js ...`

**User sees no profiles?**
- Check `user_profiles.active` is `true`
- Check `allowed_profiles` array contains valid profile IDs
- Verify YAML files exist in `config/profiles/`

**Admin can't access admin panel?**
- Verify `user_profiles.role` = `'admin'` (exact, case-sensitive)
