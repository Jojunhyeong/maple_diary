-- Replace:
-- 1) YOUR_PROJECT_REF with your Supabase project ref
-- 2) YOUR_CRON_SECRET with the same value you set as the Edge Function secret CRON_SECRET
--
-- Run this once after deployment if you want to seed today's snapshot immediately.

select net.http_post(
  url := 'https://vhkrcnofrobwsjkzjwjg.supabase.co/functions/v1/character-exp-snapshot?force=1',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'nXl9cIKZ3pd/7lcss2hIddB8a5XCf4FtCbyIaEYiLf0'
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
);
