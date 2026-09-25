import test from "node:test";
import assert from "node:assert/strict";
import { shouldRenderInlineWelcome } from "../src/lib/widget-history.ts";

test("renders the temporary welcome while the thread is empty", () => {
  assert.equal(shouldRenderInlineWelcome([], "Hello!"), true);
});

test("does not duplicate a persisted welcome message", () => {
  assert.equal(
    shouldRenderInlineWelcome([{ role: "assistant", content: " Hello! " }], "Hello!"),
    false,
  );
});

test("keeps the placeholder when history starts with a real turn", () => {
  assert.equal(
    shouldRenderInlineWelcome([{ role: "user", content: "Hi" }], "Hello!"),
    true,
  );
});
