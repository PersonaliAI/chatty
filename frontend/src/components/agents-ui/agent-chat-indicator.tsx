import { motion } from 'motion/react';

export function AgentChatIndicator({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'size-6' : size === 'md' ? 'size-4' : 'size-3';
  return (
    <motion.span
      aria-hidden="true"
      className={`inline-block rounded-full bg-neutral-500 ${sizeClass}`}
      initial={{ opacity: 0.4, scale: 0.9 }}
      animate={{ opacity: [0.5, 1], scale: [0.9, 1] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'mirror' }}
    />
  );
}
