-- Lets an admin/owner choose, per bookable team member, whether that
-- member's round-robin meetings actually go on THEIR OWN connected
-- calendar (the default, matches every prior team-scheduling migration) or
-- on the bot owner's calendar instead — useful for a member who hasn't (or
-- can't) connect their own Google/Outlook account. The member is still the
-- one meetings get *assigned to* for fairness-counting and notifications;
-- only which calendar the event physically lands on changes.
alter table public.chatty_team_members
  add column if not exists book_on_own_calendar boolean not null default true;
