'use client';

import { type ComponentProps } from 'react';
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

type MessageWithAttachments = ReceivedMessage & { attachedFiles?: File[] };

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
  scrollAnchor,
  autoScroll = true,
  scrollMargin,
  scrollEdgeThreshold,
  preserveScrollOnPrepend,
  scrollPreviousItemPeek,
  defaultScrollPosition = 'last-anchor',
  agentState,
  messages = [],
  className,
  ...props
}: AgentChatTranscriptProps) {
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
            {[...messages].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).map((receivedMessage) => {
              const isUser = receivedMessage.from?.isLocal;
              const time = new Date(receivedMessage.timestamp);
              const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
              const title = time.toLocaleTimeString(locale, { timeStyle: 'short' });
              const isAnchor = scrollAnchor === 'any' || (scrollAnchor === 'user' && isUser) || (scrollAnchor === 'other' && !isUser);
              return (
                <MessageScrollerItem key={`${receivedMessage.type}-${receivedMessage.id}`} messageId={`${receivedMessage.type}-${receivedMessage.id}`} scrollAnchor={isAnchor}>
                  <Message align={isUser ? 'end' : 'start'} title={title}>
                    <MessageContent>
                      <Bubble align={isUser ? 'end' : 'start'} variant={isUser ? 'secondary' : 'ghost'}>
                        <BubbleContent>
                          <Streamdown>{receivedMessage.message}</Streamdown>
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
