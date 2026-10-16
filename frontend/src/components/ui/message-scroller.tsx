'use client';

import * as React from 'react';
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller';
import { ArrowDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn('group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden', className)}
      {...props}
    />
  );
}

function MessageScrollerViewport({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn('size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain chatty-custom-scrollbar scrollbar-thin', className)}
      {...props}
    />
  );
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return <MessageScrollerPrimitive.Content data-slot="message-scroller-content" className={cn('flex h-max min-h-full flex-col gap-3', className)} {...props} />;
}

function MessageScrollerItem({ className, scrollAnchor = false, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return <MessageScrollerPrimitive.Item data-slot="message-scroller-item" scrollAnchor={scrollAnchor} className={cn('min-w-0 shrink-0', className)} {...props} />;
}

function MessageScrollerButton({ direction = 'end', className, children, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      direction={direction}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-20 size-8 rounded-full border border-neutral-200/90 bg-white/95 dark:border-neutral-800 dark:bg-neutral-900/95 p-1.5 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 cursor-pointer backdrop-blur-sm',
        direction === 'start' ? 'top-3' : 'bottom-3',
        'data-[active=false]:pointer-events-none data-[active=false]:opacity-0 data-[active=false]:scale-75 data-[active=true]:opacity-100 data-[active=true]:scale-100',
        className
      )}
      {...props}
    >
      {children ?? <><ArrowDownIcon className={cn('size-4', direction === 'start' ? 'rotate-180' : undefined)} /><span className="sr-only">Scroll to end</span></>}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
