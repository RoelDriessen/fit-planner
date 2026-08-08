// Missing js/config.js (not yet copied from config.js.example) must not throw here —
// an uncaught error on this line would stop the rest of this script from running,
// silently breaking even the auth-tab switching. Fail soft instead; authForm's
// submit handler below shows a clear message if sb is null.
const sb = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

const PALETTE = ["#6d8dff", "#ff8d6d", "#57cc99", "#ffd86d", "#c26dff", "#5fc9e8", "#ff6d9e"];
const POINTS_PER_LEVEL = 100;
const WEEKDAY_NAMES = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const ALLOWED_MIME = ["image/png", "image/jpeg"];
const ALLOWED_EXT = ["png", "jpg", "jpeg"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

let session = null;
let exerciseCategories = [];
let exercises = [];
let routines = [];
let routineExercises = [];
let sessions = [];
let userSettings = null;
let pushSubscriptions = [];
let exerciseAttachments = [];
let appUsers = [];
let currentAppUserId = null;
let pendingProfileId = null; // profile tile awaiting code confirmation, transient UI state
let channel = null;
let view = "today"; // "today" | "week" | "routines" | "exercises" | "settings"
let weekOffset = 0; // weeks relative to the current week
let activeExerciseCategoryFilter = null;
let activeExerciseId = null;
let activeRoutineId = null;
let workoutSession = null; // the sessions row a workout-in-progress will mark done
let workoutSequence = []; // flattened [{exerciseId, reps, round, totalRounds}, ...]
let workoutStepIndex = 0;
const signedUrlCache = new Map(); // storage_path -> { url, expiresAt } — shared by thumbnails, modal attachments, and the workout player

// ---------- elements ----------
const authScreen = document.getElementById("authScreen");
const authTabs = document.getElementById("authTabs");
const authForm = document.getElementById("authForm");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");

const profileScreen = document.getElementById("profileScreen");
const profileTiles = document.getElementById("profileTiles");
const profileCodePrompt = document.getElementById("profileCodePrompt");
const profileCodePromptName = document.getElementById("profileCodePromptName");
const profileCodeForm = document.getElementById("profileCodeForm");
const profileCodeInput = document.getElementById("profileCodeInput");
const profileCodeCancelBtn = document.getElementById("profileCodeCancelBtn");
const newProfileBtn = document.getElementById("newProfileBtn");
const newProfileForm = document.getElementById("newProfileForm");
const newProfileName = document.getElementById("newProfileName");
const newProfileCode = document.getElementById("newProfileCode");
const newProfileCodeConfirm = document.getElementById("newProfileCodeConfirm");
const newProfileCancelBtn = document.getElementById("newProfileCancelBtn");
const profileMessage = document.getElementById("profileMessage");

const appEl = document.getElementById("app");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const sidebar = document.getElementById("sidebar");

const todayView = document.getElementById("todayView");
const levelValue = document.getElementById("levelValue");
const levelProgressText = document.getElementById("levelProgressText");
const levelProgressFill = document.getElementById("levelProgressFill");
const streakValue = document.getElementById("streakValue");
const todayTitle = document.getElementById("todayTitle");
const todaySessionList = document.getElementById("todaySessionList");
const todayEmptyState = document.getElementById("todayEmptyState");

const weekView = document.getElementById("weekView");
const weekPrevBtn = document.getElementById("weekPrevBtn");
const weekLabel = document.getElementById("weekLabel");
const weekNextBtn = document.getElementById("weekNextBtn");
const weekTodayBtn = document.getElementById("weekTodayBtn");
const copyPrevWeekBtn = document.getElementById("copyPrevWeekBtn");
const weekDays = document.getElementById("weekDays");

const routinesView = document.getElementById("routinesView");
const addRoutineForm = document.getElementById("addRoutineForm");
const addRoutineInput = document.getElementById("addRoutineInput");
const routineList = document.getElementById("routineList");
const routineEmptyState = document.getElementById("routineEmptyState");

const exercisesView = document.getElementById("exercisesView");
const exerciseCategoryFilters = document.getElementById("exerciseCategoryFilters");
const addExerciseCategoryForm = document.getElementById("addExerciseCategoryForm");
const addExerciseCategoryInput = document.getElementById("addExerciseCategoryInput");
const addExerciseForm = document.getElementById("addExerciseForm");
const addExerciseCategorySelect = document.getElementById("addExerciseCategorySelect");
const addExerciseInput = document.getElementById("addExerciseInput");
const exerciseList = document.getElementById("exerciseList");
const exerciseEmptyState = document.getElementById("exerciseEmptyState");

const settingsView = document.getElementById("settingsView");
const currentProfileHint = document.getElementById("currentProfileHint");
const switchProfileBtn = document.getElementById("switchProfileBtn");
const settingsForm = document.getElementById("settingsForm");
const settingsTimezone = document.getElementById("settingsTimezone");
const settingsDailyEnabled = document.getElementById("settingsDailyEnabled");
const settingsDailyTime = document.getElementById("settingsDailyTime");
const settingsWeeklyEnabled = document.getElementById("settingsWeeklyEnabled");
const settingsWeeklyDay = document.getElementById("settingsWeeklyDay");
const settingsWeeklyTime = document.getElementById("settingsWeeklyTime");
const settingsMessage = document.getElementById("settingsMessage");
const pushHint = document.getElementById("pushHint");
const enablePushBtn = document.getElementById("enablePushBtn");
const deviceList = document.getElementById("deviceList");
const testDailyReminderBtn = document.getElementById("testDailyReminderBtn");
const testWeeklyReminderBtn = document.getElementById("testWeeklyReminderBtn");
const testReminderMessage = document.getElementById("testReminderMessage");

const exerciseModalOverlay = document.getElementById("exerciseModalOverlay");
const exerciseModalClose = document.getElementById("exerciseModalClose");
const exerciseModalName = document.getElementById("exerciseModalName");
const exerciseModalOwnerBadge = document.getElementById("exerciseModalOwnerBadge");
const exerciseModalCategory = document.getElementById("exerciseModalCategory");
const exerciseModalDuration = document.getElementById("exerciseModalDuration");
const exerciseModalNotes = document.getElementById("exerciseModalNotes");
const exerciseModalVideoUrl = document.getElementById("exerciseModalVideoUrl");
const exerciseModalVideoEmbed = document.getElementById("exerciseModalVideoEmbed");
const exerciseAttachmentsEl = document.getElementById("exerciseAttachments");
const exerciseAttachmentInput = document.getElementById("exerciseAttachmentInput");
const exerciseAttachmentError = document.getElementById("exerciseAttachmentError");
const exerciseModalArchiveBtn = document.getElementById("exerciseModalArchiveBtn");
const exerciseModalDeleteBtn = document.getElementById("exerciseModalDeleteBtn");

const routineModalOverlay = document.getElementById("routineModalOverlay");
const routineModalClose = document.getElementById("routineModalClose");
const routineModalName = document.getElementById("routineModalName");
const routineModalSets = document.getElementById("routineModalSets");
const routineModalPoints = document.getElementById("routineModalPoints");
const routineModalNotes = document.getElementById("routineModalNotes");
const routineExerciseList = document.getElementById("routineExerciseList");
const addRoutineExerciseForm = document.getElementById("addRoutineExerciseForm");
const addRoutineExerciseSelect = document.getElementById("addRoutineExerciseSelect");
const addRoutineExerciseReps = document.getElementById("addRoutineExerciseReps");
const routineModalArchiveBtn = document.getElementById("routineModalArchiveBtn");
const routineModalDeleteBtn = document.getElementById("routineModalDeleteBtn");
const routineModalStartBtn = document.getElementById("routineModalStartBtn");

const workoutOverlay = document.getElementById("workoutOverlay");
const workoutCloseBtn = document.getElementById("workoutCloseBtn");
const workoutRoutineName = document.getElementById("workoutRoutineName");
const workoutProgressText = document.getElementById("workoutProgressText");
const workoutProgressFill = document.getElementById("workoutProgressFill");
const workoutMedia = document.getElementById("workoutMedia");
const workoutExerciseName = document.getElementById("workoutExerciseName");
const workoutReps = document.getElementById("workoutReps");
const workoutNotes = document.getElementById("workoutNotes");
const workoutBackBtn = document.getElementById("workoutBackBtn");
const workoutNextBtn = document.getElementById("workoutNextBtn");

const lightboxOverlay = document.getElementById("lightboxOverlay");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxContent = document.getElementById("lightboxContent");

let authMode = "signin";

// ---------- auth (household login — unchanged from before multi-user) ----------
authTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".auth-tab");
  if (!btn) return;
  authMode = btn.dataset.mode;
  authTabs.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("active", b === btn));
  authSubmit.textContent = authMode === "signin" ? "Inloggen" : "Code instellen";
  authMessage.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMessage.textContent = "";
  if (!sb) {
    authMessage.textContent = "Supabase is nog niet geconfigureerd — kopieer js/config.js.example naar js/config.js en vul je projectgegevens in.";
    return;
  }
  authSubmit.disabled = true;
  const email = window.APP_ACCOUNT_EMAIL;
  const password = authPassword.value;

  try {
    const { error } = authMode === "signin"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });

    if (error) {
      authMessage.textContent = authMode === "signin"
        ? "Onjuiste code. Nog geen code ingesteld? Gebruik het tabblad \"Code instellen\"."
        : error.message;
      return;
    }
    if (authMode === "signup") {
      authPassword.value = "";
    }
  } catch (err) {
    // A thrown (not returned) error usually means the request never reached
    // Supabase at all — wrong SUPABASE_URL in config.js, or no network.
    authMessage.textContent = "Kon geen verbinding maken met Supabase. Controleer SUPABASE_URL/SUPABASE_ANON_KEY in js/config.js.";
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => sb.auth.signOut());

