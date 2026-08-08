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

// Manually-triggered "send me a test push right now" path, used by the two
// test buttons in Instellingen. The function is deployed --no-verify-jwt (the
// cron path below has no logged-in user at all), so this is the only check
// standing between an anonymous caller and triggering a send: it proves "this
// caller knows the shared household password", not "this caller IS the named
// app_user_id" — app_users isn't tied to Supabase Auth, so that distinction
// isn't enforceable here. Consistent with the rest of this app's multi-user
// model (see CLAUDE.md): the household login is the only real boundary.
async function handleTestMode(req: Request, admin: SupabaseClient, body: Record<string, unknown>) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ ok: false, error: "missing authorization" }, 401);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return jsonResponse({ ok: false, error: "invalid session" }, 401);

  const appUserId = body.app_user_id as string | undefined;
  const type = body.type as string | undefined;
  if (!appUserId || (type !== "daily" && type !== "weekly")) {
    return jsonResponse({ ok: false, error: "app_user_id and type ('daily'|'weekly') are required" }, 400);
  }

  const { data: appUser } = await admin.from("app_users").select("id, user_id, name").eq("id", appUserId).maybeSingle();
  if (!appUser || appUser.user_id !== userData.user.id) {
    return jsonResponse({ ok: false, error: "unknown profile" }, 404);
  }

  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("app_user_id", appUserId);
  const subscriptions = (subs ?? []) as PushSubscriptionRow[];
  if (!subscriptions.length) {
    return jsonResponse({ ok: false, error: "Geen toestel geregistreerd voor pushmeldingen voor dit profiel." });
  }

  let pushBody: string;
  if (type === "daily") {
    const { data: userSettings } = await admin.from("user_settings").select("timezone").eq("app_user_id", appUserId).maybeSingle();
    const dateStr = localParts(new Date(), (userSettings as { timezone?: string } | null)?.timezone || "Europe/Amsterdam").dateStr;
    const { data: todaySessions } = await admin
      .from("sessions")
      .select("id, app_user_id, scheduled_date, status")
      .eq("app_user_id", appUserId)
      .eq("scheduled_date", dateStr);
    const plannedCount = ((todaySessions ?? []) as SessionRow[]).filter((s) => s.status === "planned").length;
    pushBody = plannedCount > 0
      ? `Vandaag staat er ${plannedCount} sessie${plannedCount === 1 ? "" : "s"} gepland.`
      : "Niets gepland voor vandaag — misschien nog iets inplannen?";
  } else {
    pushBody = "Tijd om je nieuwe week te plannen!";
  }

  await sendToAll(admin, subscriptions, { title: "Fit Planner (TEST)", body: pushBody, url: "./" });
  // Deliberately does NOT touch last_daily_reminder_sent_date/last_weekly_reminder_sent_date
  // so a test send can never suppress or interfere with the real scheduled send.
  return jsonResponse({ ok: true, sent_to: subscriptions.length });
}

// Invoked on a schedule by pg_cron/pg_net (see the commented block at the end
// of supabase-schema.sql) — there is no logged-in user, so this is deployed
// with --no-verify-jwt and instead checks a shared x-cron-secret header.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = cron mode */ }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (body.mode === "test") return await handleTestMode(req, admin, body);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const now = new Date();
  const results: Record<string, unknown>[] = [];

  try {
    const { data: settingsRows, error: settingsError } = await admin.from("user_settings").select("*");
    if (settingsError) throw settingsError;

    for (const settings of (settingsRows ?? []) as UserSettingsRow[]) {
      const { dateStr, timeStr, weekday } = localParts(now, settings.timezone || "Europe/Amsterdam");

      // Scoped by app_user_id, not user_id — every household profile shares the
      // same user_id, so a user_id-scoped query here would silently mix every
      // profile's sessions/devices into every other profile's reminder.
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("app_user_id", settings.app_user_id);
      const subscriptions = (subs ?? []) as PushSubscriptionRow[];
      if (!subscriptions.length) continue;

      if (
        settings.daily_reminder_enabled &&
        settings.last_daily_reminder_sent_date !== dateStr &&
        isWithinBucket(timeStr, settings.daily_reminder_time)
      ) {
        const { data: todaySessions } = await admin
          .from("sessions")
          .select("id, app_user_id, scheduled_date, status")
          .eq("app_user_id", settings.app_user_id)
          .eq("scheduled_date", dateStr);
        const plannedCount = ((todaySessions ?? []) as SessionRow[]).filter((s) => s.status === "planned").length;
        const body2 = plannedCount > 0
          ? `Vandaag staat er ${plannedCount} sessie${plannedCount === 1 ? "" : "s"} gepland.`
          : "Niets gepland voor vandaag — misschien nog iets inplannen?";

        await sendToAll(admin, subscriptions, { title: "Fit Planner", body: body2, url: "./" });
        await admin.from("user_settings")
          .update({ last_daily_reminder_sent_date: dateStr })
          .eq("app_user_id", settings.app_user_id);
        results.push({ app_user_id: settings.app_user_id, sent: "daily" });
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
          .eq("app_user_id", settings.app_user_id);
        results.push({ app_user_id: settings.app_user_id, sent: "weekly" });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
