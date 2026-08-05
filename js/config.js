// Copy this file to js/config.js and fill in the values below.
// Fill these in from your (new, separate) Supabase project: Dashboard -> Project Settings -> API.
// The anon key is safe to expose client-side — Row Level Security in supabase-schema.sql
// makes sure every user can only ever read/write their own rows.
window.SUPABASE_URL = "https://zqqrvtttmpmmuufcclyo.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_eZgqgt_kMPtPRhruuJf-fA_pjHlu2qQ";

// Internal account identifier used behind the scenes for the access-code login.
// It's never shown in the UI and doesn't need to be a real, reachable mailbox —
// it just has to look like a valid email and stay the same across app loads.
window.APP_ACCOUNT_EMAIL = "toegang@fit-planner.app";

// Public VAPID key for Web Push (safe to expose client-side, like the anon key).
// Generate a keypair with: npx web-push generate-vapid-keys
// The PRIVATE key goes into the send-reminders Edge Function's secrets, never here.
window.VAPID_PUBLIC_KEY = "your-vapid-public-key";
