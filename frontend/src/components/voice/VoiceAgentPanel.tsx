'use client';

import '@livekit/components-styles';

import { useEffect, useMemo, useState } from 'react';
import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
  VoiceAssistantControlBar,
} from '@livekit/components-react';
import { TokenSource, type TokenSourceResponseObject } from 'livekit-client';
import { AudioWaveform, Loader2, Phone, PhoneOff } from 'lucide-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';

type VoiceAgentPanelProps = {
  botId: string;
  sessionId: string;
  backendUrl?: string;
  widgetToken?: string;
  compact?: boolean;
  visualizer?: 'wave' | 'bar' | 'grid' | 'radial' | 'aura';
  className?: string;
};

type VoiceTokenResponse = {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  participantName: string;
};

const defaultBackendUrl = 'https://api.chatty.personaliai.com';

function LiveKitTranscript() {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const { state } = useAgent();

  return messages.length === 0 ? (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-neutral-200 bg-white/80 p-4 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60" aria-live="polite">
      Start the voice agent to see real-time transcription here.
    </div>
  ) : (
    <AgentChatTranscript
      messages={messages}
      agentState={state}
      aria-live="polite"
      aria-label="Live voice transcript"
      className="min-h-0 flex-1 rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60"
    />
  );
}

function ConnectedVoiceAgent({ compact = false, visualizer = 'wave' }: { compact?: boolean; visualizer?: VoiceAgentPanelProps['visualizer'] }) {
  const session = useSessionContext();
  const { state } = useAgent();
  const { audioTrack } = useVoiceAssistant();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) {
      void session.end();
      return;
    }
    void session.start().catch((error) => {
      console.error('LiveKit voice session failed to start', error);
      setStarted(false);
    });
    return () => {
      void session.end();
    };
  }, [session, started]);

  useEffect(() => {
    if (session.connectionState === 'disconnected' && started) setStarted(false);
  }, [session.connectionState, started]);

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${compact ? 'p-2' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AudioWaveform className="size-4 text-orange-500" aria-hidden="true" />
          Live voice agent
        </div>
        <span className="text-xs capitalize text-neutral-500">{started ? state : 'idle'}</span>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70" data-visualizer={visualizer}>
        <BarVisualizer state={state} track={audioTrack} barCount={compact ? 9 : ({ wave: 24, bar: 15, grid: 18, radial: 12, aura: 9 }[visualizer ?? 'wave'])} className="h-16 w-full" aria-label={`${visualizer ?? 'wave'} audio visualizer`} />
      </div>
      <LiveKitTranscript />
      <div className="rounded-2xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
        {started && <VoiceAssistantControlBar controls={{ microphone: true, leave: false }} />}
        <button
          type="button"
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${started ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900'}`}
          onClick={() => setStarted((current) => !current)}
        >
          {started ? <PhoneOff className="size-4" /> : <Phone className="size-4" />}
          {started ? 'End voice session' : 'Start voice session'}
        </button>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

export function VoiceAgentPanel({
  botId,
  sessionId,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendUrl,
  widgetToken,
  compact = false,
  visualizer = 'wave',
  className = '',
}: VoiceAgentPanelProps) {
  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async (): Promise<TokenSourceResponseObject> => {
        const response = await fetch(`${backendUrl}/api/widget/voice/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(widgetToken ? { 'x-widget-token': widgetToken } : {}),
          },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
        const data = (await response.json()) as VoiceTokenResponse;
        return { serverUrl: data.serverUrl, participantToken: data.participantToken };
      }),
    [backendUrl, botId, sessionId, widgetToken],
  );
  const session = useSession(tokenSource);

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <SessionProvider session={session}>
        <ConnectedVoiceAgent compact={compact} visualizer={visualizer} />
      </SessionProvider>
    </section>
  );
}

export function VoiceAgentLoading() {
  return <Loader2 className="size-4 animate-spin" aria-label="Loading voice agent" />;
}
