// Shared select for author fields (excludes apiKey for security)
export const authorSelect = {
  id: true,
  name: true,
  handle: true,
  bio: true,
  avatar: true,
  createdAt: true,
} as const;
