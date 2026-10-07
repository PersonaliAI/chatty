'use client';

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
}: LiveKitAgentVisualizerProps) {
  const common = { state, audioTrack, color: colorValue(color), className };

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
