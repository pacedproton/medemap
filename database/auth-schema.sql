-- NextAuth.js + MeDeMAP User Authentication Schema
-- Run this on your existing PostgreSQL database at your-db-host

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'researcher', 'journalist', 'viewer')),
  allowed_profiles TEXT[] DEFAULT '{}', -- Array of profile IDs from YAML configs
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Example: Create first admin user
-- Password is 'admin123' (change this immediately after first login!)
-- To generate your own hash, run in Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('your-password', 10);
-- console.log(hash);

INSERT INTO user_profiles (email, password_hash, role, allowed_profiles, active)
VALUES (
  'admin@medemap.local',
  '$2a$10$rP0YhZqJYqQQqQqQqQqQqO9ZqJYqQQqQqQqQqQqO9ZqJYqQQqQqQq', -- This is placeholder, see below
  'admin',
  '{democracy-focus,media-freedom,full-access}',
  true
)
ON CONFLICT (email) DO NOTHING;

-- IMPORTANT: To create your actual admin user, use the provided utility script:
-- npm run create-admin-user

-- Or manually generate a hash in Node.js console:
-- node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPasswordHere', 10).then(hash => console.log(hash));"
-- Then run:
-- UPDATE user_profiles SET password_hash = 'your-generated-hash' WHERE email = 'admin@medemap.local';
