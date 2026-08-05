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
let sessions = [];
let userSettings = null;
let pushSubscriptions = [];
let exerciseAttachments = [];
let channel = null;
let view = "today"; // "today" | "week" | "exercises" | "settings"
let weekOffset = 0; // weeks relative to the current week
let activeExerciseCategoryFilter = null;
let activeExerciseId = null;

// ---------- elements ----------
const authScreen = document.getElementById("authScreen");
const authTabs = document.getElementById("authTabs");
const authForm = document.getElementById("authForm");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");

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

const exerciseModalOverlay = document.getElementById("exerciseModalOverlay");
const exerciseModalClose = document.getElementById("exerciseModalClose");
const exerciseModalName = document.getElementById("exerciseModalName");
const exerciseModalCategory = document.getElementById("exerciseModalCategory");
const exerciseModalSets = document.getElementById("exerciseModalSets");
const exerciseModalReps = document.getElementById("exerciseModalReps");
const exerciseModalDuration = document.getElementById("exerciseModalDuration");
const exerciseModalPoints = document.getElementById("exerciseModalPoints");
const exerciseModalNotes = document.getElementById("exerciseModalNotes");
const exerciseModalVideoUrl = document.getElementById("exerciseModalVideoUrl");
const exerciseModalVideoEmbed = document.getElementById("exerciseModalVideoEmbed");
const exerciseAttachmentsEl = document.getElementById("exerciseAttachments");
const exerciseAttachmentInput = document.getElementById("exerciseAttachmentInput");
const exerciseAttachmentError = document.getElementById("exerciseAttachmentError");
const exerciseModalArchiveBtn = document.getElementById("exerciseModalArchiveBtn");
const exerciseModalDeleteBtn = document.getElementById("exerciseModalDeleteBtn");

const lightboxOverlay = document.getElementById("lightboxOverlay");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxContent = document.getElementById("lightboxContent");

let authMode = "signin";

// ---------- auth ----------
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
  authScreen.hidden = false;
  appEl.hidden = true;
}

async function showApp() {
  authScreen.hidden = true;
  appEl.hidden = false;
  userEmailEl.textContent = session.user.email;
  await Promise.all([
    loadExerciseCategories(), loadExercises(), loadSessions(),
    loadUserSettings(), loadPushSubscriptions(), loadExerciseAttachments(),
  ]);
  setupRealtime();
  renderAll();
  trySilentPushResubscribe();
}

// ---------- data loading ----------
async function loadExerciseCategories() {
  const { data, error } = await sb.from("exercise_categories").select("*").order("created_at", { ascending: true });
  if (!error) exerciseCategories = data;
}

async function loadExercises() {
  const { data, error } = await sb.from("exercises").select("*").order("created_at", { ascending: true });
  if (!error) exercises = data;
}

async function loadSessions() {
  const { data, error } = await sb.from("sessions").select("*").order("scheduled_date", { ascending: true });
  if (!error) sessions = data;
}

async function loadUserSettings() {
  let { data } = await sb.from("user_settings").select("*").eq("user_id", session.user.id).maybeSingle();
  if (!data) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
    const { data: created } = await sb.from("user_settings")
      .insert({ user_id: session.user.id, timezone })
      .select()
      .maybeSingle();
    data = created;
  }
  userSettings = data;
}

async function loadPushSubscriptions() {
  const { data, error } = await sb.from("push_subscriptions").select("*").order("created_at", { ascending: true });
  if (!error) pushSubscriptions = data;
}

async function loadExerciseAttachments() {
  const { data, error } = await sb.from("exercise_attachments").select("*").order("created_at", { ascending: true });
  if (!error) exerciseAttachments = data;
}

