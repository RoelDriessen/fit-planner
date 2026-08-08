export interface UserSettingsRow {
  app_user_id: string;
  timezone: string;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  weekly_reminder_enabled: boolean;
  weekly_reminder_day: number;
  weekly_reminder_time: string;
  last_daily_reminder_sent_date: string | null;
  last_weekly_reminder_sent_date: string | null;
}

export interface PushSubscriptionRow {
  id: string;
  app_user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}
