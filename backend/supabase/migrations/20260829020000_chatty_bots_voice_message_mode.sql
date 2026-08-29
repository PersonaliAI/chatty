-- What a finished in-chat voice recording turns into: 'transcribe' (default)
-- turns it into text the visitor reviews/edits before sending; 'audio' skips
-- transcription and sends the recording itself as a playable voice message.
alter table chatty_bots add column if not exists voice_message_mode text default 'transcribe';
