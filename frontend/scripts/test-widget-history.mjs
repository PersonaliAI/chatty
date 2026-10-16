import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeAdjacentWelcomeMessages,
  shouldRenderInlineWelcome,
} from "../src/lib/widget-history.ts";

test("renders the temporary welcome while the thread is empty", () => {
  assert.equal(shouldRenderInlineWelcome([], "Hello!"), true);
});

test("does not duplicate a persisted welcome message", () => {
  assert.equal(
    shouldRenderInlineWelcome([{ role: "assistant", content: " Hello! " }], "Hello!"),
    false,
  );
});

test("does not render inline welcome if first message is any assistant greeting", () => {
  assert.equal(
    shouldRenderInlineWelcome([{ role: "assistant", content: "Hello! I am Chatty, your AI assistant." }], "Hello! How can I help you today?"),
    false,
  );
});

test("keeps the placeholder when history starts with a real turn", () => {
  assert.equal(
    shouldRenderInlineWelcome([{ role: "user", content: "Hi" }], "Hello!"),
    true,
  );
});

test("removes adjacent persisted welcome duplicates", () => {
  const messages = [
    { role: "assistant", content: "Hello!" },
    { role: "assistant", content: " Hello! " },
    { role: "user", content: "I need help" },
    { role: "assistant", content: "Hello!" },
  ];
  assert.deepEqual(dedupeAdjacentWelcomeMessages(messages, "Hello!"), [
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "I need help" },
    { role: "assistant", content: "Hello!" },
  ]);
});

test("collapses multiple consecutive assistant greetings at start to the current welcome", () => {
  const messages = [
    { role: "assistant", content: "Hello! I'm Chatty, your AI assistant. I can help you with creating, configuring, and integrating your AI chat widgets. How can I help you today?" },
    { role: "assistant", content: "Hello! How can I help you today?" },
  ];
  assert.deepEqual(dedupeAdjacentWelcomeMessages(messages, "Hello! How can I help you today?"), [
    { role: "assistant", content: "Hello! How can I help you today?" },
  ]);
});
