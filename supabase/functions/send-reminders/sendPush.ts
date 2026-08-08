import webpush from "npm:web-push@3";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface SendResult {
  ok: boolean;
  expired: boolean;
  error?: string;
}

// Sends one Web Push message. `expired` is true on a 404/410 from the push
// service, meaning the subscription is dead and its row should be deleted.
// Failures are logged (with the endpoint host only, not the full endpoint —
// it's effectively a bearer credential for that subscription) so a silent
// delivery failure shows up in `supabase functions logs send-reminders`
// instead of just vanishing.
export async function sendPush(sub: PushTarget, payload: Record<string, unknown>): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      JSON.stringify(payload),
    );
    return { ok: true, expired: false };
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    const message = (err as Error)?.message ?? String(err);
    let host = "unknown-endpoint";
    try { host = new URL(sub.endpoint).host; } catch { /* keep default */ }
    console.error(`sendPush failed for ${host}: status=${status ?? "n/a"} message=${message}`);
    return { ok: false, expired: status === 404 || status === 410, error: message };
  }
}
