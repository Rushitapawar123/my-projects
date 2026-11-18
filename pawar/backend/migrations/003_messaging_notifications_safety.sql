-- 003: messaging, notifications, safety, reports, search, creator insights

CREATE TYPE message_type       AS ENUM ('text', 'image', 'video', 'voice', 'story_reply', 'system');
CREATE TYPE participant_role   AS ENUM ('member', 'admin');
CREATE TYPE request_status     AS ENUM ('accepted', 'pending', 'declined');
CREATE TYPE notification_type  AS ENUM (
  'like_post', 'like_reel', 'like_comment', 'comment', 'reply',
  'follow', 'follow_request', 'follow_accept', 'mention',
  'story_reply', 'message', 'message_request'
);
CREATE TYPE report_target      AS ENUM ('user', 'post', 'reel', 'comment', 'story', 'message');
CREATE TYPE report_status      AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- ---------------------------------------------------------------- conversations
-- direct_key = "<smaller user id>:<larger user id>" for 1:1 chats (prevents duplicates). NULL for groups.
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  direct_key      TEXT UNIQUE,
  name            VARCHAR(100),
  avatar_url      TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((is_group AND direct_key IS NULL) OR (NOT is_group AND direct_key IS NOT NULL))
);
CREATE INDEX idx_conversations_last_message ON conversations (last_message_at DESC);

CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  type                message_type NOT NULL DEFAULT 'text',
  body                VARCHAR(5000),
  media_url           TEXT,
  media_public_id     TEXT,
  media_thumbnail_url TEXT,
  media_duration      NUMERIC(6,2),
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  story_id            UUID REFERENCES stories(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NOT NULL OR media_url IS NOT NULL OR type = 'system')
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC, id DESC);

-- Read receipts: a participant has read everything up to last_read_message_id / last_read_at.
CREATE TABLE conversation_participants (
  conversation_id      UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                 participant_role NOT NULL DEFAULT 'member',
  request_status       request_status NOT NULL DEFAULT 'accepted',
  is_muted             BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ,
  joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at              TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_participants_user ON conversation_participants (user_id, request_status);

CREATE TABLE message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE OR REPLACE FUNCTION touch_conversation() RETURNS trigger AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_touch_conversation AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_conversation();

-- ---------------------------------------------------------------- notifications
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id         UUID REFERENCES reels(id) ON DELETE CASCADE,
  comment_id      UUID REFERENCES comments(id) ON DELETE CASCADE,
  story_id        UUID REFERENCES stories(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  data            JSONB NOT NULL DEFAULT '{}',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id) WHERE is_read = FALSE;

-- ---------------------------------------------------------------- privacy and safety
CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);

CREATE TABLE mutes (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mute_posts   BOOLEAN NOT NULL DEFAULT TRUE,
  mute_stories BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, muted_id),
  CHECK (user_id <> muted_id)
);

CREATE TABLE restricts (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restricted_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, restricted_id),
  CHECK (user_id <> restricted_id)
);

CREATE TABLE comment_filters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword    CITEXT NOT NULL CHECK (length(keyword) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, keyword)
);

-- ---------------------------------------------------------------- reports and moderation
-- target_id points at a row in the table named by target_type (no FK on purpose,
-- so evidence survives even if the content is deleted).
CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type      report_target NOT NULL,
  target_id        UUID NOT NULL,
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason           VARCHAR(60) NOT NULL,
  details          VARCHAR(1000),
  status           report_status NOT NULL DEFAULT 'open',
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX idx_reports_target ON reports (target_type, target_id);
CREATE INDEX idx_reports_reported_user ON reports (reported_user_id);

CREATE TABLE moderation_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(40) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id   UUID NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_moderation_actions_created ON moderation_actions (created_at DESC);

-- ---------------------------------------------------------------- search
CREATE TABLE recent_searches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term             VARCHAR(100) NOT NULL,
  searched_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, term)
);
CREATE INDEX idx_recent_searches_user ON recent_searches (user_id, created_at DESC);

-- ---------------------------------------------------------------- creator insights
CREATE TABLE profile_views (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profile_views_profile ON profile_views (profile_id, created_at DESC);

-- impressions = rows, reach = distinct viewer_id
CREATE TABLE content_impressions (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id   UUID REFERENCES posts(id) ON DELETE CASCADE,
  reel_id   UUID REFERENCES reels(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(post_id, reel_id) = 1)
);
CREATE INDEX idx_impressions_owner ON content_impressions (owner_id, created_at DESC);
