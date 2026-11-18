-- 002: posts, media, hashtags, reels, comments, likes, saves, mentions, stories

CREATE TYPE media_type      AS ENUM ('image', 'video');
CREATE TYPE content_status  AS ENUM ('active', 'removed');
CREATE TYPE story_audience  AS ENUM ('everyone', 'close_friends');

-- ---------------------------------------------------------------- posts
-- Owner delete = hard DELETE (cascades). Admin removal sets status = 'removed'.
CREATE TABLE posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption           VARCHAR(2200),
  location_name     VARCHAR(120),
  latitude          NUMERIC(9,6),
  longitude         NUMERIC(9,6),
  comments_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  hide_like_count   BOOLEAN NOT NULL DEFAULT FALSE,
  status            content_status NOT NULL DEFAULT 'active',
  likes_count       INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count    INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  saves_count       INTEGER NOT NULL DEFAULT 0 CHECK (saves_count >= 0),
  shares_count      INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_user_created ON posts (user_id, created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX idx_posts_created ON posts (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX idx_posts_likes ON posts (likes_count DESC) WHERE status = 'active';
CREATE INDEX idx_posts_caption_trgm ON posts USING gin (lower(caption) gin_trgm_ops);

CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION user_posts_counter() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
  ELSE
    UPDATE users SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_counter AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION user_posts_counter();

-- Up to 10 images or one video per post (the one-video rule is validated in the API).
CREATE TABLE post_media (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position         SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 9),
  media_type       media_type NOT NULL,
  url              TEXT NOT NULL,
  public_id        TEXT,
  thumbnail_url    TEXT,
  width            INTEGER,
  height           INTEGER,
  duration_seconds NUMERIC(6,2),
  alt_text         VARCHAR(500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, position)
);

-- ---------------------------------------------------------------- hashtags
CREATE TABLE hashtags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       CITEXT NOT NULL UNIQUE CHECK (name ~ '^[A-Za-z0-9_]{1,100}$'),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hashtags_name_trgm ON hashtags USING gin (lower(name::text) gin_trgm_ops);
CREATE INDEX idx_hashtags_uses ON hashtags (uses_count DESC);

CREATE TABLE post_hashtags (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
CREATE INDEX idx_post_hashtags_tag ON post_hashtags (hashtag_id);

-- ---------------------------------------------------------------- reels
CREATE TABLE reels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url         TEXT NOT NULL,
  video_public_id   TEXT,
  cover_url         TEXT,
  duration_seconds  NUMERIC(6,2) NOT NULL CHECK (duration_seconds > 0),
  width             INTEGER,
  height            INTEGER,
  caption           VARCHAR(2200),
  audio_name        VARCHAR(150),
  comments_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  status            content_status NOT NULL DEFAULT 'active',
  views_count       BIGINT NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  likes_count       INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count    INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  saves_count       INTEGER NOT NULL DEFAULT 0 CHECK (saves_count >= 0),
  shares_count      INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reels_user_created ON reels (user_id, created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX idx_reels_created ON reels (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX idx_reels_views ON reels (views_count DESC) WHERE status = 'active';
CREATE INDEX idx_reels_caption_trgm ON reels USING gin (lower(caption) gin_trgm_ops);

CREATE TRIGGER trg_reels_updated_at BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reel_hashtags (
  reel_id    UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (reel_id, hashtag_id)
);
CREATE INDEX idx_reel_hashtags_tag ON reel_hashtags (hashtag_id);

CREATE OR REPLACE FUNCTION hashtag_counter() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hashtags SET uses_count = uses_count + 1 WHERE id = NEW.hashtag_id;
  ELSE
    UPDATE hashtags SET uses_count = GREATEST(uses_count - 1, 0) WHERE id = OLD.hashtag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_hashtags_counter AFTER INSERT OR DELETE ON post_hashtags
  FOR EACH ROW EXECUTE FUNCTION hashtag_counter();
CREATE TRIGGER trg_reel_hashtags_counter AFTER INSERT OR DELETE ON reel_hashtags
  FOR EACH ROW EXECUTE FUNCTION hashtag_counter();

-- ---------------------------------------------------------------- comments
-- Belongs to exactly one of post / reel. parent_id enables nested replies.
CREATE TABLE comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id       UUID REFERENCES reels(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
  body          VARCHAR(2200) NOT NULL CHECK (length(btrim(body)) > 0),
  likes_count   INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  replies_count INTEGER NOT NULL DEFAULT 0 CHECK (replies_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id) = 1)
);
CREATE INDEX idx_comments_post_top ON comments (post_id, created_at DESC, id DESC)
  WHERE parent_id IS NULL AND post_id IS NOT NULL;
CREATE INDEX idx_comments_reel_top ON comments (reel_id, created_at DESC, id DESC)
  WHERE parent_id IS NULL AND reel_id IS NOT NULL;
CREATE INDEX idx_comments_parent ON comments (parent_id, created_at ASC) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_user ON comments (user_id, created_at DESC);

CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION comments_counter() RETURNS trigger AS $$
DECLARE
  delta INTEGER;
  r comments%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := 1; r := NEW; ELSE delta := -1; r := OLD; END IF;
  IF r.post_id IS NOT NULL THEN
    UPDATE posts SET comments_count = GREATEST(comments_count + delta, 0) WHERE id = r.post_id;
  ELSE
    UPDATE reels SET comments_count = GREATEST(comments_count + delta, 0) WHERE id = r.reel_id;
  END IF;
  IF r.parent_id IS NOT NULL THEN
    UPDATE comments SET replies_count = GREATEST(replies_count + delta, 0) WHERE id = r.parent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_counter AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_counter();

-- ---------------------------------------------------------------- likes
-- One row per like; target is exactly one of post / reel / comment.
CREATE TABLE likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id    UUID REFERENCES reels(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id, comment_id) = 1)
);
CREATE UNIQUE INDEX uq_likes_post ON likes (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_likes_reel ON likes (user_id, reel_id) WHERE reel_id IS NOT NULL;
CREATE UNIQUE INDEX uq_likes_comment ON likes (user_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_likes_post ON likes (post_id, created_at DESC) WHERE post_id IS NOT NULL;
CREATE INDEX idx_likes_reel ON likes (reel_id, created_at DESC) WHERE reel_id IS NOT NULL;
CREATE INDEX idx_likes_comment ON likes (comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_likes_user ON likes (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION likes_counter() RETURNS trigger AS $$
DECLARE
  delta INTEGER;
  r likes%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := 1; r := NEW; ELSE delta := -1; r := OLD; END IF;
  IF r.post_id IS NOT NULL THEN
    UPDATE posts SET likes_count = GREATEST(likes_count + delta, 0) WHERE id = r.post_id;
  ELSIF r.reel_id IS NOT NULL THEN
    UPDATE reels SET likes_count = GREATEST(likes_count + delta, 0) WHERE id = r.reel_id;
  ELSE
    UPDATE comments SET likes_count = GREATEST(likes_count + delta, 0) WHERE id = r.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_likes_counter AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION likes_counter();

-- ---------------------------------------------------------------- saves
CREATE TABLE saves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id    UUID REFERENCES reels(id) ON DELETE CASCADE,
  collection VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id) = 1)
);
CREATE UNIQUE INDEX uq_saves_post ON saves (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_saves_reel ON saves (user_id, reel_id) WHERE reel_id IS NOT NULL;
CREATE INDEX idx_saves_user ON saves (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION saves_counter() RETURNS trigger AS $$
DECLARE
  delta INTEGER;
  r saves%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := 1; r := NEW; ELSE delta := -1; r := OLD; END IF;
  IF r.post_id IS NOT NULL THEN
    UPDATE posts SET saves_count = GREATEST(saves_count + delta, 0) WHERE id = r.post_id;
  ELSE
    UPDATE reels SET saves_count = GREATEST(saves_count + delta, 0) WHERE id = r.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_saves_counter AFTER INSERT OR DELETE ON saves
  FOR EACH ROW EXECUTE FUNCTION saves_counter();

-- ---------------------------------------------------------------- mentions
CREATE TABLE mentions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id           UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id           UUID REFERENCES reels(id) ON DELETE CASCADE,
  comment_id        UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id, comment_id) = 1)
);
CREATE INDEX idx_mentions_user ON mentions (mentioned_user_id, created_at DESC);

-- ---------------------------------------------------------------- hidden content (feed "hide post")
CREATE TABLE hidden_content (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id    UUID REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id) = 1)
);
CREATE UNIQUE INDEX uq_hidden_post ON hidden_content (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_hidden_reel ON hidden_content (user_id, reel_id) WHERE reel_id IS NOT NULL;

-- ---------------------------------------------------------------- stories
-- A cleanup job deletes expired rows (and their cloud media) after expires_at.
CREATE TABLE stories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type       media_type NOT NULL,
  media_url        TEXT NOT NULL,
  media_public_id  TEXT,
  thumbnail_url    TEXT,
  duration_seconds NUMERIC(6,2),
  caption          VARCHAR(200),
  audience         story_audience NOT NULL DEFAULT 'everyone',
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stories_user_expires ON stories (user_id, expires_at DESC);
CREATE INDEX idx_stories_expires ON stories (expires_at);

CREATE TABLE story_views (
  story_id  UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);
CREATE INDEX idx_story_views_viewer ON story_views (viewer_id, viewed_at DESC);
