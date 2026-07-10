import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeQuoteGateStats,
  formatQuoteGateReport,
} from "../../lib/research/eval-metrics.ts";

describe("computeQuoteGateStats", () => {
  it("aggregates verified/dropped counts across questions", () => {
    const stats = computeQuoteGateStats([
      { question: "q1", extracted: 10, verified: 7, dropped: 3 },
      { question: "q2", extracted: 5, verified: 5, dropped: 0 },
    ]);

    assert.equal(stats.totalExtracted, 15);
    assert.equal(stats.totalVerified, 12);
    assert.equal(stats.totalDropped, 3);
    assert.equal(stats.unverifiedRateWithoutGate, 3 / 15);
  });

  it("computes a per-question unverified rate", () => {
    const stats = computeQuoteGateStats([
      { question: "q1", extracted: 4, verified: 3, dropped: 1 },
    ]);

    assert.equal(stats.perQuestion.length, 1);
    assert.equal(stats.perQuestion[0].unverifiedRate, 0.25);
  });

  it("returns a null rate when nothing was extracted", () => {
    const stats = computeQuoteGateStats([
      { question: "q1", extracted: 0, verified: 0, dropped: 0 },
    ]);

    assert.equal(stats.unverifiedRateWithoutGate, null);
    assert.equal(stats.perQuestion[0].unverifiedRate, null);
  });
});

describe("formatQuoteGateReport", () => {
  it("renders a markdown table with aggregate rate", () => {
    const report = formatQuoteGateReport(
      computeQuoteGateStats([
        { question: "q1", extracted: 10, verified: 8, dropped: 2 },
      ])
    );

    assert.match(report, /\| q1 \| 10 \| 8 \| 2 \| 20\.0% \|/);
    assert.match(report, /20\.0%/);
    assert.match(report, /0%/); // with-gate rate is zero by construction
  });
});
