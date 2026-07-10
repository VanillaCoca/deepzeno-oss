// Source-reliability scoring for research evidence. Pure and deterministic:
// a URL maps to a score in [0, 1] plus the band that produced it. The collect
// phase spends its fetch budget on high-score URLs first, the score is stored
// on each evidence row, and the judge phase is told not to let low-score
// sources be the sole support for a candidate.
//
// This is a heuristic prior on the *source*, not a verdict on the *claim* —
// quote verification (text.ts) remains the hard gate.

export type SourceBand =
  | "official" // government, standards bodies
  | "academic" // universities, journals, preprint servers
  | "docs" // vendor/product documentation
  | "reference" // encyclopedias, major wire services, primary code hosts
  | "general" // everything else
  | "ugc" // user-generated content platforms
  | "low" // link shorteners, unresolvable
  | "invalid"; // unparseable URL

export type SourceScore = {
  score: number;
  band: SourceBand;
};

const BAND_SCORES: Record<SourceBand, number> = {
  official: 0.95,
  academic: 0.9,
  docs: 0.8,
  reference: 0.7,
  general: 0.5,
  ugc: 0.35,
  low: 0.15,
  invalid: 0,
};

const OFFICIAL_DOMAINS = ["w3.org", "ietf.org", "iso.org", "nist.gov"];

const ACADEMIC_DOMAINS = [
  "arxiv.org",
  "acm.org",
  "ieee.org",
  "nature.com",
  "science.org",
  "sciencedirect.com",
  "springer.com",
  "jstor.org",
  "nih.gov",
  "semanticscholar.org",
];

const REFERENCE_DOMAINS = [
  "wikipedia.org",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "ft.com",
  "economist.com",
  "nytimes.com",
  "github.com",
  "gitlab.com",
];

const UGC_DOMAINS = [
  "reddit.com",
  "quora.com",
  "zhihu.com",
  "medium.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
];

const SHORTENER_DOMAINS = [
  "bit.ly",
  "t.co",
  "goo.gl",
  "tinyurl.com",
  "ow.ly",
  "buff.ly",
];

// Non-https transport is a mild negative signal, applied after band lookup.
const HTTP_PENALTY = 0.1;

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchesAny(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostMatches(hostname, domain));
}

function classify(url: URL): SourceBand {
  const hostname = url.hostname.toLowerCase();

  if (matchesAny(hostname, SHORTENER_DOMAINS)) {
    return "low";
  }

  // Government / standards: explicit list plus gov TLD conventions.
  if (
    matchesAny(hostname, OFFICIAL_DOMAINS) ||
    hostname.endsWith(".gov") ||
    hostname.includes(".gov.")
  ) {
    return "official";
  }

  if (
    matchesAny(hostname, ACADEMIC_DOMAINS) ||
    hostname.endsWith(".edu") ||
    hostname.includes(".edu.") ||
    hostname.endsWith(".ac.uk")
  ) {
    return "academic";
  }

  if (matchesAny(hostname, UGC_DOMAINS)) {
    return "ugc";
  }

  if (matchesAny(hostname, REFERENCE_DOMAINS)) {
    return "reference";
  }

  // Vendor documentation: docs./developer. subdomains or a /docs path.
  if (
    hostname.startsWith("docs.") ||
    hostname.startsWith("developer.") ||
    hostname.startsWith("developers.") ||
    url.pathname === "/docs" ||
    url.pathname.startsWith("/docs/")
  ) {
    return "docs";
  }

  return "general";
}

export function scoreSource(rawUrl: string): SourceScore {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { score: 0, band: "invalid" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { score: 0, band: "invalid" };
  }

  const band = classify(url);
  const penalty = url.protocol === "http:" ? HTTP_PENALTY : 0;
  const score = Math.min(1, Math.max(0, BAND_SCORES[band] - penalty));

  return { score, band };
}

// Stable sort by descending score — the collect phase consumes its fetch
// budget in this order so high-reliability sources are read first.
export function rankBySourceScore(urls: string[]): string[] {
  return urls
    .map((url, index) => ({ url, index, score: scoreSource(url).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.url);
}
