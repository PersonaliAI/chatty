-- Widget send-button style (icon + shape variant).
alter table chatty_bots
  add column if not exists send_button_style text default 'plane';
