export type VoiceModelKind = 'llm' | 'stt' | 'tts';

export type VoiceModelOption = {
  value: string;
  label: string;
  hint?: string;
  status?: 'current' | 'deprecated' | 'retired';
};

const retired = new Set([
  'deepseek-ai/deepseek-v3', 'deepseek-ai/deepseek-v3.1', 'deepseek-ai/deepseek-v3.2',
  'google/gemini-2.0-flash', 'google/gemini-2.0-flash-lite', 'google/gemini-3-pro-preview',
  'openai/gpt-5.1-chat-latest', 'openai/gpt-5.2-chat-latest', 'openai/gpt-5.3-chat-latest',
  'xai/grok-4-1-fast-non-reasoning', 'xai/grok-4-1-fast-reasoning',
  'moonshotai/kimi-k2-instruct', 'moonshotai/kimi-k2.5',
  'cartesia/sonic', 'deepgram/aura', 'inworld/inworld-tts-1', 'inworld/inworld-tts-1-max',
  'rime/arcana',
]);

const deprecated = new Set([
  'deepseek-ai/deepseek-v4-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro', 'moonshotai/kimi-k2.6',
  'cartesia/sonic-2', 'cartesia/sonic-3-2025-10-27', 'cartesia/sonic-turbo',
  'fishaudio/s2.1-pro-free', 'rime/mist', 'rime/mistv2',
  'speechmatics/enhanced', 'speechmatics/standard',
]);

const ids = (values: string[], hint?: string): VoiceModelOption[] => values.map((value) => ({
  value,
  label: value.split('/').pop()?.replace(/-/g, ' ') ?? value,
  hint: retired.has(value) ? 'Retired' : deprecated.has(value) ? 'Deprecated' : hint,
  status: retired.has(value) ? 'retired' : deprecated.has(value) ? 'deprecated' : 'current',
}));

/**
 * Official LiveKit Inference model identifiers from the STT, LLM and TTS
 * model overviews. Keep this catalog separate from provider construction so
 * the dashboard can present the complete supported surface without exposing
 * credentials or duplicating runtime code.
 */
export const LIVEKIT_INFERENCE_MODELS: Record<VoiceModelKind, VoiceModelOption[]> = {
  llm: ids([
    'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano',
    'openai/gpt-5', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5.1', 'openai/gpt-5.1-chat-latest',
    'openai/gpt-5.2', 'openai/gpt-5.2-chat-latest', 'openai/gpt-5.3-chat-latest', 'openai/gpt-5.4',
    'openai/gpt-5.4-mini', 'openai/gpt-5.4-nano', 'openai/gpt-5.5', 'openai/gpt-5.6-luna',
    'openai/gpt-5.6-sol', 'openai/gpt-5.6-terra', 'openai/chat-latest', 'openai/gpt-oss-120b',
    'google/gemini-3.1-pro', 'google/gemini-3-flash', 'google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash',
    'google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite',
    'google/gemma-4-31b-it', 'moonshotai/kimi-k2.5', 'moonshotai/kimi-k2.6',
    'deepseek-ai/deepseek-v3', 'deepseek-ai/deepseek-v3.2', 'zai/glm-5.1',
    'xai/grok-4-1-fast-non-reasoning', 'xai/grok-4-1-fast-reasoning', 'xai/grok-4.20-0309-non-reasoning',
    'xai/grok-4.20-0309-reasoning', 'xai/grok-4.20-multi-agent-0309', 'xai/grok-4.3', 'xai/grok-4.5',
  ], 'LiveKit Inference'),
  stt: ids([
    'deepgram/nova-3', 'deepgram/nova-3-medical', 'deepgram/nova-2', 'deepgram/nova-2-medical',
    'deepgram/nova-2-conversationalai', 'deepgram/nova-2-phonecall', 'deepgram/flux-general',
    'deepgram/flux-general-en', 'deepgram/flux-general-multi', 'cartesia/ink-whisper', 'cartesia/ink-2',
    'assemblyai/universal-streaming', 'assemblyai/universal-streaming-multilingual', 'assemblyai/u3-rt-pro',
    'assemblyai/universal-3-5-pro', 'assemblyai/universal-3-6-pro', 'xai/stt-1', 'speechmatics/enhanced',
    'speechmatics/standard', 'speechmatics/linden-1', 'inworld/inworld-stt-1', 'google/gemini-3.5-transcribe-live',
  ], 'LiveKit Inference'),
  tts: ids([
    'cartesia', 'cartesia/sonic-3.5', 'cartesia/sonic-3', 'cartesia/sonic-2', 'cartesia/sonic-turbo',
    'cartesia/sonic', 'cartesia/sonic-3-latest', 'cartesia/sonic-latest', 'deepgram', 'deepgram/aura',
    'deepgram/aura-2', 'rime', 'rime/coda', 'rime/mistv2', 'rime/mistv3', 'rime/mist', 'inworld',
    'inworld/inworld-tts-2', 'inworld/inworld-tts-1.5-max', 'inworld/inworld-tts-1.5-mini',
    'inworld/inworld-tts-1.5', 'inworld/inworld-tts-1-max', 'inworld/inworld-tts-1', 'xai/tts-1',
    'fishaudio', 'fishaudio/s2.1-pro', 'fishaudio/s2.1-pro-free', 'fishaudio/s2-pro',
  ], 'LiveKit Inference'),
};

