/**
 * One-off backfill: seed the Coze Coding example into EXISTING users'
 * libraries. New signups get it automatically (it is in EXAMPLE_PROJECTS),
 * but users who already have projects never re-enter that path.
 *
 * Deliberately NOT wired into any login path. The login-time seeder only
 * fires for users with zero projects, which is what guarantees "delete an
 * example and it stays deleted". Backfilling on login would break that.
 *
 * Behaviour:
 *   - Skips users with zero projects — they get the full set on next login.
 *   - Idempotent by exact project name (projects carry no slug column).
 *   - The owner gets the personal variant instead of the official one, so
 *     their library reads as real work rather than a showcase.
 *
 * Run:
 *   NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/backfill-coze-example.ts --dry-run
 *   NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/backfill-coze-example.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const SLUG = "zh-coze-coding";
const PERSONAL_EMAIL = "seanmingze@gmail.com";
const PAGE_SIZE = 1000;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { getSupabaseAdminClient } = await import("../lib/supabase/admin");
  const { getIRPrefix } = await import("../lib/ir/types");
  const { EXAMPLE_PROJECTS } = await import("../lib/workspace/example-content");
  const { seedOneExampleProject } = await import(
    "../lib/workspace/example-projects"
  );
  const { listProjectsByUserId } = await import("../lib/workspace/queries");

  // biome-ignore lint/suspicious/noExplicitAny: untyped admin client.
  const db = getSupabaseAdminClient() as any;

  const spec = EXAMPLE_PROJECTS.find((project) => project.slug === SLUG);
  if (!spec) {
    console.error(`spec "${SLUG}" not found`);
    process.exit(1);
  }

  // Fresh allocator per run; re-created on a primary-key collision so a
  // concurrent insert elsewhere does not abort the whole backfill.
  const makeAllocator = () => {
    const counters = new Map<string, number>();
    return async (kind: string, subtype?: string) => {
      const prefix = getIRPrefix(kind as never, subtype as never);
      if (!counters.has(prefix)) {
        const { data } = await db
          .from("ir_nodes")
          .select("id")
          .like("id", `${prefix}%`);
        let max = 0;
        const pattern = new RegExp(`^${prefix}(\\d+)$`);
        for (const row of data ?? []) {
          const match = String(row.id).match(pattern);
          if (match) {
            max = Math.max(max, Number(match[1]));
          }
        }
        counters.set(prefix, max);
      }
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}${next}`;
    };
  };

  let nextId = makeAllocator();
  const stats = { seeded: 0, skipped: 0, noProjects: 0, failed: 0 };

  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) {
      console.error("listUsers failed", error);
      process.exit(1);
    }
    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      const existing = await listProjectsByUserId(user.id);
      if (existing.length === 0) {
        // Untouched account: the login-time seeder gives them everything.
        stats.noProjects += 1;
        continue;
      }

      const isOwner =
        (user.email ?? "").toLowerCase() === PERSONAL_EMAIL.toLowerCase();
      const variant = isOwner ? "personal" : "official";
      const targetName =
        isOwner && spec.personalName ? spec.personalName : spec.name;
      const names = new Set(existing.map((p: { name: string }) => p.name));

      if (names.has(targetName)) {
        stats.skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] would seed "${targetName}" → ${user.email}`);
        stats.seeded += 1;
        continue;
      }

      const nowDate = new Date();
      try {
        await seedOneExampleProject({
          userId: user.id,
          userEmail: user.email ?? null,
          spec,
          nextId: nextId as never,
          nowDate,
          nowIso: nowDate.toISOString(),
          variant,
        });
        stats.seeded += 1;
        console.log(`seeded "${targetName}" → ${user.email}`);
      } catch (seedError) {
        const message =
          seedError instanceof Error ? seedError.message : String(seedError);
        // 23505 = duplicate key: another writer advanced the id sequence.
        // Rebuild the allocator from the current max and retry once.
        if (message.includes("23505") || message.includes("duplicate key")) {
          nextId = makeAllocator();
          try {
            const retryDate = new Date();
            await seedOneExampleProject({
              userId: user.id,
              userEmail: user.email ?? null,
              spec,
              nextId: nextId as never,
              nowDate: retryDate,
              nowIso: retryDate.toISOString(),
              variant,
            });
            stats.seeded += 1;
            console.log(`seeded (after retry) "${targetName}" → ${user.email}`);
            continue;
          } catch (retryError) {
            console.error(`retry failed for ${user.email}`, retryError);
          }
        } else {
          console.error(`seed failed for ${user.email}`, seedError);
        }
        stats.failed += 1;
      }
    }

    if (users.length < PAGE_SIZE) {
      break;
    }
  }

  console.log(dryRun ? "\n--- DRY RUN ---" : "\n--- DONE ---");
  console.log(stats);
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
