import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AppNav } from "@/components/AppNav";
import { ChunkErrorBanner } from "@/components/ChunkErrorBanner";
import { DebugInfoBox } from "@/components/DebugInfoBox";
import { supabase } from "@/integrations/supabase/client";
import { THEME_BOOT_SCRIPT, applyTheme, loadTheme } from "@/lib/theme";

const MODULE_RECOVERY_SCRIPT = `
(() => {
  const reloadKey = "app_preboot_chunk_reload_at";
  const detailKey = "app_preboot_chunk_error";
  const errorPattern = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|chunkloaderror|not a valid javascript mime type/i;

  function showFallback(detail) {
    const fallback = document.getElementById("module-load-fallback");
    const message = document.getElementById("module-load-detail");
    if (message) message.textContent = detail || "En del av appen kunde inte laddas.";
    if (fallback) fallback.hidden = false;
  }

  function recover(detail) {
    try { sessionStorage.setItem(detailKey, detail); } catch {}
    let lastReload = 0;
    try { lastReload = Number(sessionStorage.getItem(reloadKey) || 0); } catch {}

    if (Date.now() - lastReload > 15000) {
      try { sessionStorage.setItem(reloadKey, String(Date.now())); } catch {}
      const url = new URL(location.href);
      url.searchParams.set("v", Date.now().toString(36));
      location.replace(url.toString());
      return;
    }
    showFallback(detail);
  }

  addEventListener("error", (event) => {
    const target = event.target;
    const failedModule = target instanceof HTMLScriptElement && target.type === "module";
    const message = event.message || (failedModule ? "Importing a module script failed" : "");
    if (failedModule || errorPattern.test(message)) recover(message);
  }, true);

  addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = typeof reason === "string" ? reason : reason?.message || "";
    if (errorPattern.test(message)) recover(message);
  });
})();
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sidan hittades inte</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sidan du letar efter finns inte eller har flyttats.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Till startsidan
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Sidan kunde inte laddas
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Något gick fel. Försök igen eller gå tillbaka till startsidan.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Försök igen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Till startsidan
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fotbollsrummet – tränarens verktyg för hela laget" },
      {
        name: "description",
        content:
          "Planera träningar och matcher, samla laget, visa taktik och följ lagets utveckling med Fotbollsrummet.",
      },
      { property: "og:title", content: "Fotbollsrummet" },
      {
        property: "og:description",
        content:
          "Planera träningar och matcher, samla laget, visa taktik och följ lagets utveckling med Fotbollsrummet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <div
          id="module-load-fallback"
          hidden
          role="alert"
          className="fixed inset-x-0 top-0 z-[200] border-b border-destructive/40 bg-destructive px-4 py-3 text-destructive-foreground shadow-lg"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Appen kunde inte uppdateras</p>
              <p id="module-load-detail" className="truncate text-xs opacity-90">
                En del av appen kunde inte laddas.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground"
              onClick={() => window.location.reload()}
            >
              Ladda om
            </button>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: MODULE_RECOVERY_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  useEffect(() => {
    applyTheme(loadTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (loadTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ChunkErrorBanner />
      <div className="min-h-screen pb-[76px] md:pb-8 md:pt-16">
        <Outlet />
      </div>
      <AppNav />
      <DebugInfoBox />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
