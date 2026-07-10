// Pure aggregation for the quote-gate evaluation (scripts/eval-research.ts).
//
// The metric: of all evidence items the extraction model proposed, what
// fraction failed verbatim quote verification (verifyQuote)? Without the gate
// those items would have reached the research brief as unverifiable claims;
// with the gate, zero of them do — every dropped item is blocked before the
// judge phase ever sees it.

export type QuestionEvalResult = {
  question: string;
  // Evidence items the extraction model proposed for this question.
  extracted: number;
  // Items whose quote verbatim-matched the fetched page text.
  verified: number;
  // Items rejected by the quote gate (extracted - verified).
  dropped: number;
};

export type QuoteGateStats = {
  totalExtracted: number;
  totalVerified: number;
  totalDropped: number;
  // Fraction of proposed quotes that could not be verified — the rate of
  // unverifiable claims that WOULD enter the brief without the gate.
  // Null when nothing was extracted (no denominator).
  unverifiedRateWithoutGate: number | null;
  perQuestion: Array<QuestionEvalResult & { unverifiedRate: number | null }>;
};

export function computeQuoteGateStats(
  results: QuestionEvalResult[]
): QuoteGateStats {
  let totalExtracted = 0;
  let totalVerified = 0;
  let totalDropped = 0;

  const perQuestion = results.map((result) => {
    totalExtracted += result.extracted;
    totalVerified += result.verified;
    totalDropped += result.dropped;

    return {
      ...result,
      unverifiedRate:
        result.extracted > 0 ? result.dropped / result.extracted : null,
    };
  });

  return {
    totalExtracted,
    totalVerified,
    totalDropped,
    unverifiedRateWithoutGate:
      totalExtracted > 0 ? totalDropped / totalExtracted : null,
    perQuestion,
  };
}

function formatRate(rate: number | null): string {
  return rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;
}

export function formatQuoteGateReport(stats: QuoteGateStats): string {
  const lines: string[] = [
    "| Question | Extracted | Verified | Dropped | Unverified rate |",
    "|---|---|---|---|---|",
  ];

  for (const row of stats.perQuestion) {
    lines.push(
      `| ${row.question} | ${row.extracted} | ${row.verified} | ${row.dropped} | ${formatRate(row.unverifiedRate)} |`
    );
  }

  lines.push(
    "",
    `Aggregate: ${stats.totalExtracted} extracted, ${stats.totalVerified} verified, ${stats.totalDropped} dropped.`,
    `Unverified-claim rate WITHOUT quote gate: ${formatRate(stats.unverifiedRateWithoutGate)}`,
    "Unverified-claim rate WITH quote gate: 0% (every unverifiable quote is blocked before the judge phase)."
  );

  return lines.join("\n");
}
