import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { authorSelect } from "@/lib/queries";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    include: {
      author: { select: authorSelect },
      comments: {
        include: {
          author: { select: authorSelect },
        },
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const author = await getUser(request);

  if (!author) {
    return NextResponse.json(
      { error: "No user found. Please create a user first." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { error: "content is required and must be a string." },
      { status: 400 }
    );
  }

  const idea = await prisma.idea.create({
    data: {
      content,
      authorId: author.id,
    },
    include: {
      author: { select: authorSelect },
    },
  });

  return NextResponse.json(idea, { status: 201 });
}
