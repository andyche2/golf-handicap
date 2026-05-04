/**
 * World Handicap System (WHS) — core calculations (18-hole scores).
 * References: USGA Rules of Handicapping — Score Differential & Handicap Index (Rule 5).
 * Simplifications: no PCC (Playing Conditions Calculation), no exceptional score reduction / caps.
 */

/**
 * @param {number} adjustedGross - Stroke play total after net double bogey / ESC adjustments
 * @param {number} courseRating
 * @param {number} slopeRating - Slope Rating for the tees played (typically 55–155)
 * @param {number} [pcc=0] - Playing Conditions Calculation (−1 to +3); default 0
 * @returns {number} Score Differential (one decimal)
 */
export function computeScoreDifferential(adjustedGross, courseRating, slopeRating, pcc = 0) {
  if (!Number.isFinite(adjustedGross) || !Number.isFinite(courseRating) || !Number.isFinite(slopeRating)) {
    throw new Error("Invalid numeric input");
  }
  if (slopeRating <= 0) throw new Error("Slope Rating must be positive");
  const raw = ((adjustedGross - courseRating - pcc) * 113) / slopeRating;
  return Math.round(raw * 10) / 10;
}

/**
 * How many lowest score differentials to use for Handicap Index (18-hole–based record).
 * @param {number} scoreCount - Number of acceptable scores in the record (3–20+)
 * @returns {number|null} null if fewer than 3 scores
 */
export function lowestDifferentialCount(scoreCount) {
  if (scoreCount < 3) return null;
  if (scoreCount === 3) return 1;
  if (scoreCount <= 6) return 1;
  if (scoreCount <= 8) return 2;
  if (scoreCount <= 11) return 3;
  if (scoreCount <= 14) return 4;
  if (scoreCount <= 16) return 5;
  if (scoreCount <= 18) return 6;
  if (scoreCount === 19) return 7;
  return 8;
}

/** Truncate toward zero to one decimal (WHS Handicap Index presentation). */
export function truncateOneDecimal(value) {
  return Math.trunc(value * 10) / 10;
}

/**
 * @param {number[]} differentials - Score differentials in the scoring record (already limited to last 20 if needed)
 * @returns {{ index: number|null, used: number[], k: number|null, error?: string }}
 */
export function computeHandicapIndex(differentials) {
  const list = differentials.filter((d) => Number.isFinite(d));
  const n = list.length;
  const k = lowestDifferentialCount(n);
  if (k == null) {
    return { index: null, used: [], k: null, error: "Need at least three 18-hole–based scores to compute a Handicap Index." };
  }
  const sorted = [...list].sort((a, b) => a - b);
  const used = sorted.slice(0, k);
  const avg = used.reduce((s, v) => s + v, 0) / k;
  return { index: truncateOneDecimal(avg), used, k };
}

/**
 * Course Handicap for a specific set of tees (stroke play).
 * @param {number} handicapIndex
 * @param {number} slopeRating
 * @param {number} courseRating
 * @param {number} par
 * @returns {number} integer Course Handicap
 */
export function computeCourseHandicap(handicapIndex, slopeRating, courseRating, par) {
  const raw = handicapIndex * (slopeRating / 113) + (courseRating - par);
  return Math.round(raw);
}

/**
 * @param {Array<{ date: string, differential: number }>} rounds - sorted any order; uses most recent 20 by date
 */
export function differentialsForIndex(rounds) {
  const sorted = [...rounds].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const recent = sorted.slice(0, 20);
  return recent.map((r) => r.differential);
}
