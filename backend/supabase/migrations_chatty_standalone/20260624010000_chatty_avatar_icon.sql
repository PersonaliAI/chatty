-- Assistant avatar choice: 'logo' (use uploaded logo / initial) or a preset key.
alter table chatty_bots add column if not exists avatar_icon text default 'logo';
