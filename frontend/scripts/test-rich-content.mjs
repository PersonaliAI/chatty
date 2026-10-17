import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRichContent as parseApp,
  parseVisitorMessageContent as parseVisitorApp,
  formatMessagePreview as formatPreviewApp,
} from "../src/lib/rich-content.ts";
import {
  parseRichContent as parsePackage,
  parseVisitorMessageContent as parseVisitorPackage,
  formatMessagePreview as formatPreviewPackage,
} from "../packages/chatty-react/src/rich-content.ts";

for (const [parseRichContent, parseVisitorMessageContent, formatMessagePreview] of [
  [parseApp, parseVisitorApp, formatPreviewApp],
  [parsePackage, parseVisitorPackage, formatPreviewPackage],
]) {
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

  test(`${parseRichContent.name} detects [EMAIL_CAPTURED] token`, () => {
    const emailData = { email: "alice@example.com", name: "Alice Johnson" };
    const raw = `Thanks Alice! We received your details. [EMAIL_CAPTURED:${JSON.stringify(emailData)}]`;
    const result = parseRichContent(raw);
    assert.equal(result.cleanContent, "Thanks Alice! We received your details.");
    assert.deepEqual(result.emailCaptured, emailData);
  });

  test(`${parseRichContent.name} detects [BOOKING_CONFIRMED] token`, () => {
    const bookingData = {
      meeting_link: "https://meet.google.com/abc-defg-hij",
      formatted_time: "Friday, October 24, 2026 at 10:00 AM EDT",
      attendee_name: "Alice Johnson",
      attendee_email: "alice@example.com",
      summary: "Product Demo",
    };
    const raw = `Your demo is scheduled! [BOOKING_CONFIRMED:${JSON.stringify(bookingData)}]`;
    const result = parseRichContent(raw);
    assert.equal(result.cleanContent, "Your demo is scheduled!");
    assert.equal(result.bookingConfirmed?.formatted_time, bookingData.formatted_time);
    assert.equal(result.bookingConfirmed?.meeting_link, bookingData.meeting_link);
  });

  test(`${parseRichContent.name} detects [LIVE_AGENT_REQUESTED] token`, () => {
    const raw = "Connecting you with our support team now... [LIVE_AGENT_REQUESTED]";
    const result = parseRichContent(raw);
    assert.equal(result.cleanContent, "Connecting you with our support team now...");
    assert.equal(result.isLiveHandoffAck, true);
  });

  test(`${parseVisitorMessageContent.name} parses live handoff request and offline ticket`, () => {
    const liveReq = parseVisitorMessageContent("[Visitor requested live agent]");
    assert.equal(liveReq.cleanText, "I would like to speak to a human agent");
    assert.equal(liveReq.isLiveHandoffRequest, true);
    assert.equal(liveReq.isSyntheticHidden, false);

    const ticketRaw = "[Offline Support Ticket]\nName: Bob\nEmail: bob@example.com\nMessage: Please call me back.";
    const ticket = parseVisitorMessageContent(ticketRaw);
    assert.equal(ticket.cleanText, "Please call me back.");
    assert.equal(ticket.offlineTicket?.name, "Bob");
    assert.equal(ticket.offlineTicket?.email, "bob@example.com");
    assert.equal(ticket.offlineTicket?.message, "Please call me back.");

    const syntheticBooking = parseVisitorMessageContent("[Calendar booking offered: Select a time]");
    assert.equal(syntheticBooking.isSyntheticHidden, true);
    assert.equal(syntheticBooking.cleanText, "");
  });

  test(`${formatMessagePreview.name} formats snippets cleanly without raw tokens`, () => {
    assert.equal(
      formatMessagePreview("[Visitor requested live agent]"),
      "I would like to speak to a human agent"
    );
    assert.equal(
      formatMessagePreview("Connecting you with our support team now... [LIVE_AGENT_REQUESTED]"),
      "Connecting you with our support team now..."
    );
    assert.equal(
      formatMessagePreview(`Thanks! [EMAIL_CAPTURED:${JSON.stringify({ email: "test@example.com" })}]`),
      "Thanks!"
    );
    assert.equal(
      formatMessagePreview("[Calendar booking offered: Pick a slot for your demo]"),
      "Pick a slot for your demo"
    );
  });
}

