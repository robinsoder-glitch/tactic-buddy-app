
function PlanTrainingDialog({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  purpose,
  teams,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  cardId: string;
  cardTitle: string;
  purpose: string;
  teams: Awaited<ReturnType<typeof fetchMyTeams>>;
  userId: string | null;
  onCreated: (teamId: string) => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("19:30");
  const [notes, setNotes] = useState(purpose);

  useEffect(() => {
    if (open && !teamId && teams[0]) setTeamId(teams[0].id);
  }, [open, teams, teamId]);

  const team = teams.find((item) => item.id === teamId);

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Inte inloggad");
      if (!teamId) throw new Error("Välj ett lag");
      if (!date) throw new Error("Välj datum");
      const eventId = await saveEvent({
        teamId,
        userId,
        type: "training",
        title: cardTitle,
        starts_at: new Date(`${date}T${from}`).toISOString(),
        ends_at: to ? new Date(`${date}T${to}`).toISOString() : null,
        location: team?.home_ground ?? null,
        notes: notes || null,
      });
      if (eventId) {
        await addEventResource({ eventId, teamId, userId, kind: "tactic", resourceId: cardId });
      }
    },
    onSuccess: () => {
      toast.success("Träningstillfälle skapat");
      onCreated(teamId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skapa träning från kortet</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="plan-team">Lag</Label>
            <select
              id="plan-team"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Välj lag…</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="plan-date">Datum</Label>
              <Input id="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-from">Från</Label>
              <Input id="plan-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-to">Till</Label>
              <Input id="plan-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-notes">Övrigt</Label>
            <Textarea id="plan-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Skapar…" : "Skapa träning"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
