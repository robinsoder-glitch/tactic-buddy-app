import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Hämtad information får leva en stund, så sidbyten och växling
        // mellan flikar i mobilen inte startar om alla hämtningar.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  // Banker och bibliotek ändras sällan – låt dem ligga kvar länge i minnet
  // så att sidbyten inte hämtar hela innehållet på nytt.
  const LONG_LIVED = 30 * 60_000;
  for (const key of [
    ["tb-tactics"],
    ["tb-drills"],
    ["tb-sessions"],
    ["tb-goalkeeper"],
    ["tb-formations"],
    ["tb-rulesets"],
    ["knowledge-articles"],
  ]) {
    queryClient.setQueryDefaults(key, { staleTime: LONG_LIVED, gcTime: LONG_LIVED });
  }
  // Kunskapsbankens redigeringsvy uppdateras vid varje ändring, så den får en
  // kortare men ändå märkbar vila.
  queryClient.setQueryDefaults(["kb-articles"], { staleTime: 5 * 60_000, gcTime: LONG_LIVED });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
