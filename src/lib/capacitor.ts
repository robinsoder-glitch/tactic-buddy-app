import { Capacitor } from "@capacitor/core";

let browserModule: typeof import("@capacitor/browser") | null = null;
let appModule: typeof import("@capacitor/app") | null = null;

async function getBrowserModule() {
  if (browserModule) return browserModule;
  browserModule = await import("@capacitor/browser");
  return browserModule;
}

async function getAppModule() {
  if (appModule) return appModule;
  appModule = await import("@capacitor/app");
  return appModule;
}

/** Sant när appen körs inuti Capacitor (iOS/Android). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Öppnar en URL i systemens webbläsare. Används för OAuth i appen. */
export async function openExternalBrowser(url: string): Promise<void> {
  const Browser = await getBrowserModule();
  await Browser.Browser.open({ url });
}

/** Stänger det externa webbläsarfönstret. */
export async function closeExternalBrowser(): Promise<void> {
  const Browser = await getBrowserModule();
  await Browser.Browser.close();
}

/** Lyssnar efter deep links in i appen (t.ex. fotbollsrummet://auth?...). */
export async function onAppUrlOpen(
  handler: (data: { url: string }) => void,
): Promise<() => void> {
  const App = await getAppModule();
  const listener = await App.App.addListener("appUrlOpen", handler);
  return () => listener.remove();
}

/** URL att återvända till efter OAuth/email-bekräftelse i appen. */
export function nativeAuthReturnUrl(): string {
  return "fotbollsrummet://auth";
}
