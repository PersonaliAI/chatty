import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = '.env.local';
const envContent = fs.readFileSync(envFile, 'utf-8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

lines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
});

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bots, error: botErr } = await supabase.from('chatty_bots').select('*').limit(1);
  if (botErr) {
    console.error("Bot error:", botErr);
    return;
  }
  if (!bots || bots.length === 0) {
    console.log("No bots found");
    return;
  }

  const bot = bots[0];
  console.log("Bot ID:", bot.id);
  console.log("Bot user_id:", bot.user_id);

  const { data: userById, error: err1 } = await supabase.from('users').select('*').eq('id', bot.user_id);
  console.log("User by id:", userById, err1);

  const { data: userByAuthId, error: err2 } = await supabase.from('users').select('*').eq('auth_user_id', bot.user_id);
  console.log("User by auth_user_id:", userByAuthId, err2);
}

check();
