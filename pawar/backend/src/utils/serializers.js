// Converts DB rows (snake_case) to API objects (camelCase). Never expose password_hash or secrets.
const toSelfUser = (r) => ({
  id: r.id,
  email: r.email,
  username: r.username,
  fullName: r.full_name,
  bio: r.bio,
  website: r.website,
  avatarUrl: r.avatar_url,
  isPrivate: r.is_private,
  accountType: r.account_type,
  category: r.category,
  role: r.role,
  twoFactorEnabled: r.two_factor_enabled,
  emailVerified: Boolean(r.email_verified_at),
  followersCount: r.followers_count,
  followingCount: r.following_count,
  postsCount: r.posts_count,
  createdAt: r.created_at,
});

module.exports = { toSelfUser };
