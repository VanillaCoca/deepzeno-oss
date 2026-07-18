/**
 * Live smoke test: seed the example projects into the borrowed owner's
 * library, verify the immigration example's graph + research artifacts, then
 * delete everything that was created. Pre-watchtower-migration databases are
 * tolerated: the watch + alert are expected to be skipped with a warning.
 *
 * Run:
 *   NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/smoke-example-seed.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getSupabaseAdminClient } = await import("../lib/supabase/admin");
  const { seedExampleProjectsForUser } = await import(
    "../lib/workspace/example-projects"
  );
  const { deleteProjectForUser, listProjectsByUserId } = await import(
    "../lib/workspace/queries"
  );

  // biome-ignore lint/suspicious/noExplicitAny: untyped admin client.
  const db = getSupabaseAdminClient() as any;

  const { data: anyProject } = await db
    .from("projects")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  if (!anyProject) {
    console.error("No existing user to borrow.");
    process.exit(1);
  }
  const userId = String(anyProject.user_id);

  const before = new Set(
    (await listProjectsByUserId(userId)).map((p: { id: string }) => p.id)
  );

  await seedExampleProjectsForUser({ userId });

  const after = await listProjectsByUserId(userId);
  const created = after.filter((p: { id: string }) => !before.has(p.id));
  console.log(
    "created projects:",
    created.map((p: { name: string }) => p.name)
  );

  const immigration = created.find((p: { name: string }) =>
    p.name.includes("全家移民规划")
  );

  let failed = false;
  try {
    if (!immigration) {
      throw new Error("immigration example was not seeded");
    }

    const { data: nodes } = await db
      .from("ir_nodes")
      .select("id,kind,status,title,source_layer")
      .eq("project_id", immigration.id);
    const { data: edges } = await db
      .from("ir_edges")
      .select("relation,label")
      .eq("project_id", immigration.id);
    const { data: runs } = await db
      .from("research_run")
      .select("id,status,brief")
      .eq("project_id", immigration.id);
    const { data: evidence } = await db
      .from("evidence")
      .select("id,stance,url")
      .eq("project_id", immigration.id);
    const { data: watches } = await db
      .from("ir_watches")
      .select("id,cadence,status")
      .eq("project_id", immigration.id);

    const labeled = (edges ?? []).filter(
      (e: { label: string | null }) => e.label
    );
    const alert = (nodes ?? []).find(
      (n: { source_layer: string }) => n.source_layer === "watchtower"
    );

    console.log("nodes:", nodes?.length, "edges:", edges?.length);
    console.log(
      "labeled edges:",
      labeled.length,
      "runs:",
      runs?.length,
      "evidence:",
      evidence?.length
    );
    console.log(
      "watches:",
      watches === null ? "TABLE MISSING (migration pending)" : watches.length
    );
    console.log(
      "watchtower alert node:",
      alert ? alert.id : "absent (migration pending?)"
    );

    if ((nodes?.length ?? 0) < 18) {
      throw new Error(`expected ≥18 nodes, got ${nodes?.length}`);
    }
    if (labeled.length < 10) {
      throw new Error(`expected ≥10 labeled edges, got ${labeled.length}`);
    }
    if ((runs?.length ?? 0) < 1 || (evidence?.length ?? 0) < 3) {
      throw new Error(
        "expected the pre-baked research run with ≥3 evidence rows"
      );
    }
    console.log(
      "PASS: immigration example seeds with labeled dependency edges + research artifacts."
    );
  } catch (error) {
    failed = true;
    console.error("FAIL:", error instanceof Error ? error.message : error);
  } finally {
    for (const project of created) {
      try {
        await deleteProjectForUser(project.id, userId);
      } catch (error) {
        console.error(`cleanup failed for ${project.id}:`, error);
        failed = true;
      }
    }
    console.log(`cleaned up ${created.length} seeded project(s)`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
