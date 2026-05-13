-- Replace:
-- 1) YOUR_PROJECT_REF with your Supabase project ref
-- 2) YOUR_CRON_SECRET with the same value you set as the Edge Function secret CRON_SECRET
--
-- Supabase DB timezone defaults to UTC.
-- 23:59 KST = 14:59 UTC.

select cron.schedule(
  'character-exp-snapshot-daily-2359-kst',
  '59 14 * * *',
  $$
    select net.http_post(
      url := 'https://vhkrcnofrobwsjkzjwjg.supabase.co/functions/v1/character-exp-snapshot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'nXl9cIKZ3pd/7lcss2hIddB8a5XCf4FtCbyIaEYiLf0'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
