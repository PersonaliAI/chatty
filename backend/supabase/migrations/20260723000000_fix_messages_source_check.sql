-- Migration to add email and api to messages_source_check constraint on messages table
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_source_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_source_check CHECK (source IN ('web', 'telegram', 'cron', 'email', 'api'));
