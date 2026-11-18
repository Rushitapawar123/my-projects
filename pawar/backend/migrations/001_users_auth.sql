-- 001: extensions, shared helpers, users, auth, follows, close friends

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE account_type   AS ENUM ('personal', 'creator', 'business');
CREATE TYPE user_role      AS ENUM ('user', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE follow_status  AS ENUM ('pending', 'accepted');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT NOT NULL UNIQUE,
  username            CITEXT NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9._]{3,30}$'),
  password_hash       TEXT NOT NULL,
  full_name           VARCHAR(80),
  bio                 VARCHAR(150),
  website             VARCHAR(255),
  avatar_url          TEXT,
  avatar_public_id    TEXT,
  is_private          BOOLEAN NOT NULL DEFAULT FALSE,
  account_type        account_type NOT NULL DEFAULT 'personal',
  category            VARCHAR(60),
  role                user_role NOT NULL DEFAULT 'user',
  status              account_status NOT NULL DEFAULT 'active',
  suspended_reason    TEXT,
  suspended_at        TIMESTAMPTZ,
  email_verified_at   TIMESTAMPTZ,
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret   TEXT,
  last_login_at       TIMESTAMPTZ,
  followers_count     INTEGER NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  following_count     INTEGER NOT NULL DEFAULT 0 CHECK (following_count >= 0),
  posts_count         INTEGER NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Search note: query with lower(username::text) LIKE '%term%' to use these indexes
CREATE INDEX idx_users_username_trgm ON users USING gin (lower(username::text) gin_trgm_ops);
CREATE INDEX idx_users_fullname_trgm ON users USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- user settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notification_settings JSONB NOT NULL DEFAULT
    '{"likes":true,"comments":true,"follows":true,"mentions":true,"story_replies":true,"messages":true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- auth tokens
-- Only hashes of tokens are stored, never the raw token.
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_password_reset_user ON password_reset_tokens (user_id);

-- Firebase Cloud Messaging device tokens
CREATE TABLE device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  platform      VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_tokens_user ON device_tokens (user_id);

-- ---------------------------------------------------------------- follows
-- status = 'pending' is a follow request for a private account.
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       follow_status NOT NULL DEFAULT 'accepted',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON follows (following_id, status, created_at DESC);
CREATE INDEX idx_follows_follower ON follows (follower_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION follows_counter() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follows_counter AFTER INSERT OR UPDATE OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION follows_counter();

-- Close friends list (used for close-friends stories)
CREATE TABLE close_friends (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX idx_close_friends_friend ON close_friends (friend_id);
