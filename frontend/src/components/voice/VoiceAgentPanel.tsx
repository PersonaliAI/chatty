'use client';

/**
 * The dashboard preview and the public widget intentionally use the same
 * voice surface. Keeping this adapter instead of a second implementation
 * prevents the two screens from drifting again.
 */
import {
  VoiceAgent,
  type VoiceAgentProps,
} from '../../../packages/chatty-react/src/voice-agent';

export type VoiceAgentPanelProps = VoiceAgentProps & {
  compact?: boolean;
  widgetMode?: boolean;
};

export function VoiceAgentPanel({
  compact,
  widgetMode,
  ...props
}: VoiceAgentPanelProps) {
  return (
    <VoiceAgent
      {...props}
      compact={compact}
      widgetMode={widgetMode}
      title="Voice agent"
      showBooking
    />
  );
}

export function VoiceAgentLoading() {
  return <span className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" aria-label="Loading voice agent" />;
}

export function VoiceAgentPanelStyles() {
  return null;
}
