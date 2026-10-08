'use client';

import { useEffect, useMemo, useState } from 'react';

import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { AgentAudioVisualizerBar } from '@/components/agents-ui/agent-audio-visualizer-bar';
import { AgentAudioVisualizerGrid } from '@/components/agents-ui/agent-audio-visualizer-grid';
import { AgentAudioVisualizerRadial } from '@/components/agents-ui/agent-audio-visualizer-radial';
import { AgentAudioVisualizerWave } from '@/components/agents-ui/agent-audio-visualizer-wave';
import type { AgentState, TrackReferenceOrPlaceholder } from '@livekit/components-react';

export type LiveKitVisualizer = 'wave' | 'bar' | 'grid' | 'radial' | 'aura';

type LiveKitAgentVisualizerProps = {
  visualizer: LiveKitVisualizer;
  state?: AgentState;
  audioTrack?: TrackReferenceOrPlaceholder;
  color?: string;
  className?: string;
  /**
   * Drives a deterministic signal for configuration previews. Live sessions
   * leave this disabled and use the real LiveKit audio track instead.
   */
  demo?: boolean;
};

const colorValue = (color: string | undefined) => (color ?? '#1FD5F9') as `#${string}`;

/**
 * A single Chatty adapter around the official LiveKit Agents UI visualizers.
 * Keeping this switch in one place prevents the dashboard and widget from
 * drifting into separate animation implementations.
 */
export function LiveKitAgentVisualizer({
  visualizer,
  state = 'listening',
  audioTrack,
  color,
  className,
  demo = false,
}: LiveKitAgentVisualizerProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!demo) return;

    const timer = window.setInterval(() => {
      setPhase((current) => current + 0.18);
    }, 40);

    return () => window.clearInterval(timer);
  }, [demo]);

  const previewVolume = useMemo(() => {
    if (!demo) return 0;

    const stateIntensity =
      state === 'speaking' ? 0.72 : state === 'thinking' ? 0.4 : state === 'connecting' ? 0.2 : 0.28;
    return Math.max(0, Math.min(1, stateIntensity + Math.sin(phase) * 0.16));
  }, [demo, phase, state]);

  const previewBands = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) =>
        Math.max(
          0,
          Math.min(1, previewVolume + Math.sin(phase * 1.6 + index * 0.72) * 0.18),
        ),
      ),
    [phase, previewVolume],
  );

  const common = {
    state,
    audioTrack,
    color: colorValue(color),
    className,
    ...(demo ? { volume: previewVolume, volumeBands: previewBands } : {}),
  };

  switch (visualizer) {
    case 'bar':
      return <AgentAudioVisualizerBar {...common} size="lg" barCount={7} />;
    case 'grid':
      return <AgentAudioVisualizerGrid {...common} size="lg" rowCount={9} columnCount={9} />;
    case 'radial':
      return <AgentAudioVisualizerRadial {...common} size="lg" radius={88} barCount={24} />;
    case 'aura':
      return <AgentAudioVisualizerAura {...common} size="lg" />;
    case 'wave':
    default:
      return <AgentAudioVisualizerWave {...common} size="lg" />;
  }
}
