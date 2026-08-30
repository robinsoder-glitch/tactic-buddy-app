import { createFileRoute, useParams } from "@tanstack/react-router";
import { EventManager } from "@/components/EventManager";
import { useTeamRole } from "@/hooks/useTeamRole";

export const Route = createFileRoute("/_authenticated/team/$teamId/training")({
  component: TrainingPage,
});

function TrainingPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/training" });
  const { isCoach, userId } = useTeamRole(teamId);
  return <EventManager teamId={teamId} userId={userId} isCoach={isCoach} type="training" title="Träningar" />;
}
