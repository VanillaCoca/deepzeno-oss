import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";
import { irErrorToResponse } from "@/lib/ir/api";
import { listIRNodesForUser } from "@/lib/ir/queries";
import type { IRStatus } from "@/lib/ir/types";

const querySchema = z.object({
  project_id: z.string().uuid(),
  q: z.string().trim().min(1).max(200),
});

// Search the project's reasoning content (truths + candidates + ideas) across
// ALL topics. The DB does a case-insensitive match over title/content/rationale.
const SEARCH_STATUSES: IRStatus[] = ["active", "pending", "idea"];

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const input = querySchema.parse({
      project_id: searchParams.get("project_id"),
      q: searchParams.get("q"),
    });

    const lists = await Promise.all(
      SEARCH_STATUSES.map((status) =>
        listIRNodesForUser({
          userId: session.user.id,
          projectId: input.project_id,
          status,
          query: input.q,
        })
      )
    );

    const results = lists.flat();

    return Response.json({ results });
  } catch (error) {
    return irErrorToResponse(error, "IR search failed");
  }
}
