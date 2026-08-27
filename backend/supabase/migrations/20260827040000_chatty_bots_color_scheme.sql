-- Per-section widget colors (header/bot-bubble/user-bubble/input-bar/
-- send-button/launcher, each with its own bg + text/icon color), replacing
-- the single "Primary Hex Color" as the source of truth for the Customizer
-- when set. Nullable and additive: a bot with no color_scheme yet keeps
-- rendering exactly as before (the existing primaryColor-driven presets in
-- globals.css). Shape: { header, botBubble, userBubble, inputBar, sendBtn,
-- launcher }, each { bg, text, icon? } — see WidgetColorScheme in
-- frontend/src/lib/color-contrast.ts.
alter table chatty_bots add column if not exists color_scheme jsonb;
