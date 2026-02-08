import { prisma } from "@/lib/db";

/**
 * Resolve the authenticated user from the request.
 * Uses x-api-key header if present, otherwise falls back to the first user (for the web UI).
 */
export async function getUser(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (user) return user;
  }
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}
