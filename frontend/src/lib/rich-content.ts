export interface EmailCapturedData {
  email: string;
  name?: string | null;
  marketing_consent?: boolean;
}

export interface CheckoutLinkData {
  provider: "stripe" | "lemonsqueezy" | "polar" | string;
  title: string;
  amount_cents: number;
  currency: string;
  url: string;
}

export interface BookingConfirmedData {
  id?: string;
  formatted_time: string;
  meeting_link: string;
  summary?: string;
  start_time?: string;
  end_time?: string;
  attendee_name?: string;
  attendee_email?: string;
  assigned_to_email?: string;
}

export interface OfflineTicketData {
  name: string;
  email: string;
  message: string;
}

export interface VisitorMessageParsed {
  cleanText: string;
  isLiveHandoffRequest: boolean;
  offlineTicket: OfflineTicketData | null;
  isSyntheticHidden: boolean;
}

export interface RichContentResult<
  TProduct extends object = Record<string, unknown>,
  TVideo extends object = Record<string, unknown>,
  TOrder extends object = Record<string, unknown>,
> {
  cleanContent: string;
  products: TProduct[];
  videoClips: TVideo[];
  orders: TOrder[];
  hasHandoffActions?: boolean;
  isLiveHandoffAck?: boolean;
  emailCaptured?: EmailCapturedData | null;
  bookingConfirmed?: BookingConfirmedData | null;
  checkoutLinks?: CheckoutLinkData[];
}

/** Extract nested JSON marker payloads without a non-nesting regex. */
function extractMarker<T extends object>(source: string, marker: string): { text: string; items: T[] } {
  const items: T[] = [];
  let text = "";
  let cursor = 0;

  while (cursor < source.length) {
    const markerStart = source.indexOf(marker, cursor);
    if (markerStart < 0) {
      text += source.slice(cursor);
      break;
    }
    const jsonStart = source.indexOf("{", markerStart + marker.length);
    if (jsonStart < 0) {
      text += source.slice(cursor);
      break;
    }

    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;
    for (let index = jsonStart; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        end = index;
        break;
      }
    }

    if (end < 0 || source[end + 1] !== "]") {
      text += source.slice(cursor, markerStart + marker.length);
      cursor = markerStart + marker.length;
      continue;
    }

    let parsed: T | null = null;
    try {
      const candidate = JSON.parse(source.slice(jsonStart, end + 1));
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as T;
    } catch {
      // Preserve malformed markers as visible response text.
    }
    text += source.slice(cursor, markerStart);
    if (parsed) items.push(parsed);
    else text += source.slice(markerStart, end + 2);
    cursor = end + 2;
  }
  return { text, items };
}

function parseLegacyBookingConfirmation(text: string): BookingConfirmedData | null {
  const schedMatch = text.match(/Your (?:demo|meeting) (?:is scheduled for|has been rescheduled to)\s+([^\n.]+)\.?/i);
  if (!schedMatch) return null;
  const linkMatch = text.match(/Meeting Link:\s*(https?:\/\/\S+)/i);
  const emailMatch = text.match(/sent to\s+([^\s.]+@[^\s.]+\.[^\s.!]+)/i);
  return {
    formatted_time: schedMatch[1].trim(),
    meeting_link: linkMatch ? linkMatch[1].trim() : "https://meet.google.com/",
    summary: "Scheduled Demo Meeting",
    attendee_email: emailMatch ? emailMatch[1].trim().replace(/\.$/, "") : undefined,
  };
}

export function parseRichContent<
  TProduct extends object = Record<string, unknown>,
  TVideo extends object = Record<string, unknown>,
  TOrder extends object = Record<string, unknown>,
