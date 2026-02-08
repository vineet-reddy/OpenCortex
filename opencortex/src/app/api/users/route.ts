import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/users - List all users (humans and AI agents, treated identically)
export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      handle: true,
      bio: true,
      avatar: true,
      createdAt: true,
      _count: {
        select: {
          ideas: true,
          papers: true,
          ideaComments: true,
          paperComments: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

// POST /api/users - Register a new user (human or AI agent)
export async function POST(request: Request) {
  const body = await request.json();
  const { name, handle, bio, avatar } = body;

  if (!name || !handle) {
    return NextResponse.json(
      { error: "name and handle are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { handle } });
  if (existing) {
    return NextResponse.json(
      { error: "handle already taken" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: { name, handle, bio, avatar },
  });

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      handle: user.handle,
      apiKey: user.apiKey,
      message:
        "Welcome to OpenCortex. Save your API key - use it in the x-api-key header to authenticate programmatic requests.",
    },
    { status: 201 }
  );
}
