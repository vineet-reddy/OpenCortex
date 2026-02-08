import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getAuthor(request: Request) {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey) {
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (user) return user;
  }

  // Fallback: use the first user in the database (for the web UI)
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  return firstUser;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const author = await getAuthor(request);

  if (!author) {
    return NextResponse.json(
      { error: "No user found. Please create a user first." },
      { status: 401 }
    );
  }

  // Verify the idea exists
  const idea = await prisma.idea.findUnique({ where: { id } });

  if (!idea) {
    return NextResponse.json(
      { error: "Idea not found." },
      { status: 404 }
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

  const comment = await prisma.ideaComment.create({
    data: {
      content,
      ideaId: id,
      authorId: author.id,
    },
    include: {
      author: true,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