if (sb) {
  sb.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    if (session) {
      showApp();
    } else {
      showAuth();
    }
  });
}

function showAuth() {
  teardownRealtime();
  currentAppUserId = null;
  authScreen.hidden = false;
  profileScreen.hidden = true;
  appEl.hidden = true;
}

// Active profile is remembered on-device for a couple of hours (sliding —
// each successful restore pushes the expiry forward again), not forever: a
// short-lived PIN-free window rather than either "ask every single app open"
// (too much friction in practice — iOS can reload a standalone PWA's page,
// and therefore its in-memory state, surprisingly often on its own) or
// "remembered indefinitely" (defeats the point of a per-person PIN).
const PROFILE_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const PROFILE_SESSION_STORAGE_KEY = "fitPlanner.activeProfile";

function saveProfileSession(appUserId) {
  localStorage.setItem(PROFILE_SESSION_STORAGE_KEY, JSON.stringify({
    appUserId, expiresAt: Date.now() + PROFILE_SESSION_TTL_MS,
  }));
}

function loadStoredProfileId() {
  const raw = localStorage.getItem(PROFILE_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.appUserId || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(PROFILE_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed.appUserId;
  } catch (err) {
    localStorage.removeItem(PROFILE_SESSION_STORAGE_KEY);
    return null;
  }
}

function clearStoredProfileSession() {
  localStorage.removeItem(PROFILE_SESSION_STORAGE_KEY);
}

// Household login succeeded — this normally only ever happens once per
// device/browser, since Supabase persists the session (localStorage +
// auto-refresh) across app opens on its own; the "Toegangscode" screen isn't
// shown again after that. Load the data shared by the whole household
// (categories/exercises/profiles), then either silently restore a
// still-valid remembered profile or show the picker.
async function showApp() {
  authScreen.hidden = true;
  await Promise.all([loadExerciseCategories(), loadExercises(), loadAppUsers()]);
  const storedId = loadStoredProfileId();
  if (storedId && appUsers.some(u => u.id === storedId)) {
    currentAppUserId = storedId;
    saveProfileSession(storedId); // slide the 2-hour window forward
    await enterApp();
  } else {
    showProfilePicker();
  }
}

// Only once a profile is active do we load that profile's own data and start
// realtime sync — sessions/routines/etc. are meaningless without a profile.
async function enterApp() {
  profileScreen.hidden = true;
  appEl.hidden = false;
  const profile = currentAppUser();
  userEmailEl.textContent = profile ? profile.name : session.user.email;
  await Promise.all([
    loadSessions(), loadUserSettings(), loadPushSubscriptions(), loadExerciseAttachments(),
    loadRoutines(), loadRoutineExercises(),
  ]);
  setupRealtime();
  renderAll();
  trySilentPushResubscribe();
}

// ---------- profile picker ----------
function showProfilePicker() {
  profileScreen.hidden = false;
  appEl.hidden = true;
  profileMessage.textContent = "";
  if (appUsers.length === 0) {
    // First-ever use of this household account: skip straight to profile creation.
    profileTiles.hidden = true;
    profileCodePrompt.hidden = true;
    newProfileBtn.hidden = true;
    newProfileForm.hidden = false;
    newProfileName.value = "";
    newProfileCode.value = "";
    newProfileCodeConfirm.value = "";
  } else {
    profileTiles.hidden = false;
    profileCodePrompt.hidden = true;
    newProfileForm.hidden = true;
    newProfileBtn.hidden = false;
    renderProfileTiles();
  }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function renderProfileTiles() {
  profileTiles.innerHTML = appUsers.map(u =>
    `<button type="button" class="profile-tile" data-id="${u.id}">${escapeHtml(u.name)}</button>`
  ).join("");
}

profileTiles.addEventListener("click", (e) => {
  const tile = e.target.closest(".profile-tile");
  if (!tile) return;
  pendingProfileId = tile.dataset.id;
  const u = appUserById(pendingProfileId);
  profileCodePromptName.textContent = u ? u.name : "";
  profileCodeInput.value = "";
  profileMessage.textContent = "";
  profileTiles.hidden = true;
  newProfileBtn.hidden = true;
  profileCodePrompt.hidden = false;
  profileCodeInput.focus();
});

profileCodeCancelBtn.addEventListener("click", () => {
  pendingProfileId = null;
  profileCodePrompt.hidden = true;
  profileTiles.hidden = false;
  newProfileBtn.hidden = false;
});

profileCodeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = appUserById(pendingProfileId);
  if (!u) return;
  const hash = await sha256Hex(profileCodeInput.value + ":" + u.id);
  if (hash !== u.code_hash) {
    profileMessage.textContent = "Onjuiste code.";
    return;
  }
  currentAppUserId = u.id;
  saveProfileSession(u.id);
  await enterApp();
});

newProfileBtn.addEventListener("click", () => {
  profileTiles.hidden = true;
  newProfileBtn.hidden = true;
  newProfileForm.hidden = false;
  newProfileName.value = "";
  newProfileCode.value = "";
  newProfileCodeConfirm.value = "";
  profileMessage.textContent = "";
  newProfileName.focus();
});

newProfileCancelBtn.addEventListener("click", () => {
  newProfileForm.hidden = true;
  profileTiles.hidden = false;
  newProfileBtn.hidden = false;
});

newProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newProfileName.value.trim();
  const code = newProfileCode.value;
  const confirmCode = newProfileCodeConfirm.value;
  if (!name) return;
  if (code !== confirmCode) {
    profileMessage.textContent = "Codes komen niet overeen.";
    return;
  }
  // id generated client-side so it can be folded into the hash as a salt —
  // prevents a free rainbow-table attack against code_hash by anyone who can
  // read the app_users table (which, by this app's design, is every household
  // member — see CLAUDE.md's multi-user model section).
  const id = crypto.randomUUID();
  const code_hash = await sha256Hex(code + ":" + id);
  const { error } = await sb.from("app_users").insert({ id, name, code_hash, user_id: session.user.id });
  if (error) {
    profileMessage.textContent = error.message;
    return;
  }
  await loadAppUsers();
  currentAppUserId = id;
  saveProfileSession(id);
  await enterApp();
});

