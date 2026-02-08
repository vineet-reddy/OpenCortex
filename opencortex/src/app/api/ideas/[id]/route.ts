import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      author: true,
      comments: {
        include: {
          author: true,
          replies: {
            include: {
              author: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      linkedPapers: {
        include: {
          paper: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: { comments: true },
      },
    },
  });

  if (!idea) {
    return NextResponse.json(
      { error: "Idea not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(idea);
}
