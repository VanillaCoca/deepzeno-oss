"use client";

import { useEffect, useState } from "react";

// Time-aware hero greeting. The greeting strings are translated on the server
// (homepage translator) and passed in; the time-of-day choice happens on the
// client so it follows the user's local clock, not the server's timezone.
// We start with no greeting (just the name) so the server and first client
// render match, then resolve the greeting after mount — no hydration mismatch.
export function HomeGreeting({
  name,
  greetings,
}: {
  name: string;
  greetings: { morning: string; afternoon: string; evening: string };
}) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting(greetings.morning);
    } else if (hour >= 12 && hour < 18) {
      setGreeting(greetings.afternoon);
    } else {
      setGreeting(greetings.evening);
    }
  }, [greetings]);

  return (
    <h1
      className="text-3xl text-foreground tracking-tight sm:text-[2.5rem]"
      style={{ fontFamily: "var(--font-averia)" }}
    >
      {greeting ? `${greeting}, ${name}` : name}
    </h1>
  );
}