switchProfileBtn.addEventListener("click", () => {
  clearStoredProfileSession();
  currentAppUserId = null;
  teardownRealtime();
  appEl.hidden = true;
  showProfilePicker();
});

// ---------- data loading ----------
// exercise_categories/exercises/app_users are shared across the whole household
// (scoped only by the baseline user_id = auth.uid(), same for every profile).
async function loadExerciseCategories() {
  const { data, error } = await sb.from("exercise_categories").select("*").order("created_at", { ascending: true });
  if (!error) exerciseCategories = data;
}

async function loadExercises() {
  const { data, error } = await sb.from("exercises").select("*").order("created_at", { ascending: true });
  if (!error) exercises = data;
}

async function loadAppUsers() {
  const { data, error } = await sb.from("app_users").select("*").order("created_at", { ascending: true });
  if (!error) appUsers = data;
}

// The tables below all carry a real app_user_id column, so filtering at the
// query itself means every render function downstream can keep using
// `sessions`/`routines`/`pushSubscriptions` directly without re-filtering —
// they're scoped to the active profile by construction, not by convention.
async function loadRoutines() {
  const { data, error } = await sb.from("routines").select("*").eq("app_user_id", currentAppUserId).order("created_at", { ascending: true });
  if (!error) routines = data;
}

async function loadRoutineExercises() {
  // Not filtered by app_user_id (that column doesn't exist here on purpose —
  // see supabase-schema.sql) but only ever read through routineExercisesFor(),
  // which is only ever called with one of the current profile's own routine ids.
  const { data, error } = await sb.from("routine_exercises").select("*").order("position", { ascending: true });
  if (!error) routineExercises = data;
}

async function loadSessions() {
  const { data, error } = await sb.from("sessions").select("*").eq("app_user_id", currentAppUserId).order("scheduled_date", { ascending: true });
  if (!error) sessions = data;
}

async function loadUserSettings() {
  let { data } = await sb.from("user_settings").select("*").eq("app_user_id", currentAppUserId).maybeSingle();
  if (!data) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
    const { data: created } = await sb.from("user_settings")
      .insert({ app_user_id: currentAppUserId, user_id: session.user.id, timezone })
      .select()
      .maybeSingle();
    data = created;
  }
  userSettings = data;
}

async function loadPushSubscriptions() {
  const { data, error } = await sb.from("push_subscriptions").select("*").eq("app_user_id", currentAppUserId).order("created_at", { ascending: true });
  if (!error) pushSubscriptions = data;
}

async function loadExerciseAttachments() {
  const { data, error } = await sb.from("exercise_attachments").select("*").order("created_at", { ascending: true });
  if (!error) exerciseAttachments = data;
}

function setupRealtime() {
  teardownRealtime();
  // Can't scope this any tighter than the shared household user_id — every
  // profile shares the same auth.uid(), so this fires for every profile's
  // changes. That's fine: each handler just refetches through the per-profile
  // filtered loaders above, which do the real scoping.
  const uidFilter = `user_id=eq.${session.user.id}`;
  channel = sb
    .channel("fit-planner-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "exercise_categories", filter: uidFilter },
      async () => { await loadExerciseCategories(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "exercises", filter: uidFilter },
      async () => { await loadExercises(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "app_users", filter: uidFilter },
      async () => {
        await loadAppUsers();
        if (currentAppUserId && !appUsers.some(u => u.id === currentAppUserId)) {
          // Our profile was deleted from another device — bail out to the picker.
          clearStoredProfileSession();
          currentAppUserId = null;
          teardownRealtime();
          appEl.hidden = true;
          showProfilePicker();
          return;
        }
        renderAll();
      })
    .on("postgres_changes", { event: "*", schema: "public", table: "routines", filter: uidFilter },
      async () => { await loadRoutines(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "routine_exercises", filter: uidFilter },
      async () => { await loadRoutineExercises(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: uidFilter },
      async () => { await loadSessions(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "user_settings", filter: uidFilter },
      async () => { await loadUserSettings(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "push_subscriptions", filter: uidFilter },
      async () => { await loadPushSubscriptions(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "exercise_attachments", filter: uidFilter },
      async () => { await loadExerciseAttachments(); renderAll(); })
    .subscribe();
}

function teardownRealtime() {
  if (channel) {
    sb.removeChannel(channel);
    channel = null;
  }
}

// ---------- date helpers ----------
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(d, diff);
}

function currentWeekMonday() {
  return startOfWeek(new Date());
}

function weekDates() {
  const start = addDays(currentWeekMonday(), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function sortByTime(a, b) {
  if (!a.scheduled_time && !b.scheduled_time) return (a.created_at || "").localeCompare(b.created_at || "");
  if (!a.scheduled_time) return 1;
  if (!b.scheduled_time) return -1;
  return a.scheduled_time.localeCompare(b.scheduled_time);
}

function formatTime(t) {
  return t ? t.slice(0, 5) : "";
}

function formatFullDateNl(date) {
  const s = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWeekRange(first, last) {
  return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
}

// ---------- points / level / streak ----------
function totalPoints() {
  return sessions.filter(s => s.status === "done").reduce((sum, s) => sum + (s.points_awarded || 0), 0);
}

function computeLevel(points) {
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

function computeLevelProgress(points) {
  return points % POINTS_PER_LEVEL;
}

function computeStreak() {
  const doneDates = new Set(sessions.filter(s => s.status === "done").map(s => s.scheduled_date));
  let d = new Date();
  if (!doneDates.has(toDateStr(d))) d = addDays(d, -1);
  let streak = 0;
  while (doneDates.has(toDateStr(d))) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

// ---------- lookups ----------
function categoryById(id) {
  return exerciseCategories.find(c => c.id === id) || null;
}

function exerciseById(id) {
  return exercises.find(e => e.id === id) || null;
}

function appUserById(id) {
  return appUsers.find(u => u.id === id) || null;
}

function currentAppUser() {
  return appUserById(currentAppUserId);
}

function routineById(id) {
  return routines.find(r => r.id === id) || null;
}

function routineExercisesFor(routineId) {
  return routineExercises.filter(re => re.routine_id === routineId).sort((a, b) => a.position - b.position);
}

function firstImageAttachmentFor(exerciseId) {
  // exerciseAttachments is loaded ordered oldest-first, so this is simply the
  // first photo ever attached — same idiom as the sibling app's cover image.
  return exerciseAttachments.find(a => a.exercise_id === exerciseId) || null;
}

// Signed URLs last 3600s server-side; cached client-side for a bit less than
// that so a re-render doesn't re-request the same URL. Shared by exercise-list
// thumbnails, the exercise modal's attachment grid, and the workout player.
async function getSignedUrl(storagePath) {
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data } = await sb.storage.from("exercise-attachments").createSignedUrl(storagePath, 3600);
  if (!data) return null;
  signedUrlCache.set(storagePath, { url: data.signedUrl, expiresAt: Date.now() + 3000 * 1000 });
  return data.signedUrl;
}

function isExerciseEditable(ex) {
  // No creator on record (e.g. pre-multi-user data) defaults to editable by anyone.
  return !ex.created_by_app_user_id || ex.created_by_app_user_id === currentAppUserId;
}

// ---------- exercise categories ----------
addExerciseCategoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = addExerciseCategoryInput.value.trim();
  if (!name) return;
  const color = PALETTE[exerciseCategories.length % PALETTE.length];
  addExerciseCategoryInput.value = "";
  const { error } = await sb.from("exercise_categories").insert({ name, color, user_id: session.user.id });
  if (error) return;
  await loadExerciseCategories();
  renderAll();
});

async function deleteExerciseCategory(id) {
  await sb.from("exercise_categories").delete().eq("id", id);
  if (activeExerciseCategoryFilter === id) activeExerciseCategoryFilter = null;
  await Promise.all([loadExerciseCategories(), loadExercises()]);
  renderAll();
}

function populateCategorySelect(selectEl, selectedId) {
  const options = ['<option value="">Geen categorie</option>'].concat(
    exerciseCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
  );
  selectEl.innerHTML = options.join("");
  selectEl.value = selectedId || "";
}

// ---------- exercises (shared library; editable only by their creator) ----------
addExerciseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = addExerciseInput.value.trim();
  if (!name) return;
  const category_id = addExerciseCategorySelect.value || null;
  addExerciseInput.value = "";
  const { error } = await sb.from("exercises").insert({
    name, category_id, user_id: session.user.id, created_by_app_user_id: currentAppUserId,
  });
  if (error) return;
  await loadExercises();
  renderAll();
});

async function updateExercise(id, patch) {
  const ex = exerciseById(id);
  if (ex && !isExerciseEditable(ex)) return; // UI-level guard only, see CLAUDE.md
  await sb.from("exercises").update(patch).eq("id", id);
  await loadExercises();
  renderAll();
}

async function deleteExercise(id) {
  const ex = exerciseById(id);
  if (ex && !isExerciseEditable(ex)) return;
  const paths = exerciseAttachments.filter(a => a.exercise_id === id).map(a => a.storage_path);
  if (paths.length) await sb.storage.from("exercise-attachments").remove(paths);
  await sb.from("exercises").delete().eq("id", id);
  if (activeExerciseId === id) closeExerciseModal();
  await Promise.all([loadExercises(), loadSessions(), loadExerciseAttachments()]);
  renderAll();
}

function openExerciseModal(id) {
  activeExerciseId = id;
  exerciseModalOverlay.hidden = false;
  renderExerciseModal();
}

function closeExerciseModal() {
  activeExerciseId = null;
  exerciseModalOverlay.hidden = true;
}

exerciseModalClose.addEventListener("click", closeExerciseModal);
exerciseModalOverlay.addEventListener("click", (e) => {
  if (e.target === exerciseModalOverlay) closeExerciseModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!exerciseModalOverlay.hidden) closeExerciseModal();
  else if (!routineModalOverlay.hidden) closeRoutineModal();
});

exerciseModalName.addEventListener("blur", () => {
  const ex = exerciseById(activeExerciseId);
  if (!ex) return;
  const text = exerciseModalName.value.trim();
  if (text && text !== ex.name) updateExercise(activeExerciseId, { name: text });
  else if (!text) exerciseModalName.value = ex.name;
});
exerciseModalName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); exerciseModalName.blur(); }
});

exerciseModalCategory.addEventListener("change", () => {
  if (!activeExerciseId) return;
  updateExercise(activeExerciseId, { category_id: exerciseModalCategory.value || null });
});

function parseIntOrNull(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

exerciseModalDuration.addEventListener("change", () => {
  if (!activeExerciseId) return;
  updateExercise(activeExerciseId, { default_duration_minutes: parseIntOrNull(exerciseModalDuration.value) });
});

exerciseModalNotes.addEventListener("blur", () => {
  if (!activeExerciseId) return;
  const text = exerciseModalNotes.value.trim();
  updateExercise(activeExerciseId, { notes: text || null });
});

exerciseModalVideoUrl.addEventListener("blur", () => {
  if (!activeExerciseId) return;
  const text = exerciseModalVideoUrl.value.trim();
  updateExercise(activeExerciseId, { video_url: text || null });
});
exerciseModalVideoUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); exerciseModalVideoUrl.blur(); }
});

