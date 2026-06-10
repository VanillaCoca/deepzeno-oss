"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CreateProjectModal } from "@/components/create-project-modal";

// Defers the Radix Dialog (CreateProjectModal) until after hydration.
//
// The homepage fetches projects inside a Suspense boundary, so under
// cacheComponents (PPR) that subtree is streamed in as a dynamic hole. Radix
// Dialog derives the trigger's `aria-controls` from `useId`, and the id prefix
// of the streamed server output doesn't line up with the client's, so the
// trigger mismatches and hydration fails (only inside the streamed content —
// the header's modal lives in the prerendered shell and is fine).
//
// Rendering just the plain trigger button on the server + first client paint
// (no Radix, no useId) guarantees an identical tree to hydrate, then we mount
// the real modal a tick later. The button is the same element either way, so
// there's no visual shift; it only becomes interactive a frame after mount.
export function DeferredCreateProject({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <CreateProjectModal>{children}</CreateProjectModal>;
}