/** Realtime model plugins documented by LiveKit Agents. These are separate
 * from the STT → LLM → TTS pipeline and require the corresponding BYOK key. */
export const REALTIME_MODELS: Record<string, VoiceModelOption[]> = {
  google: ids(['gemini-3.8-live', 'gemini-3.8-live-extended-thinking', 'gemini-3.1-flash-live-preview', 'gemini-live-2.5-flash-native-audio', 'gemini-2.5-flash-native-audio-preview-12-2025'], 'Google Gemini Live'),
  openai: ids(['gpt-realtime', 'gpt-4o-realtime-preview', 'gpt-live'], 'OpenAI Realtime'),
  azure: ids(['gpt-realtime', 'gpt-4o-realtime-preview'], 'Azure OpenAI Realtime'),
  aws: ids(['amazon.nova-2.5-sonic-v1:0', 'amazon.nova-2-sonic-v1:0', 'amazon.nova-sonic-v1:0'], 'Amazon Nova Sonic'),
  nvidia: ids(['nvidia/personaplex-7b-v1'], 'NVIDIA PersonaPlex'),
  phonic: ids(['phonic_v1_1', 'phonic_v1', 'phonic_v0_5'], 'Phonic'),
  spacexai: ids(['grok-voice-1', 'grok-voice-1.1'], 'xAI Grok Voice'),
  ultravox: ids(['fixie-ai/ultravox'], 'Ultravox'),
};

export const REALTIME_PROVIDER_OPTIONS = [
  { value: 'google', label: 'Gemini Live', hint: 'ADC / built-in' },
  { value: 'openai', label: 'OpenAI GPT Realtime', hint: 'BYOK' },
  { value: 'azure', label: 'Azure OpenAI Realtime', hint: 'BYOK' },
  { value: 'aws', label: 'Amazon Nova Sonic', hint: 'BYOK' },
  { value: 'nvidia', label: 'NVIDIA PersonaPlex', hint: 'BYOK' },
  { value: 'phonic', label: 'Phonic', hint: 'BYOK' },
  { value: 'spacexai', label: 'xAI Grok Voice', hint: 'BYOK' },
  { value: 'ultravox', label: 'Ultravox', hint: 'BYOK' },
];