// ---------- video embed ----------
function parseVideoEmbed(url) {
  let u;
  try { u = new URL(url); } catch (err) { return null; }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtube.com") {
    const id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }
  if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) {
    return { type: "video", src: url };
  }
  return null;
}

function videoEmbedHtml(url) {
  const embed = parseVideoEmbed(url);
  if (embed && embed.type === "iframe") {
    return `<div class="video-embed"><iframe src="${escapeHtml(embed.src)}" title="Oefening video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (embed && embed.type === "video") {
    return `<video class="video-embed-native" src="${escapeHtml(embed.src)}" controls></video>`;
  }
  return `<a class="video-fallback-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open video in nieuw tabblad ↗</a>`;
}

// ---------- exercise photo attachments ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

exerciseAttachmentInput.addEventListener("change", async () => {
  const files = [...exerciseAttachmentInput.files];
  exerciseAttachmentInput.value = "";
  if (!files.length || !activeExerciseId) return;
  const ex = exerciseById(activeExerciseId);
  if (!ex || !isExerciseEditable(ex)) return;
  exerciseAttachmentError.textContent = "";

  for (const file of files) {
    const ext = file.name.split(".").pop().toLowerCase();
    const looksAllowed = ALLOWED_MIME.includes(file.type) || ALLOWED_EXT.includes(ext);
    if (!looksAllowed) {
      exerciseAttachmentError.textContent = `"${file.name}" is geen PNG of JPG.`;
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      exerciseAttachmentError.textContent = `"${file.name}" is groter dan 10MB.`;
      continue;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `${session.user.id}/${activeExerciseId}/${uid()}-${safeName}`;
    const mimeType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

    const { error: uploadError } = await sb.storage.from("exercise-attachments").upload(path, file, { contentType: mimeType });
    if (uploadError) {
      exerciseAttachmentError.textContent = uploadError.message;
      continue;
    }

    await sb.from("exercise_attachments").insert({
      exercise_id: activeExerciseId, user_id: session.user.id,
      file_name: file.name, storage_path: path, mime_type: mimeType, size_bytes: file.size,
    });
  }

  await loadExerciseAttachments();
  renderAll();
});

async function deleteExerciseAttachment(id) {
  const a = exerciseAttachments.find(x => x.id === id);
  if (!a) return;
  await sb.storage.from("exercise-attachments").remove([a.storage_path]);
  await sb.from("exercise_attachments").delete().eq("id", id);
  await loadExerciseAttachments();
  renderAll();
}

exerciseAttachmentsEl.addEventListener("click", (e) => {
  const delBtn = e.target.closest(".delete");
  if (delBtn) {
    e.stopPropagation();
    deleteExerciseAttachment(delBtn.dataset.id);
  }
});

// ---------- lightbox ----------
lightboxClose.addEventListener("click", closeLightbox);
lightboxOverlay.addEventListener("click", (e) => {
  if (e.target === lightboxOverlay) closeLightbox();
});

function openLightbox(html) {
  lightboxContent.innerHTML = html;
  lightboxOverlay.hidden = false;
}

function closeLightbox() {
  lightboxOverlay.hidden = true;
  lightboxContent.innerHTML = "";
}

exerciseModalArchiveBtn.addEventListener("click", () => {
  const ex = exerciseById(activeExerciseId);
  if (!ex) return;
  updateExercise(activeExerciseId, { archived: !ex.archived });
});

exerciseModalDeleteBtn.addEventListener("click", () => {
  if (!activeExerciseId) return;
  deleteExercise(activeExerciseId);
});

exerciseList.addEventListener("click", (e) => {
  const li = e.target.closest(".exercise-item");
  if (!li) return;
  openExerciseModal(li.dataset.id);
});

exerciseCategoryFilters.addEventListener("click", (e) => {
  const delBtn = e.target.closest(".cat-delete");
  if (delBtn) {
    e.stopPropagation();
    deleteExerciseCategory(delBtn.dataset.id);
    return;
  }
  const chip = e.target.closest(".filter-btn");
  if (!chip) return;
  activeExerciseCategoryFilter = activeExerciseCategoryFilter === chip.dataset.id ? null : chip.dataset.id;
  renderExercises();
});

// ---------- routines (private per profile) ----------
addRoutineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = addRoutineInput.value.trim();
  if (!name) return;
  addRoutineInput.value = "";
  const { error } = await sb.from("routines").insert({ name, app_user_id: currentAppUserId, user_id: session.user.id });
  if (error) return;
  await loadRoutines();
  renderAll();
});

