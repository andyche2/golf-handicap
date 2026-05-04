/** Shared light/dark theme (localStorage). */

export const THEME_KEY = "golf-handicap-theme";

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
  syncThemeButtons();
}

function themeEl(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

export function syncThemeButtons() {
  const isDark = getTheme() === "dark";
  const darkBtn = themeEl("theme-opt-dark");
  const lightBtn = themeEl("theme-opt-light");
  darkBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
  lightBtn.setAttribute("aria-pressed", isDark ? "false" : "true");
  darkBtn.classList.toggle("active", isDark);
  lightBtn.classList.toggle("active", !isDark);
}

export function initTheme() {
  syncThemeButtons();
  themeEl("theme-opt-dark").addEventListener("click", () => setTheme("dark"));
  themeEl("theme-opt-light").addEventListener("click", () => setTheme("light"));
}
