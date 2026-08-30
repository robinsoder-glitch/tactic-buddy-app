export type AppPrefs = {
  /** Hide player names on the pitch by default. */
  hideNames: boolean;
  /** Snap to grid by default in the tactic editor. */
  grid: boolean;
  /** Default playback speed for animations. */
  speed: number;
  /** Default pitch type when creating a new tactic. */
  pitchType: "full" | "small";
};

export const DEFAULT_PREFS: AppPrefs = {
  hideNames: false,
  grid: false,
  speed: 1,
  pitchType: "small",
};

const KEY = "taktiktavlan:prefs";

export function loadPrefs(): AppPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AppPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}
