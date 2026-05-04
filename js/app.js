import {
  computeScoreDifferential,
  computeHandicapIndex,
  differentialsForIndex,
  lowestDifferentialCount,
} from "./handicap.js";
import { searchCourses, getCourse, listTeeOptions, formatCourseLabel } from "./golfcourse-api.js";
import { initTheme } from "./theme.js";

const STORAGE_KEY = "golf-handicap-rounds-v1";
const API_KEY_STORAGE = "golf-handicap-golfcourse-api-key";

/** @type {object|null} */
let loadedCourse = null;

/** @type {Array<{ course_rating: number, slope_rating: number, par_total: number, tee_name: string, gender: string, label: string }>} */
let loadedTees = [];

function loadRounds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveRounds(rounds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

function renderRounds(rounds) {
  const tbody = el("rounds-body");
  tbody.replaceChildren();

  if (rounds.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "empty";
    td.textContent = "No rounds yet. Add a scorecard row below.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const sorted = [...rounds].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  for (const r of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.course)}</td>
      <td class="num">${r.ags}</td>
      <td class="num">${r.cr.toFixed(1)}</td>
      <td class="num">${r.slope}</td>
      <td class="num">${r.par}</td>
      <td class="num strong">${r.differential.toFixed(1)}</td>
      <td><button type="button" class="btn danger sm" data-id="${r.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const next = loadRounds().filter((x) => x.id !== id);
      saveRounds(next);
      refresh();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatApiError(err) {
  if (!err) return "Something went wrong.";
  const name = err.name || "";
  const msg = err.message || String(err);
  const netFail = name === "TypeError" || msg === "Failed to fetch" || msg.includes("NetworkError");
  if (netFail && typeof location !== "undefined" && location.protocol === "file:") {
    return (
      "Course search cannot run from a file: URL (browser blocks cross-origin requests). " +
      "In the project folder run: node server.mjs — then open http://127.0.0.1:8765/app.html in the browser."
    );
  }
  if (netFail) {
    return (
      "Could not reach the API (often CORS). From the project folder run: node server.mjs — then open " +
      "http://127.0.0.1:8765/app.html (not Live Server / another host unless it proxies /api/golfcourse). " +
      "Or set localStorage golf-handicap-cors-proxy to your Cloudflare worker URL ending in /v1."
    );
  }
  const low = msg.toLowerCase();
  if (low.includes("api key") && (low.includes("invalid") || low.includes("missing"))) {
    return (
      msg +
      " If you just registered, confirm your email and activate your account at golfcourseapi.com (sign-in flow)."
    );
  }
  return msg;
}

function refresh() {
  const rounds = loadRounds();
  for (const r of rounds) {
    r.differential = computeScoreDifferential(r.ags, r.cr, r.slope, r.pcc ?? 0);
  }
  saveRounds(rounds);

  renderRounds(rounds);

  const forIndex = rounds.map((r) => ({ date: r.date, differential: r.differential }));
  const diffs = differentialsForIndex(forIndex);
  const result = computeHandicapIndex(diffs);

  const hiEl = el("handicap-index");
  const metaEl = el("hi-meta");

  if (result.index == null) {
    hiEl.textContent = "—";
    metaEl.textContent = result.error || "";
  } else {
    const sign = result.index > 0 ? "+" : "";
    hiEl.textContent = sign + result.index.toFixed(1);
    const n = diffs.length;
    const k = lowestDifferentialCount(n);
    metaEl.textContent = `Based on ${n} score(s) in record; averaging the lowest ${k} score differential(s). Last 20 rounds are used when you have more than 20.`;
  }
}

function addRound(e) {
  e.preventDefault();
  const course = el("in-course").value.trim() || "Course";
  const date = el("in-date").value || new Date().toISOString().slice(0, 10);
  const ags = parseInt(el("in-ags").value, 10);
  const cr = parseFloat(el("in-cr").value);
  const slope = parseInt(el("in-slope").value, 10);
  const par = parseInt(el("in-par").value, 10);
  const pcc = parseInt(el("in-pcc").value, 10) || 0;

  if (!Number.isFinite(ags) || !Number.isFinite(cr) || !Number.isFinite(slope) || !Number.isFinite(par)) {
    alert("Please enter valid numbers for gross, rating, slope, and par.");
    return;
  }

  const differential = computeScoreDifferential(ags, cr, slope, pcc);
  const id = crypto.randomUUID();

  const rounds = loadRounds();
  rounds.push({ id, course, date, ags, cr, slope, par, pcc, differential });
  saveRounds(rounds);
  refresh();
  el("form-round").reset();
  el("in-date").value = date;
}

function exportData() {
  const rounds = loadRounds();
  const blob = new Blob([JSON.stringify({ version: 1, rounds }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `golf-handicap-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const incoming = Array.isArray(data.rounds) ? data.rounds : data;
      if (!Array.isArray(incoming)) throw new Error("Invalid file");
      const rounds = incoming
        .filter((r) => r && typeof r === "object")
        .map((r) => ({
          id: r.id || crypto.randomUUID(),
          course: String(r.course || "Course"),
          date: String(r.date || "").slice(0, 10),
          ags: Number(r.ags),
          cr: Number(r.cr),
          slope: Number(r.slope),
          par: Number(r.par),
          pcc: Number(r.pcc) || 0,
          differential: 0,
        }));
      saveRounds(rounds);
      refresh();
    } catch (err) {
      alert("Could not import file: " + (err && err.message ? err.message : String(err)));
    }
  };
  reader.readAsText(file);
}

function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

function saveApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

function setApiMessage(message, isError) {
  const node = el("api-msg");
  node.textContent = message || "";
  node.classList.toggle("error", Boolean(isError));
}

function getSelectedTee() {
  const select = el("tee-select");
  const i = select.selectedIndex;
  if (i < 0 || !loadedTees[i]) return null;
  return loadedTees[i];
}

function hideCourseDetail() {
  loadedCourse = null;
  loadedTees = [];
  el("course-detail-panel").classList.add("hidden");
  el("tee-select").replaceChildren();
  el("course-detail-title").textContent = "";
}

function showCourseDetail(course, tees) {
  loadedCourse = course;
  loadedTees = tees;
  const panel = el("course-detail-panel");
  const title = el("course-detail-title");
  const club = String(course.club_name || "").trim();
  const cname = String(course.course_name || "").trim();
  title.textContent = [club, cname].filter(Boolean).join(" — ") || "Course";

  const select = el("tee-select");
  select.replaceChildren();
  if (tees.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No tee / rating data";
    select.appendChild(opt);
    panel.classList.remove("hidden");
    return;
  }
  tees.forEach((t, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = t.label;
    select.appendChild(opt);
  });
  panel.classList.remove("hidden");
}

async function runCourseSearch() {
  const apiKey = loadApiKey() || el("golf-api-key").value.trim();
  const q = el("course-search-q").value.trim();
  const resultsEl = el("search-results");
  resultsEl.replaceChildren();
  resultsEl.hidden = true;
  hideCourseDetail();
  setApiMessage("");

  if (!apiKey) {
    setApiMessage("Save your GolfCourseAPI key first (sign up at golfcourseapi.com).", true);
    return;
  }

  setApiMessage("Searching…");
  try {
    const courses = await searchCourses(apiKey, q);
    setApiMessage(courses.length ? `${courses.length} result(s).` : "No courses found.");
    if (courses.length === 0) return;

    for (const c of courses) {
      const li = document.createElement("li");
      const addr = c.location && c.location.address ? String(c.location.address) : "";
      li.innerHTML = `
        <div class="search-hit">
          <div>
            <span class="search-hit-name">${escapeHtml(c.club_name || "")}</span>
            <span class="search-hit-course">${escapeHtml(c.course_name || "")}</span>
            ${addr ? `<div class="search-hit-addr">${escapeHtml(addr)}</div>` : ""}
          </div>
          <button type="button" class="btn secondary sm" data-course-id="${Number(c.id)}">Load</button>
        </div>
      `;
      const btn = li.querySelector("button[data-course-id]");
      btn.addEventListener("click", () => loadCourseById(Number(c.id)));
      resultsEl.appendChild(li);
    }
    resultsEl.hidden = false;
  } catch (err) {
    setApiMessage(formatApiError(err), true);
  }
}

async function loadCourseById(courseId) {
  const apiKey = loadApiKey() || el("golf-api-key").value.trim();
  if (!apiKey) {
    setApiMessage("Save your GolfCourseAPI key first.", true);
    return;
  }
  setApiMessage("Loading course…");
  try {
    const course = await getCourse(apiKey, courseId);
    const tees = listTeeOptions(course);
    if (tees.length === 0) {
      setApiMessage("This course has no slope/rating tee data in the API.", true);
      showCourseDetail(course, []);
      return;
    }
    showCourseDetail(course, tees);
    setApiMessage("Select a tee, then use Apply to add round.");
  } catch (err) {
    setApiMessage(formatApiError(err), true);
    hideCourseDetail();
  }
}

function applyTeeToRoundForm() {
  if (!loadedCourse) return;
  const tee = getSelectedTee();
  if (!tee) {
    setApiMessage("Select a tee with rating data.", true);
    return;
  }
  const label = formatCourseLabel(loadedCourse, tee);
  el("in-course").value = label;
  el("in-cr").value = String(tee.course_rating);
  el("in-slope").value = String(tee.slope_rating);
  el("in-par").value = String(tee.par_total);
  setApiMessage("Round form updated — enter your adjusted gross and add the round.");
}

async function detectDevApiProxy() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const r = await fetch("/.dev-proxy-health", { cache: "no-store" });
    if (r.ok) sessionStorage.setItem("golf-dev-api-proxy", "1");
    else sessionStorage.removeItem("golf-dev-api-proxy");
  } catch {
    sessionStorage.removeItem("golf-dev-api-proxy");
  }
}

function initCourseLookup() {
  const keyInput = el("golf-api-key");
  keyInput.value = loadApiKey();

  el("btn-save-api-key").addEventListener("click", () => {
    const k = keyInput.value.trim();
    if (!k) {
      setApiMessage("Paste an API key first.", true);
      return;
    }
    saveApiKey(k);
    setApiMessage("API key saved in this browser only.");
  });

  el("btn-clear-api-key").addEventListener("click", () => {
    clearApiKey();
    keyInput.value = "";
    el("search-results").replaceChildren();
    el("search-results").hidden = true;
    hideCourseDetail();
    setApiMessage("API key cleared.");
  });

  el("btn-course-search").addEventListener("click", () => {
    runCourseSearch();
  });

  el("course-search-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCourseSearch();
    }
  });

  el("btn-fill-round").addEventListener("click", applyTeeToRoundForm);
}

async function init() {
  el("in-date").value = new Date().toISOString().slice(0, 10);

  await detectDevApiProxy();

  el("form-round").addEventListener("submit", addRound);
  el("btn-export").addEventListener("click", exportData);
  el("file-import").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importData(f);
    e.target.value = "";
  });

  initTheme();
  initCourseLookup();
  refresh();
}

init().catch((e) => console.error(e));
