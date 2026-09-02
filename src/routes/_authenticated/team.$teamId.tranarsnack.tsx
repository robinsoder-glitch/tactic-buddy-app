import { createFileRoute, useParams } from "@tanstack/react-router";
import { TeamChatPanel } from "@/components/TeamChatPanel";

export const Route = createFileRoute("/_authenticated/team/$teamId/tranarsnack")({
  head: () => ({
    meta: [
      { title: "Tränarsnack – Fotbollsrummet" },
      { name: "description", content: "Intern chatt där lagets ledare delar tips, råd och instruktioner." },
      { property: "og:title", content: "Tränarsnack – Fotbollsrummet" },
      { property: "og:description", content: "Intern chatt för lagets ledare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamChatPage,
});

function TeamChatPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/tranarsnack" });
  return <TeamChatPanel teamId={teamId} />;
}
