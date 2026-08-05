import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isWithinBucket, localParts } from "./timeWindow.ts";
import { sendPush } from "./sendPush.ts";
import type { PushSubscriptionRow, SessionRow, UserSettingsRow } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendToAll(
  admin: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: Record<string, unknown>,
) {
  for (const sub of subscriptions) {
    const result = await sendPush(sub, payload);
    if (!result.ok && result.expired) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
}

// Invoked on a schedule by pg_cron/pg_net (see the commented block at the end
// of supabase-schema.sql) — there is no logged-in user, so this is deployed
// with --no-verify-jwt and instead checks a shared x-cron-secret header.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const results: Record<string, unknown>[] = [];

  try {
    const { data: settingsRows, error: settingsError } = await admin.from("user_settings").select("*");
    if (settingsError) throw settingsError;

    for (const settings of (settingsRows ?? []) as UserSettingsRow[]) {
      const { dateStr, timeStr, weekday } = localParts(now, settings.timezone || "Europe/Amsterdam");

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", settings.user_id);
      const subscriptions = (subs ?? []) as PushSubscriptionRow[];
      if (!subscriptions.length) continue;

      if (
        settings.daily_reminder_enabled &&
        settings.last_daily_reminder_sent_date !== dateStr &&
        isWithinBucket(timeStr, settings.daily_reminder_time)
      ) {
        const { data: todaySessions } = await admin
          .from("sessions")
          .select("id, user_id, scheduled_date, status")
          .eq("user_id", settings.user_id)
          .eq("scheduled_date", dateStr);
        const plannedCount = ((todaySessions ?? []) as SessionRow[]).filter((s) => s.status === "planned").length;
        const body = plannedCount > 0
          ? `Vandaag staat er ${plannedCount} sessie${plannedCount === 1 ? "" : "s"} gepland.`
          : "Niets gepland voor vandaag — misschien nog iets inplannen?";

        await sendToAll(admin, subscriptions, { title: "Fit Planner", body, url: "./" });
        await admin.from("user_settings")
          .update({ last_daily_reminder_sent_date: dateStr })
          .eq("user_id", settings.user_id);
        results.push({ user_id: settings.user_id, sent: "daily" });
      }

      if (
        settings.weekly_reminder_enabled &&
        weekday === settings.weekly_reminder_day &&
        settings.last_weekly_reminder_sent_date !== dateStr &&
        isWithinBucket(timeStr, settings.weekly_reminder_time)
      ) {
        await sendToAll(admin, subscriptions, {
          title: "Fit Planner",
          body: "Tijd om je nieuwe week te plannen!",
          url: "./",
        });
        await admin.from("user_settings")
          .update({ last_weekly_reminder_sent_date: dateStr })
          .eq("user_id", settings.user_id);
        results.push({ user_id: settings.user_id, sent: "weekly" });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
