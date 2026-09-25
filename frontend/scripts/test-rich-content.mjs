import test from "node:test";
import assert from "node:assert/strict";
import { parseRichContent as parseApp } from "../src/lib/rich-content.ts";
import { parseRichContent as parsePackage } from "../packages/chatty-react/src/rich-content.ts";

for (const parseRichContent of [parseApp, parsePackage]) {
  test(`${parseRichContent.name} extracts nested multi-card payloads`, () => {
    const content = [
      "Here are two matches:",
      `[PRODUCT_CARD:${JSON.stringify({ id: "one", title: "One", metadata: { tags: ["a", "b"], label: "brace } in text" } })}]`,
      `[PRODUCT_CARD:${JSON.stringify({ id: "two", title: "Two", metadata: { price: { amount: 10, currency: "USD" } } })}]`,
      `[VIDEO_CLIP:${JSON.stringify({ video_url: "https://example.com/demo.mp4", metadata: { chapters: [{ start: 0 }] } })}]`,
      "[BOOKING_WIDGET]",
    ].join(" ");
    const result = parseRichContent(content);
    assert.equal(result.products.length, 2);
    assert.equal(result.videoClips.length, 1);
    assert.equal(result.products[0].metadata.tags[1], "b");
    assert.equal(result.videoClips[0].metadata.chapters[0].start, 0);
    assert.equal(result.cleanContent, "Here are two matches:");
  });

  test(`${parseRichContent.name} preserves malformed markers`, () => {
    const result = parseRichContent("Before [PRODUCT_CARD:{broken] after");
    assert.equal(result.products.length, 0);
    assert.match(result.cleanContent, /\[PRODUCT_CARD:/);
  });
}
