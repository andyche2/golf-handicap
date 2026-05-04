/**
 * GolfCourseAPI — https://api.golfcourseapi.com/docs/api
 * Auth: HTTP header `Key: <your API key>` (see WWW-Authenticate on 401 responses).
 * Register for a free key at https://golfcourseapi.com
 */

const API_BASE = "https://api.golfcourseapi.com/v1";

/** @param {string} apiKey */
function keyHeaders(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("API key is required.");
  return { Key: key };
}

/**
 * @param {string} apiKey
 * @param {string} searchQuery
 * @returns {Promise<Array<{ id: number, club_name: string, course_name: string, location?: object }>>}
 */
export async function searchCourses(apiKey, searchQuery) {
  const q = String(searchQuery || "").trim();
  if (!q) throw new Error("Enter a course or club name to search.");

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("search_query", q);

  const res = await fetch(url.toString(), { headers: keyHeaders(apiKey) });
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

  const res = await fetch(`${API_BASE}/courses/${id}`, { headers: keyHeaders(apiKey) });
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
