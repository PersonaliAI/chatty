'use client';

import { useMemo, type ComponentProps } from 'react';
import { type AgentState, type ReceivedMessage } from '@livekit/components-react';
import { Streamdown } from 'streamdown';

import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Message, MessageContent } from '@/components/ui/message';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import { ProductCard, type ProductCardData } from '@/components/product-card';

type MessageWithAttachments = ReceivedMessage & { attachedFiles?: File[] };

function parseProductCards(content: string): { cleanContent: string; products: ProductCardData[] } {
  const items: ProductCardData[] = [];
  const marker = "[PRODUCT_CARD:";
  let cursor = 0;
  let text = "";
  while (cursor < content.length) {
    const markerStart = content.indexOf(marker, cursor);
    if (markerStart < 0) {
      text += content.slice(cursor);
      break;
    }
    const jsonStart = markerStart + marker.length;
    if (content[jsonStart] !== "{") {
      text += content.slice(cursor, jsonStart);
      cursor = jsonStart;
      continue;
    }

    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;
    for (let i = jsonStart; i < content.length; i++) {
      const char = content[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        end = i;
        break;
      }
    }

    if (end < 0 || content[end + 1] !== "]") {
      text += content.slice(cursor, jsonStart + 1);
      cursor = jsonStart + 1;
      continue;
    }
    let parsedOk = false;
    try {
      const parsed = JSON.parse(content.slice(jsonStart, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        items.push(parsed as ProductCardData);
        parsedOk = true;
      }
    } catch {}
    text += content.slice(cursor, markerStart);
    if (!parsedOk) text += content.slice(markerStart, end + 2);
    cursor = end + 2;
  }
  return { cleanContent: text.trim(), products: items };
}

export interface AgentChatTranscriptProps
  extends ComponentProps<'div'>,
    ComponentProps<typeof MessageScrollerProvider>,
    ComponentProps<typeof MessageScrollerViewport>,
    ComponentProps<typeof MessageScrollerContent> {
  autoScroll?: boolean;
  scrollAnchor?: boolean | 'user' | 'other' | 'any';
  agentState?: AgentState;
  messages?: ReceivedMessage[];
}

/** Official LiveKit Agents UI transcript adapted from the provided components-js shadcn source. */
export function AgentChatTranscript({
  scrollAnchor = 'any',
  autoScroll = true,
  scrollMargin,
  scrollEdgeThreshold,
  preserveScrollOnPrepend,
  scrollPreviousItemPeek,
  defaultScrollPosition = 'end',
  agentState,
  messages = [],
  className,
  ...props
}: AgentChatTranscriptProps) {
  const normalizedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA > 0 && timeB > 0) {
        if (Math.abs(timeA - timeB) < 31536000000) {
          return timeA - timeB;
        }
      }
      return 0;
    });
  }, [messages]);

  return (
    <MessageScrollerProvider
      autoScroll={autoScroll}
      scrollMargin={scrollMargin}
      scrollEdgeThreshold={scrollEdgeThreshold}
      defaultScrollPosition={defaultScrollPosition}
      scrollPreviousItemPeek={scrollPreviousItemPeek}
    >
      <MessageScroller className={className} {...props}>
        <MessageScrollerViewport preserveScrollOnPrepend={preserveScrollOnPrepend}>
          <MessageScrollerContent spacerClassName="min-h-2" aria-busy={agentState === 'thinking'}>
            {normalizedMessages.map((receivedMessage) => {
              const isUser = (receivedMessage as { type?: string }).type === 'userTranscript'
                || ((receivedMessage as { type?: string }).type !== 'agentTranscript' && Boolean(receivedMessage.from?.isLocal));
              const time = new Date(receivedMessage.timestamp);
              const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
              const title = time.toLocaleTimeString(locale, { timeStyle: 'short' });
              const isAnchor = scrollAnchor === 'any' || (scrollAnchor === 'user' && isUser) || (scrollAnchor === 'other' && !isUser);
              const { cleanContent, products } = parseProductCards(receivedMessage.message || '');
              return (
                <MessageScrollerItem key={`${receivedMessage.type}-${receivedMessage.id}`} messageId={`${receivedMessage.type}-${receivedMessage.id}`} scrollAnchor={isAnchor}>
                  <Message align={isUser ? 'end' : 'start'} title={title}>
                    <MessageContent>
                      <Bubble align={isUser ? 'end' : 'start'} variant={isUser ? 'secondary' : 'ghost'}>
                        <BubbleContent>
                          {cleanContent ? <Streamdown>{cleanContent}</Streamdown> : null}
                          {products.length > 0 && (
                            <div className="mt-2.5 flex flex-col gap-2.5">
                              {products.map((p, idx) => (
                                <ProductCard key={p.id || idx} product={p} />
                              ))}
                            </div>
                          )}
                          {(receivedMessage as MessageWithAttachments).attachedFiles?.filter((file) => file.type.startsWith('image/')).map((file) => (
                            <img key={`${receivedMessage.id}-${file.name}`} src={URL.createObjectURL(file)} alt={file.name || 'Attached image'} className="mt-2 max-h-48 max-w-full rounded-lg object-contain" />
                          ))}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}
            {agentState === 'thinking' && (
              <MessageScrollerItem>
                <Marker role="status"><MarkerIcon><AgentChatIndicator size="sm" /></MarkerIcon><MarkerContent>Thinking…</MarkerContent></Marker>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label="Scroll to latest message" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