function setupRealtime() {
  teardownRealtime();
  const uidFilter = `user_id=eq.${session.user.id}`;
  channel = sb
    .channel("fit-planner-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "exercise_categories", filter: uidFilter },
      async () => { await loadExerciseCategories(); renderAll(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "exercises", filter: uidFilter },
      async () => { await loadExercises(); renderAll(); })
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

// ---------- exercises ----------
addExerciseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = addExerciseInput.value.trim();
  if (!name) return;
  const category_id = addExerciseCategorySelect.value || null;
  addExerciseInput.value = "";
  const { error } = await sb.from("exercises").insert({ name, category_id, user_id: session.user.id });
  if (error) return;
  await loadExercises();
  renderAll();
});

async function updateExercise(id, patch) {
  await sb.from("exercises").update(patch).eq("id", id);
  await loadExercises();
  renderAll();
}

async function deleteExercise(id) {
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
  if (e.key === "Escape" && !exerciseModalOverlay.hidden) closeExerciseModal();
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

exerciseModalSets.addEventListener("change", () => {
  if (!activeExerciseId) return;
  updateExercise(activeExerciseId, { default_sets: parseIntOrNull(exerciseModalSets.value) });
});
exerciseModalReps.addEventListener("change", () => {
  if (!activeExerciseId) return;
  updateExercise(activeExerciseId, { default_reps: parseIntOrNull(exerciseModalReps.value) });
});
exerciseModalDuration.addEventListener("change", () => {
  if (!activeExerciseId) return;
  updateExercise(activeExerciseId, { default_duration_minutes: parseIntOrNull(exerciseModalDuration.value) });
});
exerciseModalPoints.addEventListener("change", () => {
  if (!activeExerciseId) return;
  const points = parseIntOrNull(exerciseModalPoints.value);
  updateExercise(activeExerciseId, { points_value: points === null ? 0 : points });
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

// ---------- sessions ----------
async function setSessionStatus(id, status) {
  const patch = { status };
  if (status === "done") {
    const s = sessions.find(x => x.id === id);
    const ex = s ? exerciseById(s.exercise_id) : null;
    patch.points_awarded = ex ? ex.points_value : 0;
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

async function addSessionToDay(dateStr, exerciseId, time) {
  const { error } = await sb.from("sessions").insert({
    user_id: session.user.id,
    exercise_id: exerciseId,
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
      exercise_id: s.exercise_id,
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
  const exerciseId = select.value;
  if (!exerciseId) return;
  addSessionToDay(form.dataset.date, exerciseId, timeInput.value);
  form.reset();
});

weekDays.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".day-session-item .remove");
  if (removeBtn) {
    deleteSession(removeBtn.dataset.id);
    return;
  }
  const item = e.target.closest(".day-session-item");
  if (item) toggleSessionStatus(item.dataset.id, "done");
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
  const { error } = await sb.from("user_settings").update(patch).eq("user_id", session.user.id);
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
      user_id: session.user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
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
      user_id: session.user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
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
  exercisesView.hidden = view !== "exercises";
  settingsView.hidden = view !== "settings";

  if (view === "today") renderToday();
  else if (view === "week") renderWeek();
  else if (view === "exercises") renderExercises();
  else if (view === "settings") renderSettings();

  if (activeExerciseId) {
    if (exercises.some(e => e.id === activeExerciseId)) renderExerciseModal();
    else closeExerciseModal();
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
    const ex = exerciseById(s.exercise_id);
    const cat = ex ? categoryById(ex.category_id) : null;
    const badges = [];
    if (cat) badges.push(`<span class="meta-badge cat" style="--cat-color:${cat.color}">${escapeHtml(cat.name)}</span>`);
    if (s.scheduled_time) badges.push(`<span class="meta-badge">${formatTime(s.scheduled_time)}</span>`);
    if (ex) badges.push(`<span class="meta-badge">${ex.points_value} pt</span>`);
    return `<li class="session-item ${s.status}" data-id="${s.id}">
      <div class="session-main">
        <span class="session-name">${escapeHtml(ex ? ex.name : "Verwijderde oefening")}</span>
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
  const activeExercises = exercises.filter(e => !e.archived);
  const exerciseOptionsHtml = activeExercises.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("");

  weekDays.innerHTML = dates.map((d, i) => {
    const dateStr = toDateStr(d);
    const daySessions = sessions.filter(s => s.scheduled_date === dateStr).sort(sortByTime);
    const isToday = dateStr === todayStr;

    const itemsHtml = daySessions.map(s => {
      const ex = exerciseById(s.exercise_id);
      const cat = ex ? categoryById(ex.category_id) : null;
      return `<li class="day-session-item${s.status === "done" ? " done" : ""}" data-id="${s.id}"${cat ? ` style="--cat-color:${cat.color}"` : ""}>
        <span class="dot"></span>
        <span class="name">${escapeHtml(ex ? ex.name : "Verwijderde oefening")}</span>
        ${s.scheduled_time ? `<span class="time">${formatTime(s.scheduled_time)}</span>` : ""}
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
          <option value="">${activeExercises.length ? "Kies oefening..." : "Geen oefeningen"}</option>
          ${exerciseOptionsHtml}
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
    const badges = [];
    if (cat) badges.push(`<span class="meta-badge cat" style="--cat-color:${cat.color}">${escapeHtml(cat.name)}</span>`);
    badges.push(`<span class="meta-badge">${e.points_value} pt</span>`);
    if (e.archived) badges.push(`<span class="meta-badge">Gearchiveerd</span>`);
    return `<li class="exercise-item${e.archived ? " archived" : ""}" data-id="${e.id}">
      <div class="exercise-main">
        <span class="exercise-name">${escapeHtml(e.name)}</span>
        <div class="session-meta">${badges.join("")}</div>
      </div>
    </li>`;
  }).join("");
  exerciseEmptyState.classList.toggle("visible", sorted.length === 0);
}

function renderExerciseModal() {
  const ex = exerciseById(activeExerciseId);
  if (!ex) return;
  if (document.activeElement !== exerciseModalName) exerciseModalName.value = ex.name;
  populateCategorySelect(exerciseModalCategory, ex.category_id);
  if (document.activeElement !== exerciseModalSets) exerciseModalSets.value = ex.default_sets ?? "";
  if (document.activeElement !== exerciseModalReps) exerciseModalReps.value = ex.default_reps ?? "";
  if (document.activeElement !== exerciseModalDuration) exerciseModalDuration.value = ex.default_duration_minutes ?? "";
  if (document.activeElement !== exerciseModalPoints) exerciseModalPoints.value = ex.points_value ?? 10;
  if (document.activeElement !== exerciseModalNotes) exerciseModalNotes.value = ex.notes || "";
  if (document.activeElement !== exerciseModalVideoUrl) exerciseModalVideoUrl.value = ex.video_url || "";
  exerciseModalVideoEmbed.innerHTML = ex.video_url ? videoEmbedHtml(ex.video_url) : "";
  exerciseModalArchiveBtn.textContent = ex.archived ? "Herstel" : "Archiveer";
  renderExerciseModalAttachments(activeExerciseId);
}

async function renderExerciseModalAttachments(exerciseId) {
  const items = exerciseAttachments.filter(a => a.exercise_id === exerciseId);
  exerciseAttachmentsEl.innerHTML = "";

  for (const a of items) {
    if (exerciseId !== activeExerciseId) return; // modal switched/closed while signed URLs were loading

    const card = document.createElement("div");
    card.className = "attachment-card";

    const { data } = await sb.storage.from("exercise-attachments").createSignedUrl(a.storage_path, 3600);
    const url = data ? data.signedUrl : null;
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

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.dataset.id = a.id;
    del.setAttribute("aria-label", "Verwijderen");
    del.textContent = "×";
    card.appendChild(del);

    exerciseAttachmentsEl.appendChild(card);
  }
}

function shortenUserAgent(ua) {
  return ua.length > 48 ? ua.slice(0, 48) + "…" : ua;
}

function renderSettings() {
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
