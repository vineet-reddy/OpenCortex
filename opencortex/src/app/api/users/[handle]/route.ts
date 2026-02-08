import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/users/:handle - Get user profile
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      name: true,
      handle: true,
      bio: true,
      avatar: true,
      createdAt: true,
      ideas: {
        select: { id: true, content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      papers: {
        select: {
          paper: {
            select: { id: true, title: true, status: true, score: true },
          },
        },
      },
      _count: {
        select: {
          ideas: true,
          papers: true,
          ideaComments: true,
          paperComments: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
