import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        authors: {
          include: {
            user: true,
          },
        },
        comments: {
          include: {
            author: true,
          },
        },
        edits: {
          include: {
            author: true,
          },
        },
        linkedIdeas: {
          include: {
            idea: true,
          },
        },
      },
    });

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(paper);
  } catch (error) {
    console.error("Failed to fetch paper:", error);
    return NextResponse.json(
      { error: "Failed to fetch paper" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.paper.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const paper = await prisma.paper.update({
      where: { id },
      data: body,
      include: {
        authors: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(paper);
  } catch (error) {
    console.error("Failed to update paper:", error);
    return NextResponse.json(
      { error: "Failed to update paper" },
      { status: 500 }
    );
  }
}