export const DIRECT_MODELS: Record<string, Record<VoiceModelKind, VoiceModelOption[]>> = {
  google: {
    llm: ids(['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemma-4-31b-it'], 'Google Vertex AI'),
    stt: ids(['chirp_3', 'latest_long', 'latest_short'], 'Google Cloud Speech'),
    tts: ids(['gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'], 'Google Vertex AI'),
  },
  openai: {
    llm: ids(['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5.1', 'gpt-5.2', 'gpt-5.5'], 'OpenAI BYOK'),
    stt: ids(['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'], 'OpenAI BYOK'),
    tts: ids(['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'], 'OpenAI BYOK'),
  },
  deepgram: { llm: [], stt: ids(['nova-3', 'nova-2', 'flux-general-en', 'flux-general-multi'], 'Deepgram BYOK'), tts: ids(['aura-2-thalia-en', 'aura-2-apollo-en', 'aura-2-athena-en'], 'Deepgram BYOK') },
  cartesia: { llm: [], stt: ids(['ink-2', 'ink-whisper'], 'Cartesia BYOK'), tts: ids(['sonic-3', 'sonic-3.5', 'sonic-3.6'], 'Cartesia BYOK') },
  assemblyai: { llm: [], stt: ids(['universal-3-6-pro', 'universal-3-5-pro', 'universal-streaming'], 'AssemblyAI BYOK'), tts: [] },
  soniox: { llm: [], stt: ids(['stt-async-v3', 'stt-rt-v3'], 'Soniox BYOK'), tts: [] },
  elevenlabs: { llm: [], stt: ids(['scribe_v2_realtime'], 'ElevenLabs BYOK'), tts: ids(['eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_v3'], 'ElevenLabs BYOK') },
  fishaudio: { llm: [], stt: [], tts: ids(['s2.1-pro', 's2.1-pro-free', 's2-pro'], 'Fish Audio BYOK') },
  anthropic: { llm: ids(['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'], 'Anthropic BYOK'), stt: [], tts: [] },
  openrouter: { llm: ids(['openai/gpt-5', 'google/gemini-3.8-flash', 'anthropic/claude-sonnet-4-5', 'deepseek-ai/deepseek-v4.1-flash'], 'OpenRouter BYOK'), stt: [], tts: [] },
};

export const PROVIDER_OPTIONS: Record<VoiceModelKind, { value: string; label: string; hint: string }[]> = {
  llm: [
    { value: 'google', label: 'Google Vertex AI', hint: 'ADC / built-in' },
    { value: 'livekit-inference', label: 'LiveKit Inference', hint: 'Cloud gateway' },
    { value: 'openai', label: 'OpenAI', hint: 'BYOK' },
    { value: 'anthropic', label: 'Anthropic', hint: 'BYOK' },
    { value: 'openrouter', label: 'OpenRouter', hint: 'BYOK' },
  ],
  stt: [
    { value: 'google', label: 'Google Cloud Speech', hint: 'ADC / built-in' },
    { value: 'livekit-inference', label: 'LiveKit Inference', hint: 'Cloud gateway' },
    { value: 'deepgram', label: 'Deepgram', hint: 'BYOK' },
    { value: 'assemblyai', label: 'AssemblyAI', hint: 'BYOK' },
    { value: 'cartesia', label: 'Cartesia', hint: 'BYOK' },
    { value: 'soniox', label: 'Soniox', hint: 'BYOK' },
    { value: 'openai', label: 'OpenAI', hint: 'BYOK' },
  ],
  tts: [
    { value: 'google', label: 'Google Gemini TTS', hint: 'ADC / built-in' },
    { value: 'livekit-inference', label: 'LiveKit Inference', hint: 'Cloud gateway' },
    { value: 'cartesia', label: 'Cartesia', hint: 'BYOK' },
    { value: 'deepgram', label: 'Deepgram', hint: 'BYOK' },
    { value: 'elevenlabs', label: 'ElevenLabs', hint: 'BYOK' },
    { value: 'fishaudio', label: 'Fish Audio', hint: 'BYOK' },
    { value: 'openai', label: 'OpenAI', hint: 'BYOK' },
  ],
};

export function modelOptions(kind: VoiceModelKind, provider: string): VoiceModelOption[] {
  if (provider === 'livekit-inference') return LIVEKIT_INFERENCE_MODELS[kind];
  return DIRECT_MODELS[provider]?.[kind] ?? [];
}
