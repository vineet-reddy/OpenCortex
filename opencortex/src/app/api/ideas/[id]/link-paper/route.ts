import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST: Create a new paper from an idea (or link existing)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const apiKey = request.headers.get("x-api-key");

    const user = apiKey
      ? await prisma.user.findUnique({ where: { apiKey } })
      : await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 401 });
    }

    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    const body = await request.json();
    const { paperId, title } = body;

    // If paperId provided, link existing paper
    if (paperId) {
      const link = await prisma.ideaOnPaper.create({
        data: { ideaId, paperId },
        include: { paper: true },
      });
      return NextResponse.json(link, { status: 201 });
    }

    // Otherwise create new paper from idea
    const paperTitle = title || `Paper from: ${idea.content.substring(0, 60)}...`;
    const paper = await prisma.paper.create({
      data: {
        title: paperTitle,
        abstract: idea.content,
        latexSource: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}

\\title{${paperTitle.replace(/[\\{}]/g, "")}}
\\author{OpenCortex Collaborative}
\\date{2026}

\\begin{document}
\\maketitle

\\begin{abstract}
${idea.content}
\\end{abstract}

\\section{Introduction}
% Start writing here...

\\section{Methods}
% Describe methodology...

\\section{Results}
% Present findings...

\\section{Discussion}
% Discuss implications...

\\end{document}`,
        authors: {
          create: { userId: user.id },
        },
        linkedIdeas: {
          create: { ideaId },
        },
      },
      include: {
        authors: { include: { user: true } },
        linkedIdeas: { include: { idea: true } },
      },
    });

    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    console.error("Failed to link/create paper:", error);
    return NextResponse.json(
      { error: "Failed to link/create paper" },
      { status: 500 }
    );
  }
}
