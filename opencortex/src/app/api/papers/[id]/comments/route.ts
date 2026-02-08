import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getUser(request: Request) {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey) {
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (user) return user;
  }

  return prisma.user.findFirst();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "No user found. Create a user first." },
        { status: 401 }
      );
    }

    const paper = await prisma.paper.findUnique({ where: { id } });

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { content, lineNumber, anchorText } = body;

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.paperComment.create({
      data: {
        content,
        lineNumber: lineNumber ?? null,
        anchorText: anchorText ?? null,
        paperId: id,
        authorId: user.id,
      },
      include: {
        author: true,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
