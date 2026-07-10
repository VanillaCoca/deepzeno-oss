import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rankBySourceScore,
  scoreSource,
} from "../../lib/research/source-score.ts";

describe("scoreSource", () => {
  it("rates government and standards bodies highest", () => {
    assert.ok(scoreSource("https://www.nist.gov/report").score >= 0.9);
    assert.ok(scoreSource("https://www.w3.org/TR/webauthn-2/").score >= 0.9);
  });

  it("rates academic sources as high-reliability", () => {
    assert.ok(scoreSource("https://arxiv.org/abs/2401.00001").score >= 0.85);
    assert.ok(scoreSource("https://web.mit.edu/paper.html").score >= 0.85);
  });

  it("boosts official documentation over general pages", () => {
    const docs = scoreSource("https://docs.example.com/guide").score;
    const docsPath = scoreSource("https://example.com/docs/guide").score;
    const general = scoreSource("https://example.com/blog/post").score;
    assert.ok(docs > general);
    assert.ok(docsPath > general);
  });

  it("rates UGC platforms below general pages", () => {
    const ugc = scoreSource("https://www.reddit.com/r/nextjs/abc").score;
    const general = scoreSource("https://example.com/article").score;
    assert.ok(ugc < general);
  });

  it("matches known domains on subdomains too", () => {
    assert.equal(
      scoreSource("https://en.wikipedia.org/wiki/TCP").band,
      "reference"
    );
  });

  it("rates link shorteners as lowest reliability", () => {
    assert.ok(scoreSource("https://bit.ly/3xyz").score <= 0.25);
  });

  it("penalizes plain http relative to https", () => {
    const https = scoreSource("https://example.com/a").score;
    const http = scoreSource("http://example.com/a").score;
    assert.ok(http < https);
  });

  it("returns zero for unparseable URLs", () => {
    assert.equal(scoreSource("not a url").score, 0);
  });

  it("orders URLs by descending score, stable within equal scores", () => {
    const ranked = rankBySourceScore([
      "https://www.reddit.com/r/a",
      "https://example.com/first",
      "https://docs.vendor.com/api",
      "https://example.com/second",
      "https://www.nist.gov/report",
    ]);

    assert.deepEqual(ranked, [
      "https://www.nist.gov/report",
      "https://docs.vendor.com/api",
      "https://example.com/first",
      "https://example.com/second",
      "https://www.reddit.com/r/a",
    ]);
  });

  it("always returns a score within [0, 1]", () => {
    for (const url of [
      "https://www.nist.gov/x",
      "http://bit.ly/x",
      "https://docs.python.org/3/",
      "http://reddit.com/x",
    ]) {
      const { score } = scoreSource(url);
      assert.ok(score >= 0 && score <= 1, `${url} → ${score}`);
    }
  });
});
