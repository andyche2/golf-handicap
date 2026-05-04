/**
 * GolfCourseAPI — https://api.golfcourseapi.com/docs/api
 * Auth: `Authorization: Key <your API key>` (raw key; OpenAPI — not JSON-quoted).
 * Register for a free key at https://golfcourseapi.com
 *
 * Browser note: GolfCourseAPI’s CORS preflight omits GET from Access-Control-Allow-Methods,
 * so direct `fetch` to api.golfcourseapi.com from a page usually fails with "Failed to fetch".
 *
 * Fix CORS: use same-origin `/api/golfcourse/v1` (provided by `node server.mjs`). The app also sets a session flag
 * after `/.dev-proxy-health` for LAN origins (e.g. http://192.168.x.x:8765).
 *
 * Optional worker for static hosting: `localStorage.setItem('golf-handicap-cors-proxy', 'https://…/v1')` (no UI).
 */

const DEFAULT_API_BASE = "https://api.golfcourseapi.com/v1";
const PROXY_STORAGE_KEY = "golf-handicap-cors-proxy";

/** Prefer built-in proxy on loopback without relying on sessionStorage (private mode / race / health hiccups). */
function useLoopbackSameOriginProxy() {
  if (typeof window === "undefined") return false;
  try {
    const h = (window.location.hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

function resolveApiBase() {
  if (typeof window === "undefined") return DEFAULT_API_BASE;

  try {
    const raw = localStorage.getItem(PROXY_STORAGE_KEY)?.trim();
    if (raw) {
      let b = raw.replace(/\/+$/, "");
      if (!b.endsWith("/v1")) b = `${b}/v1`;
      return b;
    }
  } catch {
    /* ignore */
  }

  if (useLoopbackSameOriginProxy()) {
    return `${window.location.origin}/api/golfcourse/v1`;
  }

  try {
    if (sessionStorage.getItem("golf-dev-api-proxy") === "1") {
      return `${window.location.origin}/api/golfcourse/v1`;
    }
  } catch {
    /* ignore */
  }

  return DEFAULT_API_BASE;
}

/**
 * Normalize pasted keys (wrapping quotes, `Key …`, `Bearer …`, accidental `Authorization:` line).
 * @param {string} apiKey
 */
function normalizeApiKey(apiKey) {
  let s = String(apiKey || "").trim();
  if (!s) return "";
  s = s.replace(/^authorization\s*:\s*/i, "").trim();
  const bearer = s.match(/^bearer\s+(.+)$/i);
  if (bearer) s = bearer[1].trim();
  const keyScheme = s.match(/^key\s+(.+)$/i);
  if (keyScheme) s = keyScheme[1].trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** @param {string} apiKey */
function authHeaders(apiKey) {
  const key = normalizeApiKey(apiKey);
  if (!key) throw new Error("API key is required.");
  return { Authorization: `Key ${key}` };
}

/**
 * @param {string} apiKey
 * @param {string} searchQuery
 * @returns {Promise<Array<{ id: number, club_name: string, course_name: string, location?: object }>>}
 */
export async function searchCourses(apiKey, searchQuery) {
  const q = String(searchQuery || "").trim();
  if (!q) throw new Error("Enter a course or club name to search.");

  const url = new URL(`${resolveApiBase()}/search`);
  url.searchParams.set("search_query", q);

  const res = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(res.ok ? "Invalid JSON from search." : `Search failed (${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Search failed (${res.status}).`);
  }
  const courses = data.courses;
  return Array.isArray(courses) ? courses : [];
}

/**
 * @param {string} apiKey
 * @param {number} courseId
 */
export async function getCourse(apiKey, courseId) {
  const id = Number(courseId);
  if (!Number.isFinite(id)) throw new Error("Invalid course id.");

  const res = await fetch(`${resolveApiBase()}/courses/${id}`, { headers: authHeaders(apiKey) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(res.ok ? "Invalid JSON from course detail." : `Course request failed (${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Course request failed (${res.status}).`);
  }
  return data;
}

/**
 * Flatten male/female tee boxes for UI.
 * @param {object} course - GET /courses/{id} payload
 * @returns {Array<{ id: string, label: string, course_rating: number, slope_rating: number, par_total: number, holes: number }>}
 */
export function listTeeOptions(course) {
  const out = [];
  const tees = course && course.tees;
  if (!tees || typeof tees !== "object") return out;

  for (const gender of ["male", "female"]) {
    const list = tees[gender];
    if (!Array.isArray(list)) continue;
    const g = gender === "male" ? "Male" : "Female";
    list.forEach((t, idx) => {
      if (!t || typeof t !== "object") return;
      const holes = Number(t.number_of_holes) || 18;
      const cr = Number(t.course_rating);
      const slope = Number(t.slope_rating);
      const par = Number(t.par_total);
      if (!Number.isFinite(cr) || !Number.isFinite(slope) || !Number.isFinite(par)) return;
      const name = String(t.tee_name || "Tee");
      out.push({
        id: `${gender}-${idx}`,
        label: `${g} — ${name} (${holes} holes)`,
        tee_name: name,
        gender: g,
        course_rating: cr,
        slope_rating: Math.round(slope),
        par_total: Math.round(par),
        holes,
      });
    });
  }
  return out;
}

/**
 * Display name for a round: club, course, tee.
 * @param {object} course
 * @param {{ tee_name?: string, gender?: string }} tee
 */
export function formatCourseLabel(course, tee) {
  const club = String(course.club_name || "").trim();
  const cname = String(course.course_name || "").trim();
  const base = [club, cname].filter(Boolean).join(" — ");
  const tname = tee && String(tee.tee_name || "").trim();
  const g = tee && String(tee.gender || "").trim();
  if (!tname) return base || "Course";
  const frag = g ? `${g} ${tname}` : tname;
  return `${base} — ${frag}`;
}
