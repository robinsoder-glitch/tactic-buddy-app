export type AppPrefs = {
  /** Hide player names on the pitch by default. */
  hideNames: boolean;
  /** Snap to grid by default in the tactic editor. */
  grid: boolean;
  /** Default playback speed for animations. */
  speed: number;
  /** Default pitch type when creating a new tactic. */
  pitchType: "full" | "small";
  /** Size of the player tokens on the pitch (1 = verklig armspännvidd ~1,4 m). */
  playerScale: number;
  /** Show player photos inside the tokens when available. */
  showPhotos: boolean;
  /** Repeat the animation automatically when it reaches the last step. */
  loop: boolean;
  /** Start playback automatically when a tactic is opened. */
  autoplay: boolean;
  /** Grid step used for snapping (0.025 = fint, 0.05 = normalt, 0.1 = grovt). */
  gridStep: number;
  /** Ask before a step is deleted. */
  confirmDelete: boolean;
};

export const DEFAULT_PREFS: AppPrefs = {
  hideNames: false,
  grid: false,
  speed: 1,
  pitchType: "small",
  playerScale: 1,
  showPhotos: true,
  loop: false,
  autoplay: false,
  gridStep: 0.05,
  confirmDelete: true,
};

const KEY = "taktiktavlan:prefs";

/** Skickas när inställningarna ändras, så öppna vyer kan uppdatera direkt. */
export const PREFS_EVENT = "taktiktavlan:prefs-changed";

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
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

/** Lyssnar på ändrade inställningar (även från en annan flik). */
export function subscribePrefs(listener: (prefs: AppPrefs) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(loadPrefs());
  window.addEventListener(PREFS_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PREFS_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