>(
  content: string,
): RichContentResult<TProduct, TVideo, TOrder> {
  const hasHandoffActions = /\[HANDOFF_ACTIONS\]/.test(content);
  const isLiveHandoffAck =
    /\[LIVE_AGENT_REQUESTED\]/.test(content) ||
    /Connecting you with our support team now/i.test(content);
  const productResult = extractMarker<TProduct>(content, "[PRODUCT_CARD:");
  const videoResult = extractMarker<TVideo>(productResult.text, "[VIDEO_CLIP:");
  const orderResult = extractMarker<TOrder>(videoResult.text, "[ORDER_CARD:");
  const emailResult = extractMarker<EmailCapturedData>(orderResult.text, "[EMAIL_CAPTURED:");
  const bookingResult = extractMarker<BookingConfirmedData>(emailResult.text, "[BOOKING_CONFIRMED:");
  const checkoutResult = extractMarker<CheckoutLinkData>(bookingResult.text, "[CHECKOUT_LINK:");

  const cleaned = checkoutResult.text
    .replace(/\[BOOKING_WIDGET(?::[a-zA-Z0-9_-]+)?\]/g, "")
    .replace(/\[HANDOFF_ACTIONS\]/g, "")
    .replace(/\[LIVE_AGENT_REQUESTED\]/g, "")
    .trim();

  const bookingConfirmed =
    bookingResult.items[0] || parseLegacyBookingConfirmation(cleaned) || null;

  return {
    cleanContent: cleaned,
    products: productResult.items,
    videoClips: videoResult.items,
    orders: orderResult.items,
    hasHandoffActions,
    isLiveHandoffAck,
    emailCaptured: emailResult.items[0] || null,
    bookingConfirmed,
    checkoutLinks: checkoutResult.items,
  };
}

export function parseVisitorMessageContent(content: string): VisitorMessageParsed {
  const raw = (content || "").trim();
  if (/^\[Visitor requested live agent/i.test(raw)) {
    return {
      cleanText: "I would like to speak to a human agent",
      isLiveHandoffRequest: true,
      offlineTicket: null,
      isSyntheticHidden: false,
    };
  }
  if (/^\[Offline Support Ticket\]/i.test(raw)) {
    const nameMatch = raw.match(/Name:\s*(.+)/i);
    const emailMatch = raw.match(/Email:\s*(.+)/i);
    const msgMatch = raw.match(/Message:\s*([\s\S]+)/i);
    const name = nameMatch ? nameMatch[1].trim() : "Visitor";
    const email = emailMatch ? emailMatch[1].trim() : "";
    const message = msgMatch ? msgMatch[1].trim() : raw.replace(/^\[Offline Support Ticket\]\s*/i, "").trim();
    return {
      cleanText: message || "Submitted an offline support request",
      isLiveHandoffRequest: false,
      offlineTicket: { name, email, message },
      isSyntheticHidden: false,
    };
  }
  if (/^\[Calendar booking offered:/i.test(raw) || /^\[Flow tag:/i.test(raw)) {
    return {
      cleanText: "",
      isLiveHandoffRequest: false,
      offlineTicket: null,
      isSyntheticHidden: true,
    };
  }
  return {
    cleanText: content,
    isLiveHandoffRequest: false,
    offlineTicket: null,
    isSyntheticHidden: false,
  };
}

export function formatMessagePreview(content?: string | null): string {
  const raw = (content || "").trim();
  if (!raw) return "";
  const visitorParsed = parseVisitorMessageContent(raw);
  if (visitorParsed.isLiveHandoffRequest || visitorParsed.offlineTicket) {
    return visitorParsed.cleanText;
  }
  if (visitorParsed.isSyntheticHidden) {
    const prefix = "[calendar booking offered:";
    if (raw.toLowerCase().startsWith(prefix) && raw.endsWith("]")) {
      const inner = raw.slice(prefix.length, -1).trim();
      return inner || "Select a time slot to schedule your meeting";
    }
    return "Select a time slot to schedule your meeting";
  }
  const richParsed = parseRichContent(raw);
  return richParsed.cleanContent || "Conversation updated";
}

