"use client";

import { type Ref, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const motionAnimationProps = {
  variants: {
    hidden: {
      opacity: 0,
      scale: 0.1,
      transition: {
        duration: 0.1,
        ease: "linear" as const,
      },
    },
    visible: {
      opacity: [0.5, 1],
      scale: [0.9, 1],
      transition: {
        type: "spring" as const,
        bounce: 0,
        duration: 0.5,
        repeat: Infinity,
        repeatType: "mirror" as const,
      },
    },
  },
  initial: "hidden",
  animate: "visible",
  exit: "hidden",
};

const agentChatIndicatorVariants = cva(
  "inline-block rounded-full bg-neutral-400 dark:bg-neutral-500",
  {
    variants: {
      size: {
        sm: "size-2",
        md: "size-3",
        lg: "size-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AgentChatIndicatorProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * Official LiveKit Agents animated indicator that shows the agent is processing or thinking.
 * Displays as a pulsing dot, typically used in chat interfaces.
 */
export function AgentChatIndicator({
  size = "md",
  className,
  ...props
}: AgentChatIndicatorProps &
  ComponentProps<"span"> &
  VariantProps<typeof agentChatIndicatorVariants>) {
  return (
    <motion.span
      {...motionAnimationProps}
      transition={{ duration: 0.1, ease: "linear" as const }}
      className={cn(agentChatIndicatorVariants({ size }), className)}
      {...props}
    />
  );
}
