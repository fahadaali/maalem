interface CloudflareEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  AUTH_SECRET?: string;
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
