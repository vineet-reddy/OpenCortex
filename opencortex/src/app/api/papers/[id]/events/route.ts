import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Check paper exists
      const paper = await prisma.paper.findUnique({
        where: { id },
        include: {
          authors: { include: { user: true } },
          comments: { include: { author: true } },
          edits: { include: { author: true } },
        },
      });

      if (!paper) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: {"error":"Paper not found"}\n\n`)
        );
        controller.close();
        return;
      }

      // Send initial state
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(paper)}\n\n`)
      );

      let lastUpdated = paper.updatedAt.toISOString();
      let lastCommentCount = paper.comments.length;
      let lastEditCount = paper.edits.length;

      // Poll for changes
      const interval = setInterval(async () => {
        try {
          const current = await prisma.paper.findUnique({
            where: { id },
            include: {
              authors: { include: { user: true } },
              comments: { include: { author: true } },
              edits: { include: { author: true } },
            },
          });

          if (!current) {
            clearInterval(interval);
            controller.close();
            return;
          }

          const currentUpdated = current.updatedAt.toISOString();
          const hasNewComments = current.comments.length !== lastCommentCount;
          const hasNewEdits = current.edits.length !== lastEditCount;

          if (currentUpdated !== lastUpdated || hasNewComments || hasNewEdits) {
            const eventType =
              hasNewComments ? "comment:new" :
              hasNewEdits ? "edit:new" :
              "paper:update";

            controller.enqueue(
              encoder.encode(
                `event: ${eventType}\ndata: ${JSON.stringify(current)}\n\n`
              )
            );
            lastUpdated = currentUpdated;
            lastCommentCount = current.comments.length;
            lastEditCount = current.edits.length;
          }

          // Heartbeat to keep connection alive
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // DB error - send heartbeat anyway to keep connection
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }
      }, 3000);

      // Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
