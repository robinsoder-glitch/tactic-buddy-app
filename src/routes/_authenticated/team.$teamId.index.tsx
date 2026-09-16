import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Laget öppnas alltid på Översikt – oavsett varifrån man klickar sig in.
 * Truppen ligger på egen adress (/team/$teamId/trupp).
 */
export const Route = createFileRoute("/_authenticated/team/$teamId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/team/$teamId/about",
      params: { teamId: params.teamId },
      replace: true,
    });
  },
});
