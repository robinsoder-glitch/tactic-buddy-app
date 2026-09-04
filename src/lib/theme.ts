export type ThemeChoice = "light" | "system" | "dark";

export const THEME_KEY = "taktiktavlan:theme";
/** Standardtema är mörkt ("Djup gräsplan"). Ljust väljs i inställningarna. */
export const DEFAULT_THEME: ThemeChoice = "dark";

export const THEME_LABELS: Record<ThemeChoice, string> = {
  light: "Ljust",
  system: "Följ enheten",
  dark: "Mörkt",
};

export function loadTheme(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT_THEME;
}

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(choice);
  // Mörkt är grundpaletten (:root). Klassen `dark` sätts ändå så att
  // dark:-varianterna och diagrammens mörka tema fortsätter fungera.
  document.documentElement.classList.toggle("light", resolved === "light");
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function saveTheme(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, choice);
  applyTheme(choice);
}

/** Kör innan React startar så att temat inte blinkar. */
export const THEME_BOOT_SCRIPT = `
(() => {
  try {
    const raw = localStorage.getItem(${JSON.stringify(THEME_KEY)}) || "dark";
    const light = raw === "light" || (raw === "system" && !matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
    document.documentElement.style.colorScheme = light ? "light" : "dark";
  } catch {}
})();
`;
