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
      `[ORDER_CARD:${JSON.stringify({
        order_id: "1042",
        order_number: "1042",
        status: "processing",
        status_label: "Processing",
        total: "129.00",
        is_split_shipment: true,
        is_partial_refund: true,
        refunded_total: "29.00",
        tracking: [
          { carrier: "UPS", tracking_number: "1Z999AA10123456784", tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784" },
          { carrier: "FedEx", tracking_number: "771234567890", tracking_url: "https://www.fedex.com/fedextrack/?trknbr=771234567890" },
        ],
      })}]`,
      "[BOOKING_WIDGET]",
    ].join(" ");
    const result = parseRichContent(content);
    assert.equal(result.products.length, 2);
    assert.equal(result.videoClips.length, 1);
    assert.equal(result.orders.length, 1);
    assert.equal(result.products[0].metadata.tags[1], "b");
    assert.equal(result.videoClips[0].metadata.chapters[0].start, 0);
    assert.equal(result.orders[0].order_number, "1042");
    assert.equal(result.orders[0].is_split_shipment, true);
    assert.equal(result.orders[0].is_partial_refund, true);
    assert.equal(result.orders[0].tracking.length, 2);
    assert.equal(result.cleanContent, "Here are two matches:");
  });

  test(`${parseRichContent.name} preserves malformed markers`, () => {
    const result = parseRichContent("Before [PRODUCT_CARD:{broken] after");
    assert.equal(result.products.length, 0);
    assert.match(result.cleanContent, /\[PRODUCT_CARD:/);
  });

  test(`${parseRichContent.name} detects and cleans [HANDOFF_ACTIONS] marker`, () => {
    const result = parseRichContent("I don't have return policy details in my documentation. Would you like me to connect you with our team?\n\n[HANDOFF_ACTIONS]");
    assert.equal(result.hasHandoffActions, true);
    assert.equal(result.cleanContent, "I don't have return policy details in my documentation. Would you like me to connect you with our team?");
  });
}