async function updateRoutine(id, patch) {
  await sb.from("routines").update(patch).eq("id", id);
  await loadRoutines();
  renderAll();
}

async function deleteRoutine(id) {
  await sb.from("routines").delete().eq("id", id);
  if (activeRoutineId === id) closeRoutineModal();
  await Promise.all([loadRoutines(), loadRoutineExercises(), loadSessions()]);
  renderAll();
}

function openRoutineModal(id) {
  activeRoutineId = id;
  routineModalOverlay.hidden = false;
  renderRoutineModal();
}

function closeRoutineModal() {
  activeRoutineId = null;
  routineModalOverlay.hidden = true;
}

routineModalClose.addEventListener("click", closeRoutineModal);
routineModalOverlay.addEventListener("click", (e) => {
  if (e.target === routineModalOverlay) closeRoutineModal();
});

routineModalName.addEventListener("blur", () => {
  const r = routineById(activeRoutineId);
  if (!r) return;
  const text = routineModalName.value.trim();
  if (text && text !== r.name) updateRoutine(activeRoutineId, { name: text });
  else if (!text) routineModalName.value = r.name;
});
routineModalName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); routineModalName.blur(); }
});

routineModalSets.addEventListener("change", () => {
  if (!activeRoutineId) return;
  const n = parseIntOrNull(routineModalSets.value);
  updateRoutine(activeRoutineId, { sets: n === null || n < 1 ? 1 : n });
});

routineModalPoints.addEventListener("change", () => {
  if (!activeRoutineId) return;
  const n = parseIntOrNull(routineModalPoints.value);
  updateRoutine(activeRoutineId, { points_value: n === null ? 0 : n });
});

routineModalNotes.addEventListener("blur", () => {
  if (!activeRoutineId) return;
  const text = routineModalNotes.value.trim();
  updateRoutine(activeRoutineId, { notes: text || null });
});

routineModalArchiveBtn.addEventListener("click", () => {
  const r = routineById(activeRoutineId);
  if (!r) return;
  updateRoutine(activeRoutineId, { archived: !r.archived });
});

routineModalDeleteBtn.addEventListener("click", () => {
  if (!activeRoutineId) return;
  deleteRoutine(activeRoutineId);
});

routineList.addEventListener("click", (e) => {
  const startBtn = e.target.closest(".routine-start-btn");
  if (startBtn) {
    e.stopPropagation();
    startRoutineWorkout(startBtn.dataset.id);
    return;
  }
  const li = e.target.closest(".exercise-item");
  if (!li) return;
  openRoutineModal(li.dataset.id);
});

routineModalStartBtn.addEventListener("click", () => {
  if (activeRoutineId) startRoutineWorkout(activeRoutineId);
});

// ---------- routine-exercises (oefeningen binnen een routine) ----------
addRoutineExerciseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeRoutineId) return;
  const exerciseId = addRoutineExerciseSelect.value;
  if (!exerciseId) return;
  const reps = parseIntOrNull(addRoutineExerciseReps.value);
  const existing = routineExercisesFor(activeRoutineId);
  const position = existing.length ? Math.max(...existing.map(re => re.position)) + 1 : 0;
  const { error } = await sb.from("routine_exercises").insert({
    routine_id: activeRoutineId, exercise_id: exerciseId, reps, position, user_id: session.user.id,
  });
  addRoutineExerciseReps.value = "";
  if (error) return;
  await loadRoutineExercises();
  renderAll();
});

async function removeRoutineExercise(id) {
  await sb.from("routine_exercises").delete().eq("id", id);
  await loadRoutineExercises();
  renderAll();
}

async function updateRoutineExerciseReps(id, reps) {
  await sb.from("routine_exercises").update({ reps }).eq("id", id);
  await loadRoutineExercises();
  renderAll();
}

async function moveRoutineExercise(id, direction) {
  const list = routineExercisesFor(activeRoutineId);
  const idx = list.findIndex(re => re.id === id);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;
  const a = list[idx], b = list[swapIdx];
  await Promise.all([
    sb.from("routine_exercises").update({ position: b.position }).eq("id", a.id),
    sb.from("routine_exercises").update({ position: a.position }).eq("id", b.id),
  ]);
  await loadRoutineExercises();
  renderAll();
}

routineExerciseList.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove");
  if (removeBtn) { removeRoutineExercise(removeBtn.dataset.id); return; }
  const upBtn = e.target.closest(".reorder-btn.up");
  if (upBtn) { moveRoutineExercise(upBtn.dataset.id, "up"); return; }
  const downBtn = e.target.closest(".reorder-btn.down");
  if (downBtn) { moveRoutineExercise(downBtn.dataset.id, "down"); }
});

routineExerciseList.addEventListener("change", (e) => {
  const input = e.target.closest(".reps-input");
  if (!input) return;
  updateRoutineExerciseReps(input.dataset.id, parseIntOrNull(input.value));
});

// ---------- workout player ("Starten") ----------
// Flattens a routine's exercises into one linear sequence, repeated once per
// set — e.g. sets=3 with exercises [A, B] becomes [A, B, A, B, A, B] — so
// "afvinken" (the Klaar button) just walks forward through one flat list
// instead of needing nested round/exercise counters in the render code.
function buildWorkoutSequence(routine, items) {
  const sets = Math.max(1, routine.sets || 1);
  const sequence = [];
  for (let round = 1; round <= sets; round++) {
    for (const re of items) {
      sequence.push({ exerciseId: re.exercise_id, reps: re.reps, round, totalRounds: sets });
    }
  }
  return sequence;
}

async function startRoutineWorkout(routineId) {
  const routine = routineById(routineId);
  if (!routine) return;
  const items = routineExercisesFor(routineId);
  if (!items.length) return;

  // Reuse today's already-planned session for this routine if one exists,
  // so a workout started from a day you'd already scheduled doesn't create
  // a duplicate — otherwise create one on the fly, same as planning it
  // yourself would, just started immediately instead of for later.
  const todayStr = toDateStr(new Date());
  let s = sessions.find(x => x.routine_id === routineId && x.scheduled_date === todayStr && x.status === "planned");
  if (!s) {
    const { data, error } = await sb.from("sessions").insert({
      user_id: session.user.id,
      app_user_id: currentAppUserId,
      routine_id: routineId,
      scheduled_date: todayStr,
      status: "planned",
    }).select().maybeSingle();
    if (error || !data) return;
    await loadSessions();
    s = sessions.find(x => x.id === data.id) || data;
  }

  workoutSession = s;
  workoutSequence = buildWorkoutSequence(routine, items);
  workoutStepIndex = 0;
  workoutOverlay.hidden = false;
  renderWorkoutStep();
}

function closeWorkout() {
  workoutOverlay.hidden = true;
  workoutSession = null;
  workoutSequence = [];
  workoutStepIndex = 0;
}

async function finishWorkout() {
  const sessionId = workoutSession.id;
  closeWorkout();
  await setSessionStatus(sessionId, "done");
}

function workoutNext() {
  workoutStepIndex++;
  if (workoutStepIndex >= workoutSequence.length) finishWorkout();
  else renderWorkoutStep();
}

function workoutBack() {
  if (workoutStepIndex === 0) return;
  workoutStepIndex--;
  renderWorkoutStep();
}

