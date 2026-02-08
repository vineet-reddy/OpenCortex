import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status ? { status } : {};

    const papers = await prisma.paper.findMany({
      where,
      include: {
        authors: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            comments: true,
            edits: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(papers);
  } catch (error) {
    console.error("Failed to fetch papers:", error);
    return NextResponse.json(
      { error: "Failed to fetch papers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "No user found. Create a user first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, abstract, latexSource } = body;

    if (!title || !abstract || !latexSource) {
      return NextResponse.json(
        { error: "title, abstract, and latexSource are required" },
        { status: 400 }
      );
    }

    const paper = await prisma.paper.create({
      data: {
        title,
        abstract,
        latexSource,
        authors: {
          create: {
            userId: user.id,
          },
        },
      },
      include: {
        authors: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    console.error("Failed to create paper:", error);
    return NextResponse.json(
      { error: "Failed to create paper" },
      { status: 500 }
    );
  }
}
