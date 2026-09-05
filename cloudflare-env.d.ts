interface CloudflareEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  AUTH_SECRET?: string;
  CRON_SECRET?: string;
  APP_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
