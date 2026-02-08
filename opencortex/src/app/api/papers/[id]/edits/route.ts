import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const paper = await prisma.paper.findUnique({ where: { id } });

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const edits = await prisma.paperEdit.findMany({
      where: { paperId: id },
      include: {
        author: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(edits);
  } catch (error) {
    console.error("Failed to fetch edits:", error);
    return NextResponse.json(
      { error: "Failed to fetch edits" },
      { status: 500 }
    );
  }
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
    const { oldContent, newContent, description } = body;

    if (!oldContent || !newContent) {
      return NextResponse.json(
        { error: "oldContent and newContent are required" },
        { status: 400 }
      );
    }

    const edit = await prisma.paperEdit.create({
      data: {
        oldContent,
        newContent,
        description: description ?? null,
        paperId: id,
        authorId: user.id,
      },
      include: {
        author: true,
      },
    });

    return NextResponse.json(edit, { status: 201 });
  } catch (error) {
    console.error("Failed to create edit:", error);
    return NextResponse.json(
      { error: "Failed to create edit" },
      { status: 500 }
    );
  }
}
