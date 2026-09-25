export interface WidgetHistoryMessage {
  role: "user" | "assistant";
  content: string;
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