function renderWorkoutStep() {
  const step = workoutSequence[workoutStepIndex];
  if (!step) return;
  const ex = exerciseById(step.exerciseId);
  const routine = workoutSession ? routineById(workoutSession.routine_id) : null;

  workoutRoutineName.textContent = routine ? routine.name : "";
  workoutProgressText.textContent = `Oefening ${workoutStepIndex + 1} van ${workoutSequence.length}`
    + (step.totalRounds > 1 ? ` · Set ${step.round}/${step.totalRounds}` : "");
  workoutProgressFill.style.width = `${Math.round((workoutStepIndex / workoutSequence.length) * 100)}%`;

  workoutExerciseName.textContent = ex ? ex.name : "Verwijderde oefening";
  workoutReps.hidden = !step.reps;
  workoutReps.textContent = step.reps ? `${step.reps} reps` : "";
  workoutNotes.hidden = !ex?.notes;
  workoutNotes.textContent = ex?.notes || "";

  workoutMedia.innerHTML = "";
  if (ex?.video_url) {
    workoutMedia.innerHTML = videoEmbedHtml(ex.video_url);
  } else if (ex) {
    const att = firstImageAttachmentFor(ex.id);
    if (att) {
      getSignedUrl(att.storage_path).then(url => {
        // Guard against a stale async response landing after the user already
        // moved to a different step (or closed the player) while it was loading.
        if (url && workoutSequence[workoutStepIndex] === step && !workoutOverlay.hidden) {
          workoutMedia.innerHTML = `<img src="${url}" alt="">`;
        }
      });
    }
  }

  workoutNextBtn.textContent = workoutStepIndex === workoutSequence.length - 1 ? "Klaar — voltooien" : "Klaar, volgende";
  workoutBackBtn.disabled = workoutStepIndex === 0;
}

workoutCloseBtn.addEventListener("click", closeWorkout);
workoutNextBtn.addEventListener("click", workoutNext);
workoutBackBtn.addEventListener("click", workoutBack);

// ---------- sessions ----------
async function setSessionStatus(id, status) {
  const patch = { status };
  if (status === "done") {
    const s = sessions.find(x => x.id === id);
    const r = s ? routineById(s.routine_id) : null;
    patch.points_awarded = r ? r.points_value : 0;
    patch.completed_at = new Date().toISOString();
  } else {
    patch.points_awarded = null;
    patch.completed_at = null;
  }
  await sb.from("sessions").update(patch).eq("id", id);
  await loadSessions();
  renderAll();
}

function toggleSessionStatus(id, targetStatus) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  setSessionStatus(id, s.status === targetStatus ? "planned" : targetStatus);
}

async function addSessionToDay(dateStr, routineId, time) {
  const { error } = await sb.from("sessions").insert({
    user_id: session.user.id,
    app_user_id: currentAppUserId,
    routine_id: routineId,
    scheduled_date: dateStr,
    scheduled_time: time || null,
    status: "planned",
  });
  if (error) return;
  await loadSessions();
  renderAll();
}

async function deleteSession(id) {
  await sb.from("sessions").delete().eq("id", id);
  await loadSessions();
  renderAll();
}

async function copyPreviousWeek() {
  const dates = weekDates();
  const thisWeekDates = dates.map(toDateStr);
  const prevWeekDates = dates.map(d => toDateStr(addDays(d, -7)));
  const prevSessions = sessions.filter(s => prevWeekDates.includes(s.scheduled_date));
  if (!prevSessions.length) return;
  const inserts = prevSessions.map(s => {
    const dayIndex = prevWeekDates.indexOf(s.scheduled_date);
    return {
      user_id: session.user.id,
      app_user_id: currentAppUserId,
      routine_id: s.routine_id,
      scheduled_date: thisWeekDates[dayIndex],
      scheduled_time: s.scheduled_time,
      status: "planned",
    };
  });
  await sb.from("sessions").insert(inserts);
  await loadSessions();
  renderAll();
}

todaySessionList.addEventListener("click", (e) => {
  const li = e.target.closest(".session-item");
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest(".done-btn")) toggleSessionStatus(id, "done");
  else if (e.target.closest(".skip-btn")) toggleSessionStatus(id, "skipped");
  else if (e.target.closest(".session-delete")) deleteSession(id);
});

weekDays.addEventListener("submit", (e) => {
  const form = e.target.closest(".day-add-form");
  if (!form) return;
  e.preventDefault();
  const select = form.querySelector("select");
  const timeInput = form.querySelector('input[type="time"]');
  const routineId = select.value;
  if (!routineId) return;
  addSessionToDay(form.dataset.date, routineId, timeInput.value);
  form.reset();
});

weekDays.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".day-session-item .remove");
  if (removeBtn) {
    deleteSession(removeBtn.dataset.id);
    return;
  }
  const item = e.target.closest(".day-session-item");
  if (!item) return;
  const id = item.dataset.id;
  if (e.target.closest(".done-btn")) toggleSessionStatus(id, "done");
  else if (e.target.closest(".skip-btn")) toggleSessionStatus(id, "skipped");
});

weekPrevBtn.addEventListener("click", () => { weekOffset -= 1; renderWeek(); });
weekNextBtn.addEventListener("click", () => { weekOffset += 1; renderWeek(); });
weekTodayBtn.addEventListener("click", () => { weekOffset = 0; renderWeek(); });
copyPrevWeekBtn.addEventListener("click", copyPreviousWeek);

// ---------- settings ----------
settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const patch = {
    timezone: settingsTimezone.value.trim() || "Europe/Amsterdam",
    daily_reminder_enabled: settingsDailyEnabled.checked,
    daily_reminder_time: settingsDailyTime.value || "18:00",
    weekly_reminder_enabled: settingsWeeklyEnabled.checked,
    weekly_reminder_day: parseInt(settingsWeeklyDay.value, 10),
    weekly_reminder_time: settingsWeeklyTime.value || "18:00",
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("user_settings").update(patch).eq("app_user_id", currentAppUserId);
  settingsMessage.textContent = error ? "Opslaan mislukt." : "Opgeslagen.";
  await loadUserSettings();
  renderAll();
});

deviceList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove");
  if (!btn) return;
  removePushSubscription(btn.dataset.id);
});

async function removePushSubscription(id) {
  await sb.from("push_subscriptions").delete().eq("id", id);
  await loadPushSubscriptions();
  renderAll();
}

async function sendTestReminder(type) {
  testReminderMessage.textContent = "Bezig met versturen...";
  const { data, error } = await sb.functions.invoke("send-reminders", {
    body: { mode: "test", type, app_user_id: currentAppUserId },
  });
  if (error) {
    testReminderMessage.textContent = "Mislukt: " + error.message;
    return;
  }
  if (data && data.ok === false) {
    testReminderMessage.textContent = data.error || "Mislukt.";
    return;
  }
  testReminderMessage.textContent = `Testmelding verstuurd naar ${data && data.sent_to != null ? data.sent_to : "?"} toestel(len).`;
}

testDailyReminderBtn.addEventListener("click", () => sendTestReminder("daily"));
testWeeklyReminderBtn.addEventListener("click", () => sendTestReminder("weekly"));

// ---------- web push ----------
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isStandaloneDisplay() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    pushHint.textContent = "Web Push wordt niet ondersteund in deze browser.";
    return;
  }
  if (!window.VAPID_PUBLIC_KEY || window.VAPID_PUBLIC_KEY.startsWith("your-")) {
    pushHint.textContent = "VAPID-sleutel nog niet geconfigureerd (zie CLAUDE.md).";
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    pushHint.textContent = "Meldingen geweigerd. Zet dit aan via je systeeminstellingen → Fit Planner → Meldingen.";
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
    });
    const { endpoint, keys } = sub.toJSON();
    await sb.from("push_subscriptions").upsert({
      user_id: session.user.id, app_user_id: currentAppUserId, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: "endpoint" });
    await loadPushSubscriptions();
    renderAll();
    pushHint.textContent = "Meldingen ingeschakeld op dit toestel.";
  } catch (err) {
    pushHint.textContent = "Kon meldingen niet inschakelen: " + err.message;
  }
}

