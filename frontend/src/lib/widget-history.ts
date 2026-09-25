export interface WidgetHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Remove a duplicate welcome turn left by older widget builds. This is
 * intentionally limited to adjacent assistant greetings so a user can still
 * receive the same answer twice later in a conversation without losing data.
 */
export function dedupeAdjacentWelcomeMessages<T extends WidgetHistoryMessage>(
  messages: T[],
  welcomeMessage: string,
): T[] {
  const normalizedWelcome = welcomeMessage.trim();
  if (!normalizedWelcome) return messages;

  const result: T[] = [];
  for (const message of messages) {
    const previous = result[result.length - 1];
    const isDuplicateWelcome =
      message.role === "assistant" &&
      message.content.trim() === normalizedWelcome &&
      previous?.role === "assistant" &&
      previous.content.trim() === normalizedWelcome;
    if (!isDuplicateWelcome) result.push(message);
  }
  return result;
}

/**
 * The embed has a temporary welcome placeholder while its persisted thread
 * loads. Once the first persisted turn is the same welcome text, rendering
 * the placeholder as well would duplicate the greeting.
 */
export function shouldRenderInlineWelcome(
  messages: WidgetHistoryMessage[],
  welcomeMessage: string,
): boolean {
  const first = messages[0];
  return !first || first.role !== "assistant" || first.content.trim() !== welcomeMessage.trim();
}
