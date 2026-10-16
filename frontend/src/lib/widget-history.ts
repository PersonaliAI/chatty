export interface WidgetHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Remove duplicate welcome/greeting turns left by older widget builds,
 * bot welcome message updates, or races between static greeting insertion
 * and server history fetch.
 *
 * If the conversation begins with multiple assistant messages before the first
 * user message, collapse them to a single greeting. Also deduplicate adjacent
 * identical assistant turns anywhere in the thread.
 */
export function dedupeAdjacentWelcomeMessages<T extends WidgetHistoryMessage>(
  messages: T[],
  welcomeMessage: string = "",
): T[] {
  if (!messages || messages.length === 0) return messages;
  const normalizedWelcome = (welcomeMessage || "").trim();

  // 1. If the thread starts with consecutive assistant messages before any user turn,
  // collapse them to a single greeting (preferring the current welcome message if present).
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  let startMsgs = firstUserIdx === -1 ? messages : messages.slice(0, firstUserIdx);
  const remainingMsgs = firstUserIdx === -1 ? [] : messages.slice(firstUserIdx);

  if (startMsgs.length > 1 && startMsgs.every((m) => m.role === "assistant")) {
    const matching = normalizedWelcome ? startMsgs.find((m) => m.content.trim() === normalizedWelcome) : undefined;
    startMsgs = [matching || startMsgs[startMsgs.length - 1]];
  }

  const combined = [...startMsgs, ...remainingMsgs];
  const result: T[] = [];
  for (const message of combined) {
    const previous = result[result.length - 1];
    const isDuplicate =
      message.role === "assistant" &&
      previous?.role === "assistant" &&
      (message.content.trim() === previous.content.trim() ||
        (normalizedWelcome !== "" &&
          message.content.trim() === normalizedWelcome &&
          previous.content.trim() === normalizedWelcome));
    if (!isDuplicate) result.push(message);
  }
  return result;
}

/**
 * The embed has a temporary welcome placeholder while its persisted thread
 * loads. Once the thread has any assistant message at the start, rendering
 * the placeholder as well duplicates the greeting.
 */
export function shouldRenderInlineWelcome(
  messages: WidgetHistoryMessage[],
  _welcomeMessage: string,
): boolean {
  const first = messages[0];
  if (!first) return true;
  if (first.role === "assistant") return false;
  return true;
}