async function trySilentPushResubscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!window.VAPID_PUBLIC_KEY || window.VAPID_PUBLIC_KEY.startsWith("your-")) return;
  try {
    const reg = await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
      });
    }
    const { endpoint, keys } = sub.toJSON();
    await sb.from("push_subscriptions").upsert({
      user_id: session.user.id, app_user_id: currentAppUserId, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: "endpoint" });
    await loadPushSubscriptions();
    renderAll();
  } catch (err) {
    // best-effort self-heal only — stay silent
  }
}

enablePushBtn.addEventListener("click", enablePushNotifications);

// ---------- navigation ----------
sidebar.addEventListener("click", (e) => {
  const btn = e.target.closest(".sidebar-item");
  if (!btn) return;
  view = btn.dataset.view;
  renderAll();
});

// ---------- rendering ----------
function renderAll() {
  sidebar.querySelectorAll(".sidebar-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  todayView.hidden = view !== "today";
  weekView.hidden = view !== "week";
  routinesView.hidden = view !== "routines";
  exercisesView.hidden = view !== "exercises";
  settingsView.hidden = view !== "settings";

  if (view === "today") renderToday();
  else if (view === "week") renderWeek();
  else if (view === "routines") renderRoutines();
  else if (view === "exercises") renderExercises();
  else if (view === "settings") renderSettings();

  if (activeExerciseId) {
    if (exercises.some(e => e.id === activeExerciseId)) renderExerciseModal();
    else closeExerciseModal();
  }
  if (activeRoutineId) {
    if (routines.some(r => r.id === activeRoutineId)) renderRoutineModal();
    else closeRoutineModal();
  }
  if (workoutSession && !routines.some(r => r.id === workoutSession.routine_id)) {
    // Routine was deleted (e.g. from another device) mid-workout.
    closeWorkout();
  }
}

function renderToday() {
  todayTitle.textContent = formatFullDateNl(new Date());
  const todayStr = toDateStr(new Date());
  const todaySessions = sessions.filter(s => s.scheduled_date === todayStr).sort(sortByTime);

  const points = totalPoints();
  levelValue.textContent = computeLevel(points);
  const progress = computeLevelProgress(points);
  levelProgressText.textContent = `${progress} / ${POINTS_PER_LEVEL}`;
  levelProgressFill.style.width = `${progress}%`;
  streakValue.innerHTML = `${computeStreak()}<span class="stat-unit">dagen</span>`;

  todaySessionList.innerHTML = todaySessions.map(s => {
    const r = routineById(s.routine_id);
    const badges = [];
    if (s.scheduled_time) badges.push(`<span class="meta-badge">${formatTime(s.scheduled_time)}</span>`);
    if (r) badges.push(`<span class="meta-badge">${r.sets} set${r.sets === 1 ? "" : "s"}</span>`);
    if (r) badges.push(`<span class="meta-badge">${r.points_value} pt</span>`);
    return `<li class="session-item ${s.status}" data-id="${s.id}">
      <div class="session-main">
        <span class="session-name">${escapeHtml(r ? r.name : "Verwijderde routine")}</span>
        <div class="session-meta">${badges.join("")}</div>
      </div>
      <div class="session-actions">
        <button type="button" class="session-action-btn done-btn${s.status === "done" ? " active" : ""}" aria-label="Klaar">✓</button>
        <button type="button" class="session-action-btn skip-btn${s.status === "skipped" ? " active" : ""}" aria-label="Overslaan">✕</button>
      </div>
      <button type="button" class="session-delete" aria-label="Verwijderen">×</button>
    </li>`;
  }).join("");
  todayEmptyState.classList.toggle("visible", todaySessions.length === 0);
}

function renderWeek() {
  const dates = weekDates();
  weekLabel.textContent = formatWeekRange(dates[0], dates[6]);
  const todayStr = toDateStr(new Date());
  const activeRoutines = routines.filter(r => !r.archived);
  const routineOptionsHtml = activeRoutines.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");

  weekDays.innerHTML = dates.map((d, i) => {
    const dateStr = toDateStr(d);
    const daySessions = sessions.filter(s => s.scheduled_date === dateStr).sort(sortByTime);
    const isToday = dateStr === todayStr;

    const itemsHtml = daySessions.map(s => {
      const r = routineById(s.routine_id);
      return `<li class="day-session-item ${s.status}" data-id="${s.id}">
        <span class="dot"></span>
        <span class="name">${escapeHtml(r ? r.name : "Verwijderde routine")}</span>
        ${s.scheduled_time ? `<span class="time">${formatTime(s.scheduled_time)}</span>` : ""}
        <div class="day-session-actions">
          <button type="button" class="day-session-action-btn done-btn${s.status === "done" ? " active" : ""}" aria-label="Klaar">✓</button>
          <button type="button" class="day-session-action-btn skip-btn${s.status === "skipped" ? " active" : ""}" aria-label="Overslaan">✕</button>
        </div>
        <button type="button" class="remove" data-id="${s.id}" aria-label="Verwijderen">×</button>
      </li>`;
    }).join("");

    return `<div class="day-card${isToday ? " is-today" : ""}">
      <div class="day-card-header">
        <span class="day-card-weekday">${WEEKDAY_NAMES[i]}</span>
        <span class="day-card-date">${d.getDate()} ${MONTH_NAMES[d.getMonth()]}</span>
      </div>
      <ul class="day-sessions">${itemsHtml}</ul>
      <form class="day-add-form" data-date="${dateStr}">
        <select required>
          <option value="">${activeRoutines.length ? "Kies routine..." : "Geen routines"}</option>
          ${routineOptionsHtml}
        </select>
        <input type="time">
        <button type="submit">+ Toevoegen</button>
      </form>
    </div>`;
  }).join("");
}

function renderExerciseCategoryFilters() {
  exerciseCategoryFilters.innerHTML = exerciseCategories.map(c => {
    const count = exercises.filter(e => e.category_id === c.id && !e.archived).length;
    const active = activeExerciseCategoryFilter === c.id;
    return `<button type="button" class="filter-btn${active ? " active" : ""}" data-id="${c.id}" style="--cat-color:${c.color}">
      ${escapeHtml(c.name)} <span class="cat-count">${count}</span>
      <span class="cat-delete" data-id="${c.id}">×</span>
    </button>`;
  }).join("");
}

function renderExercises() {
  renderExerciseCategoryFilters();
  populateCategorySelect(addExerciseCategorySelect, addExerciseCategorySelect.value);

  const filtered = exercises.filter(e => !activeExerciseCategoryFilter || e.category_id === activeExerciseCategoryFilter);
  const sorted = [...filtered].sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1));

  exerciseList.innerHTML = sorted.map(e => {
    const cat = categoryById(e.category_id);
    const creator = appUserById(e.created_by_app_user_id);
    const thumb = firstImageAttachmentFor(e.id);
    const badges = [];
    if (cat) badges.push(`<span class="meta-badge cat" style="--cat-color:${cat.color}">${escapeHtml(cat.name)}</span>`);
    if (creator) badges.push(`<span class="meta-badge">${escapeHtml(creator.name)}</span>`);
    if (e.archived) badges.push(`<span class="meta-badge">Gearchiveerd</span>`);
    return `<li class="exercise-item${e.archived ? " archived" : ""}" data-id="${e.id}">
      ${thumb ? `<div class="exercise-thumb" data-path="${escapeHtml(thumb.storage_path)}"></div>` : ""}
      <div class="exercise-main">
        <span class="exercise-name">${escapeHtml(e.name)}</span>
        <div class="session-meta">${badges.join("")}</div>
      </div>
    </li>`;
  }).join("");
  exerciseEmptyState.classList.toggle("visible", sorted.length === 0);
  loadExerciseThumbnails();
}

async function loadExerciseThumbnails() {
  const slots = [...exerciseList.querySelectorAll(".exercise-thumb[data-path]")];
  for (const slot of slots) {
    const path = slot.dataset.path;
    const url = await getSignedUrl(path);
    if (url && slot.isConnected) slot.innerHTML = `<img src="${url}" alt="">`;
  }
}

function renderExerciseModal() {
  const ex = exerciseById(activeExerciseId);
  if (!ex) return;
  const editable = isExerciseEditable(ex);

  if (document.activeElement !== exerciseModalName) exerciseModalName.value = ex.name;
  populateCategorySelect(exerciseModalCategory, ex.category_id);
  if (document.activeElement !== exerciseModalDuration) exerciseModalDuration.value = ex.default_duration_minutes ?? "";
  if (document.activeElement !== exerciseModalNotes) exerciseModalNotes.value = ex.notes || "";
  if (document.activeElement !== exerciseModalVideoUrl) exerciseModalVideoUrl.value = ex.video_url || "";
  exerciseModalVideoEmbed.innerHTML = ex.video_url ? videoEmbedHtml(ex.video_url) : "";
  exerciseModalArchiveBtn.textContent = ex.archived ? "Herstel" : "Archiveer";

  const creator = appUserById(ex.created_by_app_user_id);
  exerciseModalOwnerBadge.hidden = !creator;
  exerciseModalOwnerBadge.textContent = creator ? `Aangemaakt door ${creator.name}` : "";

  [exerciseModalName, exerciseModalCategory, exerciseModalDuration, exerciseModalNotes, exerciseModalVideoUrl].forEach(el => {
    el.disabled = !editable;
  });
  exerciseModalArchiveBtn.hidden = !editable;
  exerciseModalDeleteBtn.hidden = !editable;
  const uploadLabel = exerciseAttachmentInput.closest("label");
  if (uploadLabel) uploadLabel.hidden = !editable;

  renderExerciseModalAttachments(activeExerciseId);
}

async function renderExerciseModalAttachments(exerciseId) {
  const ex = exerciseById(exerciseId);
  const editable = ex ? isExerciseEditable(ex) : false;
  const items = exerciseAttachments.filter(a => a.exercise_id === exerciseId);
  exerciseAttachmentsEl.innerHTML = "";

  for (const a of items) {
    if (exerciseId !== activeExerciseId) return; // modal switched/closed while signed URLs were loading

    const card = document.createElement("div");
    card.className = "attachment-card";

    const url = await getSignedUrl(a.storage_path);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = a.file_name;
      img.addEventListener("click", () => openLightbox(`<img src="${url}" alt="${escapeHtml(a.file_name)}">`));
      card.appendChild(img);
    }

    const name = document.createElement("span");
    name.className = "attachment-name";
    name.textContent = a.file_name;
    card.appendChild(name);

    if (editable) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete";
      del.dataset.id = a.id;
      del.setAttribute("aria-label", "Verwijderen");
      del.textContent = "×";
      card.appendChild(del);
    }

    exerciseAttachmentsEl.appendChild(card);
  }
}

function renderRoutines() {
  const sorted = [...routines].sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1));
  routineList.innerHTML = sorted.map(r => {
    const count = routineExercisesFor(r.id).length;
    const badges = [
      `<span class="meta-badge">${r.sets} set${r.sets === 1 ? "" : "s"}</span>`,
      `<span class="meta-badge">${r.points_value} pt</span>`,
      `<span class="meta-badge">${count} oefening${count === 1 ? "" : "en"}</span>`,
    ];
    if (r.archived) badges.push(`<span class="meta-badge">Gearchiveerd</span>`);
    return `<li class="exercise-item${r.archived ? " archived" : ""}" data-id="${r.id}">
      <div class="exercise-main">
        <span class="exercise-name">${escapeHtml(r.name)}</span>
        <div class="session-meta">${badges.join("")}</div>
      </div>
      ${!r.archived && count > 0 ? `<button type="button" class="routine-start-btn" data-id="${r.id}">▶ Starten</button>` : ""}
    </li>`;
  }).join("");
  routineEmptyState.classList.toggle("visible", sorted.length === 0);
}

function renderRoutineModal() {
  const r = routineById(activeRoutineId);
  if (!r) return;
  if (document.activeElement !== routineModalName) routineModalName.value = r.name;
  if (document.activeElement !== routineModalSets) routineModalSets.value = r.sets ?? 1;
  if (document.activeElement !== routineModalPoints) routineModalPoints.value = r.points_value ?? 10;
  if (document.activeElement !== routineModalNotes) routineModalNotes.value = r.notes || "";
  routineModalArchiveBtn.textContent = r.archived ? "Herstel" : "Archiveer";

  const items = routineExercisesFor(r.id);
  routineExerciseList.innerHTML = items.map((re, i) => {
    const ex = exerciseById(re.exercise_id);
    return `<li class="routine-exercise-item" data-id="${re.id}">
      <span class="name">${escapeHtml(ex ? ex.name : "Verwijderde oefening")}</span>
      <input class="reps-input" type="number" min="0" step="1" placeholder="Reps" value="${re.reps ?? ""}" data-id="${re.id}">
      <button type="button" class="reorder-btn up" data-id="${re.id}" aria-label="Omhoog"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" class="reorder-btn down" data-id="${re.id}" aria-label="Omlaag"${i === items.length - 1 ? " disabled" : ""}>↓</button>
      <button type="button" class="remove" data-id="${re.id}" aria-label="Verwijderen">×</button>
    </li>`;
  }).join("");

  const activeExercises = exercises.filter(e => !e.archived);
  addRoutineExerciseSelect.innerHTML = activeExercises.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("");

  routineModalStartBtn.hidden = items.length === 0;
}

function shortenUserAgent(ua) {
  return ua.length > 48 ? ua.slice(0, 48) + "…" : ua;
}

function renderSettings() {
  const profile = currentAppUser();
  currentProfileHint.textContent = profile ? `Ingelogd als ${profile.name}.` : "";

  if (!userSettings) return;
  if (document.activeElement !== settingsTimezone) settingsTimezone.value = userSettings.timezone;
  settingsDailyEnabled.checked = userSettings.daily_reminder_enabled;
  if (document.activeElement !== settingsDailyTime) settingsDailyTime.value = formatTime(userSettings.daily_reminder_time);
  settingsWeeklyEnabled.checked = userSettings.weekly_reminder_enabled;
  settingsWeeklyDay.value = String(userSettings.weekly_reminder_day);
  if (document.activeElement !== settingsWeeklyTime) settingsWeeklyTime.value = formatTime(userSettings.weekly_reminder_time);

  const iosNotStandalone = /iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandaloneDisplay();
  if (iosNotStandalone) {
    enablePushBtn.hidden = true;
    pushHint.textContent = "Voeg deze app eerst toe aan je beginscherm (deel-icoon → Zet op beginscherm) om meldingen te kunnen ontvangen.";
  } else {
    enablePushBtn.hidden = false;
    pushHint.textContent = pushSubscriptions.length
      ? `Meldingen zijn ingeschakeld op ${pushSubscriptions.length} toestel${pushSubscriptions.length === 1 ? "" : "len"}.`
      : "Nog geen toestel geregistreerd voor pushmeldingen.";
  }

  deviceList.innerHTML = pushSubscriptions.map(p => `<li class="device-item" data-id="${p.id}">
    <span>${escapeHtml(p.user_agent ? shortenUserAgent(p.user_agent) : "Onbekend toestel")}</span>
    <button type="button" class="remove" data-id="${p.id}">Verwijderen</button>
  </li>`).join("");
}

// ---------- utils ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
